/**
 * 全局洞察模块
 *
 * 提供用户"知识画像"相关功能
 *
 * @module ai-agent/global-insight
 * @version 1.0.0
 * @since 2025-12-30
 */

// 类型导出
export type {
  GlobalInsight,
  GlobalInsightConfig,
  TopicWeight,
  TrendPoint,
  TrendDirection,
  PlatformWeight,
  TimeSlot,
  BookmarkForAnalysis,
  TopicRelationMap,
  InsightGenerationResult,
} from "./types";

// 常量导出
export {
  DEFAULT_CONFIG,
  TIME_CONSTANTS,
  TREND_THRESHOLDS,
  ACTIVITY_PARAMS,
  TOPIC_RELATIONS,
  MAX_KNOWLEDGE_GAPS,
  MIN_BOOKMARKS_FOR_INSIGHT,
  INSIGHT_VERSION,
} from "./constants";

// 服务导出
export {
  GlobalInsightService,
  createGlobalInsightService,
} from "./global-insight-service";
