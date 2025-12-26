/**
 * CorrectionLearner - 纠正学习器
 *
 * 职责：
 * - 记录用户纠正到数据库（含 Embedding 向量）
 * - 查找相似的历史纠正（向量相似度搜索）
 * - 应用学习结果到分类
 *
 * @module ai-learning
 * @version 1.1.0
 * @since 2025-12-25
 * @updated 2025-12-26 集成 Embedding 向量生成
 */

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { generateEmbedding } from "@/lib/embedding";
import type {
  CorrectionSignal,
  IntentType,
  SimilarCorrection,
  LearningServiceResult,
  LearningStats,
} from "./types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 记录纠正参数
 */
export interface RecordCorrectionParams {
  userId: string;
  originalMessage: string;
  wrongIntent: IntentType;
  correctIntent: IntentType;
  signal: CorrectionSignal;
}

/**
 * 查找相似纠正参数
 */
export interface FindSimilarParams {
  input: string;
  userId: string;
  limit?: number;
  similarityThreshold?: number;
}

// =============================================================================
// CorrectionLearner 类
// =============================================================================

export class CorrectionLearner {
  private readonly defaultSimilarityThreshold = 0.8;
  private readonly defaultLimit = 3;

  /**
   * 记录用户纠正
   */
  async recordCorrection(
    params: RecordCorrectionParams,
  ): Promise<LearningServiceResult<{ id: string }>> {
    try {
      const supabase = createClient();

      logger.info(
        {
          userId: params.userId,
          wrongIntent: params.wrongIntent,
          correctIntent: params.correctIntent,
          signal: params.signal.signal,
        },
        "CorrectionLearner: Recording correction",
      );

      // 生成 Embedding 向量
      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(params.originalMessage);
        logger.debug(
          { embeddingDim: embedding.length },
          "CorrectionLearner: Generated embedding",
        );
      } catch (embError) {
        // Embedding 生成失败不阻塞记录，只记录警告
        logger.warn(
          { error: embError instanceof Error ? embError.message : "Unknown" },
          "CorrectionLearner: Failed to generate embedding, continuing without it",
        );
      }

      // 使用类型断言绕过未生成的表类型检查
      // 注意：运行 `npm run supabase:gen:types` 后可移除
      const { data, error } = await (
        supabase as unknown as {
          from: (table: string) => {
            insert: (row: Record<string, unknown>) => {
              select: (cols: string) => {
                single: () => Promise<{
                  data: { id: string } | null;
                  error: { code?: string; message: string } | null;
                }>;
              };
            };
          };
        }
      )
        .from("intent_corrections")
        .insert({
          user_id: params.userId,
          original_input: params.originalMessage,
          original_input_embedding: embedding,
          wrong_intent: params.wrongIntent,
          correct_intent: params.correctIntent,
          signal: params.signal.signal,
          confidence: params.signal.confidence,
          applied_count: 0,
        })
        .select("id")
        .single();

      if (error) {
        logger.error(
          { error },
          "CorrectionLearner: Failed to record correction",
        );
        return { success: false, error: error.message };
      }

      logger.info(
        { correctionId: data?.id },
        "CorrectionLearner: Correction recorded successfully",
      );

      return { success: true, data: { id: data?.id || "" } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "CorrectionLearner: Exception recording correction",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 查找相似的历史纠正
   *
   * 优先使用向量相似度搜索（如果 embedding 可用）
   * 回退到简单文本匹配
   */
  async findSimilarCorrection(
    params: FindSimilarParams,
  ): Promise<LearningServiceResult<SimilarCorrection | null>> {
    try {
      const supabase = createClient();
      const threshold =
        params.similarityThreshold ?? this.defaultSimilarityThreshold;
      const limit = params.limit ?? this.defaultLimit;

      logger.debug(
        {
          userId: params.userId,
          inputPreview: params.input.substring(0, 30),
          threshold,
        },
        "CorrectionLearner: Finding similar corrections",
      );

      // 尝试使用向量相似度搜索
      try {
        const embedding = await generateEmbedding(params.input);

        // 调用 RPC 函数进行向量相似度搜索
        // 使用类型断言绕过类型检查（需要运行 supabase:gen:types 后移除）
        const { data: rpcData, error: rpcError } = await (
          supabase as unknown as {
            rpc: (
              fn: string,
              args: Record<string, unknown>,
            ) => Promise<{
              data: Array<{
                id: string;
                original_input: string;
                correct_intent: string;
                similarity: number;
              }> | null;
              error: { message: string } | null;
            }>;
          }
        ).rpc("find_similar_corrections", {
          query_embedding: embedding,
          target_user_id: params.userId,
          similarity_threshold: threshold,
          limit_count: limit,
        });

        if (rpcError) {
          logger.warn(
            { error: rpcError.message },
            "CorrectionLearner: RPC search failed, falling back to text matching",
          );
          // 回退到文本匹配
          return this.findSimilarByTextMatching(params, threshold, limit);
        }

        if (!rpcData || rpcData.length === 0) {
          return { success: true, data: null };
        }

        const best = rpcData[0];
        logger.info(
          {
            correctionId: best.id,
            similarity: best.similarity,
            correctIntent: best.correct_intent,
          },
          "CorrectionLearner: Found similar correction via vector search",
        );

        return {
          success: true,
          data: {
            id: best.id,
            originalInput: best.original_input,
            correctIntent: best.correct_intent as IntentType,
            similarity: Number(best.similarity),
          },
        };
      } catch (embError) {
        logger.warn(
          { error: embError instanceof Error ? embError.message : "Unknown" },
          "CorrectionLearner: Embedding generation failed, falling back to text matching",
        );
        // 回退到文本匹配
        return this.findSimilarByTextMatching(params, threshold, limit);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "CorrectionLearner: Exception finding similar correction",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 使用简单文本匹配查找相似纠正（回退方法）
   */
  private async findSimilarByTextMatching(
    params: FindSimilarParams,
    threshold: number,
    limit: number,
  ): Promise<LearningServiceResult<SimilarCorrection | null>> {
    const supabase = createClient();

    // 查询用户的纠正历史
    const { data, error } = await (
      supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              val: string,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{
                  data: Array<{
                    id: string;
                    original_input: string;
                    correct_intent: string;
                    applied_count: number;
                  }> | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      }
    )
      .from("intent_corrections")
      .select("id, original_input, correct_intent, applied_count")
      .eq("user_id", params.userId)
      .order("applied_count", { ascending: false })
      .limit(limit * 5); // 获取更多候选进行相似度计算

    if (error) {
      logger.error({ error }, "CorrectionLearner: Failed to query corrections");
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, data: null };
    }

    // 计算相似度并找到最匹配的
    const matches = data
      .map((record) => ({
        id: record.id,
        originalInput: record.original_input,
        correctIntent: record.correct_intent as IntentType,
        similarity: this.computeSimpleSimilarity(
          params.input,
          record.original_input,
        ),
      }))
      .filter((m) => m.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    if (matches.length === 0) {
      return { success: true, data: null };
    }

    const best = matches[0];
    logger.info(
      {
        correctionId: best.id,
        similarity: best.similarity,
        correctIntent: best.correctIntent,
      },
      "CorrectionLearner: Found similar correction via text matching",
    );

    return {
      success: true,
      data: {
        id: best.id,
        originalInput: best.originalInput,
        correctIntent: best.correctIntent,
        similarity: best.similarity,
      },
    };
  }

  /**
   * 记录学习应用（更新应用计数）
   */
  async recordApplication(
    correctionId: string,
  ): Promise<LearningServiceResult> {
    try {
      const supabase = createClient();

      logger.debug(
        { correctionId },
        "CorrectionLearner: Recording application",
      );

      // 使用 RPC 或直接更新
      const { error } = await (
        supabase as unknown as {
          from: (table: string) => {
            update: (row: Record<string, unknown>) => {
              eq: (
                col: string,
                val: string,
              ) => Promise<{
                error: { message: string } | null;
              }>;
            };
          };
        }
      )
        .from("intent_corrections")
        .update({
          applied_count: typeof supabase.rpc === "function" ? undefined : 1, // 将在迁移中使用 increment
          last_applied_at: new Date().toISOString(),
        })
        .eq("id", correctionId);

      if (error) {
        logger.error(
          { error },
          "CorrectionLearner: Failed to record application",
        );
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "CorrectionLearner: Exception recording application",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 获取用户学习统计
   */
  async getStats(
    userId: string,
  ): Promise<LearningServiceResult<LearningStats>> {
    try {
      const supabase = createClient();

      const { data, error } = await (
        supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              eq: (
                col: string,
                val: string,
              ) => Promise<{
                data: Array<{
                  correct_intent: string;
                  applied_count: number;
                  created_at: string;
                }> | null;
                error: { message: string } | null;
              }>;
            };
          };
        }
      )
        .from("intent_corrections")
        .select("correct_intent, applied_count, created_at")
        .eq("user_id", userId);

      if (error) {
        logger.error({ error }, "CorrectionLearner: Failed to get stats");
        return { success: false, error: error.message };
      }

      const records = data || [];
      const byIntent: LearningStats["byIntent"] = {
        query: { corrections: 0, applications: 0 },
        action: { corrections: 0, applications: 0 },
        organize: { corrections: 0, applications: 0 },
        analyze: { corrections: 0, applications: 0 },
        learn: { corrections: 0, applications: 0 },
        create: { corrections: 0, applications: 0 },
        chitchat: { corrections: 0, applications: 0 },
      };

      let totalCorrections = 0;
      let totalApplications = 0;
      let lastCorrectionAt: Date | undefined;

      for (const record of records) {
        totalCorrections++;
        totalApplications += record.applied_count;

        const intent = record.correct_intent as IntentType;
        if (byIntent[intent]) {
          byIntent[intent].corrections++;
          byIntent[intent].applications += record.applied_count;
        }

        const createdAt = new Date(record.created_at);
        if (!lastCorrectionAt || createdAt > lastCorrectionAt) {
          lastCorrectionAt = createdAt;
        }
      }

      return {
        success: true,
        data: {
          userId,
          totalCorrections,
          totalApplications,
          byIntent,
          lastCorrectionAt,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "CorrectionLearner: Exception getting stats",
      );
      return { success: false, error: message };
    }
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 简单文本相似度计算（Jaccard 系数）
   */
  private computeSimpleSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.tokenize(text1));
    const words2 = new Set(this.tokenize(text2));

    if (words1.size === 0 || words2.size === 0) {
      return 0;
    }

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * 简单分词
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建纠正学习器实例
 */
export function createCorrectionLearner(): CorrectionLearner {
  return new CorrectionLearner();
}

// 默认实例
export const correctionLearner = createCorrectionLearner();
