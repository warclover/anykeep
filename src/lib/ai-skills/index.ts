/**
 * AI Skills 模块导出
 *
 * 精简的公共 API，仅导出必要的顶层符号
 *
 * @version 3.1.0 - 添加依赖注入容器
 * @since 2025-12-22
 * @updated 2025-12-25 - 模块导出优化
 * @updated 2026-01-06 - 添加 AISkillsContainer
 */

// ============================================
// 0. 依赖注入容器（推荐使用）
// ============================================

export {
  AISkillsContainer,
  getAISkillsContainer,
  tryGetAISkillsContainer,
  type AISkillsContainerConfig,
  type AISkillsContainerOverrides,
} from "./container";

// ============================================
// 1. 核心引擎（主要入口）
// ============================================

export {
  // 统一引擎 - 主要使用入口
  UnifiedEngine,
  createUnifiedEngine,
  unifiedEngine,
  // 编排引擎 - 高级用例
  OrchestrationEngine,
  createOrchestrationEngine,
  // 类型
  type UnifiedEngineConfig,
  type EngineContext,
  type EngineExecuteOptions,
} from "./engine";

// ============================================
// 2. 核心基类（扩展用）
// ============================================

export {
  // Skill 基类
  BaseSkill,
  SkillValidationError,
  SkillTimeoutError,
  SkillExecutionError,
} from "./core/base-skill";

export {
  // 编排 Skill 基类
  OrchestrationSkill,
  OrchestrationExecutionError,
} from "./orchestration";

// ============================================
// 3. Skill 注册表
// ============================================

export {
  SkillRegistry,
  skillRegistry,
  createSkillRegistryInstance,
  type SkillRegistryStats,
} from "./core/skill-registry";

// ============================================
// 4. 初始化函数
// ============================================

export {
  registerDefaultSkills,
  initializeAISkills,
  isSkillsInitialized,
  initializeUnifiedEngine,
  getUnifiedEngine,
  isUnifiedEngineInitialized,
  getSkillsAsTools,
} from "./register";

// ============================================
// 5. 核心类型（精简）
// ============================================

export type {
  // Skill 类型
  SkillContext,
  SkillMetadata,
  SkillOutput,
  SkillCategory,
} from "./core/types";

export type {
  // 路由类型
  IntentType,
  IntentClassification,
  ComplexityLevel,
  ComplexityEvaluation,
  ExecutionMode,
  ModeSelection,
  RouteResult,
} from "./router";

export type {
  // 编排类型
  OrchestrationContext,
  StepDefinition,
  Deliverable,
  OrchestrationResult,
} from "./orchestration";

export type {
  // 统一输出类型
  UnifiedStreamChunk,
  OrchestrationStreamChunk,
  TextChunk,
  ProgressChunk,
  DeliverableChunk,
  ErrorChunk,
  DoneChunk,
  // 零接管模式类型
  ThinkingChunk,
  UndoAvailableChunk,
  ZeroTakeoverConfirmChunk,
  SmartDefaultsAppliedChunk,
} from "./output";

// 零接管模式适配器
export {
  ZeroTakeoverAdapter,
  createZeroTakeoverAdapter,
  zeroTakeoverAdapter,
  type ZeroTakeoverAdapterConfig,
} from "./output";

// ============================================
// 6. 路由组件（高级用例）
// ============================================

export {
  IntentClassifier,
  createIntentClassifier,
  intentClassifier,
  ComplexityEvaluator,
  createComplexityEvaluator,
  ModeSelector,
  createModeSelector,
  IntentRouter,
  createIntentRouter,
  intentRouter,
  // Phase 4: 显式工具路由
  ExplicitToolRouter,
  createExplicitToolRouter,
  explicitToolRouter,
} from "./router";

// ============================================
// 7. 已注册的 Skills（按需导出）
// ============================================

// 知识管理
export { LearningPathSkill } from "./skills/learning-path";
export { ReadingPlannerSkill } from "./skills/reading-planner";

// 数据处理
export { DataExportSkill } from "./skills/data-export";
export { BatchOrganizeSkill } from "./skills/batch-organize";
export { DuplicateCleanupSkill } from "./skills/duplicate-cleanup";
export { SmartTaggingSkill } from "./skills/smart-tagging";

// 分析报告
export { InsightReportSkill } from "./skills/insight-report";
export { PeriodicReportSkill } from "./skills/periodic-report";

// 内容生成
export { QuickDigestSkill } from "./skills/quick-digest";
export { ShareBundleSkill } from "./skills/share-bundle";
export { RelatedDiscoverySkill } from "./skills/related-discovery";

// 工具 Skills
export { SearchSkill } from "./skills/search";
export { ClassifySkill } from "./skills/classify";
export { SummarySkill } from "./skills/summary";

// ============================================
// 8. 可观测性（P1 增强）
// ============================================

export {
  // 追踪
  getAITracer,
  withSkillTracing,
  withUnifiedEngineTracing,
  withRouterTracing,
  withOrchestrationTracing,
  withAsyncGeneratorTracing,
  recordRouteResult,
  recordSkillResult,
  AI_SPAN_PREFIX,
  AI_SPAN_NAMES,
  AI_SPAN_ATTRIBUTES,
  // 指标
  getAIMetrics,
  resetAIMetrics,
  recordSkillExecution,
  recordRoutingResult,
  recordOrchestrationExecution,
  trackActiveSkill,
  trackActiveOrchestration,
  recordCacheAccess,
  AI_METRICS_PREFIX,
  AI_METRIC_NAMES,
  AI_METRIC_LABELS,
} from "./observability";

// ============================================
// 9. 事件发布（P2 增强）
// ============================================

export {
  SkillEventEmitter,
  createSkillEventEmitter,
  AISkillsEvents,
  type SkillEventEmitterConfig,
  type SkillExecutionStartedEvent,
  type SkillExecutionCompletedEvent,
  type SkillStepStartedEvent,
  type SkillStepCompletedEvent,
  type SkillDeliverableCreatedEvent,
  type SkillConfirmationRequestedEvent,
  type SkillConfirmationRespondedEvent,
  type SkillCancelledEvent,
  type AISkillsEventTypes,
} from "./events";
