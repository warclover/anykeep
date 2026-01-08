/**
 * 工作流 System-Reminder 生成器
 *
 * 生成工作流相关的 System-Reminder
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type {
  WorkflowNotificationContext,
  WorkflowRecommendation,
} from "./types";

/**
 * 生成工作流完成的 System-Reminder
 */
export function generateWorkflowCompletionReminder(
  context: WorkflowNotificationContext,
): string {
  if (context.status === "completed") {
    return `【工作流完成】「${context.workflowName}」已执行完成。${context.summary}`;
  } else if (context.status === "failed") {
    return `【工作流异常】「${context.workflowName}」执行失败：${context.error || "未知错误"}`;
  } else if (context.status === "waiting_confirmation") {
    return `【等待确认】「${context.workflowName}」需要您确认后续操作。${context.summary}`;
  }

  return "";
}

/**
 * 生成工作流推荐的 System-Reminder
 */
export function generateWorkflowRecommendationReminder(
  recommendations: WorkflowRecommendation[],
): string {
  if (recommendations.length === 0) {
    return "";
  }

  const topRecommendation = recommendations[0];

  if (topRecommendation.priority === "high") {
    return `【推荐工作流】${topRecommendation.reason}。您可以说「运行${topRecommendation.workflowName}」来启动。`;
  }

  return "";
}

/**
 * System-Reminder 触发器定义
 */
export interface SystemReminderTrigger {
  id: string;
  triggerId: string;
  priority: number;
  generator: (context: SystemReminderContext) => string | null;
}

/**
 * System-Reminder 上下文
 */
export interface SystemReminderContext {
  /** 工作流完成通知 */
  workflowCompletion?: WorkflowNotificationContext;
  /** 工作流推荐列表 */
  workflowRecommendations?: WorkflowRecommendation[];
}

/**
 * 工作流相关 System-Reminder 触发器
 */
export const workflowSystemReminders: SystemReminderTrigger[] = [
  {
    id: "workflow-completion",
    triggerId: "workflow-completion",
    priority: 95,
    generator: (context: SystemReminderContext) => {
      if (context.workflowCompletion) {
        return generateWorkflowCompletionReminder(context.workflowCompletion);
      }
      return null;
    },
  },
  {
    id: "workflow-recommendation",
    triggerId: "workflow-recommendation",
    priority: 50,
    generator: (context: SystemReminderContext) => {
      if (context.workflowRecommendations) {
        return generateWorkflowRecommendationReminder(
          context.workflowRecommendations,
        );
      }
      return null;
    },
  },
];

/**
 * 获取所有工作流相关的 System-Reminder
 */
export function getWorkflowSystemReminders(
  context: SystemReminderContext,
): Array<{ id: string; priority: number; content: string }> {
  const reminders: Array<{ id: string; priority: number; content: string }> =
    [];

  for (const trigger of workflowSystemReminders) {
    const content = trigger.generator(context);
    if (content) {
      reminders.push({
        id: trigger.id,
        priority: trigger.priority,
        content,
      });
    }
  }

  // 按优先级降序排列
  reminders.sort((a, b) => b.priority - a.priority);

  return reminders;
}
