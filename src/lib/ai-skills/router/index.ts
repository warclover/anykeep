/**
 * 智能路由层模块导出
 *
 * @module ai-skills/router
 * @version 2.0.0
 * @since 2025-12-24
 * @updated 2025-12-26 - 添加意图类型常量
 */

// 常量导出
export {
  // 意图类型常量
  INTENT_TYPES,
  INTENT_SUBTYPES,
  QUERY_SUBTYPES,
  ACTION_SUBTYPES,
  ORGANIZE_SUBTYPES,
  ANALYZE_SUBTYPES,
  LEARN_SUBTYPES,
  CREATE_SUBTYPES,
  CHITCHAT_SUBTYPES,
  // 复杂度常量
  COMPLEXITY_LEVELS,
  // 执行模式常量
  EXECUTION_MODES,
  // 分类来源常量
  CLASSIFICATION_SOURCES,
  // 实体类型常量
  ENTITY_TYPES,
  // 辅助函数
  isValidIntentType,
  isValidComplexityLevel,
  isValidExecutionMode,
  getSubtypesForIntent,
} from "./constants";

export type {
  IntentTypeValue,
  ComplexityLevelValue,
  ExecutionModeValue,
  ClassificationSourceValue,
  EntityTypeValue,
} from "./constants";

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

// LLM 意图分类器 (Phase 2.1)
export {
  LLMIntentClassifier,
  createLLMClassifier,
  getLLMClassifier,
} from "./llm-classifier";
export type {
  LLMClassifierConfig,
  LLMClassificationResult,
} from "./llm-classifier";

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
  // Code Review P1-3: 懒加载单例模式
  getIntentRouter,
  configureIntentRouter,
  resetIntentRouter,
  isIntentRouterInitialized,
} from "./intent-router";

// 消歧规则 (Phase 1.2 + Phase 2.3)
export {
  DISAMBIGUATION_RULES,
  getApplicableRules,
  findMatchingRule,
  // Phase 2.3: 可配置化
  DisambiguationRulesManager,
  createDisambiguationRulesManager,
  getDefaultDisambiguationRulesManager,
} from "./disambiguation-rules";
export type { DisambiguationRulesConfig } from "./disambiguation-rules";

// 显式工具路由器 (Phase 4)
export {
  ExplicitToolRouter,
  createExplicitToolRouter,
  explicitToolRouter,
  TOOL_MAPPINGS,
} from "./explicit-tool-router";
export type { ToolMapping, ExplicitToolRequest } from "./explicit-tool-router";

// 路由性能指标 (Phase 2.2)
export {
  RouteMetricsCollector,
  RouteMetricsAggregator,
  createRouteMetricsCollector,
  createRouteMetricsAggregator,
  getDefaultMetricsAggregator,
} from "./metrics";
export type { RouteMetrics, RouteMetricsAggregation } from "./metrics";

// 统一意图→Skill 路由器 (v2.0)
export {
  IntentSkillRouter,
  createIntentSkillRouter,
  getDefaultRouter,
  resetDefaultRouter,
} from "./intent-skill-router";
export type {
  RouteResult as IntentSkillRouteResult,
  RouteContext as IntentSkillRouteContext,
  IntentSkillRouterConfig,
} from "./intent-skill-router";

// 统一意图分析器 (v3.0 - 合并 IntentClassifier + ComplexityEvaluator + ModeSelector)
export {
  IntentAnalyzer,
  createIntentAnalyzer,
  intentAnalyzer,
} from "./intent-analyzer";
export type { AnalysisResult, IntentAnalyzerConfig } from "./intent-analyzer";

// 意图消歧器 (Phase 2 - 意图映射增强)
export {
  IntentDisambiguator,
  createIntentDisambiguator,
} from "./intent-disambiguator";
export type {
  IntentMatch,
  IntentAlternative,
  DisambiguationOption,
  DisambiguationQuestion,
  IntentDisambiguatorConfig,
} from "./intent-disambiguator";

// 路由日志 (Phase 2.4 - 意图映射日志)
export {
  RouteLogger,
  getRouteLogger,
  createRouteLogger,
  resetRouteLogger,
  createRouteDecisionLog,
} from "./route-logger";
export type {
  RouteDecisionLog,
  RouteLogLevel,
  RouteLoggerConfig,
} from "./route-logger";
