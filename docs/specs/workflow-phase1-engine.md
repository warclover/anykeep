# 工作流系统 Phase 1: 核心引擎 MVP

> **版本**: v1.1.0
> **日期**: 2025-01-08
> **状态**: 待实施
> **预估工时**: 3-4 天（含 Phase 0 验证）
> **前置依赖**: 无
> **更新记录**: v1.1.0 - 新增 Phase 0 接口验证任务，优化风险缓解策略

---

## 0. Phase 0: 接口验证 Spike（必须先行）

### 0.1 背景

在开始核心引擎开发前，必须验证以下关键接口兼容性：

| 验证项                         | 风险描述                                                   | 验证方法             |
| ------------------------------ | ---------------------------------------------------------- | -------------------- |
| UnifiedEngine.execute() 返回值 | 当前返回 `AsyncGenerator<StreamChunk>`，工作流需要同步结果 | 编写适配器或 wrapper |
| OrchestrationEngine 方法签名   | SkillStepExecutor 依赖的方法可能不存在                     | 阅读源码确认 API     |
| Skill 执行上下文结构           | 工作流上下文与 Skill 上下文可能不兼容                      | 编写类型适配层       |

### 0.2 Spike 任务（0.5 天）

```typescript
// spike/workflow-interface-validation.ts

/**
 * Phase 0 验证任务清单：
 *
 * 1. 验证 UnifiedEngine.execute() 返回类型
 *    - 确认是 AsyncGenerator<StreamChunk>
 *    - 设计 collectStreamResult() 辅助函数收集流式结果
 *
 * 2. 验证 OrchestrationEngine 公开方法
 *    - 检查 engine.execute() 是否存在
 *    - 确认入参和返回值类型
 *    - 如需调整，在 Phase 1 中创建适配层
 *
 * 3. 验证 Skill 上下文兼容性
 *    - WorkflowContext 与 ExecutionContext 的映射
 *    - userId, conversationId 的传递方式
 */
```

### 0.3 验证产出

- [ ] 接口兼容性报告（确认或调整方案）
- [ ] UnifiedEngine 流式结果收集器设计
- [ ] OrchestrationEngine 适配层方案（如需要）

---

## 1. 目标与范围

### 1.1 Phase 1 目标

构建**最小可行的工作流引擎**，验证核心架构设计，为后续阶段奠定基础。

### 1.2 范围界定

| 包含                                 | 不包含              |
| ------------------------------------ | ------------------- |
| WorkflowOrchestrator（精简版）       | 前端 UI 组件        |
| ExecutionEngine（仅 skill 步骤）     | AI 对话触发         |
| StateManager                         | 定时触发器          |
| 数据库表结构                         | 条件分支 / 并行步骤 |
| 1 个验证工作流（bookmark_health）    | 用户自定义工作流    |
| 基础 API 端点（start/status/cancel） | 复杂的进度推送      |
| **UnifiedEngine 流式结果收集器**     |                     |

### 1.3 成功标准

- [ ] Phase 0 Spike 验证通过
- [ ] 可通过 API 启动工作流
- [ ] 工作流按步骤顺序执行
- [ ] 执行状态持久化到数据库
- [ ] 可查询执行进度和结果
- [ ] 可取消正在执行的工作流
- [ ] bookmark_health 工作流完整运行

---

## 2. 架构设计

### 2.1 精简架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                 │
│  POST /api/workflow/start                                    │
│  GET  /api/workflow/execution/:id                            │
│  POST /api/workflow/execution/:id/cancel                     │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 WorkflowOrchestrator                         │
│  - startWorkflow(workflowId, userId)                         │
│  - getExecution(executionId)                                 │
│  - cancelWorkflow(executionId)                               │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│    ExecutionEngine      │     │       StateManager          │
│  - execute(workflow)    │     │  - createExecution()        │
│  - executeStep(step)    │     │  - updateStatus()           │
│  - cancel(executionId)  │     │  - recordStepResult()       │
└────────────┬────────────┘     └─────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   UnifiedEngine                              │
│              (现有 AI Skills 系统)                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
1. API 调用 startWorkflow(workflowId, userId)
2. Orchestrator 加载工作流定义
3. StateManager 创建执行记录 (status: pending)
4. 返回 executionId 给调用方
5. 异步启动 ExecutionEngine.execute()
6. 遍历 steps，逐个执行
7. 每步完成后 StateManager.recordStepResult()
8. 全部完成后 StateManager.updateStatus(completed)
```

---

## 3. 数据库设计

### 3.1 迁移文件

```sql
-- supabase/migrations/20250108100001_add_workflow_tables_phase1.sql

-- =====================================================
-- 工作流定义表
-- =====================================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'user_defined',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT workflows_category_check CHECK (category IN ('builtin', 'user_defined'))
);

-- 内置工作流 user_id 为 NULL
COMMENT ON TABLE workflows IS '工作流定义表，存储工作流配置';

-- =====================================================
-- 工作流执行记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  trigger_context JSONB DEFAULT '{}'::jsonb,
  current_step_index INTEGER DEFAULT 0,
  step_results JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT workflow_executions_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'waiting_confirmation')
  )
);

COMMENT ON TABLE workflow_executions IS '工作流执行记录表';

-- =====================================================
-- 索引
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);

