/**
 * 跨会话记忆服务
 *
 * 负责管理用户的跨会话记忆，包括：
 * - 上次会话摘要的生成和存储
 * - 当前关注点的更新
 * - 意图历史的记录和查询
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import { logger } from "@/lib/logger";
import type {
  PreviousSessionSummary,
  CurrentFocus,
  CrossSessionMemory,
  IntentStats,
  CrossSessionMemoryConfig,
  ConversationState,
} from "./types";
import { DEFAULT_CROSS_SESSION_CONFIG } from "./types";

// ============================================
// 服务类
// ============================================

/**
 * 跨会话记忆服务
 *
 * @example
 * ```typescript
 * const service = new CrossSessionMemoryService();
 * const memory = await service.getCrossSessionMemory(userId, conversationId);
 * console.log(memory.previousSessionSummary);
 * ```
 */
export class CrossSessionMemoryService {
  private config: Required<CrossSessionMemoryConfig>;
  private supabase: SupabaseClient<Database>;

  constructor(config?: Partial<CrossSessionMemoryConfig>) {
    this.config = { ...DEFAULT_CROSS_SESSION_CONFIG, ...config };
    this.supabase = createClient();
  }

  // ============================================
  // 跨会话记忆方法
  // ============================================

  /**
   * 获取跨会话记忆
   *
   * @param userId - 用户 ID
   * @param currentConversationId - 当前会话 ID（排除在查询之外）
   * @returns 跨会话记忆数据
   */
  async getCrossSessionMemory(
    userId: string,
    currentConversationId?: string,
  ): Promise<CrossSessionMemory> {
    try {
      const { data, error } = await this.supabase.rpc(
        "get_last_session_summary",
        {
          p_user_id: userId,
          p_exclude_conversation_id: currentConversationId ?? undefined,
        },
      );

      if (error) {
        logger.warn(
          { userId, error: error.message },
          "Failed to get last session summary",
        );
        return {};
      }

      if (!data || data.length === 0) {
        return {};
      }

      const row = data[0];
      return {
        previousSessionSummary:
          row.previous_session_summary as unknown as PreviousSessionSummary,
        currentFocus: row.current_focus as unknown as CurrentFocus,
      };
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error getting cross-session memory",
      );
      return {};
    }
  }

  /**
   * 保存会话摘要（用于下次会话的跨会话记忆）
   *
   * @param userId - 用户 ID
   * @param conversationId - 会话 ID
   * @param state - 会话状态
   * @returns 是否保存成功
   */
  async saveSessionSummary(
    userId: string,
    conversationId: string,
    state: ConversationState,
  ): Promise<boolean> {
    try {
      const summary = this.generateSessionSummary(state);

      const { error } = await this.supabase.rpc("update_session_cross_memory", {
        p_user_id: userId,
        p_conversation_id: conversationId,
        p_previous_summary: summary as unknown as Json,
        p_current_focus: null,
      });

      if (error) {
        logger.error(
          { userId, conversationId, error: error.message },
          "Failed to save session summary",
        );
        return false;
      }

      logger.info(
        { userId, conversationId, messageCount: state.messages.length },
        "Session summary saved",
      );

      return true;
    } catch (error) {
      logger.error(
        {
          userId,
          conversationId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error saving session summary",
      );
      return false;
    }
  }

  /**
   * 更新当前关注点
   *
   * @param userId - 用户 ID
   * @param conversationId - 会话 ID
   * @param focus - 当前关注点
   * @returns 是否更新成功
   */
  async updateCurrentFocus(
    userId: string,
    conversationId: string,
    focus: CurrentFocus,
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc("update_session_cross_memory", {
        p_user_id: userId,
        p_conversation_id: conversationId,
        p_previous_summary: null,
        p_current_focus: focus as unknown as Json,
      });

      if (error) {
        logger.error(
          { userId, conversationId, error: error.message },
          "Failed to update current focus",
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error(
        {
          userId,
          conversationId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error updating current focus",
      );
      return false;
    }
  }

  /**
   * 从会话状态生成摘要
   */
  private generateSessionSummary(
    state: ConversationState,
  ): PreviousSessionSummary {
    // 提取主题（基于意图类型和提及的标签）
    const topics = new Set<string>();

    for (const message of state.messages) {
      if (message.intentType) {
        topics.add(message.intentType);
      }
      if (message.subType) {
        topics.add(message.subType);
      }
    }

    for (const tag of state.mentionedTags) {
      topics.add(tag.name);
    }

    // 提取关键实体
    const bookmarkIds = state.mentionedBookmarks
      .map((b) =>
        typeof b.id === "number" ? b.id : parseInt(b.id as string, 10),
      )
      .filter((id) => !isNaN(id))
      .slice(0, this.config.maxEntities);

    const tagNames = state.mentionedTags
      .map((t) => t.name)
      .slice(0, this.config.maxEntities);

    const folderIds = state.mentionedFolders
      .map((f) =>
        typeof f.id === "number" ? f.id : parseInt(f.id as string, 10),
      )
      .filter((id) => !isNaN(id))
      .slice(0, this.config.maxEntities);

    // 生成简单摘要（Phase 1 不使用 LLM）
    const summary = this.generateSimpleSummary(state);

    return {
      conversationId: state.conversationId,
      summary,
      mainTopics: Array.from(topics).slice(0, this.config.maxTopics),
      keyEntities: {
        bookmarkIds,
        tagNames,
        folderIds,
      },
      endedAt: new Date().toISOString(),
      messageCount: state.messages.length,
    };
  }

  /**
   * 生成简单摘要（不使用 LLM）
   */
  private generateSimpleSummary(state: ConversationState): string {
    const _messageCount = state.messages.length;
    const userMessages = state.messages.filter((m) => m.role === "user");

    if (userMessages.length === 0) {
      return "空会话";
    }

    // 取最后一条用户消息作为摘要基础
    const lastUserMessage = userMessages[userMessages.length - 1];
    let summary = lastUserMessage.content;

    // 截断到最大长度
    if (summary.length > this.config.maxSummaryLength) {
      summary = summary.slice(0, this.config.maxSummaryLength - 3) + "...";
    }

    // 添加统计信息
    const mentionedCount =
      state.mentionedBookmarks.length +
      state.mentionedTags.length +
      state.mentionedFolders.length;

    if (mentionedCount > 0) {
      summary += ` (涉及 ${mentionedCount} 个实体)`;
    }

    return summary;
  }

  // ============================================
  // 意图历史方法
  // ============================================

  /**
   * 记录意图历史
   *
   * @param userId - 用户 ID
   * @param intentType - 意图类型
   * @param options - 可选参数
   * @returns 记录 ID
   */
  async recordIntent(
    userId: string,
    intentType: string,
    options?: {
      subType?: string;
      confidence?: number;
      success?: boolean;
      messagePreview?: string;
      context?: Record<string, unknown>;
    },
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.rpc("record_intent_history", {
        p_user_id: userId,
        p_intent_type: intentType,
        p_intent_sub_type: options?.subType ?? undefined,
        p_confidence: options?.confidence ?? undefined,
        p_success: options?.success ?? true,
        p_message_preview: options?.messagePreview ?? undefined,
        p_context: (options?.context || {}) as unknown as Json,
      });

      if (error) {
        logger.error(
          { userId, intentType, error: error.message },
          "Failed to record intent history",
        );
        return null;
      }

      return data as string;
    } catch (error) {
      logger.error(
        {
          userId,
          intentType,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error recording intent history",
      );
      return null;
    }
  }

  /**
   * 获取意图统计
   *
   * @param userId - 用户 ID
   * @param days - 统计天数，默认 30
   * @returns 意图统计列表
   */
  async getIntentStats(userId: string, days = 30): Promise<IntentStats[]> {
    try {
      const { data, error } = await this.supabase.rpc("get_intent_stats", {
        p_user_id: userId,
        p_days: days,
      });

      if (error) {
        logger.error(
          { userId, error: error.message },
          "Failed to get intent stats",
        );
        return [];
      }

      if (!data) {
        return [];
      }

      return (
        data as Array<{
          intent_type: string;
          intent_sub_type: string | null;
          count: number;
          success_count: number;
          avg_confidence: number | null;
        }>
      ).map((row) => ({
        intentType: row.intent_type,
        intentSubType: row.intent_sub_type || undefined,
        count: Number(row.count),
        successCount: Number(row.success_count),
        avgConfidence: row.avg_confidence || undefined,
      }));
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error getting intent stats",
      );
      return [];
    }
  }

  /**
   * 获取最常用的意图类型
   *
   * @param userId - 用户 ID
   * @param limit - 返回数量限制，默认 5
   * @returns 常用意图列表
   */
  async getTopIntents(userId: string, limit = 5): Promise<IntentStats[]> {
    const stats = await this.getIntentStats(userId);
    return stats.slice(0, limit);
  }

  // ============================================
  // 当前关注点推断
  // ============================================

  /**
   * 从会话状态推断当前关注点
   *
   * @param state - 会话状态
   * @returns 推断的当前关注点
   */
  inferCurrentFocus(state: ConversationState): CurrentFocus {
    const topics = new Set<string>();
    let taskType: string | undefined;
    const focusedEntityIds: number[] = [];

    // 从最近的消息中提取关注点
    const recentMessages = state.messages.slice(-5);

    for (const message of recentMessages) {
      if (message.intentType) {
        taskType = message.intentType;
      }
      if (message.subType) {
        topics.add(message.subType);
      }
    }

    // 从提及的实体中提取
    for (const bookmark of state.mentionedBookmarks.slice(-5)) {
      if (typeof bookmark.id === "number") {
        focusedEntityIds.push(bookmark.id);
      }
    }

    for (const tag of state.mentionedTags.slice(-3)) {
      topics.add(tag.name);
    }

    // 确定主要主题
    const topicArray = Array.from(topics);
    const primaryTopic = topicArray[0];
    const secondaryTopics = topicArray.slice(1, this.config.maxTopics);

    return {
      primaryTopic,
      secondaryTopics,
      taskType,
      focusedEntityIds,
      updatedAt: new Date().toISOString(),
    };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 CrossSessionMemoryService 实例
 */
export function createCrossSessionMemoryService(
  config?: Partial<CrossSessionMemoryConfig>,
): CrossSessionMemoryService {
  return new CrossSessionMemoryService(config);
}

export default CrossSessionMemoryService;
