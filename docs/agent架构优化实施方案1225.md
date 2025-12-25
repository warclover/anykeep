# AgentV3.2 架构优化 - 实施方案

**文档版本**: 1.2.0
**创建日期**: 2025-12-25
**审核日期**: 2025-12-26
**Phase 1 完成日期**: 2025-12-26
**状态**: ✅ Phase 1 已完成

---

## 一、方案概述

基于架构评审报告，本文档提供 **可落地的实施方案**，分为三个阶段执行。

### 时间线

```
Phase 1: 短期优化 (1-2 周) ✅ 已完成 (2025-12-26)
├── Task 1.1: UnifiedEngine.execute() 方法拆分 ✅
├── Task 1.2: 意图类型常量化 ✅
└── Task 1.3: 输入验证增强 ✅

Phase 2: 中期增强 (1 个月)
├── Task 2.1: LLM 意图分类兜底
├── Task 2.2: 路由性能指标
└── Task 2.3: 消歧规则可配置化

Phase 3: 长期规划 (1-2 季度)
├── Task 3.1: Memory 持久化
└── Task 3.2: Effect 权限体系
```

---

## 二、Phase 1: 短期优化 (1-2 周)

### Task 1.1: UnifiedEngine.execute() 方法拆分

**目标**: 将 860 行的 UnifiedEngine 拆分为职责单一的模块

**当前问题**:

- `execute()` 方法 180 行，职责过多
- 记忆处理、建议注入、回退机制混杂在一起

**实施步骤**:

#### Step 1.1.1: 创建 InputPreprocessor 模块

```typescript
// src/lib/ai-skills/engine/input-preprocessor.ts

import type { MemoryManager, ReferenceResolutionResult } from "../../ai-memory";
import type { UnifiedStreamChunk } from "../output/types";
import type { EngineContext } from "./types";

export interface PreprocessResult {
  processedInput: string;
  resolution: ReferenceResolutionResult | null;
  memoryChunk: UnifiedStreamChunk | null;
}

export class InputPreprocessor {
  constructor(private memoryManager: MemoryManager) {}

  /**
   * 预处理用户输入
   * - 解析指代词
   * - 记录用户消息
   * - 生成记忆块
   */
  preprocess(
    input: string,
    context: EngineContext,
    enableMemory: boolean,
  ): PreprocessResult {
    if (!enableMemory || !context.conversationId) {
      return {
        processedInput: input,
        resolution: null,
        memoryChunk: null,
      };
    }

    // 确保会话存在
    this.memoryManager.getOrCreateSession(
      context.conversationId,
      context.userId,
    );

    // 预处理输入
    const preprocessResult = this.memoryManager.preprocessInput(
      input,
      context.conversationId,
    );

    // 记录用户消息
    this.memoryManager.recordUserMessage(
      context.conversationId,
      context.userId,
      input,
    );

    // 生成记忆块（如果有变化）
    let memoryChunk: UnifiedStreamChunk | null = null;
    if (preprocessResult.hasChanges) {
      memoryChunk = {
        type: "memory",
        data: {
          resolved: true,
          originalInput: input,
          resolvedInput: preprocessResult.processedInput,
          referenceCount: preprocessResult.resolution?.references.length || 0,
          referenceTypes:
            preprocessResult.resolution?.references.map((r) => r.type) || [],
        },
      };
    }

    return {
      processedInput: preprocessResult.processedInput,
      resolution: preprocessResult.resolution,
      memoryChunk,
    };
  }
}
```

#### Step 1.1.2: 创建 ExecutionCoordinator 模块

