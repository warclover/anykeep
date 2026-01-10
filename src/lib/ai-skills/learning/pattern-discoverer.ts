/**
 * IntentPatternDiscoverer - 意图模式自动发现器
 *
 * Phase 3 个性化学习核心组件
 *
 * 职责：
 * - 分析失败案例，发现新的意图模式
 * - 聚类相似输入
 * - 使用 LLM 辅助提取模式
 * - 生成模式建议供审核
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type {
  UserFeedback,
  UserBehavior,
  SuggestedPattern,
  PatternCluster,
  PatternDiscovererConfig,
  PatternStatus,
  DiscoveryMethod,
} from "./types";
import type { IntentType } from "../router/types";

// ============================================
// 常量配置
// ============================================

const DEFAULT_CONFIG: Required<PatternDiscovererConfig> = {
  minClusterSize: 5,
  similarityThreshold: 0.7,
  maxSuggestions: 10,
  useLLMDiscovery: true,
  debug: false,
};

/**
 * 简单的文本相似度计算（基于 Jaccard 相似度）
 */
function calculateSimilarity(text1: string, text2: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);

  const tokens1 = new Set(normalize(text1));
  const tokens2 = new Set(normalize(text2));

  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0;
  }

  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * 提取关键词模式
 */
function extractKeywords(inputs: string[]): string[] {
  const wordCounts = new Map<string, number>();

  for (const input of inputs) {
    const words = input
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 1);

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // 返回出现频率超过 50% 的词
  const threshold = inputs.length * 0.5;
  return [...wordCounts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

// ============================================
// IntentPatternDiscoverer 类
// ============================================

/**
 * 意图模式自动发现器
 *
 * 从失败案例中学习，自动发现新的意图模式
 */
export class IntentPatternDiscoverer {
  private config: Required<PatternDiscovererConfig>;

  constructor(config: PatternDiscovererConfig = {}) {
    this.config = {
      minClusterSize: config.minClusterSize ?? DEFAULT_CONFIG.minClusterSize,
      similarityThreshold:
        config.similarityThreshold ?? DEFAULT_CONFIG.similarityThreshold,
      maxSuggestions: config.maxSuggestions ?? DEFAULT_CONFIG.maxSuggestions,
      useLLMDiscovery: config.useLLMDiscovery ?? DEFAULT_CONFIG.useLLMDiscovery,
      debug: config.debug ?? DEFAULT_CONFIG.debug,
    };
  }

  // ============================================
  // 模式发现
  // ============================================

  /**
   * 从反馈中发现新模式
   *
   * @param feedbacks - 用户反馈列表
   * @returns 建议的新模式列表
   */
  async discoverNewPatterns(
    feedbacks: UserFeedback[],
  ): Promise<SuggestedPattern[]> {
    // 1. 筛选失败案例
    const failedCases = feedbacks.filter(
      (f) =>
        f.actualBehavior === "abandoned" || f.actualBehavior === "corrected",
    );

    if (failedCases.length < this.config.minClusterSize) {
      if (this.config.debug) {
        logger.debug(
          {
            failedCount: failedCases.length,
            minRequired: this.config.minClusterSize,
          },
          "IntentPatternDiscoverer: Not enough failed cases for discovery",
        );
      }
      return [];
    }

    // 2. 聚类相似输入
    const clusters = this.clusterSimilarInputs(
      failedCases.map((f) => f.originalInput),
    );

    if (this.config.debug) {
      logger.debug(
        { clusterCount: clusters.length },
        "IntentPatternDiscoverer: Created clusters",
      );
    }

    // 3. 为每个有效聚类提取模式
    const suggestions: SuggestedPattern[] = [];

    for (const cluster of clusters) {
      if (cluster.size >= this.config.minClusterSize) {
        // 找到该聚类中最常见的纠正意图
        const correctedIntents = this.findCorrectedIntentsForCluster(
          cluster,
          failedCases,
        );

        if (correctedIntents) {
          const pattern = await this.extractPatternFromCluster(
            cluster,
            correctedIntents.type,
            correctedIntents.subType,
          );

          if (pattern) {
            suggestions.push(pattern);
          }
        }
      }
    }

    // 4. 限制返回数量
    return suggestions
      .sort((a, b) => b.discoveryConfidence - a.discoveryConfidence)
      .slice(0, this.config.maxSuggestions);
  }

  /**
   * 聚类相似输入
   */
  clusterSimilarInputs(inputs: string[]): PatternCluster[] {
    const clusters: PatternCluster[] = [];
    const assigned = new Set<number>();

    for (let i = 0; i < inputs.length; i++) {
      if (assigned.has(i)) continue;

      const cluster: string[] = [inputs[i]];
      assigned.add(i);

      for (let j = i + 1; j < inputs.length; j++) {
        if (assigned.has(j)) continue;

        const similarity = calculateSimilarity(inputs[i], inputs[j]);
        if (similarity >= this.config.similarityThreshold) {
          cluster.push(inputs[j]);
          assigned.add(j);
        }
      }

      if (cluster.length >= 2) {
        // 至少 2 个相似输入才形成聚类
        clusters.push({
          id: `cluster-${clusters.length + 1}`,
          inputs: cluster,
          size: cluster.length,
          representative: cluster[0],
          similarityScore: this.calculateClusterSimilarity(cluster),
        });
      }
    }

    return clusters;
  }

  /**
   * 计算聚类内部平均相似度
   */
  private calculateClusterSimilarity(inputs: string[]): number {
    if (inputs.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < inputs.length; i++) {
      for (let j = i + 1; j < inputs.length; j++) {
        totalSimilarity += calculateSimilarity(inputs[i], inputs[j]);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * 找到聚类中最常见的纠正意图
   */
  private findCorrectedIntentsForCluster(
    cluster: PatternCluster,
    feedbacks: UserFeedback[],
  ): { type: IntentType; subType?: string } | null {
    const clusterInputs = new Set(cluster.inputs);
    const intentCounts = new Map<string, number>();

    for (const feedback of feedbacks) {
      if (clusterInputs.has(feedback.originalInput)) {
        if (feedback.correctedType) {
          const key = `${feedback.correctedType}:${feedback.correctedSubType || "*"}`;
          intentCounts.set(key, (intentCounts.get(key) || 0) + 1);
        }
      }
    }

    if (intentCounts.size === 0) {
      return null;
    }

    // 找到最常见的意图
    let maxCount = 0;
    let topIntent = "";

    for (const [intent, count] of intentCounts) {
      if (count > maxCount) {
        maxCount = count;
        topIntent = intent;
      }
    }

    const [type, subType] = topIntent.split(":");
    return {
      type: type as IntentType,
      subType: subType === "*" ? undefined : subType,
    };
  }

  /**
   * 从聚类中提取模式
   */
  private async extractPatternFromCluster(
    cluster: PatternCluster,
    intentType: IntentType,
    intentSubType?: string,
  ): Promise<SuggestedPattern | null> {
    // 提取关键词
    const keywords = extractKeywords(cluster.inputs);

    if (keywords.length === 0) {
      return null;
    }

    // 构建正则表达式模式
    const patternStr = keywords.map((k) => `(?=.*${k})`).join("") + ".*";

    // 计算发现置信度
    const confidence = Math.min(
      0.95,
      0.5 + (cluster.size / 20) * 0.3 + cluster.similarityScore * 0.2,
    );

    return {
      type: intentType,
      subType: intentSubType || "unknown",
      pattern: patternStr,
      weight: Math.round(50 + confidence * 50),
      sampleInputs: cluster.inputs.slice(0, 5),
      discoveryConfidence: confidence,
      discoveryMethod: "clustering",
      occurrenceCount: cluster.size,
    };
  }

  // ============================================
  // 模式建议管理
  // ============================================

  /**
   * 保存模式建议到数据库
   *
   * @param pattern - 建议的模式
   */
  async savePatternSuggestion(pattern: SuggestedPattern): Promise<number> {
    const supabase = await createClient();

    // Type assertion for untyped database table
    type PatternInsertChain = {
      insert: (data: unknown) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: { id: number } | null;
            error: { code?: string } | null;
          }>;
        };
      };
      update: (data: unknown) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => {
            eq: (col: string, val: string) => Promise<{ error: unknown }>;
          };
        };
      };
    };
    type PatternQuery = {
      from: (table: string) => PatternInsertChain;
    };

    const { data, error } = await (supabase as unknown as PatternQuery)
      .from("ai_intent_pattern_suggestions")
      .insert({
        type: pattern.type,
        subtype: pattern.subType,
        pattern: pattern.pattern,
        weight: pattern.weight,
        sample_inputs: pattern.sampleInputs,
        discovery_confidence: pattern.discoveryConfidence,
        discovery_method: pattern.discoveryMethod,
        occurrence_count: pattern.occurrenceCount,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      // 如果是重复键错误，更新出现次数
      if (error.code === "23505") {
        const { error: updateError } = await (
          supabase as unknown as PatternQuery
        )
          .from("ai_intent_pattern_suggestions")
          .update({
            occurrence_count: pattern.occurrenceCount,
            updated_at: new Date().toISOString(),
          })
          .eq("type", pattern.type)
          .eq("subtype", pattern.subType)
          .eq("pattern", pattern.pattern);

        if (updateError) {
          logger.error(
            { error: updateError, pattern },
            "IntentPatternDiscoverer: Failed to update pattern suggestion",
          );
        }
        return -1;
      }

      logger.error(
        { error, pattern },
        "IntentPatternDiscoverer: Failed to save pattern suggestion",
      );
      throw error;
    }

    logger.info(
      { patternId: data?.id, type: pattern.type, subType: pattern.subType },
      "IntentPatternDiscoverer: Saved pattern suggestion",
    );

    return data?.id ?? -1;
  }

  /**
   * 批量保存模式建议
   */
  async savePatternSuggestions(
    patterns: SuggestedPattern[],
  ): Promise<number[]> {
    const savedIds: number[] = [];

    for (const pattern of patterns) {
      try {
        const id = await this.savePatternSuggestion(pattern);
        if (id > 0) {
          savedIds.push(id);
        }
      } catch {
        // 继续处理其他模式
      }
    }

    return savedIds;
  }

  /**
   * 获取待审核的模式建议
   */
  async getPendingSuggestions(
    limit: number = 20,
  ): Promise<Array<SuggestedPattern & { id: number; status: PatternStatus }>> {
    const supabase = await createClient();

    // Type assertion for untyped database table
    type PatternRow = {
      id: number;
      type: string;
      subtype: string;
      pattern: string;
      weight: number;
      sample_inputs: string[];
      discovery_confidence: number;
      discovery_method: string;
      occurrence_count: number;
      status: string;
    };
    type PatternSelectChain = {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (
              n: number,
            ) => Promise<{ data: PatternRow[] | null; error: unknown }>;
          };
        };
      };
    };
    type PatternQuery = {
      from: (table: string) => PatternSelectChain;
    };

    const { data, error } = await (supabase as unknown as PatternQuery)
      .from("ai_intent_pattern_suggestions")
      .select("*")
      .eq("status", "pending")
      .order("discovery_confidence", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(
        { error },
        "IntentPatternDiscoverer: Failed to get pending suggestions",
      );
      throw error;
    }

    return (data || []).map((row) => ({
      id: row.id,
      type: row.type as IntentType,
      subType: row.subtype,
      pattern: row.pattern,
      weight: row.weight,
      sampleInputs: row.sample_inputs || [],
      discoveryConfidence: Number(row.discovery_confidence),
      discoveryMethod: row.discovery_method as DiscoveryMethod,
      occurrenceCount: row.occurrence_count,
      status: row.status as PatternStatus,
    }));
  }

  /**
   * 审批模式建议
   *
   * @param suggestionId - 建议 ID
   * @param approved - 是否批准
   * @param approverId - 审批人 ID
   * @param rejectionReason - 拒绝原因（如果拒绝）
   */
  async reviewSuggestion(
    suggestionId: number,
    approved: boolean,
    approverId: string,
    rejectionReason?: string,
  ): Promise<void> {
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {
      status: approved ? "approved" : "rejected",
      updated_at: new Date().toISOString(),
    };

    if (approved) {
      updateData.approved_by = approverId;
      updateData.approved_at = new Date().toISOString();
    } else {
      updateData.rejection_reason = rejectionReason;
    }

    // Type assertion for untyped database table
    type PatternUpdateChain = {
      update: (data: unknown) => {
        eq: (col: string, val: number) => Promise<{ error: unknown }>;
      };
    };
    type PatternQuery = {
      from: (table: string) => PatternUpdateChain;
    };

    const { error } = await (supabase as unknown as PatternQuery)
      .from("ai_intent_pattern_suggestions")
      .update(updateData)
      .eq("id", suggestionId);

    if (error) {
      logger.error(
        { error, suggestionId },
        "IntentPatternDiscoverer: Failed to review suggestion",
      );
      throw error;
    }

    logger.info(
      { suggestionId, approved, approverId },
      "IntentPatternDiscoverer: Reviewed suggestion",
    );
  }

  /**
   * 获取已批准的模式（用于加载到分类器）
   */
  async getApprovedPatterns(): Promise<SuggestedPattern[]> {
    const supabase = await createClient();

    // Type assertion for untyped database table
    type PatternRow = {
      type: string;
      subtype: string;
      pattern: string;
      weight: number;
      sample_inputs: string[];
      discovery_confidence: number;
      discovery_method: string;
      occurrence_count: number;
    };
    type PatternSelectChain = {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: PatternRow[] | null; error: unknown }>;
        };
      };
    };
    type PatternQuery = {
      from: (table: string) => PatternSelectChain;
    };

    const { data, error } = await (supabase as unknown as PatternQuery)
      .from("ai_intent_pattern_suggestions")
      .select("*")
      .eq("status", "approved")
      .order("weight", { ascending: false });

    if (error) {
      logger.error(
        { error },
        "IntentPatternDiscoverer: Failed to get approved patterns",
      );
      throw error;
    }

    return (data || []).map((row) => ({
      type: row.type as IntentType,
      subType: row.subtype,
      pattern: row.pattern,
      weight: row.weight,
      sampleInputs: row.sample_inputs || [],
      discoveryConfidence: Number(row.discovery_confidence),
      discoveryMethod: row.discovery_method as DiscoveryMethod,
      occurrenceCount: row.occurrence_count,
    }));
  }

  // ============================================
  // 定期发现任务
  // ============================================

  /**
   * 执行模式发现任务
   *
   * 可以通过 cron job 定期调用
   */
  async runDiscoveryTask(
    options: {
      feedbackSince?: Date;
      saveResults?: boolean;
    } = {},
  ): Promise<{
    discovered: number;
    saved: number;
  }> {
    const { feedbackSince, saveResults = true } = options;

    logger.info("IntentPatternDiscoverer: Starting discovery task");

    // 获取失败案例
    const supabase = await createClient();

    // Type assertion for untyped database table
    type FeedbackRow = {
      user_id: string;
      session_id: string;
      turn_id: string;
      original_input: string;
      predicted_type: string;
      predicted_subtype: string | null;
      predicted_confidence: number;
      actual_behavior: string;
      corrected_type: string | null;
      corrected_subtype: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    };
    type ChainableQuery = {
      select: (cols: string) => ChainableQuery;
      in: (col: string, vals: string[]) => ChainableQuery;
      order: (col: string, opts: { ascending: boolean }) => ChainableQuery;
      limit: (n: number) => ChainableQuery;
      gte: (col: string, val: string) => ChainableQuery;
      then: <T>(
        resolve: (value: { data: FeedbackRow[] | null; error: unknown }) => T,
      ) => Promise<T>;
    };
    type FeedbackQuery = {
      from: (table: string) => ChainableQuery;
    };

    let query = (supabase as unknown as FeedbackQuery)
      .from("ai_intent_feedback")
      .select("*")
      .in("actual_behavior", ["corrected", "abandoned"])
      .order("created_at", { ascending: false })
      .limit(500);

    if (feedbackSince) {
      query = query.gte("created_at", feedbackSince.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error },
        "IntentPatternDiscoverer: Failed to fetch feedback for discovery",
      );
      throw error;
    }

    const feedbacks: UserFeedback[] = (data || []).map(
      (row): UserFeedback => ({
        userId: row.user_id,
        sessionId: row.session_id,
        turnId: row.turn_id,
        originalInput: row.original_input,
        predictedIntent: {
          type: row.predicted_type as IntentType,
          subType: row.predicted_subtype ?? undefined,
          confidence: Number(row.predicted_confidence),
        },
        actualBehavior: row.actual_behavior as UserBehavior,
        correctedType: row.corrected_type ?? undefined,
        correctedSubType: row.corrected_subtype ?? undefined,
        metadata: row.metadata,
        timestamp: new Date(row.created_at),
      }),
    );

    // 发现新模式
    const patterns = await this.discoverNewPatterns(feedbacks);

    let savedCount = 0;
    if (saveResults && patterns.length > 0) {
      const savedIds = await this.savePatternSuggestions(patterns);
      savedCount = savedIds.length;
    }

    logger.info(
      { discovered: patterns.length, saved: savedCount },
      "IntentPatternDiscoverer: Discovery task completed",
    );

    return {
      discovered: patterns.length,
      saved: savedCount,
    };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 IntentPatternDiscoverer 实例
 */
export function createPatternDiscoverer(
  config?: PatternDiscovererConfig,
): IntentPatternDiscoverer {
  return new IntentPatternDiscoverer(config);
}