-- =====================================================
-- RLS 策略
-- =====================================================
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- 工作流：用户可访问自己的 + 内置的
CREATE POLICY "Users can view their own and builtin workflows"
  ON workflows FOR SELECT
  USING (auth.uid() = user_id OR category = 'builtin');

CREATE POLICY "Users can manage their own workflows"
  ON workflows FOR ALL
  USING (auth.uid() = user_id);

-- 执行记录：仅自己的
CREATE POLICY "Users can manage their own executions"
  ON workflow_executions FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- 更新时间触发器
-- =====================================================
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_workflows_updated_at();
```

### 3.2 类型定义

```typescript
// src/lib/workflow/types/database.types.ts

export type WorkflowCategory = "builtin" | "user_defined";

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting_confirmation";

export type TriggerType = "manual" | "event" | "schedule" | "conversation";

export interface WorkflowRow {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  definition: WorkflowDefinition;
  category: WorkflowCategory;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecutionRow {
  id: string;
  workflow_id: string;
  user_id: string;
  status: ExecutionStatus;
  trigger_type: TriggerType;
  trigger_context: Record<string, unknown>;
  current_step_index: number;
  step_results: StepResult[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}
```

---

## 4. 核心模块实现

### 4.1 类型定义

```typescript
// src/lib/workflow/types/workflow.types.ts

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: "builtin" | "user_defined";
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  config: WorkflowConfig;
}

/**
 * 工作流触发器
 */
export interface WorkflowTrigger {
  type: "manual" | "event" | "schedule" | "conversation";
  eventType?: string;
  condition?: string;
  schedule?: {
    type: "cron" | "interval";
    value: string;
  };
  patterns?: string[];
}

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  id: string;
  name: string;
  type:
    | "skill"
    | "tool"
    | "condition"
    | "parallel"
    | "aggregate"
    | "notification";
  config: SkillStepConfig | Record<string, unknown>;
  condition?: string;
  onError?: "stop" | "skip" | "continue";
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

/**
 * Skill 步骤配置
 */
export interface SkillStepConfig {
  skillId: string;
  inputMapping: Record<string, string | unknown>;
  outputMapping?: Record<string, string>;
}

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  timeout: number;
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
}

/**
 * 步骤执行结果
 */
export interface StepResult {
  stepId: string;
  stepName: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output?: unknown;
  error?: string;
  duration?: number;
  startedAt?: string;
  completedAt?: string;
}

/**
 * 工作流执行上下文
 */
export interface WorkflowContext {
  userId: string;
  workflowId: string;
  executionId: string;
  variables: Record<string, unknown>;
  stepResults: Record<string, StepResult>;
  abortSignal: AbortSignal;
}

/**
 * 工作流执行状态
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  userId: string;
  status: ExecutionStatus;
  triggerType: TriggerType;
  triggerContext: Record<string, unknown>;
  currentStepIndex: number;
  steps: StepResult[];
  totalSteps: number;
  progress: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting_confirmation";

export type TriggerType = "manual" | "event" | "schedule" | "conversation";
```

### 4.2 StreamResultCollector（解决接口兼容性）

```typescript
// src/lib/workflow/utils/stream-result-collector.ts

import type { StreamChunk } from "@/lib/ai-skills/engine/types";
import { logger } from "@/lib/logger";

/**
 * 流式结果收集器
 *
 * 将 AsyncGenerator<StreamChunk> 转换为同步可用的结果
 * 解决 UnifiedEngine.execute() 返回类型与工作流同步需求的不兼容问题
 */
export interface CollectedResult {
  /** 合并的文本内容 */
  text: string;
  /** 所有交付物 */
  deliverables: Array<{ format: string; content: unknown }>;
  /** 最终状态 */
  status: "completed" | "failed";
  /** 错误信息（如果失败） */
  error?: string;
  /** 原始 chunks（调试用） */
  rawChunks: StreamChunk[];
}

/**
 * 收集流式结果
 *
 * @param stream - UnifiedEngine.execute() 返回的 AsyncGenerator
 * @param options - 收集选项
 * @returns 收集后的同步结果
 */
export async function collectStreamResult(
  stream: AsyncGenerator<StreamChunk>,
  options: {
    /** 超时时间（毫秒），默认 60000 */
    timeout?: number;
    /** 进度回调 */
    onProgress?: (chunk: StreamChunk) => void;
    /** 是否保留原始 chunks */
    keepRawChunks?: boolean;
  } = {},
): Promise<CollectedResult> {
  const { timeout = 60000, onProgress, keepRawChunks = false } = options;
  const startTime = performance.now();

  const result: CollectedResult = {
    text: "",
    deliverables: [],
    status: "completed",
    rawChunks: [],
  };

  const textParts: string[] = [];

  try {
    // 设置超时
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Stream collection timeout")), timeout);
    });

    // 收集流
    const collectPromise = (async () => {
      for await (const chunk of stream) {
        // 检查超时
        if (performance.now() - startTime > timeout) {
          throw new Error("Stream collection timeout");
        }

        // 保存原始 chunk（如果需要）
        if (keepRawChunks) {
          result.rawChunks.push(chunk);
        }

        // 进度回调
        if (onProgress) {
          onProgress(chunk);
        }

        // 处理不同类型的 chunk
        switch (chunk.type) {
          case "text":
            if (chunk.data?.text) {
              textParts.push(chunk.data.text);
            }
            break;

          case "deliverable":
            if (chunk.data?.format && chunk.data?.content !== undefined) {
              result.deliverables.push({
                format: chunk.data.format,
                content: chunk.data.content,
              });
            }
            break;

          case "error":
            result.status = "failed";
            result.error = chunk.data?.message || "Unknown error";
            break;

          case "done":
            // 流结束
            break;

          default:
            // 其他类型（routing, progress 等）忽略
            break;
        }
      }
    })();

    await Promise.race([collectPromise, timeoutPromise]);

    // 合并文本
    result.text = textParts.join("");

    logger.debug(
      {
        textLength: result.text.length,
        deliverablesCount: result.deliverables.length,
        durationMs: Math.round(performance.now() - startTime),
      },
      "StreamResultCollector: Collection completed",
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      {
        error: errorMessage,
        durationMs: Math.round(performance.now() - startTime),
      },
      "StreamResultCollector: Collection failed",
    );

    return {
      text: textParts.join(""),
      deliverables: result.deliverables,
      status: "failed",
      error: errorMessage,
      rawChunks: result.rawChunks,
    };
  }
}

