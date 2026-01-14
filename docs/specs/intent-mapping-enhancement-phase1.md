# 意图映射增强实施方案 - Phase 1

> **版本**: 1.0.0
> **日期**: 2026-01-10
> **状态**: 待审核
> **预计工时**: 1.5 天

## 一、概述

本方案针对 AnyKeep AI 意图映射系统进行三项关键增强，目标是提升意图识别的**覆盖率**和**准确率**，特别是解决口语化、模糊表达和上下文依赖场景。

### 1.1 目标指标

| 优先级 | 增强项 | 预期收益 | 预计工时 |
|--------|--------|----------|----------|
| **P0** | 扩展边界场景规则 | +5-10% 覆盖率 | 2h |
| **P0** | 启用混合分类器 | +3-5% 准确率 | 4h |
| **P1** | 上下文感知增强 | 解决歧义场景 | 1d |

### 1.2 当前基线

- 规则库规模：~100 条规则
- 测试集：62 个标准测试 + 25 个真实场景
- 当前准确率：100%（标准测试集）
- 覆盖场景：搜索、整理、分析、创建、学习、闲聊等 9 大类

---

## 二、P0-1: 扩展边界场景规则

### 2.1 目标

识别并补充未覆盖的边界表达场景，预计新增 15-20 条规则。

### 2.2 场景分类

#### 2.2.1 情感表达类（高优先级）

用户带有情绪的表达，隐含操作意图：

| 用户表达 | 预期意图 | 规则设计 |
|----------|----------|----------|
| "好烦啊找不到那个网页了" | query:search | `/好?烦.{0,5}找不到/` |
| "终于想起来要整理书签了" | organize:cleanup | `/终于.{0,5}(整理|清理)/` |
| "头疼，收藏太乱了" | organize:cleanup | `/头疼.{0,5}(乱|多)/` |
| "好久没看收藏了" | query:list | `/好久没.{0,5}(看|整理)/` |

**新增规则代码：**

```typescript
// 情感表达类规则 - Phase 1.2
{
  pattern: /好?烦.{0,5}找不到/,
  type: "query",
  subType: "search",
  complexity: "simple",
  weight: 70,
},
{
  pattern: /终于.{0,5}(整理|清理)/,
  type: "organize",
  subType: "cleanup",
  complexity: "complex",
  weight: 66,
},
{
  pattern: /(头疼|头痛|崩溃).{0,5}(乱|多|杂)/,
  type: "organize",
  subType: "cleanup",
  complexity: "complex",
  weight: 64,
},
{
  pattern: /好久没.{0,5}(看|整理|管|打开)/,
  type: "query",
  subType: "list",
  complexity: "simple",
  weight: 52,
},
```

#### 2.2.2 省略主语类

用户省略"书签/收藏"主语的简短指令：

| 用户表达 | 预期意图 | 规则设计 |
|----------|----------|----------|
| "整理下" | organize:cleanup | `/^整理(下|一下)?$/` |
| "分类" | organize:classify | `/^分类$/` |
| "导出" | create:export | `/^导出$/` |
| "备份" | create:share | `/^备份$/` |

**新增规则代码：**

```typescript
// 省略主语类规则 - Phase 1.2
{
  pattern: /^整理(下|一下)?$/,
  type: "organize",
  subType: "cleanup",
  complexity: "complex",
  weight: 62,
},
{
  pattern: /^分类$/,
  type: "organize",
  subType: "classify",
  complexity: "medium",
  weight: 58,
},
{
  pattern: /^导出$/,
  type: "create",
  subType: "export",
  complexity: "medium",
  weight: 70,
},
{
  pattern: /^备份$/,
  type: "create",
  subType: "share",
  complexity: "medium",
  weight: 68,
},
```

#### 2.2.3 动词变形类

用户使用非标准动词形式：

| 用户表达 | 预期意图 | 规则设计 |
|----------|----------|----------|
| "找一找 AI 相关" | query:search | `/找一找.+/` |
| "看一眼收藏" | query:list | `/看一眼/` |
| "理一理" | organize:cleanup | `/理一理/` |
| "翻一翻" | query:list | `/翻一翻/` |