```typescript
// src/lib/ai-skills/engine/execution-coordinator.ts

import type { IntentRouter, RouteResult } from "../router";
import type { OrchestrationEngine } from "./orchestration-engine";
import type { UnifiedOutputAdapter } from "../output/adapter";
import type { UnifiedStreamChunk } from "../output/types";
import type { EngineContext, EngineExecuteOptions } from "./types";
import type { AgentContext, AgentStreamChunk } from "../../ai-agent/core/types";

type AtomicExecutor = (
  input: string,
  context: AgentContext,
) => AsyncGenerator<AgentStreamChunk>;

export class ExecutionCoordinator {
  constructor(
    private router: IntentRouter,
    private orchestrationEngine: OrchestrationEngine,
    private outputAdapter: UnifiedOutputAdapter,
    private atomicExecutor: AtomicExecutor | null,
  ) {}

  /**
   * 执行强制模式
   */
  async *executeForced(
    input: string,
    context: EngineContext,
    options: EngineExecuteOptions,
  ): AsyncGenerator<UnifiedStreamChunk> {
    if (options.forceMode === "atomic") {
      if (options.includeRoutingInfo) {
        yield this.outputAdapter.createRoutingChunk(
          "atomic",
          "强制使用原子模式",
          null,
        );
      }
      yield* this.executeAtomic(input, context);
    } else if (options.forceMode === "orchestration" && options.forceSkill) {
      if (options.includeRoutingInfo) {
        yield this.outputAdapter.createRoutingChunk(
          "orchestration",
          "强制使用编排模式",
          options.forceSkill,
        );
      }
      yield* this.executeOrchestration(options.forceSkill, input, context);
    }
  }

  /**
   * 执行路由模式
   */
  async *executeRouted(
    input: string,
    context: EngineContext,
    options: EngineExecuteOptions,
  ): AsyncGenerator<UnifiedStreamChunk> {
    const routeResult = await this.router.route({
      message: input,
      context: {
        userId: context.userId,
        conversationId: context.conversationId,
        bookmarkIds: context.bookmarkIds,
        folderId: context.folderId,
        messageHistory: context.messageHistory,
        totalBookmarks: context.totalBookmarks,
        totalFolders: context.totalFolders,
      },
    });

    // 发送路由信息
    if (options.includeRoutingInfo) {
      yield this.outputAdapter.createRoutingChunk(
        routeResult.mode,
        routeResult.reason,
        routeResult.suggestedSkill,
        routeResult.intent.type,
        routeResult.complexity.level,
      );
    }

    // 根据模式执行
    if (
      routeResult.mode === "orchestration" &&
      routeResult.suggestedSkill &&
      this.orchestrationEngine.hasSkill(routeResult.suggestedSkill)
    ) {
      yield* this.executeOrchestrationWithFallback(
        routeResult.suggestedSkill,
        input,
        context,
      );
    } else {
      yield* this.executeAtomic(input, context);
    }
  }

  /**
   * 执行原子模式
   */
  async *executeAtomic(
    input: string,
    context: EngineContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    if (!this.atomicExecutor) {
      yield this.outputAdapter.createErrorChunk(
        "Atomic executor not configured",
        "EXECUTOR_NOT_CONFIGURED",
        false,
      );
      return;
    }

    const agentContext: AgentContext = {
      userId: context.userId,
      conversationId: context.conversationId,
      bookmarkIds: context.bookmarkIds,
      messageHistory: context.messageHistory,
      traceId: context.traceId,
    };

    for await (const chunk of this.atomicExecutor(input, agentContext)) {
      yield this.outputAdapter.adaptAtomicChunk(chunk);
    }
  }

  /**
   * 执行编排模式
   */
  async *executeOrchestration(
    skillId: string,
    input: string,
    context: EngineContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    for await (const chunk of this.orchestrationEngine.execute(
      skillId,
      input,
      context,
    )) {
      yield this.outputAdapter.adaptOrchestrationChunk(chunk);
    }
  }

  /**
   * 执行编排模式（带回退）
   */
  async *executeOrchestrationWithFallback(
    skillId: string,
    input: string,
    context: EngineContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    let hasError = false;

    try {
      for await (const chunk of this.executeOrchestration(
        skillId,
        input,
        context,
      )) {
        if (chunk.type === "error" && chunk.data.retryable) {
          hasError = true;
          break;
        }
        yield chunk;
        if (chunk.type === "done") return;
      }
    } catch {
      hasError = true;
    }

    if (hasError) {
      yield this.outputAdapter.createFallbackChunk(
        "编排执行异常，切换到原子模式",
      );
      yield* this.executeAtomic(input, context);
    }
  }
}
```

#### Step 1.1.3: 创建 OutputEnhancer 模块

```typescript
// src/lib/ai-skills/engine/output-enhancer.ts

import type { UnifiedOutputAdapter } from "../output/adapter";
import type { UnifiedStreamChunk } from "../output/types";
import type { IntentType } from "../router";
import type { MemoryManager } from "../../ai-memory";
import type { EngineContext } from "./types";

export class OutputEnhancer {
  constructor(
    private outputAdapter: UnifiedOutputAdapter,
    private memoryManager: MemoryManager,
  ) {}

  /**
   * 包装生成器，注入跟进建议
   */
  async *withSuggestions(
    generator: AsyncGenerator<UnifiedStreamChunk>,
    intentType: IntentType,
    subType?: string,
  ): AsyncGenerator<UnifiedStreamChunk> {
    let suggestionsEmitted = false;

    for await (const chunk of generator) {
      if (chunk.type === "done" && !suggestionsEmitted && chunk.data.success) {
        const suggestionsChunk = this.outputAdapter.createSuggestionsChunk(
          intentType,
          subType,
        );
        if (
          suggestionsChunk.type === "suggestions" &&
          suggestionsChunk.data.suggestions.length > 0
        ) {
          yield suggestionsChunk;
          suggestionsEmitted = true;
        }
      }
      yield chunk;
    }
  }

  /**
   * 包装生成器，记录到会话记忆
   */
  async *withMemoryRecording(
    generator: AsyncGenerator<UnifiedStreamChunk>,
    context: EngineContext,
    intentType: IntentType,
    subType?: string,
    enableMemory: boolean = true,
  ): AsyncGenerator<UnifiedStreamChunk> {
    if (!enableMemory || !context.conversationId) {
      yield* generator;
      return;
    }

    let collectedContent = "";
    const relatedEntityIds: number[] = [];

    for await (const chunk of generator) {
      // 收集文本内容
      if (chunk.type === "text" && chunk.data.text) {
        collectedContent += chunk.data.text;
      }

      // 收集相关实体 ID
      if (chunk.type === "tool-call" && chunk.data.result) {
        const result = chunk.data.result;
        if (Array.isArray(result)) {
          for (const item of result) {
            if (typeof item === "object" && item !== null && "id" in item) {
              relatedEntityIds.push(item.id as number);
            }
          }
        }
      }

      // 完成时记录到记忆
      if (chunk.type === "done") {
        if (chunk.data.success) {
          this.memoryManager.recordAssistantMessage(
            context.conversationId,
            collectedContent || chunk.data.summary || "",
            intentType,
            subType,
          );

          this.memoryManager.recordOutput(context.conversationId, {
            type: chunk.data.mode === "orchestration" ? "deliverable" : "text",
            summary: chunk.data.summary || collectedContent.substring(0, 100),
            relatedEntityIds:
              relatedEntityIds.length > 0 ? relatedEntityIds : undefined,
            outputAt: Date.now(),
          });
        }

        // 注入 conversationId
        yield {
          ...chunk,
          data: {
            ...chunk.data,
            conversationId: context.conversationId,
          },
        };
        continue;
      }

      yield chunk;
    }
  }
}
```