/**
 * 从收集结果中提取主要交付物
 */
export function extractPrimaryDeliverable(
  result: CollectedResult,
): unknown | null {
  if (result.deliverables.length === 0) {
    return null;
  }

  // 优先返回 JSON 格式
  const jsonDeliverable = result.deliverables.find((d) => d.format === "json");
  if (jsonDeliverable) {
    return jsonDeliverable.content;
  }

  // 其次返回第一个
  return result.deliverables[0].content;
}
```

### 4.3 StateManager 实现

```typescript
// src/lib/workflow/state/state-manager.ts

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  WorkflowDefinition,
  WorkflowExecution,
  ExecutionStatus,
  StepResult,
  TriggerType,
} from "../types";

/**
 * 工作流状态管理器
 *
 * 负责执行状态的持久化和查询
 */
export class StateManager {
  /**
   * 创建执行记录
   */
  async createExecution(
    workflow: WorkflowDefinition,
    userId: string,
    triggerType: TriggerType = "manual",
    triggerContext: Record<string, unknown> = {},
  ): Promise<WorkflowExecution> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflow_executions")
      .insert({
        workflow_id: workflow.id,
        user_id: userId,
        status: "pending",
        trigger_type: triggerType,
        trigger_context: triggerContext,
        current_step_index: 0,
        step_results: [],
      })
      .select()
      .single();

    if (error || !data) {
      logger.error(
        { error, workflowId: workflow.id },
        "StateManager: Failed to create execution",
      );
      throw new Error(`Failed to create execution: ${error?.message}`);
    }

    logger.info(
      { executionId: data.id, workflowId: workflow.id, userId },
      "StateManager: Execution created",
    );

    return this.mapToExecution(data, workflow);
  }

  /**
   * 获取执行记录
   */
  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflow_executions")
      .select("*, workflows(*)")
      .eq("id", executionId)
      .single();

    if (error || !data) {
      if (error?.code === "PGRST116") {
        return null; // Not found
      }
      logger.error(
        { error, executionId },
        "StateManager: Failed to get execution",
      );
      throw new Error(`Failed to get execution: ${error?.message}`);
    }

    const workflow = data.workflows?.definition as WorkflowDefinition;
    return this.mapToExecution(data, workflow);
  }

  /**
   * 更新执行状态
   */
  async updateStatus(
    executionId: string,
    status: ExecutionStatus,
    errorMessage?: string,
  ): Promise<void> {
    const supabase = await createClient();

    const updates: Record<string, unknown> = { status };

    if (
      status === "completed" ||
      status === "failed" ||
      status === "cancelled"
    ) {
      updates.completed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    const { error } = await supabase
      .from("workflow_executions")
      .update(updates)
      .eq("id", executionId);

    if (error) {
      logger.error(
        { error, executionId, status },
        "StateManager: Failed to update status",
      );
      throw new Error(`Failed to update status: ${error.message}`);
    }

    logger.info({ executionId, status }, "StateManager: Status updated");
  }

  /**
   * 更新当前步骤索引
   */
  async updateCurrentStep(
    executionId: string,
    stepIndex: number,
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("workflow_executions")
      .update({ current_step_index: stepIndex })
      .eq("id", executionId);

    if (error) {
      logger.error(
        { error, executionId, stepIndex },
        "StateManager: Failed to update step index",
      );
    }
  }

  /**
   * 记录步骤结果
   */
  async recordStepResult(
    executionId: string,
    stepResult: StepResult,
  ): Promise<void> {
    const supabase = await createClient();

    // 获取当前步骤结果
    const { data } = await supabase
      .from("workflow_executions")
      .select("step_results")
      .eq("id", executionId)
      .single();

    const stepResults = (data?.step_results || []) as StepResult[];

    // 查找是否已存在该步骤的结果（更新）或新增
    const existingIndex = stepResults.findIndex(
      (r) => r.stepId === stepResult.stepId,
    );
    if (existingIndex >= 0) {
      stepResults[existingIndex] = stepResult;
    } else {
      stepResults.push(stepResult);
    }

    const { error } = await supabase
      .from("workflow_executions")
      .update({ step_results: stepResults })
      .eq("id", executionId);

    if (error) {
      logger.error(
        { error, executionId, stepResult },
        "StateManager: Failed to record step result",
      );
    }
  }

  /**
   * 获取用户的执行历史
   */
  async listExecutions(
    userId: string,
    options: { limit?: number; status?: ExecutionStatus } = {},
  ): Promise<WorkflowExecution[]> {
    const supabase = await createClient();
    const { limit = 20, status } = options;

    let query = supabase
      .from("workflow_executions")
      .select("*, workflows(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error, userId },
        "StateManager: Failed to list executions",
      );
      return [];
    }

    return (data || []).map((row) => {
      const workflow = row.workflows?.definition as WorkflowDefinition;
      return this.mapToExecution(row, workflow);
    });
  }

  /**
   * 映射数据库行到执行对象
   */
  private mapToExecution(
    row: Record<string, unknown>,
    workflow?: WorkflowDefinition,
  ): WorkflowExecution {
    const stepResults = (row.step_results as StepResult[]) || [];
    const totalSteps = workflow?.steps?.length || 0;
    const completedSteps = stepResults.filter(
      (r) => r.status === "completed" || r.status === "skipped",
    ).length;

    return {
      id: row.id as string,
      workflowId: row.workflow_id as string,
      workflowName: workflow?.name || "Unknown",
      userId: row.user_id as string,
      status: row.status as ExecutionStatus,
      triggerType: row.trigger_type as TriggerType,
      triggerContext: (row.trigger_context as Record<string, unknown>) || {},
      currentStepIndex: row.current_step_index as number,
      steps: stepResults,
      totalSteps,
      progress:
        totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      errorMessage: row.error_message as string | undefined,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | undefined,
    };
  }
}

