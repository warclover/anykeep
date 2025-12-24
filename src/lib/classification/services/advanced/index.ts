/**
 * Advanced Classification Services
 *
 * 高级分类服务，包含：
 * - AI Librarian 整理大师
 * - 分层分类引擎
 * - 动态权重调整
 * - 追踪和纠错服务
 *
 * @since 2025-12-24 (Phase 3.1 - V3 目录重组)
 * @module classification/services/advanced
 */

export * from "./feedback-loop.service";
export * from "./auto-create-evaluator.service";
export * from "./backfill-classification.service";
export * from "./dynamic-weights.service";
export * from "./incremental-profile.service";
export * from "./ai-librarian.service";
export * from "./tiered-classification.service";

// V4.0 追踪服务
export * from "./trace.service";

// V4.0 实时纠错缓存
export * from "./correction-cache.service";

// V4.0 配置中心 (排除 ThresholdsConfig，由 config/v3 提供)
export {
  type UniversalCategoryConfig,
  type ScenarioWeights,
  // ThresholdsConfig - 由 config/v3/defaults.ts 提供，避免重复
  type FeatureFlags,
  type MatcherConfigItem,
  type AIConfig,
  type StrategyConfig,
  ConfigCenterService,
  getConfigCenter,
  resetConfigCenter,
} from "./config-center.service";

// V4.0 语义重排序
export * from "./reranker.service";

// V4.0 用户场景检测
export * from "./user-scenario-detector.service";

// V4.0 命名优化引擎
export * from "./naming-engine.service";

// V4.0 整理大师主动巡检
export * from "./librarian-patrol.service";
