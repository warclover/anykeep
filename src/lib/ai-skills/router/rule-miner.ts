/**
 * RuleMiner - 规则自动挖掘 Pipeline
 *
 * 从 LLM 兜底案例中自动发现新的意图模式，生成候选规则
 *
 * 工作流程:
 * 1. 收集最近 7 天的 LLM 兜底案例
 * 2. 按意图类型聚类
 * 3. 提取共同模式（关键词、短语结构）
 * 4. 使用 LLM 生成正则表达式
 * 5. 验证并存储候选规则
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { generateText } from "ai";
import { getModelByTask } from "@/lib/ai-providers";

// ============================================
// 类型定义
// ============================================

/**
 * 挖掘案例（来自 LLM 兜底）
 */
export interface MiningCase {
  id: string;
  message: string;
  normalizedMessage: string;
  intentType: string;
  intentSubtype: string | null;
  confidence: number;
  createdAt: string;
  embedding?: number[];
}

/**
 * 消息聚类结果
 */
export interface MessageCluster {
  /** 意图键 (type:subtype) */
  intentKey: string;
  /** 聚类中的消息 */
  messages: string[];
  /** 提取的共同模式 */
  patterns: string[];
  /** 聚类大小 */
  size: number;
  /** 平均置信度 */
  avgConfidence: number;
  /** 聚类内相似度 */
  intraClusterSimilarity: number;
}

/**
 * 候选规则
 */
export interface CandidateRule {
  /** 正则表达式模式 */
  pattern: string;
  /** 意图类型 */
  intentType: string;
  /** 意图子类型 */
  intentSubtype: string | null;
  /** 初始权重 */
  weight: number;
  /** 示例消息 */
  examples: string[];
  /** 发现置信度 */
  discoveryConfidence: number;
  /** 状态 */
  status: "pending_review" | "approved" | "rejected" | "merged";
  /** 发现方法 */
  discoveryMethod: "clustering" | "llm" | "manual";
}

/**
 * 挖掘配置
 */
export interface RuleMinerConfig {
  /** 最少案例数才值得挖掘 */
  minClusterSize: number;
  /** 案例回溯天数 */
  lookbackDays: number;
  /** 每次挖掘的最大案例数 */
  maxCases: number;
  /** 共同模式阈值（出现在多少比例的案例中） */
  commonPatternThreshold: number;
  /** 初始规则权重 */
  initialWeight: number;
  /** LLM 生成正则的超时（毫秒） */
  llmTimeoutMs: number;
}

/**
 * 挖掘统计
 */
export interface MiningStats {
  /** 处理的案例数 */
  casesProcessed: number;
  /** 生成的聚类数 */
  clustersGenerated: number;
  /** 生成的候选规则数 */
  candidatesGenerated: number;
  /** 最后挖掘时间 */
  lastMiningAt: number | null;
  /** 挖掘耗时（毫秒） */
  lastMiningDurationMs: number | null;
}

// ============================================
// 默认配置
// ============================================

export const DEFAULT_RULE_MINER_CONFIG: RuleMinerConfig = {
  minClusterSize: 3,
  lookbackDays: 7,
  maxCases: 500,
  commonPatternThreshold: 0.5,
  initialWeight: 60,
  llmTimeoutMs: 10000,
};

// ============================================
// RuleMiner 类
// ============================================

/**
 * 规则挖掘 Pipeline
 *
 * @example
 * ```typescript
 * const miner = new RuleMiner();
 *
 * // 执行一次挖掘
 * const candidates = await miner.mine();
 *
 * // 查看统计
 * console.log(miner.getStats());
 * ```
 */
export class RuleMiner {
  private config: RuleMinerConfig;
  private stats: MiningStats;

  constructor(config?: Partial<RuleMinerConfig>) {
    this.config = { ...DEFAULT_RULE_MINER_CONFIG, ...config };
    this.stats = {
      casesProcessed: 0,
      clustersGenerated: 0,
      candidatesGenerated: 0,
      lastMiningAt: null,
      lastMiningDurationMs: null,
    };

    logger.debug({ config: this.config }, "RuleMiner: Initialized");
  }

