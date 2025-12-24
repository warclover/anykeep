/**
 * 数据导出功能 - 数据埋点
 * V2.1: 独立页面 + 多入口复用
 */

import { clientLogger } from "@/lib/client-logger";
import { EXPORT_ANALYTICS_EVENTS } from "./constants";
import type {
  ExportAnalyticsParams,
  ExportFormat,
  ExportSource,
} from "./types";

/**
 * 发送埋点事件
 * 集成项目现有的埋点系统
 */
function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  // TODO: 集成项目的埋点系统
  // 目前使用 clientLogger 作为占位
  if (process.env.NODE_ENV === "development") {
    clientLogger.debug({ eventName, params }, "[Export Analytics]");
  }

  // 示例：集成 Google Analytics
  // if (typeof window !== 'undefined' && window.gtag) {
  //   window.gtag('event', eventName, params);
  // }

  // 示例：集成自定义埋点
  // if (typeof window !== 'undefined' && window.analytics) {
  //   window.analytics.track(eventName, params);
  // }
}

/**
 * 导出页面访问埋点
 */
export function trackExportPageViewed(): void {
  trackEvent(EXPORT_ANALYTICS_EVENTS.PAGE_VIEWED);
}

/**
 * 导出对话框打开埋点
 */
export function trackExportDialogOpened(source: ExportSource): void {
  trackEvent(EXPORT_ANALYTICS_EVENTS.DIALOG_OPENED, { source });
}

/**
 * 导出格式选择埋点
 */
export function trackExportFormatSelected(format: ExportFormat): void {
  trackEvent(EXPORT_ANALYTICS_EVENTS.FORMAT_SELECTED, { format });
}

/**
 * 筛选条件应用埋点
 */
export function trackExportFilterApplied(filterTypes: string[]): void {
  trackEvent(EXPORT_ANALYTICS_EVENTS.FILTER_APPLIED, { filterTypes });
}

/**
 * 导出预览查看埋点
 */
export function trackExportPreviewViewed(
  format: ExportFormat,
  count: number,
): void {
  trackEvent(EXPORT_ANALYTICS_EVENTS.PREVIEW_VIEWED, { format, count });
}

/**
 * 导出开始埋点
 */
export function trackExportStarted(params: ExportAnalyticsParams): void {
  trackEvent(
    EXPORT_ANALYTICS_EVENTS.EXPORT_STARTED,
    params as Record<string, unknown>,
  );
}

/**
 * 导出完成埋点
 */
export function trackExportCompleted(params: ExportAnalyticsParams): void {
  trackEvent(
    EXPORT_ANALYTICS_EVENTS.EXPORT_COMPLETED,
    params as Record<string, unknown>,
  );
}

/**
 * 导出失败埋点
 */
export function trackExportFailed(params: ExportAnalyticsParams): void {
  trackEvent(
    EXPORT_ANALYTICS_EVENTS.EXPORT_FAILED,
    params as Record<string, unknown>,
  );
}

/**
 * 导出取消埋点
 */
export function trackExportCancelled(params: ExportAnalyticsParams): void {
  trackEvent(
    EXPORT_ANALYTICS_EVENTS.EXPORT_CANCELLED,
    params as Record<string, unknown>,
  );
}

/**
 * 批量埋点辅助函数
 */
export const exportAnalytics = {
  pageViewed: trackExportPageViewed,
  dialogOpened: trackExportDialogOpened,
  formatSelected: trackExportFormatSelected,
  filterApplied: trackExportFilterApplied,
  previewViewed: trackExportPreviewViewed,
  started: trackExportStarted,
  completed: trackExportCompleted,
  failed: trackExportFailed,
  cancelled: trackExportCancelled,
};