#### Step 1.1.4: 重构 UnifiedEngine

```typescript
// src/lib/ai-skills/engine/unified-engine.ts (重构后)

export class UnifiedEngine {
  private inputPreprocessor: InputPreprocessor;
  private executionCoordinator: ExecutionCoordinator;
  private outputEnhancer: OutputEnhancer;
  // ... 其他成员

  constructor(config: UnifiedEngineConfig = {}) {
    // ... 初始化
    this.inputPreprocessor = new InputPreprocessor(this.memoryManager);
    this.executionCoordinator = new ExecutionCoordinator(
      this.router,
      this.orchestrationEngine,
      this.outputAdapter,
      null, // atomicExecutor 后续设置
    );
    this.outputEnhancer = new OutputEnhancer(
      this.outputAdapter,
      this.memoryManager,
    );
  }

  /**
   * 执行用户请求（重构后，约 50 行）
   */
  async *execute(
    input: string,
    context: EngineContext,
    options: EngineExecuteOptions = {},
  ): AsyncGenerator<UnifiedStreamChunk> {
    const mergedOptions = { ...this.config.defaultOptions, ...options };

    // 1. 输入预处理
    const { processedInput, memoryChunk } = this.inputPreprocessor.preprocess(
      input,
      context,
      this.config.enableMemory,
    );
    if (memoryChunk) yield memoryChunk;

    // 2. 引擎未启用，直接原子模式
    if (!this.config.enabled) {
      yield* this.executionCoordinator.executeAtomic(processedInput, context);
      return;
    }

    // 3. 强制模式
    if (mergedOptions.forceMode) {
      yield* this.executionCoordinator.executeForced(
        processedInput,
        context,
        mergedOptions,
      );
      return;
    }

    // 4. 路由执行（带建议和记忆）
    try {
      const routeResult = await this.router.route({
        message: processedInput,
        context: this.buildRouteContext(context),
      });

      yield* this.outputEnhancer.withMemoryRecording(
        this.outputEnhancer.withSuggestions(
          this.executionCoordinator.executeRouted(
            processedInput,
            context,
            mergedOptions,
          ),
          routeResult.intent.type,
          routeResult.intent.subType,
        ),
        context,
        routeResult.intent.type,
        routeResult.intent.subType,
        this.config.enableMemory,
      );
    } catch (error) {
      yield this.outputAdapter.createFallbackChunk(
        error instanceof Error ? error.message : "Unknown error",
      );
      yield* this.executionCoordinator.executeAtomic(processedInput, context);
    }
  }
}
```

**文件变更清单**:

| 操作 | 文件路径                                            | 说明             |
| ---- | --------------------------------------------------- | ---------------- |
| 新增 | `src/lib/ai-skills/engine/input-preprocessor.ts`    | 输入预处理模块   |
| 新增 | `src/lib/ai-skills/engine/execution-coordinator.ts` | 执行协调模块     |
| 新增 | `src/lib/ai-skills/engine/output-enhancer.ts`       | 输出增强模块     |
| 修改 | `src/lib/ai-skills/engine/unified-engine.ts`        | 重构为协调者角色 |
| 修改 | `src/lib/ai-skills/engine/index.ts`                 | 更新导出         |

**测试计划**:

1. 单元测试：每个新模块独立测试
2. 集成测试：验证重构后 UnifiedEngine 行为不变
3. 回归测试：运行现有 618 个测试确保通过

**预计工时**: 3-4 天

---

### Task 1.2: 意图类型常量化

**目标**: 消除意图类型的魔法字符串

**实施步骤**:

