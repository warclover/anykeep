/**
 * IntentCorrectionService - 意图纠正服务
 *
 * 职责：
 * - 记录用户对 AI 意图识别的纠正
 * - 支持自我进化学习机制
 * - 查询相似纠正历史
 *
 * @version 1.0.0
 * @since 2025-12-25
 * @see {@link 20251225000002_add_intent_corrections.sql} 数据库迁移
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { IntentType } from "@/lib/ai-skills/router/types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 纠正信号类型
 */
export type CorrectionSignal =
  | "explicit_wrong" // 用户点击"这不是我的意图"
  | "correction_follow" // 用户在后续消息中纠正
  | "reformulation" // 用户重新表述请求
  | "negative_feedback"; // 用户给出负面反馈

/**
 * 意图纠正记录
 */
export interface IntentCorrectionRecord {
  id: string;
  userId: string;
  originalInput: string;
  wrongIntent: IntentType;
  correctIntent: IntentType;
  signal: CorrectionSignal;
  confidence: number;
  appliedCount: number;
  lastAppliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建纠正请求
 */
export interface CreateCorrectionRequest {
  originalInput: string;
  wrongIntent: IntentType;
  correctIntent: IntentType;
  signal: CorrectionSignal;
  confidence?: number;
  conversationId?: string;
  messageId?: string;
}

/**
 * 相似纠正结果
 */
export interface SimilarCorrection {
  id: string;
  originalInput: string;
  correctIntent: IntentType;
  similarity: number;
}

/**
 * 学习统计
 */
export interface LearningStats {
  userId: string;
  totalCorrections: number;
  totalApplications: number;
  byIntent: Record<
    string,
    {
      corrections: number;
      applications: number;
    }
  >;
  lastCorrectionAt?: string;
}

/**
 * 服务响应
 */
export interface IntentCorrectionResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取 intent_corrections 表查询
 */
function getCorrectionsTable(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from("intent_corrections");
}

// =============================================================================
// IntentCorrectionService 类
// =============================================================================

export class IntentCorrectionService {
  /**
   * 创建意图纠正记录
   */
  async createCorrection(
    request: CreateCorrectionRequest,
  ): Promise<IntentCorrectionResponse<{ id: string }>> {
    try {
      const supabase = await createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        logger.warn(
          { authError },
          "IntentCorrectionService: User not authenticated",
        );
        return { success: false, error: "用户未登录" };
      }

      // 验证意图类型
      const validIntents: IntentType[] = [
        "query",
        "organize",
        "create",
        "learn",
        "analyze",
        "action",
        "chitchat",
      ];

      if (
        !validIntents.includes(request.wrongIntent) ||
        !validIntents.includes(request.correctIntent)
      ) {
        return { success: false, error: "无效的意图类型" };
      }

      if (request.wrongIntent === request.correctIntent) {
        return { success: false, error: "错误意图和正确意图不能相同" };
      }

      // 插入纠正记录
      const { data, error } = await getCorrectionsTable(supabase)
        .insert({
          user_id: user.id,
          original_input: request.originalInput,
          wrong_intent: request.wrongIntent,
          correct_intent: request.correctIntent,
          signal: request.signal,
          confidence: request.confidence ?? 0.9,
        })
        .select("id")
        .single();

      if (error) {
        logger.error(
          { error },
          "IntentCorrectionService: Failed to create correction",
        );
        return { success: false, error: "创建纠正记录失败" };
      }

      logger.info(
        {
          correctionId: data?.id,
          wrongIntent: request.wrongIntent,
          correctIntent: request.correctIntent,
          signal: request.signal,
        },
        "IntentCorrectionService: Correction created",
      );

      return {
        success: true,
        data: { id: String(data?.id ?? "") },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "IntentCorrectionService: Unexpected error",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取用户的纠正历史
   */
  async getCorrectionHistory(
    limit = 20,
    offset = 0,
  ): Promise<
    IntentCorrectionResponse<{
      corrections: IntentCorrectionRecord[];
      total: number;
    }>
  > {
    try {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      const { data, error, count } = await getCorrectionsTable(supabase)
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error(
          { error },
          "IntentCorrectionService: Failed to get history",
        );
        return { success: false, error: "获取纠正历史失败" };
      }

      const corrections: IntentCorrectionRecord[] = (data || []).map(
        (item: {
          id: string;
          user_id: string;
          original_input: string;
          wrong_intent: string;
          correct_intent: string;
          signal: string;
          confidence: number;
          applied_count: number;
          last_applied_at: string | null;
          created_at: string;
          updated_at: string;
        }) => ({
          id: item.id,
          userId: item.user_id,
          originalInput: item.original_input,
          wrongIntent: item.wrong_intent as IntentType,
          correctIntent: item.correct_intent as IntentType,
          signal: item.signal as CorrectionSignal,
          confidence: item.confidence,
          appliedCount: item.applied_count,
          lastAppliedAt: item.last_applied_at ?? undefined,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        }),
      );

      return {
        success: true,
        data: {
          corrections,
          total: count || 0,
        },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "IntentCorrectionService: Get history failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取学习统计
   */
  async getLearningStats(): Promise<IntentCorrectionResponse<LearningStats>> {
    try {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(
        "get_user_learning_stats",
        {
          target_user_id: user.id,
        },
      );

      if (error) {
        logger.error({ error }, "IntentCorrectionService: Failed to get stats");
        return { success: false, error: "获取学习统计失败" };
      }

      const stats = data as {
        userId: string;
        totalCorrections: number;
        totalApplications: number;
        byIntent: Record<string, { corrections: number; applications: number }>;
        lastCorrectionAt: string | null;
      };

      return {
        success: true,
        data: {
          userId: stats.userId,
          totalCorrections: stats.totalCorrections,
          totalApplications: stats.totalApplications,
          byIntent: stats.byIntent || {},
          lastCorrectionAt: stats.lastCorrectionAt ?? undefined,
        },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "IntentCorrectionService: Get stats failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 增加纠正应用计数
   */
  async incrementAppliedCount(
    correctionId: string,
  ): Promise<IntentCorrectionResponse> {
    try {
      const supabase = await createClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc(
        "increment_correction_applied_count",
        { correction_id: correctionId },
      );

      if (error) {
        logger.error(
          { error },
          "IntentCorrectionService: Failed to increment count",
        );
        return { success: false, error: "更新应用计数失败" };
      }

      return { success: true };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "IntentCorrectionService: Increment count failed",
      );
      return { success: false, error: "系统错误" };
    }
  }
}

// =============================================================================
// 工厂函数和默认实例
// =============================================================================

/**
 * 创建意图纠正服务实例
 */
export function createIntentCorrectionService(): IntentCorrectionService {
  return new IntentCorrectionService();
}

/**
 * 默认意图纠正服务实例
 */
export const intentCorrectionService = new IntentCorrectionService();
