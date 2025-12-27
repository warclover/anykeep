/**
 * 页面监控后台任务类型定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { CheckInterval } from "./constants";

// ============================================
// 监控状态类型
// ============================================

/**
 * 监控状态
 */
export type MonitorStatus =
  | "active" // 运行中
  | "paused" // 已暂停
  | "failed" // 失败（连续失败超限）
  | "deleted"; // 已删除（软删除）

/**
 * 检查结果类型
 */
export type CheckResult =
  | "no_change" // 无变化
  | "changed" // 有变化
  | "error" // 检查失败
  | "timeout"; // 超时

// ============================================
// 数据库记录类型
// ============================================

/**
 * page_monitors 表记录
 */
export interface PageMonitorRecord {
  id: number;
  user_id: string;
  bookmark_id: number;
  check_interval: CheckInterval;
  custom_interval_hours: number | null;
  status: MonitorStatus;
  change_count: number;
  last_checked_at: string | null;
  next_check_at: string | null;
  consecutive_failures: number;
  last_error_message: string | null;
  notification_enabled: boolean;
  baseline_snapshot_id: number | null;
  baseline_content_hash: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 监控检查日志记录
 */
export interface MonitorCheckLogRecord {
  id: number;
  monitor_id: number;
  check_result: CheckResult;
  checked_at: string;
  similarity_score: number | null;
  change_summary: string | null;
  snapshot_id: number | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: string;
}

/**
 * 书签快照记录（简化版）
 */
export interface BookmarkSnapshotRecord {
  id: number;
  bookmark_id: number;
  content_hash: string;
  readable_text_content: string | null;
  word_count: number | null;
  captured_at: string;
}

// ============================================
// 后台任务类型
// ============================================

/**
 * 待检查的监控项（包含关联数据）
 */
export interface PendingMonitor {
  id: number;
  userId: string;
  bookmarkId: number;
  bookmarkUrl: string;
  bookmarkTitle: string;
  checkInterval: CheckInterval;
  customIntervalHours: number | null;
  baselineSnapshotId: number | null;
  baselineContentHash: string | null;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
}

/**
 * 单个监控检查结果
 */
export interface MonitorCheckResult {
  monitorId: number;
  result: CheckResult;
  similarityScore: number | null;
  changeSummary: string | null;
  newSnapshotId: number | null;
  newContentHash: string | null;
  errorMessage: string | null;
  responseTimeMs: number;
}

/**
 * 批量检查任务配置
 */
export interface CheckTaskConfig {
  /** 最大并发检查数 */
  maxConcurrency: number;
  /** 单次检查超时（毫秒） */
  timeoutMs: number;
  /** 失败后重试延迟（小时） */
  retryDelayHours: number;
  /** 连续失败暂停阈值 */
  maxConsecutiveFailures: number;
  /** 是否发送通知 */
  sendNotifications: boolean;
}

/**
 * 批量检查任务结果统计
 */
export interface CheckTaskStats {
  /** 总检查数 */
  totalChecked: number;
  /** 无变化数 */
  noChangeCount: number;
  /** 有变化数 */
  changedCount: number;
  /** 错误数 */
  errorCount: number;
  /** 超时数 */
  timeoutCount: number;
  /** 执行时间（毫秒） */
  durationMs: number;
  /** 受影响的用户数 */
  usersAffected: number;
}

// ============================================
// 页面内容抓取类型
// ============================================

/**
 * 页面内容抓取结果
 */
export interface PageFetchResult {
  success: boolean;
  content: string | null;
  contentHash: string | null;
  wordCount: number | null;
  errorMessage: string | null;
  responseTimeMs: number;
}

/**
 * 内容对比结果
 */
export interface ContentCompareResult {
  hasChanged: boolean;
  similarityScore: number;
  changeSummary: string;
  addedLines: number;
  removedLines: number;
}

// ============================================
// 通知类型
// ============================================

/**
 * 变更通知数据
 */
export interface ChangeNotification {
  userId: string;
  monitorId: number;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  changeSummary: string;
  similarityScore: number;
  checkedAt: string;
}