#### Step 1.2.1: 创建常量文件

```typescript
// src/lib/ai-skills/router/constants.ts

/**
 * 意图类型常量
 */
export const INTENT_TYPES = {
  QUERY: "query",
  ACTION: "action",
  ORGANIZE: "organize",
  ANALYZE: "analyze",
  LEARN: "learn",
  CREATE: "create",
  CHITCHAT: "chitchat",
} as const;

export type IntentType = (typeof INTENT_TYPES)[keyof typeof INTENT_TYPES];

/**
 * 意图子类型常量
 */
export const INTENT_SUBTYPES = {
  // 查询类
  QUERY: {
    SEARCH: "search",
    LIST: "list",
    COUNT: "count",
    EXPLAIN: "explain",
    GENERAL: "general",
  },

  // 操作类
  ACTION: {
    MOVE: "move",
    DELETE: "delete",
    TAG: "tag",
    RENAME: "rename",
  },

  // 整理类
  ORGANIZE: {
    CLEANUP: "cleanup",
    DEDUPE: "dedupe",
    EXPIRE: "expire",
    CLASSIFY: "classify",
  },

  // 分析类
  ANALYZE: {
    REPORT: "report",
    INSIGHT: "insight",
  },

  // 学习类
  LEARN: {
    REVIEW: "review",
    INTERVIEW: "interview",
    PATH: "path",
  },

  // 创建类
  CREATE: {
    DIGEST: "digest",
    NOTE: "note",
    SHARE: "share",
  },

  // 闲聊类
  CHITCHAT: {
    GREETING: "greeting",
    HELP: "help",
    THANKS: "thanks",
    GENERAL: "general",
  },
} as const;

/**
 * 复杂度级别常量
 */
export const COMPLEXITY_LEVELS = {
  SIMPLE: "simple",
  MEDIUM: "medium",
  COMPLEX: "complex",
} as const;

export type ComplexityLevel =
  (typeof COMPLEXITY_LEVELS)[keyof typeof COMPLEXITY_LEVELS];

/**
 * 多步骤意图类型
 */
export const MULTI_STEP_INTENT_TYPES: IntentType[] = [
  INTENT_TYPES.ORGANIZE,
  INTENT_TYPES.ANALYZE,
  INTENT_TYPES.LEARN,
];

/**
 * 期望交付物的意图类型
 */
export const DELIVERABLE_INTENT_TYPES: IntentType[] = [
  INTENT_TYPES.ANALYZE,
  INTENT_TYPES.CREATE,
  INTENT_TYPES.LEARN,
];

/**
 * 期望交付物的子类型
 */
export const DELIVERABLE_SUBTYPES = [
  INTENT_SUBTYPES.ANALYZE.REPORT,
  INTENT_SUBTYPES.CREATE.DIGEST,
  INTENT_SUBTYPES.LEARN.PATH,
  INTENT_SUBTYPES.CREATE.SHARE,
  INTENT_SUBTYPES.LEARN.REVIEW,
];
```

#### Step 1.2.2: 更新 IntentClassifier

```typescript
// src/lib/ai-skills/router/intent-classifier.ts (更新后)

import {
  INTENT_TYPES,
  INTENT_SUBTYPES,
  COMPLEXITY_LEVELS,
  MULTI_STEP_INTENT_TYPES,
  DELIVERABLE_INTENT_TYPES,
  DELIVERABLE_SUBTYPES,
  type IntentType,
  type ComplexityLevel,
} from "./constants";

const DEFAULT_RULES: IntentRule[] = [
  // 学习类
  {
    pattern: /复习|回顾|巩固|温习|重温/,
    type: INTENT_TYPES.LEARN,
    subType: INTENT_SUBTYPES.LEARN.REVIEW,
    complexity: COMPLEXITY_LEVELS.COMPLEX,
    weight: 90,
  },
  // ... 其他规则
];

// 使用常量替代硬编码
private isMultiStepTask(rule: IntentRule): boolean {
  if (rule.complexity === COMPLEXITY_LEVELS.COMPLEX) {
    return true;
  }
  return MULTI_STEP_INTENT_TYPES.includes(rule.type);
}

private expectsDeliverable(rule: IntentRule): boolean {
  if (DELIVERABLE_INTENT_TYPES.includes(rule.type)) {
    return true;
  }
  return rule.subType ? DELIVERABLE_SUBTYPES.includes(rule.subType) : false;
}
```

**文件变更清单**:

| 操作 | 文件路径                                           | 说明         |
| ---- | -------------------------------------------------- | ------------ |
| 新增 | `src/lib/ai-skills/router/constants.ts`            | 常量定义     |
| 修改 | `src/lib/ai-skills/router/intent-classifier.ts`    | 使用常量     |
| 修改 | `src/lib/ai-skills/router/complexity-evaluator.ts` | 使用常量     |
| 修改 | `src/lib/ai-skills/router/mode-selector.ts`        | 使用常量     |
| 修改 | `src/lib/ai-skills/router/types.ts`                | 更新类型定义 |
| 修改 | `src/lib/ai-skills/router/index.ts`                | 导出常量     |

