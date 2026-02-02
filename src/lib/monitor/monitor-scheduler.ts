/**
 * 监控调度器
 *
 * 负责调度和执行页面监控检查任务
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  PendingMonitor,
  MonitorCheckResult,
  CheckTaskConfig,
  CheckTaskStats,
  ChangeNotification,
  CheckResult,
} from "./types";
import { MONITOR_PROTECTION, CHECK_INTERVAL_HOURS } from "./constants";
import type { CheckInterval } from "./constants";
import { fetchPageContent } from "./page-fetcher";
import {
  compareContent,
  hasContentChanged,
  shouldSendNotification,
} from "./content-comparer";
import { logger } from "@/lib/logger";

/**
 * 监控查询结果类型（含关联的书签信息）
 */
interface MonitorWithBookmark {
  id: number;
  user_id: string;
  bookmark_id: number;
  check_interval: CheckInterval;
  custom_interval_hours: number | null;
  baseline_snapshot_id: number | null;
  baseline_content_hash: string | null;
  consecutive_failures: number;
  last_checked_at: string | null;
  bookmarks: {
    id: number;
    url: string;
    title: string;
  } | null;
}

/**
 * 默认任务配置
 */
const DEFAULT_CONFIG: CheckTaskConfig = {
  maxConcurrency: MONITOR_PROTECTION.MAX_CHECKS_PER_MINUTE / 6, // ~16 并发
  timeoutMs: MONITOR_PROTECTION.CHECK_TIMEOUT_MS,
  retryDelayHours: MONITOR_PROTECTION.RETRY_DELAY_HOURS,
  maxConsecutiveFailures: MONITOR_PROTECTION.MAX_CONSECUTIVE_FAILURES,
  sendNotifications: true,
};

/**
 * 监控调度器
 */
