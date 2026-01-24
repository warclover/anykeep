/**
 * 智能分类 v5.0 - Rollout 模块导出
 *
 * @deprecated 请使用 '../feature-flags' 导入 FeatureFlagService
 */

// 从统一 Feature Flags 重新导出（向后兼容）
export {
  FeatureFlagService,
  RolloutStage,
  getFeatureFlag,
  resetFeatureFlag,
  type FeatureFlagConfig,
  // 新增导出
  getFeatureFlagService,
  resetFeatureFlagService,
  type ClassificationFeatureFlags,
} from "../feature-flags";

export {
  MonitoringService,
  type ClassificationMetrics,
  type HealthMetrics,
  type ComparisonMetrics,
  type MonitoringReport,
  type Alert,
} from "./monitoring";

export {
  RollbackService,
  RollbackReason,
  RollbackStatus,
  type RollbackRecord,
} from "./rollback";
