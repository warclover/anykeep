/**
 * 智能路由层模块导出
 *
 * @module ai-skills/router
 * @version 1.0.0
 * @since 2025-12-24
 */

// 类型导出
export type {
  // 意图相关
  IntentType,
  ExtractedEntity,
  IntentClassification,
  IntentRule,
  IntentClassifierConfig,
  // 多候选分类相关 (Phase 1.1)
  IntentCandidate,
  MultiCandidateResult,
  DisambiguationRule,
  // 复杂度相关
  ComplexityLevel,
  ComplexityFactor,
  ComplexityEvaluation,
  ComplexityEvaluatorConfig,
  // 模式选择相关
  ExecutionMode,
  ModeSelection,
  // 路由相关
  UserRequest,
  RequestContext,
  RouteResult,
  RouterConfig,
} from "./types";

// 意图分类器
export {
  IntentClassifier,
  createIntentClassifier,
  intentClassifier,
} from "./intent-classifier";

// 复杂度评估器
export {
  ComplexityEvaluator,
  createComplexityEvaluator,
  complexityEvaluator,
} from "./complexity-evaluator";

// 模式选择器
export {
  ModeSelector,
  createModeSelector,
  modeSelector,
} from "./mode-selector";

// 意图路由器
export {
  IntentRouter,
  createIntentRouter,
  intentRouter,
} from "./intent-router";

// 消歧规则 (Phase 1.2)
export {
  DISAMBIGUATION_RULES,
  getApplicableRules,
  findMatchingRule,
} from "./disambiguation-rules";
