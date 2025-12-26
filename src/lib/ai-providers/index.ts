/**
 * AI Providers 模块导出
 *
 * @version 1.1.0
 * @since 2025-12-22
 */

// 类型定义
export * from "./types";

// Provider Router
export { AIProviderRouter, aiProviderRouter } from "./provider-router";

// 模型分层配置
export {
  type ModelTierId,
  type TierConfig,
  type TierProviderConfig,
  MODEL_TIER_CONFIG,
  DEFAULT_TIER_ID,
  TIER_PRIORITY_ORDER,
  getTierConfig,
  getTierProviderConfig,
  getAllTierIds,
  isValidTierId,
  getTierTargetLatency,
  getTierCostFactor,
} from "./model-tier-config";

// 任务-层级映射
export {
  INTENT_TIER_MAPPING,
  COMPLEXITY_TIER_MAPPING,
  SKILL_TIER_MAPPING,
  getTierByIntent,
  getTierByComplexity,
  getTierBySkill,
  getIntentKey,
  isSimpleIntent,
  isComplexIntent,
} from "./task-tier-mapping";

// 层级选择器
export {
  type TierSelectionContext,
  type TierSelection,
  type TierSelectionReason,
  ModelTierSelector,
  tierSelector,
  selectTier,
  getModelConfigForTier,
} from "./tier-selector";