**新增规则代码：**

```typescript
// 动词变形类规则 - Phase 1.2
{
  pattern: /找一找.{1,20}/,
  type: "query",
  subType: "search",
  complexity: "simple",
  weight: 68,
},
{
  pattern: /看一眼/,
  type: "query",
  subType: "list",
  complexity: "simple",
  weight: 50,
},
{
  pattern: /理一理/,
  type: "organize",
  subType: "cleanup",
  complexity: "complex",
  weight: 60,
},
{
  pattern: /翻一翻/,
  type: "query",
  subType: "list",
  complexity: "simple",
  weight: 48,
},
```

#### 2.2.4 英文混合类

中英文混合表达：

| 用户表达 | 预期意图 | 规则设计 |
|----------|----------|----------|
| "export to markdown" | create:export | `/^export\s+(to\s+)?/i` |
| "find React" | query:search | `/^find\s+.+/i` |
| "delete this" | action:delete | `/^delete\s+(this|it)?$/i` |
| "tag as important" | action:tag | `/^tag\s+(as\s+)?/i` |

**新增规则代码：**

```typescript
// 英文混合类规则 - Phase 1.2
{
  pattern: /^export\s+(to\s+)?(markdown|json|csv|html)?$/i,
  type: "create",
  subType: "export",
  complexity: "medium",
  weight: 82,
},
{
  pattern: /^find\s+.+$/i,
  type: "query",
  subType: "search",
  complexity: "simple",
  weight: 80,
},
{
  pattern: /^delete\s+(this|it|them)?$/i,
  type: "action",
  subType: "delete",
  complexity: "simple",
  weight: 68,
},
{
  pattern: /^tag\s+(as\s+)?/i,
  type: "action",
  subType: "tag",
  complexity: "simple",
  weight: 70,
},
```

#### 2.2.5 功能询问类

用户询问功能或寻求帮助：

| 用户表达 | 预期意图 | 规则设计 |
|----------|----------|----------|
| "你能帮我做什么" | chitchat:help | 已有规则 P3-C1 |
| "怎么导出书签" | chitchat:help | `/怎么.{0,5}(导出|整理|搜索|分类)/` |
| "有没有自动分类功能" | chitchat:help | `/有没有.{0,5}(自动|智能).{0,5}功能/` |
| "能自动整理吗" | chitchat:help | `/能.{0,3}(自动|智能).{0,5}(整理|分类|标签)吗?/` |

**新增规则代码：**

```typescript
// 功能询问类规则 - Phase 1.2
{
  pattern: /怎么.{0,5}(导出|整理|搜索|分类|标签|备份)/,
  type: "chitchat",
  subType: "help",
  complexity: "simple",
  weight: 30,
},
{
  pattern: /有没有.{0,5}(自动|智能).{0,5}功能/,
  type: "chitchat",
  subType: "help",
  complexity: "simple",
  weight: 28,
},
{
  pattern: /能.{0,3}(自动|智能).{0,5}(整理|分类|标签)吗?/,
  type: "chitchat",
  subType: "help",
  complexity: "simple",
  weight: 26,
},
```

### 2.3 测试用例扩展

新增测试用例添加到 `scripts/test-intent-mapping.ts`：

```typescript
// Phase 1.2 新增测试用例
const PHASE_1_2_TEST_CASES = [
  // 情感表达类
  { input: "好烦啊找不到那个网页了", expected: "query:search" },
  { input: "终于想起来要整理书签了", expected: "organize:cleanup" },
  { input: "头疼，收藏太乱了", expected: "organize:cleanup" },
  { input: "好久没看收藏了", expected: "query:list" },

  // 省略主语类
  { input: "整理下", expected: "organize:cleanup" },
  { input: "分类", expected: "organize:classify" },
  { input: "导出", expected: "create:export" },
  { input: "备份", expected: "create:share" },

  // 动词变形类
  { input: "找一找 AI 相关", expected: "query:search" },
  { input: "看一眼收藏", expected: "query:list" },
  { input: "理一理", expected: "organize:cleanup" },
  { input: "翻一翻", expected: "query:list" },

  // 英文混合类
  { input: "export to markdown", expected: "create:export" },
  { input: "find React", expected: "query:search" },
  { input: "delete this", expected: "action:delete" },
  { input: "tag as important", expected: "action:tag" },

  // 功能询问类
  { input: "怎么导出书签", expected: "chitchat:help" },
  { input: "有没有自动分类功能", expected: "chitchat:help" },
  { input: "能自动整理吗", expected: "chitchat:help" },
];
```

