/**
 * 工作流意图匹配器
 *
 * 检测用户输入是否匹配已注册的工作流触发模式
 *
 * @version 1.1.0
 * @since 2026-01-08
 * @updated 2026-01-09 - 安全修复：添加 ReDoS 防护
 * @updated 2026-01-09 - 修复缓存独立过期时间问题
 * @updated 2026-01-09 - 新增语义匹配支持
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { WorkflowMatch, WorkflowTriggerPattern } from "./types";
import type { WorkflowDefinition } from "../types";
import { getSemanticMatcher } from "./semantic-matcher";

/**
 * 缓存条目接口
 */
interface CacheEntry {
  data: WorkflowDefinition[];
  expiresAt: number;
}

/**
 * 正则表达式安全配置
 */
const REGEX_SECURITY = {
  /** 最大正则表达式长度 */
  MAX_PATTERN_LENGTH: 200,
  /** 正则执行超时警告阈值（毫秒） */
  EXECUTION_WARNING_MS: 50,
  /** 危险的回溯模式（ReDoS 风险） */
  DANGEROUS_PATTERNS: [
    // 嵌套量词: (a+)+, (a*)*
    /\([^)]*[+*][^)]*\)[+*]/,
    // 重叠的可选组: (a|a)+
    /\([^|)]+\|[^|)]+\)\+/,
    // 过多的量词组合: .*.*.*
    /(\.\*){3,}/,
    // 嵌套的捕获组带量词: ((a)+)+
    /\(\([^)]+\)\+\)\+/,
  ],
} as const;

/**
 * 工作流意图匹配器
 *
 * 检测用户输入是否匹配已注册的工作流触发模式
 */
export class WorkflowIntentMatcher {
  // 修复：使用带独立过期时间的缓存条目
  private patternCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟
  private readonly DEFAULT_MIN_CONFIDENCE = 0.7;

  /**
   * 匹配工作流
   *
   * @param userMessage - 用户消息
   * @param userId - 用户 ID
   * @returns 匹配结果或 null
   */
  async matchWorkflow(
    userMessage: string,
    userId: string,
  ): Promise<WorkflowMatch | null> {
    const startTime = performance.now();

    try {
      // 加载工作流定义（带缓存）
      const workflows = await this.loadWorkflows(userId);

      if (workflows.length === 0) {
        return null;
      }

      // 按优先级排序的匹配结果
      const matches: WorkflowMatch[] = [];

      for (const workflow of workflows) {
        const match = await this.matchPatterns(userMessage, workflow);
        if (match) {
          matches.push(match);
        }
      }

      // 按置信度降序排列，返回最佳匹配
      matches.sort((a, b) => b.confidence - a.confidence);
      const bestMatch = matches[0] || null;

      if (bestMatch) {
        logger.info(
          {
            workflowId: bestMatch.workflowId,
            pattern: bestMatch.matchedPattern,
            confidence: bestMatch.confidence,
            durationMs: Math.round(performance.now() - startTime),
          },
          "WorkflowIntentMatcher: Pattern matched",
        );
      }

      return bestMatch;
    } catch (error) {
      logger.error({ error, userId }, "WorkflowIntentMatcher: Match failed");
      return null;
    }
  }

