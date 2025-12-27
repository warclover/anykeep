/**
 * 页面监控模块
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// 常量导出
export {
  type CheckInterval,
  MONITOR_QUOTA,
  CHECK_INTERVAL_LABELS,
  CHECK_INTERVAL_HOURS,
  MONITOR_PROTECTION,
  CHECK_LOG_RETENTION_DAYS,
  VERSION_RETENTION,
} from "./constants";

// 类型导出
export type {
  MonitorStatus,
  CheckResult,
  PageMonitorRecord,
  MonitorCheckLogRecord,
  BookmarkSnapshotRecord,
  PendingMonitor,
  MonitorCheckResult,
  CheckTaskConfig,
  CheckTaskStats,
  PageFetchResult,
  ContentCompareResult,
  ChangeNotification,
} from "./types";

// 页面抓取服务
export {
  fetchPageContent,
  hashContent,
  countWords,
  extractReadableText,
  isUrlMonitorable,
} from "./page-fetcher";

// 内容对比服务
export {
  compareContent,
  hasContentChanged,
  isSignificantChange,
  shouldSendNotification,
} from "./content-comparer";

// 监控调度器
export { MonitorScheduler } from "./monitor-scheduler";