// 单例
let stateManagerInstance: StateManager | null = null;

export function getStateManager(): StateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new StateManager();
  }
  return stateManagerInstance;
}
```

### 4.3 ExecutionEngine 实现

```typescript
// src/lib/workflow/engine/execution-engine.ts

import { getUnifiedEngine } from "@/lib/ai-skills/register";
import { logger } from "@/lib/logger";
import { getStateManager } from "../state/state-manager";
import type {
  WorkflowDefinition,
  WorkflowStep,
  StepResult,
  WorkflowContext,
  SkillStepConfig,
} from "../types";

/**
 * 工作流执行引擎
 *
 * Phase 1: 仅支持 skill 步骤的顺序执行
 */
export class ExecutionEngine {
  private activeExecutions = new Map<string, AbortController>();
  private stateManager = getStateManager();

  /**
   * 执行工作流
   */
  async execute(
    executionId: string,
    workflow: WorkflowDefinition,
    userId: string,
    triggerContext: Record<string, unknown> = {},
  ): Promise<void> {
    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    const context: WorkflowContext = {
      userId,
      workflowId: workflow.id,
      executionId,
      variables: { ...triggerContext, trigger: triggerContext },
      stepResults: {},
      abortSignal: abortController.signal,
    };

    try {
      // 更新状态为运行中
      await this.stateManager.updateStatus(executionId, "running");

      logger.info(
        {
          executionId,
          workflowId: workflow.id,
          stepCount: workflow.steps.length,
        },
        "ExecutionEngine: Starting workflow execution",
      );

      // 顺序执行每个步骤
      for (let i = 0; i < workflow.steps.length; i++) {
        // 检查取消信号
        if (abortController.signal.aborted) {
          logger.info({ executionId }, "ExecutionEngine: Execution cancelled");
          await this.stateManager.updateStatus(executionId, "cancelled");
          return;
        }

        const step = workflow.steps[i];
        await this.stateManager.updateCurrentStep(executionId, i);

        // 执行步骤
        const result = await this.executeStep(step, context);

        // 记录结果
        await this.stateManager.recordStepResult(executionId, result);
        context.stepResults[step.id] = result;

        // 更新变量
        if (result.output && typeof result.output === "object") {
          Object.assign(context.variables, result.output);
        }

        // 检查是否失败
        if (result.status === "failed") {
          const errorHandling = step.onError || "stop";

          if (errorHandling === "stop") {
            await this.stateManager.updateStatus(
              executionId,
              "failed",
              result.error,
            );
            logger.error(
              { executionId, stepId: step.id, error: result.error },
              "ExecutionEngine: Step failed, stopping workflow",
            );
            return;
          }

          // skip 或 continue: 记录错误但继续
          logger.warn(
            {
              executionId,
              stepId: step.id,
              error: result.error,
              handling: errorHandling,
            },
            "ExecutionEngine: Step failed, continuing",
          );
        }
      }

      // 全部完成
      await this.stateManager.updateStatus(executionId, "completed");
      logger.info(
        { executionId },
        "ExecutionEngine: Workflow completed successfully",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.stateManager.updateStatus(executionId, "failed", errorMessage);
      logger.error(
        { executionId, error: errorMessage },
        "ExecutionEngine: Workflow execution failed",
      );
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<StepResult> {
    const startTime = performance.now();
    const startedAt = new Date().toISOString();

    // 先记录开始状态
    const pendingResult: StepResult = {
      stepId: step.id,
      stepName: step.name,
      status: "running",
      startedAt,
    };
    await this.stateManager.recordStepResult(
      context.executionId,
      pendingResult,
    );

    try {
      let output: unknown;

      switch (step.type) {
        case "skill":
          output = await this.executeSkillStep(step, context);
          break;

        case "tool":
          // Phase 1: Tool 步骤暂时跳过
          logger.warn(
            { stepId: step.id },
            "ExecutionEngine: Tool step not implemented, skipping",
          );
          return {
            stepId: step.id,
            stepName: step.name,
            status: "skipped",
            duration: Math.round(performance.now() - startTime),
            startedAt,
            completedAt: new Date().toISOString(),
          };

        default:
          // Phase 1: 其他类型步骤暂时跳过
          logger.warn(
            { stepId: step.id, type: step.type },
            "ExecutionEngine: Step type not implemented, skipping",
          );
          return {
            stepId: step.id,
            stepName: step.name,
            status: "skipped",
            duration: Math.round(performance.now() - startTime),
            startedAt,
            completedAt: new Date().toISOString(),
          };
      }

      const duration = Math.round(performance.now() - startTime);

      logger.info(
        { stepId: step.id, stepName: step.name, duration },
        "ExecutionEngine: Step completed",
      );

      return {
        stepId: step.id,
        stepName: step.name,
        status: "completed",
        output,
        duration,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const duration = Math.round(performance.now() - startTime);

      logger.error(
        { stepId: step.id, stepName: step.name, error: errorMessage },
        "ExecutionEngine: Step failed",
      );

      return {
        stepId: step.id,
        stepName: step.name,
        status: "failed",
        error: errorMessage,
        duration,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 执行 Skill 步骤
   */
  private async executeSkillStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<unknown> {
    const config = step.config as SkillStepConfig;
    const engine = getUnifiedEngine();

    // 解析输入参数
    const input = this.resolveInputMapping(config.inputMapping, context);

    logger.info(
      { stepId: step.id, skillId: config.skillId, input },
      "ExecutionEngine: Executing skill step",
    );

    // 构建消息（将输入参数序列化为 JSON）
    const message = JSON.stringify({
      skillId: config.skillId,
      params: input,
    });

    // 调用 UnifiedEngine
    // 注意：需要根据 UnifiedEngine 实际接口调整
    const result = await engine.execute(
      { message, skillId: config.skillId },
      { userId: context.userId, conversationId: context.executionId },
    );

    // 处理输出映射
    if (config.outputMapping && result) {
      return this.applyOutputMapping(result, config.outputMapping);
    }

    return result;
  }

  /**
   * 解析输入映射
   */
  private resolveInputMapping(
    mapping: Record<string, string | unknown>,
    context: WorkflowContext,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(mapping)) {
      if (
        typeof value === "string" &&
        value.startsWith("${") &&
        value.endsWith("}")
      ) {
        // 变量引用：${varName} 或 ${step.output.field}
        const varPath = value.slice(2, -1);
        result[key] = this.getNestedValue(context.variables, varPath);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 应用输出映射
   */
  private applyOutputMapping(
    result: unknown,
    mapping: Record<string, string>,
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};

    if (result && typeof result === "object") {
      for (const [resultKey, varName] of Object.entries(mapping)) {
        output[varName] = this.getNestedValue(result, resultKey);
      }
    }

    return output;
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split(".").reduce((acc, key) => {
      if (acc && typeof acc === "object" && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * 取消执行
   */
  cancel(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort();
      logger.info({ executionId }, "ExecutionEngine: Cancellation requested");
      return true;
    }
    return false;
  }

  /**
   * 检查是否正在执行
   */
  isRunning(executionId: string): boolean {
    return this.activeExecutions.has(executionId);
  }
}

// 单例
let engineInstance: ExecutionEngine | null = null;

export function getExecutionEngine(): ExecutionEngine {
  if (!engineInstance) {
    engineInstance = new ExecutionEngine();
  }
  return engineInstance;
}
```

### 4.4 WorkflowOrchestrator 实现

```typescript
// src/lib/workflow/orchestrator/workflow-orchestrator.ts

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getStateManager } from "../state/state-manager";
import { getExecutionEngine } from "../engine/execution-engine";
import type {
  WorkflowDefinition,
  WorkflowExecution,
  TriggerType,
} from "../types";

/**
 * 工作流编排器
 *
 * 统一入口，协调执行引擎和状态管理
 */
export class WorkflowOrchestrator {
  private stateManager = getStateManager();
  private executionEngine = getExecutionEngine();

  /**
   * 启动工作流
   */
  async startWorkflow(
    workflowId: string,
    userId: string,
    options: {
      triggerType?: TriggerType;
      triggerContext?: Record<string, unknown>;
    } = {},
  ): Promise<WorkflowExecution> {
    const { triggerType = "manual", triggerContext = {} } = options;

    // 1. 加载工作流定义
    const workflow = await this.getWorkflowDefinition(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // 2. 创建执行记录
    const execution = await this.stateManager.createExecution(
      workflow,
      userId,
      triggerType,
      triggerContext,
    );

    logger.info(
      { executionId: execution.id, workflowId, userId, triggerType },
      "WorkflowOrchestrator: Workflow started",
    );

    // 3. 异步执行（不阻塞返回）
    this.executeAsync(execution.id, workflow, userId, triggerContext).catch(
      (error) => {
        logger.error(
          { executionId: execution.id, error: error.message },
          "WorkflowOrchestrator: Async execution failed",
        );
      },
    );

    return execution;
  }

  /**
   * 获取执行状态
   */
  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    return this.stateManager.getExecution(executionId);
  }

  /**
   * 取消工作流
   */
  async cancelWorkflow(executionId: string): Promise<boolean> {
    const cancelled = this.executionEngine.cancel(executionId);

    if (cancelled) {
      await this.stateManager.updateStatus(executionId, "cancelled");
      logger.info({ executionId }, "WorkflowOrchestrator: Workflow cancelled");
    }

    return cancelled;
  }

  /**
   * 列出用户的执行历史
   */
  async listExecutions(
    userId: string,
    options?: { limit?: number; status?: string },
  ): Promise<WorkflowExecution[]> {
    return this.stateManager.listExecutions(userId, options as never);
  }

  /**
   * 获取可用的工作流列表
   */
  async listWorkflows(userId: string): Promise<WorkflowDefinition[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .or(`category.eq.builtin,user_id.eq.${userId}`)
      .eq("enabled", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      logger.error(
        { error, userId },
        "WorkflowOrchestrator: Failed to list workflows",
      );
      return [];
    }

    return (data || []).map((row) => row.definition as WorkflowDefinition);
  }

  /**
   * 异步执行工作流
   */
  private async executeAsync(
    executionId: string,
    workflow: WorkflowDefinition,
    userId: string,
    triggerContext: Record<string, unknown>,
  ): Promise<void> {
    await this.executionEngine.execute(
      executionId,
      workflow,
      userId,
      triggerContext,
    );
  }

  /**
   * 获取工作流定义
   */
  private async getWorkflowDefinition(
    workflowId: string,
  ): Promise<WorkflowDefinition | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflows")
      .select("definition")
      .eq("id", workflowId)
      .single();

    if (error || !data) {
      // 尝试通过 definition.id 查找（内置工作流）
      const { data: builtinData } = await supabase
        .from("workflows")
        .select("definition")
        .eq("definition->>id", workflowId)
        .single();

      if (builtinData) {
        return builtinData.definition as WorkflowDefinition;
      }

      return null;
    }

    return data.definition as WorkflowDefinition;
  }
}

// 单例
let orchestratorInstance: WorkflowOrchestrator | null = null;

export function getWorkflowOrchestrator(): WorkflowOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new WorkflowOrchestrator();
  }
  return orchestratorInstance;
}
```

---

## 5. API 端点

### 5.1 启动工作流

```typescript
// src/app/api/workflow/start/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";
import { logger } from "@/lib/logger";
import { z } from "zod";

const startWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  triggerContext: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = startWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.errors },
        { status: 400 },
      );
    }

    const { workflowId, triggerContext = {} } = parsed.data;

    const orchestrator = getWorkflowOrchestrator();
    const execution = await orchestrator.startWorkflow(workflowId, user.id, {
      triggerType: "manual",
      triggerContext,
    });

    logger.info(
      { userId: user.id, workflowId, executionId: execution.id },
      "API: Workflow started",
    );

    return NextResponse.json({
      success: true,
      executionId: execution.id,
      status: execution.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ error: message }, "API: Failed to start workflow");

    return NextResponse.json(
      { error: "Failed to start workflow", message },
      { status: 500 },
    );
  }
}
```

### 5.2 获取执行状态

```typescript
// src/app/api/workflow/execution/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orchestrator = getWorkflowOrchestrator();
    const execution = await orchestrator.getExecution(params.id);

    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 },
      );
    }

    // 验证所有权
    if (execution.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(execution);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to get execution", message },
      { status: 500 },
    );
  }
}
```

### 5.3 取消工作流

```typescript
// src/app/api/workflow/execution/[id]/cancel/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";
import { logger } from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orchestrator = getWorkflowOrchestrator();
    const execution = await orchestrator.getExecution(params.id);

    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 },
      );
    }

    if (execution.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cancelled = await orchestrator.cancelWorkflow(params.id);

    logger.info(
      { userId: user.id, executionId: params.id, cancelled },
      "API: Cancel workflow requested",
    );

    return NextResponse.json({ success: true, cancelled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to cancel workflow", message },
      { status: 500 },
    );
  }
}
```

### 5.4 列出工作流

```typescript
// src/app/api/workflow/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orchestrator = getWorkflowOrchestrator();
    const workflows = await orchestrator.listWorkflows(user.id);

    return NextResponse.json({ workflows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list workflows", message },
      { status: 500 },
    );
  }
}
```

---

## 6. 验证工作流

### 6.1 书签健康巡检工作流（精简版）

```typescript
// src/lib/workflow/builtin/bookmark-health-simple.workflow.ts

