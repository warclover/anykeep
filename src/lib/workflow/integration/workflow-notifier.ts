/**
 * 工作流通知服务
 *
 * 将工作流执行结果通知到用户
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { WorkflowNotificationContext } from "./types";

/**
 * 工作流通知器
 *
 * 将工作流执行结果通知到用户
 */
export class WorkflowNotifier {
  /**
   * 发送工作流完成通知
   */
  async notify(context: WorkflowNotificationContext): Promise<void> {
    logger.info(
      {
        userId: context.userId,
        workflowId: context.workflowId,
        executionId: context.executionId,
        status: context.status,
      },
      "WorkflowNotifier: Sending notification",
    );

    try {
      // 1. 存储通知记录
      await this.storeNotification(context);

      // 2. 触发实时通知（通过 Supabase Realtime 或 WebSocket）
      await this.triggerRealtimeNotification(context);
    } catch (error) {
      logger.error(
        { error, userId: context.userId, executionId: context.executionId },
        "WorkflowNotifier: Failed to send notification",
      );
    }
  }

  /**
   * 存储通知记录
   */
  private async storeNotification(
    context: WorkflowNotificationContext,
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // 存储通知（notifications 表可能尚未创建，使用类型断言跳过检查）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("notifications").insert({
        user_id: context.userId,
        type: "workflow_completion",
        title: this.generateTitle(context),
        message: context.summary,
        metadata: {
          workflowId: context.workflowId,
          workflowName: context.workflowName,
          executionId: context.executionId,
          status: context.status,
          outputs: context.outputs,
          error: context.error,
        },
        read: false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        // 如果表不存在，仅记录警告而不抛出错误
        logger.warn(
          { error },
          "WorkflowNotifier: Failed to store notification (table may not exist)",
        );
      }
    } catch (error) {
      logger.warn({ error }, "WorkflowNotifier: Failed to store notification");
    }
  }

  /**
   * 触发实时通知
   */
  private async triggerRealtimeNotification(
    context: WorkflowNotificationContext,
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // 通过 Supabase Realtime Broadcast 发送
      const channel = supabase.channel(`user:${context.userId}`);

      await channel.send({
        type: "broadcast",
        event: "workflow_notification",
        payload: {
          workflowId: context.workflowId,
          workflowName: context.workflowName,
          executionId: context.executionId,
          status: context.status,
          summary: context.summary,
          timestamp: new Date().toISOString(),
        },
      });

      // 清理 channel
      await supabase.removeChannel(channel);
    } catch (error) {
      logger.warn(
        { error },
        "WorkflowNotifier: Failed to send realtime notification",
      );
    }
  }

  /**
   * 生成通知标题
   */
  private generateTitle(context: WorkflowNotificationContext): string {
    switch (context.status) {
      case "completed":
        return `「${context.workflowName}」执行完成`;
      case "failed":
        return `「${context.workflowName}」执行失败`;
      case "waiting_confirmation":
        return `「${context.workflowName}」等待确认`;
      default:
        return `「${context.workflowName}」状态更新`;
    }
  }
}

// 单例导出
let notifierInstance: WorkflowNotifier | null = null;

export function getWorkflowNotifier(): WorkflowNotifier {
  if (!notifierInstance) {
    notifierInstance = new WorkflowNotifier();
  }
  return notifierInstance;
}

/**
 * 便捷函数：发送工作流通知
 */
export async function notifyWorkflowCompletion(
  context: WorkflowNotificationContext,
): Promise<void> {
  return getWorkflowNotifier().notify(context);
}
