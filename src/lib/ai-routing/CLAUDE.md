# AI Routing 统一路由层

> Layer 4 - 统一入口层，负责意图分析、模式选择、预处理和缓存

## 模块概述

AI Routing 是 AnyKeep AI 系统的第四层，作为所有 AI 请求的统一入口点。它从 `ai-skills/router` 中提取核心路由逻辑，形成独立的路由决策层。

```
┌─────────────────────────────────────────────────────────────┐
│                    UnifiedEntry (统一入口)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Preprocessor │→ │ IntentCache  │→ │ClassifierChain│      │
│  │  (预处理)     │  │  (L1 缓存)   │  │  (分类器链)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                           ↓                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │DebugTracer   │← │ ModeSelector │← │Complexity    │      │
│  │ (调试追踪)    │  │  (模式选择)  │  │ Evaluator    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
ai-routing/
├── index.ts                    # 统一导出入口
├── types.ts                    # 核心类型定义
├── CLAUDE.md                   # 本文档
├── __tests__/                  # 单元测试
│   ├── classifier-chain.test.ts
│   ├── complexity-evaluator.test.ts
│   ├── mode-selector.test.ts
│   ├── intent-cache.test.ts
│   └── unified-entry.test.ts
├── entry/                      # 统一入口
│   ├── index.ts
│   ├── types.ts
│   └── unified-entry.ts
├── intent/                     # 意图分类
│   ├── index.ts
│   ├── types.ts
│   ├── classifier-interface.ts
│   ├── classifier-chain.ts
│   ├── rule-based-classifier.ts
│   ├── semantic-classifier.ts
│   └── llm-classifier.ts
├── routing/                    # 路由决策
│   ├── index.ts
│   ├── types.ts
│   ├── mode-selector.ts
│   └── complexity-evaluator.ts
├── preprocessing/              # 预处理
│   ├── index.ts
│   ├── types.ts
│   └── input-preprocessor.ts
├── cache/                      # 缓存层
│   ├── index.ts
│   ├── types.ts
│   └── intent-cache.ts
└── debug/                      # 调试追踪
    ├── index.ts
    └── debug-trace.ts
```

## 核心组件

### 1. UnifiedEntry (统一入口)

所有 AI 请求的入口点，整合预处理、缓存、分类、模式选择。

```typescript
import { getUnifiedEntry, createUnifiedEntry } from "@/lib/ai-routing";

// 使用单例
const entry = getUnifiedEntry();
const result = await entry.route({
  message: "帮我整理收藏",
  userId: "user-123",
  sessionId: "session-456",
  context: {
    selectedBookmarks: [1, 2, 3],
  },
});

// 创建独立实例
const customEntry = createUnifiedEntry({
  enablePreprocessing: true,
  enableCache: true,
  enableDebugTrace: true,
});
```

### 2. ClassifierChain (分类器链)

按优先级顺序执行多个分类器，返回第一个置信度满足阈值的结果。

```typescript
import { ClassifierChain, type IntentClassifier } from "@/lib/ai-routing";

const chain = new ClassifierChain({
  minConfidenceThreshold: 0.5,
  debug: true,
});

// 注册分类器（按优先级）
chain.register(ruleBasedClassifier); // priority: 10
chain.register(semanticClassifier); // priority: 50
chain.register(llmClassifier); // priority: 100

const result = await chain.classify(message, context);
```

**分类器优先级**：
| 分类器 | Priority | 说明 |
|--------|----------|------|
| RuleBasedClassifier | 10 | 规则匹配，最快 |
| SemanticClassifier | 50 | 语义相似度 |
| LLMClassifier | 100 | LLM 兜底，最准 |

### 3. ComplexityEvaluator (复杂度评估器)

评估请求的复杂度，用于模式选择决策。

```typescript
import { ComplexityEvaluator, COMPLEXITY_THRESHOLDS } from "@/lib/ai-routing";

const evaluator = new ComplexityEvaluator({
  simpleThreshold: COMPLEXITY_THRESHOLDS.SIMPLE, // 35
  complexThreshold: COMPLEXITY_THRESHOLDS.COMPLEX, // 60
});

const evaluation = evaluator.evaluate(intent, context);
// { level: "medium", score: 45, factors: [...] }
```

**复杂度因素**：
| 因素 | 权重 | 说明 |
|------|------|------|
| intent_complexity | 0.30 | 意图类型基础分 |
| multi_step | 0.25 | 是否需要多步骤 |
| deliverable | 0.20 | 是否期望交付物 |
| data_scale | 0.15 | 数据规模 |
| confirmation | 0.10 | 是否需要确认 |

### 4. ModeSelector (模式选择器)

根据意图和复杂度选择执行模式。

