/**
 * 工作流意图匹配器
 *
 * 检测用户输入是否匹配已注册的工作流触发模式
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { WorkflowMatch, WorkflowTriggerPattern } from "./types";
import type { WorkflowDefinition } from "../types";

/**
 * 工作流意图匹配器
 *
 * 检测用户输入是否匹配已注册的工作流触发模式
 */
export class WorkflowIntentMatcher {
  private patternCache: Map<string, WorkflowDefinition[]> = new Map();
  private cacheExpiry: number = 0;
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
        const match = this.matchPatterns(userMessage, workflow);
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
  private matchPatterns(
    message: string,
    workflow: WorkflowDefinition,
  ): WorkflowMatch | null {
    const conversationTrigger = workflow.triggers?.find(
      (t) => t.type === "conversation",
    );

    if (!conversationTrigger) {
      return null;
    }

    // 使用 trigger 的 patterns 字段
    const simplePatterns = conversationTrigger.patterns || [];
    const minConfidence = this.DEFAULT_MIN_CONFIDENCE;

    // 转换为 WorkflowTriggerPattern 格式
    const allPatterns: WorkflowTriggerPattern[] = simplePatterns.map((p) => ({
      type: "keyword" as const,
      pattern: p,
      weight: 1,
    }));

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
      const result = this.evaluatePattern(normalizedMessage, patternDef);

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
  private evaluatePattern(
    message: string,
    patternDef: WorkflowTriggerPattern,
  ): { confidence: number; params?: Record<string, string> } | null {
    const weight = patternDef.weight ?? 1;

    switch (patternDef.type) {
      case "keyword":
        return this.evaluateKeywordPattern(message, patternDef.pattern, weight);

      case "regex":
        return this.evaluateRegexPattern(message, patternDef.pattern, weight);

      case "semantic":
        // 语义匹配需要调用 embedding 服务，暂不实现
        return null;

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
   */
  private evaluateRegexPattern(
    message: string,
    pattern: string,
    weight: number,
  ): { confidence: number; params?: Record<string, string> } | null {
    try {
      const regex = new RegExp(pattern, "i");
      const match = message.match(regex);

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
   * 加载工作流定义（带缓存）
   */
  private async loadWorkflows(userId: string): Promise<WorkflowDefinition[]> {
    const cacheKey = userId;
    const now = Date.now();

    if (this.patternCache.has(cacheKey) && this.cacheExpiry > now) {
      return this.patternCache.get(cacheKey) ?? [];
    }

    const supabase = await createClient();

    // 查询用户可用的工作流（内置 + 自定义）
    const { data, error } = await supabase
      .from("workflows")
      .select("id, name, definition")
      .or(`category.eq.builtin,user_id.eq.${userId}`)
      .eq("enabled", true);

    if (error) {
      logger.error(
        { error },
        "WorkflowIntentMatcher: Failed to load workflows",
      );
      return [];
    }

    const workflows = (data || [])
      .map((row) => ({
        id: row.id as string,
        name: row.name as string,
        ...(row.definition as unknown as Omit<
          WorkflowDefinition,
          "id" | "name"
        >),
      }))
      .filter((w) => w.triggers?.some((t) => t.type === "conversation"));

    this.patternCache.set(cacheKey, workflows);
    this.cacheExpiry = now + this.CACHE_TTL_MS;

    return workflows;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.patternCache.clear();
    this.cacheExpiry = 0;
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
