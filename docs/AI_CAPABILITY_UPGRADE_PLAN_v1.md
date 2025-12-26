# AnyKeep AI 能力升级方案 v1.0

> **版本**: 1.0.0
> **创建日期**: 2025-12-26
> **状态**: 待审核
> **预计工期**: 6-8 周

---

## 目录

1. [执行摘要](#一执行摘要)
2. [模型分层策略](#二模型分层策略)
3. [架构改进方案](#三架构改进方案)
4. [实施路线图](#四实施路线图)
5. [风险评估](#五风险评估)
6. [验收标准](#六验收标准)

---

## 一、执行摘要

### 1.1 现状评估

| 维度             | 当前状态                  | 目标状态                     |
| ---------------- | ------------------------- | ---------------------------- |
| **模型使用**     | 单一模型（deepseek-chat） | 分层模型策略                 |
| **工具结果处理** | 原始 JSON 直接传递        | 增强处理 + 摘要 + 建议       |
| **记忆系统**     | 会话级，非持久化          | 用户级持久化 + 摘要压缩      |
| **错误恢复**     | 简单回退                  | 智能分析 + 替代方案          |
| **工具调用**     | 模型自主决策              | ReAct 模式（思考-行动-反思） |
| **反馈闭环**     | 收集但未使用              | 驱动持续优化                 |

### 1.2 核心改进目标

```
智能感知提升：从"执行器"到"智能助手"

┌─────────────────────────────────────────────────────────────┐
│                    目标架构                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用户输入 ──┬──→ [思考阶段] ──→ [行动阶段] ──→ [反思阶段]    │
│             │       │              │              │         │
│             │    规划工具调用     执行工具       评估结果     │
│             │    参数合理性检查   增强结果处理   调整策略     │
│             │    多工具协调       错误恢复       学习反馈     │
│             │                                               │
│             └──→ [记忆系统] ←─────────────────────┘         │
│                    │                                        │
│                 用户级持久化                                 │
│                 上下文压缩                                   │
│                 偏好学习                                     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 预期收益

| 指标               | 当前 | 目标 | 提升 |
| ------------------ | ---- | ---- | ---- |
| 工具调用成功率     | ~75% | >90% | +15% |
| 复杂任务完成率     | ~50% | >80% | +30% |
| 用户满意度（预估） | 6/10 | 8/10 | +33% |
| 错误恢复成功率     | ~20% | >60% | +40% |
| 响应相关性         | ~70% | >85% | +15% |

---

## 二、模型分层策略

### 2.1 策略概述

```
┌────────────────────────────────────────────────────────────────┐
│                      模型分层架构                               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│  │   快速层     │   │   标准层     │   │     深度层       │   │
│  │  (Fast)      │   │  (Standard)  │   │   (Deep)         │   │
│  ├──────────────┤   ├──────────────┤   ├──────────────────┤   │
│  │ deepseek-chat│   │ deepseek-chat│   │deepseek-reasoner │   │
│  │ qwen-turbo   │   │ qwen-plus    │   │ qwen-max         │   │
│  ├──────────────┤   ├──────────────┤   ├──────────────────┤   │
│  │ 目标: <2s    │   │ 目标: <5s    │   │ 目标: <15s       │   │
│  │ 成本: 最低   │   │ 成本: 中等   │   │ 成本: 较高       │   │
│  ├──────────────┤   ├──────────────┤   ├──────────────────┤   │
│  │ 简单查询     │   │ 工具调用     │   │ 复杂推理         │   │
│  │ 闲聊         │   │ 摘要生成     │   │ 洞察分析         │   │
│  │ 意图分类     │   │ 分类标签     │   │ 学习路径规划     │   │
│  └──────────────┘   └──────────────┘   └──────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 详细配置

#### 2.2.1 模型配置表

```typescript
// 文件位置: src/lib/ai-providers/model-tier-config.ts (新建)

export const MODEL_TIER_CONFIG = {
  fast: {
    id: "fast",
    name: "快速层",
    description: "简单任务，速度优先",
    targetLatencyMs: 2000,
    maxLatencyMs: 3000,
    providers: [
      {
        name: "deepseek",
        model: "deepseek-chat",
        priority: 1,
        temperature: 0.3,
        maxTokens: 500,
      },
      {
        name: "aliyun",
        model: "qwen-turbo",
        priority: 2,
        temperature: 0.3,
        maxTokens: 500,
      },
    ],
    applicableTasks: [
      "chitchat",
      "simple_query",
      "intent_classification",
      "entity_extraction",
    ],
  },

  standard: {
    id: "standard",
    name: "标准层",
    description: "常规任务，平衡性能",
    targetLatencyMs: 5000,
    maxLatencyMs: 10000,
    providers: [
      {
        name: "deepseek",
        model: "deepseek-chat",
        priority: 1,
        temperature: 0.5,
        maxTokens: 2000,
      },
      {
        name: "aliyun",
        model: "qwen-plus",
        priority: 2,
        temperature: 0.5,
        maxTokens: 2000,
      },
    ],
    applicableTasks: [
      "tool_calling",
      "summary_generation",
      "classification",
      "medium_complexity",
    ],
  },

  deep: {
    id: "deep",
    name: "深度层",
    description: "复杂推理，质量优先",
    targetLatencyMs: 15000,
    maxLatencyMs: 30000,
    providers: [
      {
        name: "deepseek",
        model: "deepseek-reasoner",
        priority: 1,
        temperature: 0.7,
        maxTokens: 4000,
      },
      {
        name: "aliyun",
        model: "qwen-max",
        priority: 2,
        temperature: 0.7,
        maxTokens: 4000,
      },
    ],
    applicableTasks: [
      "insight_analysis",
      "learning_path",
      "complex_reasoning",
      "multi_step_planning",
    ],
  },
} as const;
```

#### 2.2.2 任务-层级映射

```typescript
// 文件位置: src/lib/ai-providers/task-tier-mapping.ts (新建)

export const TASK_TIER_MAPPING: Record<string, ModelTierId> = {
  // 快速层任务
  chitchat: "fast",
  "query:list": "fast",
  "query:count": "fast",
  "query:explain": "fast",
  intent_classification: "fast",
  entity_extraction: "fast",

  // 标准层任务
  "query:search": "standard",
  "action:tag": "standard",
  "action:move": "standard",
  "create:summary": "standard",
  "organize:classify": "standard",
  tool_calling: "standard",

  // 深度层任务
  "analyze:insight": "deep",
  "analyze:report": "deep",
  "learn:path": "deep",
  "learn:interview": "deep",
  "organize:cleanup": "deep", // 需要复杂决策
  multi_step_reasoning: "deep",
};

// 复杂度 -> 层级映射（兜底规则）
export const COMPLEXITY_TIER_MAPPING: Record<ComplexityLevel, ModelTierId> = {
  simple: "fast",
  medium: "standard",
  complex: "deep",
};
```

#### 2.2.3 层级选择器实现

```typescript
// 文件位置: src/lib/ai-providers/tier-selector.ts (新建)

export class ModelTierSelector {
  private config: typeof MODEL_TIER_CONFIG;
  private taskMapping: typeof TASK_TIER_MAPPING;
  private metricsCollector: TierMetricsCollector;

  /**
   * 选择最适合的模型层级
   */
  selectTier(context: TierSelectionContext): TierSelection {
    const { intent, complexity, taskType, userPreference } = context;

    // 1. 用户显式偏好优先
    if (userPreference?.preferredTier) {
      return this.createSelection(
        userPreference.preferredTier,
        "user_preference",
      );
    }

    // 2. 任务类型映射
    const taskKey = `${intent.type}:${intent.subType}`;
    const mappedTier =
      this.taskMapping[taskKey] || this.taskMapping[intent.type];
    if (mappedTier) {
      return this.createSelection(mappedTier, "task_mapping");
    }

    // 3. 复杂度映射（兜底）
    const complexityTier = COMPLEXITY_TIER_MAPPING[complexity.level];
    return this.createSelection(complexityTier, "complexity_fallback");
  }

  /**
   * 获取层级对应的模型
   */
  getModelForTier(tierId: ModelTierId): LanguageModel {
    const tierConfig = this.config[tierId];

    // 按优先级尝试获取可用模型
    for (const provider of tierConfig.providers) {
      const model = aiProviderRouter.getModel(provider.name, provider.model);
      if (model) {
        return model;
      }
    }

    // 降级到标准层
    if (tierId !== "standard") {
      return this.getModelForTier("standard");
    }

    throw new Error("No available model for any tier");
  }

  /**
   * 记录层级使用指标
   */
  recordMetrics(selection: TierSelection, result: ExecutionResult): void {
    this.metricsCollector.record({
      tierId: selection.tierId,
      reason: selection.reason,
      latencyMs: result.latencyMs,
      success: result.success,
      tokenUsage: result.tokenUsage,
      timestamp: Date.now(),
    });
  }
}
```

### 2.3 集成点

#### 2.3.1 与 UnifiedEngine 集成

```typescript
// 修改文件: src/lib/ai-skills/engine/unified-engine.ts

class UnifiedEngine {
  private tierSelector: ModelTierSelector;

  async *execute(
    input: string,
    context: UnifiedContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 1. 路由阶段（使用快速层）
    const routeModel = this.tierSelector.getModelForTier("fast");
    const routeResult = await this.intentRouter.route(input, {
      model: routeModel,
    });

    // 2. 选择执行层级
    const tierSelection = this.tierSelector.selectTier({
      intent: routeResult.intent,
      complexity: routeResult.complexity,
      taskType: this.determineTaskType(routeResult),
    });

    yield this.outputAdapter.createRoutingChunk({
      ...routeResult,
      modelTier: tierSelection.tierId,
      tierReason: tierSelection.reason,
    });

    // 3. 获取对应层级的模型
    const executionModel = this.tierSelector.getModelForTier(
      tierSelection.tierId,
    );

    // 4. 执行（传入选定的模型）
    if (routeResult.mode === "atomic") {
      yield* this.coordinator.executeAtomic(input, context, {
        model: executionModel,
      });
    } else {
      yield* this.coordinator.executeOrchestration(
        routeResult.suggestedSkill!,
        input,
        context,
        { model: executionModel },
      );
    }

    // 5. 记录指标
    this.tierSelector.recordMetrics(tierSelection, executionResult);
  }
}
```

#### 2.3.2 与 KnowledgeAgent 集成

```typescript
// 修改文件: src/lib/ai-agent/core/knowledge-agent.ts

class KnowledgeAgent {
  async *executeWithTier(
    input: string,
    context: AgentContext,
    options: ExecuteOptions & { model?: LanguageModel },
  ): AsyncGenerator<AgentStreamChunk> {
    // 使用传入的模型或默认模型
    const model = options.model ?? this.getDefaultModel();

    // ... 其余执行逻辑保持不变，使用 model 参数
  }
}
```

### 2.4 成本控制

```typescript
// 文件位置: src/lib/ai-providers/cost-controller.ts (新建)

export class CostController {
  private dailyBudget: number; // 每日预算（单位：分）
  private currentUsage: number;

  /**
   * 检查是否允许使用指定层级
   */
  canUseTier(tierId: ModelTierId, estimatedTokens: number): CostCheckResult {
    const tierCost = this.estimateCost(tierId, estimatedTokens);
    const remainingBudget = this.dailyBudget - this.currentUsage;

    if (tierCost <= remainingBudget) {
      return { allowed: true, tierId };
    }

    // 降级到更便宜的层级
    const fallbackTier = this.findAffordableTier(
      remainingBudget,
      estimatedTokens,
    );
    return {
      allowed: true,
      tierId: fallbackTier,
      reason: "budget_constraint",
      originalTier: tierId,
    };
  }

  /**
   * 估算成本
   */
  private estimateCost(tierId: ModelTierId, tokens: number): number {
    const costPerToken = {
      fast: 0.0001, // ¥0.001/1K
      standard: 0.0002, // ¥0.002/1K
      deep: 0.0008, // ¥0.008/1K
    };
    return costPerToken[tierId] * tokens;
  }
}
```

---

## 三、架构改进方案

### 3.1 P0-1: 工具结果增强处理

**问题**: 工具结果直接传递给模型，缺少上下文和可操作信息

**解决方案**: 实现 ToolResultEnhancer

```
┌─────────────────────────────────────────────────────────────┐
│                   工具结果增强流程                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  工具执行 ──→ 原始结果 ──→ [ToolResultEnhancer] ──→ 增强结果 │
│                              │                              │
│                              ├─ 结果摘要生成                │
│                              ├─ 关键信息提取                │
│                              ├─ 错误可操作化                │
│                              └─ 后续建议生成                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3.1.1 实现代码

```typescript
// 文件位置: src/lib/ai-agent/tools/tool-result-enhancer.ts (新建)

export interface EnhancedToolResult<T = unknown> {
  // 原始数据
  success: boolean;
  data?: T;
  error?: string;

  // 增强信息
  summary: string; // 人类可读的结果摘要
  keyInsights: string[]; // 关键发现/信息点

  // 错误增强（仅失败时）
  actionableError?: {
    type: ErrorType; // 参数错误/工具错误/数据错误/权限错误
    message: string; // 清晰的错误描述
    suggestedFix: string; // 建议的修复方法
    canRetry: boolean; // 是否可以重试
    retryParams?: Record<string, unknown>; // 建议的重试参数
  };

  // 后续建议
  followUpSuggestions?: string[]; // 可能的后续操作

  // 元信息
  meta: {
    toolName: string;
    executionTimeMs: number;
    dataCount?: number; // 返回的数据条数
  };
}

export class ToolResultEnhancer {
  private summaryGenerators: Map<string, SummaryGenerator>;
  private errorAnalyzers: Map<string, ErrorAnalyzer>;

  /**
   * 增强工具执行结果
   */
  enhance<T>(
    toolName: string,
    rawResult: ToolResult<T>,
    context: ToolContext,
  ): EnhancedToolResult<T> {
    const startTime = Date.now();

    if (!rawResult.success) {
      return this.enhanceErrorResult(toolName, rawResult, context);
    }

    return this.enhanceSuccessResult(toolName, rawResult, context, startTime);
  }

  /**
   * 增强成功结果
   */
  private enhanceSuccessResult<T>(
    toolName: string,
    rawResult: ToolResult<T>,
    context: ToolContext,
    startTime: number,
  ): EnhancedToolResult<T> {
    const generator =
      this.summaryGenerators.get(toolName) ?? this.defaultSummaryGenerator;

    const summary = generator.generateSummary(rawResult.data, context);
    const keyInsights = generator.extractKeyInsights(rawResult.data, context);
    const followUpSuggestions = this.generateFollowUpSuggestions(
      toolName,
      rawResult.data,
      context,
    );

    return {
      success: true,
      data: rawResult.data,
      summary,
      keyInsights,
      followUpSuggestions,
      meta: {
        toolName,
        executionTimeMs: Date.now() - startTime,
        dataCount: this.countData(rawResult.data),
      },
    };
  }

  /**
   * 增强错误结果
   */
  private enhanceErrorResult<T>(
    toolName: string,
    rawResult: ToolResult<T>,
    context: ToolContext,
  ): EnhancedToolResult<T> {
    const analyzer =
      this.errorAnalyzers.get(toolName) ?? this.defaultErrorAnalyzer;

    const analysis = analyzer.analyze(rawResult.error, context);

    return {
      success: false,
      error: rawResult.error,
      summary: `工具 ${toolName} 执行失败: ${analysis.briefDescription}`,
      keyInsights: [],
      actionableError: {
        type: analysis.errorType,
        message: analysis.userFriendlyMessage,
        suggestedFix: analysis.suggestedFix,
        canRetry: analysis.canRetry,
        retryParams: analysis.retryParams,
      },
      meta: {
        toolName,
        executionTimeMs: 0,
      },
    };
  }
}
```

#### 3.1.2 工具特定摘要生成器

```typescript
// 文件位置: src/lib/ai-agent/tools/summary-generators/bookmark-summary.ts (新建)

export class BookmarkSummaryGenerator implements SummaryGenerator {
  generateSummary(data: BookmarkListResult, context: ToolContext): string {
    const { bookmarks, total } = data;

    if (bookmarks.length === 0) {
      return "未找到符合条件的书签。";
    }

    const platformStats = this.groupByPlatform(bookmarks);
    const timeRange = this.getTimeRange(bookmarks);

    return (
      `找到 ${total} 条书签，` +
      `平台分布: ${this.formatPlatformStats(platformStats)}，` +
      `时间范围: ${timeRange.start} 至 ${timeRange.end}。`
    );
  }

  extractKeyInsights(data: BookmarkListResult, context: ToolContext): string[] {
    const insights: string[] = [];
    const { bookmarks } = data;

    // 平台分析
    const topPlatform = this.getTopPlatform(bookmarks);
    if (topPlatform) {
      insights.push(
        `${topPlatform.name} 平台收藏最多 (${topPlatform.count} 条)`,
      );
    }

    // 时间分析
    const recentCount = this.countRecent(bookmarks, 7);
    if (recentCount > 0) {
      insights.push(`最近 7 天新增 ${recentCount} 条收藏`);
    }

    // 标签分析
    const untaggedCount = bookmarks.filter((b) => !b.tags?.length).length;
    if (untaggedCount > bookmarks.length * 0.3) {
      insights.push(`${untaggedCount} 条书签尚未添加标签，建议整理`);
    }

    return insights;
  }
}
```

#### 3.1.3 与 KnowledgeAgent 集成

```typescript
// 修改文件: src/lib/ai-agent/core/knowledge-agent.ts

class KnowledgeAgent {
  private resultEnhancer: ToolResultEnhancer;

  /**
   * 执行工具并增强结果
   */
  private async executeToolWithEnhancement(
    tool: Tool,
    params: unknown,
    context: AgentContext,
  ): Promise<EnhancedToolResult> {
    const rawResult = await tool.execute(params, context);

    // 增强结果
    const enhanced = this.resultEnhancer.enhance(tool.name, rawResult, {
      ...context,
      params,
    });

    // 记录增强结果用于后续分析
    this.recordToolExecution(tool.name, enhanced);

    return enhanced;
  }

  /**
   * 构建工具结果消息（用于模型）
   */
  private buildToolResultMessage(enhanced: EnhancedToolResult): string {
    if (!enhanced.success) {
      return JSON.stringify({
        success: false,
        error: enhanced.actionableError?.message ?? enhanced.error,
        suggestedFix: enhanced.actionableError?.suggestedFix,
        canRetry: enhanced.actionableError?.canRetry,
      });
    }

    return JSON.stringify({
      success: true,
      summary: enhanced.summary,
      keyInsights: enhanced.keyInsights,
      data: enhanced.data,
      followUpSuggestions: enhanced.followUpSuggestions,
    });
  }
}
```

---

### 3.2 P0-2: 用户级记忆持久化

**问题**: 每次会话都是"失忆"状态，无法利用历史经验

**解决方案**: 实现三层记忆架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     三层记忆架构                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                           │
│  │   短期记忆       │  ← 当前会话，内存存储                       │
│  │   (Working)     │  ← 完整消息历史                            │
│  │   TTL: 会话周期  │  ← 最近上下文                              │
│  └────────┬────────┘                                           │
│           │ 会话结束时压缩                                       │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │   中期记忆       │  ← 用户级持久化，Supabase 存储              │
│  │   (Episodic)    │  ← 会话摘要                                │
│  │   TTL: 30 天     │  ← 重要交互记录                            │
│  └────────┬────────┘                                           │
│           │ 周期性提炼                                          │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │   长期记忆       │  ← 用户偏好和习惯                          │
│  │   (Semantic)    │  ← 知识和技能                              │
│  │   TTL: 永久     │  ← 个性化配置                              │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2.1 数据库 Schema

```sql
-- 文件位置: supabase/migrations/20251226000001_add_ai_memory_tables.sql (新建)

-- 中期记忆：会话摘要
CREATE TABLE ai_session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,

  -- 摘要内容
  summary TEXT NOT NULL,              -- 会话摘要
  key_topics TEXT[] DEFAULT '{}',     -- 主要话题
  tools_used TEXT[] DEFAULT '{}',     -- 使用的工具
  outcomes JSONB DEFAULT '{}',        -- 会话成果

  -- 统计信息
  message_count INTEGER DEFAULT 0,
  tool_call_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,

  -- 时间戳
  session_started_at TIMESTAMPTZ NOT NULL,
  session_ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  CONSTRAINT ai_session_summaries_user_session_unique
    UNIQUE (user_id, session_id)
);

CREATE INDEX idx_ai_session_summaries_user_id
  ON ai_session_summaries(user_id);
CREATE INDEX idx_ai_session_summaries_created_at
  ON ai_session_summaries(created_at DESC);

-- 中期记忆：重要交互
CREATE TABLE ai_important_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,

  -- 交互内容
  interaction_type VARCHAR(50) NOT NULL,  -- query/action/feedback
  user_input TEXT NOT NULL,
  ai_response_summary TEXT NOT NULL,

  -- 重要性评分
  importance_score FLOAT DEFAULT 0.5,
  importance_reason TEXT,

  -- 实体引用
  referenced_bookmarks INTEGER[] DEFAULT '{}',
  referenced_folders INTEGER[] DEFAULT '{}',
  referenced_tags TEXT[] DEFAULT '{}',

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX idx_ai_important_interactions_user_id
  ON ai_important_interactions(user_id);
CREATE INDEX idx_ai_important_interactions_expires_at
  ON ai_important_interactions(expires_at);

-- 长期记忆：用户偏好
CREATE TABLE ai_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 偏好类型
  preference_type VARCHAR(50) NOT NULL,  -- response_style/tool_preference/topic_interest
  preference_key VARCHAR(100) NOT NULL,
  preference_value JSONB NOT NULL,

  -- 置信度
  confidence FLOAT DEFAULT 0.5,
  observation_count INTEGER DEFAULT 1,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT ai_user_preferences_unique
    UNIQUE (user_id, preference_type, preference_key)
);

CREATE INDEX idx_ai_user_preferences_user_id
  ON ai_user_preferences(user_id);

-- RLS 策略
ALTER TABLE ai_session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_important_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own session summaries"
  ON ai_session_summaries FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own important interactions"
  ON ai_important_interactions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences"
  ON ai_user_preferences FOR ALL
  USING (auth.uid() = user_id);
```

#### 3.2.2 持久化记忆管理器

```typescript
// 文件位置: src/lib/ai-memory/persistent-memory-manager.ts (新建)

export class PersistentMemoryManager {
  private supabase: SupabaseClient;
  private workingMemory: Map<string, WorkingMemory>; // session_id -> memory

  /**
   * 获取用户的相关记忆上下文
   */
  async getMemoryContext(
    userId: string,
    input: string,
  ): Promise<MemoryContext> {
    // 1. 获取最近的会话摘要（最近 5 个）
    const recentSessions = await this.getRecentSessionSummaries(userId, 5);

    // 2. 获取相关的重要交互（语义搜索）
    const relevantInteractions = await this.searchRelevantInteractions(
      userId,
      input,
    );

    // 3. 获取用户偏好
    const preferences = await this.getUserPreferences(userId);

    return {
      recentSessions,
      relevantInteractions,
      preferences,
      contextSummary: this.buildContextSummary(
        recentSessions,
        relevantInteractions,
        preferences,
      ),
    };
  }

  /**
   * 会话结束时压缩并持久化
   */
  async persistSessionMemory(
    userId: string,
    sessionId: string,
    workingMemory: WorkingMemory,
  ): Promise<void> {
    // 1. 生成会话摘要
    const summary = await this.generateSessionSummary(workingMemory);

    // 2. 提取重要交互
    const importantInteractions =
      this.extractImportantInteractions(workingMemory);

    // 3. 更新用户偏好
    const preferenceUpdates = this.extractPreferenceUpdates(workingMemory);

    // 4. 持久化
    await Promise.all([
      this.saveSessionSummary(userId, sessionId, summary),
      this.saveImportantInteractions(userId, sessionId, importantInteractions),
      this.updateUserPreferences(userId, preferenceUpdates),
    ]);

    // 5. 清理工作记忆
    this.workingMemory.delete(sessionId);
  }

  /**
   * 生成会话摘要（使用快速层模型）
   */
  private async generateSessionSummary(
    memory: WorkingMemory,
  ): Promise<SessionSummary> {
    const model = this.tierSelector.getModelForTier("fast");

    const prompt = `请总结以下对话的主要内容，提取关键话题和成果：

对话历史：
${this.formatMessagesForSummary(memory.messages)}

请返回 JSON 格式：
{
  "summary": "简洁的会话摘要（100字以内）",
  "keyTopics": ["话题1", "话题2"],
  "outcomes": ["成果1", "成果2"],
  "toolsUsed": ["工具1", "工具2"]
}`;

    const result = await generateText({
      model,
      prompt,
      maxTokens: 500,
    });

    return JSON.parse(result.text);
  }

  /**
   * 提取重要交互
   */
  private extractImportantInteractions(
    memory: WorkingMemory,
  ): ImportantInteraction[] {
    const interactions: ImportantInteraction[] = [];

    for (const message of memory.messages) {
      const importance = this.evaluateImportance(message, memory);

      if (importance.score >= 0.6) {
        interactions.push({
          type: this.getInteractionType(message),
          userInput: message.role === "user" ? message.content : "",
          aiResponseSummary:
            message.role === "assistant"
              ? this.truncate(message.content, 200)
              : "",
          importanceScore: importance.score,
          importanceReason: importance.reason,
        });
      }
    }

    return interactions;
  }

  /**
   * 评估消息重要性
   */
  private evaluateImportance(
    message: CoreMessage,
    memory: WorkingMemory,
  ): ImportanceEvaluation {
    let score = 0.3; // 基础分
    const reasons: string[] = [];

    // 工具调用重要性高
    if (message.role === "assistant" && this.hasToolCall(message)) {
      score += 0.3;
      reasons.push("包含工具调用");
    }

    // 用户反馈重要性高
    if (message.role === "user" && this.isFeedback(message.content)) {
      score += 0.2;
      reasons.push("用户反馈");
    }

    // 长对话中的关键转折点
    if (this.isConversationTurningPoint(message, memory)) {
      score += 0.2;
      reasons.push("对话转折点");
    }

    return { score: Math.min(score, 1), reason: reasons.join(", ") };
  }
}
```

#### 3.2.3 上下文压缩算法

```typescript
// 文件位置: src/lib/ai-memory/context-compressor.ts (新建)

export class ContextCompressor {
  private maxTokens: number;
  private compressionRatio: number;

  /**
   * 压缩消息历史，保留关键信息
   */
  compress(messages: CoreMessage[], targetTokens: number): CompressedContext {
    const currentTokens = this.estimateTokens(messages);

    if (currentTokens <= targetTokens) {
      return { messages, compressed: false };
    }

    // 分层压缩策略
    const compressed = this.applyCompressionStrategies(messages, targetTokens);

    return {
      messages: compressed.messages,
      compressed: true,
      originalTokens: currentTokens,
      compressedTokens: this.estimateTokens(compressed.messages),
      droppedInfo: compressed.droppedInfo,
    };
  }

  /**
   * 分层压缩策略
   */
  private applyCompressionStrategies(
    messages: CoreMessage[],
    targetTokens: number,
  ): CompressionResult {
    let current = [...messages];
    const droppedInfo: string[] = [];

    // 策略 1: 移除中间的闲聊消息
    if (this.estimateTokens(current) > targetTokens) {
      const filtered = this.removeChitchat(current);
      droppedInfo.push(`移除 ${current.length - filtered.length} 条闲聊消息`);
      current = filtered;
    }

    // 策略 2: 压缩长消息
    if (this.estimateTokens(current) > targetTokens) {
      current = this.truncateLongMessages(current, 500);
      droppedInfo.push("长消息已截断");
    }

    // 策略 3: 摘要早期对话
    if (this.estimateTokens(current) > targetTokens) {
      const { summary, remaining } = this.summarizeEarlyMessages(current);
      current = [
        { role: "system", content: `[早期对话摘要] ${summary}` },
        ...remaining,
      ];
      droppedInfo.push("早期对话已摘要");
    }

    // 策略 4: 保留关键消息（最后手段）
    if (this.estimateTokens(current) > targetTokens) {
      current = this.keepEssentialMessages(current, targetTokens);
      droppedInfo.push("仅保留关键消息");
    }

    return { messages: current, droppedInfo };
  }

  /**
   * 摘要早期消息
   */
  private summarizeEarlyMessages(messages: CoreMessage[]): {
    summary: string;
    remaining: CoreMessage[];
  } {
    // 保留最近 10 条消息
    const keepCount = 10;
    const toSummarize = messages.slice(0, -keepCount);
    const remaining = messages.slice(-keepCount);

    // 生成摘要
    const summary = this.generateQuickSummary(toSummarize);

    return { summary, remaining };
  }

  /**
   * 快速生成摘要（不调用 LLM，基于规则）
   */
  private generateQuickSummary(messages: CoreMessage[]): string {
    const topics = new Set<string>();
    const actions = new Set<string>();

    for (const msg of messages) {
      // 提取话题
      const topicMatches = msg.content.match(/关于|查询|搜索|整理|分析/g);
      topicMatches?.forEach((t) => topics.add(t));

      // 提取操作
      if (msg.role === "assistant" && msg.content.includes("已")) {
        const actionMatches = msg.content.match(/已[^，。]+/g);
        actionMatches?.forEach((a) => actions.add(a));
      }
    }

    return (
      `讨论了 ${[...topics].join("、")} 等话题，` +
      `执行了 ${[...actions].slice(0, 3).join("、")} 等操作。`
    );
  }
}
```

#### 3.2.4 与 UnifiedEngine 集成

```typescript
// 修改文件: src/lib/ai-skills/engine/unified-engine.ts

class UnifiedEngine {
  private persistentMemory: PersistentMemoryManager;
  private contextCompressor: ContextCompressor;

  async *execute(
    input: string,
    context: UnifiedContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 1. 获取持久化记忆上下文
    const memoryContext = await this.persistentMemory.getMemoryContext(
      context.userId,
      input,
    );

    // 2. 构建增强的系统提示词
    const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(
      context,
      memoryContext,
    );

    // 3. 压缩当前会话上下文
    const compressedContext = this.contextCompressor.compress(
      context.messageHistory ?? [],
      this.maxContextTokens - this.estimateTokens(enhancedSystemPrompt),
    );

    // ... 执行逻辑

    // 4. 会话结束时持久化
    if (context.sessionEnding) {
      await this.persistentMemory.persistSessionMemory(
        context.userId,
        context.conversationId,
        this.getCurrentWorkingMemory(context.conversationId),
      );
    }
  }

  /**
   * 构建增强的系统提示词
   */
  private buildEnhancedSystemPrompt(
    context: UnifiedContext,
    memoryContext: MemoryContext,
  ): string {
    const basePrompt = this.getBaseSystemPrompt();

    const memorySection = `
## 用户记忆上下文

### 最近会话摘要
${memoryContext.recentSessions.map((s) => `- ${s.summary}`).join("\n")}

### 相关历史交互
${memoryContext.relevantInteractions
  .map((i) => `- ${i.userInput} → ${i.aiResponseSummary}`)
  .join("\n")}

### 用户偏好
${this.formatPreferences(memoryContext.preferences)}
`;

    return basePrompt + memorySection;
  }
}
```

---

### 3.3 P1-1: 工具调用规划机制（ReAct 模式）

**问题**: 完全依赖模型的自主决策，缺少"思考"步骤

**解决方案**: 实现 ReAct（Reasoning + Acting）循环

```
┌─────────────────────────────────────────────────────────────────┐
│                     ReAct 执行循环                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户输入                                                        │
│      │                                                          │
│      ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ THINK: 分析任务，规划工具调用                              │   │
│  │ - 需要什么信息？                                          │   │
│  │ - 应该调用哪些工具？                                       │   │
│  │ - 调用顺序是什么？                                         │   │
│  │ - 参数是否合理？                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│      │                                                          │
│      ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ACT: 执行工具调用                                          │   │
│  │ - 执行计划中的下一个工具                                    │   │
│  │ - 收集执行结果                                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│      │                                                          │
│      ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ OBSERVE: 观察结果                                          │   │
│  │ - 工具执行是否成功？                                        │   │
│  │ - 结果是否符合预期？                                        │   │
│  │ - 是否需要调整计划？                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│      │                                                          │
│      ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ REFLECT: 反思并决定下一步                                   │   │
│  │ - 任务是否完成？ → 是 → 生成最终回复                        │   │
│  │ - 是否需要更多信息？ → 是 → 回到 THINK                      │   │
│  │ - 是否需要调整策略？ → 是 → 更新计划                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.3.1 ReAct 执行器

```typescript
// 文件位置: src/lib/ai-agent/react/react-executor.ts (新建)

export interface ReActStep {
  type: "think" | "act" | "observe" | "reflect";
  content: string;
  toolCall?: ToolCallPlan;
  observation?: EnhancedToolResult;
  reflection?: ReflectionResult;
}

export interface ToolCallPlan {
  toolName: string;
  params: Record<string, unknown>;
  purpose: string; // 为什么要调用这个工具
  expectedOutcome: string; // 期望的结果
  fallbackPlan?: string; // 失败时的备选方案
}

export class ReActExecutor {
  private model: LanguageModel;
  private tools: Map<string, Tool>;
  private resultEnhancer: ToolResultEnhancer;
  private maxIterations: number = 5;

  /**
   * 执行 ReAct 循环
   */
  async *execute(
    input: string,
    context: AgentContext,
  ): AsyncGenerator<ReActStreamChunk> {
    const steps: ReActStep[] = [];
    let iteration = 0;
    let isComplete = false;

    while (!isComplete && iteration < this.maxIterations) {
      iteration++;

      // THINK: 规划阶段
      const thinkResult = await this.think(input, steps, context);
      steps.push({ type: "think", content: thinkResult.reasoning });
      yield { type: "thinking", content: thinkResult.reasoning };

      if (thinkResult.shouldRespond) {
        // 任务完成，生成最终回复
        isComplete = true;
        yield* this.generateFinalResponse(input, steps, context);
        break;
      }

      // ACT: 执行工具调用
      for (const toolPlan of thinkResult.toolCalls) {
        yield {
          type: "acting",
          toolName: toolPlan.toolName,
          purpose: toolPlan.purpose,
        };

        const actResult = await this.act(toolPlan, context);
        steps.push({
          type: "act",
          content: `调用 ${toolPlan.toolName}`,
          toolCall: toolPlan,
        });

        // OBSERVE: 观察结果
        const observation = this.resultEnhancer.enhance(
          toolPlan.toolName,
          actResult,
          context,
        );
        steps.push({
          type: "observe",
          content: observation.summary,
          observation,
        });
        yield { type: "observing", observation };

        // REFLECT: 反思
        const reflection = await this.reflect(
          toolPlan,
          observation,
          steps,
          context,
        );
        steps.push({
          type: "reflect",
          content: reflection.assessment,
          reflection,
        });
        yield { type: "reflecting", reflection };

        // 根据反思结果决定下一步
        if (reflection.shouldAdjustPlan) {
          // 需要调整计划，跳出工具调用循环，重新思考
          break;
        }

        if (reflection.taskComplete) {
          isComplete = true;
          break;
        }
      }
    }

    // 达到最大迭代次数
    if (!isComplete) {
      yield* this.generatePartialResponse(input, steps, context);
    }
  }

  /**
   * THINK: 规划工具调用
   */
  private async think(
    input: string,
    previousSteps: ReActStep[],
    context: AgentContext,
  ): Promise<ThinkResult> {
    const prompt = this.buildThinkPrompt(input, previousSteps, context);

    const result = await generateObject({
      model: this.model,
      schema: thinkResultSchema,
      prompt,
    });

    return result.object;
  }

  /**
   * 构建思考提示词
   */
  private buildThinkPrompt(
    input: string,
    previousSteps: ReActStep[],
    context: AgentContext,
  ): string {
    const stepHistory =
      previousSteps.length > 0
        ? this.formatStepHistory(previousSteps)
        : "这是对话的开始，还没有执行过任何步骤。";

    return `你是一个智能助手，需要通过工具调用来帮助用户。请仔细思考后决定下一步行动。

## 用户请求
${input}

## 已执行的步骤
${stepHistory}

## 可用工具
${this.formatAvailableTools()}

## 你的任务
1. 分析用户请求和已执行的步骤
2. 判断是否已经有足够的信息回复用户
3. 如果需要更多信息，规划下一步的工具调用

请返回 JSON 格式：
{
  "reasoning": "你的思考过程（简洁明了）",
  "shouldRespond": true/false,  // 是否可以直接回复用户
  "toolCalls": [  // 如果 shouldRespond 为 false，列出需要调用的工具
    {
      "toolName": "工具名称",
      "params": { ... },
      "purpose": "为什么要调用这个工具",
      "expectedOutcome": "期望得到什么结果",
      "fallbackPlan": "如果失败，备选方案是什么"
    }
  ]
}`;
  }

  /**
   * ACT: 执行工具调用
   */
  private async act(
    plan: ToolCallPlan,
    context: AgentContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(plan.toolName);

    if (!tool) {
      return {
        success: false,
        error: `工具 ${plan.toolName} 不存在`,
      };
    }

    try {
      return await tool.execute(plan.params, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }

  /**
   * REFLECT: 反思工具调用结果
   */
  private async reflect(
    plan: ToolCallPlan,
    observation: EnhancedToolResult,
    steps: ReActStep[],
    context: AgentContext,
  ): Promise<ReflectionResult> {
    const prompt = this.buildReflectPrompt(plan, observation, steps);

    const result = await generateObject({
      model: this.model,
      schema: reflectionResultSchema,
      prompt,
    });

    return result.object;
  }

  /**
   * 构建反思提示词
   */
  private buildReflectPrompt(
    plan: ToolCallPlan,
    observation: EnhancedToolResult,
    steps: ReActStep[],
  ): string {
    return `请评估工具调用的结果，并决定下一步行动。

## 调用计划
- 工具: ${plan.toolName}
- 目的: ${plan.purpose}
- 期望结果: ${plan.expectedOutcome}

## 实际结果
- 成功: ${observation.success}
- 摘要: ${observation.summary}
- 关键发现: ${observation.keyInsights.join(", ")}
${observation.actionableError ? `- 错误: ${observation.actionableError.message}` : ""}

## 已完成的步骤
${this.formatStepHistory(steps)}

请返回 JSON 格式：
{
  "assessment": "对结果的评估（简洁）",
  "resultMatchesExpectation": true/false,
  "taskComplete": true/false,  // 任务是否已完成
  "shouldAdjustPlan": true/false,  // 是否需要调整后续计划
  "adjustmentReason": "调整原因（如果需要调整）",
  "nextStepSuggestion": "下一步建议（如果任务未完成）"
}`;
  }
}
```

#### 3.3.2 与 KnowledgeAgent 集成

```typescript
// 修改文件: src/lib/ai-agent/core/knowledge-agent.ts

class KnowledgeAgent {
  private reactExecutor: ReActExecutor;
  private useReActMode: boolean = true; // 可配置

  /**
   * 执行请求
   */
  async *execute(
    input: string,
    context: AgentContext,
    options: ExecuteOptions,
  ): AsyncGenerator<AgentStreamChunk> {
    // 判断是否使用 ReAct 模式
    if (this.shouldUseReActMode(input, context, options)) {
      yield* this.executeWithReAct(input, context, options);
    } else {
      yield* this.executeStandard(input, context, options);
    }
  }

  /**
   * 判断是否应该使用 ReAct 模式
   */
  private shouldUseReActMode(
    input: string,
    context: AgentContext,
    options: ExecuteOptions,
  ): boolean {
    // 强制禁用
    if (options.disableReAct) return false;

    // 简单查询不需要 ReAct
    if (this.isSimpleQuery(input)) return false;

    // 可能需要多步骤工具调用的场景启用 ReAct
    return this.mightNeedMultipleTools(input);
  }

  /**
   * 使用 ReAct 模式执行
   */
  private async *executeWithReAct(
    input: string,
    context: AgentContext,
    options: ExecuteOptions,
  ): AsyncGenerator<AgentStreamChunk> {
    for await (const chunk of this.reactExecutor.execute(input, context)) {
      // 转换 ReAct 块为 Agent 块
      yield this.convertReActChunk(chunk);
    }
  }
}
```

---

### 3.4 P1-2: 智能错误恢复

**问题**: 失败后直接放弃，不尝试修复

**解决方案**: 实现智能错误分析和恢复策略

```typescript
// 文件位置: src/lib/ai-agent/error/error-recovery-handler.ts (新建)

export interface ErrorAnalysis {
  type: ErrorType;
  severity: "low" | "medium" | "high" | "critical";
  isRecoverable: boolean;
  suggestedStrategies: RecoveryStrategy[];
  userMessage: string;
}

export type ErrorType =
  | "param_invalid" // 参数错误
  | "param_missing" // 参数缺失
  | "tool_not_found" // 工具不存在
  | "tool_timeout" // 工具超时
  | "tool_rate_limit" // 限流
  | "data_not_found" // 数据不存在
  | "permission_denied" // 权限不足
  | "network_error" // 网络错误
  | "model_error" // 模型错误
  | "unknown"; // 未知错误

export type RecoveryStrategy =
  | { type: "retry"; delay: number; maxAttempts: number }
  | { type: "adjust_params"; adjustedParams: Record<string, unknown> }
  | {
      type: "alternative_tool";
      toolName: string;
      params: Record<string, unknown>;
    }
  | { type: "simplify_request"; simplifiedInput: string }
  | { type: "escalate_to_user"; question: string }
  | { type: "graceful_degrade"; fallbackResponse: string };

export class ErrorRecoveryHandler {
  private errorPatterns: ErrorPattern[];
  private recoveryStrategies: Map<ErrorType, RecoveryStrategy[]>;

  /**
   * 分析错误并生成恢复策略
   */
  analyzeError(error: Error | string, context: ErrorContext): ErrorAnalysis {
    const errorMessage = typeof error === "string" ? error : error.message;

    // 1. 识别错误类型
    const errorType = this.identifyErrorType(errorMessage, context);

    // 2. 评估严重程度
    const severity = this.evaluateSeverity(errorType, context);

    // 3. 判断是否可恢复
    const isRecoverable = this.isRecoverable(errorType, severity, context);

    // 4. 生成恢复策略
    const strategies = isRecoverable
      ? this.generateRecoveryStrategies(errorType, context)
      : [];

    // 5. 生成用户友好的错误信息
    const userMessage = this.generateUserMessage(
      errorType,
      errorMessage,
      strategies,
    );

    return {
      type: errorType,
      severity,
      isRecoverable,
      suggestedStrategies: strategies,
      userMessage,
    };
  }

  /**
   * 执行恢复策略
   */
  async *executeRecovery(
    analysis: ErrorAnalysis,
    context: ErrorContext,
  ): AsyncGenerator<RecoveryResult> {
    for (const strategy of analysis.suggestedStrategies) {
      yield { type: "attempting", strategy };

      try {
        const result = await this.executeStrategy(strategy, context);

        if (result.success) {
          yield { type: "recovered", strategy, result };
          return;
        }

        yield { type: "failed", strategy, error: result.error };
      } catch (e) {
        yield { type: "failed", strategy, error: e };
      }
    }

    // 所有策略都失败
    yield { type: "exhausted", fallbackMessage: analysis.userMessage };
  }

  /**
   * 执行单个恢复策略
   */
  private async executeStrategy(
    strategy: RecoveryStrategy,
    context: ErrorContext,
  ): Promise<StrategyResult> {
    switch (strategy.type) {
      case "retry":
        return this.executeRetry(strategy, context);

      case "adjust_params":
        return this.executeWithAdjustedParams(strategy, context);

      case "alternative_tool":
        return this.executeAlternativeTool(strategy, context);

      case "simplify_request":
        return this.executeSimplifiedRequest(strategy, context);

      case "escalate_to_user":
        return this.escalateToUser(strategy, context);

      case "graceful_degrade":
        return { success: true, response: strategy.fallbackResponse };
    }
  }

  /**
   * 生成恢复策略
   */
  private generateRecoveryStrategies(
    errorType: ErrorType,
    context: ErrorContext,
  ): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];

    switch (errorType) {
      case "param_invalid":
        // 尝试调整参数
        const adjustedParams = this.suggestParamAdjustments(context);
        if (adjustedParams) {
          strategies.push({ type: "adjust_params", adjustedParams });
        }
        // 尝试简化请求
        strategies.push({
          type: "simplify_request",
          simplifiedInput: this.simplifyRequest(context.originalInput),
        });
        break;

      case "tool_timeout":
        // 重试（增加延迟）
        strategies.push({ type: "retry", delay: 2000, maxAttempts: 2 });
        // 尝试替代工具
        const alternative = this.findAlternativeTool(context.toolName);
        if (alternative) {
          strategies.push({
            type: "alternative_tool",
            toolName: alternative.name,
            params: this.adaptParams(context.params, alternative),
          });
        }
        break;

      case "data_not_found":
        // 询问用户
        strategies.push({
          type: "escalate_to_user",
          question: "没有找到符合条件的数据，您是否要调整搜索条件？",
        });
        // 优雅降级
        strategies.push({
          type: "graceful_degrade",
          fallbackResponse:
            "抱歉，没有找到符合条件的数据。您可以尝试放宽条件或换个关键词。",
        });
        break;

      case "tool_rate_limit":
        // 等待后重试
        strategies.push({ type: "retry", delay: 5000, maxAttempts: 3 });
        break;

      default:
        // 默认：优雅降级
        strategies.push({
          type: "graceful_degrade",
          fallbackResponse: "抱歉，处理请求时遇到问题。请稍后再试。",
        });
    }

    return strategies;
  }
}
```

---

### 3.5 P1-3: 反馈闭环机制

**问题**: 反馈数据收集了但未用于改进

**解决方案**: 实现反馈驱动的持续优化系统

```typescript
// 文件位置: src/lib/ai-feedback/feedback-loop-system.ts (新建)

export class FeedbackLoopSystem {
  private feedbackStore: FeedbackStore;
  private optimizationEngine: OptimizationEngine;
  private analysisScheduler: AnalysisScheduler;

  /**
   * 处理用户反馈
   */
  async processFeedback(feedback: UserFeedback): Promise<void> {
    // 1. 存储反馈
    await this.feedbackStore.save(feedback);

    // 2. 实时分析（如果是严重问题）
    if (feedback.type === "negative" && feedback.severity >= 0.8) {
      await this.triggerImmediateAnalysis(feedback);
    }

    // 3. 更新统计
    await this.updateFeedbackStats(feedback);
  }

  /**
   * 定期分析反馈并生成优化建议
   */
  async runPeriodicAnalysis(): Promise<OptimizationReport> {
    // 1. 收集最近的反馈数据
    const recentFeedback = await this.feedbackStore.getRecent(
      7 * 24 * 60 * 60 * 1000,
    );

    // 2. 分析反馈模式
    const patterns = this.analyzePatterns(recentFeedback);

    // 3. 生成优化建议
    const suggestions = await this.generateOptimizationSuggestions(patterns);

    // 4. 应用自动优化（如果启用）
    const appliedOptimizations = await this.applyAutoOptimizations(suggestions);

    return {
      analyzedFeedbackCount: recentFeedback.length,
      patterns,
      suggestions,
      appliedOptimizations,
    };
  }

  /**
   * 分析反馈模式
   */
  private analyzePatterns(feedback: UserFeedback[]): FeedbackPattern[] {
    const patterns: FeedbackPattern[] = [];

    // 按意图类型分组分析
    const byIntent = this.groupByIntent(feedback);
    for (const [intent, feedbacks] of byIntent) {
      const negativeRate = this.calculateNegativeRate(feedbacks);
      if (negativeRate > 0.3) {
        patterns.push({
          type: "high_negative_rate",
          intent,
          negativeRate,
          commonReasons: this.extractCommonReasons(feedbacks),
          suggestion: `意图 ${intent} 的负面反馈率较高 (${(negativeRate * 100).toFixed(1)}%)`,
        });
      }
    }

    // 按工具分组分析
    const byTool = this.groupByTool(feedback);
    for (const [tool, feedbacks] of byTool) {
      const failureRate = this.calculateFailureRate(feedbacks);
      if (failureRate > 0.2) {
        patterns.push({
          type: "tool_failure",
          tool,
          failureRate,
          commonErrors: this.extractCommonErrors(feedbacks),
          suggestion: `工具 ${tool} 的失败率较高 (${(failureRate * 100).toFixed(1)}%)`,
        });
      }
    }

    // 分析错误恢复效果
    const recoveryFeedback = feedback.filter(
      (f) => f.context?.recoveryAttempted,
    );
    const recoverySuccess = this.calculateRecoverySuccessRate(recoveryFeedback);
    if (recoverySuccess < 0.5) {
      patterns.push({
        type: "low_recovery_rate",
        recoverySuccessRate: recoverySuccess,
        suggestion: "错误恢复成功率较低，需要优化恢复策略",
      });
    }

    return patterns;
  }

  /**
   * 生成优化建议
   */
  private async generateOptimizationSuggestions(
    patterns: FeedbackPattern[],
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    for (const pattern of patterns) {
      switch (pattern.type) {
        case "high_negative_rate":
          suggestions.push({
            type: "intent_rule_adjustment",
            target: pattern.intent,
            action: "review_and_adjust_rules",
            priority: pattern.negativeRate > 0.5 ? "high" : "medium",
            details: {
              currentRules: await this.getIntentRules(pattern.intent),
              suggestedChanges: this.suggestRuleChanges(pattern),
            },
          });
          break;

        case "tool_failure":
          suggestions.push({
            type: "tool_description_improvement",
            target: pattern.tool,
            action: "enhance_tool_description",
            priority: pattern.failureRate > 0.4 ? "high" : "medium",
            details: {
              currentDescription: await this.getToolDescription(pattern.tool),
              suggestedDescription: this.generateImprovedDescription(pattern),
            },
          });
          break;

        case "low_recovery_rate":
          suggestions.push({
            type: "recovery_strategy_update",
            target: "error_recovery",
            action: "add_new_strategies",
            priority: "high",
            details: {
              currentStrategies: this.getCurrentRecoveryStrategies(),
              suggestedStrategies: this.suggestNewStrategies(pattern),
            },
          });
          break;
      }
    }

    return suggestions;
  }

  /**
   * 应用自动优化
   */
  private async applyAutoOptimizations(
    suggestions: OptimizationSuggestion[],
  ): Promise<AppliedOptimization[]> {
    const applied: AppliedOptimization[] = [];

    for (const suggestion of suggestions) {
      // 只自动应用低风险优化
      if (suggestion.priority !== "high" && this.isLowRisk(suggestion)) {
        try {
          await this.optimizationEngine.apply(suggestion);
          applied.push({
            suggestion,
            appliedAt: new Date(),
            status: "success",
          });
        } catch (error) {
          applied.push({
            suggestion,
            appliedAt: new Date(),
            status: "failed",
            error: error instanceof Error ? error.message : "未知错误",
          });
        }
      }
    }

    return applied;
  }
}
```

---

## 四、实施路线图

### 4.1 阶段划分

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           实施路线图                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 1 (Week 1-2): 基础设施                                           │
│  ├─ 模型分层配置                                                        │
│  ├─ 工具结果增强框架                                                    │
│  └─ 单元测试覆盖                                                        │
│                                                                         │
│  Phase 2 (Week 3-4): 核心能力                                           │
│  ├─ 用户级记忆持久化                                                    │
│  ├─ 上下文压缩算法                                                      │
│  └─ 集成测试                                                            │
│                                                                         │
│  Phase 3 (Week 5-6): 智能增强                                           │
│  ├─ ReAct 执行器                                                        │
│  ├─ 智能错误恢复                                                        │
│  └─ E2E 测试                                                            │
│                                                                         │
│  Phase 4 (Week 7-8): 闭环优化                                           │
│  ├─ 反馈闭环系统                                                        │
│  ├─ 性能优化                                                            │
│  └─ 生产验证                                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 详细任务清单

#### Phase 1: 基础设施 (Week 1-2)

| 任务                              | 优先级 | 预计工时 | 依赖     |
| --------------------------------- | ------ | -------- | -------- |
| 1.1 创建 model-tier-config.ts     | P0     | 4h       | -        |
| 1.2 实现 ModelTierSelector        | P0     | 8h       | 1.1      |
| 1.3 实现 CostController           | P1     | 4h       | 1.1      |
| 1.4 创建 ToolResultEnhancer 框架  | P0     | 8h       | -        |
| 1.5 实现 BookmarkSummaryGenerator | P0     | 4h       | 1.4      |
| 1.6 实现错误分析器                | P0     | 4h       | 1.4      |
| 1.7 集成到 KnowledgeAgent         | P0     | 8h       | 1.2, 1.4 |
| 1.8 单元测试                      | P0     | 8h       | 1.1-1.7  |

**里程碑**: 模型分层和工具结果增强基础功能可用

#### Phase 2: 核心能力 (Week 3-4)

| 任务                             | 优先级 | 预计工时 | 依赖     |
| -------------------------------- | ------ | -------- | -------- |
| 2.1 数据库迁移（记忆表）         | P0     | 4h       | -        |
| 2.2 实现 PersistentMemoryManager | P0     | 16h      | 2.1      |
| 2.3 实现 ContextCompressor       | P0     | 8h       | -        |
| 2.4 会话摘要生成器               | P1     | 8h       | 2.2      |
| 2.5 集成到 UnifiedEngine         | P0     | 8h       | 2.2, 2.3 |
| 2.6 集成测试                     | P0     | 8h       | 2.1-2.5  |

**里程碑**: 用户级记忆持久化功能上线

#### Phase 3: 智能增强 (Week 5-6)

| 任务                                 | 优先级 | 预计工时 | 依赖     |
| ------------------------------------ | ------ | -------- | -------- |
| 3.1 实现 ReActExecutor               | P0     | 16h      | Phase 1  |
| 3.2 Think/Act/Observe/Reflect 提示词 | P0     | 8h       | 3.1      |
| 3.3 实现 ErrorRecoveryHandler        | P1     | 12h      | Phase 1  |
| 3.4 恢复策略库                       | P1     | 8h       | 3.3      |
| 3.5 集成到 KnowledgeAgent            | P0     | 8h       | 3.1, 3.3 |
| 3.6 E2E 测试                         | P0     | 8h       | 3.1-3.5  |

**里程碑**: ReAct 模式和智能错误恢复上线

#### Phase 4: 闭环优化 (Week 7-8)

| 任务                        | 优先级 | 预计工时 | 依赖      |
| --------------------------- | ------ | -------- | --------- |
| 4.1 实现 FeedbackLoopSystem | P1     | 12h      | -         |
| 4.2 反馈分析算法            | P1     | 8h       | 4.1       |
| 4.3 自动优化引擎            | P2     | 8h       | 4.2       |
| 4.4 性能优化和监控          | P1     | 8h       | Phase 1-3 |
| 4.5 A/B 测试框架            | P2     | 8h       | -         |
| 4.6 生产验证和调优          | P0     | 16h      | 4.1-4.5   |

**里程碑**: 完整的 AI 能力升级交付

### 4.3 关键决策点

| 阶段    | 决策点                     | 选项                            | 建议                          |
| ------- | -------------------------- | ------------------------------- | ----------------------------- |
| Phase 1 | DeepSeek Reasoner 是否引入 | A: 立即引入 B: 观察后引入       | B: 先完成架构改进，再评估     |
| Phase 2 | 记忆存储方案               | A: Supabase B: Redis C: 混合    | A: 与现有架构一致             |
| Phase 3 | ReAct 默认启用             | A: 全量启用 B: 灰度 C: 手动触发 | B: 先灰度验证效果             |
| Phase 4 | 自动优化范围               | A: 全自动 B: 半自动 C: 仅建议   | B: 低风险自动，高风险人工确认 |

---

## 五、风险评估

### 5.1 技术风险

| 风险                       | 可能性 | 影响 | 缓解措施                 |
| -------------------------- | ------ | ---- | ------------------------ |
| DeepSeek Reasoner 延迟过高 | 中     | 中   | 仅用于复杂任务，设置超时 |
| 记忆系统存储成本增加       | 低     | 低   | 设置 TTL，定期清理       |
| ReAct 模式增加 Token 消耗  | 高     | 中   | 优化提示词，限制迭代次数 |
| 上下文压缩丢失关键信息     | 中     | 高   | 重要性评估 + 用户可恢复  |

### 5.2 业务风险

| 风险                   | 可能性 | 影响 | 缓解措施                |
| ---------------------- | ------ | ---- | ----------------------- |
| 用户不适应新交互模式   | 中     | 中   | 渐进式推出，保留旧模式  |
| AI 成本超预算          | 中     | 高   | CostController 实时监控 |
| 复杂度增加导致维护困难 | 中     | 中   | 完善文档，模块化设计    |

### 5.3 回滚计划

```typescript
// 每个功能都有独立的开关
const FEATURE_FLAGS = {
  MODEL_TIERING: "ai_model_tiering",
  TOOL_RESULT_ENHANCEMENT: "ai_tool_result_enhancement",
  PERSISTENT_MEMORY: "ai_persistent_memory",
  REACT_MODE: "ai_react_mode",
  ERROR_RECOVERY: "ai_error_recovery",
  FEEDBACK_LOOP: "ai_feedback_loop",
};

// 可随时禁用单个功能，回滚到原有行为
```

---

## 六、验收标准

### 6.1 功能验收

| 功能         | 验收标准                           |
| ------------ | ---------------------------------- |
| 模型分层     | 简单查询 <2s，复杂任务使用深度模型 |
| 工具结果增强 | 所有工具结果包含摘要和关键信息     |
| 记忆持久化   | 跨会话保持用户偏好和历史           |
| ReAct 模式   | 复杂任务展示思考过程               |
| 错误恢复     | 至少 60% 的可恢复错误成功恢复      |
| 反馈闭环     | 定期生成优化报告                   |

### 6.2 性能指标

| 指标              | 当前 | 目标  |
| ----------------- | ---- | ----- |
| 简单查询 P95 延迟 | ~3s  | <2s   |
| 复杂任务成功率    | ~50% | >80%  |
| 工具调用成功率    | ~75% | >90%  |
| 错误恢复成功率    | ~20% | >60%  |
| Token 消耗        | 基准 | <+30% |

### 6.3 质量标准

| 标准           | 要求              |
| -------------- | ----------------- |
| 单元测试覆盖率 | >80%              |
| 集成测试       | 所有核心流程      |
| E2E 测试       | 关键用户场景      |
| 文档           | API + 架构 + 运维 |
| 代码审查       | 所有 PR 必须审查  |

---

## 附录

### A. 文件清单

| 文件路径                                                      | 状态 | 说明           |
| ------------------------------------------------------------- | ---- | -------------- |
| `src/lib/ai-providers/model-tier-config.ts`                   | 新建 | 模型分层配置   |
| `src/lib/ai-providers/tier-selector.ts`                       | 新建 | 层级选择器     |
| `src/lib/ai-providers/cost-controller.ts`                     | 新建 | 成本控制器     |
| `src/lib/ai-agent/tools/tool-result-enhancer.ts`              | 新建 | 工具结果增强   |
| `src/lib/ai-memory/persistent-memory-manager.ts`              | 新建 | 持久化记忆管理 |
| `src/lib/ai-memory/context-compressor.ts`                     | 新建 | 上下文压缩     |
| `src/lib/ai-agent/react/react-executor.ts`                    | 新建 | ReAct 执行器   |
| `src/lib/ai-agent/error/error-recovery-handler.ts`            | 新建 | 错误恢复处理   |
| `src/lib/ai-feedback/feedback-loop-system.ts`                 | 新建 | 反馈闭环系统   |
| `supabase/migrations/20251226000001_add_ai_memory_tables.sql` | 新建 | 数据库迁移     |

### B. 参考资料

1. [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)
2. [DeepSeek API Documentation](https://platform.deepseek.com/api-docs)
3. [阿里百炼云 DashScope API](https://help.aliyun.com/zh/model-studio/)
4. [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)

---

_文档版本: 1.0.0_
_创建日期: 2025-12-26_
_作者: Claude (AI Assistant)_
_状态: 待审核_