### 2.4 实施步骤

1. **规则添加**（30min）
   - 在 `intent-classifier.ts` 的 `DEFAULT_RULES` 中添加新规则
   - 按类别分组，添加注释说明

2. **测试用例扩展**（30min）
   - 在 `test-intent-mapping.ts` 中添加新测试用例
   - 运行测试确保新规则正确匹配

3. **回归测试**（30min）
   - 运行全部 62 个标准测试
   - 运行 25 个真实场景测试
   - 确保无回归问题

4. **边界检查**（30min）
   - 检查新规则与现有规则的冲突
   - 调整权重解决优先级问题

---

## 三、P0-2: 启用混合分类器

### 3.1 目标

将 `HybridIntentClassifier` 作为默认分类器启用，融合规则匹配和语义匹配，提升准确率。

### 3.2 当前状态

```
HybridIntentClassifier 已实现：
├── Fast Track: 规则匹配（≤200ms）
├── Slow Track: 语义匹配 + LLM（≤1500ms）
├── SemanticIntentMatcher: 基于 Embedding 的语义匹配
├── ContextEnhancer: 上下文增强（指代消解）
└── 超时回退机制
```

**当前问题**：
- 默认使用 `IntentClassifier`（纯规则）
- `HybridIntentClassifier` 未在生产环境启用
- 语义匹配 Embedding 未预加载

### 3.3 实施方案

#### 3.3.1 Feature Flag 配置

在 `src/lib/ai-agent/config/feature-flags.ts` 添加：

```typescript
// 混合分类器 Feature Flags
export const INTENT_CLASSIFIER_FLAGS = {
  /** 是否启用混合分类器（默认 false，灰度发布） */
  ENABLE_HYBRID_CLASSIFIER: process.env.ENABLE_HYBRID_CLASSIFIER === "true",

  /** 是否启用语义匹配（默认 true） */
  ENABLE_SEMANTIC_MATCHING: process.env.ENABLE_SEMANTIC_MATCHING !== "false",

  /** 是否启用 LLM 兜底（默认 false） */
  ENABLE_LLM_FALLBACK: process.env.ENABLE_LLM_FALLBACK === "true",

  /** 语义匹配相似度阈值（默认 0.7） */
  SEMANTIC_THRESHOLD: parseFloat(process.env.SEMANTIC_THRESHOLD || "0.7"),

  /** Fast Track 高置信度阈值（默认 0.85） */
  FAST_TRACK_CONFIDENCE: parseFloat(process.env.FAST_TRACK_CONFIDENCE || "0.85"),
};
```

#### 3.3.2 初始化流程修改

修改 `src/lib/ai-skills/router/hybrid-intent-classifier-init.ts`：

