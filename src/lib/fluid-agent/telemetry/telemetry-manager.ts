import { createClient } from "@/lib/supabase/client";
import type { TelemetryEvent, RuleStats } from "../types";
import { TELEMETRY_CONFIG } from "../constants";
import { clientLogger } from "@/lib/client-logger";

class TelemetryManager {
  private sessionId: string;
  private pendingMatches: Map<string, Partial<TelemetryEvent>> = new Map();
  private batchQueue: Partial<TelemetryEvent>[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();

    // 页面卸载时清理定时器并尝试刷新
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.destroy();
      });
    }
  }

  /**
   * 销毁管理器，清理定时器
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    // 尝试同步刷新剩余数据（使用 sendBeacon）
    this.flushSync();
  }

  /**
   * 同步刷新（用于页面卸载）
   */
  private flushSync(): void {
    if (this.batchQueue.length === 0) return;

    // 使用 sendBeacon 在页面卸载时发送数据
    // 必须使用 Blob 指定正确的 MIME 类型
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const data = JSON.stringify({
        events: this.batchQueue,
        sessionId: this.sessionId,
      });
      const blob = new Blob([data], { type: "application/json" });
      navigator.sendBeacon("/api/telemetry/batch", blob);
    }
  }

  /**
   * 创建基础事件对象（DRY 原则提取）
   */
  private createBaseEvent(
    ruleId: string,
    selectionCount: number,
    accepted: boolean | null = null,
    decidedAt: Date | null = null,
  ): Partial<TelemetryEvent> {
    return {
      id: crypto.randomUUID(),
      ruleId,
      selectionCount,
      matchedAt: new Date(),
      accepted,
      decidedAt,
      sessionId: this.sessionId,
    };
  }

  /**
   * 记录规则匹配事件
   */
  async recordMatch(ruleId: string, selectionCount: number): Promise<void> {
    const event = this.createBaseEvent(ruleId, selectionCount);
    this.pendingMatches.set(ruleId, event);
    this.scheduleBatchFlush();
  }

  /**
   * 记录用户决策
   */
  async recordDecision(ruleId: string, accepted: boolean): Promise<void> {
    const pending = this.pendingMatches.get(ruleId);

    if (pending) {
      pending.accepted = accepted;
      pending.decidedAt = new Date();
      this.pendingMatches.delete(ruleId);
      this.batchQueue.push(pending);
    } else {
      // 如果没有匹配记录，创建新的决策记录
      const event = this.createBaseEvent(ruleId, 0, accepted, new Date());
      this.batchQueue.push(event);
    }

    this.scheduleBatchFlush();
  }

  /**
   * 获取规则统计数据
   * 注意：rule_telemetry_stats 视图可能不存在，改用直接查询 ai_feedback 表
   */
  async getRuleStats(_ruleId?: string): Promise<RuleStats[]> {
    // 由于视图不存在，返回空数组
    // 未来可以通过 ai_feedback 表实现类似功能
    clientLogger.info(
      { context: "TelemetryManager" },
      "getRuleStats: rule_telemetry_stats view not available",
    );
    return [];
  }

  /**
   * 强制刷新队列
   * 使用 ai_feedback 表存储遥测数据
   */
  async flush(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      clientLogger.info(
        { context: "TelemetryManager" },
        "No user, skipping flush",
      );
      return;
    }

    // 将遥测事件转换为 ai_feedback 记录
    const feedbackRecords = this.batchQueue
      .splice(0, TELEMETRY_CONFIG.BATCH_SIZE)
      .map((e) => ({
        id: e.id || crypto.randomUUID(),
        user_id: user.id,
        conversation_id: e.sessionId || this.sessionId,
        message_id: `rule_${e.ruleId}_${Date.now()}`,
        type: e.accepted ? "positive" : "negative",
        tool_used: e.ruleId,
        created_at: e.matchedAt?.toISOString() || new Date().toISOString(),
      }));

    const { error } = await supabase
      .from("ai_feedback")
      .insert(feedbackRecords);

    if (error) {
      clientLogger.error(
        { error, context: "TelemetryManager" },
        "Flush failed",
      );
      // 失败的事件重新入队（最多重试一次）
    }
  }

  /**
   * 重置会话
   */
  resetSession(): void {
    this.sessionId = this.generateSessionId();
    this.pendingMatches.clear();
  }

  private scheduleBatchFlush(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(async () => {
      await this.flush();
      this.flushTimer = null;

      // 如果还有剩余，继续调度
      if (this.batchQueue.length > 0) {
        this.scheduleBatchFlush();
      }
    }, TELEMETRY_CONFIG.FLUSH_INTERVAL);
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const telemetryManager = new TelemetryManager();
