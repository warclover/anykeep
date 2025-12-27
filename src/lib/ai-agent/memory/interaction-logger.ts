/**
 * 交互日志记录器
 *
 * 异步记录用户与 AI 的交互行为，用于偏好学习
 * 使用批量缓冲模式减少数据库写入频率
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  InteractionLogEntry,
  UserFeedback,
  AiSuggestion,
  UserChoice,
  InteractionLoggerConfig,
  InteractionStats,
  DbInteractionStats,
} from "./types";

// =============================================================================
// 默认配置
// =============================================================================

const DEFAULT_CONFIG: Required<InteractionLoggerConfig> = {
  batchSize: 10,
  flushInterval: 5000,
  enabled: true,
};

// =============================================================================
// 交互日志记录器
// =============================================================================

/**
 * 交互日志记录器
 *
 * 功能：
 * - 批量缓冲模式，减少数据库写入
 * - 异步记录，不阻塞主流程
 * - 支持反馈更新
 */
export class InteractionLogger {
  private config: Required<InteractionLoggerConfig>;
  private buffer: InteractionLogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private log = logger.child({ module: "InteractionLogger" });

  constructor(config?: InteractionLoggerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 启动定时刷新
    if (this.config.enabled && this.config.flushInterval > 0) {
      this.startFlushTimer();
    }
  }

  // ===========================================================================
  // 公开方法 - 记录交互
  // ===========================================================================

  /**
   * 记录交互（异步，不阻塞）
   */
  async logInteraction(entry: InteractionLogEntry): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    this.log.debug(
      {
        userId: entry.userId,
        actionType: entry.actionType,
        actionTarget: entry.actionTarget,
      },
      "Logging interaction",
    );

    // 添加到缓冲区
    this.buffer.push({
      ...entry,
      createdAt: entry.createdAt || new Date(),
    });

    // 检查是否需要刷新
    if (this.buffer.length >= this.config.batchSize) {
      // 使用 setImmediate 避免阻塞
      setImmediate(() => this.flush());
    }
  }

  /**
   * 快捷方法：记录搜索交互
   */
  async logSearch(
    userId: string,
    sessionId: string,
    query: string,
    resultCount: number,
  ): Promise<void> {
    return this.logInteraction({
      userId,
      sessionId,
      actionType: "search",
      actionTarget: query,
      context: { resultCount },
    });
  }

  /**
   * 快捷方法：记录整理操作
   */
  async logOrganize(
    userId: string,
    sessionId: string,
    target: string,
    suggestion: AiSuggestion,
    feedback?: UserFeedback,
    choice?: UserChoice,
  ): Promise<void> {
    return this.logInteraction({
      userId,
      sessionId,
      actionType: "organize",
      actionTarget: target,
      aiSuggestion: suggestion,
      userFeedback: feedback,
      userChoice: choice,
    });
  }

  /**
   * 快捷方法：记录标签操作
   */
  async logTag(
    userId: string,
    sessionId: string,
    target: string,
    suggestedTags: string[],
    chosenTags?: string[],
    feedback?: UserFeedback,
  ): Promise<void> {
    return this.logInteraction({
      userId,
      sessionId,
      actionType: "tag",
      actionTarget: target,
      aiSuggestion: { suggestedTags },
      userChoice: chosenTags ? { chosenTags } : undefined,
      userFeedback: feedback,
    });
  }

  /**
   * 快捷方法：记录确认操作
   */
  async logConfirm(
    userId: string,
    sessionId: string,
    target: string,
  ): Promise<void> {
    return this.logInteraction({
      userId,
      sessionId,
      actionType: "confirm",
      actionTarget: target,
      userFeedback: "positive",
    });
  }

  /**
   * 快捷方法：记录取消操作
   */
  async logCancel(
    userId: string,
    sessionId: string,
    target: string,
  ): Promise<void> {
    return this.logInteraction({
      userId,
      sessionId,
      actionType: "cancel",
      actionTarget: target,
      userFeedback: "negative",
    });
  }

  /**
   * 快捷方法：记录撤销操作
   */
  async logUndo(
    userId: string,
    sessionId: string,
    target: string,
  ): Promise<void> {
    return this.logInteraction({
      userId,
      sessionId,
      actionType: "undo",
      actionTarget: target,
      userFeedback: "negative",
    });
  }

  // ===========================================================================
  // 公开方法 - 查询统计
  // ===========================================================================

  /**
   * 获取交互统计
   */
  async getStats(userId: string, days: number = 30): Promise<InteractionStats> {
    const supabase = await createClient();

    // 注意：Supabase 类型尚未包含新函数，使用类型断言绕过
    const { data, error } = await (supabase.rpc as CallableFunction)(
      "get_interaction_stats",
      {
        p_user_id: userId,
        p_days: days,
      },
    );

    if (error) {
      this.log.error({ error, userId }, "Failed to get interaction stats");
      return {
        totalInteractions: 0,
        byType: {},
        byFeedback: { positive: 0, negative: 0, modified: 0, none: 0 },
        periodDays: days,
      };
    }

    const stats = data as DbInteractionStats;
    return {
      totalInteractions: stats?.totalInteractions || 0,
      byType: stats?.byType || {},
      byFeedback: stats?.byFeedback || {
        positive: 0,
        negative: 0,
        modified: 0,
        none: 0,
      },
      periodDays: stats?.periodDays || days,
    };
  }

  // ===========================================================================
  // 缓冲区管理
  // ===========================================================================

  /**
   * 手动刷新缓冲区
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    this.log.debug({ count: entries.length }, "Flushing interaction buffer");

    try {
      const supabase = await createClient();

      // 转换为数据库格式
      const records = entries.map((e) => ({
        user_id: e.userId,
        session_id: e.sessionId,
        action_type: e.actionType,
        action_target: e.actionTarget,
        user_feedback: e.userFeedback,
        ai_suggestion: e.aiSuggestion,
        user_choice: e.userChoice,
        context: e.context,
      }));

      // 注意：Supabase 类型尚未包含新表，使用类型断言绕过
      const { error } = await (supabase.from as CallableFunction)(
        "ai_interaction_logs",
      ).insert(records);

      if (error) {
        this.log.error(
          { error, count: entries.length },
          "Failed to flush logs",
        );
        // 失败时将记录放回缓冲区（简单重试策略）
        this.buffer.unshift(...entries);
      } else {
        this.log.debug({ count: entries.length }, "Interactions flushed");
      }
    } catch (error) {
      this.log.error({ error }, "Exception during flush");
      // 失败时将记录放回缓冲区
      this.buffer.unshift(...entries);
    }
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        this.log.error({ error: err }, "Scheduled flush failed");
      });
    }, this.config.flushInterval);

    // 确保进程退出时刷新
    if (typeof process !== "undefined") {
      process.on("beforeExit", () => {
        this.stop();
      });
    }
  }

  /**
   * 停止定时刷新并刷新剩余数据
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * 获取当前缓冲区大小
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * 是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// =============================================================================
// 单例导出
// =============================================================================

let _instance: InteractionLogger | null = null;

/**
 * 获取交互日志记录器实例
 */
export function getInteractionLogger(
  config?: InteractionLoggerConfig,
): InteractionLogger {
  if (!_instance) {
    _instance = new InteractionLogger(config);
  }
  return _instance;
}

/**
 * 重置记录器实例（用于测试）
 */
export async function resetInteractionLogger(): Promise<void> {
  if (_instance) {
    await _instance.stop();
    _instance = null;
  }
}
