/**
 * AI Agent 配置模块导出
 *
 * @module ai-agent/config
 * @version 1.0.0
 * @since 2025-12-26
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
