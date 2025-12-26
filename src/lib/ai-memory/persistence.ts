/**
 * MemoryPersistence - 会话记忆持久化服务
 *
 * 职责：
 * - 将会话状态保存到数据库
 * - 从数据库恢复会话状态
 * - 处理过期会话清理
 * - 支持服务重启后恢复上下文
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { ConversationState } from "./types";
import type { Json } from "@/types/supabase";

// =============================================================================
// 数据库类型定义（临时，待 Supabase 类型重新生成后移除）
// =============================================================================

/**
 * ai_session_memory 表行类型
 */
interface AiSessionMemoryRow {
  id: string;
  user_id: string;
  conversation_id: string;
  state: Json;
  message_count: number;
  last_intent: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/**
 * Supabase 表操作类型断言辅助
 */
type SupabaseTableClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => {
          gt: (
            column: string,
            value: string,
          ) => {
            single: () => Promise<{
              data: AiSessionMemoryRow | null;
              error: { code: string; message: string } | null;
            }>;
          };
        };
      };
    };
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
  };
};

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 数据库中的会话记忆记录
 */
export interface SessionMemoryRecord {
  id: string;
  user_id: string;
  conversation_id: string;
  state: ConversationState;
  message_count: number;
  last_intent: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/**
 * 保存状态参数
 */
export interface SaveStateParams {
  userId: string;
  conversationId: string;
  state: ConversationState;
  lastIntent?: string;
}

/**
 * 加载状态参数
 */
export interface LoadStateParams {
  userId: string;
  conversationId: string;
}

/**
 * 持久化服务响应
 */
export interface PersistenceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 活跃会话信息
 */
export interface ActiveSessionInfo {
  conversationId: string;
  messageCount: number;
  lastIntent: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresIn: string;
}

// =============================================================================
// MemoryPersistence 类
// =============================================================================

/**
 * 会话记忆持久化服务
 */
export class MemoryPersistence {
  private saveDebounceMap: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  private readonly debounceMs: number;

  constructor(debounceMs: number = 1000) {
    this.debounceMs = debounceMs;
  }

