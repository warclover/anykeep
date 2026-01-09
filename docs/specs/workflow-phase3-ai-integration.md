# AnyKeep 工作流系统 - Phase 3: AI 系统集成方案

> **版本**: v1.1.0
> **日期**: 2025-01-08
> **状态**: 待审核
> **依赖**: Phase 1 (核心引擎 v1.1.0), Phase 2 (前端集成 v1.1.0)
> **预估工期**: 2.5-3.5 天
> **更新**: v1.1.0 - 修复 UnifiedEngine 接口适配、替换 new Function 为 expr-eval、验证 OrchestrationEngine 签名

---

## 0. 接口兼容性说明（关键修复）

### 0.1 UnifiedEngine 接口适配

**问题**：`UnifiedEngine.execute()` 返回 `AsyncGenerator<StreamChunk>`，而非同步结果。

**解决方案**：使用 Phase 1 提供的 `StreamResultCollector` 工具：

```typescript
// 使用 StreamResultCollector 收集流式结果
import { collectStreamResult } from "@/lib/workflow/utils/stream-result-collector";

// 在 SkillStepExecutor 中调用 OrchestrationEngine
const stream = await this.engine.executeWorkflow(skillId, input, skillContext);
const result = await collectStreamResult(stream);
```

### 0.2 OrchestrationEngine 方法签名验证

**实际签名**（需在实施前验证）：

```typescript
// src/lib/ai-skills/engine/orchestration-engine.ts
class OrchestrationEngine {
  async *executeWorkflow(
    skillId: string,
    params: Record<string, unknown>,
    context: OrchestrationContext,
  ): AsyncGenerator<StreamChunk>;
}
```

**适配策略**：`SkillStepExecutor` 需要包装 `AsyncGenerator` 为 `Promise<StepResult>`。

### 0.3 安全性改进：条件评估

**问题**：使用 `new Function()` 动态执行条件表达式存在代码注入风险。

**解决方案**：使用 `expr-eval` 库进行安全的表达式求值（见 5.2 节）。

---

## 1. 范围定义

### 1.1 Phase 3 目标

将工作流系统与现有 AI 架构深度集成，实现：

- 对话触发：用户在 AI 对话中自然触发工作流
- 智能推荐：基于用户数据状态主动推荐工作流
- 执行通知：工作流完成后通过 AI 对话反馈结果
- Skill 复用：工作流步骤复用现有 OrchestrationEngine

### 1.2 不在本阶段范围

- 自定义工作流编辑器 (Phase 4)
- 定时触发调度器 (Phase 4)
- 复杂的事件触发器 (Phase 4)

### 1.3 依赖的现有模块

| 模块                  | 路径                                                   | 用途           |
| --------------------- | ------------------------------------------------------ | -------------- |
| IntentRouter          | `src/lib/ai-agent/router/intent-router.ts`             | 意图路由扩展   |
| IntentClassifier      | `src/lib/ai-agent/router/intent-classifier.ts`         | 意图分类规则   |
| UnifiedEngine         | `src/lib/ai-skills/engine/unified-engine.ts`           | 统一执行引擎   |
| OrchestrationEngine   | `src/lib/ai-skills/engine/orchestration-engine.ts`     | Skill 编排引擎 |
| DynamicContextBuilder | `src/lib/ai-agent/context/dynamic-context-builder.ts`  | 动态上下文     |
| System-Reminder       | `src/lib/ai-agent/context/system-reminder-injector.ts` | 提醒注入       |

---

## 2. 架构设计

### 2.1 集成架构图

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
│  │                      IntentRouter (扩展)                         │   │
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
                                   ┌─────────────────────▼───────────────┐
                                   │       WorkflowOrchestrator          │
                                   │  (复用 SkillStepExecutor)           │
                                   └───────────────────┬─────────────────┘
                                                       │
                                                       ▼
                                   ┌─────────────────────────────────────┐
                                   │       OrchestrationEngine           │
                                   │       (现有 Skill 执行能力)          │
                                   └─────────────────────────────────────┘
```

### 2.2 核心组件

| 组件                   | 类型       | 职责                                     |
| ---------------------- | ---------- | ---------------------------------------- |
| WorkflowIntentMatcher  | 匹配器     | 检测用户输入是否触发工作流               |
| WorkflowModeExecutor   | 执行器     | UnifiedEngine 中的工作流模式处理         |
| SkillStepExecutor      | 步骤执行器 | 复用 OrchestrationEngine 执行 Skill 步骤 |
| WorkflowRecommender    | 推荐器     | 基于用户状态推荐工作流                   |
| WorkflowNotifier       | 通知器     | 工作流完成后通知 AI 对话                 |
| WorkflowSystemReminder | 提醒生成器 | 生成工作流相关的 System-Reminder         |

---

## 3. WorkflowIntentMatcher 实现

### 3.1 类型定义

```typescript
// src/lib/workflow/integration/types.ts

export interface WorkflowTriggerPattern {
  /** 触发模式类型 */
  type: "keyword" | "regex" | "semantic";
  /** 模式内容 */
  pattern: string;
  /** 匹配权重 (0-1) */
  weight?: number;
}

export interface WorkflowMatch {
  /** 工作流 ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 匹配置信度 (0-1) */
  confidence: number;
  /** 匹配的模式 */
  matchedPattern: string;
  /** 提取的参数 */
  extractedParams?: Record<string, string>;
}

