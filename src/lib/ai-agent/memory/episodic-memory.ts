/**
 * 情景记忆服务
 *
 * 管理跨会话的对话摘要存储和检索
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type {
  ConversationSummary,
  ConversationAction,
  ConversationSentiment,
  EpisodicMemoryContext,
  EpisodicMemoryConfig,
  RecentSummary,
  UserPreferencesAnalysis,
  DbConversationSummary,
  DbUserPreferences,
} from "./types";

// =============================================================================
// 默认配置
// =============================================================================

const DEFAULT_CONFIG: Required<EpisodicMemoryConfig> = {
  maxSummaries: 3,
  tokenBudget: 300,
  pendingIntentDays: 7,
};

// =============================================================================
// 情景记忆服务
// =============================================================================

/**
 * 情景记忆服务
 *
 * 负责：
 * - 获取最近的会话摘要
 * - 保存新的会话摘要
 * - 管理未完成的意图
 * - 分析用户偏好
 */
export class EpisodicMemoryService {
  private config: Required<EpisodicMemoryConfig>;
  private log = logger.child({ module: "EpisodicMemoryService" });

  constructor(config?: EpisodicMemoryConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // 公开方法
  // ===========================================================================

  /**
   * 获取情景记忆上下文（用于注入 Prompt）
   */
  async getMemoryContext(userId: string): Promise<EpisodicMemoryContext> {
    this.log.debug({ userId }, "Fetching episodic memory context");

    try {
      const [summaries, pendingIntents, preferences] = await Promise.all([
        this.getRecentSummaries(userId),
        this.getPendingIntents(userId),
        this.getUserPreferences(userId),
      ]);

      // 将摘要转换为简化格式
      const recentSummaries: RecentSummary[] = summaries.map((s) => ({
        summary: this.truncateSummary(s.summary),
        intents: s.intents.slice(0, 3), // 最多 3 个意图
        timeAgo: formatDistanceToNow(s.createdAt, {
          addSuffix: true,
          locale: zhCN,
        }),
      }));

      const context: EpisodicMemoryContext = {
        recentSummaries,
        pendingIntents,
        preferences,
      };

      this.log.debug(
        {
          userId,
          summaryCount: recentSummaries.length,
          pendingCount: pendingIntents.length,
          hasPreferences: !!preferences,
        },
        "Episodic memory context built",
      );

      return context;
    } catch (error) {
      this.log.error({ error, userId }, "Failed to get memory context");
      // 返回空的上下文，不影响主流程
      return {
        recentSummaries: [],
        pendingIntents: [],
        preferences: null,
      };
    }
  }

  /**
   * 获取最近的会话摘要
   */
  async getRecentSummaries(
    userId: string,
    limit?: number,
  ): Promise<ConversationSummary[]> {
    const supabase = await createClient();
    const maxLimit = limit ?? this.config.maxSummaries;

    // 注意：Supabase 类型尚未包含新函数，使用类型断言绕过
    // 运行 `npm run supabase:gen:types` 后可移除断言
    const { data, error } = await (supabase.rpc as CallableFunction)(
      "get_recent_summaries",
      {
        p_user_id: userId,
        p_limit: maxLimit,
      },
    );

    if (error) {
      this.log.error({ error, userId }, "Failed to get recent summaries");
      return [];
    }

    return ((data as DbConversationSummary[]) || []).map(this.mapDbSummary);
  }

  /**
   * 获取未完成的意图
   */
  async getPendingIntents(userId: string): Promise<string[]> {
    const supabase = await createClient();

    // 注意：Supabase 类型尚未包含新函数，使用类型断言绕过
    const { data, error } = await (supabase.rpc as CallableFunction)(
      "get_pending_intents",
      {
        p_user_id: userId,
      },
    );

    if (error) {
      this.log.error({ error, userId }, "Failed to get pending intents");
      return [];
    }

    return (data as string[]) || [];
  }

  /**
   * 移除已完成的意图
   */
  async removePendingIntent(userId: string, intent: string): Promise<void> {
    const supabase = await createClient();

    // 注意：Supabase 类型尚未包含新函数，使用类型断言绕过
    const { error } = await (supabase.rpc as CallableFunction)(
      "remove_pending_intent",
      {
        p_user_id: userId,
        p_intent: intent,
      },
    );

    if (error) {
      this.log.error(
        { error, userId, intent },
        "Failed to remove pending intent",
      );
      throw error;
    }

    this.log.debug({ userId, intent }, "Pending intent removed");
  }

  /**
   * 获取用户偏好分析
   */
  async getUserPreferences(
    userId: string,
  ): Promise<UserPreferencesAnalysis | null> {
    const supabase = await createClient();

    // 注意：Supabase 类型尚未包含新函数，使用类型断言绕过
    const { data, error } = await (supabase.rpc as CallableFunction)(
      "analyze_user_preferences",
      {
        p_user_id: userId,
      },
    );

    if (error) {
      this.log.error({ error, userId }, "Failed to analyze user preferences");
      return null;
    }

    const prefs = data as DbUserPreferences;
    if (!prefs || prefs.totalInteractions === 0) {
      return null;
    }

    return {
      positiveRate: prefs.positiveRate,
      commonActions: prefs.commonActions,
      totalInteractions: prefs.totalInteractions,
      positiveCount: prefs.positiveCount,
      negativeCount: prefs.negativeCount,
    };
  }

  /**
   * 保存会话摘要
   */
  async saveSummary(
    userId: string,
    sessionId: string,
    data: {
      summary: string;
      intents: string[];
      actions: ConversationAction[];
      pendingIntents?: string[];
      messageCount: number;
      sentiment?: ConversationSentiment;
    },
  ): Promise<string> {
    const supabase = await createClient();

    // 注意：Supabase 类型尚未包含新表，使用类型断言绕过
    const { data: result, error } = await (supabase.from as CallableFunction)(
      "ai_conversation_summaries",
    )
      .insert({
        user_id: userId,
        session_id: sessionId,
        summary: data.summary,
        intents: data.intents,
        actions: data.actions,
        pending_intents: data.pendingIntents || [],
        message_count: data.messageCount,
        sentiment: data.sentiment || "neutral",
      })
      .select("id")
      .single();

    if (error) {
      this.log.error({ error, userId, sessionId }, "Failed to save summary");
      throw error;
    }

    const summaryId = (result as { id: string }).id;

    this.log.info(
      { userId, sessionId, summaryId },
      "Conversation summary saved",
    );

    return summaryId;
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 截断摘要以控制 Token 使用
   */
  private truncateSummary(summary: string): string {
    // 粗略估算：中文约 1.5 字符/token
    const maxChars = Math.floor(this.config.tokenBudget * 1.5);
    if (summary.length <= maxChars) {
      return summary;
    }
    return summary.slice(0, maxChars - 3) + "...";
  }

  /**
   * 将数据库记录映射为领域对象
   */
  private mapDbSummary(db: DbConversationSummary): ConversationSummary {
    return {
      id: db.id,
      sessionId: db.session_id,
      summary: db.summary,
      intents: db.intents || [],
      actions: (db.actions as ConversationAction[]) || [],
      pendingIntents: db.pending_intents || [],
      messageCount: db.message_count,
      sentiment: db.sentiment,
      createdAt: new Date(db.created_at),
    };
  }
}

// =============================================================================
// 单例导出
// =============================================================================

let _instance: EpisodicMemoryService | null = null;

/**
 * 获取情景记忆服务实例
 */
export function getEpisodicMemoryService(
  config?: EpisodicMemoryConfig,
): EpisodicMemoryService {
  if (!_instance) {
    _instance = new EpisodicMemoryService(config);
  }
  return _instance;
}

/**
 * 重置服务实例（用于测试）
 */
export function resetEpisodicMemoryService(): void {
  _instance = null;
}
