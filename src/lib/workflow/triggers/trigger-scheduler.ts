/**
 * 定时触发调度器
 *
 * 负责管理和执行定时工作流
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "../orchestrator";
import { getDistributedLockManager } from "./distributed-lock";
import { logger } from "@/lib/logger";
import type {
  ScheduleTriggerConfig,
  ScheduledExecution,
  ScheduledExecutionStatus,
} from "./types";

// 定时执行表名（在数据库迁移后才存在，使用类型断言绕过检查）
const SCHEDULED_EXECUTIONS_TABLE = "scheduled_workflow_executions" as const;

/**
 * 定时触发调度器
 *
 * 负责管理和执行定时工作流
 */
export class TriggerScheduler {
  private orchestrator = getWorkflowOrchestrator();

  /**
   * 获取待执行的定时任务
   */
  async getPendingExecutions(): Promise<ScheduledExecution[]> {
    const supabase = await createClient();
    const now = new Date();

    // 使用类型断言绕过 Supabase 类型检查（表在迁移后才存在）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(SCHEDULED_EXECUTIONS_TABLE)
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(100);

    if (error) {
      logger.error(
        { error },
        "TriggerScheduler: Failed to get pending executions",
      );
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) =>
      this.mapRowToExecution(row),
    );
  }

  /**
   * 执行定时任务（带分布式锁）
   */
  async executeScheduledWorkflow(scheduled: ScheduledExecution): Promise<void> {
    const lockManager = getDistributedLockManager();
    const lockKey = `scheduled:${scheduled.id}`;

    const result = await lockManager.withLock(lockKey, async () => {
      const supabase = await createClient();
      const startTime = performance.now();

      try {
        // 双重检查：确认任务仍为 pending 状态
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentStatus } = await (supabase as any)
          .from(SCHEDULED_EXECUTIONS_TABLE)
          .select("status")
          .eq("id", scheduled.id)
          .single();

        if (currentStatus?.status !== "pending") {
          logger.info(
            {
              scheduledId: scheduled.id,
              currentStatus: currentStatus?.status,
            },
            "TriggerScheduler: Task already processed by another instance",
          );
          return { skipped: true };
        }

        // 更新状态为运行中
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from(SCHEDULED_EXECUTIONS_TABLE)
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", scheduled.id);

        // 启动工作流
        const execution = await this.orchestrator.startWorkflow(
          scheduled.workflowId,
          scheduled.userId,
          {
            triggerType: "schedule",
            triggerContext: {
              scheduledExecutionId: scheduled.id,
              scheduledAt: scheduled.scheduledAt.toISOString(),
            },
          },
        );

        // 更新执行 ID
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from(SCHEDULED_EXECUTIONS_TABLE)
          .update({
            status: "completed" as ScheduledExecutionStatus,
            execution_id: execution.id,
            completed_at: new Date().toISOString(),
          })
          .eq("id", scheduled.id);

        logger.info(
          {
            scheduledId: scheduled.id,
            workflowId: scheduled.workflowId,
            executionId: execution.id,
            durationMs: Math.round(performance.now() - startTime),
          },
          "TriggerScheduler: Scheduled workflow started",
        );

        return { success: true, executionId: execution.id };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from(SCHEDULED_EXECUTIONS_TABLE)
          .update({
            status: "failed" as ScheduledExecutionStatus,
            error: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", scheduled.id);

        logger.error(
          {
            scheduledId: scheduled.id,
            workflowId: scheduled.workflowId,
            error: errorMessage,
          },
          "TriggerScheduler: Scheduled workflow failed",
        );

        return { success: false, error: errorMessage };
      }
    });

    if (result === null) {
      // 未获取到锁，任务被跳过
      logger.info(
        { scheduledId: scheduled.id },
        "TriggerScheduler: Task skipped (lock not acquired)",
      );
    }
  }

  /**
   * 创建下一次定时执行
   */
  async scheduleNextExecution(
    workflowId: string,
    userId: string,
    config: ScheduleTriggerConfig,
  ): Promise<ScheduledExecution | null> {
    const nextExecutionTime = this.calculateNextExecutionTime(config);

    if (!nextExecutionTime) {
      return null;
    }

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(SCHEDULED_EXECUTIONS_TABLE)
      .insert({
        workflow_id: workflowId,
        user_id: userId,
        scheduled_at: nextExecutionTime.toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      logger.error(
        { error, workflowId, userId },
        "TriggerScheduler: Failed to schedule next execution",
      );
      return null;
    }

    return this.mapRowToExecution(data);
  }

  /**
   * 计算下一次执行时间
   */
  calculateNextExecutionTime(config: ScheduleTriggerConfig): Date | null {
    if (!config.enabled) {
      return null;
    }

    const now = new Date();
    const [hours, minutes] = config.time.split(":").map(Number);

    // 使用简化的时区处理
    const targetDate = new Date();
    targetDate.setHours(hours, minutes, 0, 0);

    switch (config.frequency) {
      case "daily":
        // 如果今天的时间已过，设为明天
        if (targetDate <= now) {
          targetDate.setDate(targetDate.getDate() + 1);
        }
        break;

      case "weekly": {
        const targetDay = config.dayOfWeek ?? 0;
        const currentDay = now.getDay();
        let daysUntilTarget = targetDay - currentDay;

        if (
          daysUntilTarget < 0 ||
          (daysUntilTarget === 0 && targetDate <= now)
        ) {
          daysUntilTarget += 7;
        }

        targetDate.setDate(now.getDate() + daysUntilTarget);
        break;
      }

      case "monthly": {
        const targetDayOfMonth = config.dayOfMonth ?? 1;
        targetDate.setDate(targetDayOfMonth);

        if (targetDate <= now) {
          targetDate.setMonth(targetDate.getMonth() + 1);
        }
        break;
      }
    }

    return targetDate;
  }

  /**
   * 获取用户的定时任务列表
   */
  async getUserSchedules(userId: string): Promise<ScheduledExecution[]> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(SCHEDULED_EXECUTIONS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "running"])
      .order("scheduled_at", { ascending: true });

    if (error) {
      logger.error(
        { error, userId },
        "TriggerScheduler: Failed to get user schedules",
      );
      return [];
    }

    return (data || []).map((row: Record<string, unknown>) =>
      this.mapRowToExecution(row),
    );
  }

  /**
   * 取消定时任务
   */
  async cancelSchedule(scheduleId: string, userId: string): Promise<boolean> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(SCHEDULED_EXECUTIONS_TABLE)
      .update({
        status: "skipped" as ScheduledExecutionStatus,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", scheduleId)
      .eq("user_id", userId)
      .eq("status", "pending");

    if (error) {
      logger.error(
        { error, scheduleId },
        "TriggerScheduler: Failed to cancel schedule",
      );
      return false;
    }

    return true;
  }

  /**
   * 处理所有待执行的定时任务
   */
  async processPendingExecutions(): Promise<number> {
    const pending = await this.getPendingExecutions();
    let processed = 0;

    for (const scheduled of pending) {
      await this.executeScheduledWorkflow(scheduled);
      processed++;
    }

    return processed;
  }

  /**
   * 映射数据库行到执行对象
   */
  private mapRowToExecution(row: Record<string, unknown>): ScheduledExecution {
    return {
      id: row.id as string,
      workflowId: row.workflow_id as string,
      userId: row.user_id as string,
      scheduledAt: new Date(row.scheduled_at as string),
      status: row.status as ScheduledExecutionStatus,
      executionId: row.execution_id as string | undefined,
      error: row.error as string | undefined,
      startedAt: row.started_at
        ? new Date(row.started_at as string)
        : undefined,
      completedAt: row.completed_at
        ? new Date(row.completed_at as string)
        : undefined,
    };
  }
}

// 单例导出
let schedulerInstance: TriggerScheduler | null = null;

export function getTriggerScheduler(): TriggerScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new TriggerScheduler();
  }
  return schedulerInstance;
}