```typescript
import { HybridIntentClassifier } from "./hybrid-intent-classifier";
import { DEFAULT_RULES } from "./intent-classifier";
import { INTENT_CLASSIFIER_FLAGS } from "@/lib/ai-agent/config/feature-flags";
import { logger } from "@/lib/logger";

// 单例实例
let hybridClassifierInstance: HybridIntentClassifier | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * 获取混合分类器实例（懒加载 + 单例）
 */
export async function getHybridClassifier(): Promise<HybridIntentClassifier> {
  if (!hybridClassifierInstance) {
    hybridClassifierInstance = new HybridIntentClassifier({
      enableSemanticMatching: INTENT_CLASSIFIER_FLAGS.ENABLE_SEMANTIC_MATCHING,
      enableLLMFallback: INTENT_CLASSIFIER_FLAGS.ENABLE_LLM_FALLBACK,
      semanticThreshold: INTENT_CLASSIFIER_FLAGS.SEMANTIC_THRESHOLD,
      ruleHighConfidenceThreshold: INTENT_CLASSIFIER_FLAGS.FAST_TRACK_CONFIDENCE,
      debug: process.env.NODE_ENV === "development",
    });

    // 预加载 Embedding（异步，不阻塞）
    if (!initializationPromise) {
      initializationPromise = hybridClassifierInstance
        .initialize(DEFAULT_RULES)
        .then(() => {
          logger.info(
            { ruleCount: DEFAULT_RULES.length },
            "HybridIntentClassifier: Embedding precomputation completed"
          );
        })
        .catch((error) => {
          logger.warn(
            { error },
            "HybridIntentClassifier: Embedding precomputation failed, falling back to rule-only"
          );
        });
    }
  }

  // 等待初始化完成（如果尚未完成）
  if (initializationPromise) {
    await initializationPromise;
  }

  return hybridClassifierInstance;
}

/**
 * 检查是否应使用混合分类器
 */
export function shouldUseHybridClassifier(): boolean {
  return INTENT_CLASSIFIER_FLAGS.ENABLE_HYBRID_CLASSIFIER;
}
```

#### 3.3.3 IntentRouter 集成

修改 `src/lib/ai-skills/router/intent-router.ts`：

```typescript
import { IntentClassifier, createIntentClassifier } from "./intent-classifier";
import { HybridIntentClassifier } from "./hybrid-intent-classifier";
import { getHybridClassifier, shouldUseHybridClassifier } from "./hybrid-intent-classifier-init";

export class IntentRouter {
  private ruleClassifier: IntentClassifier;
  private hybridClassifier: HybridIntentClassifier | null = null;

  async route(request: UserRequest): Promise<RouteResult> {
    const startTime = performance.now();

    // 根据 Feature Flag 选择分类器
    let intentResult: IntentClassification;
    let classificationSource: "rule" | "hybrid" = "rule";

    if (shouldUseHybridClassifier()) {
      try {
        const hybridClassifier = await getHybridClassifier();
        const hybridResult = await hybridClassifier.classify(request.message, {
          input: request.message,
          messageHistory: request.context.messageHistory,
          selectedBookmarks: request.context.bookmarkIds,
          currentFolder: request.context.folderId,
        });

        intentResult = {
          type: hybridResult.type,
          subType: hybridResult.subType,
          confidence: hybridResult.confidence,
          entities: hybridResult.entities,
          requiresMultiStep: hybridResult.requiresMultiStep,
          hasDeliverableExpectation: hybridResult.hasDeliverableExpectation,
          source: hybridResult.method,
          slots: hybridResult.slots,
        };

        classificationSource = "hybrid";
      } catch (error) {
        // 回退到规则分类器
        logger.warn({ error }, "IntentRouter: Hybrid classifier failed, falling back to rule");
        intentResult = await this.ruleClassifier.classify(request.message);
      }
    } else {
      intentResult = await this.ruleClassifier.classify(request.message);
    }

    // ... 后续路由逻辑
  }
}
```

#### 3.3.4 Embedding 预加载策略

在应用启动时预加载 Embedding，避免首次请求延迟：

```typescript
// src/lib/ai-skills/router/preload.ts
import { getHybridClassifier, shouldUseHybridClassifier } from "./hybrid-intent-classifier-init";
import { logger } from "@/lib/logger";

/**
 * 应用启动时预加载混合分类器
 *
 * 调用位置：
 * - Next.js: instrumentation.ts
 * - API Route: 首次请求时
 */
export async function preloadIntentClassifier(): Promise<void> {
  if (!shouldUseHybridClassifier()) {
    logger.info("IntentClassifier: Hybrid classifier disabled, skipping preload");
    return;
  }

  const startTime = performance.now();

  try {
    await getHybridClassifier();
    logger.info(
      { durationMs: Math.round(performance.now() - startTime) },
      "IntentClassifier: Preload completed"
    );
  } catch (error) {
    logger.error({ error }, "IntentClassifier: Preload failed");
  }
}
```