import type { WorkflowDefinition } from "../types";

/**
 * Phase 1 验证工作流：书签健康巡检（精简版）
 *
 * 仅包含 2 个 Skill 步骤，用于验证核心引擎
 */
export const bookmarkHealthSimpleWorkflow: WorkflowDefinition = {
  id: "bookmark_health_simple",
  name: "书签健康巡检（简版）",
  description: "检测失效链接和重复书签，生成简要报告",
  version: "1.0.0",
  category: "builtin",

  triggers: [{ type: "manual" }],

  steps: [
    {
      id: "check_links",
      name: "检测失效链接",
      type: "skill",
      config: {
        skillId: "link_health_check",
        inputMapping: {
          scope: "all",
          batchSize: 50,
        },
        outputMapping: {
          brokenLinks: "brokenLinks",
          brokenCount: "brokenLinkCount",
        },
      },
      onError: "continue", // 失败不影响后续
    },
    {
      id: "detect_duplicates",
      name: "检测重复书签",
      type: "skill",
      config: {
        skillId: "duplicate_cleanup",
        inputMapping: {
          autoMerge: false,
        },
        outputMapping: {
          duplicateGroups: "duplicateGroups",
          duplicateCount: "duplicateCount",
        },
      },
      onError: "continue",
    },
  ],

  config: {
    timeout: 300000, // 5 分钟
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
```

### 6.2 初始化内置工作流脚本

```typescript
// src/lib/workflow/builtin/seed-builtin-workflows.ts

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { bookmarkHealthSimpleWorkflow } from "./bookmark-health-simple.workflow";

const BUILTIN_WORKFLOWS = [bookmarkHealthSimpleWorkflow];

/**
 * 初始化内置工作流到数据库
 */
export async function seedBuiltinWorkflows(): Promise<void> {
  const supabase = await createClient();

  for (const workflow of BUILTIN_WORKFLOWS) {
    // 检查是否已存在
    const { data: existing } = await supabase
      .from("workflows")
      .select("id")
      .eq("definition->>id", workflow.id)
      .single();

    if (existing) {
      // 更新现有工作流
      const { error } = await supabase
        .from("workflows")
        .update({
          name: workflow.name,
          description: workflow.description,
          definition: workflow,
        })
        .eq("id", existing.id);

      if (error) {
        logger.error(
          { error, workflowId: workflow.id },
          "Failed to update builtin workflow",
        );
      } else {
        logger.info({ workflowId: workflow.id }, "Updated builtin workflow");
      }
    } else {
      // 插入新工作流
      const { error } = await supabase.from("workflows").insert({
        user_id: null, // 内置工作流无 user_id
        name: workflow.name,
        description: workflow.description,
        definition: workflow,
        category: "builtin",
        enabled: true,
      });

      if (error) {
        logger.error(
          { error, workflowId: workflow.id },
          "Failed to insert builtin workflow",
        );
      } else {
        logger.info({ workflowId: workflow.id }, "Inserted builtin workflow");
      }
    }
  }
}
```

---

## 7. 模块导出

```typescript
// src/lib/workflow/index.ts

// Types
export * from "./types/workflow.types";
export * from "./types/database.types";

// Core modules
export {
  getWorkflowOrchestrator,
  WorkflowOrchestrator,
} from "./orchestrator/workflow-orchestrator";
export { getExecutionEngine, ExecutionEngine } from "./engine/execution-engine";
export { getStateManager, StateManager } from "./state/state-manager";

// Builtin workflows
export { bookmarkHealthSimpleWorkflow } from "./builtin/bookmark-health-simple.workflow";
export { seedBuiltinWorkflows } from "./builtin/seed-builtin-workflows";
```

---

## 8. 测试计划

### 8.1 单元测试

```typescript
// src/lib/workflow/__tests__/state-manager.test.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import { StateManager } from "../state/state-manager";

describe("StateManager", () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
    // Mock Supabase client
  });

  describe("createExecution", () => {
    it("should create execution with pending status", async () => {
      // Test implementation
    });
  });

  describe("updateStatus", () => {
    it("should update status and set completedAt for terminal states", async () => {
      // Test implementation
    });
  });

  describe("recordStepResult", () => {
    it("should append step result to execution", async () => {
      // Test implementation
    });

    it("should update existing step result", async () => {
      // Test implementation
    });
  });
});
```

### 8.2 集成测试

```typescript
// src/lib/workflow/__tests__/integration/workflow-execution.test.ts

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getWorkflowOrchestrator } from "../orchestrator";
import { bookmarkHealthSimpleWorkflow } from "../builtin/bookmark-health-simple.workflow";

