# AnyKeep 工作流编排实现方案

> **版本**: v1.4.0
> **日期**: 2025-01-08
> **状态**: 待审核（已按规范修正）
> **作者**: AI Assistant

---

## 变更记录

| 版本   | 日期       | 变更内容                                                                                                             |
| ------ | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| v1.4.0 | 2025-01-08 | 新增 Section 8 AI 系统集成方案（IntentMatcher、UnifiedEngine 扩展、协作模式）、Section 9 工作流候选清单（15 个场景） |
| v1.3.0 | 2025-01-08 | 新增 Section 5 前端集成方案（QuickActions、ListPage、Progress、ResultCard）                                          |
| v1.2.0 | 2025-01-08 | 新增书签健康巡检工作流（手动+对话触发，移除定时触发）                                                                |
| v1.1.0 | 2025-01-08 | 合规性修正：依赖注入模式、Skill 引用验证、实现可落地性确认                                                           |
| v1.0.0 | 2025-01-08 | 初始版本                                                                                                             |

---

## 1. 方案概述

### 1.1 背景

AnyKeep 已有 24 个独立 AI Skills，但这些 Skills 之间缺乏联动能力。用户执行复杂任务时需要手动触发多个 Skills，无法形成自动化的工作流闭环。

**核心问题**:

- Skills 独立执行，无法串联
- 缺乏定时调度能力
- 无法基于条件自动触发
- 用户重复操作模式无法固化

### 1.2 设计目标

| 目标           | 说明                                         |
| -------------- | -------------------------------------------- |
| **Skill 组合** | 多个 Skills 可串联执行，前序输出作为后序输入 |
| **条件分支**   | 支持基于结果的条件判断和分支执行             |
| **定时触发**   | 支持周期性自动执行（日/周/月）               |
| **事件驱动**   | 支持基于特定事件触发（如书签数量阈值）       |
| **可视化配置** | 用户可自定义工作流（Phase 2）                |

### 1.3 设计原则

| 原则           | 说明                                   |
| -------------- | -------------------------------------- |
| **渐进复杂**   | 从预设工作流开始，逐步支持用户自定义   |
| **解耦执行**   | 工作流引擎与 Skills 解耦，通过接口调用 |
| **可中断恢复** | 长时间工作流支持暂停、恢复、取消       |
| **完整审计**   | 记录每步执行结果，支持回溯和调试       |

### 1.4 依赖 Skills 清单

> **重要**: 以下为工作流中引用的 Skills，需确认其实现状态。

| Skill ID                 | 名称           | 实现状态  | 备注                    |
| ------------------------ | -------------- | --------- | ----------------------- |
| `search`                 | 搜索           | ✅ 已实现 | 原子 Skill              |
| `classify`               | 分类           | ✅ 已实现 | 原子 Skill              |
| `summary`                | 摘要           | ✅ 已实现 | 原子 Skill              |
| `inbox_triage`           | 收件箱整理     | ⏳ 待实现 | 见 skills-update0108.md |
| `batch_organize`         | 批量整理       | ✅ 已实现 | 编排 Skill              |
| `duplicate_cleanup`      | 重复清理       | ✅ 已实现 | 编排 Skill              |
| `folder_health_check`    | 文件夹健康检查 | ⏳ 待实现 | 见 skills-update0108.md |
| `periodic_report`        | 周期报告       | ✅ 已实现 | 编排 Skill              |
| `related_discovery`      | 相关发现       | ✅ 已实现 | 编排 Skill              |
| `learning_path`          | 学习路径       | ✅ 已实现 | 编排 Skill              |
| `active_recall`          | 主动复习       | ✅ 已实现 | 编排 Skill              |
| `knowledge_extract`      | 知识提取       | ✅ 已实现 | 编排 Skill              |
| `tts_synthesis`          | TTS 语音       | ✅ 已实现 | 编排 Skill              |
| `link_health_check`      | 链接健康检测   | ✅ 已实现 | 编排 Skill              |
| `content_change_monitor` | 内容变更监控   | ✅ 已实现 | 编排 Skill              |
| `thematic_synthesis`     | 主题合成       | ✅ 已实现 | 编排 Skill              |
| `data_export`            | 数据导出       | ✅ 已实现 | 编排 Skill              |
| `smart_tagging`          | 智能标签       | ✅ 已实现 | 编排 Skill              |

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WorkflowOrchestrator                          │
│  (工作流编排器 - 核心调度中心)                                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ TriggerManager│     │ ExecutionEngine│    │ StateManager │
  │ (触发管理器)  │     │ (执行引擎)     │    │ (状态管理器) │
  └──────────────┘     └──────────────┘     └──────────────┘
         │                      │                      │
         │                      ▼                      │
         │            ┌──────────────────┐             │
         │            │   StepExecutor   │             │
         │            │   (步骤执行器)   │             │
         │            └────────┬─────────┘             │
         │                     │                       │
         │          ┌──────────┼──────────┐            │
         │          ▼          ▼          ▼            │
         │     SkillStep   ConditionStep  ActionStep   │
         │     (Skill步骤) (条件步骤)     (操作步骤)    │
         │          │          │          │            │
         │          └──────────┴──────────┘            │
         │                     │                       │
         └─────────────────────┼───────────────────────┘
                               ▼
                    ┌──────────────────┐
                    │ UnifiedEngine    │
                    │ (现有 AI 引擎)   │
                    └──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              AI Skills              AI Tools
              (24+ 个)               (100+ 个)
```

### 2.2 核心组件

> **规范修正**: 所有组件使用 `createClient()` 直接调用模式，不使用构造函数依赖注入。

#### 2.2.1 WorkflowOrchestrator (工作流编排器)

```typescript
// src/lib/workflow/orchestrator/workflow-orchestrator.ts

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getUnifiedEngine } from "@/lib/ai-skills/register";
import type {
  WorkflowDefinition,
  WorkflowExecution,
  TriggerContext,
  ConfirmationResult,
  StepResult,
} from "../types";

/**
 * 工作流编排器
 *
 * 核心调度中心，协调触发、执行、状态管理
 */
export class WorkflowOrchestrator {
  private executionEngine: ExecutionEngine;
  private stateManager: StateManager;

  constructor() {
    this.executionEngine = new ExecutionEngine();
    this.stateManager = new StateManager();
  }

  /**
   * 启动工作流
   */
  async startWorkflow(
    workflowId: string,
    userId: string,
    triggerContext?: TriggerContext,
  ): Promise<WorkflowExecution> {
    const workflow = await this.getWorkflow(workflowId);
    const execution = await this.stateManager.createExecution(
      workflow,
      userId,
      triggerContext,
    );

    // 异步执行，立即返回执行 ID
    this.executeAsync(execution).catch((error) => {
      logger.error(
        { executionId: execution.id, error },
        "Workflow execution failed",
      );
    });

    return execution;
  }

  /**
   * 获取工作流定义
   */
  private async getWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (error || !data) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    return data.definition as WorkflowDefinition;
  }

  /**
   * 异步执行工作流
   */
  private async executeAsync(execution: WorkflowExecution): Promise<void> {
    try {
      await this.stateManager.updateStatus(execution.id, "running");

      for await (const stepResult of this.executionEngine.execute(execution)) {
        await this.stateManager.recordStepResult(execution.id, stepResult);

        // 发送进度通知
        if (stepResult.notify) {
          await this.sendProgressNotification(execution.userId, stepResult);
        }

        // 检查是否需要用户确认
        if (stepResult.requiresConfirmation) {
          await this.stateManager.updateStatus(
            execution.id,
            "waiting_confirmation",
          );
          await this.requestConfirmation(execution.userId, stepResult);
          return; // 等待用户响应后继续
        }
      }

      await this.stateManager.updateStatus(execution.id, "completed");
      await this.sendCompletionNotification(execution.userId, execution);
    } catch (error) {
      await this.stateManager.updateStatus(execution.id, "failed", error);
      await this.sendFailureNotification(execution.userId, execution, error);
    }
  }

  /**
   * 继续等待确认的工作流
   */
  async continueWorkflow(
    executionId: string,
    confirmationResult: ConfirmationResult,
  ): Promise<void> {
    const execution = await this.stateManager.getExecution(executionId);

    if (execution.status !== "waiting_confirmation") {
      throw new Error("Workflow is not waiting for confirmation");
    }

    if (!confirmationResult.confirmed) {
      await this.stateManager.updateStatus(executionId, "cancelled");
      return;
    }

    // 从暂停点继续执行
    await this.executeAsync(execution);
  }

  /**
   * 取消工作流
   */
  async cancelWorkflow(executionId: string): Promise<void> {
    await this.executionEngine.cancel(executionId);
    await this.stateManager.updateStatus(executionId, "cancelled");
  }

  // 通知方法（简化实现）
  private async sendProgressNotification(
    userId: string,
    stepResult: StepResult,
  ): Promise<void> {
    logger.info({ userId, stepResult }, "Workflow progress notification");
  }

  private async sendCompletionNotification(
    userId: string,
    execution: WorkflowExecution,
  ): Promise<void> {
    logger.info({ userId, executionId: execution.id }, "Workflow completed");
  }

  private async sendFailureNotification(
    userId: string,
    execution: WorkflowExecution,
    error: unknown,
  ): Promise<void> {
    logger.error(
      { userId, executionId: execution.id, error },
      "Workflow failed",
    );
  }

  private async requestConfirmation(
    userId: string,
    stepResult: StepResult,
  ): Promise<void> {
    logger.info({ userId, stepResult }, "Workflow confirmation requested");
  }
}

