/**
 * Analytics 模块导出
 * @module lib/analytics
 */

export { AnalyticsService, getAnalyticsData } from "./analytics.service";
export type {
  AnalyticsStats,
  TrendDataItem,
  PlatformDistribution,
  FolderDistribution,
  TagStats,
  ContentTypeStats,
  PeriodComparison,
  TimeComparison,
  AIProcessingStats,
  AnalyticsData,
  AnalyticsConfig,
} from "./types";
export {
  BROWSER_PLATFORMS,
  isBrowserPlatform,
  DEFAULT_ANALYTICS_CONFIG,
} from "./types";