export interface WorkflowTriggerConfig {
  /** 对话触发模式列表 */
  patterns: WorkflowTriggerPattern[];
  /** 最小置信度阈值 */
  minConfidence?: number;
  /** 是否启用语义匹配 */
  enableSemantic?: boolean;
}
```

### 3.2 WorkflowIntentMatcher 实现

```typescript
// src/lib/workflow/integration/workflow-intent-matcher.ts

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  WorkflowMatch,
  WorkflowTriggerPattern,
  WorkflowTriggerConfig,
} from "./types";
import type { WorkflowDefinition } from "../types";

/**
 * 工作流意图匹配器
 *
 * 检测用户输入是否匹配已注册的工作流触发模式
 */
export class WorkflowIntentMatcher {
  private patternCache: Map<string, WorkflowDefinition[]> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟
  private readonly DEFAULT_MIN_CONFIDENCE = 0.7;

  /**
   * 匹配工作流
   */
  async matchWorkflow(
    userMessage: string,
    userId: string,
  ): Promise<WorkflowMatch | null> {
    const startTime = performance.now();

    try {
      // 加载工作流定义（带缓存）
      const workflows = await this.loadWorkflows(userId);

      if (workflows.length === 0) {
        return null;
      }

      // 按优先级排序的匹配结果
      const matches: WorkflowMatch[] = [];

      for (const workflow of workflows) {
        const match = await this.matchPatterns(userMessage, workflow);
        if (match) {
          matches.push(match);
        }
      }

      // 按置信度降序排列，返回最佳匹配
      matches.sort((a, b) => b.confidence - a.confidence);
      const bestMatch = matches[0] || null;

      if (bestMatch) {
        logger.info(
          {
            workflowId: bestMatch.workflowId,
            pattern: bestMatch.matchedPattern,
            confidence: bestMatch.confidence,
            durationMs: Math.round(performance.now() - startTime),
          },
          "WorkflowIntentMatcher: Pattern matched",
        );
      }

      return bestMatch;
    } catch (error) {
      logger.error({ error, userId }, "WorkflowIntentMatcher: Match failed");
      return null;
    }
  }

