/**
 * AI Agent 配置模块导出
 *
 * @module ai-agent/config
 * @version 1.2.0
 * @since 2025-12-26
 * @updated 2025-12-28 - 添加画像灰度发布配置
 */

// 功能开关
export {
  FeatureFlags,
  isFeatureEnabled,
  getAllFeatureFlags,
  type FeatureFlagKey,
} from "./feature-flags";

// 成本控制器
export {
  CostController,
  costController,
  checkTokenBudget,
  recordTokenUsage,
  getTokenUsageStats,
  DEFAULT_TOKEN_BUDGET,
  MODEL_COST_FACTORS,
  type TokenUsageRecord,
  type UsageStats,
  type BudgetCheckResult,
  type TokenBudgetConfig,
} from "./cost-controller";

// 压缩配置
export {
  DEFAULT_COMPRESSION_CONFIG,
  getCompressionConfig,
  validateCompressionConfig,
  COMPRESSION_FEATURE_FLAG,
  REQUIRED_SUMMARY_SECTIONS,
  SUMMARY_SECTION_PATTERNS,
} from "./compression-config";

// 画像灰度发布 [Phase 4 新增]
export {
  // 灰度检查
  isUserInPersonaRollout,
  isPersonaFeatureEnabled,
  getPersonaRolloutStatus,
  getCurrentPersonaStage,
  // 回滚监控
  recordPersonaRequest,
  recordPersonaError,
  recordInferenceFailure,
  shouldTriggerRollback,
  executeRollback,
  getRollbackMonitorState,
  resetRollbackState,
  isInRollbackState,
  // 配置常量
  DEFAULT_STAGE_CONFIGS,
  DEFAULT_ROLLBACK_CONFIG,
  DEFAULT_PERSONA_ROLLOUT_CONFIG,
  // 类型
  type PersonaRolloutStage,
  type PersonaStageConfig,
  type PersonaRollbackConfig,
  type PersonaRolloutConfig,
} from "./persona-rollout";