export class MonitorScheduler {
  private supabase: SupabaseClient<Database>;
  private config: CheckTaskConfig;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<CheckTaskConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取待检查的监控列表
   *
   * @param limit - 最大获取数量
   * @returns 待检查的监控列表
   */
  async getPendingMonitors(limit: number = 100): Promise<PendingMonitor[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from("page_monitors")
      .select(
        `
        id,
        user_id,
        bookmark_id,
        check_interval,
        custom_interval_hours,
        baseline_snapshot_id,
        baseline_content_hash,
        consecutive_failures,
        last_checked_at,
        bookmarks!inner (
          id,
          url,
          title
        )
      `,
      )
      .eq("status", "active")
      .or(`next_check_at.is.null,next_check_at.lte.${now}`)
      .order("next_check_at", { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) {
      throw new Error(`获取待检查监控失败: ${error.message}`);
    }

    if (!data) return [];

    // 使用类型断言确保类型安全
    const typedData = data as unknown as MonitorWithBookmark[];

    return typedData.map((row) => ({
      id: row.id,
      userId: row.user_id,
      bookmarkId: row.bookmark_id,
      bookmarkUrl: row.bookmarks?.url ?? "",
      bookmarkTitle: row.bookmarks?.title ?? "",
      checkInterval: row.check_interval,
      customIntervalHours: row.custom_interval_hours,
      baselineSnapshotId: row.baseline_snapshot_id,
      baselineContentHash: row.baseline_content_hash,
      consecutiveFailures: row.consecutive_failures,
      lastCheckedAt: row.last_checked_at,
    }));
  }

  /**
   * 检查单个监控
   *
   * @param monitor - 监控项
   * @returns 检查结果
   */
  async checkMonitor(monitor: PendingMonitor): Promise<MonitorCheckResult> {
    const startTime = performance.now();

    try {
      // 1. 抓取页面内容
      const fetchResult = await fetchPageContent(
        monitor.bookmarkUrl,
        this.config.timeoutMs,
      );

      if (!fetchResult.success) {
        return {
          monitorId: monitor.id,
          result: fetchResult.errorMessage?.includes("超时")
            ? "timeout"
            : "error",
          similarityScore: null,
          changeSummary: null,
          newSnapshotId: null,
          newContentHash: null,
          errorMessage: fetchResult.errorMessage,
          responseTimeMs: fetchResult.responseTimeMs,
        };
      }

      // 2. 快速哈希检查
      const contentChanged = hasContentChanged(
        monitor.baselineContentHash,
        fetchResult.contentHash,
      );

      let result: CheckResult = "no_change";
      let similarityScore: number | null = 100;
      let changeSummary: string | null = "内容无变化";
      let newSnapshotId: number | null = null;

      // 3. 如果哈希不同，进行详细对比
      if (contentChanged && fetchResult.content) {
        // 获取基线内容进行对比
        const baselineContent = await this.getBaselineContent(
          monitor.baselineSnapshotId,
        );

        if (baselineContent) {
          const compareResult = compareContent(
            baselineContent,
            fetchResult.content,
          );

          result = compareResult.hasChanged ? "changed" : "no_change";
          similarityScore = compareResult.similarityScore;
          changeSummary = compareResult.changeSummary;
        } else {
          // 没有基线，视为首次检查
          result = "changed";
          similarityScore = 0;
          changeSummary = "首次检查，已建立基线";
        }

        // 4. 创建新快照
        if (
          result === "changed" &&
          fetchResult.contentHash &&
          fetchResult.wordCount !== undefined &&
          fetchResult.wordCount !== null
        ) {
          newSnapshotId = await this.createSnapshot(
            monitor.bookmarkId,
            fetchResult.content,
            fetchResult.contentHash,
            fetchResult.wordCount,
          );
        }
      }

      return {
        monitorId: monitor.id,
        result,
        similarityScore,
        changeSummary,
        newSnapshotId,
        newContentHash: fetchResult.contentHash,
        errorMessage: null,
        responseTimeMs: Math.round(performance.now() - startTime),
      };
    } catch (error) {
      return {
        monitorId: monitor.id,
        result: "error",
        similarityScore: null,
        changeSummary: null,
        newSnapshotId: null,
        newContentHash: null,
        errorMessage: error instanceof Error ? error.message : "未知错误",
        responseTimeMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * 获取基线内容
   */
  private async getBaselineContent(
    snapshotId: number | null,
  ): Promise<string | null> {
    if (!snapshotId) return null;

    const { data, error } = await this.supabase
      .from("bookmark_snapshots")
      .select("readable_text_content")
      .eq("id", snapshotId)
      .single();

    if (error || !data) return null;
    return data.readable_text_content;
  }

  /**
   * 创建新快照
   */
  private async createSnapshot(
    bookmarkId: number,
    content: string,
    contentHash: string,
    wordCount: number,
  ): Promise<number | null> {
    const { data, error } = await this.supabase
      .from("bookmark_snapshots")
      .insert({
        bookmark_id: bookmarkId,
        readable_text_content: content,
        content_hash: contentHash,
        readable_word_count: wordCount,
        captured_at: new Date().toISOString(),
        original_url: "", // 必填字段
        snapshot_type: "monitor", // 必填字段
        status: "completed", // 必填字段
        user_id: "", // 将由触发器填充
      })
      .select("id")
      .single();

    if (error) {
      logger.error({ error }, "MonitorScheduler: 创建快照失败");
      return null;
    }

    return data?.id || null;
  }

  /**
   * 更新监控状态
   */
  async updateMonitorStatus(
    monitor: PendingMonitor,
    result: MonitorCheckResult,
  ): Promise<void> {
    const now = new Date();
    const isError = result.result === "error" || result.result === "timeout";

    // 计算下次检查时间
    const intervalHours =
      monitor.customIntervalHours ||
      CHECK_INTERVAL_HOURS[monitor.checkInterval] ||
      24;

    let nextCheckAt: Date;
    let newConsecutiveFailures: number;
    let newStatus: "active" | "paused" | "failed" | "deleted" = "active";

    if (isError) {
      // 错误情况：增加连续失败计数
      newConsecutiveFailures = monitor.consecutiveFailures + 1;

      if (newConsecutiveFailures >= this.config.maxConsecutiveFailures) {
        // 超过阈值，暂停监控
        newStatus = "failed";
        nextCheckAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 设置为一年后
      } else {
        // 使用重试延迟
        nextCheckAt = new Date(
          now.getTime() + this.config.retryDelayHours * 60 * 60 * 1000,
        );
      }
    } else {
      // 成功情况：重置连续失败计数
      newConsecutiveFailures = 0;
      nextCheckAt = new Date(now.getTime() + intervalHours * 60 * 60 * 1000);
    }

    // 构建更新数据
    const updateData: Database["public"]["Tables"]["page_monitors"]["Update"] =
      {
        last_checked_at: now.toISOString(),
        next_check_at: nextCheckAt.toISOString(),
        consecutive_failures: newConsecutiveFailures,
        last_error_message: result.errorMessage,
        status: newStatus,
      };

    // 如果有变化，更新基线和变更计数
    if (result.result === "changed" && result.newSnapshotId) {
      updateData.baseline_snapshot_id = result.newSnapshotId;
      updateData.baseline_content_hash = result.newContentHash;
      // 使用 SQL 递增 change_count
    }

    await this.supabase
      .from("page_monitors")
      .update(updateData)
      .eq("id", monitor.id);

    // 如果有变化，递增变更计数
    if (result.result === "changed") {
      await this.supabase.rpc("increment_monitor_change_count", {
        monitor_id: monitor.id,
      });
    }
  }

  /**
   * 记录检查日志
   */
  async logCheckResult(
    monitorId: number,
    userId: string,
    result: MonitorCheckResult,
  ): Promise<void> {
    // 将 error/timeout 映射到数据库支持的类型
    const dbCheckResult: Database["public"]["Tables"]["monitor_check_logs"]["Row"]["check_result"] =
      result.result === "error" || result.result === "timeout"
        ? "failed"
        : (result.result as "no_change" | "changed" | "skipped");

    await this.supabase.from("monitor_check_logs").insert({
      monitor_id: monitorId,
      user_id: userId,
      check_result: dbCheckResult,
      checked_at: new Date().toISOString(),
      similarity_score: result.similarityScore,
      change_summary: result.changeSummary,
      new_snapshot_id: result.newSnapshotId,
      error_message: result.errorMessage,
      duration_ms: result.responseTimeMs,
    });
  }

  /**
   * 发送变更通知
   */
  async sendChangeNotification(
    monitor: PendingMonitor,
    result: MonitorCheckResult,
    notificationEnabled: boolean,
  ): Promise<void> {
    if (
      !shouldSendNotification(
        result.similarityScore || 100,
        notificationEnabled,
      )
    ) {
      return;
    }

    const notification: ChangeNotification = {
      userId: monitor.userId,
      monitorId: monitor.id,
      bookmarkId: monitor.bookmarkId,
      bookmarkTitle: monitor.bookmarkTitle,
      bookmarkUrl: monitor.bookmarkUrl,
      changeSummary: result.changeSummary || "页面内容发生变化",
      similarityScore: result.similarityScore || 0,
      checkedAt: new Date().toISOString(),
    };

    // 插入到消息表
    await this.supabase.from("user_notifications").insert({
      user_id: notification.userId,
      type_code: "page_content_changed",
      title: `📄 ${notification.bookmarkTitle} 内容已更新`,
      body: notification.changeSummary,
      metadata: {
        monitorId: notification.monitorId,
        bookmarkId: notification.bookmarkId,
        bookmarkUrl: notification.bookmarkUrl,
        similarityScore: notification.similarityScore,
      },
      status: "unread",
      channels: ["in_app"],
      priority: "normal",
      created_at: notification.checkedAt,
    });
  }

  /**
   * 批量执行检查任务
   *
   * @param limit - 最大检查数量
   * @returns 任务统计
   */
  async runCheckTask(limit: number = 100): Promise<CheckTaskStats> {
    const startTime = performance.now();
    const stats: CheckTaskStats = {
      totalChecked: 0,
      noChangeCount: 0,
      changedCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      durationMs: 0,
      usersAffected: 0,
    };

    // 1. 获取待检查的监控
    const pendingMonitors = await this.getPendingMonitors(limit);

    if (pendingMonitors.length === 0) {
      stats.durationMs = Math.round(performance.now() - startTime);
      return stats;
    }

    const affectedUsers = new Set<string>();

    // 2. 分批并发执行
    for (
      let i = 0;
      i < pendingMonitors.length;
      i += this.config.maxConcurrency
    ) {
      const batch = pendingMonitors.slice(i, i + this.config.maxConcurrency);

      const results = await Promise.allSettled(
        batch.map(async (monitor) => {
          const result = await this.checkMonitor(monitor);

          // 更新状态
          await this.updateMonitorStatus(monitor, result);

          // 记录日志
          await this.logCheckResult(monitor.id, monitor.userId, result);

          // 发送通知（如果需要）
          if (result.result === "changed") {
            // 获取通知设置
            const { data: monitorData } = await this.supabase
              .from("page_monitors")
              .select("notification_enabled")
              .eq("id", monitor.id)
              .single();

            if (monitorData?.notification_enabled) {
              await this.sendChangeNotification(monitor, result, true);
            }
          }

          return { monitor, result };
        }),
      );

      // 统计结果
      for (const promiseResult of results) {
        if (promiseResult.status === "fulfilled") {
          const { monitor, result } = promiseResult.value;
          stats.totalChecked++;
          affectedUsers.add(monitor.userId);

          switch (result.result) {
            case "no_change":
              stats.noChangeCount++;
              break;
            case "changed":
              stats.changedCount++;
              break;
            case "error":
              stats.errorCount++;
              break;
            case "timeout":
              stats.timeoutCount++;
              break;
          }
        } else {
          stats.errorCount++;
          logger.error(
            { error: promiseResult.reason },
            "MonitorScheduler: 检查任务失败",
          );
        }
      }
    }

    stats.usersAffected = affectedUsers.size;
    stats.durationMs = Math.round(performance.now() - startTime);

    return stats;
  }
}