  /**
   * 匹配工作流触发模式
   */
  private async matchPatterns(
    message: string,
    workflow: WorkflowDefinition,
  ): Promise<WorkflowMatch | null> {
    const conversationTrigger = workflow.triggers?.find(
      (t) => t.type === "conversation",
    );

    if (!conversationTrigger) {
      return null;
    }

    const config = conversationTrigger.config as WorkflowTriggerConfig;
    const patterns = config?.patterns || [];
    const minConfidence = config?.minConfidence ?? this.DEFAULT_MIN_CONFIDENCE;

    if (patterns.length === 0) {
      return null;
    }

    const normalizedMessage = message.toLowerCase().trim();
    let bestMatch: {
      pattern: string;
      confidence: number;
      params?: Record<string, string>;
    } | null = null;

    for (const patternDef of patterns) {
      const result = this.evaluatePattern(normalizedMessage, patternDef);

      if (result && result.confidence >= minConfidence) {
        if (!bestMatch || result.confidence > bestMatch.confidence) {
          bestMatch = {
            pattern: patternDef.pattern,
            confidence: result.confidence,
            params: result.params,
          };
        }
      }
    }

    if (!bestMatch) {
      return null;
    }

    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      confidence: bestMatch.confidence,
      matchedPattern: bestMatch.pattern,
      extractedParams: bestMatch.params,
    };
  }

  /**
   * 评估单个模式
   */
  private evaluatePattern(
    message: string,
    patternDef: WorkflowTriggerPattern,
  ): { confidence: number; params?: Record<string, string> } | null {
    const weight = patternDef.weight ?? 1;

    switch (patternDef.type) {
      case "keyword":
        return this.evaluateKeywordPattern(message, patternDef.pattern, weight);

      case "regex":
        return this.evaluateRegexPattern(message, patternDef.pattern, weight);

      case "semantic":
        // 语义匹配需要调用 embedding 服务，暂不实现
        return null;

      default:
        return null;
    }
  }

  /**
   * 关键词模式匹配
   */
  private evaluateKeywordPattern(
    message: string,
    pattern: string,
    weight: number,
  ): { confidence: number; params?: Record<string, string> } | null {
    const normalizedPattern = pattern.toLowerCase();

    // 精确包含匹配
    if (message.includes(normalizedPattern)) {
      return { confidence: 0.9 * weight };
    }

    // 模糊匹配（关键词重叠度）
    const patternWords = normalizedPattern
      .split(/\s+/)
      .filter((w) => w.length > 1);
    const messageWords = message.split(/\s+/).filter((w) => w.length > 1);

    if (patternWords.length === 0) {
      return null;
    }

    const overlap = patternWords.filter((w) =>
      messageWords.some((mw) => mw.includes(w) || w.includes(mw)),
    );

    const overlapRatio = overlap.length / patternWords.length;

    if (overlapRatio >= 0.7) {
      return { confidence: 0.7 * weight * overlapRatio };
    }

    return null;
  }

  /**
   * 正则模式匹配
   */
  private evaluateRegexPattern(
    message: string,
    pattern: string,
    weight: number,
  ): { confidence: number; params?: Record<string, string> } | null {
    try {
      const regex = new RegExp(pattern, "i");
      const match = message.match(regex);

      if (match) {
        // 提取命名捕获组作为参数
        const params: Record<string, string> = {};
        if (match.groups) {
          Object.assign(params, match.groups);
        }

        return {
          confidence: 0.85 * weight,
          params: Object.keys(params).length > 0 ? params : undefined,
        };
      }
    } catch (error) {
      logger.warn(
        { pattern, error },
        "WorkflowIntentMatcher: Invalid regex pattern",
      );
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
      .select("id, definition")
      .or(`category.eq.builtin,user_id.eq.${userId}`)
      .eq("enabled", true);

    if (error) {
      logger.error(
        { error },
        "WorkflowIntentMatcher: Failed to load workflows",
      );
      return [];
    }

    const workflows = (data || [])
      .map((row) => ({
        id: row.id,
        ...(row.definition as Omit<WorkflowDefinition, "id">),
      }))
      .filter((w) => w.triggers?.some((t) => t.type === "conversation"));

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

### 3.3 意图分类规则扩展

```typescript
// src/lib/ai-agent/router/intent-rules-workflow.ts

import type { IntentRule } from "./types";

/**
 * 工作流触发意图规则
 *
 * 添加到 IntentClassifier 的规则集中
 */
export const workflowIntentRules: IntentRule[] = [
  // 书签健康检查
  {
    id: "workflow-bookmark-health",
    patterns: [
      "检查书签健康",
      "书签巡检",
      "检测失效链接",
      "链接检查",
      "书签健康状况",
    ],
    intent: { type: "workflow", subType: "bookmark_health" },
    confidence: 0.9,
  },

  // 每周整理
  {
    id: "workflow-weekly-organize",
    patterns: ["周度整理", "每周整理", "本周整理", "做一下整理"],
    intent: { type: "workflow", subType: "weekly_organize" },
    confidence: 0.85,
  },

  // 深度学习
  {
    id: "workflow-deep-learning",
    patterns: ["深度学习", "系统学习", "学习路径", "主题深挖"],
    intent: { type: "workflow", subType: "topic_deep_dive" },
    confidence: 0.8,
  },

  // 数据备份
  {
    id: "workflow-backup",
    patterns: ["备份数据", "导出备份", "定期备份"],
    intent: { type: "workflow", subType: "periodic_backup" },
    confidence: 0.85,
  },

  // 新用户导入整理
  {
    id: "workflow-new-user-onboarding",
    patterns: ["整理导入的书签", "导入书签整理", "帮我整理刚导入的"],
    intent: { type: "workflow", subType: "new_user_onboarding" },
    confidence: 0.85,
  },
];
```

---

## 4. UnifiedEngine 扩展

### 4.1 WorkflowModeExecutor

```typescript
// src/lib/workflow/integration/workflow-mode-executor.ts

import { getWorkflowOrchestrator } from "../orchestrator";
import { getWorkflowIntentMatcher } from "./workflow-intent-matcher";
import { logger } from "@/lib/logger";
import type { WorkflowMatch } from "./types";
import type { ExecutionContext } from "@/lib/ai-skills/engine/types";

/**
 * 工作流执行结果类型
 */
export interface WorkflowExecuteResult {
  type: "workflow";
  workflowId: string;
  workflowName: string;
  executionId: string;
  status: "started" | "completed" | "failed";
  message: string;
  progress?: {
    current: number;
    total: number;
    currentStep: string;
  };
}

/**
 * 工作流模式执行器
 *
 * 在 UnifiedEngine 中处理工作流模式的执行
 */
export class WorkflowModeExecutor {
  private intentMatcher = getWorkflowIntentMatcher();
  private orchestrator = getWorkflowOrchestrator();

  /**
   * 检测并执行工作流
   *
   * @returns 工作流执行结果，如果不匹配返回 null
   */
  async tryExecuteWorkflow(
    message: string,
    context: ExecutionContext,
  ): Promise<WorkflowExecuteResult | null> {
    // 1. 匹配工作流
    const match = await this.intentMatcher.matchWorkflow(
      message,
      context.userId,
    );

    if (!match || match.confidence < 0.7) {
      return null;
    }

    // 2. 启动工作流
    return this.executeWorkflow(match, context);
  }

  /**
   * 执行匹配的工作流
   */
  async executeWorkflow(
    match: WorkflowMatch,
    context: ExecutionContext,
  ): Promise<WorkflowExecuteResult> {
    const startTime = performance.now();

    try {
      // 启动工作流
      const execution = await this.orchestrator.startWorkflow(
        match.workflowId,
        context.userId,
        "conversation",
        {
          conversationId: context.conversationId,
          matchedPattern: match.matchedPattern,
          extractedParams: match.extractedParams,
        },
      );

      logger.info(
        {
          workflowId: match.workflowId,
          executionId: execution.id,
          userId: context.userId,
          durationMs: Math.round(performance.now() - startTime),
        },
        "WorkflowModeExecutor: Workflow started",
      );

      return {
        type: "workflow",
        workflowId: match.workflowId,
        workflowName: match.workflowName,
        executionId: execution.id,
        status: "started",
        message: this.generateStartMessage(match.workflowName),
      };
    } catch (error) {
      logger.error(
        { error, workflowId: match.workflowId, userId: context.userId },
        "WorkflowModeExecutor: Workflow start failed",
      );

      return {
        type: "workflow",
        workflowId: match.workflowId,
        workflowName: match.workflowName,
        executionId: "",
        status: "failed",
        message: `启动「${match.workflowName}」工作流失败，请稍后重试`,
      };
    }
  }

  /**
   * 生成启动消息
   */
  private generateStartMessage(workflowName: string): string {
    const templates = [
      `好的，正在为您执行「${workflowName}」...`,
      `已启动「${workflowName}」工作流，请稍候...`,
      `「${workflowName}」正在运行中...`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }
}

// 单例导出
let executorInstance: WorkflowModeExecutor | null = null;

export function getWorkflowModeExecutor(): WorkflowModeExecutor {
  if (!executorInstance) {
    executorInstance = new WorkflowModeExecutor();
  }
  return executorInstance;
}
```

### 4.2 UnifiedEngine 集成点

```typescript
// src/lib/ai-skills/engine/unified-engine.ts 中需要添加的代码段

// === 在文件顶部添加导入 ===
import { getWorkflowModeExecutor } from "@/lib/workflow/integration/workflow-mode-executor";
import { isWorkflowEnabled } from "@/lib/ai-agent/config/feature-flags";

// === 在 execute() 方法开始处添加工作流模式检测 ===
async execute(
  params: ExecuteParams,
  context: ExecutionContext
): Promise<AsyncGenerator<StreamChunk>> {
  const { message, skillId } = params;
  const { userId, conversationId } = context;

  // === 新增：工作流模式检测（Feature Flag 控制）===
  if (!skillId && isWorkflowEnabled()) {
    const workflowExecutor = getWorkflowModeExecutor();
    const workflowResult = await workflowExecutor.tryExecuteWorkflow(
      message,
      context
    );

    if (workflowResult) {
      // 路由到工作流模式，返回工作流启动信息
      return this.streamWorkflowResponse(workflowResult);
    }
  }
  // === 工作流模式检测结束 ===

  // 原有逻辑：意图路由 → 原子模式 / 编排模式
  const routing = await this.intentRouter.route(message, context);
  // ...
}

/**
 * 流式返回工作流响应
 */
private async *streamWorkflowResponse(
  result: WorkflowExecuteResult
): AsyncGenerator<StreamChunk> {
  yield {
    type: "routing",
    data: {
      mode: "workflow",
      workflowId: result.workflowId,
      workflowName: result.workflowName,
    },
  };

  yield {
    type: "text",
    data: { text: result.message },
  };

  if (result.status === "started") {
    yield {
      type: "workflow_started",
      data: {
        executionId: result.executionId,
        workflowId: result.workflowId,
        workflowName: result.workflowName,
      },
    };
  }

  yield { type: "done", data: {} };
}
```

---

## 5. SkillStepExecutor 实现

### 5.1 复用 OrchestrationEngine（修复版）

```typescript
// src/lib/workflow/integration/skill-step-executor.ts

import { getOrchestrationEngine } from "@/lib/ai-skills/engine";
import { collectStreamResult } from "@/lib/workflow/utils/stream-result-collector";
import { logger } from "@/lib/logger";
import type { WorkflowStep, WorkflowContext, StepResult } from "../types";
import type { StreamChunk } from "@/lib/ai-skills/engine/types";

interface SkillStepConfig {
  skillId: string;
  inputMapping: Record<string, string | unknown>;
  outputMapping?: Record<string, string>;
}

/**
 * Skill 步骤执行器
 *
 * 复用 OrchestrationEngine 执行 Skill 步骤
 * 使用 StreamResultCollector 适配 AsyncGenerator 返回值
 */
export class SkillStepExecutor {
  private engine = getOrchestrationEngine();

  /**
   * 执行 Skill 步骤
   */
  async execute(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<StepResult> {
    const startTime = performance.now();
    const config = step.config as SkillStepConfig;

    try {
      // 1. 解析输入参数
      const resolvedInput = this.resolveInput(config.inputMapping, context);

      logger.debug(
        {
          stepId: step.id,
          skillId: config.skillId,
          input: resolvedInput,
        },
        "SkillStepExecutor: Executing skill step",
      );

      // 2. 通过 OrchestrationEngine 执行 Skill（使用 StreamResultCollector）
      const skillResult = await this.executeSkillWithCollector(
        config.skillId,
        resolvedInput,
        context,
      );

      // 3. 处理输出映射
      const outputVariables = config.outputMapping
        ? this.mapOutput(skillResult.data, config.outputMapping)
        : {};

      const duration = Math.round(performance.now() - startTime);

      logger.info(
        {
          stepId: step.id,
          skillId: config.skillId,
          success: skillResult.success,
          durationMs: duration,
        },
        "SkillStepExecutor: Skill step completed",
      );

      return {
        stepId: step.id,
        status: skillResult.success ? "completed" : "failed",
        output: skillResult.data,
        outputVariables,
        error: skillResult.error,
        duration,
      };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        {
          stepId: step.id,
          skillId: config.skillId,
          error: errorMessage,
          durationMs: duration,
        },
        "SkillStepExecutor: Skill step failed",
      );

      return {
        stepId: step.id,
        status: "failed",
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * 执行 Skill 并收集结果
   *
   * 关键修复：使用 StreamResultCollector 适配 AsyncGenerator
   */
  private async executeSkillWithCollector(
    skillId: string,
    input: Record<string, unknown>,
    context: WorkflowContext,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      // 构造 Skill 执行上下文
      const skillContext = {
        userId: context.userId,
        conversationId: context.executionId,
      };

      // 将输入转换为消息格式
      const message = this.formatSkillMessage(skillId, input);

      // 调用 OrchestrationEngine（返回 AsyncGenerator）
      const stream: AsyncGenerator<StreamChunk> =
        await this.engine.executeWorkflow(
          skillId,
          { message, params: input },
          skillContext,
        );

      // 使用 StreamResultCollector 收集流式结果
      const collectedResult = await collectStreamResult(stream, {
        timeout: 60000, // 60 秒超时
        onProgress: (chunk) => {
          // 可选：进度回调
          if (chunk.type === "progress") {
            logger.debug({ skillId, progress: chunk.data }, "Skill progress");
          }
        },
      });

      return {
        success: !collectedResult.error,
        data: collectedResult.deliverables || collectedResult.textContent,
        error: collectedResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ... 其余方法保持不变
}
```

### 5.2 安全条件评估（使用 expr-eval 替代 new Function）

```typescript
// src/lib/workflow/integration/safe-expression-evaluator.ts

import { Parser } from "expr-eval";

/**
 * 安全表达式求值器
 *
 * 使用 expr-eval 替代 new Function()，避免代码注入风险
 */
export class SafeExpressionEvaluator {
  private parser: Parser;

  constructor() {
    // 创建受限的表达式解析器
    this.parser = new Parser({
      operators: {
        // 允许的操作符
        comparison: true, // ==, !=, <, >, <=, >=
        logical: true, // &&, ||, !
        conditional: true, // ? :
        // 禁止的操作符
        add: true,
        subtract: true,
        multiply: true,
        divide: true,
        remainder: false, // 禁止 %
        power: false, // 禁止 ^
        concatenate: true,
        in: true,
      },
    });

    // 添加安全的内置函数
    this.parser.functions.includes = (arr: unknown[], item: unknown) =>
      Array.isArray(arr) && arr.includes(item);

    this.parser.functions.length = (arr: unknown[]) =>
      Array.isArray(arr) ? arr.length : 0;

    this.parser.functions.isEmpty = (val: unknown) =>
      val === null ||
      val === undefined ||
      val === "" ||
      (Array.isArray(val) && val.length === 0);

    this.parser.functions.startsWith = (str: string, prefix: string) =>
      typeof str === "string" && str.startsWith(prefix);

    this.parser.functions.endsWith = (str: string, suffix: string) =>
      typeof str === "string" && str.endsWith(suffix);
  }

  /**
   * 安全地评估条件表达式
   *
   * @param expression 条件表达式，例如 "count > 10 && status == 'active'"
   * @param variables 变量上下文
   * @returns 布尔结果
   */
  evaluate(expression: string, variables: Record<string, unknown>): boolean {
    try {
      // 解析表达式
      const parsed = this.parser.parse(expression);

      // 评估表达式
      const result = parsed.evaluate(variables);

      // 强制转换为布尔值
      return Boolean(result);
    } catch (error) {
      logger.warn(
        { expression, error },
        "SafeExpressionEvaluator: Expression evaluation failed",
      );
      return false;
    }
  }

  /**
   * 验证表达式是否安全有效
   */
  validate(expression: string): { valid: boolean; error?: string } {
    try {
      this.parser.parse(expression);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid expression",
      };
    }
  }
}

// 单例导出
let evaluatorInstance: SafeExpressionEvaluator | null = null;

export function getSafeExpressionEvaluator(): SafeExpressionEvaluator {
  if (!evaluatorInstance) {
    evaluatorInstance = new SafeExpressionEvaluator();
  }
  return evaluatorInstance;
}

/**
 * 便捷函数：安全评估条件
 */
export function safeEvaluateCondition(
  expression: string,
  variables: Record<string, unknown>,
): boolean {
  return getSafeExpressionEvaluator().evaluate(expression, variables);
}
```

### 5.3 条件步骤中使用安全评估器

```typescript
// 在 ExecutionEngine 的条件评估中使用
import { safeEvaluateCondition } from "./safe-expression-evaluator";

// 原代码（不安全）：
// const result = new Function("ctx", `return ${condition}`)(context.variables);

// 修复后（安全）：
const result = safeEvaluateCondition(step.condition, {
  ...context.variables,
  ...context.stepResults,
});
```

### 5.4 安装 expr-eval 依赖

```bash
npm install expr-eval
npm install -D @types/expr-eval
```

---

## 6. 工作流推荐器

### 6.1 WorkflowRecommender 实现

```typescript
// src/lib/workflow/integration/workflow-recommender.ts

import type { DynamicContext } from "@/lib/ai-agent/context/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export interface WorkflowRecommendation {
  workflowId: string;
  workflowName: string;
  reason: string;
  priority: "high" | "medium" | "low";
  /** 推荐分数 (0-100) */
  score: number;
}

interface RecommendationRule {
  id: string;
  workflowId: string;
  workflowName: string;
  condition: (context: DynamicContext) => boolean;
  reason: (context: DynamicContext) => string;
  priority: "high" | "medium" | "low";
  score: number;
}

/**
 * 工作流推荐规则
 */
const RECOMMENDATION_RULES: RecommendationRule[] = [
  // 规则 1：大量未分类书签
  {
    id: "untagged-many",
    workflowId: "smart_intake",
    workflowName: "智能收录",
    condition: (ctx) => ctx.bookmarkStats.untaggedCount > 50,
    reason: (ctx) =>
      `您有 ${ctx.bookmarkStats.untaggedCount} 条书签尚未分类，建议运行智能收录`,
    priority: "high",
    score: 90,
  },

  // 规则 2：一周无活动 + 书签较多
  {
    id: "weekly-inactive",
    workflowId: "weekly_organize",
    workflowName: "周度整理",
    condition: (ctx) =>
      ctx.weeklyActivity.newBookmarks === 0 && ctx.bookmarkStats.total > 100,
    reason: () => "本周尚未进行整理，建议运行周度整理工作流",
    priority: "medium",
    score: 75,
  },

  // 规则 3：某主题积累较多
  {
    id: "topic-accumulated",
    workflowId: "topic_deep_dive",
    workflowName: "主题深挖",
    condition: (ctx) => ctx.topTags.length > 0 && ctx.topTags[0].count >= 20,
    reason: (ctx) => {
      const topTag = ctx.topTags[0];
      return `您在「${topTag.name}」主题下积累了 ${topTag.count} 条收藏，可以开始系统学习`;
    },
    priority: "low",
    score: 60,
  },

  // 规则 4：超过 30 天未检查链接健康
  {
    id: "link-check-overdue",
    workflowId: "bookmark_health",
    workflowName: "书签健康巡检",
    condition: (ctx) => {
      // 需要 lastHealthCheckAt 字段支持
      const lastCheck = (ctx as DynamicContext & { lastHealthCheckAt?: Date })
        .lastHealthCheckAt;
      if (!lastCheck) return ctx.bookmarkStats.total > 100;
      const daysSinceCheck =
        (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCheck > 30;
    },
    reason: () => "超过 30 天未检查书签健康状况，建议运行巡检",
    priority: "medium",
    score: 70,
  },

  // 规则 5：复习队列积压
  {
    id: "review-backlog",
    workflowId: "spaced_review",
    workflowName: "间隔复习",
    condition: (ctx) => {
      const reviewBacklog = (ctx as DynamicContext & { reviewBacklog?: number })
        .reviewBacklog;
      return (reviewBacklog ?? 0) > 10;
    },
    reason: (ctx) => {
      const backlog =
        (ctx as DynamicContext & { reviewBacklog?: number }).reviewBacklog ?? 0;
      return `您有 ${backlog} 条待复习内容，建议开始复习`;
    },
    priority: "high",
    score: 85,
  },
];

/**
 * 工作流推荐器
 *
 * 基于用户数据状态推荐合适的工作流
 */
export class WorkflowRecommender {
  /**
   * 获取工作流推荐
   */
  recommend(
    context: DynamicContext,
    maxRecommendations: number = 3,
  ): WorkflowRecommendation[] {
    const recommendations: WorkflowRecommendation[] = [];

    for (const rule of RECOMMENDATION_RULES) {
      try {
        if (rule.condition(context)) {
          recommendations.push({
            workflowId: rule.workflowId,
            workflowName: rule.workflowName,
            reason: rule.reason(context),
            priority: rule.priority,
            score: rule.score,
          });
        }
      } catch (error) {
        logger.warn(
          { ruleId: rule.id, error },
          "WorkflowRecommender: Rule evaluation failed",
        );
      }
    }

    // 按分数降序排列
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations.slice(0, maxRecommendations);
  }

  /**
   * 获取单个最佳推荐
   */
  recommendTop(context: DynamicContext): WorkflowRecommendation | null {
    const recommendations = this.recommend(context, 1);
    return recommendations[0] || null;
  }
}

// 单例导出
let recommenderInstance: WorkflowRecommender | null = null;

export function getWorkflowRecommender(): WorkflowRecommender {
  if (!recommenderInstance) {
    recommenderInstance = new WorkflowRecommender();
  }
  return recommenderInstance;
}

/**
 * 便捷函数：获取工作流推荐
 */
export function recommendWorkflows(
  context: DynamicContext,
  maxRecommendations?: number,
): WorkflowRecommendation[] {
  return getWorkflowRecommender().recommend(context, maxRecommendations);
}
```

---

## 7. 工作流通知服务

### 7.1 WorkflowNotifier 实现

```typescript
// src/lib/workflow/integration/workflow-notifier.ts

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export interface WorkflowNotificationContext {
  userId: string;
  workflowId: string;
  workflowName: string;
  executionId: string;
  status: "completed" | "failed" | "waiting_confirmation";
  summary: string;
  outputs?: Record<string, unknown>;
  error?: string;
}

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
    const supabase = await createClient();

    await supabase.from("notifications").insert({
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
  }

  /**
   * 触发实时通知
   */
  private async triggerRealtimeNotification(
    context: WorkflowNotificationContext,
  ): Promise<void> {
    const supabase = await createClient();

    // 通过 Supabase Realtime Broadcast 发送
    await supabase.channel(`user:${context.userId}`).send({
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
```

### 7.2 System-Reminder 生成器

```typescript
// src/lib/workflow/integration/workflow-system-reminder.ts

import type { WorkflowNotificationContext } from "./workflow-notifier";
import type { WorkflowRecommendation } from "./workflow-recommender";

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
 * 工作流相关 System-Reminder 触发器
 */
export const workflowSystemReminders = [
  {
    id: "workflow-completion",
    triggerId: "workflow-completion",
    priority: 95,
    generator: (context: {
      workflowCompletion?: WorkflowNotificationContext;
    }) => {
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
    generator: (context: {
      workflowRecommendations?: WorkflowRecommendation[];
    }) => {
      if (context.workflowRecommendations) {
        return generateWorkflowRecommendationReminder(
          context.workflowRecommendations,
        );
      }
      return null;
    },
  },
];
```

---

## 8. Feature Flag 配置

### 8.1 添加工作流 Feature Flag

```typescript
// src/lib/ai-agent/config/feature-flags.ts 中添加

// 工作流系统 Feature Flags
export const ENABLE_WORKFLOW_SYSTEM = env("ENABLE_WORKFLOW_SYSTEM", true);
export const ENABLE_WORKFLOW_CONVERSATION_TRIGGER = env(
  "ENABLE_WORKFLOW_CONVERSATION_TRIGGER",
  true,
);
export const ENABLE_WORKFLOW_RECOMMENDATIONS = env(
  "ENABLE_WORKFLOW_RECOMMENDATIONS",
  true,
);
export const ENABLE_WORKFLOW_NOTIFICATIONS = env(
  "ENABLE_WORKFLOW_NOTIFICATIONS",
  true,
);

/**
 * 检查工作流系统是否启用
 */
export function isWorkflowEnabled(): boolean {
  return ENABLE_WORKFLOW_SYSTEM;
}

/**
 * 检查工作流对话触发是否启用
 */
export function isWorkflowConversationTriggerEnabled(): boolean {
  return ENABLE_WORKFLOW_SYSTEM && ENABLE_WORKFLOW_CONVERSATION_TRIGGER;
}

/**
 * 检查工作流推荐是否启用
 */
export function isWorkflowRecommendationsEnabled(): boolean {
  return ENABLE_WORKFLOW_SYSTEM && ENABLE_WORKFLOW_RECOMMENDATIONS;
}
```

### 8.2 环境变量配置

```bash
# .env.local 添加

# 工作流系统 Feature Flags
ENABLE_WORKFLOW_SYSTEM=true              # 工作流系统总开关
ENABLE_WORKFLOW_CONVERSATION_TRIGGER=true  # 对话触发工作流
ENABLE_WORKFLOW_RECOMMENDATIONS=true      # 工作流推荐
ENABLE_WORKFLOW_NOTIFICATIONS=true        # 工作流完成通知
```

---

## 9. 测试计划

### 9.1 单元测试

| 测试文件                           | 覆盖内容                                 |
| ---------------------------------- | ---------------------------------------- |
| `workflow-intent-matcher.test.ts`  | 模式匹配、关键词匹配、正则匹配、缓存逻辑 |
| `workflow-mode-executor.test.ts`   | 工作流启动、错误处理、消息生成           |
| `skill-step-executor.test.ts`      | 输入解析、输出映射、Skill 调用           |
| `workflow-recommender.test.ts`     | 推荐规则、优先级排序、条件评估           |
| `workflow-notifier.test.ts`        | 通知存储、实时推送                       |
| `workflow-system-reminder.test.ts` | Reminder 生成                            |

### 9.2 集成测试

```typescript
// src/lib/workflow/__tests__/integration/ai-integration.test.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getWorkflowModeExecutor } from "../../integration/workflow-mode-executor";
import { getWorkflowIntentMatcher } from "../../integration/workflow-intent-matcher";

describe("Workflow AI Integration", () => {
  describe("Conversation Trigger", () => {
    it("should match '检查书签健康' to bookmark_health workflow", async () => {
      const matcher = getWorkflowIntentMatcher();
      const result = await matcher.matchWorkflow(
        "帮我检查一下书签健康状况",
        "test-user-id",
      );

      expect(result).not.toBeNull();
      expect(result?.workflowId).toBe("bookmark_health");
      expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("should execute workflow when matched", async () => {
      const executor = getWorkflowModeExecutor();
      const result = await executor.tryExecuteWorkflow("做一下每周整理", {
        userId: "test-user-id",
        conversationId: "conv-123",
      });

      expect(result).not.toBeNull();
      expect(result?.type).toBe("workflow");
      expect(result?.status).toBe("started");
    });

    it("should return null for non-workflow messages", async () => {
      const executor = getWorkflowModeExecutor();
      const result = await executor.tryExecuteWorkflow("今天天气怎么样", {
        userId: "test-user-id",
        conversationId: "conv-123",
      });

      expect(result).toBeNull();
    });
  });

  describe("Workflow Recommendations", () => {
    it("should recommend smart_intake for many untagged bookmarks", () => {
      const context = {
        bookmarkStats: { total: 200, untaggedCount: 80 },
        weeklyActivity: { newBookmarks: 5 },
        topTags: [],
      };

      const recommendations = recommendWorkflows(context);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].workflowId).toBe("smart_intake");
    });
  });
});
```

---

## 10. 实施步骤

### Day 0.5: 接口验证（Phase 0 延续）

| 时间 | 任务                              | 产出                |
| ---- | --------------------------------- | ------------------- |
| 上午 | 验证 OrchestrationEngine 实际签名 | 接口兼容性报告      |
| 上午 | 确认 StreamResultCollector 可用   | 集成测试通过        |
| 下午 | 安装 expr-eval 并验证             | 依赖安装 + 类型检查 |

### Day 1: 核心集成

| 时间 | 任务                       | 产出                     |
| ---- | -------------------------- | ------------------------ |
| 上午 | 实现 WorkflowIntentMatcher | 模式匹配器 + 测试        |
| 上午 | 添加意图分类规则           | intent-rules-workflow.ts |
| 下午 | 实现 WorkflowModeExecutor  | 工作流执行器 + 测试      |
| 下午 | 集成到 UnifiedEngine       | 工作流模式分支           |

### Day 2: Skill 复用 + 安全性

| 时间 | 任务                                                 | 产出                 |
| ---- | ---------------------------------------------------- | -------------------- |
| 上午 | 实现 SkillStepExecutor（使用 StreamResultCollector） | 步骤执行器 + 测试    |
| 上午 | **实现 SafeExpressionEvaluator（expr-eval）**        | 安全条件评估器       |
| 下午 | 实现 WorkflowRecommender                             | 推荐器 + 规则 + 测试 |
| 下午 | 集成到 DynamicContext                                | 推荐数据注入         |

### Day 3: 通知 + 调试

| 时间 | 任务                        | 产出                |
| ---- | --------------------------- | ------------------- |
| 上午 | 实现 WorkflowNotifier       | 通知服务 + 测试     |
| 上午 | 实现 System-Reminder 生成器 | 提醒模板            |
| 下午 | Feature Flag 配置           | 环境变量 + 开关逻辑 |
| 下午 | 端到端测试 + 调试           | 完整流程验证        |

---

## 11. 新增文件清单

```
src/lib/workflow/integration/
├── types.ts                         # 集成类型定义
├── workflow-intent-matcher.ts       # 工作流意图匹配器
├── workflow-mode-executor.ts        # 工作流模式执行器
├── skill-step-executor.ts           # Skill 步骤执行器（使用 StreamResultCollector）
├── safe-expression-evaluator.ts     # [新增] 安全条件评估器（expr-eval）
├── workflow-recommender.ts          # 工作流推荐器
├── workflow-notifier.ts             # 工作流通知服务
├── workflow-system-reminder.ts      # System-Reminder 生成器
├── index.ts                         # 模块导出
└── __tests__/
    ├── workflow-intent-matcher.test.ts
    ├── workflow-mode-executor.test.ts
    ├── skill-step-executor.test.ts
    ├── safe-expression-evaluator.test.ts  # [新增] 安全评估器测试
    ├── workflow-recommender.test.ts
    ├── workflow-notifier.test.ts
    ├── workflow-system-reminder.test.ts
    └── integration/
        └── ai-integration.test.ts

src/lib/ai-agent/router/
└── intent-rules-workflow.ts         # 工作流意图规则

# 需修改的文件
src/lib/ai-skills/engine/unified-engine.ts  # 添加工作流模式分支
src/lib/ai-agent/config/feature-flags.ts    # 添加工作流 Feature Flags
src/lib/workflow/engine/execution-engine.ts # 集成 SkillStepExecutor + SafeExpressionEvaluator

# 新增依赖
package.json                               # 添加 expr-eval
```

---

## 12. 验收标准

### 12.1 功能验收

| 验收项     | 测试方法               | 预期结果                      |
| ---------- | ---------------------- | ----------------------------- |
| 对话触发   | 输入「检查书签健康」   | 启动 bookmark_health 工作流   |
| 模式匹配   | 输入「做一下每周整理」 | 匹配 weekly_organize 工作流   |
| 模糊匹配   | 输入「帮我整理一下」   | 匹配相关工作流 (置信度 ≥ 0.7) |
| 非匹配回退 | 输入「今天天气怎么样」 | 走原子模式，不触发工作流      |
| Skill 复用 | 工作流执行 Skill 步骤  | 通过 OrchestrationEngine 执行 |
| 推荐生成   | 大量未分类书签         | 推荐「智能收录」工作流        |
| 完成通知   | 工作流执行完成         | 收到通知 + System-Reminder    |

### 12.2 性能指标

| 指标           | 目标值  |
| -------------- | ------- |
| 意图匹配延迟   | < 50ms  |
| 工作流启动延迟 | < 200ms |
| 推荐生成延迟   | < 30ms  |
| 缓存命中率     | > 80%   |

### 12.3 测试覆盖

| 模块                    | 目标覆盖率 |
| ----------------------- | ---------- |
| workflow-intent-matcher | ≥ 85%      |
| workflow-mode-executor  | ≥ 80%      |
| skill-step-executor     | ≥ 85%      |
| workflow-recommender    | ≥ 90%      |
| workflow-notifier       | ≥ 75%      |

---

## 13. 合规性检查清单

| 检查项                                           | 状态 |
| ------------------------------------------------ | ---- |
| 使用 `createClient()` 直接调用（非构造函数注入） | ✅   |
| 使用单例模式获取服务实例                         | ✅   |
| 复用现有 IntentRouter 扩展模式                   | ✅   |
| 复用现有 OrchestrationEngine 执行 Skill          | ✅   |
| 复用现有 DynamicContext 类型                     | ✅   |
| 复用现有 System-Reminder 机制                    | ✅   |
| Feature Flag 控制所有新功能                      | ✅   |
| 日志使用 `logger` 模块                           | ✅   |
| 类型定义独立于实现                               | ✅   |
| 单元测试覆盖核心逻辑                             | ✅   |
