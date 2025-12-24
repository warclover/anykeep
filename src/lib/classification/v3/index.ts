/**
 * V3 兼容层 (Compatibility Layer)
 *
 * ⚠️ 已弃用 - 请使用新的导入路径
 *
 * 此文件仅为向后兼容保留，将在 2025-03-01 后移除。
 *
 * 迁移指南：
 * ─────────────────────────────────────────────────────────────
 * 旧导入路径                     新导入路径
 * ─────────────────────────────────────────────────────────────
 * @/lib/classification/v3       @/lib/classification/config
 * V3_CONFIG                     FEATURE_FLAGS
 * V3Config                      FeatureFlagsConfig
 * isV3FeatureEnabled            isFeatureEnabled
 * V4_DEFAULT_CONFIG             DEFAULT_CLASSIFICATION_CONFIG
 * V4Configuration               ClassificationConfiguration
 * ─────────────────────────────────────────────────────────────
 *
 * 其他导入已移至专属模块：
 * - 策略: @/lib/classification/strategies/advanced
 * - 服务: @/lib/classification/services/advanced
 * - 常量: @/lib/classification/constants
 * - Prompts: @/lib/classification/prompts
 * - Repositories: @/lib/classification/repositories
 *
 * @deprecated 将在 2025-03-01 后移除
 * @since 2025-12-07 (V3.0 发布)
 * @updated 2025-12-24 (Phase 3.1 - 配置解耦)
 */

// ═══════════════════════════════════════════════════════════════════════════
// 配置 - 从 config 重新导出（向后兼容）
// ═══════════════════════════════════════════════════════════════════════════

export {
  // 新名称
  FEATURE_FLAGS,
  FEATURE_FLAGS_DEFAULT,
  FEATURE_FLAGS_AGGRESSIVE,
  type FeatureFlagsConfig,
  isFeatureEnabled,
  getFeatureFlagsSummary,
  // V3 别名（已弃用）
  V3_CONFIG,
  V3_CONFIG_DEFAULT,
  V3_CONFIG_AGGRESSIVE,
  type V3Config,
  isV3FeatureEnabled,
  getV3ConfigSummary,
} from "../config/feature-flags";

export {
  // 新名称
  DEFAULT_CLASSIFICATION_CONFIG,
  type ClassificationConfiguration,
  // 服务默认配置
  CORRECTION_CACHE_DEFAULTS,
  RERANKER_DEFAULTS,
  THRESHOLDS_DEFAULTS,
  AI_CONFIG_DEFAULTS,
  TIERED_CLASSIFICATION_DEFAULTS,
  MATCHER_WEIGHTS_DEFAULTS,
  DYNAMIC_WEIGHTS_THRESHOLDS_DEFAULTS,
  INCREMENTAL_PROFILE_DEFAULTS,
  NAMING_ENGINE_DEFAULTS,
  BACKFILL_DEFAULTS,
  PATROL_DEFAULTS,
  SCENARIO_THRESHOLDS_DEFAULTS,
  AI_LIBRARIAN_DEFAULTS,
  // V4 别名（已弃用）
  V4_DEFAULT_CONFIG,
  type V4Configuration,
  type ThresholdsConfig,
  type AIConfigType,
  getEnvironmentConfig,
} from "../config/defaults";

// ═══════════════════════════════════════════════════════════════════════════
// 常量 - 从 constants 重新导出
// ═══════════════════════════════════════════════════════════════════════════

export * from "../constants";

// ═══════════════════════════════════════════════════════════════════════════
// Prompts - 从 prompts 重新导出
// ═══════════════════════════════════════════════════════════════════════════

export * from "../prompts";

// ═══════════════════════════════════════════════════════════════════════════
// 策略 - 从 strategies/advanced 重新导出
// ═══════════════════════════════════════════════════════════════════════════

export * from "../strategies/advanced";

// ═══════════════════════════════════════════════════════════════════════════
// Repositories - 从 repositories 重新导出
// ═══════════════════════════════════════════════════════════════════════════

export * from "../repositories";

// ═══════════════════════════════════════════════════════════════════════════
// Services - 从 services/advanced 重新导出
// ═══════════════════════════════════════════════════════════════════════════

export * from "../services/advanced";

// ═══════════════════════════════════════════════════════════════════════════
// 版本信息
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated */
export const V3_VERSION = "3.0.0";

/** @deprecated */
export const V3_RELEASE_DATE = "2025-12-07";

/** 弃用日期 */
export const V3_DEPRECATION_DATE = "2025-03-01";

/** 兼容层警告 - 仅在开发环境输出 */
if (process.env.NODE_ENV === "development") {
  // eslint-disable-next-line no-console -- 弃用警告需要在控制台直接显示
  console.warn(
    `[Classification V3] ⚠️ 使用了已弃用的 v3 兼容层导入。\n` +
      `请迁移到新路径：@/lib/classification/config\n` +
      `此兼容层将在 ${V3_DEPRECATION_DATE} 后移除。`,
  );
}