### 3.4 灰度发布策略

| 阶段 | 时间 | 配置 | 监控指标 |
|------|------|------|----------|
| 阶段 1 | Day 1-3 | 开发环境启用 | 准确率、延迟 |
| 阶段 2 | Day 4-7 | 10% 生产流量 | 错误率、用户反馈 |
| 阶段 3 | Day 8-14 | 50% 生产流量 | 全量指标 |
| 阶段 4 | Day 15+ | 100% 生产流量 | 持续监控 |

### 3.5 监控指标

在 `src/lib/ai-skills/router/metrics.ts` 添加：

```typescript
interface IntentClassifierMetrics {
  // 分类方法分布
  methodDistribution: {
    rule: number;
    semantic: number;
    hybrid: number;
    llm: number;
  };

  // 延迟统计（毫秒）
  latency: {
    fastTrack: { p50: number; p95: number; p99: number };
    slowTrack: { p50: number; p95: number; p99: number };
  };

  // 置信度分布
  confidenceDistribution: {
    high: number;   // >= 0.85
    medium: number; // 0.6 - 0.85
    low: number;    // < 0.6
  };

  // 超时回退次数
  timeoutFallbackCount: number;

  // 错误计数
  errorCount: number;
}
```

### 3.6 实施步骤

1. **Feature Flag 配置**（30min）
   - 添加 Feature Flag 配置
   - 更新 `.env.example` 文档

2. **初始化流程修改**（1h）
   - 实现单例模式和懒加载
   - 添加预加载逻辑

3. **IntentRouter 集成**（1h）
   - 修改路由逻辑支持混合分类器
   - 添加回退机制

4. **监控指标**（30min）
   - 实现指标收集
   - 添加日志输出

5. **测试验证**（1h）
   - 单元测试
   - 集成测试
   - 性能测试

---

## 四、P1: 上下文感知增强

### 4.1 目标

增强上下文感知能力，解决歧义场景，提升多轮对话体验。

### 4.2 核心场景

#### 4.2.1 指代消解增强

当前 `ContextEnhancer` 支持的指代：

| 指代 | 消解规则 |
|------|----------|
| "这些" | → 已选中的书签 |
| "那个" | → 唯一选中的书签 |
| "当前/这里" | → 当前文件夹 |
| "最近" | → 最近7天 |
| "本周/本月" | → 对应时间范围 |

**需要增强的指代：**

| 指代 | 消解规则 | 示例 |
|------|----------|------|
| "它" | → 上一轮提到的实体 | "找到了一篇 AI 文章" → "删除它" |
| "他们/她们" | → 上一轮返回的列表 | "搜索 React" → "标记他们" |
| "刚才的" | → 上一轮操作的对象 | "刚才的搜索结果" |
| "那几个" | → 上文提到的多个实体 | "那几个 B站 视频" |

**新增规则代码：**

```typescript
// context-enhancer.ts 新增规则
export const ENHANCED_COREFERENCE_RULES: CoreferenceRule[] = [
  ...DEFAULT_COREFERENCE_RULES,

  // Phase 1.3: 上下文指代增强
  {
    pattern: /^(它|他|她)$/i,
    resolve: (context) => {
      // 从对话历史中提取最近提到的单个实体
      const lastMentionedEntity = extractLastMentionedEntity(context.messageHistory);
      return lastMentionedEntity || null;
    },
    description: "它 → 上一轮提到的实体",
  },
  {
    pattern: /^(他们|她们|它们|这些结果)$/i,
    resolve: (context) => {
      // 从对话历史中提取最近的列表结果
      const lastSearchResults = extractLastSearchResults(context.messageHistory);
      return lastSearchResults || context.selectedBookmarks || null;
    },
    description: "他们 → 上一轮返回的列表",
  },
  {
    pattern: /^(刚才的|刚刚的)(.+)?$/i,
    resolve: (context, match) => {
      const target = match?.[2]; // e.g., "搜索结果"
      return extractLastOperationResult(context.messageHistory, target);
    },
    description: "刚才的 → 上一轮操作结果",
  },
  {
    pattern: /^(那几个|那[几\d]+[个条篇])(.+)?$/i,
    resolve: (context, match) => {
      const target = match?.[2]; // e.g., "B站视频"
      return extractMentionedEntities(context.messageHistory, target);
    },
    description: "那几个 → 上文提到的多个实体",
  },
];
```