```typescript
import { ModeSelector } from "@/lib/ai-routing";

const selector = new ModeSelector();
const selection = selector.select(intent, complexity);
// { mode: "orchestration", reason: "使用 智能整理" }
```

**执行模式**：
| 模式 | 说明 | 适用场景 |
|------|------|----------|
| atomic | 原子模式 | 简单查询、单步操作 |
| orchestration | 编排模式 | 复杂任务、需要 Skill 编排 |
| workflow | 工作流模式 | 自动化流程、批量操作 |

### 5. IntentCache (意图缓存)

L1 级别精确匹配缓存，加速重复请求。

```typescript
import { IntentCache } from "@/lib/ai-routing";

const cache = new IntentCache({
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 分钟
  enableLRU: true,
});

cache.set(message, userId, result);
const cached = cache.get(message, userId);
const stats = cache.getStats();
```

## 类型定义

### 核心类型

```typescript
// 意图类型
type IntentType =
  | "chitchat" // 闲聊
  | "query" // 查询
  | "refine" // 精炼
  | "action" // 操作
  | "create" // 创建
  | "organize" // 整理
  | "analyze" // 分析
  | "learn"; // 学习

// 执行模式
type ExecutionMode = "atomic" | "orchestration" | "workflow";

// 复杂度级别
type ComplexityLevel = "simple" | "medium" | "complex";

// 分类来源
type ClassificationSource =
  | "rule"
  | "semantic"
  | "llm"
  | "cache_l1"
  | "cache_l2";
```

### 接口定义

```typescript
// 统一请求
interface UnifiedRequest {
  message: string;
  userId: string;
  sessionId?: string;
  context?: Partial<RequestContext>;
}

// 路由结果
interface RouteResult {
  intent: IntentClassification;
  complexity: ComplexityEvaluation;
  mode: ExecutionMode;
  suggestedSkill: string | null;
  reason: string;
  routingDurationMs: number;
  cacheHit?: "L1" | "none";
  preprocessedMessage?: string;
}

// 分类器接口
interface IntentClassifier {
  readonly name: string;
  readonly priority: number;
  canHandle(message: string, context: ClassificationContext): boolean;
  classify(
    message: string,
    context: ClassificationContext,
  ): Promise<ClassifierResult>;
  calibrate?(result: ClassifierResult): ClassifierResult;
}
```

## 与 ai-skills/router 的关系

ai-routing 模块从 ai-skills/router 中提取了核心路由逻辑：

| 组件                | ai-routing | ai-skills/router |
| ------------------- | ---------- | ---------------- |
| UnifiedEntry        | ✅ 新增    | -                |
| ClassifierChain     | ✅ 新增    | -                |
| ComplexityEvaluator | ✅ 迁移    | 保留（兼容）     |
| ModeSelector        | ✅ 迁移    | 保留（兼容）     |
| IntentCache         | ✅ 新增    | -                |
| IntentAnalyzer      | 适配器     | ✅ 保留          |
| IntentClassifier    | ✅ 迁移    | 保留（兼容）     |

**迁移策略**：ai-skills/router 的现有代码保持不变，ai-routing 通过适配器模式复用现有逻辑。

## 测试

```bash
# 运行 ai-routing 测试
npm test -- src/lib/ai-routing

# 运行特定测试文件
npm test -- src/lib/ai-routing/__tests__/classifier-chain.test.ts
npm test -- src/lib/ai-routing/__tests__/complexity-evaluator.test.ts
npm test -- src/lib/ai-routing/__tests__/mode-selector.test.ts
npm test -- src/lib/ai-routing/__tests__/intent-cache.test.ts
npm test -- src/lib/ai-routing/__tests__/unified-entry.test.ts
```

## 调试

启用调试追踪：

```typescript
const entry = createUnifiedEntry({
  enableDebugTrace: true,
  routerConfig: {
    debug: true,
  },
});
```

设置环境变量：

```bash
AI_ROUTING_DEBUG=true
```

## 性能指标

| 指标       | 目标   | 说明             |
| ---------- | ------ | ---------------- |
| 路由延迟   | < 50ms | 从请求到路由决策 |
| 缓存命中率 | > 60%  | L1 精确匹配      |
| 分类准确率 | > 90%  | 意图分类正确率   |

## 版本历史

| 版本  | 日期       | 变更                               |
| ----- | ---------- | ---------------------------------- |
| 1.0.0 | 2026-02-01 | 初始版本，从 ai-skills/router 提取 |

## 相关文档

- [AI Skills 系统](../ai-skills/CLAUDE.md)
- [AI Agent 核心](../ai-agent/CLAUDE.md)
- [Workflow 系统](../workflow/CLAUDE.md)