**预计工时**: 1 天

---

### Task 1.3: 输入验证增强

**目标**: 在 UnifiedEngine 入口添加输入安全验证

**实施步骤**:

#### Step 1.3.1: 创建 InputValidator 模块

```typescript
// src/lib/ai-skills/engine/input-validator.ts

import { logger } from "@/lib/logger";

/**
 * 输入验证配置
 */
export interface InputValidatorConfig {
  maxInputLength?: number; // 最大输入长度，默认 10000
  allowedCharsets?: RegExp; // 允许的字符集
  stripHtml?: boolean; // 是否去除 HTML 标签
  normalizeWhitespace?: boolean; // 是否规范化空白字符
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  sanitizedInput: string;
  warnings: string[];
  errors: string[];
}

/**
 * 输入验证器
 */
export class InputValidator {
  private config: Required<InputValidatorConfig>;

  constructor(config: InputValidatorConfig = {}) {
    this.config = {
      maxInputLength: config.maxInputLength ?? 10000,
      allowedCharsets: config.allowedCharsets ?? /^[\s\S]*$/, // 默认允许所有
      stripHtml: config.stripHtml ?? true,
      normalizeWhitespace: config.normalizeWhitespace ?? true,
    };
  }

  /**
   * 验证并清洗输入
   */
  validate(input: string): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    let sanitized = input;

    // 1. 空输入检查
    if (!input || input.trim().length === 0) {
      return {
        valid: false,
        sanitizedInput: "",
        warnings: [],
        errors: ["输入不能为空"],
      };
    }

    // 2. 长度检查
    if (input.length > this.config.maxInputLength) {
      sanitized = input.substring(0, this.config.maxInputLength);
      warnings.push(`输入已截断至 ${this.config.maxInputLength} 字符`);
      logger.warn(
        { originalLength: input.length, maxLength: this.config.maxInputLength },
        "InputValidator: Input truncated",
      );
    }

    // 3. HTML 标签去除
    if (this.config.stripHtml) {
      const beforeHtml = sanitized;
      sanitized = this.stripHtmlTags(sanitized);
      if (beforeHtml !== sanitized) {
        warnings.push("已去除 HTML 标签");
      }
    }

    // 4. 空白字符规范化
    if (this.config.normalizeWhitespace) {
      sanitized = this.normalizeWhitespace(sanitized);
    }

    // 5. 潜在注入检测（仅警告）
    const injectionPatterns = [
      /\{\{.*\}\}/, // 模板注入
      /<script/i, // XSS
      /javascript:/i, // JS 协议
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(sanitized)) {
        warnings.push("检测到潜在的注入模式");
        logger.warn(
          { pattern: pattern.source },
          "InputValidator: Potential injection detected",
        );
        break;
      }
    }

    return {
      valid: errors.length === 0,
      sanitizedInput: sanitized.trim(),
      warnings,
      errors,
    };
  }

  /**
   * 去除 HTML 标签
   */
  private stripHtmlTags(input: string): string {
    return input
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"');
  }

  /**
   * 规范化空白字符
   */
  private normalizeWhitespace(input: string): string {
    return input
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\t/g, " ")
      .replace(/ +/g, " ")
      .replace(/\n{3,}/g, "\n\n");
  }
}

/**
 * 创建输入验证器
 */
export function createInputValidator(
  config?: InputValidatorConfig,
): InputValidator {
  return new InputValidator(config);
}
```

#### Step 1.3.2: 集成到 UnifiedEngine

```typescript
// src/lib/ai-skills/engine/unified-engine.ts (添加验证)

import { InputValidator, createInputValidator } from "./input-validator";

export class UnifiedEngine {
  private inputValidator: InputValidator;

  constructor(config: UnifiedEngineConfig = {}) {
    // ... 其他初始化
    this.inputValidator = createInputValidator({
      maxInputLength: config.maxInputLength ?? 10000,
    });
  }

  async *execute(
    input: string,
    context: EngineContext,
    options: EngineExecuteOptions = {},
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 0. 输入验证
    const validation = this.inputValidator.validate(input);

    if (!validation.valid) {
      yield this.outputAdapter.createErrorChunk(
        validation.errors.join("; "),
        "INVALID_INPUT",
        false,
      );
      return;
    }

    // 使用清洗后的输入
    const validatedInput = validation.sanitizedInput;

    // 警告信息记录
    if (validation.warnings.length > 0) {
      logger.warn(
        { warnings: validation.warnings },
        "UnifiedEngine: Input validation warnings",
      );
    }

    // ... 后续处理使用 validatedInput
  }
}
```

**文件变更清单**:

| 操作 | 文件路径                                                     | 说明         |
| ---- | ------------------------------------------------------------ | ------------ |
| 新增 | `src/lib/ai-skills/engine/input-validator.ts`                | 输入验证模块 |
| 新增 | `src/lib/ai-skills/engine/__tests__/input-validator.test.ts` | 验证器测试   |
| 修改 | `src/lib/ai-skills/engine/unified-engine.ts`                 | 集成验证     |
| 修改 | `src/lib/ai-skills/engine/types.ts`                          | 添加配置类型 |

**预计工时**: 1 天

---

## 三、Phase 2: 中期增强 (1 个月)

### Task 2.1: LLM 意图分类兜底

**目标**: 当规则匹配置信度不足时，使用 LLM 辅助分类

**实施步骤**:

#### Step 2.1.1: 设计 LLM 分类器接口

```typescript
// src/lib/ai-skills/router/llm-classifier.ts

import { generateObject } from "ai";
import { z } from "zod";
import { getModelProvider } from "@/lib/ai-providers";
import { logger } from "@/lib/logger";
import { INTENT_TYPES, type IntentType } from "./constants";

/**
 * LLM 分类结果 Schema
 */
const LLMClassificationSchema = z.object({
  type: z.enum([
    "query",
    "action",
    "organize",
    "analyze",
    "learn",
    "create",
    "chitchat",
  ]),
  subType: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type LLMClassificationResult = z.infer<typeof LLMClassificationSchema>;

/**
 * LLM 分类器配置
 */
export interface LLMClassifierConfig {
  modelId?: string;
  timeoutMs?: number;
  maxRetries?: number;
  cacheEnabled?: boolean;
  cacheTTLMs?: number;
}

/**
 * LLM 意图分类器
 */
export class LLMIntentClassifier {
  private config: Required<LLMClassifierConfig>;
  private cache: Map<
    string,
    { result: LLMClassificationResult; expiry: number }
  >;

  constructor(config: LLMClassifierConfig = {}) {
    this.config = {
      modelId: config.modelId ?? "deepseek-chat", // 默认 DeepSeek，也支持阿里百炼
      timeoutMs: config.timeoutMs ?? 5000,
      maxRetries: config.maxRetries ?? 1,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTLMs: config.cacheTTLMs ?? 60000, // 1 分钟
    };
    this.cache = new Map();
  }

  /**
   * 使用 LLM 分类意图
   */
  async classify(message: string): Promise<LLMClassificationResult | null> {
    // 检查缓存
    if (this.config.cacheEnabled) {
      const cached = this.getCached(message);
      if (cached) {
        logger.debug(
          { message: message.substring(0, 50) },
          "LLMClassifier: Cache hit",
        );
        return cached;
      }
    }

    try {
      const provider = getModelProvider(this.config.modelId);

      const { object } = await generateObject({
        model: provider,
        schema: LLMClassificationSchema,
        prompt: this.buildPrompt(message),
        maxRetries: this.config.maxRetries,
      });

      // 缓存结果
      if (this.config.cacheEnabled) {
        this.setCache(message, object);
      }

      logger.debug(
        {
          message: message.substring(0, 50),
          type: object.type,
          confidence: object.confidence,
        },
        "LLMClassifier: Classification completed",
      );

      return object;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          message: message.substring(0, 50),
        },
        "LLMClassifier: Classification failed",
      );
      return null;
    }
  }

  /**
   * 构建分类 Prompt
   */
  private buildPrompt(message: string): string {
    return `你是一个意图分类专家。请分析用户的输入，判断其意图类型。

意图类型说明：
- query: 查询类（搜索、列表、统计）
- action: 操作类（移动、删除、添加标签）
- organize: 整理类（清理、去重、分类）
- analyze: 分析类（报告、洞察、趋势）
- learn: 学习类（复习、面试准备、学习路径）
- create: 创建类（摘要、笔记、分享）
- chitchat: 闲聊类（问候、帮助、感谢）

用户输入: "${message}"

请返回分类结果，包含：
1. type: 意图类型
2. subType: 子类型（可选）
3. confidence: 置信度 (0-1)
4. reasoning: 分类理由`;
  }

  /**
   * 获取缓存
   */
  private getCached(message: string): LLMClassificationResult | null {
    const key = this.getCacheKey(message);
    const cached = this.cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      return cached.result;
    }

    if (cached) {
      this.cache.delete(key);
    }

    return null;
  }

  /**
   * 设置缓存
   */
  private setCache(message: string, result: LLMClassificationResult): void {
    const key = this.getCacheKey(message);
    this.cache.set(key, {
      result,
      expiry: Date.now() + this.config.cacheTTLMs,
    });
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(message: string): string {
    // 简单的哈希，生产环境可以使用更好的哈希函数
    return message.toLowerCase().trim().substring(0, 200);
  }

  /**
   * 清理过期缓存
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry < now) {
        this.cache.delete(key);
      }
    }
  }
}
```

#### Step 2.1.2: 集成到 IntentClassifier