  /**
   * 保存会话状态到数据库
   *
   * 使用防抖避免频繁写入
   */
  async saveState(params: SaveStateParams): Promise<PersistenceResult> {
    const { userId, conversationId, state, lastIntent } = params;
    const key = `${userId}:${conversationId}`;

    // 清除之前的防抖定时器
    const existingTimer = this.saveDebounceMap.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置新的防抖定时器
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.saveDebounceMap.delete(key);

        try {
          const result = await this.saveStateImmediate({
            userId,
            conversationId,
            state,
            lastIntent,
          });
          resolve(result);
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "MemoryPersistence: Save state failed",
          );
          resolve({ success: false, error: "保存会话状态失败" });
        }
      }, this.debounceMs);

      this.saveDebounceMap.set(key, timer);
    });
  }

  /**
   * 立即保存会话状态（无防抖）
   */
  async saveStateImmediate(
    params: SaveStateParams,
  ): Promise<PersistenceResult> {
    const { userId, conversationId, state, lastIntent } = params;

    try {
      const supabase = createClient();

      // 使用 RPC 函数保存
      const { error } = await (
        supabase as unknown as {
          rpc: (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: boolean; error: { message: string } | null }>;
        }
      ).rpc("save_session_state", {
        p_user_id: userId,
        p_conversation_id: conversationId,
        p_state: state,
        p_message_count: state.messages?.length || 0,
        p_last_intent: lastIntent || null,
      });

      if (error) {
        logger.error(
          { error },
          "MemoryPersistence: RPC save_session_state failed",
        );
        return { success: false, error: error.message };
      }

      logger.debug(
        {
          conversationId,
          messageCount: state.messages?.length || 0,
        },
        "MemoryPersistence: State saved",
      );

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "MemoryPersistence: Exception saving state",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 从数据库加载会话状态
   */
  async loadState(
    params: LoadStateParams,
  ): Promise<PersistenceResult<ConversationState>> {
    const { userId, conversationId } = params;

    try {
      const supabase = createClient();

      const { data, error } = await (supabase as unknown as SupabaseTableClient)
        .from("ai_session_memory")
        .select("state")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error) {
        // PGRST116 = 未找到记录，不是错误
        if (error.code === "PGRST116") {
          return { success: true, data: undefined };
        }
        logger.error({ error }, "MemoryPersistence: Load state failed");
        return { success: false, error: error.message };
      }

      if (!data?.state) {
        return { success: true, data: undefined };
      }

      logger.debug(
        { conversationId },
        "MemoryPersistence: State loaded from database",
      );

      return {
        success: true,
        data: data.state as unknown as ConversationState,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "MemoryPersistence: Exception loading state",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 删除会话状态
   */
  async deleteState(params: LoadStateParams): Promise<PersistenceResult> {
    const { userId, conversationId } = params;

    try {
      const supabase = createClient();

      const { error } = await (supabase as unknown as SupabaseTableClient)
        .from("ai_session_memory")
        .delete()
        .eq("user_id", userId)
        .eq("conversation_id", conversationId);

      if (error) {
        logger.error({ error }, "MemoryPersistence: Delete state failed");
        return { success: false, error: error.message };
      }

      // 清除防抖定时器
      const key = `${userId}:${conversationId}`;
      const timer = this.saveDebounceMap.get(key);
      if (timer) {
        clearTimeout(timer);
        this.saveDebounceMap.delete(key);
      }

      logger.debug({ conversationId }, "MemoryPersistence: State deleted");

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "MemoryPersistence: Exception deleting state",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 获取用户的活跃会话列表
   */
  async getActiveSessions(
    userId: string,
  ): Promise<PersistenceResult<ActiveSessionInfo[]>> {
    try {
      const supabase = createClient();

      const { data, error } = await (
        supabase as unknown as {
          rpc: (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{
            data: Array<{
              conversation_id: string;
              message_count: number;
              last_intent: string | null;
              created_at: string;
              updated_at: string;
              expires_in: string;
            }>;
            error: { message: string } | null;
          }>;
        }
      ).rpc("get_user_active_sessions", {
        p_user_id: userId,
      });

      if (error) {
        logger.error(
          { error },
          "MemoryPersistence: Get active sessions failed",
        );
        return { success: false, error: error.message };
      }

      const sessions: ActiveSessionInfo[] = (data || []).map((row) => ({
        conversationId: row.conversation_id,
        messageCount: row.message_count,
        lastIntent: row.last_intent,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        expiresIn: row.expires_in,
      }));

      return { success: true, data: sessions };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "MemoryPersistence: Exception getting sessions",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 清理过期会话
   */
  async cleanupExpired(): Promise<PersistenceResult<{ deletedCount: number }>> {
    try {
      const supabase = createClient();

      const { data, error } = await (
        supabase as unknown as {
          rpc: (
            fn: string,
          ) => Promise<{ data: number; error: { message: string } | null }>;
        }
      ).rpc("cleanup_expired_session_memory");

      if (error) {
        logger.error({ error }, "MemoryPersistence: Cleanup failed");
        return { success: false, error: error.message };
      }

      const deletedCount = data || 0;

      if (deletedCount > 0) {
        logger.info(
          { deletedCount },
          "MemoryPersistence: Cleaned up expired sessions",
        );
      }

      return { success: true, data: { deletedCount } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "MemoryPersistence: Exception during cleanup",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 清除所有防抖定时器
   */
  clearPendingSaves(): void {
    for (const timer of this.saveDebounceMap.values()) {
      clearTimeout(timer);
    }
    this.saveDebounceMap.clear();
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.clearPendingSaves();
  }
}

// =============================================================================
// 工厂函数和默认实例
// =============================================================================

/**
 * 创建持久化服务实例
 */
export function createMemoryPersistence(
  debounceMs?: number,
): MemoryPersistence {
  return new MemoryPersistence(debounceMs);
}

/**
 * 默认持久化服务实例
 */
export const memoryPersistence = new MemoryPersistence();