  /**
   * 匹配工作流触发模式
   */
  private async matchPatterns(
    message: string,
    workflow: WorkflowDefinition,
  ): Promise<WorkflowMatch | null> {
    const conversationTrigger = workflow.triggers?.find(
      (t) => t.type === "conversation",
    );

    if (!conversationTrigger) {
      return null;
    }

    // 使用 trigger 的 patterns 字段（关键词模式）
    const simplePatterns = conversationTrigger.patterns || [];
    const minConfidence = this.DEFAULT_MIN_CONFIDENCE;

    // 转换为 WorkflowTriggerPattern 格式
    const allPatterns: WorkflowTriggerPattern[] = simplePatterns.map((p) => ({
      type: "keyword" as const,
      pattern: p,
      weight: 1,
    }));

    // 添加语义模式（如果配置了）
    if (conversationTrigger.semanticPatterns?.referenceTexts?.length) {
      allPatterns.push({
        type: "semantic" as const,
        pattern: "[semantic]", // 占位符，实际使用 semanticConfig
        weight: 1,
        semanticConfig: {
          referenceTexts: conversationTrigger.semanticPatterns.referenceTexts,
          threshold: conversationTrigger.semanticPatterns.threshold,
        },
      });
    }

    if (allPatterns.length === 0) {
      return null;
    }

    const normalizedMessage = message.toLowerCase().trim();
    let bestMatch: {
      pattern: string;
      confidence: number;
      params?: Record<string, string>;
    } | null = null;

    for (const patternDef of allPatterns) {
      const result = await this.evaluatePattern(normalizedMessage, patternDef);

      if (result && result.confidence >= minConfidence) {
        if (!bestMatch || result.confidence > bestMatch.confidence) {
          bestMatch = {
            pattern: patternDef.pattern,
            confidence: result.confidence,
            params: result.params,
          };
        }
      }
    }

    if (!bestMatch) {
      return null;
    }

    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      confidence: bestMatch.confidence,
      matchedPattern: bestMatch.pattern,
      extractedParams: bestMatch.params,
    };
  }

  /**
   * 评估单个模式
   */
  private async evaluatePattern(
    message: string,
    patternDef: WorkflowTriggerPattern,
  ): Promise<{ confidence: number; params?: Record<string, string> } | null> {
    const weight = patternDef.weight ?? 1;

    switch (patternDef.type) {
      case "keyword":
        return this.evaluateKeywordPattern(message, patternDef.pattern, weight);

      case "regex":
        return this.evaluateRegexPattern(message, patternDef.pattern, weight);

      case "semantic":
        return this.evaluateSemanticPattern(message, patternDef, weight);

      default:
        return null;
    }
  }

  /**
   * 关键词模式匹配
   */
  private evaluateKeywordPattern(
    message: string,
    pattern: string,
    weight: number,
  ): { confidence: number; params?: Record<string, string> } | null {
    const normalizedPattern = pattern.toLowerCase();

    // 精确包含匹配
    if (message.includes(normalizedPattern)) {
      return { confidence: 0.9 * weight };
    }

    // 模糊匹配（关键词重叠度）
    const patternWords = normalizedPattern
      .split(/\s+/)
      .filter((w) => w.length > 1);
    const messageWords = message.split(/\s+/).filter((w) => w.length > 1);

    if (patternWords.length === 0) {
      return null;
    }

    const overlap = patternWords.filter((w) =>
      messageWords.some((mw) => mw.includes(w) || w.includes(mw)),
    );

    const overlapRatio = overlap.length / patternWords.length;

    if (overlapRatio >= 0.7) {
      return { confidence: 0.7 * weight * overlapRatio };
    }

    return null;
  }

  /**
   * 正则模式匹配
   *
   * 安全修复：添加 ReDoS 防护
   */
  private evaluateRegexPattern(
    message: string,
    pattern: string,
    weight: number,
  ): { confidence: number; params?: Record<string, string> } | null {
    // 安全检查 1: 长度限制
    if (pattern.length > REGEX_SECURITY.MAX_PATTERN_LENGTH) {
      logger.warn(
        {
          patternLength: pattern.length,
          maxLength: REGEX_SECURITY.MAX_PATTERN_LENGTH,
        },
        "WorkflowIntentMatcher: Regex pattern too long, rejected",
      );
      return null;
    }

    // 安全检查 2: 危险模式检测
    if (this.hasReDoSRisk(pattern)) {
      logger.warn(
        { pattern },
        "WorkflowIntentMatcher: Potentially dangerous regex pattern (ReDoS risk), rejected",
      );
      return null;
    }

    try {
      const startTime = performance.now();
      const regex = new RegExp(pattern, "i");
      const match = message.match(regex);
      const elapsed = performance.now() - startTime;

      // 安全检查 3: 执行时间监控
      if (elapsed > REGEX_SECURITY.EXECUTION_WARNING_MS) {
        logger.warn(
          { pattern, elapsedMs: Math.round(elapsed) },
          "WorkflowIntentMatcher: Regex execution slow",
        );
      }

      if (match) {
        // 提取命名捕获组作为参数
        const params: Record<string, string> = {};
        if (match.groups) {
          Object.assign(params, match.groups);
        }

        return {
          confidence: 0.85 * weight,
          params: Object.keys(params).length > 0 ? params : undefined,
        };
      }
    } catch (error) {
      logger.warn(
        { pattern, error },
        "WorkflowIntentMatcher: Invalid regex pattern",
      );
    }

    return null;
  }

  /**
   * 语义模式匹配
   *
   * 使用向量相似度进行语义级别的意图匹配
   */
  private async evaluateSemanticPattern(
    message: string,
    patternDef: WorkflowTriggerPattern,
    weight: number,
  ): Promise<{ confidence: number; params?: Record<string, string> } | null> {
    // 检查语义配置
    if (!patternDef.semanticConfig?.referenceTexts?.length) {
      logger.warn(
        { pattern: patternDef.pattern },
        "WorkflowIntentMatcher: Semantic pattern missing referenceTexts",
      );
      return null;
    }

    try {
      const semanticMatcher = getSemanticMatcher();
      const result = await semanticMatcher.match(message, {
        referenceTexts: patternDef.semanticConfig.referenceTexts,
        threshold: patternDef.semanticConfig.threshold,
        precomputedEmbeddings: patternDef.semanticConfig.precomputedEmbeddings,
      });

      if (result.matched) {
        logger.debug(
          {
            message: message.substring(0, 50),
            confidence: result.confidence.toFixed(4),
            bestMatchText: result.bestMatchText?.substring(0, 30),
          },
          "WorkflowIntentMatcher: Semantic match found",
        );

        return {
          confidence: result.confidence * weight,
        };
      }
    } catch (error) {
      logger.error(
        { error, pattern: patternDef.pattern },
        "WorkflowIntentMatcher: Semantic evaluation failed",
      );
    }

    return null;
  }

  /**
   * 检测正则表达式是否存在 ReDoS 风险
   *
   * 检测已知的危险模式，如嵌套量词、重叠可选组等
   */
  private hasReDoSRisk(pattern: string): boolean {
    for (const dangerousPattern of REGEX_SECURITY.DANGEROUS_PATTERNS) {
      if (dangerousPattern.test(pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 加载工作流定义（带缓存）
   *
   * 安全修复：使用分离查询避免 SQL 注入风险
   * 修复：每个用户独立的过期时间
   */
  private async loadWorkflows(userId: string): Promise<WorkflowDefinition[]> {
    const cacheKey = userId;
    const now = Date.now();

    // 修复：检查该用户缓存条目的独立过期时间
    const cached = this.patternCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const supabase = await createClient();

    // 安全修复：分离查询内置工作流和用户工作流，避免字符串拼接
    const [builtinResult, userResult] = await Promise.all([
      supabase
        .from("workflows")
        .select("id, name, definition")
        .eq("category", "builtin")
        .eq("enabled", true),
      supabase
        .from("workflows")
        .select("id, name, definition")
        .eq("user_id", userId)
        .eq("enabled", true),
    ]);

    if (builtinResult.error) {
      logger.error(
        { error: builtinResult.error },
        "WorkflowIntentMatcher: Failed to load builtin workflows",
      );
    }

    if (userResult.error) {
      logger.error(
        { error: userResult.error },
        "WorkflowIntentMatcher: Failed to load user workflows",
      );
    }

    // 合并结果
    const data = [...(builtinResult.data || []), ...(userResult.data || [])];

    const workflows = data
      .map((row) => ({
        id: row.id as string,
        name: row.name as string,
        ...(row.definition as unknown as Omit<
          WorkflowDefinition,
          "id" | "name"
        >),
      }))
      .filter((w) => w.triggers?.some((t) => t.type === "conversation"));

    // 修复：存储独立过期时间的缓存条目
    this.patternCache.set(cacheKey, {
      data: workflows,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return workflows;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.patternCache.clear();
  }
}

// 单例导出
let matcherInstance: WorkflowIntentMatcher | null = null;

export function getWorkflowIntentMatcher(): WorkflowIntentMatcher {
  if (!matcherInstance) {
    matcherInstance = new WorkflowIntentMatcher();
  }
  return matcherInstance;
}
