import { createClient } from "@/lib/supabase/client";
import type { TelemetryEvent, RuleStats } from "../types";

class TelemetryManager {
  private sessionId: string;
  private pendingMatches: Map<string, Partial<TelemetryEvent>> = new Map();
  private batchQueue: Partial<TelemetryEvent>[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_INTERVAL = 5000; // 5秒批量刷新
  private readonly BATCH_SIZE = 50;

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
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const data = JSON.stringify({
        events: this.batchQueue,
        sessionId: this.sessionId,
      });
      navigator.sendBeacon("/api/telemetry/batch", data);
    }
  }

  /**
   * 记录规则匹配事件
   */
  async recordMatch(ruleId: string, selectionCount: number): Promise<void> {
    const event: Partial<TelemetryEvent> = {
      id: crypto.randomUUID(),
      ruleId,
      selectionCount,
      matchedAt: new Date(),
      accepted: null,
      decidedAt: null,
      sessionId: this.sessionId,
    };

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
      this.batchQueue.push({
        id: crypto.randomUUID(),
        ruleId,
        selectionCount: 0,
        matchedAt: new Date(),
        accepted,
        decidedAt: new Date(),
        sessionId: this.sessionId,
      });
    }

    this.scheduleBatchFlush();
  }

  /**
   * 获取规则统计数据
   */
  async getRuleStats(ruleId?: string): Promise<RuleStats[]> {
    const supabase = createClient();

    // 使用视图查询
    let query = supabase.from("rule_telemetry_stats").select("*");

    if (ruleId) {
      query = query.eq("rule_id", ruleId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[TelemetryManager] Failed to get stats:", error);
      return [];
    }

    return (data || []).map((row) => ({
      ruleId: row.rule_id,
      matchCount: row.match_count,
      acceptCount: row.accept_count,
      ignoreCount: row.ignore_count,
      acceptRate: row.accept_rate || 0,
    }));
  }

  /**
   * 强制刷新队列
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
      console.info("[TelemetryManager] No user, skipping flush");
      return;
    }

    const events = this.batchQueue.splice(0, this.BATCH_SIZE).map((e) => ({
      id: e.id,
      user_id: user.id,
      rule_id: e.ruleId,
      selection_count: e.selectionCount,
      matched_at: e.matchedAt?.toISOString(),
      accepted: e.accepted,
      decided_at: e.decidedAt?.toISOString(),
      session_id: e.sessionId,
    }));

    const { error } = await supabase.from("rule_telemetry").insert(events);

    if (error) {
      console.error("[TelemetryManager] Flush failed:", error);
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
    }, this.FLUSH_INTERVAL);
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const telemetryManager = new TelemetryManager();
