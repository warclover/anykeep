/**
 * 定时触发调度器
 *
 * 负责管理和执行定时工作流
 *
 * @version 2.1.0
 * @since 2026-01-08
 * @updated 2026-01-29 - 移除分布式锁，改用状态位原子更新
 * @updated 2026-01-29 - P0-P2 修复：错误处理、超时清理、并发执行、类型安全
 */

import type { Database } from "@/types/supabase";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { runLiteTask } from "@/lib/workflow-lite/core/runner";
import { executeDailyDigest } from "@/lib/workflow-lite/tasks/daily-digest";
import type {
  ScheduleTriggerConfig,
  ScheduledExecution,
  ScheduledExecutionStatus,
} from "./types";

// 定时执行表名
const SCHEDULED_EXECUTIONS_TABLE = "scheduled_workflow_executions" as const;

// 默认超时时间（分钟）
const DEFAULT_STALE_TIMEOUT_MINUTES = 30;

// 默认并发数
const DEFAULT_CONCURRENCY = 5;

// 扩展 Supabase 客户端类型
interface ScheduledExecutionRow {
  id: string;
  workflow_id: string;
  user_id: string;
  scheduled_at: string;
  status: ScheduledExecutionStatus;
  execution_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  cancelled_at?: string | null;
}

interface ScheduledExecutionsTableDef {
  Row: ScheduledExecutionRow;
  Insert: Omit<
    ScheduledExecutionRow,
    | "id"
    | "execution_id"
    | "started_at"
    | "completed_at"
    | "error"
    | "cancelled_at"
  > & {
    id?: string;
    execution_id?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    error?: string | null;
    cancelled_at?: string | null;
  };
  Update: Partial<ScheduledExecutionRow>;
  Relationships: [];
}

type _ExtendedDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      scheduled_workflow_executions: ScheduledExecutionsTableDef;
    };
  };
};

// 类型安全的 Supabase 客户端（使用类型断言绕过扩展表类型检查）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TypedSupabaseClient = any;

/**
 * 定时触发调度器
 *
 * 负责管理和执行定时工作流（基于 Workflow Lite）
 */
export class TriggerScheduler {
  /**
   * 获取类型安全的 Supabase 客户端
   */
  private async getTypedClient(): Promise<TypedSupabaseClient> {
    const supabase = await createClient();
    return supabase as unknown as TypedSupabaseClient;
  }

  /**
   * 获取待执行的定时任务
   */
  async getPendingExecutions(): Promise<ScheduledExecution[]> {
    const client = await this.getTypedClient();
    const now = new Date();

    const { data, error } = await client
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

    return (data || []).map((row: ScheduledExecutionRow) =>
      this.mapRowToExecution(row),
    );
  }

  /**
   * 清理超时的 running 任务
   *
   * 用于处理实例崩溃导致任务卡在 running 状态的情况
   *
   * @param timeoutMinutes - 超时阈值（分钟），默认 30 分钟
   * @returns 清理的任务数量
   */
  async cleanupStaleRunningTasks(
    timeoutMinutes: number = DEFAULT_STALE_TIMEOUT_MINUTES,
  ): Promise<number> {
    const client = await this.getTypedClient();
    const timeoutThreshold = new Date(
      Date.now() - timeoutMinutes * 60 * 1000,
    ).toISOString();

    const { data, error } = await client
      .from(SCHEDULED_EXECUTIONS_TABLE)
      .update({
        status: "failed",
        error: `Task timeout after ${timeoutMinutes} minutes (possible instance crash)`,
        completed_at: new Date().toISOString(),
      })
      .eq("status", "running")
      .lt("started_at", timeoutThreshold)
      .select("id");

    if (error) {
      logger.error(
        { error },
        "TriggerScheduler: Failed to cleanup stale tasks",
      );
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      logger.warn(
        { count, timeoutMinutes },
        "TriggerScheduler: Cleaned up stale running tasks",
      );
    }

    return count;
  }

