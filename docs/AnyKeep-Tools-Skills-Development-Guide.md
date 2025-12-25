# AnyKeep Tools & Skills Development Guide

> **Version**: 1.0.0
> **Last Updated**: 2025-12-25
> **Applies To**: AI Skills 架构 v2.4.0+

---

## Table of Contents

1. [架构概述](#1-架构概述)
2. [核心概念](#2-核心概念)
3. [Atomic Skill 开发规范](#3-atomic-skill-开发规范)
4. [Orchestration Skill 开发规范](#4-orchestration-skill-开发规范)
5. [Tool 开发规范](#5-tool-开发规范)
6. [意图路由集成](#6-意图路由集成)
7. [输出格式规范](#7-输出格式规范)
8. [测试规范](#8-测试规范)
9. [最佳实践](#9-最佳实践)
10. [Checklist](#10-checklist)

---

## 1. 架构概述

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    /api/agent/unified                            │
│                    (统一 API 入口)                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    UnifiedEngine                                 │
│  ├─ IntentRouter (意图路由)                                      │
│  ├─ 模式切换 (Atomic ↔ Orchestration)                           │
│  └─ 自动回退机制                                                  │
└───────────────┬─────────────────────────┬───────────────────────┘
                │                         │
     ┌──────────▼──────────┐   ┌──────────▼──────────────────────┐
     │   Atomic Mode       │   │   Orchestration Mode            │
     │  (KnowledgeAgent)   │   │   (OrchestrationEngine)         │
     │                     │   │                                 │
     │  ┌───────────────┐  │   │  ┌────────────────────────────┐ │
     │  │ Atomic Skills │  │   │  │ Orchestration Skills       │ │
     │  │ ─────────────-│  │   │  │ ─────────────────────────  │ │
     │  │ • SearchSkill │  │   │  │ • KnowledgeReviewSkill    │ │
     │  │ • ClassifyS.  │  │   │  │ • DataExportSkill         │ │
     │  │ • SummaryS.   │  │   │  │ • InsightReportSkill      │ │
     │  │ • ...         │  │   │  │ • BatchOrganizeSkill      │ │
     │  └───────────────┘  │   │  │ • ... (12 Skills)         │ │
     │         ↓           │   │  └────────────────────────────┘ │
     │  toTool() 转换为    │   │                                 │
     │  Vercel AI SDK Tool │   │  多步骤流式执行                   │
     └─────────────────────┘   └─────────────────────────────────┘
```

### 1.2 核心目录结构

```
src/lib/ai-skills/
├── core/                          # 核心基础设施
│   ├── base-skill.ts              # Skill 基类
│   ├── skill-registry.ts          # Skills 注册中心
│   └── types.ts                   # 核心类型定义
├── router/                        # 意图路由系统
│   ├── intent-classifier.ts       # 意图分类器
│   ├── complexity-evaluator.ts    # 复杂度评估器
│   ├── mode-selector.ts           # 模式选择器
│   └── intent-router.ts           # 路由整合
├── engine/                        # 执行引擎
│   ├── unified-engine.ts          # 统一引擎入口
│   ├── orchestration-engine.ts    # 编排执行引擎
│   └── types.ts
├── orchestration/                 # 编排基础设施
│   ├── orchestration-skill.ts     # 编排 Skill 基类
│   ├── progress-reporter.ts       # 进度报告器
│   └── types.ts
├── output/                        # 输出适配层
│   ├── adapter.ts                 # 输出适配器
│   └── types.ts
├── effects/                       # 副作用管理
│   ├── effect-manager.ts
│   └── types.ts
├── skills/                        # Skill 实现目录
│   ├── atomic/                    # 原子 Skills
│   │   ├── search/
│   │   ├── classify/
│   │   └── summary/
│   └── orchestration/             # 编排 Skills
│       ├── knowledge-review/
│       ├── data-export/
│       ├── insight-report/
│       └── batch-organize/
└── register.ts                    # Skills 注册入口
```

---

## 2. 核心概念

### 2.1 Skill vs Tool

| 特性        | Atomic Skill  | Orchestration Skill | Tool          |
| ----------- | ------------- | ------------------- | ------------- |
| 执行模式    | 同步/单步     | 异步/多步骤         | 同步/单步     |
| 流式输出    | ❌            | ✅                  | ❌            |
| 用户确认    | ❌            | ✅                  | ❌            |
| 交付物      | ❌            | ✅                  | ❌            |
| 进度报告    | ❌            | ✅                  | ❌            |
| 可转为 Tool | ✅            | ❌                  | N/A           |
| 使用场景    | 简单查询/操作 | 复杂任务编排        | AI Agent 调用 |

### 2.2 类型层次

```typescript
// 基础接口
interface ISkill<TInput, TOutput> {
  readonly metadata: SkillMetadata;
  execute(input: TInput, context?: SkillContext): Promise<SkillOutput<TOutput>>;
  validateInput(input: unknown): TInput;
  validateOutput(output: unknown): TOutput;
}

// 原子 Skill (可转为 Tool)
interface IAtomicSkill<TInput, TOutput> extends ISkill<TInput, TOutput> {
  toTool(contextProvider?: () => SkillContext): Tool<TInput, TOutput>;
}

// 编排 Skill (流式执行)
interface IOrchestrationSkill<TInput = unknown, TOutput = unknown>
  extends ISkill<TInput, TOutput> {
  parseInput(message: string, context: OrchestrationContext): Promise<TInput>;
  executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk>;
}
```

---

## 3. Atomic Skill 开发规范

### 3.1 文件结构

```
src/lib/ai-skills/skills/atomic/{skill-name}/
├── index.ts              # 导出入口
├── {skill-name}.skill.ts # Skill 实现
├── types.ts              # 类型定义
├── schema.ts             # Zod Schema
└── __tests__/
    └── {skill-name}.skill.test.ts
```

### 3.2 实现模板

```typescript
// src/lib/ai-skills/skills/atomic/example/example.skill.ts

import { z } from "zod";
import { BaseSkill } from "@/lib/ai-skills/core/base-skill";
import type { SkillContext, SkillMetadata } from "@/lib/ai-skills/core/types";

// ============================================================
// 1. 定义输入/输出 Schema (必须使用 Zod)
// ============================================================

export const exampleInputSchema = z.object({
  query: z.string().min(1).max(500).describe("搜索查询"),
  limit: z.number().int().min(1).max(100).default(10).describe("返回数量"),
  filters: z
    .object({
      platform: z.enum(["wechat", "bilibili", "xiaohongshu"]).optional(),
      dateRange: z
        .object({
          start: z.string().datetime().optional(),
          end: z.string().datetime().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const exampleOutputSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      url: z.string().url(),
      score: z.number().min(0).max(1),
    }),
  ),
  totalCount: z.number(),
  executionTimeMs: z.number(),
});

// 类型推导
export type ExampleInput = z.infer<typeof exampleInputSchema>;
export type ExampleOutput = z.infer<typeof exampleOutputSchema>;

// ============================================================
// 2. 定义 Skill 元数据
// ============================================================

const metadata: SkillMetadata = {
  id: "example_skill", // 唯一标识，snake_case
  name: "示例技能", // 用户可见名称
  description: "这是一个示例技能的描述", // 功能描述
  category: "query", // 类别: query | action | create | organize | analyze | learn
  version: "1.0.0", // SemVer 版本
  author: "AnyKeep Team", // 作者
  capabilities: ["search", "filter"], // 能力标签
  maxExecutionTimeMs: 30000, // 最大执行时间 (默认 30s)
};

// ============================================================
// 3. 实现 Skill 类
// ============================================================

export class ExampleSkill extends BaseSkill<ExampleInput, ExampleOutput> {
  constructor() {
    super(metadata, exampleInputSchema, exampleOutputSchema);
  }

  /**
   * 核心执行逻辑
   *
   * @param input - 经过验证的输入参数
   * @param context - 执行上下文 (userId, conversationId 等)
   * @returns 执行结果
   */
  protected async executeInternal(
    input: ExampleInput,
    context?: SkillContext,
  ): Promise<ExampleOutput> {
    const startTime = Date.now();

    // 1. 业务逻辑实现
    // 注意: 这里应该调用实际的服务/数据库
    const results = await this.searchBookmarks(input, context);

    // 2. 构造输出
    return {
      results,
      totalCount: results.length,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * 私有辅助方法
   */
  private async searchBookmarks(
    input: ExampleInput,
    context?: SkillContext,
  ): Promise<ExampleOutput["results"]> {
    // 实际实现...
    return [];
  }
}

// ============================================================
// 4. 导出单例实例
// ============================================================

export const exampleSkill = new ExampleSkill();
```

### 3.3 命名规范

| 项目        | 规范                        | 示例                              |
| ----------- | --------------------------- | --------------------------------- |
| Skill ID    | `snake_case`                | `knowledge_review`, `data_export` |
| 类名        | `PascalCase` + `Skill` 后缀 | `SearchSkill`, `ClassifySkill`    |
| 文件名      | `kebab-case` + `.skill.ts`  | `search.skill.ts`                 |
| Schema 变量 | `camelCase` + `Schema` 后缀 | `searchInputSchema`               |
| 实例导出    | `camelCase` + `Skill` 后缀  | `searchSkill`                     |

### 3.4 输入验证规则

```typescript
// ✅ 好的做法 - 详细的约束和描述
const inputSchema = z.object({
  query: z
    .string()
    .min(1, "查询不能为空")
    .max(500, "查询不能超过 500 字符")
    .describe("用户的搜索查询文本"),

  limit: z
    .number()
    .int("必须是整数")
    .min(1, "至少返回 1 条")
    .max(100, "最多返回 100 条")
    .default(10)
    .describe("返回结果数量限制"),
});

// ❌ 不好的做法 - 缺少约束和描述
const inputSchema = z.object({
  query: z.string(),
  limit: z.number(),
});
```

---

## 4. Orchestration Skill 开发规范

### 4.1 文件结构

```
src/lib/ai-skills/skills/orchestration/{skill-name}/
├── index.ts                      # 导出入口
├── {skill-name}.skill.ts         # Skill 主实现
├── types.ts                      # 类型定义
├── schema.ts                     # Zod Schema
├── steps/                        # 步骤实现 (可选，复杂 Skill)
│   ├── step-1-analyze.ts
│   ├── step-2-process.ts
│   └── step-3-generate.ts
└── __tests__/
    ├── {skill-name}.skill.test.ts
    └── {skill-name}.integration.test.ts
```

### 4.2 实现模板

```typescript
// src/lib/ai-skills/skills/orchestration/example/example.skill.ts

import { z } from "zod";
import { OrchestrationSkill } from "@/lib/ai-skills/orchestration/orchestration-skill";
import { ProgressReporter } from "@/lib/ai-skills/orchestration/progress-reporter";
import type {
  OrchestrationContext,
  OrchestrationStreamChunk,
  StepDefinition,
} from "@/lib/ai-skills/orchestration/types";
import type { SkillMetadata } from "@/lib/ai-skills/core/types";

// ============================================================
// 1. 定义输入/输出 Schema
// ============================================================

export const exampleInputSchema = z.object({
  targetFolderId: z.number().optional().describe("目标文件夹 ID"),
  options: z
    .object({
      includeSubfolders: z.boolean().default(true),
      dryRun: z.boolean().default(false),
    })
    .optional(),
});

export const exampleOutputSchema = z.object({
  processedCount: z.number(),
  changes: z.array(
    z.object({
      bookmarkId: z.number(),
      action: z.string(),
    }),
  ),
});

export type ExampleInput = z.infer<typeof exampleInputSchema>;
export type ExampleOutput = z.infer<typeof exampleOutputSchema>;

// ============================================================
// 2. 定义步骤
// ============================================================

const STEPS: StepDefinition[] = [
  { id: "analyze", name: "分析收藏", weight: 1 },
  { id: "process", name: "处理数据", weight: 2 }, // 权重 2 表示耗时较长
  { id: "confirm", name: "用户确认", weight: 1 },
  { id: "execute", name: "执行操作", weight: 2 },
  { id: "report", name: "生成报告", weight: 1 },
];

// ============================================================
// 3. 定义 Skill 元数据
// ============================================================

const metadata: SkillMetadata = {
  id: "example_orchestration",
  name: "示例编排技能",
  description: "这是一个多步骤编排技能的示例",
  category: "organize",
  version: "1.0.0",
  author: "AnyKeep Team",
  capabilities: ["multi-step", "confirmation", "deliverable"],
  requiresConfirmation: true, // 编排 Skill 特有
  estimatedDurationMs: 60000, // 预估执行时间
  steps: STEPS, // 步骤定义
};

// ============================================================
// 4. 实现 Skill 类
// ============================================================

export class ExampleOrchestrationSkill extends OrchestrationSkill<
  ExampleInput,
  ExampleOutput
> {
  constructor() {
    super(metadata, exampleInputSchema, exampleOutputSchema);
  }

  /**
   * 解析自然语言输入为结构化参数
   *
   * @param message - 用户的自然语言输入
   * @param context - 编排上下文
   * @returns 结构化的输入参数
   */
  async parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<ExampleInput> {
    // 方案 1: 简单规则解析
    const folderMatch = message.match(/文件夹\s*[「"']?([^"'」]+)[「"']?/);

    // 方案 2: 使用 LLM 解析 (推荐复杂场景)
    // const parsed = await this.llmParse(message, exampleInputSchema)

    return {
      targetFolderId: undefined, // 从 context 获取
      options: {
        includeSubfolders: message.includes("包含子文件夹"),
        dryRun: message.includes("预览") || message.includes("dry-run"),
      },
    };
  }

  /**
   * 流式执行主逻辑
   *
   * ⚠️ 重要: 使用 yield* 委托给 protected 辅助方法
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const progressReporter = new ProgressReporter(STEPS);
    const input = context.parsedInput as ExampleInput;

    try {
      // ============================================================
      // Step 1: 分析收藏
      // ============================================================
      yield* this.reportProgress("analyze", 0, "开始分析收藏...");

      const analysisResult = await this.analyzeBookmarks(context);

      yield* this.reportProgress("analyze", 100, "分析完成");
      yield* this.emitText(`找到 ${analysisResult.count} 条收藏需要处理。`);

      // ============================================================
      // Step 2: 处理数据
      // ============================================================
      yield* this.reportProgress("process", 0, "开始处理数据...");

      const processedData = await this.processData(
        analysisResult,
        (percent) => {
          // 进度回调 - 用于长时间操作的进度更新
        },
      );

      yield* this.reportProgress("process", 100, "处理完成");

      // ============================================================
      // Step 3: 用户确认 (需要等待用户响应)
      // ============================================================
      yield* this.reportProgress("confirm", 0, "等待用户确认...");

      yield* this.emitConfirmation(
        "确认执行操作",
        `即将对 ${processedData.length} 条收藏执行操作，是否继续？`,
        [
          { id: "confirm", label: "确认执行", style: "primary" },
          { id: "preview", label: "预览详情", style: "secondary" },
          { id: "cancel", label: "取消", style: "danger" },
        ],
        {
          // 可选: 预览数据
          previewData: processedData.slice(0, 5),
        },
      );

      // 等待确认结果
      const confirmationResult = await context.waitForConfirmation?.();

      if (confirmationResult?.selectedOption === "cancel") {
        yield* this.emitText("操作已取消。");
        yield* this.emitDone(false, "用户取消");
        return;
      }

      yield* this.reportProgress("confirm", 100, "已确认");

      // ============================================================
      // Step 4: 执行操作
      // ============================================================
      yield* this.reportProgress("execute", 0, "开始执行...");

      const executeResult = await this.executeChanges(
        processedData,
        input,
        context,
      );

      yield* this.reportProgress("execute", 100, "执行完成");

      // ============================================================
      // Step 5: 生成报告
      // ============================================================
      yield* this.reportProgress("report", 0, "生成报告...");

      const deliverable = this.createDeliverable(
        "report",
        "操作执行报告",
        {
          summary: `成功处理 ${executeResult.successCount} 条收藏`,
          details: executeResult.changes,
          timestamp: new Date().toISOString(),
        },
        "markdown",
        { downloadable: true },
      );

      yield* this.emitDeliverable(deliverable);
      yield* this.reportProgress("report", 100, "报告生成完成");

      // ============================================================
      // 完成
      // ============================================================
      yield* this.emitSuggestions([
        { label: "查看详细日志", action: "view_logs" },
        { label: "撤销操作", action: "undo", disabled: input.options?.dryRun },
      ]);

      yield* this.emitDone(
        true,
        `成功处理 ${executeResult.successCount} 条收藏`,
      );
    } catch (error) {
      yield* this.emitError(
        error instanceof Error ? error.message : "执行失败",
        "EXECUTION_ERROR",
        true, // retryable
      );
    }
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  private async analyzeBookmarks(context: OrchestrationContext) {
    // 实际分析逻辑...
    return { count: 100 };
  }

  private async processData(
    analysis: { count: number },
    onProgress?: (percent: number) => void,
  ) {
    // 实际处理逻辑...
    return [];
  }

  private async executeChanges(
    data: unknown[],
    input: ExampleInput,
    context: OrchestrationContext,
  ) {
    // 实际执行逻辑...
    return { successCount: 0, changes: [] };
  }
}

// ============================================================
// 5. 导出实例
// ============================================================

export const exampleOrchestrationSkill = new ExampleOrchestrationSkill();
```

### 4.3 步骤设计原则

```typescript
// ✅ 好的步骤设计
const STEPS: StepDefinition[] = [
  { id: "analyze", name: "分析数据", weight: 1 }, // 轻量级
  { id: "process", name: "处理数据", weight: 3 }, // 重量级，权重高
  { id: "confirm", name: "用户确认", weight: 1 }, // 等待用户
  { id: "execute", name: "执行操作", weight: 2 }, // 中等
  { id: "report", name: "生成报告", weight: 1 }, // 轻量级
];

// ❌ 不好的设计 - 步骤太细或太粗
const STEPS: StepDefinition[] = [
  { id: "all", name: "执行", weight: 1 }, // 太粗，无法展示进度
];

const STEPS: StepDefinition[] = [
  { id: "step1", name: "读取第1条", weight: 1 },
  { id: "step2", name: "读取第2条", weight: 1 },
  // ... 100 个步骤 - 太细，维护困难
];
```

### 4.4 进度报告规范

```typescript
// 进度报告最佳实践

// 1. 步骤开始时
yield * this.reportProgress("analyze", 0, "开始分析...");

// 2. 步骤进行中 (长时间操作)
for (let i = 0; i < items.length; i++) {
  await processItem(items[i]);
  const percent = Math.round(((i + 1) / items.length) * 100);
  yield *
    this.reportProgress("process", percent, `处理中 ${i + 1}/${items.length}`);
}

// 3. 步骤完成时
yield * this.reportProgress("analyze", 100, "分析完成");

// ⚠️ 注意: ProgressReporter 内部有 100ms 节流，避免过于频繁的更新
```

---

## 5. Tool 开发规范

### 5.1 Tool 与 Skill 的关系

```typescript
// Atomic Skill 可以转换为 Tool
const searchTool = searchSkill.toTool(() => ({
  userId: currentUserId,
  conversationId: conversationId,
}))

// Tool 被 KnowledgeAgent 自动调用
const tools = skillRegistry.exportAsTools(undefined, contextProvider)
await knowledgeAgent.executeStream(input, { tools, ... })
```

### 5.2 独立 Tool 开发 (非 Skill 转换)

```typescript
// src/lib/ai-skills/tools/example.tool.ts

import { z } from "zod";
import { tool } from "ai"; // Vercel AI SDK

export const exampleTool = tool({
  description: "这是一个独立 Tool 的描述",
  parameters: z.object({
    param1: z.string().describe("参数1的描述"),
    param2: z.number().optional().describe("可选参数2"),
  }),
  execute: async ({ param1, param2 }) => {
    // Tool 执行逻辑
    return { result: "success" };
  },
});
```

### 5.3 Tool 命名规范

| 项目        | 规范                      | 示例                         |
| ----------- | ------------------------- | ---------------------------- |
| Tool 变量名 | `camelCase` + `Tool` 后缀 | `searchTool`, `classifyTool` |
| description | 简洁、以动词开头          | "Search bookmarks by query"  |
| parameters  | 使用 Zod Schema           | `z.object({...})`            |

---

## 6. 意图路由集成

### 6.1 添加新的意图分类规则

```typescript
// src/lib/ai-skills/router/intent-classifier.ts

// 在 CLASSIFICATION_RULES 数组中添加新规则
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ... 现有规则

  // 添加新规则
  {
    pattern: /导出|export|下载/i,
    intent: { type: "create", subType: "export" },
    weight: 75,
    extractors: {
      // 实体提取器
      format: (text) => {
        if (/csv/i.test(text)) return "csv";
        if (/json/i.test(text)) return "json";
        if (/markdown|md/i.test(text)) return "markdown";
        return undefined;
      },
    },
  },
];
```

### 6.2 添加 Skill 映射

```typescript
// src/lib/ai-skills/router/mode-selector.ts

// 在 SKILL_MAPPINGS 中添加映射
const SKILL_MAPPINGS: Record<string, string> = {
  // 现有映射
  "learn:review": "knowledge_review",
  "organize:cleanup": "batch_organize",

  // 添加新映射
  "create:export": "data_export",
  "analyze:trend": "insight_report",
};
```

### 6.3 复杂度权重调整

```typescript
// src/lib/ai-skills/router/complexity-evaluator.ts

// 意图类型基础分数
const BASE_INTENT_SCORES: Record<IntentType, number> = {
  chitchat: 10,
  query: 20,
  action: 30,
  create: 50,
  organize: 70,
  analyze: 75,
  learn: 80,
};

// 子类型调整
const SUBTYPE_ADJUSTMENTS: Record<string, number> = {
  // create 类型
  "create:summary": -5, // 降低复杂度
  "create:export": +10, // 提高复杂度

  // organize 类型
  "organize:tag": -10, // 简单操作
  "organize:dedupe": +15, // 复杂操作
};
```

---

## 7. 输出格式规范

### 7.1 统一输出块类型

```typescript
// UnifiedStreamChunk 类型定义

interface UnifiedStreamChunk {
  type:
    | "text" // 文本输出
    | "progress" // 进度更新
    | "tool-call" // Tool 调用信息 (原子模式)
    | "confirmation" // 用户确认请求
    | "deliverable" // 交付物
    | "suggestions" // 后续建议
    | "routing" // 路由信息 (调试)
    | "fallback" // 降级回退通知
    | "error" // 错误信息
    | "done"; // 执行完成

  data: {
    // text
    text?: string;
    isPartial?: boolean;

    // progress
    step?: string;
    percent?: number;
    message?: string;

    // confirmation
    id?: string;
    title?: string;
    confirmMessage?: string;
    options?: ConfirmOption[];

    // deliverable
    deliverable?: Deliverable;

    // suggestions
    suggestions?: Suggestion[];

    // routing
    mode?: "atomic" | "orchestration";
    reason?: string;
    skill?: string;

    // error
    errorMessage?: string;
    errorCode?: string;
    retryable?: boolean;

    // done
    success?: boolean;
    summary?: string;
  };
}
```

### 7.2 交付物类型

```typescript
interface Deliverable {
  type:
    | "report" // 报告
    | "list" // 列表
    | "file" // 文件
    | "card" // 卡片
    | "chart" // 图表
    | "table"; // 表格

  title: string;
  content: unknown;
  format: "markdown" | "html" | "json" | "csv" | "plain";

  options?: {
    downloadable?: boolean;
    previewable?: boolean;
    collapsible?: boolean;
    maxHeight?: number;
  };
}
```

---

## 8. 测试规范

### 8.1 Atomic Skill 测试

```typescript
// src/lib/ai-skills/skills/atomic/search/__tests__/search.skill.test.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchSkill } from "../search.skill";
import type { SkillContext } from "@/lib/ai-skills/core/types";

describe("SearchSkill", () => {
  const mockContext: SkillContext = {
    userId: "test-user-id",
    conversationId: "test-conversation-id",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(searchSkill.metadata.id).toBe("search");
      expect(searchSkill.metadata.category).toBe("query");
    });
  });

  describe("input validation", () => {
    it("should validate valid input", () => {
      const input = { query: "test query", limit: 10 };
      expect(() => searchSkill.validateInput(input)).not.toThrow();
    });

    it("should reject invalid input", () => {
      const input = { query: "", limit: -1 }; // 空查询，负数限制
      expect(() => searchSkill.validateInput(input)).toThrow();
    });
  });

  describe("execute", () => {
    it("should return results on success", async () => {
      const input = { query: "test", limit: 5 };
      const result = await searchSkill.execute(input, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results).toBeDefined();
        expect(result.data.totalCount).toBeGreaterThanOrEqual(0);
      }
    });

    it("should respect timeout", async () => {
      // 测试超时处理
    });
  });

  describe("toTool", () => {
    it("should convert to valid Tool", () => {
      const tool = searchSkill.toTool(() => mockContext);

      expect(tool.description).toBe(searchSkill.metadata.description);
      expect(tool.execute).toBeInstanceOf(Function);
    });
  });
});
```

### 8.2 Orchestration Skill 测试

```typescript
// src/lib/ai-skills/skills/orchestration/knowledge-review/__tests__/knowledge-review.skill.test.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import { knowledgeReviewSkill } from "../knowledge-review.skill";
import type { OrchestrationContext } from "@/lib/ai-skills/orchestration/types";

describe("KnowledgeReviewSkill", () => {
  const mockContext: OrchestrationContext = {
    userId: "test-user-id",
    conversationId: "test-conversation-id",
    parsedInput: {},
    waitForConfirmation: vi
      .fn()
      .mockResolvedValue({ selectedOption: "confirm" }),
  };

  describe("parseInput", () => {
    it("should parse natural language input", async () => {
      const message = "帮我复习最近一周的收藏";
      const parsed = await knowledgeReviewSkill.parseInput(
        message,
        mockContext,
      );

      expect(parsed.timeRange).toBeDefined();
      expect(parsed.reviewMode).toBeDefined();
    });
  });

  describe("executeStream", () => {
    it("should yield progress chunks", async () => {
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of knowledgeReviewSkill.executeStream(
        mockContext,
      )) {
        chunks.push(chunk);
      }

      // 验证有进度块
      const progressChunks = chunks.filter((c) => c.type === "progress");
      expect(progressChunks.length).toBeGreaterThan(0);

      // 验证有完成块
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
    });

    it("should request user confirmation", async () => {
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of knowledgeReviewSkill.executeStream(
        mockContext,
      )) {
        chunks.push(chunk);
      }

      const confirmationChunk = chunks.find((c) => c.type === "confirmation");
      expect(confirmationChunk).toBeDefined();
    });

    it("should generate deliverable", async () => {
      const chunks: OrchestrationStreamChunk[] = [];

      for await (const chunk of knowledgeReviewSkill.executeStream(
        mockContext,
      )) {
        chunks.push(chunk);
      }

      const deliverableChunk = chunks.find((c) => c.type === "deliverable");
      expect(deliverableChunk).toBeDefined();
      expect(deliverableChunk?.data.deliverable?.type).toBe("report");
    });
  });
});
```

### 8.3 集成测试

```typescript
// src/lib/ai-skills/__tests__/unified-engine.integration.test.ts

import { describe, it, expect } from "vitest";
import { createUnifiedEngine } from "../engine/unified-engine";
import type { EngineContext, UnifiedStreamChunk } from "../engine/types";

describe("UnifiedEngine Integration", () => {
  const engine = createUnifiedEngine();

  const mockContext: EngineContext = {
    userId: "test-user",
    conversationId: "test-conv",
  };

  it("should route simple query to atomic mode", async () => {
    const chunks: UnifiedStreamChunk[] = [];

    for await (const chunk of engine.execute("搜索 AI 相关文章", mockContext)) {
      chunks.push(chunk);
    }

    const routingChunk = chunks.find((c) => c.type === "routing");
    expect(routingChunk?.data.mode).toBe("atomic");
  });

  it("should route complex task to orchestration mode", async () => {
    const chunks: UnifiedStreamChunk[] = [];

    for await (const chunk of engine.execute(
      "帮我整理收藏并生成学习计划",
      mockContext,
    )) {
      chunks.push(chunk);
    }

    const routingChunk = chunks.find((c) => c.type === "routing");
    expect(routingChunk?.data.mode).toBe("orchestration");
  });

  it("should fallback to atomic on orchestration failure", async () => {
    // 测试自动回退机制
  });
});
```

---

## 9. 最佳实践

### 9.1 Skill 设计原则

```
┌─────────────────────────────────────────────────────────────────┐
│                      SOLID in Skills                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  S - Single Responsibility                                      │
│      每个 Skill 只做一件事                                        │
│      ❌ DataManagementSkill (导入+导出+整理)                     │
│      ✅ DataExportSkill, DataImportSkill, BatchOrganizeSkill    │
│                                                                 │
│  O - Open/Closed                                                │
│      通过继承扩展，不修改基类                                      │
│      ✅ 继承 BaseSkill 或 OrchestrationSkill                    │
│      ❌ 修改基类添加特定逻辑                                      │
│                                                                 │
│  L - Liskov Substitution                                        │
│      子类可以替换父类使用                                          │
│      ✅ 所有 Skill 可以通过 ISkill 接口调用                       │
│                                                                 │
│  I - Interface Segregation                                      │
│      接口专一，不强制实现不需要的方法                               │
│      ✅ IAtomicSkill vs IOrchestrationSkill 分离                │
│                                                                 │
│  D - Dependency Inversion                                       │
│      依赖抽象，不依赖具体                                          │
│      ✅ 依赖 SkillContext 接口                                   │
│      ❌ 直接依赖 Supabase Client                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 错误处理

```typescript
// ✅ 好的错误处理
async *executeStream(context: OrchestrationContext) {
  try {
    // 业务逻辑
  } catch (error) {
    if (error instanceof ValidationError) {
      yield* this.emitError(error.message, "VALIDATION_ERROR", false)
    } else if (error instanceof NetworkError) {
      yield* this.emitError("网络错误，请稍后重试", "NETWORK_ERROR", true)
    } else {
      // 未知错误 - 记录日志，返回通用消息
      console.error("Unexpected error in skill:", error)
      yield* this.emitError("执行失败，请重试", "UNKNOWN_ERROR", true)
    }
  }
}

// ❌ 不好的错误处理
async *executeStream(context: OrchestrationContext) {
  try {
    // 业务逻辑
  } catch (error) {
    throw error  // 直接抛出，用户看到原始错误
  }
}
```

### 9.3 性能优化

```typescript
// 1. 批量操作
// ❌ 逐个请求
for (const id of bookmarkIds) {
  await supabase.from("bookmarks").update({ tag }).eq("id", id);
}

// ✅ 批量请求
await supabase.from("bookmarks").update({ tag }).in("id", bookmarkIds);

// 2. 进度报告节流
// ❌ 每条记录都报告
for (let i = 0; i < 10000; i++) {
  yield * this.reportProgress("process", (i / 10000) * 100);
}

// ✅ 按比例报告 (ProgressReporter 内部有 100ms 节流)
const reportInterval = Math.max(1, Math.floor(items.length / 100));
for (let i = 0; i < items.length; i++) {
  if (i % reportInterval === 0) {
    yield * this.reportProgress("process", (i / items.length) * 100);
  }
}

// 3. 流式输出合并
// ❌ 频繁发送小块
yield * this.emitText("结");
yield * this.emitText("果");
yield * this.emitText("：");

// ✅ 合并后发送
yield * this.emitText("结果：xxx");
```

### 9.4 安全考虑

```typescript
// 1. 用户隔离
const result = await supabase
  .from("bookmarks")
  .select("*")
  .eq("user_id", context.userId); // ✅ 始终过滤用户

// 2. 输入验证
const inputSchema = z.object({
  folderId: z.number().int().positive(), // ✅ 严格类型
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[^<>&'"]*$/, "不允许特殊字符"), // ✅ XSS 防护
});

// 3. 危险操作确认
if (action === "delete" && count > 10) {
  yield *
    this.emitConfirmation(
      "确认批量删除",
      `即将删除 ${count} 条记录，此操作不可恢复`,
      [
        { id: "confirm", label: "确认删除", style: "danger" },
        { id: "cancel", label: "取消" },
      ],
    );
  const result = await context.waitForConfirmation?.();
  if (result?.selectedOption !== "confirm") return;
}
```

---

## 10. Checklist

### 10.1 Atomic Skill Checklist

```markdown
## 开发前

- [ ] 确认 Skill 类型 (Atomic vs Orchestration)
- [ ] 定义清晰的输入/输出接口
- [ ] 检查是否有现有 Skill 可复用

## 开发中

- [ ] 使用 Zod 定义 inputSchema 和 outputSchema
- [ ] 添加完整的字段描述 (.describe())
- [ ] 实现 executeInternal 方法
- [ ] 定义正确的 metadata
- [ ] 导出单例实例

## 开发后

- [ ] 编写单元测试 (覆盖率 > 80%)
- [ ] 在 SkillRegistry 注册
- [ ] 更新 register.ts
- [ ] 如需路由，添加意图分类规则
- [ ] 更新文档
```

### 10.2 Orchestration Skill Checklist

```markdown
## 开发前

- [ ] 确认需要多步骤编排
- [ ] 设计步骤和权重
- [ ] 确认是否需要用户确认
- [ ] 定义交付物类型

## 开发中

- [ ] 使用 Zod 定义 Schema
- [ ] 实现 parseInput 方法
- [ ] 实现 executeStream 方法
- [ ] 使用 ProgressReporter 报告进度
- [ ] 处理用户确认流程
- [ ] 生成交付物
- [ ] 添加后续建议

## 开发后

- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 在 OrchestrationEngine 注册
- [ ] 添加 Skill 映射
- [ ] 调整复杂度评估权重 (如需)
- [ ] 更新 CLAUDE.md 文档
```

### 10.3 代码审查 Checklist

```markdown
## 类型安全

- [ ] 无 any 类型
- [ ] 完整的 Zod Schema
- [ ] 正确的类型导出

## 错误处理

- [ ] try/catch 包裹异步操作
- [ ] 用户友好的错误消息
- [ ] 错误可重试标记

## 性能

- [ ] 批量操作优化
- [ ] 进度报告节流
- [ ] 无内存泄漏

## 安全

- [ ] 用户隔离
- [ ] 输入验证
- [ ] 危险操作确认

## 测试

- [ ] 单元测试覆盖
- [ ] 边界条件测试
- [ ] 错误路径测试
```

---

## Appendix

### A. 设计模式速查

| 模式                    | 在架构中的应用                                        |
| ----------------------- | ----------------------------------------------------- |
| Strategy                | OutputFormatter 策略选择                              |
| Template Method         | BaseSkill.execute() 执行框架                          |
| Factory                 | createIntentRouter(), createUnifiedEngine()           |
| Singleton               | SkillRegistry 单例                                    |
| Chain of Responsibility | IntentClassifier → ComplexityEvaluator → ModeSelector |
| Adapter                 | UnifiedOutputAdapter 输出适配                         |
| Observer                | EffectManager 事件系统                                |
| Generator               | async \*executeStream() 流式执行                      |

### B. 常见问题

**Q: 什么时候用 Atomic Skill vs Orchestration Skill?**

A:

- Atomic: 单步操作，快速返回，可被 AI Agent 自动调用
- Orchestration: 多步骤，需要进度报告/用户确认/交付物

**Q: 如何添加新的意图类型?**

A: 修改 `IntentType` 类型定义，添加分类规则，更新复杂度评估权重

**Q: Skill 如何访问数据库?**

A: 通过 context 获取 userId，使用项目的 Supabase 客户端访问

---

> **Document Version**: 1.0.0
> **Last Updated**: 2025-12-25
> **Author**: BMad Master
> **Review Status**: Draft
