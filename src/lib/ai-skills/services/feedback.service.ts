/**
 * FeedbackService - AI 反馈服务
 *
 * 职责：
 * - 保存用户对 AI 回答的反馈（👍/👎）
 * - 收集负反馈的详细原因
 * - 提供反馈统计数据（用于自我进化）
 *
 * @version 1.0.0
 * @since 2025-12-25
 *
 * 注意：ai_feedback 表类型尚未生成，使用类型断言绕过检查
 * 运行 `npm run supabase:gen:types` 后可移除类型断言
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  FeedbackRequest,
  FeedbackReason,
} from "@/components/ai/phase4/types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * ai_feedback 表行类型（待生成后可删除）
 */
interface AIFeedbackRow {
  id: string;
  user_id: string;
  conversation_id: string;
  message_id: string;
  type: "positive" | "negative";
  negative_reason: string | null;
  negative_comment: string | null;
  original_message: string | null;
  classified_intent: string | null;
  tool_used: string | null;
  execution_mode: string | null;
  skill_id: string | null;
  created_at: string;
}

/**
 * 反馈记录
 */
export interface FeedbackRecord {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  type: "positive" | "negative";
  negativeReason?: FeedbackReason;
  negativeComment?: string;
  originalMessage: string;
  classifiedIntent: string;
  toolUsed: string;
  executionMode?: "atomic" | "orchestration";
  skillId?: string;
  createdAt: string;
}

/**
 * 反馈统计
 */
export interface FeedbackStats {
  totalCount: number;
  positiveCount: number;
  negativeCount: number;
  satisfactionRate: number;
}

/**
 * 负反馈原因分布
 */
export interface NegativeReasonStats {
  reason: FeedbackReason;
  count: number;
  percentage: number;
}

/**
 * 服务响应
 */
export interface FeedbackServiceResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// FeedbackService 类
// =============================================================================