#### 4.2.2 对话状态管理

新增对话状态类型：

```typescript
// src/lib/ai-skills/router/conversation-state.ts

/**
 * 对话状态
 */
export interface ConversationState {
  /** 会话 ID */
  sessionId: string;

  /** 最近的搜索结果 */
  lastSearchResults?: {
    query: string;
    bookmarkIds: number[];
    timestamp: Date;
  };

  /** 最近的操作 */
  lastOperation?: {
    type: "search" | "list" | "tag" | "move" | "delete" | "export";
    targetIds: number[];
    timestamp: Date;
  };

  /** 提到的实体（按类型分组） */
  mentionedEntities: {
    bookmarks: number[];
    folders: number[];
    tags: string[];
    topics: string[];
  };

  /** 当前上下文焦点 */
  currentFocus?: {
    type: "bookmark" | "folder" | "search_results" | "list";
    ids: number[];
  };
}

/**
 * 对话状态管理器
 */
export class ConversationStateManager {
  private states: Map<string, ConversationState> = new Map();

  /**
   * 更新对话状态
   */
  updateState(sessionId: string, update: Partial<ConversationState>): void {
    const current = this.states.get(sessionId) || this.createInitialState(sessionId);
    this.states.set(sessionId, { ...current, ...update });
  }

  /**
   * 记录搜索结果
   */
  recordSearchResults(sessionId: string, query: string, bookmarkIds: number[]): void {
    this.updateState(sessionId, {
      lastSearchResults: { query, bookmarkIds, timestamp: new Date() },
      currentFocus: { type: "search_results", ids: bookmarkIds },
      mentionedEntities: {
        ...this.getState(sessionId)?.mentionedEntities,
        bookmarks: bookmarkIds,
      },
    });
  }

  /**
   * 记录操作结果
   */
  recordOperation(
    sessionId: string,
    type: ConversationState["lastOperation"]["type"],
    targetIds: number[]
  ): void {
    this.updateState(sessionId, {
      lastOperation: { type, targetIds, timestamp: new Date() },
    });
  }

  /**
   * 获取对话状态
   */
  getState(sessionId: string): ConversationState | undefined {
    return this.states.get(sessionId);
  }

  /**
   * 清理过期状态（30分钟无活动）
   */
  cleanupExpiredStates(): void {
    const expireTime = Date.now() - 30 * 60 * 1000;
    for (const [sessionId, state] of this.states) {
      const lastActivity = Math.max(
        state.lastSearchResults?.timestamp?.getTime() || 0,
        state.lastOperation?.timestamp?.getTime() || 0
      );
      if (lastActivity < expireTime) {
        this.states.delete(sessionId);
      }
    }
  }

  private createInitialState(sessionId: string): ConversationState {
    return {
      sessionId,
      mentionedEntities: {
        bookmarks: [],
        folders: [],
        tags: [],
        topics: [],
      },
    };
  }
}

// 单例实例
export const conversationStateManager = new ConversationStateManager();
```

#### 4.2.3 歧义消解流程

当意图不明确时，生成消歧问题：

