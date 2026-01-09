# AnyKeep 工作流系统 - Phase 4: 扩展工作流方案

> **版本**: v1.1.0
> **日期**: 2025-01-08
> **状态**: 待审核
> **依赖**: Phase 1 (核心引擎 v1.1.0), Phase 2 (前端集成 v1.1.0), Phase 3 (AI 集成 v1.1.0)
> **预估工期**: 6-9 天
> **更新**: v1.1.0 - 添加分布式锁防止定时任务重复执行、使用 SafeExpressionEvaluator 替代 new Function、调整时间线

---

## 1. 范围定义

### 1.1 Phase 4 目标

实现完整的工作流扩展能力：

- 预设工作流：实现 P0/P1 优先级的 6 个核心工作流
- 定时触发：支持日/周/月周期性自动执行
- 事件触发：支持基于特定事件（导入完成、书签新增等）自动触发
- 工作流模板：提供可复用的工作流模板系统

### 1.2 实现范围

基于 workflow0108.md Section 7 的优先级排序：

| 优先级 | 工作流 ID             | 名称           | 本阶段实现          |
| ------ | --------------------- | -------------- | ------------------- |
| P0     | `new_user_onboarding` | 新用户导入整理 | ✅                  |
| P0     | `bookmark_health`     | 书签健康巡检   | ✅ (Phase 1 已验证) |
| P1     | `topic_deep_dive`     | 主题深挖       | ✅                  |
| P1     | `periodic_backup`     | 定期备份       | ✅                  |
| P1     | `daily_digest`        | 每日精选推送   | ✅                  |
| P2     | `folder_cleanup`      | 文件夹清理     | ✅                  |

### 1.3 不在本阶段范围

- 自定义工作流可视化编辑器 (Phase 5)
- 复杂的条件分支编排 (Phase 5)
- 团队协作工作流 (Phase 5)

---

## 2. 定时触发调度器

### 2.1 架构设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                      TriggerScheduler                                │
│  (定时触发调度器 - 基于 Supabase pg_cron 或 Edge Function Cron)     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ DailyTrigger │     │ WeeklyTrigger│     │ MonthlyTrigger│
  │ (每日触发)   │     │ (每周触发)   │     │ (每月触发)   │
  └──────────────┘     └──────────────┘     └──────────────┘
         │                      │                      │
         └──────────────────────┴──────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   WorkflowOrchestrator │
                    │   (启动工作流执行)     │
                    └───────────────────────┘
```

### 2.2 类型定义

```typescript
// src/lib/workflow/triggers/types.ts

export type TriggerType = "manual" | "conversation" | "scheduled" | "event";

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export interface ScheduleTriggerConfig {
  /** 调度频率 */
  frequency: ScheduleFrequency;
  /** 执行时间（HH:mm 格式） */
  time: string;
  /** 周几执行（仅 weekly 有效，0-6，0=周日） */
  dayOfWeek?: number;
  /** 每月几号执行（仅 monthly 有效，1-31） */
  dayOfMonth?: number;
  /** 时区 */
  timezone?: string;
  /** 是否启用 */
  enabled: boolean;
}

export interface ScheduledExecution {
  id: string;
  workflowId: string;
  userId: string;
  scheduledAt: Date;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  executionId?: string;
  error?: string;
}

export interface TriggerDefinition {
  type: TriggerType;
  config?:
    | ScheduleTriggerConfig
    | EventTriggerConfig
    | ConversationTriggerConfig;
}
```

### 2.3 TriggerScheduler 实现

```typescript
// src/lib/workflow/triggers/trigger-scheduler.ts

