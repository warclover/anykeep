/**
 * AI Skills 模块导出
 *
 * @version 2.0.0
 * @since 2025-12-22
 * @updated 2025-12-24 - 添加统一智能架构支持
 */

// ============================================
// 核心层（现有）
// ============================================

// 核心类型
export * from "./core/types";

// BaseSkill 和错误类
export {
  BaseSkill,
  SkillValidationError,
  SkillTimeoutError,
  SkillExecutionError,
} from "./core/base-skill";

// SkillRegistry
export {
  SkillRegistry,
  skillRegistry,
  type SkillRegistryStats,
  type SkillMetadataSummary,
} from "./core/skill-registry";

// Skills 集合
export * from "./skills";

// 注册和初始化
export {
  registerDefaultSkills,
  getSkillsAsTools,
  initializeAISkills,
  isSkillsInitialized,
  initializeUnifiedEngine,
  getUnifiedEngine,
  isUnifiedEngineInitialized,
} from "./register";

// ============================================
// 路由层（新增）
// ============================================

export {
  // 类型
  type IntentType,
  type IntentClassification,
  type IntentRule,
  type ComplexityLevel,
  type ComplexityEvaluation,
  type ExecutionMode,
  type ModeSelection,
  type UserRequest,
  type RequestContext,
  type RouteResult,
  // 意图分类器
  IntentClassifier,
  createIntentClassifier,
  intentClassifier,
  // 复杂度评估器
  ComplexityEvaluator,
  createComplexityEvaluator,
  complexityEvaluator,
  // 模式选择器
  ModeSelector,
  createModeSelector,
  modeSelector,
  // 意图路由器
  IntentRouter,
  createIntentRouter,
  intentRouter,
} from "./router";

// ============================================
// 编排层（新增）
// ============================================

export {
  // 类型
  type OrchestrationContext,
  type ConfirmationOptions,
  type ConfirmationResult,
  type Deliverable,
  type StepDefinition,
  type ProgressState,
  type OrchestrationSkillMetadata,
  type OrchestrationResult,
  type IOrchestrationSkill,
  // 编排 Skill 基类
  OrchestrationSkill,
  OrchestrationExecutionError,
  // 进度报告器
  ProgressReporter,
  createProgressReporter,
  createSimpleProgressReporter,
  // 交付物生成器
  DeliverableGenerator,
  createDeliverableGenerator,
  deliverableGenerator,
  type ReportData,
  type ListData,
  type CardData,
} from "./orchestration";

// ============================================
// 输出层（新增）
// ============================================

export {
  // 类型
  type DeliverableType,
  type OutputFormat,
  type ConfirmOption,
  type Suggestion,
  type DeliverableAction,
  type TextChunk,
  type ProgressChunk,
  type ToolCallChunk,
  type ConfirmationChunk,
  type DeliverableChunk,
  type SuggestionsChunk,
  type RoutingChunk,
  type ErrorChunk,
  type FallbackChunk,
  type DoneChunk,
  type UnifiedStreamChunk,
  type OrchestrationStreamChunk,
  // 输出适配器
  UnifiedOutputAdapter,
  createUnifiedOutputAdapter,
  unifiedOutputAdapter,
} from "./output";

// ============================================
// 引擎层（新增）
// ============================================

export {
  // 类型
  type EngineContext,
  type EngineExecuteOptions,
  type EngineExecutionSummary,
  type UnifiedEngineConfig,
  type OrchestrationEngineConfig,
  // 编排引擎
  OrchestrationEngine,
  createOrchestrationEngine,
  orchestrationEngine,
  // 统一引擎
  UnifiedEngine,
  createUnifiedEngine,
  unifiedEngine,
} from "./engine";

// ============================================
// Effect 层（新增）
// ============================================

export {
  // 类型
  type EffectContext,
  type EffectType,
  type Effect,
  type ConfirmationPayload,
  type ConfirmationEffect,
  type ToolConfirmationConfig,
  type SkillConfirmationConfig,
  type NotificationLevel,
  type NotificationPayload,
  type NotificationEffect,
  type AuditAction,
  type AuditPayload,
  type AuditEffect,
  type UnifiedEffect,
  // 确认适配器
  ConfirmationAdapter,
  createConfirmationAdapter,
  createToolConfirmationAdapter,
  createSkillConfirmationAdapter,
} from "./effects";