```typescript
// src/lib/ai-skills/router/disambiguation-dialog.ts

/**
 * 消歧对话类型
 */
export interface DisambiguationDialog {
  /** 消歧类型 */
  type: "intent" | "scope" | "target" | "action";

  /** 显示给用户的问题 */
  question: string;

  /** 选项列表 */
  options: Array<{
    label: string;
    value: string;
    description?: string;
  }>;

  /** 原始输入 */
  originalInput: string;

  /** 候选意图 */
  candidates: Array<{
    type: IntentType;
    subType?: string;
    confidence: number;
  }>;
}

/**
 * 生成消歧对话
 */
export function generateDisambiguationDialog(
  input: string,
  candidates: IntentCandidate[],
  context: ClassificationContext
): DisambiguationDialog | null {
  // 只有当 top1 和 top2 置信度差距小于 0.15 时才需要消歧
  if (candidates.length < 2) return null;

  const top1 = candidates[0];
  const top2 = candidates[1];
  const gap = top1.confidence - top2.confidence;

  if (gap >= 0.15) return null;

  // 根据候选类型生成消歧问题
  const intentTypes = new Set([top1.type, top2.type]);

  // 场景 1: 整理 vs 查询
  if (intentTypes.has("organize") && intentTypes.has("query")) {
    return {
      type: "intent",
      question: "您是想整理收藏还是查找内容？",
      options: [
        { label: "整理收藏", value: "organize", description: "清理、分类、去重" },
        { label: "查找内容", value: "query", description: "搜索、浏览、筛选" },
      ],
      originalInput: input,
      candidates: candidates.slice(0, 3).map(c => ({
        type: c.type,
        subType: c.subType,
        confidence: c.confidence,
      })),
    };
  }

  // 场景 2: 创建 vs 分析
  if (intentTypes.has("create") && intentTypes.has("analyze")) {
    return {
      type: "intent",
      question: "您是想生成内容还是查看分析？",
      options: [
        { label: "生成内容", value: "create", description: "摘要、报告、导出" },
        { label: "查看分析", value: "analyze", description: "统计、趋势、洞察" },
      ],
      originalInput: input,
      candidates: candidates.slice(0, 3).map(c => ({
        type: c.type,
        subType: c.subType,
        confidence: c.confidence,
      })),
    };
  }

  // 场景 3: 操作范围不明确
  if (!context.selectedBookmarks?.length && !context.currentFolder) {
    const scopeAmbiguousTypes: IntentType[] = ["action", "organize"];
    if (scopeAmbiguousTypes.includes(top1.type)) {
      return {
        type: "scope",
        question: "您想对哪些内容进行操作？",
        options: [
          { label: "全部收藏", value: "all", description: "所有书签" },
          { label: "当前文件夹", value: "folder", description: "当前目录下的书签" },
          { label: "让我选择", value: "manual", description: "手动选择书签" },
        ],
        originalInput: input,
        candidates: candidates.slice(0, 3).map(c => ({
          type: c.type,
          subType: c.subType,
          confidence: c.confidence,
        })),
      };
    }
  }

  return null;
}
```

### 4.3 集成到 HybridIntentClassifier

修改 `HybridIntentClassifier.classify()` 方法：

```typescript
async classify(
  input: string,
  context: ClassificationContext = { input },
): Promise<HybridIntentMatch> {
  // ... 现有 Fast Track 和 Slow Track 逻辑 ...

  // 获取对话状态
  const sessionId = context.sessionId || "default";
  const conversationState = conversationStateManager.getState(sessionId);

  // 增强上下文（指代消解 + 状态注入）
  const enhancedContext = this.enhanceContextWithState(context, conversationState);

  // 进行分类
  const result = await this.classifyInternal(input, enhancedContext);

  // 检查是否需要消歧
  if (result.confidence < FAST_TRACK_CONFIG.minConfidence) {
    const candidates = this.ruleClassifier.collectAllMatches(input);
    const disambiguationDialog = generateDisambiguationDialog(
      input,
      candidates,
      enhancedContext
    );

    if (disambiguationDialog) {
      result.disambiguationRequired = true;
      result.disambiguationDialog = disambiguationDialog;
    }
  }

  return result;
}

private enhanceContextWithState(
  context: ClassificationContext,
  state?: ConversationState
): ClassificationContext {
  if (!state) return context;

  return {
    ...context,
    // 如果用户说"这些"但没有选中，尝试从对话状态获取
    selectedBookmarks: context.selectedBookmarks?.length
      ? context.selectedBookmarks
      : state.lastSearchResults?.bookmarkIds || state.currentFocus?.ids,
  };
}
```

