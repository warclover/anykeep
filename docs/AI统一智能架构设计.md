# AnyKeep AI 统一智能架构设计

> **版本**: 1.0.0
> **日期**: 2025-12-24
> **状态**: 待审核
> **设计目标**: 融合原子 Skills 与编排 Skills，智能路由，渐进升级

---

## 目录

1. [设计愿景](#1-设计愿景)
2. [统一架构设计](#2-统一架构设计)
3. [智能路由层](#3-智能路由层)
4. [双模式执行引擎](#4-双模式执行引擎)
5. [统一输出协议](#5-统一输出协议)
6. [技术实现方案](#6-技术实现方案)
7. [迁移与兼容策略](#7-迁移与兼容策略)
8. [实施路线图](#8-实施路线图)

---

## 1. 设计愿景

### 1.1 核心理念

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   "用户不需要知道背后是什么架构，只需要说出需求，系统智能选择最优路径"        │
│                                                                             │
│   简单任务 → 原子模式（快速、精准）                                          │
│   复杂任务 → 编排模式（端到端、交付物导向）                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 设计原则

| 原则         | 说明                                     |
| ------------ | ---------------------------------------- |
| **零侵入**   | 现有代码不做任何修改，新架构作为上层扩展 |
| **智能路由** | 根据意图自动选择最优执行模式             |
| **统一体验** | 无论哪种模式，用户感知一致               |
| **渐进增强** | 可以逐步添加新能力，不影响稳定性         |
| **双向兼容** | 编排 Skill 可以复用原子 Skill            |

### 1.3 用户价值

```
Before (现在):
  用户: "帮我整理收藏"
  AI: "好的，我先看看你有多少收藏..." (调用 count_total)
  AI: "你有 156 条收藏，要按什么方式整理？" (需要用户继续输入)
  用户: "按主题分类"
  AI: "我来搜索一下..." (调用 search)
  ... (多轮交互)

After (新架构):
  用户: "帮我整理收藏"
  AI: [智能识别为复杂任务，启用编排模式]
  AI: "📊 正在分析收藏现状... (10%)"
  AI: "🔍 识别问题中... (30%)"
  AI: "📝 生成整理方案..."
  AI: "✅ 整理方案已生成，共发现 3 类问题：
       1. 23 条未分类
       2. 5 组重复内容
       3. 8 个过期链接

       [查看详情] [一键整理] [导出报告]"
```

---

## 2. 统一架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            用户交互层 (UI)                                   │
│                    AI 助手面板 / 聊天界面 / 快捷操作                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         统一入口层 (Unified Gateway)                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      IntentRouter (意图路由器)                        │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │   │
│  │  │ 意图分类器     │  │ 复杂度评估器   │  │ 模式选择器     │            │   │
│  │  │ IntentClassifier│ │ComplexityEval │  │ ModeSelector  │            │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────────┐
│      原子模式 (Atomic Mode)    │   │      编排模式 (Orchestration Mode)     │
│  ┌─────────────────────────┐  │   │  ┌─────────────────────────────────┐  │
│  │   现有 KnowledgeAgent    │  │   │  │    OrchestrationEngine          │  │
│  │   ┌─────────────────┐   │  │   │  │    ┌─────────────────────────┐  │  │
│  │   │  LLM 多轮调用    │   │  │   │  │    │  Skill 内部多步编排      │  │  │
│  │   │  ┌─────┐ ┌─────┐│   │  │   │  │    │  ┌───┐ ┌───┐ ┌───┐     │  │  │
│  │   │  │Skill│ │Skill││   │  │   │  │    │  │S1 │→│S2 │→│S3 │     │  │  │
│  │   │  └─────┘ └─────┘│   │  │   │  │    │  └───┘ └───┘ └───┘     │  │  │
│  │   └─────────────────┘   │  │   │  │    └─────────────────────────┘  │  │
│  └─────────────────────────┘  │   │  └─────────────────────────────────┘  │
│                               │   │                                       │
│  适用：简单查询、单步操作      │   │  适用：复杂任务、端到端交付            │
└───────────────────────────────┘   └───────────────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         统一输出层 (Unified Output)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  文本响应    │  │  进度更新    │  │  确认请求    │  │  交付物      │        │
│  │  TextChunk  │  │ ProgressChunk│  │ ConfirmChunk│  │DeliverableChunk│     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              基础能力层                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  原子 Skills     │  │  Tools (80+)    │  │  服务层          │             │
│  │  (classify等)   │  │  (query/action) │  │  (Supabase等)   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块                   | 职责                                   | 新增/现有 |
| ---------------------- | -------------------------------------- | --------- |
| **IntentRouter**       | 意图分类、复杂度评估、模式选择         | 🆕 新增   |
| **Atomic Mode**        | 现有 KnowledgeAgent + 原子 Skills      | ✅ 现有   |
| **Orchestration Mode** | 编排 Skills 执行引擎                   | 🆕 新增   |
| **Unified Output**     | 统一输出协议，支持多种响应类型         | 🆕 新增   |
| **原子 Skills**        | classify, search, summary 等           | ✅ 现有   |
| **编排 Skills**        | knowledge_review, duplicate_cleanup 等 | 🆕 新增   |

---

## 3. 智能路由层

### 3.1 IntentRouter 设计

```typescript
// src/lib/ai-skills/router/intent-router.ts

/**
 * 意图路由器
 *
 * 职责：
 * 1. 分析用户输入，理解意图
 * 2. 评估任务复杂度
 * 3. 选择最优执行模式
 */
export class IntentRouter {
  private intentClassifier: IntentClassifier;
  private complexityEvaluator: ComplexityEvaluator;
  private modeSelector: ModeSelector;

  /**
   * 路由用户请求
   */
  async route(request: UserRequest): Promise<RouteResult> {
    // 1. 意图分类
    const intent = await this.intentClassifier.classify(request.message);

    // 2. 复杂度评估
    const complexity = await this.complexityEvaluator.evaluate(
      intent,
      request.context,
    );

    // 3. 模式选择
    const mode = this.modeSelector.select(intent, complexity);

    return {
      intent,
      complexity,
      mode,
      suggestedSkill:
        mode === "orchestration" ? this.findOrchestrationSkill(intent) : null,
    };
  }
}
```

### 3.2 意图分类器

```typescript
// src/lib/ai-skills/router/intent-classifier.ts

/**
 * 意图类型
 */
type IntentType =
  | "query" // 查询类：数量、列表、搜索
  | "action" // 操作类：移动、删除、标签
  | "organize" // 整理类：清理、分类、去重
  | "analyze" // 分析类：统计、报告、洞察
  | "learn" // 学习类：复习、路径、面试准备
  | "create" // 创建类：摘要、笔记、文档
  | "chitchat"; // 闲聊类：问候、帮助

/**
 * 意图分类结果
 */
interface IntentClassification {
  type: IntentType;
  confidence: number;
  entities: ExtractedEntity[]; // 提取的实体（主题、时间、数量等）
  requiresMultiStep: boolean; // 是否需要多步骤
  hasDeliverableExpectation: boolean; // 是否期望交付物
}

/**
 * 意图分类器
 */
export class IntentClassifier {
  // 规则匹配 + LLM 兜底
  private rules: IntentRule[] = [
    // 简单查询规则
    { pattern: /有多少|数量|统计/, type: "query", complexity: "simple" },
    { pattern: /搜索|找|查/, type: "query", complexity: "simple" },
    { pattern: /最近|列表/, type: "query", complexity: "simple" },

    // 复杂任务规则
    { pattern: /整理|清理|规整/, type: "organize", complexity: "complex" },
    { pattern: /复习|回顾|巩固/, type: "learn", complexity: "complex" },
    { pattern: /准备.+面试/, type: "learn", complexity: "complex" },
    { pattern: /生成.+报告|周报|月报/, type: "analyze", complexity: "complex" },
    { pattern: /去重|重复|过期/, type: "organize", complexity: "complex" },
    { pattern: /摘要|总结|概括/, type: "create", complexity: "medium" },
  ];

  async classify(message: string): Promise<IntentClassification> {
    // 1. 规则快速匹配
    const ruleMatch = this.matchRules(message);
    if (ruleMatch && ruleMatch.confidence > 0.8) {
      return ruleMatch;
    }

    // 2. LLM 精确分类（仅在规则不确定时）
    return this.llmClassify(message);
  }

  private matchRules(message: string): IntentClassification | null {
    for (const rule of this.rules) {
      if (rule.pattern.test(message)) {
        return {
          type: rule.type,
          confidence: 0.85,
          entities: this.extractEntities(message),
          requiresMultiStep: rule.complexity === "complex",
          hasDeliverableExpectation: ["analyze", "create", "learn"].includes(
            rule.type,
          ),
        };
      }
    }
    return null;
  }
}
```

### 3.3 复杂度评估器

```typescript
// src/lib/ai-skills/router/complexity-evaluator.ts

/**
 * 复杂度级别
 */
type ComplexityLevel = "simple" | "medium" | "complex";

/**
 * 复杂度评估结果
 */
interface ComplexityEvaluation {
  level: ComplexityLevel;
  score: number; // 0-100
  factors: ComplexityFactor[];
  estimatedSteps: number;
  estimatedDurationMs: number;
}

/**
 * 复杂度因素
 */
interface ComplexityFactor {
  name: string;
  weight: number;
  value: number;
  reason: string;
}

/**
 * 复杂度评估器
 */
export class ComplexityEvaluator {
  /**
   * 评估任务复杂度
   */
  async evaluate(
    intent: IntentClassification,
    context: RequestContext,
  ): Promise<ComplexityEvaluation> {
    const factors: ComplexityFactor[] = [];

    // 因素 1: 意图本身的复杂度
    factors.push({
      name: "intent_complexity",
      weight: 0.3,
      value: this.getIntentComplexityScore(intent.type),
      reason: `${intent.type} 类型任务`,
    });

    // 因素 2: 是否需要多步骤
    factors.push({
      name: "multi_step",
      weight: 0.25,
      value: intent.requiresMultiStep ? 80 : 20,
      reason: intent.requiresMultiStep ? "需要多步骤处理" : "单步即可完成",
    });

    // 因素 3: 是否期望交付物
    factors.push({
      name: "deliverable_expectation",
      weight: 0.2,
      value: intent.hasDeliverableExpectation ? 70 : 10,
      reason: intent.hasDeliverableExpectation
        ? "用户期望获得文档/报告"
        : "仅需数据返回",
    });

    // 因素 4: 数据量评估
    const dataScale = await this.estimateDataScale(intent, context);
    factors.push({
      name: "data_scale",
      weight: 0.15,
      value: dataScale > 100 ? 60 : dataScale > 20 ? 40 : 20,
      reason: `预计处理 ${dataScale} 条数据`,
    });

    // 因素 5: 是否涉及用户确认
    factors.push({
      name: "requires_confirmation",
      weight: 0.1,
      value: this.requiresConfirmation(intent) ? 50 : 10,
      reason: this.requiresConfirmation(intent) ? "需要用户确认" : "可自动完成",
    });

    // 计算总分
    const score = factors.reduce((sum, f) => sum + f.weight * f.value, 0);

    // 确定复杂度级别
    const level: ComplexityLevel =
      score >= 60 ? "complex" : score >= 35 ? "medium" : "simple";

    return {
      level,
      score,
      factors,
      estimatedSteps: this.estimateSteps(level),
      estimatedDurationMs: this.estimateDuration(level),
    };
  }

  private getIntentComplexityScore(type: IntentType): number {
    const scores: Record<IntentType, number> = {
      query: 20,
      action: 30,
      create: 50,
      organize: 70,
      analyze: 75,
      learn: 80,
      chitchat: 10,
    };
    return scores[type] ?? 50;
  }
}
```

### 3.4 模式选择器

```typescript
// src/lib/ai-skills/router/mode-selector.ts

/**
 * 执行模式
 */
type ExecutionMode = "atomic" | "orchestration";

/**
 * 模式选择结果
 */
interface ModeSelection {
  mode: ExecutionMode;
  reason: string;
  fallbackMode?: ExecutionMode;
}

/**
 * 模式选择器
 */
export class ModeSelector {
  // 编排模式的 Skill 映射
  private orchestrationSkillMap: Map<string, string> = new Map([
    ["organize:cleanup", "duplicate_cleanup"],
    ["organize:sort", "smart_organize"],
    ["learn:review", "knowledge_review"],
    ["learn:interview", "interview_prep"],
    ["analyze:report", "periodic_report"],
    ["create:digest", "quick_digest"],
    ["create:path", "learning_path"],
  ]);

  /**
   * 选择执行模式
   */
  select(
    intent: IntentClassification,
    complexity: ComplexityEvaluation,
  ): ModeSelection {
    // 规则 1: 简单任务 → 原子模式
    if (complexity.level === "simple") {
      return {
        mode: "atomic",
        reason: "简单任务，使用原子模式快速响应",
      };
    }

    // 规则 2: 有对应编排 Skill 的复杂任务 → 编排模式
    const skillKey = this.buildSkillKey(intent);
    if (this.orchestrationSkillMap.has(skillKey)) {
      return {
        mode: "orchestration",
        reason: `复杂任务，使用 ${this.orchestrationSkillMap.get(skillKey)} 端到端完成`,
        fallbackMode: "atomic", // 失败时回退
      };
    }

    // 规则 3: 复杂但无对应编排 Skill → 原子模式（LLM 多轮）
    if (complexity.level === "complex") {
      return {
        mode: "atomic",
        reason: "复杂任务但暂无专用 Skill，使用原子模式多轮处理",
      };
    }

    // 规则 4: 中等复杂度 → 根据期望选择
    if (
      intent.hasDeliverableExpectation &&
      this.hasMatchingOrchestrationSkill(intent)
    ) {
      return {
        mode: "orchestration",
        reason: "用户期望交付物，使用编排模式",
        fallbackMode: "atomic",
      };
    }

    // 默认: 原子模式
    return {
      mode: "atomic",
      reason: "默认使用原子模式",
    };
  }

  private buildSkillKey(intent: IntentClassification): string {
    // 根据意图类型和实体构建 Skill 查找键
    const subType = this.inferSubType(intent);
    return `${intent.type}:${subType}`;
  }
}
```

### 3.5 路由决策流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           意图路由决策流程                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   用户输入: "帮我整理一下收藏，清理重复的"                                   │
│                         │                                                   │
│                         ▼                                                   │
│   ┌─────────────────────────────────────┐                                  │
│   │ Step 1: 意图分类                     │                                  │
│   │ ├── 规则匹配: "整理|清理" → organize │                                  │
│   │ ├── 实体提取: ["重复"]              │                                  │
│   │ └── 结果: type=organize, multi=true │                                  │
│   └─────────────────────────────────────┘                                  │
│                         │                                                   │
│                         ▼                                                   │
│   ┌─────────────────────────────────────┐                                  │
│   │ Step 2: 复杂度评估                   │                                  │
│   │ ├── intent_complexity: 70           │                                  │
│   │ ├── multi_step: 80                  │                                  │
│   │ ├── deliverable: 70                 │                                  │
│   │ ├── data_scale: 40                  │                                  │
│   │ └── 总分: 65 → level=complex        │                                  │
│   └─────────────────────────────────────┘                                  │
│                         │                                                   │
│                         ▼                                                   │
│   ┌─────────────────────────────────────┐                                  │
│   │ Step 3: 模式选择                     │                                  │
│   │ ├── 复杂度: complex ✓               │                                  │
│   │ ├── 查找 Skill: organize:cleanup   │                                  │
│   │ ├── 匹配: duplicate_cleanup ✓       │                                  │
│   │ └── 结果: mode=orchestration        │                                  │
│   └─────────────────────────────────────┘                                  │
│                         │                                                   │
│                         ▼                                                   │
│   ┌─────────────────────────────────────┐                                  │
│   │ 路由结果                             │                                  │
│   │ {                                   │                                  │
│   │   mode: 'orchestration',            │                                  │
│   │   skill: 'duplicate_cleanup',       │                                  │
│   │   reason: '复杂任务，端到端完成'     │                                  │
│   │ }                                   │                                  │
│   └─────────────────────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 双模式执行引擎

### 4.1 统一执行入口

```typescript
// src/lib/ai-skills/engine/unified-engine.ts

/**
 * 统一执行引擎
 *
 * 作为 KnowledgeAgent 的上层封装，提供智能路由能力
 */
export class UnifiedEngine {
  private router: IntentRouter;
  private atomicEngine: KnowledgeAgent;        // 现有
  private orchestrationEngine: OrchestrationEngine;  // 新增
  private outputAdapter: UnifiedOutputAdapter;

  /**
   * 执行用户请求
   */
  async execute(
    input: string,
    context: EngineContext
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 1. 路由决策
    const routeResult = await this.router.route({ message: input, context });

    // 2. 发送路由信息（可选，用于调试/展示）
    yield {
      type: 'routing',
      data: {
        mode: routeResult.mode,
        reason: routeResult.reason,
        skill: routeResult.suggestedSkill,
      },
    };

    // 3. 根据模式执行
    if (routeResult.mode === 'orchestration' && routeResult.suggestedSkill) {
      // 编排模式
      yield* this.executeOrchestration(routeResult.suggestedSkill, input, context);
    } else {
      // 原子模式（使用现有 KnowledgeAgent）
      yield* this.executeAtomic(input, context);
    }
  }

  /**
   * 原子模式执行（复用现有 KnowledgeAgent）
   */
  private async *executeAtomic(
    input: string,
    context: EngineContext
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 直接调用现有 KnowledgeAgent
    const agentContext: AgentContext = {
      userId: context.userId,
      conversationId: context.conversationId,
      bookmarkIds: context.bookmarkIds,
      messageHistory: context.messageHistory,
    };

    for await (const chunk of this.atomicEngine.executeStream(input, agentContext)) {
      // 适配输出格式
      yield this.outputAdapter.adaptAtomicChunk(chunk);
    }
  }

  /**
   * 编排模式执行
   */
  private async *executeOrchestration(
    skillId: string,
    input: string,
    context: EngineContext
  ): AsyncGenerator<UnifiedStreamChunk> {
    try {
      for await (const chunk of this.orchestrationEngine.execute(skillId, input, context)) {
        yield this.outputAdapter.adaptOrchestrationChunk(chunk);
      }
    } catch (error) {
      // 编排失败，回退到原子模式
      yield {
        type: 'fallback',
        data: { reason: '编排执行异常，切换到原子模式' },
      };
      yield* this.executeAtomic(input, context);
    }
  }
}
```

### 4.2 编排执行引擎

```typescript
// src/lib/ai-skills/engine/orchestration-engine.ts

/**
 * 编排执行引擎
 *
 * 管理编排 Skills 的注册和执行
 */
export class OrchestrationEngine {
  private skills: Map<string, OrchestrationSkill> = new Map();

  /**
   * 注册编排 Skill
   */
  register(skill: OrchestrationSkill): void {
    this.skills.set(skill.metadata.id, skill);
  }

  /**
   * 执行编排 Skill
   */
  async *execute(
    skillId: string,
    input: string,
    context: EngineContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Orchestration skill not found: ${skillId}`);
    }

    // 解析输入参数
    const params = await skill.parseInput(input, context);

    // 创建执行上下文
    const execContext: OrchestrationContext = {
      ...context,
      params,
      onProgress: (step, percent, message) => {
        // 进度回调会被转换为流式输出
      },
    };

    // 执行 Skill
    yield* skill.executeStream(execContext);
  }
}
```

### 4.3 编排 Skill 基类

```typescript
// src/lib/ai-skills/core/orchestration-skill.ts

/**
 * 编排 Skill 基类
 *
 * 继承自 BaseSkill，扩展多步骤编排能力
 */
export abstract class OrchestrationSkill<
  TInput = unknown,
  TOutput = unknown,
> extends BaseSkill<TInput, TOutput> {
  /**
   * 解析自然语言输入为结构化参数
   */
  abstract parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<TInput>;

  /**
   * 流式执行（支持进度报告）
   */
  abstract executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk>;

  /**
   * 报告进度
   */
  protected *reportProgress(
    step: string,
    percent: number,
    message?: string,
  ): Generator<OrchestrationStreamChunk> {
    yield {
      type: "progress",
      data: {
        step,
        percent,
        message: message || step,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * 请求用户确认
   */
  protected async requestConfirmation(
    options: ConfirmationOptions,
  ): Promise<ConfirmationResult> {
    // 发送确认请求，等待用户响应
    // 这里需要与 UI 层配合实现
  }

  /**
   * 生成交付物
   */
  protected async generateDeliverable(
    type: DeliverableType,
    data: unknown,
    format: OutputFormat,
  ): Promise<Deliverable> {
    // 根据类型和格式生成交付物
  }

  /**
   * 调用原子 Skill（复用现有能力）
   */
  protected async invokeAtomicSkill<T>(
    skillId: string,
    params: unknown,
    context: SkillContext,
  ): Promise<T> {
    const skill = skillRegistry.get(skillId);
    if (!skill) {
      throw new Error(`Atomic skill not found: ${skillId}`);
    }
    const result = await skill.execute(params, context);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data as T;
  }

  /**
   * 调用 Tool（复用现有 Tools）
   */
  protected async invokeTool<T>(
    toolName: string,
    params: unknown,
    context: ToolContext,
  ): Promise<T> {
    const result = await toolRegistry.execute(toolName, params, context);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data as T;
  }
}
```

### 4.4 编排 Skill 实现示例

```typescript
// src/lib/ai-skills/skills/knowledge-review/knowledge-review.skill.ts

import { z } from "zod";
import { OrchestrationSkill } from "../../core/orchestration-skill";
import type { SkillMetadata, OrchestrationContext } from "../../core/types";

const KnowledgeReviewInputSchema = z.object({
  timeRange: z.enum(["today", "week", "month"]).default("week"),
  topic: z.string().optional(),
  folderId: z.number().optional(),
  mode: z.enum(["quick", "deep", "quiz"]).default("quick"),
  limit: z.number().default(10),
});

type KnowledgeReviewInput = z.infer<typeof KnowledgeReviewInputSchema>;

export class KnowledgeReviewSkill extends OrchestrationSkill<
  KnowledgeReviewInput,
  KnowledgeReviewOutput
> {
  readonly metadata: SkillMetadata = {
    id: "knowledge_review",
    name: "知识回顾助手",
    description:
      "基于遗忘曲线智能推荐需要复习的收藏内容，支持快速浏览、深度复习、测试模式",
    category: "learning",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["forgetting-curve", "smart-review", "spaced-repetition"],
    estimatedDurationMs: 5000,
    maxExecutionTimeMs: 30000,
  };

  readonly inputSchema = KnowledgeReviewInputSchema;
  readonly outputSchema = KnowledgeReviewOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<KnowledgeReviewInput> {
    // 简单规则解析
    const input: Partial<KnowledgeReviewInput> = {};

    if (/今[天日]/.test(message)) input.timeRange = "today";
    else if (/本周|这周/.test(message)) input.timeRange = "week";
    else if (/本月|这个月/.test(message)) input.timeRange = "month";

    if (/快速|简单/.test(message)) input.mode = "quick";
    else if (/深度|详细/.test(message)) input.mode = "deep";
    else if (/测试|检验/.test(message)) input.mode = "quiz";

    // 提取主题关键词
    const topicMatch = message.match(/关于(.+?)的|(.+?)相关/);
    if (topicMatch) {
      input.topic = topicMatch[1] || topicMatch[2];
    }

    return this.inputSchema.parse(input);
  }

  /**
   * 流式执行
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const input = context.params as KnowledgeReviewInput;

    // Step 1: 获取候选书签
    yield* this.reportProgress("分析", 10, "正在分析收藏数据...");
    const candidates = await this.getCandidates(input, context);

    if (candidates.length === 0) {
      yield {
        type: "text",
        data: { text: "当前没有需要回顾的内容，继续保持学习！" },
      };
      return;
    }

    // Step 2: 计算优先级
    yield* this.reportProgress("计算", 30, "计算回顾优先级...");
    const prioritized = await this.calculatePriorities(candidates, input);

    // Step 3: 生成回顾卡片
    yield* this.reportProgress("生成", 60, "生成回顾卡片...");
    const cards = await this.generateReviewCards(
      prioritized.slice(0, input.limit),
      input.mode,
    );

    // Step 4: 准备交付物
    yield* this.reportProgress("完成", 90, "准备回顾清单...");
    const deliverable = await this.generateDeliverable(
      "review_list",
      cards,
      "cards",
    );

    // 输出结果
    yield {
      type: "text",
      data: {
        text: `📚 为您筛选了 ${cards.length} 条需要回顾的内容\n\n基于遗忘曲线分析，这些内容正处于记忆衰退期，建议及时复习巩固。`,
      },
    };

    yield {
      type: "deliverable",
      data: deliverable,
    };

    yield {
      type: "suggestions",
      data: {
        suggestions: [
          { label: "开始回顾", action: "start_review" },
          { label: "导出清单", action: "export_list" },
          { label: "设置提醒", action: "set_reminder" },
        ],
      },
    };

    yield {
      type: "done",
      data: {
        success: true,
        summary: `为您准备了 ${cards.length} 条回顾内容`,
      },
    };
  }

  /**
   * 原有 executeInternal 实现（兼容原子模式调用）
   */
  protected async executeInternal(
    input: KnowledgeReviewInput,
    context: SkillContext,
  ): Promise<KnowledgeReviewOutput> {
    const candidates = await this.getCandidates(input, context);
    const prioritized = await this.calculatePriorities(candidates, input);
    const cards = await this.generateReviewCards(
      prioritized.slice(0, input.limit),
      input.mode,
    );

    return {
      items: cards,
      totalCount: prioritized.length,
      summary: `为您筛选了 ${cards.length} 条需要回顾的内容`,
    };
  }

  // 私有方法实现...
  private async getCandidates(
    input: KnowledgeReviewInput,
    context: SkillContext,
  ) {
    // 调用现有 Tool 获取数据
    return this.invokeTool<Bookmark[]>(
      "list_bookmarks",
      {
        limit: 100,
        orderBy: "created_at",
      },
      { userId: context.userId },
    );
  }

  private async calculatePriorities(
    candidates: Bookmark[],
    input: KnowledgeReviewInput,
  ) {
    // 遗忘曲线算法
    return candidates
      .map((b) => ({
        ...b,
        priority: this.forgettingCurve.calculate(b.last_read_at, b.read_count),
      }))
      .sort((a, b) => b.priority - a.priority);
  }
}
```

---

## 5. 统一输出协议

### 5.1 统一流式输出类型

```typescript
// src/lib/ai-skills/output/types.ts

/**
 * 统一流式输出块
 *
 * 无论原子模式还是编排模式，都使用此协议
 */
type UnifiedStreamChunk =
  | TextChunk // 文本内容
  | ProgressChunk // 进度更新
  | ToolCallChunk // 工具调用（原子模式）
  | ConfirmationChunk // 确认请求
  | DeliverableChunk // 交付物
  | SuggestionsChunk // 后续建议
  | RoutingChunk // 路由信息（调试用）
  | ErrorChunk // 错误
  | DoneChunk; // 完成

/**
 * 文本块
 */
interface TextChunk {
  type: "text";
  data: {
    text: string;
    isPartial?: boolean; // 是否为部分文本（流式）
  };
}

/**
 * 进度块
 */
interface ProgressChunk {
  type: "progress";
  data: {
    step: string; // 当前步骤名称
    percent: number; // 进度百分比 0-100
    message?: string; // 进度消息
    timestamp: number;
  };
}

/**
 * 工具调用块（原子模式）
 */
interface ToolCallChunk {
  type: "tool-call";
  data: {
    toolName: string;
    args: Record<string, unknown>;
    status: "pending" | "running" | "completed" | "failed";
    result?: unknown;
  };
}

/**
 * 确认请求块
 */
interface ConfirmationChunk {
  type: "confirmation";
  data: {
    id: string;
    title: string;
    message: string;
    options: ConfirmOption[];
    preview?: unknown; // 预览数据
    timeout?: number; // 超时时间（毫秒）
  };
}

/**
 * 交付物块
 */
interface DeliverableChunk {
  type: "deliverable";
  data: {
    id: string;
    type: DeliverableType; // 'report' | 'list' | 'cards' | 'document' | 'mindmap'
    title: string;
    format: OutputFormat; // 'markdown' | 'html' | 'json' | 'cards'
    content: unknown;
    downloadable?: boolean;
    shareable?: boolean;
    actions?: DeliverableAction[];
  };
}

/**
 * 后续建议块
 */
interface SuggestionsChunk {
  type: "suggestions";
  data: {
    suggestions: Suggestion[];
  };
}

interface Suggestion {
  label: string;
  action: string;
  params?: Record<string, unknown>;
  icon?: string;
}

/**
 * 完成块
 */
interface DoneChunk {
  type: "done";
  data: {
    success: boolean;
    summary?: string;
    tokensUsed?: number;
    durationMs?: number;
    mode?: "atomic" | "orchestration";
  };
}
```

### 5.2 输出适配器

```typescript
// src/lib/ai-skills/output/adapter.ts

/**
 * 输出适配器
 *
 * 将不同模式的输出转换为统一格式
 */
export class UnifiedOutputAdapter {
  /**
   * 适配原子模式输出
   */
  adaptAtomicChunk(chunk: AgentStreamChunk): UnifiedStreamChunk {
    switch (chunk.type) {
      case "text":
        return {
          type: "text",
          data: { text: chunk.text!, isPartial: true },
        };

      case "tool-call":
        return {
          type: "tool-call",
          data: {
            toolName: chunk.toolCall!.toolName,
            args: chunk.toolCall!.args,
            status: chunk.toolCall!.status,
            result: chunk.toolCall!.result,
          },
        };

      case "confirmation":
        return {
          type: "confirmation",
          data: this.adaptConfirmation(chunk.confirmation!),
        };

      case "done":
        return {
          type: "done",
          data: {
            success: chunk.result!.success,
            summary: chunk.result!.content,
            tokensUsed: chunk.result!.tokensUsed?.total,
            durationMs: chunk.result!.durationMs,
            mode: "atomic",
          },
        };

      case "error":
        return {
          type: "error",
          data: { message: chunk.error! },
        };

      default:
        return {
          type: "text",
          data: { text: "" },
        };
    }
  }

  /**
   * 适配编排模式输出
   */
  adaptOrchestrationChunk(chunk: OrchestrationStreamChunk): UnifiedStreamChunk {
    // 编排模式输出已经是统一格式，直接返回
    return chunk as UnifiedStreamChunk;
  }
}
```

---

## 6. 技术实现方案

### 6.1 目录结构

```
src/lib/ai-skills/
├── core/                           # 核心层（现有）
│   ├── types.ts                    # 类型定义
│   ├── base-skill.ts               # 原子 Skill 基类
│   ├── skill-registry.ts           # Skill 注册表
│   └── skill-execution-logger.ts   # 执行日志
│
├── router/                         # 🆕 路由层（新增）
│   ├── intent-router.ts            # 意图路由器
│   ├── intent-classifier.ts        # 意图分类器
│   ├── complexity-evaluator.ts     # 复杂度评估器
│   ├── mode-selector.ts            # 模式选择器
│   └── types.ts                    # 路由类型
│
├── engine/                         # 🆕 执行引擎（新增）
│   ├── unified-engine.ts           # 统一执行引擎
│   ├── orchestration-engine.ts     # 编排执行引擎
│   └── types.ts                    # 引擎类型
│
├── orchestration/                  # 🆕 编排能力（新增）
│   ├── orchestration-skill.ts      # 编排 Skill 基类
│   ├── progress-reporter.ts        # 进度报告器
│   ├── confirmation-handler.ts     # 确认处理器
│   └── deliverable-generator.ts    # 交付物生成器
│
├── output/                         # 🆕 输出层（新增）
│   ├── types.ts                    # 统一输出类型
│   ├── adapter.ts                  # 输出适配器
│   └── formatters/                 # 格式化器
│       ├── markdown.ts
│       ├── cards.ts
│       └── mindmap.ts
│
├── skills/                         # Skills 目录
│   ├── classify/                   # ✅ 现有原子 Skill
│   ├── search/                     # ✅ 现有原子 Skill
│   ├── summary/                    # ✅ 现有原子 Skill
│   ├── knowledge-review/           # 🆕 编排 Skill
│   ├── duplicate-cleanup/          # 🆕 编排 Skill
│   ├── quick-digest/               # 🆕 编排 Skill
│   └── ...
│
└── index.ts                        # 统一导出
```

### 6.2 注册与初始化

```typescript
// src/lib/ai-skills/register.ts

import { skillRegistry } from "./core/skill-registry";
import { orchestrationEngine } from "./engine/orchestration-engine";

// 注册原子 Skills（现有）
import { classifySkill } from "./skills/classify";
import { searchSkill } from "./skills/search";
import { summarySkill } from "./skills/summary";

skillRegistry.register(classifySkill);
skillRegistry.register(searchSkill);
skillRegistry.register(summarySkill);

// 注册编排 Skills（新增）
import { knowledgeReviewSkill } from "./skills/knowledge-review";
import { duplicateCleanupSkill } from "./skills/duplicate-cleanup";
import { quickDigestSkill } from "./skills/quick-digest";

orchestrationEngine.register(knowledgeReviewSkill);
orchestrationEngine.register(duplicateCleanupSkill);
orchestrationEngine.register(quickDigestSkill);

// 导出统一引擎
export { unifiedEngine } from "./engine/unified-engine";
```

### 6.3 API 层集成

```typescript
// src/app/api/ai/chat/route.ts

import { unifiedEngine } from "@/lib/ai-skills";

export async function POST(request: Request) {
  const { message, conversationId, bookmarkIds } = await request.json();
  const user = await getUser();

  const context: EngineContext = {
    userId: user.id,
    conversationId,
    bookmarkIds,
  };

  // 使用统一引擎
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of unifiedEngine.execute(message, context)) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
```

---

## 7. 迁移与兼容策略

### 7.1 零侵入原则

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              零侵入保证                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  现有文件（不修改）:                                                        │
│  ├── src/lib/ai-skills/core/base-skill.ts          ✅ 保持不变             │
│  ├── src/lib/ai-skills/core/skill-registry.ts      ✅ 保持不变             │
│  ├── src/lib/ai-skills/skills/classify/*           ✅ 保持不变             │
│  ├── src/lib/ai-skills/skills/search/*             ✅ 保持不变             │
│  ├── src/lib/ai-skills/skills/summary/*            ✅ 保持不变             │
│  └── src/lib/ai-agent/core/knowledge-agent.ts      ✅ 保持不变             │
│                                                                             │
│  新增文件（扩展能力）:                                                      │
│  ├── src/lib/ai-skills/router/*                    🆕 新增                 │
│  ├── src/lib/ai-skills/engine/*                    🆕 新增                 │
│  ├── src/lib/ai-skills/orchestration/*             🆕 新增                 │
│  ├── src/lib/ai-skills/output/*                    🆕 新增                 │
│  └── src/lib/ai-skills/skills/[new-skills]/*       🆕 新增                 │
│                                                                             │
│  修改文件（最小改动）:                                                      │
│  ├── src/lib/ai-skills/register.ts                 📝 添加新注册           │
│  └── src/app/api/ai/chat/route.ts                  📝 切换到统一引擎       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 渐进式启用

```typescript
// 配置：是否启用统一引擎
const UNIFIED_ENGINE_ENABLED = process.env.UNIFIED_ENGINE_ENABLED === "true";

// API 路由
export async function POST(request: Request) {
  if (UNIFIED_ENGINE_ENABLED) {
    // 新架构：统一引擎
    return handleWithUnifiedEngine(request);
  } else {
    // 旧架构：直接 KnowledgeAgent
    return handleWithKnowledgeAgent(request);
  }
}
```

### 7.3 回退机制

```typescript
// 统一引擎内置回退
class UnifiedEngine {
  async *execute(input: string, context: EngineContext) {
    try {
      const route = await this.router.route({ message: input, context });

      if (route.mode === "orchestration") {
        try {
          yield* this.executeOrchestration(
            route.suggestedSkill!,
            input,
            context,
          );
        } catch (error) {
          // 编排失败，自动回退到原子模式
          console.warn(
            "Orchestration failed, falling back to atomic mode",
            error,
          );
          yield { type: "fallback", data: { reason: error.message } };
          yield* this.executeAtomic(input, context);
        }
      } else {
        yield* this.executeAtomic(input, context);
      }
    } catch (routingError) {
      // 路由失败，使用原子模式
      console.warn("Routing failed, using atomic mode", routingError);
      yield* this.executeAtomic(input, context);
    }
  }
}
```

---

## 8. 实施路线图

### 8.1 分阶段实施

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              实施路线图                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: 基础设施 (1 周)                                                   │
│  ├── 实现 IntentRouter (意图分类、复杂度评估、模式选择)                      │
│  ├── 实现 OrchestrationSkill 基类                                          │
│  ├── 实现 UnifiedEngine 和 UnifiedOutputAdapter                            │
│  └── 单元测试覆盖                                                           │
│                                                                             │
│  Phase 2: 首个编排 Skill (1 周)                                             │
│  ├── 实现 knowledge_review Skill                                           │
│  ├── 集成测试                                                               │
│  ├── UI 适配（进度条、交付物展示）                                          │
│  └── 灰度发布验证                                                           │
│                                                                             │
│  Phase 3: 扩展编排 Skills (2 周)                                            │
│  ├── duplicate_cleanup                                                      │
│  ├── quick_digest                                                           │
│  ├── smart_tagging                                                          │
│  └── reading_planner                                                        │
│                                                                             │
│  Phase 4: 优化与完善 (1 周)                                                 │
│  ├── 意图分类优化（收集真实数据训练）                                       │
│  ├── 性能优化                                                               │
│  ├── 错误处理完善                                                           │
│  └── 文档完善                                                               │
│                                                                             │
│  总计: 5 周                                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 里程碑

| 里程碑 | 时间   | 交付物                                 |
| ------ | ------ | -------------------------------------- |
| M1     | Week 1 | 统一引擎 MVP，可路由到原子模式         |
| M2     | Week 2 | 首个编排 Skill 上线 (knowledge_review) |
| M3     | Week 4 | 5 个编排 Skills 全部上线               |
| M4     | Week 5 | 性能优化、文档完善、正式发布           |

### 8.3 风险与应对

| 风险                | 影响         | 应对措施                         |
| ------------------- | ------------ | -------------------------------- |
| 意图分类不准确      | 用户体验差   | 默认回退到原子模式；收集数据迭代 |
| 编排 Skill 执行失败 | 任务中断     | 自动回退机制；错误上报           |
| 性能问题            | 响应慢       | 路由层缓存；异步预热             |
| UI 不适配           | 功能无法展示 | 渐进增强，降级到文本输出         |

---

## 9. 总结

### 9.1 架构优势

| 优势         | 说明                             |
| ------------ | -------------------------------- |
| **智能路由** | 根据用户意图自动选择最优模式     |
| **零侵入**   | 不修改现有代码，只做扩展         |
| **双模并行** | 简单任务快速响应，复杂任务端到端 |
| **统一体验** | 无论哪种模式，用户感知一致       |
| **渐进升级** | 可以逐步添加编排 Skills          |
| **安全回退** | 任何异常都能回退到稳定的原子模式 |

### 9.2 关键设计决策

1. **IntentRouter 作为统一入口** - 所有请求先经过路由决策
2. **OrchestrationSkill 继承 BaseSkill** - 复用验证、日志、指标等能力
3. **编排 Skill 可调用原子 Skill** - 最大化复用现有能力
4. **统一输出协议** - 前端只需适配一套输出格式
5. **配置化启用** - 可以灰度发布，随时回退

---

## 附录

### A. 类型定义汇总

```typescript
// src/lib/ai-skills/types/index.ts

// 执行模式
export type ExecutionMode = "atomic" | "orchestration";

// 意图类型
export type IntentType =
  | "query"
  | "action"
  | "organize"
  | "analyze"
  | "learn"
  | "create"
  | "chitchat";

// 复杂度级别
export type ComplexityLevel = "simple" | "medium" | "complex";

// 交付物类型
export type DeliverableType =
  | "report"
  | "list"
  | "cards"
  | "document"
  | "mindmap"
  | "graph";

// 输出格式
export type OutputFormat = "markdown" | "html" | "json" | "cards" | "mindmap";

// 路由结果
export interface RouteResult {
  intent: IntentClassification;
  complexity: ComplexityEvaluation;
  mode: ExecutionMode;
  suggestedSkill: string | null;
  reason: string;
}

// 引擎上下文
export interface EngineContext {
  userId: string;
  conversationId?: string;
  bookmarkIds?: number[];
  messageHistory?: Message[];
  userPreferences?: UserPreferences;
}
```

### B. UI 适配指南

前端需要适配的新增输出类型：

| 输出类型       | UI 组件         | 说明                      |
| -------------- | --------------- | ------------------------- |
| `progress`     | ProgressBar     | 显示执行进度              |
| `confirmation` | ConfirmDialog   | 请求用户确认              |
| `deliverable`  | DeliverableCard | 展示交付物（可下载/分享） |
| `suggestions`  | SuggestionChips | 展示后续建议按钮          |
| `routing`      | RoutingBadge    | 调试模式显示路由信息      |

---

**文档结束**

> 请审核以上架构设计，如有疑问或建议，欢迎讨论。
