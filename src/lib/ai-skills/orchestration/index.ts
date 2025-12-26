/**
 * 编排能力模块导出
 *
 * @module ai-skills/orchestration
 * @version 1.1.0
 * @since 2025-12-24
 * @updated 2025-12-26 - 添加取消令牌支持
 */

// 类型导出
export type {
  // 取消令牌
  CancellationToken,
  // 上下文
  OrchestrationContext,
  // 确认相关
  ConfirmationOptions,
  // 交付物相关
  DeliverableConfig,
  Deliverable,
  // 进度相关
  StepDefinition,
  ProgressState,
  // 元数据
  OrchestrationSkillMetadata,
  // 执行结果
  OrchestrationResult,
  // 工具调用
  ToolContext,
  ToolResult,
  // 接口
  IOrchestrationSkill,
} from "./types";

// 取消错误
export { CancellationError } from "./types";

// 取消令牌
export {
  CancellationTokenSource,
  NullCancellationToken,
  checkCancellation,
  throwIfCancelled,
} from "./cancellation-token";

// 编排 Skill 基类
export {
  OrchestrationSkill,
  OrchestrationExecutionError,
} from "./orchestration-skill";

// 进度报告器
export {
  ProgressReporter,
  createProgressReporter,
  createSimpleProgressReporter,
} from "./progress-reporter";

// 交付物生成器
export {
  DeliverableGenerator,
  createDeliverableGenerator,
  deliverableGenerator,
  type ReportData,
  type ListData,
  type CardData,
} from "./deliverable-generator";

// 确认处理器
export {
  ConfirmationHandler,
  createConfirmationHandler,
  confirmationHandler,
  type PendingConfirmation,
  type ConfirmationRequestOptions,
  type ConfirmationResult,
  type ConfirmationStatus,
  type ConfirmationHandlerConfig,
} from "./confirmation-handler";

// 后端确认适配器（Skills 专用）
export {
  BackendConfirmationAdapter,
  createBackendConfirmationAdapter,
  backendConfirmationAdapter,
  type OperationType,
  type RiskLevel,
  type ConfirmationDecisionInput,
  type ConfirmationDecision,
  type AutoConfirmPolicy,
} from "./backend-confirmation-adapter";
