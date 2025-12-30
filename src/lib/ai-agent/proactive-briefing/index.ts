/**
 * 主动简报模块导出
 *
 * @version 1.0.0
 * @since 2025-12-30
 * @module proactive-briefing
 */

// 类型导出
export type {
  ProactiveBriefingConfig,
  ProactiveBriefing,
  InsightType,
  ProactiveInsight,
  ActionType,
  SuggestedAction,
  OfflineChanges,
  GetInsightsOptions,
  InsightGenerator,
  BriefingApiResponse,
  InsightsApiResponse,
  ProactiveInsightRow,
  OfflineChangesRpcResult,
} from "./types";

// 常量导出
export {
  PROACTIVE_BRIEFING_DEFAULTS,
  TIME_CONSTANTS,
  INSIGHT_TYPE_CONFIG,
  ACTION_TYPE_CONFIG,
  THRESHOLDS,
  LOG_MODULE,
  ERROR_MESSAGES,
} from "./constants";

// 工具函数导出
export {
  calculateDaysSinceLastVisit,
  calculateOfflineDuration,
  formatOfflineDuration,
  generateInsightId,
  generateActionId,
  calculateTopicDistribution,
  getEmergingTopics,
  isValidUserId,
  generateSimpleSummary,
} from "./utils";

// 服务导出（待实现）
export { ProactiveBriefingService } from "./proactive-briefing-service";
