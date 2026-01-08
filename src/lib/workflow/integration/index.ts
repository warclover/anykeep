/**
 * 工作流 AI 集成模块
 *
 * 将工作流系统与 AI 能力深度集成
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

// 类型导出
export * from "./types";

// 核心组件导出
export {
  WorkflowIntentMatcher,
  getWorkflowIntentMatcher,
} from "./workflow-intent-matcher";

export {
  WorkflowModeExecutor,
  getWorkflowModeExecutor,
  type WorkflowExecutionContext,
} from "./workflow-mode-executor";

export { SkillStepExecutor, getSkillStepExecutor } from "./skill-step-executor";

export {
  SafeExpressionEvaluator,
  getSafeExpressionEvaluator,
  safeEvaluateCondition,
  type ExpressionValidationResult,
} from "./safe-expression-evaluator";

export {
  WorkflowRecommender,
  getWorkflowRecommender,
  recommendWorkflows,
} from "./workflow-recommender";

export {
  WorkflowNotifier,
  getWorkflowNotifier,
  notifyWorkflowCompletion,
} from "./workflow-notifier";

export {
  generateWorkflowCompletionReminder,
  generateWorkflowRecommendationReminder,
  workflowSystemReminders,
  getWorkflowSystemReminders,
  type SystemReminderTrigger,
  type SystemReminderContext,
} from "./workflow-system-reminder";
