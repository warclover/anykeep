/**
 * Classification 配置模块统一导出
 *
 * @since 2025-12-24 (Phase 3.1 - 配置解耦)
 */

// ============================================================================
// 核心配置
// ============================================================================

// 功能开关配置
export * from "./feature-flags";

// 服务默认配置
export * from "./defaults";

// AI 摘要配置
export * from "./ai-summary-config";

// 嵌入配置
export * from "./embedding-config";

// 调试配置存储
export * from "./debug-config-store";

// ============================================================================
// 向后兼容导出（V3 别名）
// @deprecated 请直接从 ./feature-flags 和 ./defaults 导入
// ============================================================================

/**
 * V3 配置兼容层 - 重新导出新配置
 *
 * @deprecated 将在 2025-03-01 后移除
 * 请直接从 ./feature-flags 导入:
 * - FeatureFlagsConfig (原 V3Config)
 * - FEATURE_FLAGS (原 V3_CONFIG)
 * - isFeatureEnabled (原 isV3FeatureEnabled)
 *
 * 请直接从 ./defaults 导入:
 * - ClassificationConfiguration (原 V4Configuration)
 * - DEFAULT_CLASSIFICATION_CONFIG (原 V4_DEFAULT_CONFIG)
 */
export {
  // V3Config 别名
  V3_CONFIG_DEFAULT,
  V3_CONFIG_AGGRESSIVE,
  V3_CONFIG,
  isV3FeatureEnabled,
  getV3ConfigSummary,
} from "./feature-flags";

export type { V3Config } from "./feature-flags";

export {
  // V4Configuration 别名
  V4_DEFAULT_CONFIG,
  FEATURE_FLAGS_DEFAULTS,
} from "./defaults";

export type { V4Configuration, FeatureFlagsType } from "./defaults";