### 4.4 实施步骤

1. **指代消解规则扩展**（2h）
   - 添加新的指代消解规则
   - 实现实体提取辅助函数

2. **对话状态管理**（2h）
   - 实现 `ConversationStateManager`
   - 集成到 API 层

3. **消歧对话生成**（2h）
   - 实现消歧问题生成逻辑
   - 前端消歧 UI 对接

4. **集成测试**（2h）
   - 多轮对话场景测试
   - 指代消解准确率测试

---

## 五、验收标准

### 5.1 功能验收

| 验收项 | 标准 | 验证方法 |
|--------|------|----------|
| 边界规则覆盖 | 新增 15+ 条规则，覆盖 5 大类场景 | 测试用例验证 |
| 混合分类器启用 | Feature Flag 控制，灰度发布 | 配置验证 |
| 上下文消解 | 支持 8+ 种指代消解 | 多轮对话测试 |
| 消歧对话 | 置信度 <0.85 时触发消歧 | 场景测试 |

### 5.2 性能验收

| 指标 | 标准 | 验证方法 |
|------|------|----------|
| Fast Track 延迟 | P95 < 50ms | 性能测试 |
| Slow Track 延迟 | P95 < 1500ms | 性能测试 |
| 预加载时间 | < 5s | 启动时间监控 |
| 内存占用 | < 100MB（Embedding 缓存） | 内存监控 |

### 5.3 质量验收

| 指标 | 标准 | 验证方法 |
|------|------|----------|
| 单元测试覆盖 | > 80% | Jest 覆盖率报告 |
| 集成测试通过 | 100% | CI 流水线 |
| 无回归问题 | 现有 62 测试全部通过 | 回归测试 |

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 新规则与现有规则冲突 | 分类错误 | 权重调优 + 回归测试 |
| 语义匹配延迟过高 | 用户体验下降 | 超时回退 + 缓存优化 |
| Embedding 预加载失败 | 首次请求慢 | 降级到纯规则模式 |
| 消歧问题过多 | 用户打断感强 | 提高消歧阈值 + A/B 测试 |

---

## 七、附录

### A. 文件变更清单

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `src/lib/ai-skills/router/intent-classifier.ts` | 修改 | 添加边界规则 |
| `src/lib/ai-agent/config/feature-flags.ts` | 修改 | 添加 Feature Flags |
| `src/lib/ai-skills/router/hybrid-intent-classifier-init.ts` | 新增 | 初始化逻辑 |
| `src/lib/ai-skills/router/intent-router.ts` | 修改 | 集成混合分类器 |
| `src/lib/ai-skills/router/context-enhancer.ts` | 修改 | 增强指代消解 |
| `src/lib/ai-skills/router/conversation-state.ts` | 新增 | 对话状态管理 |
| `src/lib/ai-skills/router/disambiguation-dialog.ts` | 新增 | 消歧对话生成 |
| `src/lib/ai-skills/router/metrics.ts` | 修改 | 添加监控指标 |
| `scripts/test-intent-mapping.ts` | 修改 | 添加测试用例 |

### B. 配置参考

```bash
# .env.local 配置示例

# 混合分类器（默认关闭）
ENABLE_HYBRID_CLASSIFIER=true

# 语义匹配（默认开启）
ENABLE_SEMANTIC_MATCHING=true

# LLM 兜底（默认关闭）
ENABLE_LLM_FALLBACK=false

# 语义匹配阈值
SEMANTIC_THRESHOLD=0.7

# Fast Track 高置信度阈值
FAST_TRACK_CONFIDENCE=0.85
```

### C. 测试命令

```bash
# 运行意图映射测试
npx tsx scripts/test-intent-mapping.ts

# 运行真实场景测试
npx tsx scripts/test-real-scenarios.ts

# 运行单元测试
npm run test -- --testPathPattern="intent-classifier"

# 运行混合分类器测试
npm run test -- --testPathPattern="hybrid-intent-classifier"
```

---

**文档状态**: 待审核
**下一步**: 请审核本方案，确认后开始实施