describe("Workflow Execution Integration", () => {
  const orchestrator = getWorkflowOrchestrator();
  const testUserId = "test-user-id";

  beforeAll(async () => {
    // Setup test data
  });

  afterAll(async () => {
    // Cleanup
  });

  it("should execute bookmark_health_simple workflow end-to-end", async () => {
    const execution = await orchestrator.startWorkflow(
      bookmarkHealthSimpleWorkflow.id,
      testUserId,
    );

    expect(execution.id).toBeDefined();
    expect(execution.status).toBe("pending");

    // Wait for completion
    let currentExecution = execution;
    const maxWait = 60000; // 60 seconds
    const startTime = Date.now();

    while (
      currentExecution.status === "pending" ||
      currentExecution.status === "running"
    ) {
      if (Date.now() - startTime > maxWait) {
        throw new Error("Execution timeout");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      currentExecution = (await orchestrator.getExecution(execution.id))!;
    }

    expect(currentExecution.status).toBe("completed");
    expect(currentExecution.steps.length).toBeGreaterThan(0);
  });

  it("should be able to cancel running workflow", async () => {
    const execution = await orchestrator.startWorkflow(
      bookmarkHealthSimpleWorkflow.id,
      testUserId,
    );

    // Immediately cancel
    const cancelled = await orchestrator.cancelWorkflow(execution.id);
    expect(cancelled).toBe(true);

    // Check status
    const updatedExecution = await orchestrator.getExecution(execution.id);
    expect(updatedExecution?.status).toBe("cancelled");
  });
});
```

---

## 9. 实施步骤

### Phase 0: 接口验证 Spike（0.5 天）

| 序号 | 任务                                            | 预估时间 | 阻塞项   |
| ---- | ----------------------------------------------- | -------- | -------- |
| 0.1  | 阅读 UnifiedEngine.execute() 源码，确认返回类型 | 1h       | 无       |
| 0.2  | 阅读 OrchestrationEngine 公开 API               | 1h       | 无       |
| 0.3  | 设计 StreamResultCollector 方案                 | 1h       | 0.1      |
| 0.4  | 编写接口兼容性报告                              | 1h       | 0.1, 0.2 |

**Spike 产出**：

- 接口兼容性报告（确认接口签名或记录需要的适配方案）
- StreamResultCollector 设计文档
- 如发现重大不兼容，及时调整后续计划

### Day 1: 基础设施

| 序号 | 任务                                          | 预估时间 |
| ---- | --------------------------------------------- | -------- |
| 1.1  | 创建数据库迁移文件并执行                      | 30min    |
| 1.2  | 创建类型定义文件                              | 30min    |
| 1.3  | 实现 StreamResultCollector（基于 Spike 设计） | 1h       |
| 1.4  | 实现 StateManager                             | 2h       |
| 1.5  | 编写 StateManager 单元测试                    | 1h       |

### Day 2: 核心引擎

| 序号 | 任务                                               | 预估时间 |
| ---- | -------------------------------------------------- | -------- |
| 2.1  | 实现 ExecutionEngine（集成 StreamResultCollector） | 3h       |
| 2.2  | 实现 WorkflowOrchestrator                          | 1.5h     |
| 2.3  | 编写单元测试                                       | 1.5h     |

### Day 3: API 与验证

| 序号 | 任务                  | 预估时间 |
| ---- | --------------------- | -------- |
| 3.1  | 实现 API 端点（4 个） | 2h       |
| 3.2  | 创建验证工作流        | 30min    |
| 3.3  | 初始化内置工作流脚本  | 30min    |
| 3.4  | 集成测试              | 2h       |
| 3.5  | 文档更新              | 1h       |

### 风险缓冲

预留 0.5 天用于处理 Spike 发现的接口适配问题。

---

## 10. 文件清单

```
src/lib/workflow/
├── types/
│   ├── workflow.types.ts
│   └── database.types.ts
├── utils/
│   ├── stream-result-collector.ts   # 【新增】流式结果收集器
│   └── __tests__/
│       └── stream-result-collector.test.ts
├── state/
│   ├── state-manager.ts
│   └── __tests__/
│       └── state-manager.test.ts
├── engine/
│   ├── execution-engine.ts
│   └── __tests__/
│       └── execution-engine.test.ts
├── orchestrator/
│   ├── workflow-orchestrator.ts
│   └── __tests__/
│       └── workflow-orchestrator.test.ts
├── builtin/
│   ├── bookmark-health-simple.workflow.ts
│   ├── seed-builtin-workflows.ts
│   └── index.ts
├── __tests__/
│   └── integration/
│       └── workflow-execution.test.ts
└── index.ts

# Phase 0 Spike 产出
docs/specs/
└── workflow-interface-compatibility-report.md  # 【新增】接口兼容性报告

src/app/api/workflow/
├── route.ts                    # GET 列出工作流
├── start/
│   └── route.ts                # POST 启动工作流
└── execution/
    └── [id]/
        ├── route.ts            # GET 获取执行状态
        └── cancel/
            └── route.ts        # POST 取消工作流

supabase/migrations/
└── 20250108100001_add_workflow_tables_phase1.sql
```

---

## 11. 验收标准

### 11.1 功能验收

- [ ] 数据库迁移成功执行
- [ ] 内置工作流成功初始化
- [ ] `POST /api/workflow/start` 返回 executionId
- [ ] `GET /api/workflow/execution/:id` 返回正确状态
- [ ] `POST /api/workflow/execution/:id/cancel` 成功取消
- [ ] bookmark_health_simple 工作流完整执行

### 11.2 质量验收

- [ ] TypeScript 类型检查通过
- [ ] ESLint 检查通过
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] 无 console.log，使用 logger

### 11.3 性能验收

- [ ] 启动工作流响应时间 < 500ms
- [ ] 状态查询响应时间 < 200ms
- [ ] 工作流执行不阻塞 API 响应

---

## 12. 风险与缓解

| 风险                     | 概率 | 影响 | 缓解措施                 |
| ------------------------ | ---- | ---- | ------------------------ |
| UnifiedEngine 接口不兼容 | 中   | 高   | 提前验证接口，必要时适配 |
| Skill 执行超时           | 低   | 中   | 设置合理的步骤超时       |
| 数据库连接池耗尽         | 低   | 高   | 使用现有连接管理模式     |
| 状态更新竞态条件         | 低   | 中   | 使用乐观锁或事务         |

---

## 13. 后续阶段依赖

Phase 2（前端集成）需要本阶段提供：

- 稳定的 API 端点
- 完整的执行状态结构
- 工作流定义类型

Phase 3（AI 集成）需要本阶段提供：

- WorkflowOrchestrator 单例
- 工作流定义加载机制