  /**
   * 执行定时任务（使用状态位原子更新防止重复执行）
   *
   * 通过 UPDATE ... WHERE status = 'pending' 实现原子性抢占，
   * 无需额外的分布式锁机制
   */
  async executeScheduledWorkflow(
    scheduled: ScheduledExecution,
  ): Promise<{ success: boolean; error?: string }> {
    const client = await this.getTypedClient();
    const startTime = Date.now();

    try {
      // 原子性抢占：UPDATE ... WHERE status = 'pending'
      // 使用 maybeSingle() 区分"无匹配记录"和"数据库错误"
      const { data: claimed, error: claimError } = await client
        .from(SCHEDULED_EXECUTIONS_TABLE)
        .update({
          status: "running",
          started_at: new Date().toISOString(),
        })
        .eq("id", scheduled.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      // P0 修复：区分真实数据库错误和任务已被抢占
      if (claimError) {
        // 真实的数据库错误
        logger.error(
          {
            scheduledId: scheduled.id,
            error: claimError.message,
            code: claimError.code,
          },
          "TriggerScheduler: Database error during task claim",
        );
        return { success: false, error: claimError.message };
      }

      if (!claimed) {
        // 任务已被其他实例抢占（正常竞争情况）
        logger.debug(
          { scheduledId: scheduled.id },
          "TriggerScheduler: Task already claimed by another instance",
        );
        return { success: true }; // 不算失败，只是被跳过
      }

      // =================================================================
      // Workflow Lite 执行
      // =================================================================
      if (scheduled.workflowId === "daily_digest") {
        logger.info(
          { scheduledId: scheduled.id },
          "TriggerScheduler: Executing Lite workflow for daily_digest",
        );

        const liteResult = await runLiteTask(
          "daily-digest",
          `cron-${scheduled.id}`,
          executeDailyDigest,
          { userId: scheduled.userId },
        );

        if (!liteResult.success) {
          throw (
            liteResult.error ||
            new Error("Lite task failed without error details")
          );
        }

        // P0 修复：检查状态更新是否成功
        const { error: completeError } = await client
          .from(SCHEDULED_EXECUTIONS_TABLE)
          .update({
            status: "completed",
            execution_id: `lite-${scheduled.id}`,
            completed_at: new Date().toISOString(),
          })
          .eq("id", scheduled.id);

        if (completeError) {
          logger.error(
            { scheduledId: scheduled.id, error: completeError },
            "TriggerScheduler: Failed to mark task as completed (status inconsistent!)",
          );
          return { success: false, error: completeError.message };
        }

        logger.info(
          {
            scheduledId: scheduled.id,
            durationMs: liteResult.durationMs,
            metric: "workflow.execution.success",
          },
          "TriggerScheduler: Lite workflow completed successfully",
        );

        return { success: true };
      }
      // =================================================================

      // 对于其他工作流，抛出错误（需要逐个迁移到 Lite）
      throw new Error(
        `Workflow '${scheduled.workflowId}' has not been migrated to Lite system yet`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // P0 修复：检查失败状态更新是否成功
      const { error: updateError } = await client
        .from(SCHEDULED_EXECUTIONS_TABLE)
        .update({
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", scheduled.id);

      if (updateError) {
        logger.error(
          { scheduledId: scheduled.id, error: updateError },
          "TriggerScheduler: Failed to mark task as failed (status inconsistent!)",
        );
      }

      logger.error(
        {
          scheduledId: scheduled.id,
          workflowId: scheduled.workflowId,
          durationMs: Date.now() - startTime,
          error: errorMessage,
          metric: "workflow.execution.failure",
        },
        "TriggerScheduler: Scheduled workflow failed",
      );

      return { success: false, error: errorMessage };
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

    const client = await this.getTypedClient();

    const { data, error } = await client
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
   *
   * P2 修复：正确处理月份边界条件（如 2 月没有 31 日）
   */
  calculateNextExecutionTime(config: ScheduleTriggerConfig): Date | null {
    if (!config.enabled) {
      return null;
    }

    const now = new Date();
    const [hours, minutes] = config.time.split(":").map(Number);

    // 使用简化的时区处理（服务器本地时区）
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

        // P2 修复：获取当前月份的最后一天
        const lastDayOfCurrentMonth = this.getLastDayOfMonth(
          targetDate.getFullYear(),
          targetDate.getMonth(),
        );

        // 如果指定日期超过当月天数，使用当月最后一天
        const actualDay = Math.min(targetDayOfMonth, lastDayOfCurrentMonth);
        targetDate.setDate(actualDay);

        if (targetDate <= now) {
          // 移到下个月
          targetDate.setMonth(targetDate.getMonth() + 1);

          // 再次校验下个月的天数
          const lastDayOfNextMonth = this.getLastDayOfMonth(
            targetDate.getFullYear(),
            targetDate.getMonth(),
          );
          targetDate.setDate(Math.min(targetDayOfMonth, lastDayOfNextMonth));
        }
        break;
      }
    }

    return targetDate;
  }

  /**
   * 获取指定月份的最后一天
   */
  private getLastDayOfMonth(year: number, month: number): number {
    // 下个月的第 0 天 = 当前月的最后一天
    return new Date(year, month + 1, 0).getDate();
  }

  /**
   * 获取用户的定时任务列表
   */
  async getUserSchedules(userId: string): Promise<ScheduledExecution[]> {
    const client = await this.getTypedClient();

    const { data, error } = await client
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

    return (data || []).map((row: ScheduledExecutionRow) =>
      this.mapRowToExecution(row),
    );
  }

  /**
   * 取消定时任务
   */
  async cancelSchedule(scheduleId: string, userId: string): Promise<boolean> {
    const client = await this.getTypedClient();

    const { error } = await client
      .from(SCHEDULED_EXECUTIONS_TABLE)
      .update({
        status: "skipped",
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
   *
   * P1 修复：
   * - 先清理超时任务
   * - 使用并发执行提升性能
   *
   * @param concurrency - 并发数，默认 5
   */
  async processPendingExecutions(
    concurrency: number = DEFAULT_CONCURRENCY,
  ): Promise<{ total: number; successful: number; failed: number }> {
    // 先清理超时的 running 任务
    await this.cleanupStaleRunningTasks();

    const pending = await this.getPendingExecutions();

    if (pending.length === 0) {
      return { total: 0, successful: 0, failed: 0 };
    }

    // P1 修复：分批并发执行
    const results: { success: boolean; error?: string }[] = [];

    for (let i = 0; i < pending.length; i += concurrency) {
      const batch = pending.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((scheduled) => this.executeScheduledWorkflow(scheduled)),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({ success: false, error: result.reason?.message });
        }
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info(
      { total: pending.length, successful, failed },
      "TriggerScheduler: Batch execution completed",
    );

    return { total: pending.length, successful, failed };
  }

  /**
   * 映射数据库行到执行对象
   */
  private mapRowToExecution(row: ScheduledExecutionRow): ScheduledExecution {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      userId: row.user_id,
      scheduledAt: new Date(row.scheduled_at),
      status: row.status,
      executionId: row.execution_id ?? undefined,
      error: row.error ?? undefined,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
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
