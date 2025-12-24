/**
 * 编排能力模块导出
 *
 * @module ai-skills/orchestration
 * @version 1.0.0
 * @since 2025-12-24
 */

// 类型导出
export type {
  // 上下文
  OrchestrationContext,
  // 确认相关
  ConfirmationOptions,
  ConfirmationResult,
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