  /**
   * 执行规则挖掘
   *
   * @returns 生成的候选规则
   */
  async mine(): Promise<CandidateRule[]> {
    const startTime = Date.now();

    try {
      logger.info("RuleMiner: Starting mining pipeline");

      // 1. 收集待挖掘的案例
      const cases = await this.collectPendingCases();
      this.stats.casesProcessed = cases.length;

      if (cases.length < this.config.minClusterSize) {
        logger.info(
          { caseCount: cases.length, minRequired: this.config.minClusterSize },
          "RuleMiner: Not enough cases for mining",
        );
        return [];
      }

      // 2. 按意图聚类
      const clusters = await this.clusterMessages(cases);
      this.stats.clustersGenerated = clusters.length;

      if (clusters.length === 0) {
        logger.info("RuleMiner: No valid clusters found");
        return [];
      }

      // 3. 生成候选规则
      const candidates = await this.generateCandidateRules(clusters);
      this.stats.candidatesGenerated = candidates.length;

      // 4. 存储候选规则
      if (candidates.length > 0) {
        await this.storeCandidates(candidates);
      }

      // 5. 标记已分析的案例
      await this.markCasesAsAnalyzed(cases.map((c) => c.id));

      this.stats.lastMiningAt = Date.now();
      this.stats.lastMiningDurationMs = Date.now() - startTime;

      logger.info(
        {
          casesProcessed: this.stats.casesProcessed,
          clustersGenerated: this.stats.clustersGenerated,
          candidatesGenerated: this.stats.candidatesGenerated,
          durationMs: this.stats.lastMiningDurationMs,
        },
        "RuleMiner: Mining completed",
      );

      return candidates;
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "RuleMiner: Mining failed",
      );
      throw err;
    }
  }

  /**
   * 收集待挖掘的案例
   */
  async collectPendingCases(): Promise<MiningCase[]> {
    const supabase = await createServiceClient();

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - this.config.lookbackDays);

    // 从意图反馈表获取 LLM 兜底案例
    const { data, error } = await supabase
      .from("ai_intent_feedback")
      .select("*")
      .gte("created_at", lookbackDate.toISOString())
      .or("metadata->>source.eq.llm,metadata->>source.eq.hybrid")
      .order("created_at", { ascending: false })
      .limit(this.config.maxCases);

    if (error) {
      logger.error(
        { error: error.message },
        "RuleMiner: Failed to collect cases",
      );
      return [];
    }

    // 转换为 MiningCase 格式
    return (data ?? []).map((row) => ({
      id: String(row.id),
      message: row.original_input,
      normalizedMessage: row.original_input.toLowerCase().trim(),
      intentType: row.predicted_type,
      intentSubtype: row.predicted_subtype,
      confidence: Number(row.predicted_confidence),
      createdAt: row.created_at,
    }));
  }

  /**
   * 按意图聚类消息
   */
  async clusterMessages(cases: MiningCase[]): Promise<MessageCluster[]> {
    // 按意图分组
    const intentGroups = this.groupByIntent(cases);
    const clusters: MessageCluster[] = [];

    for (const [intentKey, group] of Object.entries(intentGroups)) {
      // 跳过太小的组
      if (group.length < this.config.minClusterSize) {
        continue;
      }

      // 提取共同模式
      const patterns = this.extractCommonPatterns(group);

      // 计算平均置信度
      const avgConfidence =
        group.reduce((sum, c) => sum + c.confidence, 0) / group.length;

      // 计算聚类内相似度（简化版：基于共同词的比例）
      const intraClusterSimilarity =
        this.calculateIntraClusterSimilarity(group);

      clusters.push({
        intentKey,
        messages: group.map((c) => c.message),
        patterns,
        size: group.length,
        avgConfidence,
        intraClusterSimilarity,
      });
    }

    // 按大小排序，优先处理大聚类
    return clusters.sort((a, b) => b.size - a.size);
  }

  /**
   * 生成候选规则
   */
  async generateCandidateRules(
    clusters: MessageCluster[],
  ): Promise<CandidateRule[]> {
    const candidates: CandidateRule[] = [];

    for (const cluster of clusters) {
      try {
        // 使用 LLM 生成正则模式
        const regexPattern = await this.generateRegexWithLLM(cluster);

        if (!regexPattern) {
          continue;
        }

        // 验证正则表达式
        if (!this.isValidRegex(regexPattern)) {
          logger.warn(
            { pattern: regexPattern, intentKey: cluster.intentKey },
            "RuleMiner: Invalid regex generated",
          );
          continue;
        }

        // 测试正则匹配率
        const matchRate = this.testRegexMatchRate(
          regexPattern,
          cluster.messages,
        );
        if (matchRate < 0.5) {
          logger.warn(
            {
              pattern: regexPattern,
              matchRate,
              intentKey: cluster.intentKey,
            },
            "RuleMiner: Low match rate, skipping",
          );
          continue;
        }

        const [intentType, intentSubtype] = cluster.intentKey.split(":");

        candidates.push({
          pattern: regexPattern,
          intentType,
          intentSubtype: intentSubtype || null,
          weight: this.config.initialWeight,
          examples: cluster.messages.slice(0, 5),
          discoveryConfidence: cluster.avgConfidence * matchRate,
          status: "pending_review",
          discoveryMethod: "clustering",
        });
      } catch (err) {
        logger.error(
          {
            error: err instanceof Error ? err.message : String(err),
            intentKey: cluster.intentKey,
          },
          "RuleMiner: Failed to generate rule for cluster",
        );
      }
    }

    return candidates;
  }

  /**
   * 使用 LLM 生成正则表达式
   */
  private async generateRegexWithLLM(
    cluster: MessageCluster,
  ): Promise<string | null> {
    const prompt = `你是一个正则表达式专家。根据以下用户消息示例，生成一个能匹配它们的正则表达式。

## 意图类型
${cluster.intentKey}

## 消息示例
${cluster.messages
  .slice(0, 10)
  .map((m, i) => `${i + 1}. "${m}"`)
  .join("\n")}

## 提取的共同模式
${cluster.patterns.join(", ")}

## 要求
1. 生成的正则表达式应该能匹配大部分示例消息
2. 模式应该简洁但不过于宽泛
3. 使用中文友好的 Unicode 字符类
4. 直接返回正则表达式，不要包含解释

## 输出格式
只输出一个正则表达式，不要有其他内容。`;

    try {
      const model = getModelByTask("simple-query");
      if (!model) {
        logger.warn("RuleMiner: No model available for simple-query task");
        return null;
      }
      const result = await generateText({
        model,
        prompt,
        maxOutputTokens: 200,
        temperature: 0.3,
      });

      if (!result.text) {
        return null;
      }

      // 清理响应，提取正则表达式
      let pattern = result.text.trim();
      // 移除可能的代码块标记
      pattern = pattern
        .replace(/^```(?:regex)?/, "")
        .replace(/```$/, "")
        .trim();
      // 移除可能的引号
      pattern = pattern.replace(/^["']|["']$/g, "");

      return pattern || null;
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "RuleMiner: LLM regex generation failed",
      );
      return null;
    }
  }

  /**
   * 存储候选规则到数据库
   */
  private async storeCandidates(candidates: CandidateRule[]): Promise<void> {
    const supabase = await createServiceClient();

    for (const candidate of candidates) {
      try {
        const { error } = await supabase
          .from("ai_intent_pattern_suggestions")
          .upsert(
            {
              type: candidate.intentType,
              subtype: candidate.intentSubtype || "",
              pattern: candidate.pattern,
              weight: candidate.weight,
              sample_inputs: candidate.examples,
              discovery_confidence: candidate.discoveryConfidence,
              discovery_method: candidate.discoveryMethod,
              status: candidate.status,
            },
            {
              onConflict: "type,subtype,pattern",
            },
          );

        if (error) {
          logger.error(
            { error: error.message, pattern: candidate.pattern },
            "RuleMiner: Failed to store candidate",
          );
        }
      } catch (err) {
        logger.error(
          {
            error: err instanceof Error ? err.message : String(err),
            pattern: candidate.pattern,
          },
          "RuleMiner: Failed to store candidate",
        );
      }
    }
  }

  /**
   * 标记案例为已分析
   */
  private async markCasesAsAnalyzed(caseIds: string[]): Promise<void> {
    // 这里可以更新 ai_intent_feedback 表的 analyzed 标记
    // 目前表结构中可能没有这个字段，可以通过 metadata 来标记
    logger.debug(
      { count: caseIds.length },
      "RuleMiner: Cases marked as analyzed",
    );
  }

  /**
   * 获取挖掘统计
   */
  getStats(): MiningStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      casesProcessed: 0,
      clustersGenerated: 0,
      candidatesGenerated: 0,
      lastMiningAt: null,
      lastMiningDurationMs: null,
    };
  }

  // ============================================
  // 私有辅助方法
  // ============================================

  /**
   * 按意图分组
   */
  private groupByIntent(cases: MiningCase[]): Record<string, MiningCase[]> {
    const groups: Record<string, MiningCase[]> = {};

    for (const c of cases) {
      const key = `${c.intentType}:${c.intentSubtype ?? ""}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(c);
    }

    return groups;
  }

  /**
   * 提取共同模式
   */
  private extractCommonPatterns(cases: MiningCase[]): string[] {
    const wordCounts = new Map<string, number>();

    // 统计词频
    for (const c of cases) {
      // 分词（简单按空格和标点分割）
      const words = c.normalizedMessage.split(
        /[\s,。！？、；：""''（）【】\-_]+/,
      );
      const uniqueWords = new Set(words.filter((w) => w.length > 1));

      for (const word of uniqueWords) {
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }

    // 筛选高频词（出现在 >50% 案例中）
    const threshold = cases.length * this.config.commonPatternThreshold;

    return Array.from(wordCounts.entries())
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * 计算聚类内相似度
   */
  private calculateIntraClusterSimilarity(cases: MiningCase[]): number {
    if (cases.length < 2) return 1;

    // 简化版：基于 Jaccard 相似度的平均值
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < Math.min(cases.length, 10); i++) {
      for (let j = i + 1; j < Math.min(cases.length, 10); j++) {
        const words1 = new Set(cases[i].normalizedMessage.split(/\s+/));
        const words2 = new Set(cases[j].normalizedMessage.split(/\s+/));

        const intersection = new Set([...words1].filter((w) => words2.has(w)));
        const union = new Set([...words1, ...words2]);

        if (union.size > 0) {
          totalSimilarity += intersection.size / union.size;
          comparisons++;
        }
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * 验证正则表达式是否有效
   */
  private isValidRegex(pattern: string): boolean {
    try {
      new RegExp(pattern, "i");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 测试正则表达式匹配率
   */
  private testRegexMatchRate(pattern: string, messages: string[]): number {
    try {
      const regex = new RegExp(pattern, "i");
      const matchCount = messages.filter((m) => regex.test(m)).length;
      return matchCount / messages.length;
    } catch {
      return 0;
    }
  }
}

// ============================================
// 单例管理
// ============================================

let ruleMinerInstance: RuleMiner | null = null;

/**
 * 获取 RuleMiner 单例
 */
export function getRuleMiner(config?: Partial<RuleMinerConfig>): RuleMiner {
  if (!ruleMinerInstance) {
    ruleMinerInstance = new RuleMiner(config);
    logger.debug("RuleMiner: Singleton created");
  }
  return ruleMinerInstance;
}

/**
 * 重置 RuleMiner 单例
 * @internal 仅用于测试
 */
export function resetRuleMiner(): void {
  ruleMinerInstance = null;
  logger.debug("RuleMiner: Singleton reset");
}