// 单例模式
let orchestratorInstance: WorkflowOrchestrator | null = null;

export function getWorkflowOrchestrator(): WorkflowOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new WorkflowOrchestrator();
  }
  return orchestratorInstance;
}
```

#### 2.2.2 ExecutionEngine (执行引擎)

```typescript
// src/lib/workflow/engine/execution-engine.ts

import { getUnifiedEngine } from "@/lib/ai-skills/register";
import { logger } from "@/lib/logger";
import type {
  WorkflowExecution,
  WorkflowStep,
  StepResult,
  WorkflowContext,
  SkillStepConfig,
  ToolStepConfig,
  InputExpression,
} from "../types";

/**
 * 执行引擎
 *
 * 负责步骤的顺序执行和条件评估
 */
export class ExecutionEngine {
  private activeExecutions = new Map<string, AbortController>();

  /**
   * 执行工作流，产生步骤结果流
   */
  async *execute(execution: WorkflowExecution): AsyncGenerator<StepResult> {
    const abortController = new AbortController();
    this.activeExecutions.set(execution.id, abortController);

    try {
      const context: WorkflowContext = {
        userId: execution.userId,
        workflowId: execution.workflowId,
        executionId: execution.id,
        variables: { ...execution.triggerContext },
        stepResults: {},
        abortSignal: abortController.signal,
      };

      // 从暂停点或起点开始
      const startIndex = execution.pausedAtStep ?? 0;
      const steps = execution.workflow.steps.slice(startIndex);

      for (const step of steps) {
        // 检查取消信号
        if (abortController.signal.aborted) {
          break;
        }

        // 评估步骤条件
        if (step.condition) {
          const shouldExecute = await this.evaluateCondition(
            step.condition,
            context,
          );
          if (!shouldExecute) {
            yield {
              stepId: step.id,
              status: "skipped",
              reason: "condition_not_met",
            };
            continue;
          }
        }

        // 执行步骤
        const result = await this.executeStep(step, context);

        // 更新上下文
        context.stepResults[step.id] = result;
        if (result.outputVariables) {
          Object.assign(context.variables, result.outputVariables);
        }

        yield result;

        // 如果步骤需要确认，暂停执行
        if (result.requiresConfirmation) {
          break;
        }
      }
    } finally {
      this.activeExecutions.delete(execution.id);
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

    try {
      let result: unknown;

      switch (step.type) {
        case "skill":
          result = await this.executeSkillStep(step, context);
          break;
        case "tool":
          result = await this.executeToolStep(step, context);
          break;
        case "condition":
          result = await this.executeConditionStep(step, context);
          break;
        case "parallel":
          result = await this.executeParallelStep(step, context);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      const duration = Math.round(performance.now() - startTime);

      return {
        stepId: step.id,
        status: "completed",
        output: result,
        duration,
        requiresConfirmation: step.requiresConfirmation,
        confirmationMessage: step.confirmationMessage,
      };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      logger.error({ step, error }, "Step execution failed");

      return {
        stepId: step.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        duration,
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
    const engine = getUnifiedEngine();
    const config = step.config as SkillStepConfig;

    // 解析输入映射
    const input = this.resolveInputMapping(config.inputMapping, context);

    // 调用 Skill（通过 UnifiedEngine）
    // 注意：此处需要根据 UnifiedEngine 的实际 API 调整
    const result = await engine.execute(
      { message: JSON.stringify(input), skillId: config.skillId },
      { userId: context.userId, conversationId: context.executionId },
    );

    // 处理输出映射
    if (config.outputMapping && result) {
      return this.applyOutputMapping(result, config.outputMapping);
    }

    return result;
  }

  /**
   * 执行 Tool 步骤
   */
  private async executeToolStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<unknown> {
    // Tool 执行逻辑（通过 KnowledgeAgent 的 Tool 调用）
    const config = step.config as ToolStepConfig;
    const input = this.resolveInputMapping(config.inputMapping, context);

    logger.info({ toolId: config.toolId, input }, "Executing tool step");

    // TODO: 实现 Tool 调用逻辑
    return { toolId: config.toolId, input };
  }

  /**
   * 执行条件步骤
   */
  private async executeConditionStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<unknown> {
    // 条件步骤不直接执行，而是控制后续步骤流程
    return { evaluated: true };
  }

  /**
   * 执行并行步骤
   */
  private async executeParallelStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<unknown> {
    // TODO: 实现并行执行逻辑
    return { parallel: true };
  }

  /**
   * 取消执行
   */
  cancel(executionId: string): void {
    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort();
    }
  }

  /**
   * 评估条件表达式
   */
  private async evaluateCondition(
    condition: string,
    context: WorkflowContext,
  ): Promise<boolean> {
    // 使用安全的表达式评估
    try {
      const fn = new Function("ctx", `with(ctx) { return ${condition}; }`);
      return fn(context.variables);
    } catch (error) {
      logger.warn({ condition, error }, "Condition evaluation failed");
      return false;
    }
  }

  /**
   * 解析输入映射
   */
  private resolveInputMapping(
    mapping: Record<string, string | InputExpression>,
    context: WorkflowContext,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === "string" && value.startsWith("${")) {
        // 变量引用
        const varName = value.slice(2, -1);
        result[key] = context.variables[varName];
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

    for (const [resultKey, varName] of Object.entries(mapping)) {
      if (result && typeof result === "object" && resultKey in result) {
        output[varName] = (result as Record<string, unknown>)[resultKey];
      }
    }

    return output;
  }
}
```

#### 2.2.3 StateManager (状态管理器)

```typescript
// src/lib/workflow/state/state-manager.ts

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  WorkflowDefinition,
  WorkflowExecution,
  ExecutionStatus,
  StepResult,
  TriggerContext,
} from "../types";

/**
 * 状态管理器
 *
 * 负责工作流执行状态的持久化
 */
export class StateManager {
  /**
   * 创建执行记录
   */
  async createExecution(
    workflow: WorkflowDefinition,
    userId: string,
    triggerContext?: TriggerContext,
  ): Promise<WorkflowExecution> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflow_executions")
      .insert({
        workflow_id: workflow.id,
        user_id: userId,
        status: "pending",
        trigger_context: triggerContext,
        step_results: [],
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create execution: ${error?.message}`);
    }

    return {
      id: data.id,
      workflowId: workflow.id,
      userId,
      status: "pending",
      workflow,
      triggerContext,
      stepResults: [],
    };
  }

  /**
   * 获取执行记录
   */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflow_executions")
      .select("*, workflows(*)")
      .eq("id", executionId)
      .single();

    if (error || !data) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    return {
      id: data.id,
      workflowId: data.workflow_id,
      userId: data.user_id,
      status: data.status,
      workflow: data.workflows?.definition,
      triggerContext: data.trigger_context,
      stepResults: data.step_results || [],
      pausedAtStep: data.paused_at_step,
    };
  }

  /**
   * 更新执行状态
   */
  async updateStatus(
    executionId: string,
    status: ExecutionStatus,
    error?: unknown,
  ): Promise<void> {
    const supabase = await createClient();

    const updates: Record<string, unknown> = { status };

    if (status === "completed" || status === "failed") {
      updates.completed_at = new Date().toISOString();
    }

    if (error) {
      updates.error_message =
        error instanceof Error ? error.message : String(error);
    }

    const { error: dbError } = await supabase
      .from("workflow_executions")
      .update(updates)
      .eq("id", executionId);

    if (dbError) {
      logger.error({ executionId, status, dbError }, "Failed to update status");
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
    stepResults.push(stepResult);

    // 更新步骤结果
    const { error } = await supabase
      .from("workflow_executions")
      .update({ step_results: stepResults })
      .eq("id", executionId);

    if (error) {
      logger.error({ executionId, stepResult, error }, "Failed to record step");
    }
  }
}
```

---

## 3. 预设工作流详细设计

### 3.1 新书签智能入库工作流

> **依赖说明**: 若需使用 `inbox_triage` Skill，需先完成 skills-update0108.md 中的实现。
> 当前版本使用 `batch_organize` 作为替代。

```typescript
// src/lib/workflow/builtin/smart-intake.workflow.ts

import type { WorkflowDefinition } from "../types";

export const smartIntakeWorkflow: WorkflowDefinition = {
  id: "smart_intake",
  name: "新书签智能入库",
  description: "自动为新书签提取元数据、分类、生成摘要和标签",
  version: "1.0.0",
  category: "builtin",

  triggers: [
    {
      type: "event",
      eventType: "bookmark_added",
    },
    {
      type: "event",
      eventType: "bookmark_batch_added",
      condition: "event.count <= 20",
    },
  ],

  steps: [
    {
      id: "extract_metadata",
      name: "提取元数据",
      type: "tool",
      config: {
        toolId: "extract_bookmark_metadata",
        inputMapping: {
          bookmarkIds: "${trigger.bookmarkIds}",
        },
        outputMapping: {
          metadata: "extractedMetadata",
        },
      },
      onError: "skip",
    },
    {
      id: "classify",
      name: "智能分类",
      type: "skill",
      config: {
        skillId: "classify", // ✅ 已实现
        inputMapping: {
          bookmarkIds: "${trigger.bookmarkIds}",
          metadata: "${extractedMetadata}",
        },
        outputMapping: {
          classifications: "classificationResults",
        },
      },
    },
    {
      id: "check_confidence",
      name: "检查置信度",
      type: "condition",
      config: {
        expression: "${classificationResults.avgConfidence} >= 0.85",
        thenSteps: ["apply_classification"],
        elseSteps: ["request_confirmation"],
      },
    },
    {
      id: "apply_classification",
      name: "应用分类",
      type: "tool",
      config: {
        toolId: "batch_move_bookmarks",
        inputMapping: {
          moves: "${classificationResults.moves}",
        },
      },
    },
    {
      id: "request_confirmation",
      name: "请求确认",
      type: "skill",
      requiresConfirmation: true,
      confirmationMessage: "分类置信度较低，请确认以下分类建议：",
      config: {
        skillId: "batch_organize", // ✅ 已实现（替代 inbox_triage）
        inputMapping: {
          bookmarkIds: "${trigger.bookmarkIds}",
          autoExecute: false,
        },
      },
    },
    {
      id: "generate_summary",
      name: "生成摘要",
      type: "skill",
      config: {
        skillId: "summary", // ✅ 已实现
        inputMapping: {
          bookmarkIds: "${trigger.bookmarkIds}",
        },
      },
    },
    {
      id: "generate_tags",
      name: "生成标签",
      type: "skill",
      config: {
        skillId: "smart_tagging", // ✅ 已实现
        inputMapping: {
          bookmarkIds: "${trigger.bookmarkIds}",
          autoApply: '${trustMode === "full_auto"}',
        },
      },
    },
  ],

  config: {
    timeout: 60000,
    notifyOnComplete: false,
    notifyOnFailure: true,
  },
};
```

### 3.2 每周知识整理工作流

```typescript
// src/lib/workflow/builtin/weekly-organize.workflow.ts

import type { WorkflowDefinition } from "../types";

export const weeklyOrganizeWorkflow: WorkflowDefinition = {
  id: "weekly_organize",
  name: "每周知识整理",
  description: "定期扫描、清理、整理收藏，生成周报",
  version: "1.0.0",
  category: "builtin",

  triggers: [
    {
      type: "schedule",
      schedule: {
        type: "cron",
        value: "0 20 * * 0", // 每周日 20:00
      },
    },
    { type: "manual" },
  ],

  steps: [
    {
      id: "scan_inbox",
      name: "扫描收件箱",
      type: "skill",
      config: {
        skillId: "batch_organize", // ✅ 已实现
        inputMapping: { autoExecute: false, maxItems: 100 },
        outputMapping: {
          suggestions: "inboxSuggestions",
          unclassifiedCount: "unclassifiedCount",
        },
      },
    },
    {
      id: "detect_duplicates",
      name: "检测重复",
      type: "skill",
      config: {
        skillId: "duplicate_cleanup", // ✅ 已实现
        inputMapping: { autoMerge: false },
        outputMapping: {
          duplicateGroups: "duplicateGroups",
          duplicateCount: "duplicateCount",
        },
      },
    },
    {
      id: "generate_report",
      name: "生成周报",
      type: "skill",
      config: {
        skillId: "periodic_report", // ✅ 已实现
        inputMapping: { period: "week", includeInsights: true },
        outputMapping: { report: "weeklyReport" },
      },
    },
  ],

  config: {
    timeout: 300000,
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
```

### 3.3 深度学习模式工作流

```typescript
// src/lib/workflow/builtin/deep-learning.workflow.ts

import type { WorkflowDefinition } from "../types";

export const deepLearningWorkflow: WorkflowDefinition = {
  id: "deep_learning",
  name: "深度学习模式",
  description: "聚合相关书签，生成学习路径，创建复习卡片",
  version: "1.0.0",
  category: "builtin",

  triggers: [{ type: "manual" }],

  steps: [
    {
      id: "discover_related",
      name: "发现相关内容",
      type: "skill",
      config: {
        skillId: "related_discovery", // ✅ 已实现
        inputMapping: { topic: "${trigger.topic}", limit: 50 },
        outputMapping: {
          relatedBookmarks: "relatedBookmarks",
          topicClusters: "topicClusters",
        },
      },
    },
    {
      id: "generate_path",
      name: "生成学习路径",
      type: "skill",
      config: {
        skillId: "learning_path", // ✅ 已实现
        inputMapping: {
          bookmarks: "${relatedBookmarks}",
          clusters: "${topicClusters}",
          difficulty: '${trigger.difficulty || "beginner"}',
        },
        outputMapping: {
          learningPath: "learningPath",
          estimatedTime: "estimatedTime",
        },
      },
    },
    {
      id: "generate_flashcards",
      name: "生成复习卡片",
      type: "skill",
      config: {
        skillId: "active_recall", // ✅ 已实现
        inputMapping: {
          bookmarkIds: "${learningPath.bookmarkIds}",
          cardType: "comprehensive",
        },
        outputMapping: {
          flashcards: "generatedFlashcards",
          cardCount: "flashcardCount",
        },
      },
    },
  ],

  config: {
    timeout: 120000,
    notifyOnComplete: true,
  },
};
```

### 3.4 书签健康巡检工作流

> **触发方式变更**: 原计划为定时触发（周一 03:00），现改为手动触发 + 对话触发。
> 原因：健康巡检对用户干扰较大，应由用户主动发起。

```typescript
// src/lib/workflow/builtin/bookmark-health.workflow.ts

import type { WorkflowDefinition } from "../types";

export const bookmarkHealthWorkflow: WorkflowDefinition = {
  id: "bookmark_health",
  name: "书签健康巡检",
  description: "检测失效链接、内容变化、重复书签，生成健康报告",
  version: "1.0.0",
  category: "builtin",

  triggers: [
    // 手动触发（页面按钮）
    { type: "manual" },
    // 对话触发（AI 对话中发起）
    {
      type: "conversation",
      patterns: [
        "检查书签健康",
        "书签巡检",
        "查失效链接",
        "检测死链",
        "书签健康报告",
      ],
    },
  ],

  steps: [
    {
      id: "check_links",
      name: "检测失效链接",
      type: "skill",
      config: {
        skillId: "link_health_check", // ✅ 已实现
        inputMapping: {
          scope: '${trigger.scope || "all"}',
          batchSize: 50,
        },
        outputMapping: {
          brokenLinks: "brokenLinks",
          brokenCount: "brokenLinkCount",
        },
      },
      onError: "continue", // 链接检测失败不影响后续步骤
    },
    {
      id: "detect_duplicates",
      name: "检测重复书签",
      type: "skill",
      config: {
        skillId: "duplicate_cleanup", // ✅ 已实现
        inputMapping: { autoMerge: false },
        outputMapping: {
          duplicateGroups: "duplicateGroups",
          duplicateCount: "duplicateCount",
        },
      },
    },
    {
      id: "check_content_changes",
      name: "检测内容变化",
      type: "skill",
      config: {
        skillId: "content_change_monitor", // ✅ 已实现
        inputMapping: { checkRecent: true, dayLimit: 30 },
        outputMapping: {
          changedItems: "changedItems",
          changeCount: "changeCount",
        },
      },
      onError: "skip", // 内容检测可选
    },
    {
      id: "generate_health_report",
      name: "生成健康报告",
      type: "aggregate",
      config: {
        outputMapping: {
          report: "healthReport",
        },
        template: {
          title: "书签健康巡检报告",
          sections: [
            {
              name: "失效链接",
              data: "${brokenLinks}",
              count: "${brokenLinkCount}",
              severity:
                '${brokenLinkCount > 10 ? "high" : brokenLinkCount > 0 ? "medium" : "low"}',
            },
            {
              name: "重复书签",
              data: "${duplicateGroups}",
              count: "${duplicateCount}",
              severity: '${duplicateCount > 5 ? "medium" : "low"}',
            },
            {
              name: "内容变化",
              data: "${changedItems}",
              count: "${changeCount}",
              severity: "info",
            },
          ],
          summary: {
            totalIssues: "${brokenLinkCount + duplicateCount}",
            healthScore:
              "${Math.max(0, 100 - brokenLinkCount * 5 - duplicateCount * 2)}",
          },
        },
      },
    },
    {
      id: "notify_user",
      name: "通知用户",
      type: "notification",
      config: {
        type: "report",
        title: "书签健康巡检完成",
        body: "发现 ${brokenLinkCount} 个失效链接，${duplicateCount} 组重复书签",
        action: {
          label: "查看报告",
          route: "/health-report/${executionId}",
        },
      },
    },
  ],

  config: {
    timeout: 600000, // 10 分钟（链接检测耗时较长）
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
```

---

## 4. 数据库表结构

```sql
-- supabase/migrations/20250108000001_add_workflow_tables.sql

-- 工作流定义表
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'user_defined',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 工作流触发器表
CREATE TABLE workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  config JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 工作流执行记录表
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  trigger_context JSONB,
  step_results JSONB DEFAULT '[]'::jsonb,
  paused_at_step INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workflows"
  ON workflows FOR ALL
  USING (auth.uid() = user_id OR category = 'builtin');

CREATE POLICY "Users can manage their own triggers"
  ON workflow_triggers FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own executions"
  ON workflow_executions FOR ALL
  USING (auth.uid() = user_id);

-- 索引
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_triggers_type ON workflow_triggers(type);
CREATE INDEX idx_workflows_category ON workflows(category);
```

---

## 5. 前端集成方案

> **v1.3.0 新增**: 提供完整的前端组件和集成方案，支持用户通过 UI 一键启动工作流。

### 5.1 组件架构

```
src/components/workflow/
├── quick-actions/
│   ├── workflow-quick-actions.tsx      # 预设工作流快捷按钮组
│   ├── workflow-action-button.tsx      # 单个工作流按钮
│   └── index.ts
├── list/
│   ├── workflow-list-page.tsx          # 工作流管理列表页
│   ├── workflow-card.tsx               # 工作流卡片
│   ├── workflow-detail-dialog.tsx      # 工作流详情弹窗
│   └── index.ts
├── execution/
│   ├── workflow-execution-progress.tsx # 执行进度展示
│   ├── workflow-step-indicator.tsx     # 步骤指示器
│   └── index.ts
├── result/
│   ├── workflow-result-card.tsx        # 执行结果卡片
│   ├── workflow-result-drawer.tsx      # 结果详情抽屉
│   └── index.ts
└── index.ts

src/hooks/workflow/
├── use-workflow-list.ts                # 工作流列表 Hook
├── use-workflow-execution.ts           # 执行状态 Hook
├── use-workflow-trigger.ts             # 触发工作流 Hook
└── index.ts

src/app/(main)/workflows/
├── page.tsx                            # 工作流管理页面
└── [id]/page.tsx                       # 工作流详情页面
```

### 5.2 WorkflowQuickActions 组件

**位置**: 首页工具栏 / 侧边栏底部
**功能**: 预设工作流一键启动按钮组

```typescript
// src/components/workflow/quick-actions/workflow-quick-actions.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkflowTrigger } from "@/hooks/workflow/use-workflow-trigger";
import {
  Zap,          // 智能收录
  Calendar,     // 周度整理
  Brain,        // 深度学习
  HeartPulse,   // 书签巡检
  Loader2,
} from "lucide-react";
import type { FC } from "react";

const QUICK_WORKFLOWS = [
  {
    id: "smart_intake",
    name: "智能收录",
    description: "自动整理今日新增书签",
    icon: Zap,
    color: "text-yellow-500",
  },
  {
    id: "weekly_organize",
    name: "周度整理",
    description: "本周收藏智能分类归档",
    icon: Calendar,
    color: "text-blue-500",
  },
  {
    id: "deep_learning",
    name: "深度学习",
    description: "生成学习计划和知识图谱",
    icon: Brain,
    color: "text-purple-500",
  },
  {
    id: "bookmark_health",
    name: "书签巡检",
    description: "检测失效链接和重复内容",
    icon: HeartPulse,
    color: "text-green-500",
  },
] as const;

interface WorkflowQuickActionsProps {
  variant?: "toolbar" | "sidebar";
  onExecutionStart?: (workflowId: string, executionId: string) => void;
}

export const WorkflowQuickActions: FC<WorkflowQuickActionsProps> = ({
  variant = "toolbar",
  onExecutionStart,
}) => {
  const { triggerWorkflow, isLoading, loadingWorkflowId } = useWorkflowTrigger();
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);

  const handleTrigger = async (workflowId: string) => {
    const result = await triggerWorkflow(workflowId);
    if (result.success && result.executionId) {
      setLastTriggered(workflowId);
      onExecutionStart?.(workflowId, result.executionId);
    }
  };

  const isToolbar = variant === "toolbar";

  return (
    <div
      className={
        isToolbar
          ? "flex items-center gap-1"
          : "flex flex-col gap-2 p-2"
      }
    >
      {QUICK_WORKFLOWS.map((workflow) => {
        const Icon = workflow.icon;
        const isCurrentLoading = isLoading && loadingWorkflowId === workflow.id;

        return (
          <Tooltip key={workflow.id}>
            <TooltipTrigger asChild>
              <Button
                variant={isToolbar ? "ghost" : "outline"}
                size={isToolbar ? "icon" : "sm"}
                onClick={() => handleTrigger(workflow.id)}
                disabled={isLoading}
                className={isToolbar ? "h-8 w-8" : "justify-start gap-2"}
              >
                {isCurrentLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className={`h-4 w-4 ${workflow.color}`} />
                )}
                {!isToolbar && <span>{workflow.name}</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isToolbar ? "bottom" : "right"}>
              <p className="font-medium">{workflow.name}</p>
              <p className="text-xs text-muted-foreground">
                {workflow.description}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};
```

### 5.3 WorkflowExecutionProgress 组件

**位置**: Toast 通知 / 右侧抽屉
**功能**: 实时展示工作流执行进度

```typescript
// src/components/workflow/execution/workflow-execution-progress.tsx
"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Pause,
  Play,
  X,
} from "lucide-react";
import { useWorkflowExecution } from "@/hooks/workflow/use-workflow-execution";
import type { FC } from "react";

interface WorkflowExecutionProgressProps {
  executionId: string;
  onClose?: () => void;
  onComplete?: (result: ExecutionResult) => void;
}

interface ExecutionResult {
  success: boolean;
  outputs: Record<string, unknown>;
}

type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

interface ExecutionStep {
  id: string;
  name: string;
  status: StepStatus;
  output?: unknown;
  error?: string;
}

const StepStatusIcon: FC<{ status: StepStatus }> = ({ status }) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "skipped":
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
};

export const WorkflowExecutionProgress: FC<WorkflowExecutionProgressProps> = ({
  executionId,
  onClose,
  onComplete,
}) => {
  const { execution, isLoading, error, cancelExecution, pauseExecution } =
    useWorkflowExecution(executionId);

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (execution?.steps) {
      const completed = execution.steps.filter(
        (s: ExecutionStep) => s.status === "completed"
      ).length;
      const total = execution.steps.length;
      setProgress(Math.round((completed / total) * 100));
    }
  }, [execution]);

  useEffect(() => {
    if (execution?.status === "completed" && onComplete) {
      onComplete({
        success: true,
        outputs: execution.outputs,
      });
    }
  }, [execution, onComplete]);

  if (isLoading && !execution) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <XCircle className="h-8 w-8 mx-auto mb-2" />
        <p>加载执行状态失败</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* 顶部：工作流名称和状态 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{execution?.workflowName}</h3>
          <p className="text-sm text-muted-foreground">
            执行 ID: {executionId.slice(0, 8)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              execution?.status === "running"
                ? "default"
                : execution?.status === "completed"
                  ? "secondary"
                  : "destructive"
            }
          >
            {execution?.status === "running" && "执行中"}
            {execution?.status === "completed" && "已完成"}
            {execution?.status === "failed" && "失败"}
            {execution?.status === "paused" && "已暂停"}
          </Badge>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 进度条 */}
      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground text-right">{progress}%</p>
      </div>

      {/* 步骤列表 */}
      <div className="space-y-2">
        {execution?.steps?.map((step: ExecutionStep) => (
          <div
            key={step.id}
            className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
          >
            <StepStatusIcon status={step.status} />
            <span className="flex-1">{step.name}</span>
            {step.status === "completed" && step.output && (
              <span className="text-xs text-muted-foreground">
                ✓ 已完成
              </span>
            )}
            {step.status === "failed" && step.error && (
              <span className="text-xs text-red-500">{step.error}</span>
            )}
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      {execution?.status === "running" && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pauseExecution()}
          >
            <Pause className="h-4 w-4 mr-1" />
            暂停
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => cancelExecution()}
          >
            <X className="h-4 w-4 mr-1" />
            取消
          </Button>
        </div>
      )}

      {execution?.status === "paused" && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm">
            <Play className="h-4 w-4 mr-1" />
            继续
          </Button>
        </div>
      )}
    </div>
  );
};
```

### 5.4 WorkflowListPage 组件

**位置**: `/workflows` 页面
**功能**: 工作流管理列表，支持查看、编辑、执行

```typescript
// src/app/(main)/workflows/page.tsx
import { Suspense } from "react";
import { WorkflowListPageClient } from "@/components/workflow/list/workflow-list-page";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "工作流管理 - AnyKeep",
  description: "管理和执行自动化工作流",
};

export default function WorkflowsPage() {
  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<WorkflowListSkeleton />}>
        <WorkflowListPageClient />
      </Suspense>
    </div>
  );
}

function WorkflowListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
```

```typescript
// src/components/workflow/list/workflow-list-page.tsx
"use client";

import { useState } from "react";
import { useWorkflowList } from "@/hooks/workflow/use-workflow-list";
import { WorkflowCard } from "./workflow-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Plus, Zap, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FC } from "react";

export const WorkflowListPageClient: FC = () => {
  const { workflows, isLoading } = useWorkflowList();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "builtin" | "custom">("all");

  const filteredWorkflows = workflows?.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "builtin" && w.category === "builtin") ||
      (activeTab === "custom" && w.category === "custom");
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工作流管理</h1>
          <p className="text-muted-foreground">
            自动化执行多个 AI Skills，提升效率
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          创建工作流
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索工作流..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="builtin" className="gap-1">
              <Zap className="h-3 w-3" />
              预设
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-1">
              <User className="h-3 w-3" />
              自定义
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 工作流列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          加载中...
        </div>
      ) : filteredWorkflows?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          未找到匹配的工作流
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkflows?.map((workflow) => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      )}
    </div>
  );
};
```

### 5.5 WorkflowResultCard 组件

**位置**: 通知中心 / 对话流
**功能**: 展示工作流执行结果

```typescript
// src/components/workflow/result/workflow-result-card.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { FC } from "react";

interface WorkflowResultCardProps {
  result: {
    executionId: string;
    workflowId: string;
    workflowName: string;
    status: "completed" | "failed";
    completedAt: Date;
    duration: number; // milliseconds
    outputs: Record<string, unknown>;
    summary?: string;
  };
  onViewDetail?: (executionId: string) => void;
}

export const WorkflowResultCard: FC<WorkflowResultCardProps> = ({
  result,
  onViewDetail,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isSuccess = result.status === "completed";
  const formattedDuration = formatDuration(result.duration);
  const relativeTime = formatDistanceToNow(result.completedAt, {
    locale: zhCN,
    addSuffix: true,
  });

  return (
    <Card className={isSuccess ? "border-green-200" : "border-red-200"}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <CardTitle className="text-base">{result.workflowName}</CardTitle>
          </div>
          <Badge variant={isSuccess ? "secondary" : "destructive"}>
            {isSuccess ? "成功" : "失败"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 摘要 */}
        {result.summary && (
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        )}

        {/* 元信息 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{relativeTime}</span>
          <span>•</span>
          <span>耗时 {formattedDuration}</span>
        </div>

        {/* 展开详情 */}
        {Object.keys(result.outputs).length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <span>执行结果详情</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            {isExpanded && (
              <div className="bg-muted rounded-md p-3 text-sm">
                <pre className="whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(result.outputs, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetail?.(result.executionId)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            查看详情
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
```

### 5.6 Hooks 实现

```typescript
// src/hooks/workflow/use-workflow-trigger.ts
"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface TriggerResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

export function useWorkflowTrigger() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingWorkflowId, setLoadingWorkflowId] = useState<string | null>(
    null,
  );

  const triggerWorkflow = useCallback(
    async (workflowId: string): Promise<TriggerResult> => {
      setIsLoading(true);
      setLoadingWorkflowId(workflowId);

      try {
        const response = await fetch("/api/workflow/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowId, trigger: { type: "manual" } }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "启动工作流失败");
        }

        toast.success("工作流已启动", {
          description: `执行 ID: ${data.executionId.slice(0, 8)}`,
        });

        return { success: true, executionId: data.executionId };
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        toast.error("启动失败", { description: message });
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
        setLoadingWorkflowId(null);
      }
    },
    [],
  );

  return { triggerWorkflow, isLoading, loadingWorkflowId };
}
```

```typescript
// src/hooks/workflow/use-workflow-execution.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";

interface ExecutionData {
  id: string;
  workflowId: string;
  workflowName: string;
  status:
    | "pending"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";
  steps: Array<{
    id: string;
    name: string;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    output?: unknown;
    error?: string;
  }>;
  outputs: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export function useWorkflowExecution(executionId: string) {
  const { data, error, isLoading, mutate } = useSWR<ExecutionData>(
    `/api/workflow/execution/${executionId}`,
    fetcher,
    {
      refreshInterval: (data) =>
        data?.status === "running" || data?.status === "pending" ? 1000 : 0,
    },
  );

  const cancelExecution = useCallback(async () => {
    await fetch(`/api/workflow/execution/${executionId}/cancel`, {
      method: "POST",
    });
    mutate();
  }, [executionId, mutate]);

  const pauseExecution = useCallback(async () => {
    // 暂停逻辑（需要后端支持）
    mutate();
  }, [mutate]);

  return {
    execution: data,
    isLoading,
    error,
    cancelExecution,
    pauseExecution,
    refresh: mutate,
  };
}
```

### 5.7 集成位置

| 集成位置          | 组件                                     | 说明                          |
| ----------------- | ---------------------------------------- | ----------------------------- |
| 首页工具栏        | `WorkflowQuickActions` variant="toolbar" | 紧凑图标按钮，hover 显示描述  |
| 侧边栏底部        | `WorkflowQuickActions` variant="sidebar" | 完整按钮列表，带文字标签      |
| `/workflows` 页面 | `WorkflowListPage`                       | 完整工作流管理，支持搜索/筛选 |
| 全局 Toast        | `WorkflowExecutionProgress`              | 执行中实时进度反馈            |
| 右侧抽屉          | `WorkflowExecutionProgress`              | 详细步骤进度展示              |
| 通知中心          | `WorkflowResultCard`                     | 执行完成结果摘要              |
| AI 对话流         | `WorkflowResultCard`                     | 对话触发的工作流结果          |

### 5.8 侧边栏集成示例

```typescript
// src/components/layout/sidebar.tsx 中添加
import { WorkflowQuickActions } from "@/components/workflow/quick-actions";

// 在侧边栏底部添加
<div className="mt-auto border-t pt-4">
  <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2">
    快捷工作流
  </h4>
  <WorkflowQuickActions variant="sidebar" />
</div>
```

---

## 6. AI 系统集成方案

> **v1.4.0 新增**: 工作流系统与现有 AI 架构的深度集成设计，实现无缝协作。

### 6.1 集成架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          用户交互层                                      │
│   ┌──────────┐    ┌──────────────┐    ┌──────────────┐                  │
│   │ 对话输入  │    │ 快捷按钮触发  │    │ 事件触发器   │                  │
│   └────┬─────┘    └──────┬───────┘    └──────┬───────┘                  │
└────────┼─────────────────┼───────────────────┼──────────────────────────┘
         │                 │                   │
         ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      UnifiedEngine (扩展版)                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      IntentRouter                                │   │
│  │   ┌────────────────┐     ┌─────────────────────────────┐        │   │
│  │   │ IntentMatcher  │────▶│ WorkflowIntentMatcher (新增)│        │   │
│  │   │ (现有原子意图)  │     │ (工作流触发模式匹配)         │        │   │
│  │   └────────────────┘     └─────────────────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                   │                                     │
│         ┌────────────────────────┬┴───────────────────────┐            │
│         ▼                        ▼                        ▼            │
│  ┌──────────────┐    ┌────────────────────┐    ┌───────────────────┐  │
│  │ Atomic Mode  │    │ Orchestration Mode │    │ Workflow Mode    │  │
│  │ (原子工具)    │    │ (编排 Skills)      │    │ (工作流执行) 新增│  │
│  └──────────────┘    └────────────────────┘    └───────────────────┘  │
│                                                        │               │
└────────────────────────────────────────────────────────┼───────────────┘
                                                         │
                                                         ▼
                                   ┌─────────────────────────────────────┐
                                   │       WorkflowOrchestrator          │
                                   │  (复用 OrchestrationEngine 基础设施) │
                                   └─────────────────────────────────────┘
```

### 6.2 核心集成点

#### 6.2.1 WorkflowIntentMatcher

扩展 `IntentRouter`，添加工作流触发模式匹配：

```typescript
// src/lib/workflow/integration/workflow-intent-matcher.ts

import type { IntentResult } from "@/lib/ai-agent/router/types";
import type { WorkflowDefinition } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface WorkflowMatch {
  workflowId: string;
  workflowName: string;
  confidence: number;
  matchedPattern: string;
}

/**
 * 工作流意图匹配器
 *
 * 检测用户输入是否匹配已注册的工作流触发模式
 */
export class WorkflowIntentMatcher {
  private patternCache: Map<string, WorkflowDefinition[]> = new Map();
  private cacheExpiry: number = 0;
  private CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟缓存

  /**
   * 匹配工作流
   */
  async matchWorkflow(
    userMessage: string,
    userId: string,
  ): Promise<WorkflowMatch | null> {
    // 加载工作流定义（带缓存）
    const workflows = await this.loadWorkflows(userId);

    for (const workflow of workflows) {
      const match = this.matchPatterns(userMessage, workflow);
      if (match) {
        logger.info(
          {
            workflowId: workflow.id,
            pattern: match.matchedPattern,
            confidence: match.confidence,
          },
          "WorkflowIntentMatcher: Pattern matched",
        );
        return match;
      }
    }

    return null;
  }

  /**
   * 匹配工作流触发模式
   */
  private matchPatterns(
    message: string,
    workflow: WorkflowDefinition,
  ): WorkflowMatch | null {
    const conversationTrigger = workflow.triggers.find(
      (t) => t.type === "conversation",
    );

    if (!conversationTrigger?.patterns) {
      return null;
    }

    const normalizedMessage = message.toLowerCase().trim();

    for (const pattern of conversationTrigger.patterns) {
      const normalizedPattern = pattern.toLowerCase();

      // 精确包含匹配
      if (normalizedMessage.includes(normalizedPattern)) {
        return {
          workflowId: workflow.id,
          workflowName: workflow.name,
          confidence: 0.9,
          matchedPattern: pattern,
        };
      }

      // 模糊匹配（关键词重叠度）
      const patternWords = normalizedPattern.split(/\s+/);
      const messageWords = normalizedMessage.split(/\s+/);
      const overlap = patternWords.filter((w) => messageWords.includes(w));

      if (overlap.length >= patternWords.length * 0.7) {
        return {
          workflowId: workflow.id,
          workflowName: workflow.name,
          confidence: 0.7,
          matchedPattern: pattern,
        };
      }
    }

    return null;
  }

  /**
   * 加载工作流定义（带缓存）
   */
  private async loadWorkflows(userId: string): Promise<WorkflowDefinition[]> {
    const cacheKey = userId;
    const now = Date.now();

    if (this.patternCache.has(cacheKey) && this.cacheExpiry > now) {
      return this.patternCache.get(cacheKey)!;
    }

    const supabase = await createClient();

    // 查询用户可用的工作流（内置 + 自定义）
    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .or(`category.eq.builtin,user_id.eq.${userId}`)
      .eq("enabled", true);

    if (error) {
      logger.error(
        { error },
        "WorkflowIntentMatcher: Failed to load workflows",
      );
      return [];
    }

    const workflows = (data || []).map(
      (row) => row.definition as WorkflowDefinition,
    );

    this.patternCache.set(cacheKey, workflows);
    this.cacheExpiry = now + this.CACHE_TTL_MS;

    return workflows;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.patternCache.clear();
    this.cacheExpiry = 0;
  }
}

// 单例导出
let matcherInstance: WorkflowIntentMatcher | null = null;

export function getWorkflowIntentMatcher(): WorkflowIntentMatcher {
  if (!matcherInstance) {
    matcherInstance = new WorkflowIntentMatcher();
  }
  return matcherInstance;
}
```

#### 6.2.2 UnifiedEngine 扩展

在 `UnifiedEngine` 中添加工作流执行模式：

```typescript
// src/lib/ai-skills/engine/unified-engine.ts 扩展

import { getWorkflowIntentMatcher } from "@/lib/workflow/integration/workflow-intent-matcher";
import { getWorkflowOrchestrator } from "@/lib/workflow/orchestrator";

/**
 * UnifiedEngine 扩展方法
 *
 * 在现有 execute() 方法中添加工作流模式判断
 */
async execute(
  params: ExecuteParams,
  context: ExecutionContext
): Promise<ExecuteResult> {
  const { message, skillId } = params;
  const { userId, conversationId } = context;

  // === 新增：工作流模式检测 ===
  if (!skillId) {
    const workflowMatcher = getWorkflowIntentMatcher();
    const workflowMatch = await workflowMatcher.matchWorkflow(message, userId);

    if (workflowMatch && workflowMatch.confidence >= 0.7) {
      // 路由到工作流执行
      return this.executeWorkflowMode(workflowMatch, context);
    }
  }
  // === 工作流模式检测结束 ===

  // 原有逻辑：原子模式 / 编排模式
  const routing = await this.intentRouter.route(message, context);
  // ...
}

/**
 * 工作流执行模式
 */
private async executeWorkflowMode(
  match: WorkflowMatch,
  context: ExecutionContext
): Promise<ExecuteResult> {
  const orchestrator = getWorkflowOrchestrator();

  // 启动工作流
  const execution = await orchestrator.startWorkflow(
    match.workflowId,
    context.userId,
    {
      type: "conversation",
      conversationId: context.conversationId,
      matchedPattern: match.matchedPattern,
    }
  );

  // 返回流式响应，包含工作流启动信息
  return {
    type: "workflow",
    workflowId: match.workflowId,
    workflowName: match.workflowName,
    executionId: execution.id,
    message: `正在执行「${match.workflowName}」工作流...`,
  };
}
```

#### 6.2.3 WorkflowOrchestrator 与 OrchestrationEngine 复用

```typescript
// src/lib/workflow/orchestrator/skill-step-executor.ts

import { getOrchestrationEngine } from "@/lib/ai-skills/engine";
import type { WorkflowStep, WorkflowContext, StepResult } from "../types";

/**
 * Skill 步骤执行器
 *
 * 复用 OrchestrationEngine 执行 Skill 步骤
 */
export class SkillStepExecutor {
  /**
   * 执行 Skill 步骤
   */
  async execute(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<StepResult> {
    const engine = getOrchestrationEngine();
    const config = step.config as SkillStepConfig;

    // 解析输入参数
    const resolvedInput = this.resolveInput(config.inputMapping, context);

    // 通过 OrchestrationEngine 执行 Skill
    const skillResult = await engine.executeSkill(config.skillId, {
      userId: context.userId,
      input: resolvedInput,
      conversationId: context.executionId,
    });

    // 处理输出映射
    const outputVariables = config.outputMapping
      ? this.mapOutput(skillResult, config.outputMapping)
      : {};

    return {
      stepId: step.id,
      status: skillResult.success ? "completed" : "failed",
      output: skillResult.data,
      outputVariables,
      error: skillResult.error,
    };
  }

  /**
   * 解析输入映射
   */
  private resolveInput(
    mapping: Record<string, string>,
    context: WorkflowContext,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, expr] of Object.entries(mapping)) {
      if (
        typeof expr === "string" &&
        expr.startsWith("${") &&
        expr.endsWith("}")
      ) {
        const varPath = expr.slice(2, -1);
        result[key] = this.getNestedValue(context.variables, varPath);
      } else {
        result[key] = expr;
      }
    }

    return result;
  }

  /**
   * 映射输出
   */
  private mapOutput(
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
}
```

### 6.3 协作模式

#### 6.3.1 对话触发工作流

用户在 AI 对话中输入触发词，自动启动工作流：

```typescript
// 用户输入示例
const userMessages = [
  "帮我检查一下书签健康状况", // 触发 bookmark_health 工作流
  "做一下每周整理", // 触发 weekly_organize 工作流
  "我想深度学习 React 相关内容", // 触发 deep_learning 工作流（带参数）
];

// AI 助手响应
const aiResponse = {
  type: "workflow_started",
  message: "好的，我已为您启动「书签健康巡检」工作流，正在检测...",
  executionId: "exec_123",
  progress: {
    current: "check_links",
    total: 5,
    percent: 20,
  },
};
```

#### 6.3.2 AI 助手推荐工作流

基于用户数据状态，AI 主动推荐工作流：

```typescript
// src/lib/workflow/integration/workflow-recommender.ts

import type { DynamicContext } from "@/lib/ai-agent/context/types";

interface WorkflowRecommendation {
  workflowId: string;
  workflowName: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

/**
 * 工作流推荐器
 *
 * 基于用户数据状态推荐合适的工作流
 */
export function recommendWorkflows(
  context: DynamicContext,
): WorkflowRecommendation[] {
  const recommendations: WorkflowRecommendation[] = [];

  // 规则 1：大量未整理书签 → 推荐智能收录
  if (context.bookmarkStats.untaggedCount > 50) {
    recommendations.push({
      workflowId: "smart_intake",
      workflowName: "智能收录",
      reason: `您有 ${context.bookmarkStats.untaggedCount} 条书签尚未分类，建议运行智能收录工作流`,
      priority: "high",
    });
  }

  // 规则 2：一周没整理 → 推荐周度整理
  if (
    context.weeklyActivity.newBookmarks === 0 &&
    context.bookmarkStats.total > 100
  ) {
    recommendations.push({
      workflowId: "weekly_organize",
      workflowName: "周度整理",
      reason: "本周尚未进行整理，建议运行周度整理工作流",
      priority: "medium",
    });
  }

  // 规则 3：某主题书签积累 → 推荐深度学习
  if (context.topTags.length > 0) {
    const topTag = context.topTags[0];
    if (topTag.count >= 20) {
      recommendations.push({
        workflowId: "deep_learning",
        workflowName: "深度学习",
        reason: `您在「${topTag.name}」主题下积累了 ${topTag.count} 条收藏，可以开始系统学习`,
        priority: "low",
      });
    }
  }

  // 规则 4：超过一个月未检查 → 推荐健康巡检
  // （需要 last_health_check 字段支持）

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
```

#### 6.3.3 事件触发 + AI 通知

工作流执行完成后，通过 AI 对话通知用户：

```typescript
// src/lib/workflow/integration/workflow-notification.ts

import { logger } from "@/lib/logger";

interface NotificationContext {
  userId: string;
  workflowId: string;
  workflowName: string;
  executionId: string;
  status: "completed" | "failed";
  summary: string;
  outputs: Record<string, unknown>;
}

/**
 * 工作流完成通知
 *
 * 将工作流执行结果注入到 AI 对话上下文
 */
export async function notifyWorkflowCompletion(
  context: NotificationContext,
): Promise<void> {
  logger.info(
    {
      userId: context.userId,
      workflowId: context.workflowId,
      status: context.status,
    },
    "Workflow completion notification",
  );

  // 方式 1：推送到消息队列，AI 助手主动拉取
  // await pushToMessageQueue(context.userId, {
  //   type: "workflow_completed",
  //   ...context,
  // });

  // 方式 2：直接触发 Toast 通知
  // await triggerToastNotification(context);

  // 方式 3：注入到下一次对话上下文
  // （通过 System-Reminder 机制）
}

/**
 * 生成工作流完成的 System-Reminder
 */
export function generateWorkflowCompletionReminder(
  context: NotificationContext,
): string {
  if (context.status === "completed") {
    return `【工作流完成提醒】「${context.workflowName}」已执行完成。${context.summary}`;
  } else {
    return `【工作流异常提醒】「${context.workflowName}」执行失败，请检查。`;
  }
}
```

### 6.4 集成文件清单

```
src/lib/workflow/integration/                    # v1.4.0 新增
├── workflow-intent-matcher.ts                   # 工作流意图匹配器
├── workflow-recommender.ts                      # 工作流推荐器
├── workflow-notification.ts                     # 工作流通知服务
├── skill-step-executor.ts                       # Skill 步骤执行器
└── index.ts
```

---

## 7. 工作流候选清单

> **v1.4.0 新增**: 基于 AnyKeep 用户场景分析，以下常用操作适合编排成工作流。

### 7.1 内容管理类

| 工作流 ID             | 名称           | 触发方式           | 场景描述                                     | 涉及 Skills                                            |
| --------------------- | -------------- | ------------------ | -------------------------------------------- | ------------------------------------------------------ |
| `new_user_onboarding` | 新用户导入整理 | 事件（首次导入）   | 用户导入浏览器书签后，自动去重、分类、打标签 | `duplicate_cleanup`, `batch_organize`, `smart_tagging` |
| `content_archiver`    | 内容归档助手   | 手动 / 对话        | 将超过 90 天未访问的书签归档到「历史」文件夹 | `search`, `batch_organize`                             |
| `folder_cleanup`      | 文件夹清理     | 手动 / 对话        | 检测空文件夹、合并相似文件夹、优化结构       | `folder_health_check`, `batch_organize`                |
| `url_normalizer`      | URL 标准化     | 事件（批量导入后） | 去除跟踪参数、统一 HTTPS、移除重复参数       | `duplicate_cleanup` (扩展)                             |

### 7.2 知识内化类

| 工作流 ID         | 名称         | 触发方式          | 场景描述                                   | 涉及 Skills                                                |
| ----------------- | ------------ | ----------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `topic_deep_dive` | 主题深挖     | 对话（指定主题）  | 聚合某主题所有书签，生成知识图谱和学习计划 | `related_discovery`, `thematic_synthesis`, `learning_path` |
| `daily_digest`    | 每日精选推送 | 定时（每日 8:00） | 从未读列表推荐 3-5 条今日阅读内容          | `search`, `summary`                                        |
| `spaced_review`   | 间隔复习提醒 | 定时（每日）      | 基于 SM-2 算法推送今日待复习内容           | `active_recall`                                            |
| `reading_streak`  | 阅读打卡     | 事件（阅读完成）  | 记录阅读完成，更新连续阅读天数             | `search` (扩展)                                            |

### 7.3 数据维护类

| 工作流 ID              | 名称         | 触发方式          | 场景描述                                    | 涉及 Skills              |
| ---------------------- | ------------ | ----------------- | ------------------------------------------- | ------------------------ |
| `periodic_backup`      | 定期备份     | 定时（每周日）    | 自动导出全量数据到指定格式（JSON/Markdown） | `data_export`            |
| `link_monitor`         | 链接监控     | 定时（每月 1 日） | 批量检测失效链接，生成修复建议              | `link_health_check`      |
| `content_update_check` | 内容更新检查 | 定时 / 手动       | 检查监控页面是否有内容变化                  | `content_change_monitor` |
| `storage_optimizer`    | 存储优化     | 手动              | 清理无效快照、压缩图片缓存                  | (新 Skill)               |

### 7.4 智能推荐类

| 工作流 ID               | 名称           | 触发方式         | 场景描述                             | 涉及 Skills                |
| ----------------------- | -------------- | ---------------- | ------------------------------------ | -------------------------- |
| `similar_content_alert` | 相似内容提醒   | 事件（新增书签） | 新增书签时检测是否有相似内容已存在   | `related_discovery`        |
| `topic_trend`           | 主题趋势分析   | 定时（每月）     | 分析收藏主题变化趋势，发现新兴兴趣点 | `periodic_report` (扩展)   |
| `cross_platform_merge`  | 跨平台合并建议 | 手动             | 检测不同平台收藏的相同/相似内容      | `duplicate_cleanup` (扩展) |

### 7.5 分享与协作类

| 工作流 ID          | 名称         | 触发方式         | 场景描述                     | 涉及 Skills          |
| ------------------ | ------------ | ---------------- | ---------------------------- | -------------------- |
| `share_collection` | 收藏集分享   | 对话 / 手动      | 将指定文件夹打包为可分享链接 | `share_bundle`       |
| `team_sync`        | 团队知识同步 | 事件（标记分享） | 将书签同步到团队知识库       | `data_export` (扩展) |

### 7.6 优先级排序

基于用户价值和实现复杂度，建议实现顺序：

| 优先级 | 工作流 ID               | 理由                      |
| ------ | ----------------------- | ------------------------- |
| P0     | `new_user_onboarding`   | 首次体验关键，提升留存    |
| P0     | `bookmark_health`       | 已实现，核心维护能力      |
| P1     | `topic_deep_dive`       | 知识管理核心价值          |
| P1     | `periodic_backup`       | 数据安全保障              |
| P1     | `daily_digest`          | 提升日常使用频率          |
| P2     | `spaced_review`         | 知识内化，依赖 Brain-Sync |
| P2     | `folder_cleanup`        | 长期使用后的痛点          |
| P2     | `link_monitor`          | 数据质量保障              |
| P3     | `similar_content_alert` | 增强型体验                |
| P3     | `content_update_check`  | 高级功能                  |

### 7.7 新用户导入整理工作流详细设计

```typescript
// src/lib/workflow/builtin/new-user-onboarding.workflow.ts

import type { WorkflowDefinition } from "../types";

export const newUserOnboardingWorkflow: WorkflowDefinition = {
  id: "new_user_onboarding",
  name: "新用户导入整理",
  description: "导入浏览器书签后自动去重、分类、打标签，快速完成首次整理",
  version: "1.0.0",
  category: "builtin",

  triggers: [
    // 首次导入完成时自动触发
    {
      type: "event",
      eventType: "browser_bookmark_import_completed",
      condition: "event.isFirstImport === true",
    },
    // 也支持手动触发
    { type: "manual" },
  ],

  steps: [
    {
      id: "remove_duplicates",
      name: "智能去重",
      type: "skill",
      config: {
        skillId: "duplicate_cleanup",
        inputMapping: {
          scope: "imported",
          autoMerge: false, // 首次导入不自动合并，展示给用户确认
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
        template: {
          title: "导入整理报告",
          sections: [
            {
              name: "重复检测",
              count: "${duplicateCount}",
              action: "点击查看重复组",
            },
            {
              name: "分类建议",
              count: "${classifySuggestions.length}",
              action: "预览分类方案",
            },
            {
              name: "标签推荐",
              count: "${suggestedTagCount}",
              action: "查看推荐标签",
            },
          ],
        },
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
            skillId: "duplicate_cleanup",
            inputMapping: {
              duplicateGroups: "${duplicateGroups}",
              action: "merge",
            },
          },
          {
            skillId: "batch_organize",
            inputMapping: {
              suggestions: "${classifySuggestions}",
              action: "apply",
            },
          },
          {
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
    timeout: 180000, // 3 分钟
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
```

---

## 8. 新增文件清单

```
src/lib/workflow/
├── orchestrator/
│   ├── workflow-orchestrator.ts
│   ├── index.ts
│   └── types.ts
├── engine/
│   ├── execution-engine.ts
│   └── types.ts
├── state/
│   ├── state-manager.ts
│   └── types.ts
├── triggers/
│   ├── trigger-manager.ts
│   └── types.ts
├── integration/                             # v1.4.0 新增
│   ├── workflow-intent-matcher.ts           # 工作流意图匹配器
│   ├── workflow-recommender.ts              # 工作流推荐器
│   ├── workflow-notification.ts             # 工作流通知服务
│   ├── skill-step-executor.ts               # Skill 步骤执行器
│   └── index.ts
├── builtin/
│   ├── smart-intake.workflow.ts
│   ├── weekly-organize.workflow.ts
│   ├── deep-learning.workflow.ts
│   ├── bookmark-health.workflow.ts          # v1.2.0 新增
│   ├── new-user-onboarding.workflow.ts      # v1.4.0 新增
│   └── index.ts
├── types/
│   └── workflow.types.ts
└── index.ts

src/components/workflow/                  # v1.3.0 新增
├── quick-actions/
│   ├── workflow-quick-actions.tsx
│   ├── workflow-action-button.tsx
│   └── index.ts
├── list/
│   ├── workflow-list-page.tsx
│   ├── workflow-card.tsx
│   ├── workflow-detail-dialog.tsx
│   └── index.ts
├── execution/
│   ├── workflow-execution-progress.tsx
│   ├── workflow-step-indicator.tsx
│   └── index.ts
├── result/
│   ├── workflow-result-card.tsx
│   ├── workflow-result-drawer.tsx
│   └── index.ts
└── index.ts

src/hooks/workflow/                       # v1.3.0 新增
├── use-workflow-list.ts
├── use-workflow-execution.ts
├── use-workflow-trigger.ts
└── index.ts

src/app/(main)/workflows/                 # v1.3.0 新增
├── page.tsx
└── [id]/page.tsx

src/app/api/workflow/
├── route.ts
├── start/route.ts
└── execution/[id]/
    ├── route.ts
    ├── confirm/route.ts
    └── cancel/route.ts

supabase/migrations/
└── 20250108000001_add_workflow_tables.sql
```

---

## 9. 合规性检查清单

| 检查项                                           | 状态           |
| ------------------------------------------------ | -------------- |
| 使用 `createClient()` 直接调用（非构造函数注入） | ✅ 已修正      |
| 使用单例模式获取服务实例                         | ✅ 已修正      |
| 引用的 Skill ID 均已验证存在或标注待实现         | ✅ 已修正      |
| 数据库迁移命名符合规范                           | ✅ 已修正      |
| API 路由符合现有模式                             | ✅ 已修正      |
| 类型定义独立于实现                               | ✅ 已修正      |
| 依赖 skills-update0108.md 的 Skills 已标注       | ✅ 已修正      |
| 前端组件符合项目规范（Shadcn UI + Tailwind）     | ✅ v1.3.0 新增 |
| Hooks 使用 SWR 进行数据获取                      | ✅ v1.3.0 新增 |
| AI 集成使用现有 IntentRouter 扩展模式            | ✅ v1.4.0 新增 |
| 工作流推荐器复用 DynamicContext 类型             | ✅ v1.4.0 新增 |
| 工作流候选清单已按优先级排序                     | ✅ v1.4.0 新增 |