```typescript
// src/lib/ai-skills/router/intent-classifier.ts (更新)

import { LLMIntentClassifier } from "./llm-classifier";

export interface IntentClassifierConfig {
  // ... 现有配置
  enableLLMFallback?: boolean;
  llmFallbackThreshold?: number; // 触发 LLM 的置信度阈值
  llmClassifierConfig?: LLMClassifierConfig;
}

export class IntentClassifier {
  private llmClassifier: LLMIntentClassifier | null = null;

  constructor(config: IntentClassifierConfig = {}) {
    // ... 现有初始化

    // 初始化 LLM 分类器
    if (config.enableLLMFallback) {
      this.llmClassifier = new LLMIntentClassifier(config.llmClassifierConfig);
    }
  }

  async classify(message: string): Promise<IntentClassification> {
    const startTime = performance.now();

    // 1. 规则快速匹配
    const ruleMatch = this.matchRules(message);

    if (ruleMatch && ruleMatch.confidence >= 0.8) {
      return ruleMatch;
    }

    // 2. 规则置信度不足，尝试 LLM 兜底
    if (
      this.llmClassifier &&
      (!ruleMatch ||
        ruleMatch.confidence < (this.config.llmFallbackThreshold ?? 0.6))
    ) {
      const llmResult = await this.llmClassifier.classify(message);

      if (llmResult && llmResult.confidence > (ruleMatch?.confidence ?? 0)) {
        logger.debug(
          {
            message: message.substring(0, 50),
            ruleConfidence: ruleMatch?.confidence,
            llmConfidence: llmResult.confidence,
          },
          "IntentClassifier: LLM fallback used",
        );

        const entities = this.config.enableEntityExtraction
          ? this.extractEntities(message)
          : [];

        return {
          type: llmResult.type as IntentType,
          subType: llmResult.subType,
          confidence: llmResult.confidence,
          entities,
          requiresMultiStep: this.isMultiStepByType(
            llmResult.type as IntentType,
          ),
          hasDeliverableExpectation: this.expectsDeliverableByType(
            llmResult.type as IntentType,
            llmResult.subType,
          ),
          source: "llm",
        };
      }
    }

    // 3. 返回规则结果或默认结果
    return ruleMatch || this.getDefaultClassification(message);
  }
}
```

**文件变更清单**:

| 操作 | 文件路径                                                    | 说明           |
| ---- | ----------------------------------------------------------- | -------------- |
| 新增 | `src/lib/ai-skills/router/llm-classifier.ts`                | LLM 分类器     |
| 新增 | `src/lib/ai-skills/router/__tests__/llm-classifier.test.ts` | LLM 分类器测试 |
| 修改 | `src/lib/ai-skills/router/intent-classifier.ts`             | 集成 LLM 兜底  |
| 修改 | `src/lib/ai-skills/router/types.ts`                         | 添加配置类型   |

**预计工时**: 3-4 天

---

### Task 2.2: 路由性能指标

**目标**: 添加详细的路由性能指标追踪

**实施步骤**:

#### Step 2.2.1: 设计指标类型

```typescript
// src/lib/ai-skills/router/metrics.ts

/**
 * 路由性能指标
 */
export interface RouteMetrics {
  // 时间指标
  classificationDurationMs: number;
  complexityDurationMs: number;
  modeSelectorDurationMs: number;
  totalDurationMs: number;

  // 分类指标
  ruleMatchCount: number;
  disambiguationUsed: boolean;
  llmFallbackUsed: boolean;

  // 缓存指标
  cacheHit: boolean;
}

/**
 * 路由指标收集器
 */
export class RouteMetricsCollector {
  private startTime: number = 0;
  private metrics: Partial<RouteMetrics> = {};

  start(): void {
    this.startTime = performance.now();
    this.metrics = {};
  }

  recordClassification(durationMs: number, ruleMatchCount: number): void {
    this.metrics.classificationDurationMs = durationMs;
    this.metrics.ruleMatchCount = ruleMatchCount;
  }

  recordComplexity(durationMs: number): void {
    this.metrics.complexityDurationMs = durationMs;
  }

  recordModeSelection(durationMs: number): void {
    this.metrics.modeSelectorDurationMs = durationMs;
  }

  recordDisambiguation(used: boolean): void {
    this.metrics.disambiguationUsed = used;
  }

  recordLLMFallback(used: boolean): void {
    this.metrics.llmFallbackUsed = used;
  }

  recordCacheHit(hit: boolean): void {
    this.metrics.cacheHit = hit;
  }

  finalize(): RouteMetrics {
    return {
      classificationDurationMs: this.metrics.classificationDurationMs ?? 0,
      complexityDurationMs: this.metrics.complexityDurationMs ?? 0,
      modeSelectorDurationMs: this.metrics.modeSelectorDurationMs ?? 0,
      totalDurationMs: Math.round(performance.now() - this.startTime),
      ruleMatchCount: this.metrics.ruleMatchCount ?? 0,
      disambiguationUsed: this.metrics.disambiguationUsed ?? false,
      llmFallbackUsed: this.metrics.llmFallbackUsed ?? false,
      cacheHit: this.metrics.cacheHit ?? false,
    };
  }
}
```