import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "../orchestrator";
import { logger } from "@/lib/logger";
import type { ScheduleTriggerConfig, ScheduledExecution } from "./types";

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

    const { data, error } = await supabase
      .from("scheduled_workflow_executions")
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

    return (data || []).map((row) => ({
      id: row.id,
      workflowId: row.workflow_id,
      userId: row.user_id,
      scheduledAt: new Date(row.scheduled_at),
      status: row.status,
      executionId: row.execution_id,
      error: row.error,
    }));
  }

  /**
   * 执行定时任务
   */
  async executeScheduledWorkflow(scheduled: ScheduledExecution): Promise<void> {
    const supabase = await createClient();
    const startTime = performance.now();

    try {
      // 更新状态为运行中
      await supabase
        .from("scheduled_workflow_executions")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", scheduled.id);

      // 启动工作流
      const execution = await this.orchestrator.startWorkflow(
        scheduled.workflowId,
        scheduled.userId,
        "scheduled",
        {
          scheduledExecutionId: scheduled.id,
          scheduledAt: scheduled.scheduledAt.toISOString(),
        },
      );

      // 更新执行 ID
      await supabase
        .from("scheduled_workflow_executions")
        .update({
          status: "completed",
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await supabase
        .from("scheduled_workflow_executions")
        .update({
          status: "failed",
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

    const { data, error } = await supabase
      .from("scheduled_workflow_executions")
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

    return {
      id: data.id,
      workflowId: data.workflow_id,
      userId: data.user_id,
      scheduledAt: new Date(data.scheduled_at),
      status: data.status,
    };
  }

  /**
   * 计算下一次执行时间
   */
  private calculateNextExecutionTime(
    config: ScheduleTriggerConfig,
  ): Date | null {
    if (!config.enabled) {
      return null;
    }

    const now = new Date();
    const [hours, minutes] = config.time.split(":").map(Number);
    const timezone = config.timezone || "Asia/Shanghai";

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

      case "weekly":
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

      case "monthly":
        const targetDayOfMonth = config.dayOfMonth ?? 1;
        targetDate.setDate(targetDayOfMonth);

        if (targetDate <= now) {
          targetDate.setMonth(targetDate.getMonth() + 1);
        }
        break;
    }

    return targetDate;
  }

  /**
   * 获取用户的定时任务列表
   */
  async getUserSchedules(userId: string): Promise<ScheduledExecution[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("scheduled_workflow_executions")
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

    return (data || []).map((row) => ({
      id: row.id,
      workflowId: row.workflow_id,
      userId: row.user_id,
      scheduledAt: new Date(row.scheduled_at),
      status: row.status,
      executionId: row.execution_id,
      error: row.error,
    }));
  }

  /**
   * 取消定时任务
   */
  async cancelSchedule(scheduleId: string, userId: string): Promise<boolean> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("scheduled_workflow_executions")
      .update({ status: "skipped", cancelled_at: new Date().toISOString() })
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
}

// 单例导出
let schedulerInstance: TriggerScheduler | null = null;

export function getTriggerScheduler(): TriggerScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new TriggerScheduler();
  }
  return schedulerInstance;
}
```

### 2.4 定时任务数据库迁移

```sql
-- supabase/migrations/20250108000002_add_scheduled_executions.sql

-- 定时执行记录表
CREATE TABLE IF NOT EXISTS scheduled_workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  execution_id UUID REFERENCES workflow_executions(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_scheduled_executions_user ON scheduled_workflow_executions(user_id);
CREATE INDEX idx_scheduled_executions_status ON scheduled_workflow_executions(status);
CREATE INDEX idx_scheduled_executions_scheduled_at ON scheduled_workflow_executions(scheduled_at);
CREATE INDEX idx_scheduled_executions_pending ON scheduled_workflow_executions(status, scheduled_at)
  WHERE status = 'pending';

-- RLS
ALTER TABLE scheduled_workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled executions"
  ON scheduled_workflow_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scheduled executions"
  ON scheduled_workflow_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled executions"
  ON scheduled_workflow_executions FOR UPDATE
  USING (auth.uid() = user_id);

-- 定时任务处理函数（供 pg_cron 或 Edge Function 调用）
CREATE OR REPLACE FUNCTION process_pending_scheduled_executions()
RETURNS INTEGER AS $$
DECLARE
  processed_count INTEGER := 0;
  pending_record RECORD;
BEGIN
  FOR pending_record IN
    SELECT id, workflow_id, user_id
    FROM scheduled_workflow_executions
    WHERE status = 'pending'
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 标记为运行中
    UPDATE scheduled_workflow_executions
    SET status = 'running', started_at = NOW()
    WHERE id = pending_record.id;

    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;
```

### 2.6 分布式锁机制

在多实例部署环境中，需要防止定时任务被重复执行。

```typescript
// src/lib/workflow/triggers/distributed-lock.ts

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * 分布式锁配置
 */
export interface DistributedLockConfig {
  /** 锁过期时间（毫秒） */
  ttlMs: number;
  /** 重试次数 */
  maxRetries: number;
  /** 重试间隔（毫秒） */
  retryIntervalMs: number;
}

const DEFAULT_CONFIG: DistributedLockConfig = {
  ttlMs: 60000, // 1 分钟
  maxRetries: 3,
  retryIntervalMs: 100,
};

/**
 * 分布式锁管理器
 *
 * 使用 PostgreSQL advisory lock 或 Redis 实现分布式锁，
 * 防止多实例环境下定时任务重复执行
 */
export class DistributedLockManager {
  /**
   * 尝试获取锁
   *
   * @param lockKey 锁标识
   * @param config 锁配置
   * @returns 是否获取成功
   */
  async tryAcquire(
    lockKey: string,
    config: Partial<DistributedLockConfig> = {},
  ): Promise<boolean> {
    const { ttlMs, maxRetries, retryIntervalMs } = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    const supabase = await createClient();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 使用 PostgreSQL 的 pg_try_advisory_lock
        // 将 lockKey 转换为 bigint（使用哈希）
        const lockId = this.hashKey(lockKey);

        const { data, error } = await supabase.rpc(
          "try_acquire_workflow_lock",
          {
            lock_id: lockId,
            lock_key: lockKey,
            ttl_ms: ttlMs,
          },
        );

        if (error) {
          logger.warn(
            { error, lockKey, attempt },
            "DistributedLock: Failed to acquire lock",
          );
          await this.sleep(retryIntervalMs);
          continue;
        }

        if (data) {
          logger.debug({ lockKey, lockId }, "DistributedLock: Lock acquired");
          return true;
        }

        // 锁已被其他实例持有
        logger.debug(
          { lockKey, attempt },
          "DistributedLock: Lock held by another instance",
        );
        await this.sleep(retryIntervalMs);
      } catch (error) {
        logger.error(
          { error, lockKey, attempt },
          "DistributedLock: Unexpected error",
        );
        await this.sleep(retryIntervalMs);
      }
    }

    return false;
  }

  /**
   * 释放锁
   */
  async release(lockKey: string): Promise<void> {
    const supabase = await createClient();
    const lockId = this.hashKey(lockKey);

    try {
      await supabase.rpc("release_workflow_lock", {
        lock_id: lockId,
        lock_key: lockKey,
      });

      logger.debug({ lockKey, lockId }, "DistributedLock: Lock released");
    } catch (error) {
      logger.error(
        { error, lockKey },
        "DistributedLock: Failed to release lock",
      );
    }
  }

  /**
   * 执行带锁的操作
   */
  async withLock<T>(
    lockKey: string,
    operation: () => Promise<T>,
    config?: Partial<DistributedLockConfig>,
  ): Promise<T | null> {
    const acquired = await this.tryAcquire(lockKey, config);

    if (!acquired) {
      logger.warn(
        { lockKey },
        "DistributedLock: Could not acquire lock, skipping operation",
      );
      return null;
    }

    try {
      return await operation();
    } finally {
      await this.release(lockKey);
    }
  }

  /**
   * 生成锁键的哈希值
   */
  private hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 单例导出
let lockManagerInstance: DistributedLockManager | null = null;

export function getDistributedLockManager(): DistributedLockManager {
  if (!lockManagerInstance) {
    lockManagerInstance = new DistributedLockManager();
  }
  return lockManagerInstance;
}
```

### 2.7 分布式锁数据库函数

```sql
-- supabase/migrations/20250108000004_add_workflow_locks.sql

-- 工作流锁表
CREATE TABLE IF NOT EXISTS workflow_locks (
  lock_key TEXT PRIMARY KEY,
  lock_id BIGINT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  instance_id TEXT
);

-- 索引
CREATE INDEX idx_workflow_locks_expires ON workflow_locks(expires_at);

-- 尝试获取锁
CREATE OR REPLACE FUNCTION try_acquire_workflow_lock(
  p_lock_id BIGINT,
  p_lock_key TEXT,
  p_ttl_ms INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_instance_id TEXT;
BEGIN
  v_expires_at := NOW() + (p_ttl_ms || ' milliseconds')::INTERVAL;
  v_instance_id := gen_random_uuid()::TEXT;

  -- 清理过期锁
  DELETE FROM workflow_locks WHERE expires_at < NOW();

  -- 尝试插入新锁
  BEGIN
    INSERT INTO workflow_locks (lock_key, lock_id, acquired_at, expires_at, instance_id)
    VALUES (p_lock_key, p_lock_id, NOW(), v_expires_at, v_instance_id);
    RETURN TRUE;
  EXCEPTION WHEN unique_violation THEN
    -- 锁已存在且未过期
    RETURN FALSE;
  END;
END;
$$ LANGUAGE plpgsql;

-- 释放锁
CREATE OR REPLACE FUNCTION release_workflow_lock(
  p_lock_id BIGINT,
  p_lock_key TEXT
)
RETURNS VOID AS $$
BEGIN
  DELETE FROM workflow_locks WHERE lock_key = p_lock_key;
END;
$$ LANGUAGE plpgsql;
```

### 2.8 TriggerScheduler 集成分布式锁

```typescript
// 更新 TriggerScheduler.executeScheduledWorkflow 方法

import { getDistributedLockManager } from "./distributed-lock";

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
      const { data: currentStatus } = await supabase
        .from("scheduled_workflow_executions")
        .select("status")
        .eq("id", scheduled.id)
        .single();

      if (currentStatus?.status !== "pending") {
        logger.info(
          { scheduledId: scheduled.id, currentStatus: currentStatus?.status },
          "TriggerScheduler: Task already processed by another instance"
        );
        return { skipped: true };
      }

      // 更新状态为运行中
      await supabase
        .from("scheduled_workflow_executions")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", scheduled.id);

      // 启动工作流
      const execution = await this.orchestrator.startWorkflow(
        scheduled.workflowId,
        scheduled.userId,
        "scheduled",
        {
          scheduledExecutionId: scheduled.id,
          scheduledAt: scheduled.scheduledAt.toISOString(),
        }
      );

      // 更新执行 ID
      await supabase
        .from("scheduled_workflow_executions")
        .update({
          status: "completed",
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
        "TriggerScheduler: Scheduled workflow started"
      );

      return { success: true, executionId: execution.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await supabase
        .from("scheduled_workflow_executions")
        .update({
          status: "failed",
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
        "TriggerScheduler: Scheduled workflow failed"
      );

      return { success: false, error: errorMessage };
    }
  });

  if (result === null) {
    // 未获取到锁，任务被跳过
    logger.info(
      { scheduledId: scheduled.id },
      "TriggerScheduler: Task skipped (lock not acquired)"
    );
  }
}
```

### 2.9 Edge Function 定时任务处理器

```typescript
// supabase/functions/workflow-scheduler/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 获取待执行的定时任务
    const { data: pendingTasks, error } = await supabase
      .from("scheduled_workflow_executions")
      .select("id, workflow_id, user_id")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(20);

    if (error) {
      throw error;
    }

    const results = [];

    for (const task of pendingTasks || []) {
      try {
        // 调用工作流启动 API
        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/workflow-start`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              workflowId: task.workflow_id,
              userId: task.user_id,
              triggerType: "scheduled",
              triggerContext: {
                scheduledExecutionId: task.id,
              },
            }),
          },
        );

        const result = await response.json();

        // 更新执行状态
        await supabase
          .from("scheduled_workflow_executions")
          .update({
            status: response.ok ? "completed" : "failed",
            execution_id: result.executionId,
            completed_at: new Date().toISOString(),
            error: response.ok ? null : result.error,
          })
          .eq("id", task.id);

        results.push({ id: task.id, success: response.ok });
      } catch (taskError) {
        await supabase
          .from("scheduled_workflow_executions")
          .update({
            status: "failed",
            error: String(taskError),
            completed_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        results.push({ id: task.id, success: false, error: String(taskError) });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## 3. 事件触发器

### 3.1 类型定义

```typescript
// src/lib/workflow/triggers/event-trigger-types.ts

export type EventType =
  | "bookmark_created"
  | "bookmark_batch_imported"
  | "browser_bookmark_import_completed"
  | "folder_created"
  | "tag_added"
  | "bookmark_count_threshold"
  | "untagged_count_threshold";

export interface EventTriggerConfig {
  /** 事件类型 */
  eventType: EventType;
  /** 触发条件 */
  condition?: string;
  /** 参数映射 */
  paramMapping?: Record<string, string>;
  /** 去重时间窗口（毫秒） */
  debounceMs?: number;
  /** 是否启用 */
  enabled: boolean;
}

export interface WorkflowEvent {
  type: EventType;
  userId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}
```

### 3.2 EventTriggerManager 实现

```typescript
// src/lib/workflow/triggers/event-trigger-manager.ts

import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "../orchestrator";
import { logger } from "@/lib/logger";
import type {
  EventType,
  EventTriggerConfig,
  WorkflowEvent,
} from "./event-trigger-types";
import type { WorkflowDefinition } from "../types";
// v1.1.0: 使用安全表达式评估器替代 new Function()
import { SafeExpressionEvaluator } from "../utils/safe-expression-evaluator";

/**
 * 事件触发管理器
 *
 * 监听和处理工作流事件触发
 */
export class EventTriggerManager {
  private orchestrator = getWorkflowOrchestrator();
  private eventWorkflowCache: Map<string, WorkflowDefinition[]> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  // 去重：记录最近处理的事件
  private recentEvents: Map<string, number> = new Map();
  private readonly DEFAULT_DEBOUNCE_MS = 5000;

  // v1.1.0: 安全表达式评估器实例
  private expressionEvaluator = new SafeExpressionEvaluator();

  /**
   * 处理事件
   */
  async handleEvent(event: WorkflowEvent): Promise<void> {
    const startTime = performance.now();

    try {
      // 1. 检查去重
      const eventKey = this.generateEventKey(event);
      if (this.isDuplicate(eventKey)) {
        logger.debug(
          { eventType: event.type, userId: event.userId },
          "EventTriggerManager: Duplicate event ignored",
        );
        return;
      }

      // 2. 获取匹配的工作流
      const matchingWorkflows = await this.findMatchingWorkflows(event);

      if (matchingWorkflows.length === 0) {
        return;
      }

      logger.info(
        {
          eventType: event.type,
          userId: event.userId,
          matchingCount: matchingWorkflows.length,
        },
        "EventTriggerManager: Event matched workflows",
      );

      // 3. 触发工作流
      for (const workflow of matchingWorkflows) {
        await this.triggerWorkflow(workflow, event);
      }

      // 4. 记录事件
      this.recordEvent(eventKey);

      logger.info(
        {
          eventType: event.type,
          userId: event.userId,
          triggeredCount: matchingWorkflows.length,
          durationMs: Math.round(performance.now() - startTime),
        },
        "EventTriggerManager: Event processed",
      );
    } catch (error) {
      logger.error(
        { error, eventType: event.type, userId: event.userId },
        "EventTriggerManager: Event handling failed",
      );
    }
  }

  /**
   * 查找匹配的工作流
   *
   * v1.1.0: 使用 SafeExpressionEvaluator 替代 new Function()
   */
  private async findMatchingWorkflows(
    event: WorkflowEvent,
  ): Promise<WorkflowDefinition[]> {
    const workflows = await this.loadEventTriggeredWorkflows(event.userId);

    return workflows.filter((workflow) => {
      const eventTrigger = workflow.triggers?.find((t) => t.type === "event");
      if (!eventTrigger) return false;

      const config = eventTrigger.config as EventTriggerConfig;
      if (!config.enabled) return false;
      if (config.eventType !== event.type) return false;

      // v1.1.0: 使用安全表达式评估器
      if (config.condition) {
        try {
          // 验证表达式安全性
          const validation = this.expressionEvaluator.validate(
            config.condition,
          );
          if (!validation.valid) {
            logger.warn(
              { condition: config.condition, error: validation.error },
              "EventTriggerManager: Invalid condition expression",
            );
            return false;
          }

          // 安全评估条件
          return this.expressionEvaluator.evaluate(config.condition, {
            event: event.payload,
          });
        } catch (error) {
          logger.warn(
            { condition: config.condition, error },
            "EventTriggerManager: Condition evaluation failed",
          );
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 触发工作流
   */
  private async triggerWorkflow(
    workflow: WorkflowDefinition,
    event: WorkflowEvent,
  ): Promise<void> {
    const eventTrigger = workflow.triggers?.find((t) => t.type === "event");
    const config = eventTrigger?.config as EventTriggerConfig | undefined;

    // 构建触发上下文
    const triggerContext: Record<string, unknown> = {
      eventType: event.type,
      eventTimestamp: event.timestamp.toISOString(),
      ...event.payload,
    };

    // 应用参数映射
    if (config?.paramMapping) {
      for (const [targetKey, sourceExpr] of Object.entries(
        config.paramMapping,
      )) {
        triggerContext[targetKey] = this.resolveExpression(
          sourceExpr,
          event.payload,
        );
      }
    }

    await this.orchestrator.startWorkflow(
      workflow.id,
      event.userId,
      "event",
      triggerContext,
    );
  }

  /**
   * 加载事件触发的工作流
   */
  private async loadEventTriggeredWorkflows(
    userId: string,
  ): Promise<WorkflowDefinition[]> {
    const cacheKey = `event:${userId}`;
    const now = Date.now();

    if (this.eventWorkflowCache.has(cacheKey) && this.cacheExpiry > now) {
      return this.eventWorkflowCache.get(cacheKey)!;
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflows")
      .select("id, definition")
      .or(`category.eq.builtin,user_id.eq.${userId}`)
      .eq("enabled", true);

    if (error) {
      logger.error({ error }, "EventTriggerManager: Failed to load workflows");
      return [];
    }

    const workflows = (data || [])
      .map((row) => ({
        id: row.id,
        ...(row.definition as Omit<WorkflowDefinition, "id">),
      }))
      .filter((w) => w.triggers?.some((t) => t.type === "event"));

    this.eventWorkflowCache.set(cacheKey, workflows);
    this.cacheExpiry = now + this.CACHE_TTL_MS;

    return workflows;
  }

  /**
   * 生成事件唯一键
   */
  private generateEventKey(event: WorkflowEvent): string {
    const payloadHash = JSON.stringify(event.payload);
    return `${event.type}:${event.userId}:${payloadHash}`;
  }

  /**
   * 检查是否重复事件
   */
  private isDuplicate(eventKey: string): boolean {
    const lastTime = this.recentEvents.get(eventKey);
    if (!lastTime) return false;

    return Date.now() - lastTime < this.DEFAULT_DEBOUNCE_MS;
  }

  /**
   * 记录事件
   */
  private recordEvent(eventKey: string): void {
    this.recentEvents.set(eventKey, Date.now());

    // 清理过期记录
    if (this.recentEvents.size > 1000) {
      const expiredThreshold = Date.now() - this.DEFAULT_DEBOUNCE_MS * 2;
      for (const [key, time] of this.recentEvents) {
        if (time < expiredThreshold) {
          this.recentEvents.delete(key);
        }
      }
    }
  }

  /**
   * 解析表达式
   */
  private resolveExpression(
    expr: string,
    payload: Record<string, unknown>,
  ): unknown {
    if (expr.startsWith("$.")) {
      const path = expr.slice(2);
      return path.split(".").reduce((acc, key) => {
        if (acc && typeof acc === "object" && key in acc) {
          return (acc as Record<string, unknown>)[key];
        }
        return undefined;
      }, payload as unknown);
    }
    return expr;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.eventWorkflowCache.clear();
    this.cacheExpiry = 0;
  }
}

// 单例导出
let managerInstance: EventTriggerManager | null = null;

export function getEventTriggerManager(): EventTriggerManager {
  if (!managerInstance) {
    managerInstance = new EventTriggerManager();
  }
  return managerInstance;
}
```

### 3.3 事件发射集成点

```typescript
// src/lib/workflow/triggers/event-emitter.ts

import { getEventTriggerManager } from "./event-trigger-manager";
import type { EventType, WorkflowEvent } from "./event-trigger-types";
import { logger } from "@/lib/logger";

/**
 * 发射工作流事件
 *
 * 在各业务模块中调用此函数触发事件
 */
export async function emitWorkflowEvent(
  type: EventType,
  userId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const event: WorkflowEvent = {
    type,
    userId,
    payload,
    timestamp: new Date(),
  };

  logger.debug(
    { type, userId, payloadKeys: Object.keys(payload) },
    "WorkflowEvent: Emitting event",
  );

  const manager = getEventTriggerManager();
  await manager.handleEvent(event);
}

// === 集成示例 ===

// 在书签导入完成后触发
// src/lib/browser-bookmark/import-service.ts
/*
import { emitWorkflowEvent } from "@/lib/workflow/triggers/event-emitter";

async function onImportComplete(userId: string, importResult: ImportResult) {
  // ... 导入逻辑

  // 触发事件
  await emitWorkflowEvent("browser_bookmark_import_completed", userId, {
    totalImported: importResult.totalImported,
    foldersCreated: importResult.foldersCreated,
    isFirstImport: importResult.isFirstImport,
  });
}
*/

// 在书签创建后触发
// src/lib/bookmark/bookmark-service.ts
/*
import { emitWorkflowEvent } from "@/lib/workflow/triggers/event-emitter";

async function createBookmark(userId: string, bookmarkData: BookmarkData) {
  // ... 创建逻辑

  await emitWorkflowEvent("bookmark_created", userId, {
    bookmarkId: newBookmark.id,
    title: newBookmark.title,
    url: newBookmark.url,
    platform: newBookmark.platform,
  });
}
*/
```

---

## 4. 预设工作流实现

### 4.1 新用户导入整理工作流

```typescript
// src/lib/workflow/builtin/new-user-onboarding.workflow.ts

import type { WorkflowDefinition } from "../types";

export const newUserOnboardingWorkflow: WorkflowDefinition = {
  id: "new_user_onboarding",
  name: "新用户导入整理",
  description: "导入浏览器书签后自动去重、分类、打标签，快速完成首次整理",
  version: "1.0.0",
  category: "builtin",
  icon: "Sparkles",

  triggers: [
    {
      type: "event",
      config: {
        eventType: "browser_bookmark_import_completed",
        condition: "event.isFirstImport === true",
        enabled: true,
      },
    },
    {
      type: "manual",
    },
    {
      type: "conversation",
      config: {
        patterns: [
          { type: "keyword", pattern: "整理导入的书签" },
          { type: "keyword", pattern: "导入书签整理" },
          { type: "keyword", pattern: "帮我整理刚导入的" },
        ],
        minConfidence: 0.8,
      },
    },
  ],

  steps: [
    {
      id: "analyze_imported",
      name: "分析导入数据",
      type: "tool",
      config: {
        toolId: "count_bookmarks",
        inputMapping: {
          scope: "imported",
          includeStats: true,
        },
        outputMapping: {
          totalCount: "importedCount",
          platformDistribution: "platforms",
        },
      },
    },
    {
      id: "remove_duplicates",
      name: "智能去重",
      type: "skill",
      config: {
        skillId: "duplicate_cleanup",
        inputMapping: {
          scope: "imported",
          autoMerge: false,
          similarity_threshold: 0.85,
        },
        outputMapping: {
          duplicateGroups: "duplicateGroups",
          duplicateCount: "duplicateCount",
        },
      },
    },
    {
      id: "classify_bookmarks",
      name: "智能分类",
      type: "skill",
      config: {
        skillId: "batch_organize",
        inputMapping: {
          scope: "imported",
          maxItems: 500,
          autoExecute: false,
        },
        outputMapping: {
          suggestions: "classifySuggestions",
          suggestedFolders: "suggestedFolders",
        },
      },
    },
    {
      id: "generate_tags",
      name: "智能打标签",
      type: "skill",
      config: {
        skillId: "smart_tagging",
        inputMapping: {
          scope: "imported",
          autoApply: false,
          maxTagsPerBookmark: 5,
        },
        outputMapping: {
          tagSuggestions: "tagSuggestions",
          tagCount: "suggestedTagCount",
        },
      },
    },
    {
      id: "present_summary",
      name: "生成整理报告",
      type: "aggregate",
      requiresConfirmation: true,
      confirmationMessage: "导入整理建议已生成，请确认应用以下调整：",
      config: {
        template: "onboarding_summary",
        sections: [
          {
            title: "导入统计",
            content:
              "共导入 ${importedCount} 条书签，来自 ${platforms.length} 个平台",
          },
          {
            title: "重复检测",
            content: "发现 ${duplicateCount} 组重复内容",
            action: "view_duplicates",
          },
          {
            title: "分类建议",
            content: "建议创建 ${suggestedFolders.length} 个文件夹",
            action: "preview_classification",
          },
          {
            title: "标签推荐",
            content: "推荐 ${suggestedTagCount} 个标签",
            action: "preview_tags",
          },
        ],
      },
    },
    {
      id: "apply_changes",
      name: "应用整理结果",
      type: "parallel",
      condition: "${confirmationResult.confirmed === true}",
      config: {
        steps: [
          {
            type: "skill",
            skillId: "duplicate_cleanup",
            inputMapping: {
              duplicateGroups: "${duplicateGroups}",
              action: "merge",
              strategy: "${confirmationResult.mergeStrategy || 'keep_newest'}",
            },
          },
          {
            type: "skill",
            skillId: "batch_organize",
            inputMapping: {
              suggestions: "${classifySuggestions}",
              action: "apply",
            },
          },
          {
            type: "skill",
            skillId: "smart_tagging",
            inputMapping: {
              suggestions: "${tagSuggestions}",
              action: "apply",
            },
          },
        ],
      },
    },
  ],

  config: {
    timeout: 180000,
    notifyOnComplete: true,
    notifyOnFailure: true,
    retryOnFailure: false,
  },
};
```

### 4.2 主题深挖工作流

```typescript
// src/lib/workflow/builtin/topic-deep-dive.workflow.ts

import type { WorkflowDefinition } from "../types";

export const topicDeepDiveWorkflow: WorkflowDefinition = {
  id: "topic_deep_dive",
  name: "主题深挖",
  description: "聚合某主题所有书签，生成知识图谱和学习计划",
  version: "1.0.0",
  category: "builtin",
  icon: "Network",

  triggers: [
    {
      type: "manual",
    },
    {
      type: "conversation",
      config: {
        patterns: [
          { type: "keyword", pattern: "深度学习" },
          { type: "keyword", pattern: "系统学习" },
          { type: "keyword", pattern: "主题深挖" },
          { type: "regex", pattern: "学习(?<topic>.+)相关" },
          { type: "regex", pattern: "深入了解(?<topic>.+)" },
        ],
        minConfidence: 0.75,
      },
    },
  ],

  // 输入参数
  inputs: [
    {
      name: "topic",
      type: "string",
      required: true,
      prompt: "请输入您想深入学习的主题：",
    },
  ],

  steps: [
    {
      id: "search_related",
      name: "搜索相关书签",
      type: "skill",
      config: {
        skillId: "related_discovery",
        inputMapping: {
          query: "${topic}",
          maxResults: 50,
          includeContent: true,
        },
        outputMapping: {
          bookmarks: "relatedBookmarks",
          totalFound: "totalRelated",
        },
      },
    },
    {
      id: "generate_synthesis",
      name: "生成主题合成",
      type: "skill",
      condition: "${relatedBookmarks.length >= 5}",
      config: {
        skillId: "thematic_synthesis",
        inputMapping: {
          bookmarkIds: "${relatedBookmarks.map(b => b.id)}",
          topic: "${topic}",
          format: "comprehensive",
        },
        outputMapping: {
          synthesis: "thematicSynthesis",
          keyInsights: "insights",
        },
      },
    },
    {
      id: "create_learning_path",
      name: "生成学习路径",
      type: "skill",
      config: {
        skillId: "learning_path",
        inputMapping: {
          bookmarkIds: "${relatedBookmarks.map(b => b.id)}",
          topic: "${topic}",
          learningStyle: "progressive",
        },
        outputMapping: {
          path: "learningPath",
          estimatedDuration: "duration",
        },
      },
    },
    {
      id: "extract_knowledge",
      name: "提取知识点",
      type: "skill",
      config: {
        skillId: "knowledge_extract",
        inputMapping: {
          bookmarkIds: "${relatedBookmarks.slice(0, 20).map(b => b.id)}",
          extractType: "key_concepts",
        },
        outputMapping: {
          concepts: "keyConcepts",
          relations: "conceptRelations",
        },
      },
    },
    {
      id: "present_result",
      name: "呈现学习方案",
      type: "aggregate",
      config: {
        template: "deep_dive_result",
        sections: [
          {
            title: "主题概览",
            content: "关于「${topic}」找到 ${totalRelated} 条相关收藏",
          },
          {
            title: "核心洞察",
            content: "${insights}",
          },
          {
            title: "学习路径",
            content: "${learningPath}",
            action: "start_learning",
          },
          {
            title: "关键概念",
            content: "${keyConcepts}",
          },
        ],
      },
    },
  ],

  config: {
    timeout: 120000,
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
```

### 4.3 定期备份工作流

```typescript
// src/lib/workflow/builtin/periodic-backup.workflow.ts

import type { WorkflowDefinition } from "../types";

export const periodicBackupWorkflow: WorkflowDefinition = {
  id: "periodic_backup",
  name: "定期备份",
  description: "自动导出全量数据到指定格式（JSON/Markdown）",
  version: "1.0.0",
  category: "builtin",
  icon: "HardDrive",

  triggers: [
    {
      type: "scheduled",
      config: {
        frequency: "weekly",
        time: "03:00",
        dayOfWeek: 0, // 周日
        timezone: "Asia/Shanghai",
        enabled: true,
      },
    },
    {
      type: "manual",
    },
    {
      type: "conversation",
      config: {
        patterns: [
          { type: "keyword", pattern: "备份数据" },
          { type: "keyword", pattern: "导出备份" },
          { type: "keyword", pattern: "数据备份" },
        ],
        minConfidence: 0.8,
      },
    },
  ],

  steps: [
    {
      id: "count_data",
      name: "统计数据量",
      type: "tool",
      config: {
        toolId: "count_bookmarks",
        inputMapping: {
          scope: "all",
          includeStats: true,
        },
        outputMapping: {
          totalCount: "bookmarkCount",
          folderCount: "folderCount",
          tagCount: "tagCount",
        },
      },
    },
    {
      id: "export_json",
      name: "导出 JSON 格式",
      type: "skill",
      config: {
        skillId: "data_export",
        inputMapping: {
          format: "json",
          scope: "all",
          includeMetadata: true,
          includeSnapshots: false,
        },
        outputMapping: {
          filePath: "jsonBackupPath",
          fileSize: "jsonFileSize",
        },
      },
    },
    {
      id: "export_markdown",
      name: "导出 Markdown 格式",
      type: "skill",
      config: {
        skillId: "data_export",
        inputMapping: {
          format: "markdown",
          scope: "all",
          groupBy: "folder",
        },
        outputMapping: {
          filePath: "markdownBackupPath",
          fileSize: "markdownFileSize",
        },
      },
    },
    {
      id: "cleanup_old_backups",
      name: "清理旧备份",
      type: "tool",
      config: {
        toolId: "cleanup_backups",
        inputMapping: {
          keepCount: 4, // 保留最近 4 次备份
        },
        outputMapping: {
          deletedCount: "cleanedBackups",
        },
      },
    },
    {
      id: "send_notification",
      name: "发送完成通知",
      type: "notify",
      config: {
        template: "backup_complete",
        data: {
          bookmarkCount: "${bookmarkCount}",
          jsonPath: "${jsonBackupPath}",
          markdownPath: "${markdownBackupPath}",
          totalSize: "${jsonFileSize + markdownFileSize}",
        },
      },
    },
  ],

  config: {
    timeout: 300000, // 5 分钟
    notifyOnComplete: true,
    notifyOnFailure: true,
    retryOnFailure: true,
    maxRetries: 2,
  },
};
```

### 4.4 每日精选推送工作流

```typescript
// src/lib/workflow/builtin/daily-digest.workflow.ts

import type { WorkflowDefinition } from "../types";

export const dailyDigestWorkflow: WorkflowDefinition = {
  id: "daily_digest",
  name: "每日精选推送",
  description: "从未读列表推荐 3-5 条今日阅读内容",
  version: "1.0.0",
  category: "builtin",
  icon: "Newspaper",

  triggers: [
    {
      type: "scheduled",
      config: {
        frequency: "daily",
        time: "08:00",
        timezone: "Asia/Shanghai",
        enabled: true,
      },
    },
    {
      type: "conversation",
      config: {
        patterns: [
          { type: "keyword", pattern: "今日推荐" },
          { type: "keyword", pattern: "每日精选" },
          { type: "keyword", pattern: "今天读什么" },
          { type: "keyword", pattern: "推荐阅读" },
        ],
        minConfidence: 0.8,
      },
    },
  ],

  steps: [
    {
      id: "get_unread",
      name: "获取未读列表",
      type: "tool",
      config: {
        toolId: "search_bookmarks",
        inputMapping: {
          filter: { read_status: "unread" },
          orderBy: "created_at",
          limit: 50,
        },
        outputMapping: {
          bookmarks: "unreadBookmarks",
          totalUnread: "unreadCount",
        },
      },
    },
    {
      id: "score_and_rank",
      name: "评分排序",
      type: "tool",
      config: {
        toolId: "rank_bookmarks",
        inputMapping: {
          bookmarks: "${unreadBookmarks}",
          criteria: ["recency", "relevance", "diversity"],
          topN: 5,
        },
        outputMapping: {
          rankedBookmarks: "topBookmarks",
        },
      },
    },
    {
      id: "generate_summaries",
      name: "生成摘要",
      type: "skill",
      config: {
        skillId: "quick_digest",
        inputMapping: {
          bookmarkIds: "${topBookmarks.map(b => b.id)}",
          summaryLength: "brief",
        },
        outputMapping: {
          summaries: "bookmarkSummaries",
        },
      },
    },
    {
      id: "compose_digest",
      name: "组装每日精选",
      type: "aggregate",
      config: {
        template: "daily_digest",
        data: {
          date: "${new Date().toLocaleDateString('zh-CN')}",
          totalUnread: "${unreadCount}",
          recommendations:
            "${topBookmarks.map((b, i) => ({ ...b, summary: bookmarkSummaries[i] }))}",
        },
      },
    },
    {
      id: "send_digest",
      name: "发送推送",
      type: "notify",
      config: {
        template: "daily_digest_notification",
        priority: "normal",
      },
    },
  ],

  config: {
    timeout: 60000,
    notifyOnComplete: true,
    notifyOnFailure: false, // 每日推送失败不打扰用户
    skipIfEmpty: true, // 无未读内容时跳过
  },
};
```

### 4.5 文件夹清理工作流

```typescript
// src/lib/workflow/builtin/folder-cleanup.workflow.ts

import type { WorkflowDefinition } from "../types";

export const folderCleanupWorkflow: WorkflowDefinition = {
  id: "folder_cleanup",
  name: "文件夹清理",
  description: "检测空文件夹、合并相似文件夹、优化结构",
  version: "1.0.0",
  category: "builtin",
  icon: "FolderSync",

  triggers: [
    {
      type: "manual",
    },
    {
      type: "conversation",
      config: {
        patterns: [
          { type: "keyword", pattern: "清理文件夹" },
          { type: "keyword", pattern: "整理文件夹" },
          { type: "keyword", pattern: "文件夹优化" },
          { type: "keyword", pattern: "合并文件夹" },
        ],
        minConfidence: 0.8,
      },
    },
  ],

  steps: [
    {
      id: "analyze_folders",
      name: "分析文件夹结构",
      type: "skill",
      config: {
        skillId: "folder_health_check",
        inputMapping: {
          includeEmpty: true,
          includeSimilarity: true,
          includeStats: true,
        },
        outputMapping: {
          emptyFolders: "emptyFolders",
          similarPairs: "similarFolders",
          healthReport: "folderHealthReport",
        },
      },
    },
    {
      id: "detect_duplicates",
      name: "检测重复结构",
      type: "tool",
      config: {
        toolId: "analyze_folder_overlap",
        inputMapping: {
          similarityThreshold: 0.7,
        },
        outputMapping: {
          overlappingFolders: "overlappingFolders",
          mergeSuggestions: "mergeSuggestions",
        },
      },
    },
    {
      id: "present_findings",
      name: "呈现分析结果",
      type: "aggregate",
      requiresConfirmation: true,
      confirmationMessage: "文件夹分析完成，请确认要执行的操作：",
      config: {
        template: "folder_cleanup_report",
        sections: [
          {
            title: "空文件夹",
            content: "发现 ${emptyFolders.length} 个空文件夹",
            action: "delete_empty",
            actionLabel: "删除空文件夹",
          },
          {
            title: "相似文件夹",
            content: "发现 ${similarFolders.length} 对相似文件夹",
            action: "merge_similar",
            actionLabel: "查看合并建议",
          },
          {
            title: "结构优化建议",
            content: "${folderHealthReport.suggestions}",
            action: "view_suggestions",
          },
        ],
      },
    },
    {
      id: "delete_empty",
      name: "删除空文件夹",
      type: "tool",
      condition: "${confirmationResult.actions.includes('delete_empty')}",
      config: {
        toolId: "delete_folders",
        inputMapping: {
          folderIds: "${emptyFolders.map(f => f.id)}",
          confirmRequired: false, // 已在上一步确认
        },
        outputMapping: {
          deletedCount: "deletedEmptyCount",
        },
      },
    },
    {
      id: "merge_similar",
      name: "合并相似文件夹",
      type: "tool",
      condition: "${confirmationResult.actions.includes('merge_similar')}",
      config: {
        toolId: "merge_folders",
        inputMapping: {
          mergePairs: "${mergeSuggestions}",
          strategy: "keep_larger",
        },
        outputMapping: {
          mergedCount: "mergedFolderCount",
        },
      },
    },
    {
      id: "final_report",
      name: "生成清理报告",
      type: "aggregate",
      config: {
        template: "cleanup_complete",
        data: {
          deletedEmpty: "${deletedEmptyCount || 0}",
          mergedFolders: "${mergedFolderCount || 0}",
        },
      },
    },
  ],

  config: {
    timeout: 120000,
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
```

### 4.6 工作流注册

```typescript
// src/lib/workflow/builtin/index.ts

import { bookmarkHealthWorkflow } from "./bookmark-health.workflow";
import { newUserOnboardingWorkflow } from "./new-user-onboarding.workflow";
import { topicDeepDiveWorkflow } from "./topic-deep-dive.workflow";
import { periodicBackupWorkflow } from "./periodic-backup.workflow";
import { dailyDigestWorkflow } from "./daily-digest.workflow";
import { folderCleanupWorkflow } from "./folder-cleanup.workflow";
import type { WorkflowDefinition } from "../types";

/**
 * 内置工作流注册表
 */
export const builtinWorkflows: WorkflowDefinition[] = [
  // P0 优先级
  newUserOnboardingWorkflow,
  bookmarkHealthWorkflow,

  // P1 优先级
  topicDeepDiveWorkflow,
  periodicBackupWorkflow,
  dailyDigestWorkflow,

  // P2 优先级
  folderCleanupWorkflow,
];

/**
 * 根据 ID 获取内置工作流
 */
export function getBuiltinWorkflow(id: string): WorkflowDefinition | undefined {
  return builtinWorkflows.find((w) => w.id === id);
}

/**
 * 获取所有内置工作流
 */
export function getAllBuiltinWorkflows(): WorkflowDefinition[] {
  return builtinWorkflows;
}

// 导出所有工作流定义
export {
  bookmarkHealthWorkflow,
  newUserOnboardingWorkflow,
  topicDeepDiveWorkflow,
  periodicBackupWorkflow,
  dailyDigestWorkflow,
  folderCleanupWorkflow,
};
```

---

## 5. 数据库迁移

### 5.1 工作流种子数据

```sql
-- supabase/migrations/20250108000003_seed_builtin_workflows.sql

-- 插入内置工作流
INSERT INTO workflows (id, name, description, category, enabled, definition, created_at)
VALUES
  -- P0: 新用户导入整理
  (
    gen_random_uuid(),
    '新用户导入整理',
    '导入浏览器书签后自动去重、分类、打标签，快速完成首次整理',
    'builtin',
    true,
    '{"id":"new_user_onboarding","version":"1.0.0","triggers":[{"type":"event","config":{"eventType":"browser_bookmark_import_completed","condition":"event.isFirstImport === true","enabled":true}},{"type":"manual"},{"type":"conversation","config":{"patterns":[{"type":"keyword","pattern":"整理导入的书签"},{"type":"keyword","pattern":"导入书签整理"}],"minConfidence":0.8}}],"steps":[{"id":"analyze_imported","name":"分析导入数据","type":"tool","config":{"toolId":"count_bookmarks"}},{"id":"remove_duplicates","name":"智能去重","type":"skill","config":{"skillId":"duplicate_cleanup"}},{"id":"classify_bookmarks","name":"智能分类","type":"skill","config":{"skillId":"batch_organize"}},{"id":"generate_tags","name":"智能打标签","type":"skill","config":{"skillId":"smart_tagging"}}],"config":{"timeout":180000,"notifyOnComplete":true}}'::jsonb,
    NOW()
  ),

  -- P0: 书签健康巡检
  (
    gen_random_uuid(),
    '书签健康巡检',
    '检测失效链接、内容变更、重复书签，生成健康报告',
    'builtin',
    true,
    '{"id":"bookmark_health","version":"1.0.0","triggers":[{"type":"manual"},{"type":"conversation","config":{"patterns":[{"type":"keyword","pattern":"检查书签健康"},{"type":"keyword","pattern":"书签巡检"},{"type":"keyword","pattern":"链接检查"}],"minConfidence":0.8}}],"steps":[{"id":"check_links","name":"检测失效链接","type":"skill","config":{"skillId":"link_health_check"}},{"id":"detect_duplicates","name":"检测重复书签","type":"skill","config":{"skillId":"duplicate_cleanup"}},{"id":"generate_report","name":"生成健康报告","type":"aggregate"}],"config":{"timeout":300000,"notifyOnComplete":true}}'::jsonb,
    NOW()
  ),

  -- P1: 主题深挖
  (
    gen_random_uuid(),
    '主题深挖',
    '聚合某主题所有书签，生成知识图谱和学习计划',
    'builtin',
    true,
    '{"id":"topic_deep_dive","version":"1.0.0","triggers":[{"type":"manual"},{"type":"conversation","config":{"patterns":[{"type":"keyword","pattern":"深度学习"},{"type":"keyword","pattern":"系统学习"},{"type":"regex","pattern":"学习(?<topic>.+)相关"}],"minConfidence":0.75}}],"inputs":[{"name":"topic","type":"string","required":true,"prompt":"请输入您想深入学习的主题："}],"steps":[{"id":"search_related","name":"搜索相关书签","type":"skill","config":{"skillId":"related_discovery"}},{"id":"generate_synthesis","name":"生成主题合成","type":"skill","config":{"skillId":"thematic_synthesis"}},{"id":"create_learning_path","name":"生成学习路径","type":"skill","config":{"skillId":"learning_path"}}],"config":{"timeout":120000,"notifyOnComplete":true}}'::jsonb,
    NOW()
  ),

  -- P1: 定期备份
  (
    gen_random_uuid(),
    '定期备份',
    '自动导出全量数据到指定格式（JSON/Markdown）',
    'builtin',
    true,
    '{"id":"periodic_backup","version":"1.0.0","triggers":[{"type":"scheduled","config":{"frequency":"weekly","time":"03:00","dayOfWeek":0,"timezone":"Asia/Shanghai","enabled":true}},{"type":"manual"},{"type":"conversation","config":{"patterns":[{"type":"keyword","pattern":"备份数据"},{"type":"keyword","pattern":"导出备份"}],"minConfidence":0.8}}],"steps":[{"id":"count_data","name":"统计数据量","type":"tool","config":{"toolId":"count_bookmarks"}},{"id":"export_json","name":"导出 JSON 格式","type":"skill","config":{"skillId":"data_export","inputMapping":{"format":"json"}}},{"id":"export_markdown","name":"导出 Markdown 格式","type":"skill","config":{"skillId":"data_export","inputMapping":{"format":"markdown"}}}],"config":{"timeout":300000,"notifyOnComplete":true}}'::jsonb,
    NOW()
  ),

  -- P1: 每日精选推送
  (
    gen_random_uuid(),
    '每日精选推送',
    '从未读列表推荐 3-5 条今日阅读内容',
    'builtin',
    true,
    '{"id":"daily_digest","version":"1.0.0","triggers":[{"type":"scheduled","config":{"frequency":"daily","time":"08:00","timezone":"Asia/Shanghai","enabled":true}},{"type":"conversation","config":{"patterns":[{"type":"keyword","pattern":"今日推荐"},{"type":"keyword","pattern":"每日精选"},{"type":"keyword","pattern":"今天读什么"}],"minConfidence":0.8}}],"steps":[{"id":"get_unread","name":"获取未读列表","type":"tool","config":{"toolId":"search_bookmarks"}},{"id":"score_and_rank","name":"评分排序","type":"tool","config":{"toolId":"rank_bookmarks"}},{"id":"generate_summaries","name":"生成摘要","type":"skill","config":{"skillId":"quick_digest"}}],"config":{"timeout":60000,"notifyOnComplete":true,"skipIfEmpty":true}}'::jsonb,
    NOW()
  ),

  -- P2: 文件夹清理
  (
    gen_random_uuid(),
    '文件夹清理',
    '检测空文件夹、合并相似文件夹、优化结构',
    'builtin',
    true,
    '{"id":"folder_cleanup","version":"1.0.0","triggers":[{"type":"manual"},{"type":"conversation","config":{"patterns":[{"type":"keyword","pattern":"清理文件夹"},{"type":"keyword","pattern":"整理文件夹"},{"type":"keyword","pattern":"文件夹优化"}],"minConfidence":0.8}}],"steps":[{"id":"analyze_folders","name":"分析文件夹结构","type":"skill","config":{"skillId":"folder_health_check"}},{"id":"detect_duplicates","name":"检测重复结构","type":"tool","config":{"toolId":"analyze_folder_overlap"}},{"id":"present_findings","name":"呈现分析结果","type":"aggregate","requiresConfirmation":true}],"config":{"timeout":120000,"notifyOnComplete":true}}'::jsonb,
    NOW()
  )
ON CONFLICT DO NOTHING;
```

---

## 6. 测试计划

### 6.1 单元测试

| 测试文件                        | 覆盖内容                       |
| ------------------------------- | ------------------------------ |
| `trigger-scheduler.test.ts`     | 定时计算、任务获取、执行调度   |
| `event-trigger-manager.test.ts` | 事件匹配、去重、触发逻辑       |
| `new-user-onboarding.test.ts`   | 工作流步骤、条件分支、输出映射 |
| `topic-deep-dive.test.ts`       | 输入参数、Skill 链接           |
| `periodic-backup.test.ts`       | 定时触发、文件导出             |
| `daily-digest.test.ts`          | 评分排序、推送逻辑             |
| `folder-cleanup.test.ts`        | 确认流程、条件执行             |

### 6.2 集成测试

```typescript
// src/lib/workflow/__tests__/integration/phase4-integration.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getTriggerScheduler } from "../../triggers/trigger-scheduler";
import { getEventTriggerManager } from "../../triggers/event-trigger-manager";
import { emitWorkflowEvent } from "../../triggers/event-emitter";

describe("Phase 4 Integration", () => {
  describe("Scheduled Workflows", () => {
    it("should calculate next execution time for daily workflow", () => {
      const scheduler = getTriggerScheduler();
      const config = {
        frequency: "daily" as const,
        time: "08:00",
        timezone: "Asia/Shanghai",
        enabled: true,
      };

      // ... 测试逻辑
    });

    it("should execute pending scheduled workflows", async () => {
      // ... 测试逻辑
    });
  });

  describe("Event Triggered Workflows", () => {
    it("should trigger new_user_onboarding on first import", async () => {
      await emitWorkflowEvent("browser_bookmark_import_completed", "user-123", {
        isFirstImport: true,
        totalImported: 150,
      });

      // 验证工作流已启动
    });

    it("should debounce duplicate events", async () => {
      // ... 测试逻辑
    });
  });

  describe("Builtin Workflows", () => {
    it("should execute new_user_onboarding workflow end-to-end", async () => {
      // ... 端到端测试
    });

    it("should execute topic_deep_dive with topic parameter", async () => {
      // ... 端到端测试
    });
  });
});
```

---

## 7. 实施步骤

### Day 0.5: 安全性基础设施（前置依赖）

| 时间 | 任务                                        | 产出                           |
| ---- | ------------------------------------------- | ------------------------------ |
| 上午 | 验证 Phase 3 SafeExpressionEvaluator 可复用 | 确认接口兼容性                 |
| 下午 | 实现分布式锁管理器 + 数据库函数             | distributed-lock.ts + SQL 迁移 |

### Day 1-2: 定时触发系统

| 时间       | 任务                      | 产出                             |
| ---------- | ------------------------- | -------------------------------- |
| Day 1 上午 | 实现 TriggerScheduler     | 调度器核心逻辑                   |
| Day 1 下午 | 数据库迁移 + 集成分布式锁 | scheduled_executions 表 + 锁机制 |
| Day 2 上午 | Edge Function 定时处理器  | workflow-scheduler 函数          |
| Day 2 下午 | 前端定时管理界面          | 定时任务列表/创建                |

### Day 3-4: 事件触发系统

| 时间       | 任务                                                     | 产出                      |
| ---------- | -------------------------------------------------------- | ------------------------- |
| Day 3 上午 | 实现 EventTriggerManager（使用 SafeExpressionEvaluator） | 事件触发管理器            |
| Day 3 下午 | 事件发射集成                                             | 书签/导入模块集成         |
| Day 4 上午 | 去重和安全条件评估测试                                   | 去重逻辑 + 表达式安全测试 |
| Day 4 下午 | 测试和调试                                               | 单元测试 + 集成测试       |

### Day 5-6: 预设工作流实现

| 时间       | 任务                                        | 产出              |
| ---------- | ------------------------------------------- | ----------------- |
| Day 5 上午 | P0 工作流：new_user_onboarding              | 完整工作流定义    |
| Day 5 下午 | P1 工作流：topic_deep_dive, periodic_backup | 工作流定义 + 测试 |
| Day 6 上午 | P1 工作流：daily_digest                     | 工作流定义 + 测试 |
| Day 6 下午 | P2 工作流：folder_cleanup                   | 工作流定义 + 测试 |

### Day 7-8: 集成和测试

| 时间       | 任务           | 产出           |
| ---------- | -------------- | -------------- |
| Day 7 上午 | 数据库种子数据 | SQL 迁移文件   |
| Day 7 下午 | 端到端测试     | 完整流程验证   |
| Day 8 上午 | 性能优化       | 缓存、批量处理 |
| Day 8 下午 | 文档和收尾     | 使用文档、验收 |

---

## 8. 新增文件清单

```
src/lib/workflow/triggers/
├── types.ts                         # 触发器类型定义
├── trigger-scheduler.ts             # 定时触发调度器
├── distributed-lock.ts              # 分布式锁管理器 (v1.1.0)
├── event-trigger-types.ts           # 事件触发类型
├── event-trigger-manager.ts         # 事件触发管理器 (v1.1.0: SafeExpressionEvaluator)
├── event-emitter.ts                 # 事件发射工具
├── index.ts                         # 模块导出
└── __tests__/
    ├── trigger-scheduler.test.ts
    ├── distributed-lock.test.ts     # 分布式锁测试 (v1.1.0)
    ├── event-trigger-manager.test.ts
    └── event-emitter.test.ts

src/lib/workflow/builtin/
├── bookmark-health.workflow.ts      # 书签健康巡检
├── new-user-onboarding.workflow.ts  # 新用户导入整理
├── topic-deep-dive.workflow.ts      # 主题深挖
├── periodic-backup.workflow.ts      # 定期备份
├── daily-digest.workflow.ts         # 每日精选推送
├── folder-cleanup.workflow.ts       # 文件夹清理
├── index.ts                         # 注册导出
└── __tests__/
    ├── new-user-onboarding.test.ts
    ├── topic-deep-dive.test.ts
    ├── periodic-backup.test.ts
    ├── daily-digest.test.ts
    └── folder-cleanup.test.ts

supabase/migrations/
├── 20250108000002_add_scheduled_executions.sql
├── 20250108000003_seed_builtin_workflows.sql
└── 20250108000004_add_workflow_locks.sql    # 分布式锁表 (v1.1.0)

supabase/functions/
└── workflow-scheduler/
    └── index.ts                     # 定时任务处理器
```

**v1.1.0 依赖说明**：

- `SafeExpressionEvaluator`: 复用 Phase 3 实现 (`src/lib/workflow/utils/safe-expression-evaluator.ts`)
- 无需重复实现，通过 import 引用即可

---

## 9. 验收标准

### 9.1 功能验收

| 验收项       | 测试方法                     | 预期结果                                   |
| ------------ | ---------------------------- | ------------------------------------------ |
| 定时触发     | 设置每日 08:00 触发          | 准时执行工作流                             |
| 分布式锁     | 多实例同时处理同一任务       | 仅一个实例执行成功 (v1.1.0)                |
| 事件触发     | 首次导入书签                 | 自动启动 new_user_onboarding               |
| 去重逻辑     | 5 秒内重复事件               | 仅触发一次                                 |
| 安全条件评估 | event.isFirstImport === true | 使用 SafeExpressionEvaluator 评估 (v1.1.0) |
| 工作流链接   | topic_deep_dive 执行         | 串联 3 个 Skill                            |
| 确认流程     | folder_cleanup 执行          | 等待用户确认后继续                         |
| 定时取消     | 取消定时任务                 | 状态变为 skipped                           |

### 9.2 性能指标

| 指标                 | 目标值   |
| -------------------- | -------- |
| 定时任务扫描延迟     | < 5s     |
| 事件触发延迟         | < 100ms  |
| 工作流启动延迟       | < 500ms  |
| 每日定时任务处理能力 | 1000+ 个 |

### 9.3 测试覆盖

| 模块                  | 目标覆盖率 |
| --------------------- | ---------- |
| trigger-scheduler     | ≥ 85%      |
| event-trigger-manager | ≥ 85%      |
| 预设工作流            | ≥ 80%      |

---

## 10. 合规性检查清单

| 检查项                         | 状态 |
| ------------------------------ | ---- |
| 使用 `createClient()` 直接调用 | ✅   |
| 使用单例模式获取服务实例       | ✅   |
| 事件发射使用统一接口           | ✅   |
| 工作流定义符合类型规范         | ✅   |
| 数据库迁移命名符合规范         | ✅   |
| Edge Function 符合 Deno 规范   | ✅   |
| 日志使用 `logger` 模块         | ✅   |
| 预设工作流复用现有 Skills      | ✅   |
| 单元测试覆盖核心逻辑           | ✅   |