export class FeedbackService {
  /**
   * 提交反馈
   */
  async submitFeedback(
    request: FeedbackRequest,
  ): Promise<FeedbackServiceResponse<{ id: string }>> {
    try {
      const supabase = await createClient();

      // 获取当前用户
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        logger.warn({ authError }, "FeedbackService: User not authenticated");
        return { success: false, error: "用户未登录" };
      }

      // 插入反馈记录
      // 使用类型断言绕过未生成的表类型检查
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
        .from("ai_feedback")
        .insert({
          user_id: user.id,
          conversation_id: request.conversationId,
          message_id: request.messageId,
          type: request.type,
          negative_reason: request.negativeReason || null,
          negative_comment: request.comment || null,
          original_message: request.context?.originalMessage ?? null,
          classified_intent: request.context?.classifiedIntent ?? null,
          tool_used: request.context?.toolUsed ?? null,
          execution_mode: request.context?.executionMode ?? null,
          skill_id: request.context?.skillId ?? null,
        })
        .select("id")
        .single();

      if (error) {
        // 检查是否是重复反馈
        if (error.code === "23505") {
          logger.info(
            { messageId: request.messageId },
            "FeedbackService: Feedback already exists, updating",
          );
          return this.updateFeedback(request);
        }

        logger.error({ error }, "FeedbackService: Failed to submit feedback");
        return { success: false, error: "保存反馈失败" };
      }

      logger.info(
        {
          feedbackId: data?.id,
          type: request.type,
          messageId: request.messageId,
        },
        "FeedbackService: Feedback submitted",
      );

      return { success: true, data: { id: String(data?.id ?? "") } };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "FeedbackService: Unexpected error",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 更新已存在的反馈
   */
  private async updateFeedback(
    request: FeedbackRequest,
  ): Promise<FeedbackServiceResponse<{ id: string }>> {
    try {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      // 使用类型断言
      const { data, error } = await (
        supabase as unknown as {
          from: (table: string) => {
            update: (row: Record<string, unknown>) => {
              eq: (
                col: string,
                val: string,
              ) => {
                eq: (
                  col: string,
                  val: string,
                ) => {
                  select: (cols: string) => {
                    single: () => Promise<{
                      data: { id: string } | null;
                      error: { message: string } | null;
                    }>;
                  };
                };
              };
            };
          };
        }
      )
        .from("ai_feedback")
        .update({
          type: request.type,
          negative_reason: request.negativeReason || null,
          negative_comment: request.comment || null,
        })
        .eq("user_id", user.id)
        .eq("message_id", request.messageId)
        .select("id")
        .single();

      if (error) {
        logger.error({ error }, "FeedbackService: Failed to update feedback");
        return { success: false, error: "更新反馈失败" };
      }

      logger.info(
        { feedbackId: data?.id, type: request.type },
        "FeedbackService: Feedback updated",
      );

      return { success: true, data: { id: String(data?.id ?? "") } };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "FeedbackService: Update failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取消息的反馈状态
   */
  async getFeedbackStatus(
    messageId: string,
  ): Promise<
    FeedbackServiceResponse<{ type: "positive" | "negative" } | null>
  > {
    try {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      // 使用类型断言
      const { data, error } = await (
        supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              eq: (
                col: string,
                val: string,
              ) => {
                eq: (
                  col: string,
                  val: string,
                ) => {
                  maybeSingle: () => Promise<{
                    data: { type: string } | null;
                    error: { message: string } | null;
                  }>;
                };
              };
            };
          };
        }
      )
        .from("ai_feedback")
        .select("type")
        .eq("user_id", user.id)
        .eq("message_id", messageId)
        .maybeSingle();

      if (error) {
        logger.error(
          { error },
          "FeedbackService: Failed to get feedback status",
        );
        return { success: false, error: "获取反馈状态失败" };
      }

      return {
        success: true,
        data: data ? { type: data.type as "positive" | "negative" } : null,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "FeedbackService: Get status failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取用户反馈统计
   *
   * 注意：需要创建 get_ai_feedback_stats RPC 函数
   */
  async getStats(): Promise<FeedbackServiceResponse<FeedbackStats>> {
    try {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      // 使用类型断言
      const { data, error } = await (
        supabase as unknown as {
          rpc: (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{
            data: Array<{
              total_count: number;
              positive_count: number;
              negative_count: number;
              satisfaction_rate: number;
            }> | null;
            error: { message: string } | null;
          }>;
        }
      ).rpc("get_ai_feedback_stats", {
        p_user_id: user.id,
      });

      if (error) {
        logger.error({ error }, "FeedbackService: Failed to get stats");
        return { success: false, error: "获取统计失败" };
      }

      const stats = data?.[0] ?? {
        total_count: 0,
        positive_count: 0,
        negative_count: 0,
        satisfaction_rate: 0,
      };

      return {
        success: true,
        data: {
          totalCount: stats.total_count,
          positiveCount: stats.positive_count,
          negativeCount: stats.negative_count,
          satisfactionRate: stats.satisfaction_rate,
        },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "FeedbackService: Get stats failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取负反馈原因分布（用于改进）
   *
   * 注意：需要创建 get_negative_feedback_reasons RPC 函数
   */
  async getNegativeReasonStats(
    limit = 100,
  ): Promise<FeedbackServiceResponse<NegativeReasonStats[]>> {
    try {
      const supabase = await createClient();

      // 使用类型断言
      const { data, error } = await (
        supabase as unknown as {
          rpc: (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{
            data: Array<{
              reason: string;
              count: number;
              percentage: number;
            }> | null;
            error: { message: string } | null;
          }>;
        }
      ).rpc("get_negative_feedback_reasons", {
        p_limit: limit,
      });

      if (error) {
        logger.error(
          { error },
          "FeedbackService: Failed to get negative reason stats",
        );
        return { success: false, error: "获取统计失败" };
      }

      const stats: NegativeReasonStats[] = (data ?? []).map((item) => ({
        reason: item.reason as FeedbackReason,
        count: item.count,
        percentage: item.percentage,
      }));

      return { success: true, data: stats };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "FeedbackService: Get negative stats failed",
      );
      return { success: false, error: "系统错误" };
    }
  }

  /**
   * 获取用户最近的反馈记录
   */
  async getRecentFeedback(
    limit = 20,
  ): Promise<FeedbackServiceResponse<FeedbackRecord[]>> {
    try {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "用户未登录" };
      }

      // 使用类型断言
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
                    data: AIFeedbackRow[] | null;
                    error: { message: string } | null;
                  }>;
                };
              };
            };
          };
        }
      )
        .from("ai_feedback")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        logger.error(
          { error },
          "FeedbackService: Failed to get recent feedback",
        );
        return { success: false, error: "获取反馈记录失败" };
      }

      const records: FeedbackRecord[] = (data ?? []).map((item) => ({
        id: String(item.id),
        userId: item.user_id,
        conversationId: item.conversation_id,
        messageId: item.message_id,
        type: item.type,
        negativeReason: item.negative_reason as FeedbackReason | undefined,
        negativeComment: item.negative_comment ?? undefined,
        originalMessage: item.original_message ?? "",
        classifiedIntent: item.classified_intent ?? "",
        toolUsed: item.tool_used ?? "",
        executionMode: item.execution_mode as
          | "atomic"
          | "orchestration"
          | undefined,
        skillId: item.skill_id ?? undefined,
        createdAt: item.created_at,
      }));

      return { success: true, data: records };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "FeedbackService: Get recent failed",
      );
      return { success: false, error: "系统错误" };
    }
  }
}

// =============================================================================
// 工厂函数和默认实例
// =============================================================================

/**
 * 创建反馈服务实例
 */
export function createFeedbackService(): FeedbackService {
  return new FeedbackService();
}

/**
 * 默认反馈服务实例
 */
export const feedbackService = new FeedbackService();