#### Step 2.2.2: 更新 RouteResult 类型

```typescript
// src/lib/ai-skills/router/types.ts (更新)

export interface RouteResult {
  intent: IntentClassification;
  complexity: ComplexityEvaluation;
  mode: "atomic" | "orchestration";
  suggestedSkill: string | null;
  reason: string;
  routingDurationMs: number;
  metrics: RouteMetrics; // 新增
}
```

**预计工时**: 2 天

---

### Task 2.3: 消歧规则可配置化

**目标**: 支持从配置文件加载消歧规则

**实施方案概述**:

1. 定义消歧规则 JSON Schema
2. 支持从 `config/disambiguation-rules.json` 加载
3. 支持运行时动态添加规则
4. 添加规则效果指标追踪

**预计工时**: 2-3 天

---

## 四、Phase 3: 长期规划 (1-2 季度)

### Task 3.1: Memory 持久化

**目标**: 实现 Agent 对话记忆的数据库持久化

**实施方案概述**:

1. 设计 `agent_memories` 数据库表
2. 实现 `MemoryPersistenceAdapter` 接口
3. 添加 Supabase 实现
4. 实现内存与数据库同步机制

**数据库表设计**:

```sql
CREATE TABLE agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  conversation_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
  content TEXT NOT NULL,
  intent_type TEXT,
  intent_sub_type TEXT,
  related_entity_ids INTEGER[],
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  CONSTRAINT agent_memories_user_conversation_idx
    UNIQUE (user_id, conversation_id, created_at)
);

-- RLS 策略
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own memories"
  ON agent_memories FOR ALL
  USING (auth.uid() = user_id);
```

**预计工时**: 1-2 周

---

### Task 3.2: Effect 权限体系

**目标**: 为 Effect 系统添加权限校验

**实施方案概述**:

1. 设计 Effect 权限模型
2. 实现权限校验中间件
3. 集成到 EffectManager

**预计工时**: 1 周

---

## 五、风险评估

| 风险项                     | 影响 | 概率 | 缓解措施                  |
| -------------------------- | ---- | ---- | ------------------------- |
| UnifiedEngine 拆分导致回归 | 高   | 中   | 充分的测试覆盖 + 灰度发布 |
| LLM 分类延迟过高           | 中   | 中   | 缓存机制 + 超时控制       |
| Memory 持久化性能问题      | 中   | 低   | 批量写入 + 异步处理       |

---

## 六、验收标准

### Phase 1 验收标准

- [ ] UnifiedEngine 代码行数 < 300 行
- [ ] 所有现有测试 (618) 通过
- [ ] 新增模块测试覆盖率 > 80%
- [ ] 输入验证测试用例 > 20 个

### Phase 2 验收标准

- [ ] LLM 分类准确率 > 85%
- [ ] 路由 P99 延迟 < 100ms
- [ ] 消歧规则支持 JSON 配置

### Phase 3 验收标准

- [ ] Memory 持久化查询 P99 < 50ms
- [ ] Effect 权限校验覆盖所有类型

---

## 七、审批签署

| 角色       | 姓名    | 日期       | 签署 |
| ---------- | ------- | ---------- | ---- |
| 产品负责人 | Xiafe   | 2025-12-26 | ✅   |
| 技术负责人 | Xiafe   | 2025-12-26 | ✅   |
| 架构师     | Winston | 2025-12-25 | ✅   |

---

## 八、修订记录

| 版本  | 日期       | 修订内容                                   |
| ----- | ---------- | ------------------------------------------ |
| 1.0.0 | 2025-12-25 | 初始版本                                   |
| 1.1.0 | 2025-12-26 | 审核通过；LLM 模型改为 DeepSeek/阿里百炼云 |

---

## 九、实际工时估算（Claude 执行）

基于 AI 辅助开发的实际能力，调整工时如下：

| Phase | Task               | 原估算 | 实际估算     | 说明              |
| ----- | ------------------ | ------ | ------------ | ----------------- |
| 1     | UnifiedEngine 拆分 | 3-4 天 | **4-6 小时** | 代码重构 + 测试   |
| 1     | 意图类型常量化     | 1 天   | **1-2 小时** | 简单提取          |
| 1     | 输入验证增强       | 1 天   | **2 小时**   | 新增模块          |
| 2     | LLM 意图分类兜底   | 3-4 天 | **4-6 小时** | 需要集成调试      |
| 2     | 路由性能指标       | 2 天   | **2-3 小时** | 类型扩展          |
| 2     | 消歧规则可配置化   | 2-3 天 | **3-4 小时** | JSON 加载         |
| 3     | Memory 持久化      | 1-2 周 | **1-2 天**   | 数据库设计 + 集成 |
| 3     | Effect 权限体系    | 1 周   | **半天**     | 简单中间件        |

**建议**：Memory 持久化可提前到 Phase 2 末期执行，不影响整体进度。

---

**文档状态**: ✅ 已审核通过
**下一步**: 开始执行 Phase 1
