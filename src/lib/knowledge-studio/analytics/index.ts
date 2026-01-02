/**
 * Knowledge Studio Analytics - 模块入口
 * @module knowledge-studio/analytics
 */

// Types
export type {
  KSUsageStats,
  KSAnalyticsConfig,
  OperationStat,
  BlueprintTypeStat,
  DailyUsageTrend,
  TrialStatus,
  UserTrialInfo,
  ConversionFunnel,
} from "./types";

export { DEFAULT_KS_ANALYTICS_CONFIG } from "./types";

// Usage Tracker
export { UsageTracker, createUsageTracker } from "./usage-tracker";
