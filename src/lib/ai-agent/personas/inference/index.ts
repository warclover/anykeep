/**
 * 画像推断引擎模块
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// 类型导出
export type {
  ConditionType,
  ConditionOperator,
  LogicalOperator,
  BaseCondition,
  TagMatchCondition,
  PlatformMatchCondition,
  ContentTypeMatchCondition,
  FolderMatchCondition,
  DomainMatchCondition,
  FrequencyCheckCondition,
  TimePatternCondition,
  CompositeCondition,
  InferenceCondition,
  InferenceRule,
  RuleMatchResult,
  UserBehaviorData,
  InferenceEngineConfig,
  InferenceResult,
  IInferenceEngine,
} from "./types";

// 常量导出
export { DEFAULT_INFERENCE_CONFIG } from "./types";

// 条件匹配器
export { ConditionMatcher, conditionMatcher } from "./condition-matcher";
export type { ConditionMatchResult } from "./condition-matcher";

// 推断规则
export {
  PM_INFERENCE_RULES,
  CONSULTANT_INFERENCE_RULES,
  TEACHER_INFERENCE_RULES,
  ANALYST_INFERENCE_RULES,
  CERT_SEEKER_INFERENCE_RULES,
  UX_RESEARCHER_INFERENCE_RULES,
  PHASE1_INFERENCE_RULES,
  PHASE2_INFERENCE_RULES,
  ALL_INFERENCE_RULES,
  INFERENCE_RULES_BY_PERSONA,
} from "./rules";

// 意图规则
export type { PersonaIntentRule } from "./intent-rules";
export {
  PM_INTENT_RULES,
  CONSULTANT_INTENT_RULES,
  TEACHER_INTENT_RULES,
  ANALYST_INTENT_RULES,
  CERT_SEEKER_INTENT_RULES,
  UX_RESEARCHER_INTENT_RULES,
  COMMON_PERSONA_RULES,
  PHASE1_INTENT_RULES,
  PHASE2_INTENT_RULES,
  ALL_PERSONA_INTENT_RULES,
  INTENT_RULES_BY_PERSONA,
  matchPersonaIntentRules,
  getBestPersonaIntentRule,
  generatePersonaIntentPrompt,
} from "./intent-rules";

// 权重矩阵
export {
  PERSONA_SIMILARITY_MATRIX,
  getPersonaSimilarity,
  SIGNAL_TYPE_WEIGHTS,
  PERSONA_GROUP_WEIGHTS,
  CONFIDENCE_FACTOR_WEIGHTS,
  calculateWeightedConfidence,
  PERSONA_BASE_PRIORITY,
  getPersonaPriority,
  COMPETING_PERSONA_RULES,
  findCompetingRule,
} from "./weight-matrix";
export type { CompetingPersonaRule } from "./weight-matrix";

// 推断引擎
export {
  PersonaInferenceEngine,
  createInferenceEngine,
  defaultInferenceEngine,
} from "./inference-engine";
