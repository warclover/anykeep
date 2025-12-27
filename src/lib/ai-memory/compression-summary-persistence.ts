/**
 * 压缩摘要持久化服务
 *
 * 职责：
 * - 保存压缩摘要到会话状态
 * - 加载会话的压缩摘要
 * - 与现有 MemoryPersistence 集成
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { CompressionSummaryState } from "./types";
import type { FallbackLevel } from "@/lib/ai-agent/context";
import type { Json } from "@/types/supabase";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 保存压缩摘要参数
 */
export interface SaveCompressionSummaryParams {
  userId: string;
  conversationId: string;
  summary: string;
  originalMessageCount: number;
  retainedMessageCount: number;
  compressionRatio: number;
  fallbackLevel?: FallbackLevel;
}

/**
 * 压缩摘要持久化结果
 */
export interface CompressionPersistenceResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// CompressionSummaryPersistence 类
// =============================================================================

/**
 * 压缩摘要持久化服务
 *
 * 使用 ai_session_memory 表的 state JSONB 字段存储压缩摘要
 */
export class CompressionSummaryPersistence {
  /**
   * 保存压缩摘要
   *
   * 更新现有会话状态中的 compressionSummary 字段
   */
  async saveCompressionSummary(
    params: SaveCompressionSummaryParams,
  ): Promise<CompressionPersistenceResult> {
    const {
      userId,
      conversationId,
      summary,
      originalMessageCount,
      retainedMessageCount,
      compressionRatio,
      fallbackLevel,
    } = params;

    try {
      const supabase = createClient();

      // 构建压缩摘要状态
      const compressionSummaryState: CompressionSummaryState = {
        summary,
        compressedAt: Date.now(),
        originalMessageCount,
        retainedMessageCount,
        compressionRatio,
        fallbackLevel,
      };

      // 使用 RPC 函数更新会话状态的 compressionSummary 字段
      // 注意：需要先获取现有状态，合并后再保存
      const { data: existingRecord, error: fetchError } = await supabase
        .from("ai_session_memory")
        .select("state")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 = no rows found
        throw new Error(`Failed to fetch session: ${fetchError.message}`);
      }

      // 合并状态
      const existingState =
        (existingRecord?.state as Record<string, unknown>) || {};
      const updatedState = {
        ...existingState,
        compressionSummary: compressionSummaryState,
      };

      // 保存更新后的状态
      const { error: saveError } = await supabase.rpc("save_session_state", {
        p_user_id: userId,
        p_conversation_id: conversationId,
        p_state: updatedState as unknown as Json,
        p_message_count: retainedMessageCount,
        p_last_intent: null,
      });

      if (saveError) {
        throw new Error(
          `Failed to save compression summary: ${saveError.message}`,
        );
      }

      logger.info(
        {
          userId,
          conversationId,
          originalMessageCount,
          retainedMessageCount,
          compressionRatio,
          fallbackLevel,
        },
        "CompressionSummaryPersistence: Saved compression summary",
      );

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          userId,
          conversationId,
          error: errorMessage,
        },
        "CompressionSummaryPersistence: Failed to save compression summary",
      );

      return { success: false, error: errorMessage };
    }
  }

  /**
   * 加载压缩摘要
   *
   * 从会话状态中获取 compressionSummary 字段
   */
  async loadCompressionSummary(
    userId: string,
    conversationId: string,
  ): Promise<CompressionSummaryState | null> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("ai_session_memory")
        .select("state")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows found
          return null;
        }
        throw new Error(`Failed to load session: ${error.message}`);
      }

      const state = data?.state as Record<string, unknown> | null;
      const compressionSummary = state?.compressionSummary as
        | CompressionSummaryState
        | undefined;

      if (compressionSummary) {
        logger.debug(
          {
            userId,
            conversationId,
            compressedAt: compressionSummary.compressedAt,
          },
          "CompressionSummaryPersistence: Loaded compression summary",
        );
      }

      return compressionSummary || null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          userId,
          conversationId,
          error: errorMessage,
        },
        "CompressionSummaryPersistence: Failed to load compression summary",
      );

      return null;
    }
  }

  /**
   * 清除压缩摘要
   *
   * 从会话状态中移除 compressionSummary 字段（例如开始新对话时）
   */
  async clearCompressionSummary(
    userId: string,
    conversationId: string,
  ): Promise<CompressionPersistenceResult> {
    try {
      const supabase = createClient();

      // 获取现有状态
      const { data, error: fetchError } = await supabase
        .from("ai_session_memory")
        .select("state, message_count, last_intent")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          // No rows found, nothing to clear
          return { success: true };
        }
        throw new Error(`Failed to fetch session: ${fetchError.message}`);
      }

      // 移除 compressionSummary
      const existingState = (data?.state as Record<string, unknown>) || {};

      const { compressionSummary: _, ...updatedState } = existingState;

      // 保存更新后的状态
      const { error: saveError } = await supabase.rpc("save_session_state", {
        p_user_id: userId,
        p_conversation_id: conversationId,
        p_state: updatedState as unknown as Json,
        p_message_count: data?.message_count || 0,
        p_last_intent: data?.last_intent || null,
      });

      if (saveError) {
        throw new Error(
          `Failed to clear compression summary: ${saveError.message}`,
        );
      }

      logger.info(
        {
          userId,
          conversationId,
        },
        "CompressionSummaryPersistence: Cleared compression summary",
      );

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          userId,
          conversationId,
          error: errorMessage,
        },
        "CompressionSummaryPersistence: Failed to clear compression summary",
      );

      return { success: false, error: errorMessage };
    }
  }
}

// =============================================================================
// 导出
// =============================================================================

/**
 * 默认实例
 */
export const compressionSummaryPersistence =
  new CompressionSummaryPersistence();

/**
 * 工厂函数
 */
export function createCompressionSummaryPersistence(): CompressionSummaryPersistence {
  return new CompressionSummaryPersistence();
}
