# AnyKeep AI 能力升级计划 V4.3

> **版本**: 4.3.1
> **日期**: 2025-12-26
> **状态**: 待审核
> **核心理念**: 单体增强架构 (Single-Agent with Enhanced Context)
> **更新说明**: 整合 v1 方案中的模型分层策略和智能错误恢复

---

## 一、升级概述

### 1.1 设计哲学

> **与其增加更多的"脑子"（Multi-Agent），不如给唯一的脑子装上更好的"眼镜"和"记事本"。**

本次升级摒弃重型多智能体架构，采用**轻量化单体增强**策略：

| 维度 | 重型方案（不采用） | 轻量化方案（采用）                 |
| ---- | ------------------ | ---------------------------------- |
| 大脑 | 多 Agent 协作      | 单 Agent + 结构化输出              |
| 模型 | 统一模型           | **分层模型策略**（快速/标准/深度） |
| 记忆 | 向量数据库 (RAG)   | KV Profile (Supabase JSON)         |
| 感知 | Agent 自主查询环境 | System Prompt 预注入               |
| 规划 | 复杂 ReAct 循环    | 轻量版思维模式 + reasoning 参数    |
| 错误 | 简单回退           | **智能错误恢复**（分析 + 策略）    |

### 1.2 预期收益

| 指标             | 当前基线 | 目标值 | 提升幅度 |
| ---------------- | -------- | ------ | -------- |
| 简单问题响应速度 | 2-3秒    | <1秒   | 60%+ ↓   |
| 工具选择准确率   | ~70%     | 90%+   | 30%+ ↑   |
| 多步骤任务成功率 | ~50%     | 80%+   | 60%+ ↑   |
| 错误自动恢复率   | ~10%     | 50%+   | 400%+ ↑  |
| 用户感知"智能度" | 一般     | 优秀   | 质变     |

### 1.3 升级模块总览

```
┌─────────────────────────────────────────────────────────────┐
│                    AI 能力升级 V4.3.1                        │
├─────────────────────────────────────────────────────────────┤
│  P0 - 立即执行（本周）                                       │
│  ├── 1. 动态 System Prompt（上下文预注入）      [1天]        │
│  ├── 2. 模型分层策略（快速/标准/深度）          [1天] ⭐新增  │
│  ├── 3. 工具结果增强器                          [2天] ✅进行中│
│  └── 4. 工具描述模板化                          [1天] ✅进行中│
├─────────────────────────────────────────────────────────────┤
│  P1 - 本迭代完成（下周）                                     │
│  ├── 5. 轻量版 ReAct 思维模式                   [1天]        │
│  ├── 6. 智能错误恢复                            [1天] ⭐新增  │
│  └── 7. reasoning 参数（隐式思考链）            [0.5天]      │
├─────────────────────────────────────────────────────────────┤
│  P2 - 下迭代规划                                             │
│  ├── 8. 用户画像持久化                          [2天]        │
│  ├── 9. 偏好自动学习                            [3天]        │
│  └── 10. 成本控制器                             [1天]        │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、模块 1：动态 System Prompt（上下文预注入）

### 2.1 问题现状

当前 System Prompt 是**静态**的，模型不知道：

- 现在几点（用户可能快下班了）
- 用户有多少收藏（需要调用工具才知道）
- 用户常用哪些文件夹（每次都要问或猜）
- 用户最近在做什么（没有上下文）

### 2.2 解决方案

在每次对话开始前，**代码层预先组装**动态上下文，注入 System Prompt。

#### 2.2.1 动态上下文数据结构

```typescript
// src/lib/ai-agent/context/types.ts

/**
 * 动态上下文 - 每次对话开始时由代码层组装
 */
export interface DynamicContext {
  // ===== 时间信息 =====
  time: {
    current: string; // "2025-12-26 周四 14:30"
    period: "morning" | "afternoon" | "evening" | "night";
    isWeekend: boolean;
  };

  // ===== 用户数据概况（缓存，5分钟刷新）=====
  stats: {
    totalBookmarks: number; // 总收藏数
    recentWeekCount: number; // 最近7天新增
    topPlatform: {
      // 最常用平台
      name: string; // "B站"
      code: string; // "BILIBILI"
      count: number;
    };
    topFolders: Array<{
      // Top 3 文件夹
      name: string;
      id: number;
      count: number;
    }>;
  };

  // ===== 用户偏好（从 Profile 读取）=====
  preferences: {
    responseStyle: "concise" | "detailed" | "auto";
    frequentTags: string[]; // 常用标签 Top 5
  };

  // ===== 最近活动 =====
  recentActivity: {
    lastSaved?: {
      title: string;
      platform: string;
      time: string; // "2小时前"
    };
    lastSearch?: {
      query: string;
      time: string;
    };
  };

  // ===== 当前会话上下文 =====
  session: {
    selectedBookmarkIds?: number[]; // 用户选中的书签
    currentFolder?: {
      id: number;
      name: string;
    };
  };
}
```

#### 2.2.2 上下文构建器

```typescript
// src/lib/ai-agent/context/dynamic-context-builder.ts

import { createClient } from "@/lib/supabase/server";
import { DynamicContext } from "./types";

// 统计数据缓存（5分钟）
const statsCache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class DynamicContextBuilder {
  /**
   * 构建完整的动态上下文
   */
  async build(
    userId: string,
    sessionContext?: Partial<DynamicContext["session"]>,
  ): Promise<DynamicContext> {
    const [stats, preferences, recentActivity] = await Promise.all([
      this.getStats(userId),
      this.getPreferences(userId),
      this.getRecentActivity(userId),
    ]);

    return {
      time: this.buildTimeContext(),
      stats,
      preferences,
      recentActivity,
      session: sessionContext ?? {},
    };
  }

  /**
   * 时间上下文（纯计算，无 IO）
   */
  private buildTimeContext(): DynamicContext["time"] {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const period =
      hour < 12
        ? "morning"
        : hour < 18
          ? "afternoon"
          : hour < 22
            ? "evening"
            : "night";

    return {
      current: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${weekdays[dayOfWeek]} ${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      period,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
  }

  /**
   * 统计数据（带缓存）
   */
  private async getStats(userId: string): Promise<DynamicContext["stats"]> {
    const cacheKey = `stats:${userId}`;
    const cached = statsCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return cached.data as DynamicContext["stats"];
    }

    const supabase = await createClient();

    // 并行查询
    const [totalResult, recentResult, platformResult, folderResult] =
      await Promise.all([
        // 总数
        supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null),
        // 最近7天
        supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null)
          .gte(
            "created_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          ),
        // 平台分布 Top 1
        supabase.rpc("get_platform_stats", { p_user_id: userId }).limit(1),
        // 文件夹 Top 3
        supabase.rpc("get_folder_stats", { p_user_id: userId }).limit(3),
      ]);

    const stats: DynamicContext["stats"] = {
      totalBookmarks: totalResult.count ?? 0,
      recentWeekCount: recentResult.count ?? 0,
      topPlatform: platformResult.data?.[0] ?? {
        name: "未知",
        code: "OTHER",
        count: 0,
      },
      topFolders: folderResult.data ?? [],
    };

    // 写入缓存
    statsCache.set(cacheKey, { data: stats, expiry: Date.now() + CACHE_TTL });

    return stats;
  }

  /**
   * 用户偏好（从 profiles 表读取）
   */
  private async getPreferences(
    userId: string,
  ): Promise<DynamicContext["preferences"]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("ai_preferences")
      .eq("id", userId)
      .single();

    const prefs = data?.ai_preferences ?? {};

    return {
      responseStyle: prefs.responseStyle ?? "auto",
      frequentTags: prefs.frequentTags ?? [],
    };
  }

  /**
   * 最近活动
   */
  private async getRecentActivity(
    userId: string,
  ): Promise<DynamicContext["recentActivity"]> {
    const supabase = await createClient();

    // 最近保存的书签
    const { data: lastBookmark } = await supabase
      .from("bookmarks")
      .select("title, platform, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return {
      lastSaved: lastBookmark
        ? {
            title: lastBookmark.title,
            platform: this.formatPlatform(lastBookmark.platform),
            time: this.formatRelativeTime(lastBookmark.created_at),
          }
        : undefined,
    };
  }

  private formatPlatform(code: string): string {
    const map: Record<string, string> = {
      WECHAT: "微信公众号",
      BILIBILI: "B站",
      XIAOHONGSHU: "小红书",
      ZHIHU: "知乎",
      WEIBO: "微博",
      DOUYIN: "抖音",
    };
    return map[code] ?? code;
  }

  private formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "刚刚";
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  }
}

export const dynamicContextBuilder = new DynamicContextBuilder();
```

#### 2.2.3 Prompt 注入模板

```typescript
// src/lib/ai-agent/context/prompt-injector.ts

import { DynamicContext } from "./types";

/**
 * 将动态上下文转换为 Prompt 片段
 */
export function buildContextPrompt(ctx: DynamicContext): string {
  const lines: string[] = [
    "## 当前上下文",
    "",
    `【时间】${ctx.time.current}${ctx.time.isWeekend ? "（周末）" : ""}`,
    `【收藏概况】共 ${ctx.stats.totalBookmarks} 条收藏，最近 7 天新增 ${ctx.stats.recentWeekCount} 条`,
  ];

  // 最常用平台
  if (ctx.stats.topPlatform.count > 0) {
    lines.push(
      `【最常用平台】${ctx.stats.topPlatform.name}（${ctx.stats.topPlatform.count} 条）`,
    );
  }

  // 常用文件夹
  if (ctx.stats.topFolders.length > 0) {
    const folderStr = ctx.stats.topFolders
      .map((f) => `${f.name}(ID:${f.id})`)
      .join("、");
    lines.push(`【常用文件夹】${folderStr}`);
  }

  // 最近活动
  if (ctx.recentActivity.lastSaved) {
    lines.push(
      `【最近收藏】${ctx.recentActivity.lastSaved.time}收藏了「${ctx.recentActivity.lastSaved.title}」`,
    );
  }

  // 当前会话
  if (ctx.session.selectedBookmarkIds?.length) {
    lines.push(
      `【当前选中】用户选中了 ${ctx.session.selectedBookmarkIds.length} 条书签`,
    );
  }
  if (ctx.session.currentFolder) {
    lines.push(
      `【当前文件夹】${ctx.session.currentFolder.name}(ID:${ctx.session.currentFolder.id})`,
    );
  }

  lines.push("");
  lines.push(
    "**注意**：上述信息已预加载，可直接引用回答用户，无需调用工具查询。",
  );

  return lines.join("\n");
}
```

#### 2.2.4 集成到 KnowledgeAgent

```typescript
// 在 knowledge-agent.ts 的 buildMessages 方法中

private async buildMessages(
  conversation: { messages: AgentMessage[] },
  context: AgentContext,
): Promise<CoreMessage[]> {
  const messages: CoreMessage[] = [];

  // 1. 构建动态上下文
  const dynamicCtx = await dynamicContextBuilder.build(context.userId, {
    selectedBookmarkIds: context.bookmarkIds,
    currentFolder: context.currentFolder,
  });

  // 2. 组装 System Prompt = 静态基础 + 动态上下文
  const basePrompt = context.systemPrompt || this.config.systemPrompt;
  const contextPrompt = buildContextPrompt(dynamicCtx);
  const fullSystemPrompt = `${basePrompt}\n\n${contextPrompt}`;

  messages.push({
    role: "system",
    content: fullSystemPrompt,
  });

  // ... 后续消息处理保持不变
}
```

### 2.3 效果预览

**场景：用户问"我有多少收藏"**

| 模式   | 执行流程                             | 延迟   |
| ------ | ------------------------------------ | ------ |
| 旧模式 | 调用 count_total() → 等待查询 → 返回 | 2-3秒  |
| 新模式 | 直接从上下文读取 → 返回              | <0.5秒 |

**用户感知**：

```
旧模式: "稍等，让我查一下... 你有 156 条收藏。"
新模式: "你有 156 条收藏，最近一周新增了 12 条。最新收藏是《React 19 新特性》。"
```

### 2.4 Token 成本分析

| 组件       | Token 数（估算） |
| ---------- | ---------------- |
| 时间信息   | ~20              |
| 收藏概况   | ~30              |
| 常用文件夹 | ~40              |
| 最近活动   | ~30              |
| 会话上下文 | ~20              |
| **合计**   | **~140**         |

每次对话增加约 140 token，成本可接受。

---

## 三、模块 2：模型分层策略（新增）

### 3.1 设计目标

根据任务复杂度选择最合适的模型，实现**成本与性能的平衡**：

- 简单问题 → 快速模型 → 低成本、低延迟
- 常规任务 → 标准模型 → 平衡成本和质量
- 复杂推理 → 深度模型 → 高质量输出

### 3.2 分层架构

```
┌──────────────────────────────────────────────────────────────────┐
│                      模型分层架构                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐     │
│  │   快速层     │   │   标准层     │   │     深度层       │     │
│  │  (Fast)      │   │  (Standard)  │   │   (Deep)         │     │
│  ├──────────────┤   ├──────────────┤   ├──────────────────┤     │
│  │ deepseek-chat│   │ deepseek-chat│   │deepseek-reasoner │     │
│  │ (低温度)     │   │ (标准温度)    │   │ qwen-max         │     │
│  ├──────────────┤   ├──────────────┤   ├──────────────────┤     │
│  │ 目标: <1.5s  │   │ 目标: <4s    │   │ 目标: <12s       │     │
│  │ 成本: ¥0.001/K│   │ 成本: ¥0.002/K│   │ 成本: ¥0.008/K   │     │
│  ├──────────────┤   ├──────────────┤   ├──────────────────┤     │
│  │ 简单查询     │   │ 工具调用     │   │ 复杂推理         │     │
│  │ 闲聊         │   │ 摘要生成     │   │ 洞察分析         │     │
│  │ 意图分类     │   │ 分类标签     │   │ 学习路径规划     │     │
│  └──────────────┘   └──────────────┘   └──────────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 实现方案

#### 3.3.1 分层配置

```typescript
// src/lib/ai-providers/model-tier-config.ts

export type ModelTierId = "fast" | "standard" | "deep";

export const MODEL_TIER_CONFIG: Record<ModelTierId, TierConfig> = {
  fast: {
    id: "fast",
    name: "快速层",
    description: "简单任务，速度优先",
    targetLatencyMs: 1500,
    maxLatencyMs: 3000,
    provider: {
      name: "deepseek",
      model: "deepseek-chat",
      temperature: 0.3, // 低温度，更确定性
      maxTokens: 500, // 限制输出长度
    },
    applicableTasks: [
      "chitchat", // 闲聊
      "simple_query", // 简单查询
      "intent_classification", // 意图分类
    ],
  },

  standard: {
    id: "standard",
    name: "标准层",
    description: "常规任务，平衡性能",
    targetLatencyMs: 4000,
    maxLatencyMs: 8000,
    provider: {
      name: "deepseek",
      model: "deepseek-chat",
      temperature: 0.5,
      maxTokens: 2000,
    },
    applicableTasks: [
      "tool_calling", // 工具调用
      "summary_generation", // 摘要生成
      "classification", // 分类
      "search", // 搜索
    ],
  },

  deep: {
    id: "deep",
    name: "深度层",
    description: "复杂推理，质量优先",
    targetLatencyMs: 12000,
    maxLatencyMs: 30000,
    provider: {
      name: "deepseek",
      model: "deepseek-reasoner", // 或 qwen-max
      temperature: 0.7,
      maxTokens: 4000,
    },
    applicableTasks: [
      "insight_analysis", // 洞察分析
      "learning_path", // 学习路径
      "complex_reasoning", // 复杂推理
      "batch_organize", // 批量整理
    ],
  },
};
```

#### 3.3.2 任务-层级映射

```typescript
// src/lib/ai-providers/task-tier-mapping.ts

/**
 * 意图类型 → 模型层级 映射
 */
export const INTENT_TIER_MAPPING: Record<string, ModelTierId> = {
  // 快速层：简单问答
  "query:count": "fast",
  "query:list": "fast",
  chitchat: "fast",

  // 标准层：常规操作
  "query:search": "standard",
  "action:tag": "standard",
  "action:move": "standard",
  "create:summary": "standard",

  // 深度层：复杂任务
  "analyze:insight": "deep",
  "analyze:report": "deep",
  "learn:review": "deep",
  "organize:cleanup": "deep",
};

/**
 * 复杂度 → 层级 映射（兜底规则）
 */
export const COMPLEXITY_TIER_MAPPING: Record<ComplexityLevel, ModelTierId> = {
  simple: "fast",
  medium: "standard",
  complex: "deep",
};
```

#### 3.3.3 层级选择器

```typescript
// src/lib/ai-providers/tier-selector.ts

export class ModelTierSelector {
  /**
   * 根据上下文选择最适合的模型层级
   */
  selectTier(context: TierSelectionContext): TierSelection {
    const { intent, complexity, hasPreloadedContext } = context;

    // 1. 如果有预加载上下文且是简单问题，使用快速层
    if (hasPreloadedContext && this.isSimpleQuery(intent)) {
      return { tierId: "fast", reason: "preloaded_context" };
    }

    // 2. 按意图类型映射
    const intentKey = `${intent.type}:${intent.subType}`;
    const mappedTier =
      INTENT_TIER_MAPPING[intentKey] || INTENT_TIER_MAPPING[intent.type];
    if (mappedTier) {
      return { tierId: mappedTier, reason: "intent_mapping" };
    }

    // 3. 按复杂度映射（兜底）
    const complexityTier = COMPLEXITY_TIER_MAPPING[complexity.level];
    return { tierId: complexityTier, reason: "complexity_fallback" };
  }

  /**
   * 获取层级对应的模型配置
   */
  getModelConfig(tierId: ModelTierId): ProviderConfig {
    return MODEL_TIER_CONFIG[tierId].provider;
  }

  /**
   * 判断是否为简单查询
   */
  private isSimpleQuery(intent: IntentClassification): boolean {
    const simpleTypes = ["query:count", "query:list", "chitchat"];
    return simpleTypes.includes(`${intent.type}:${intent.subType}`);
  }
}

export const tierSelector = new ModelTierSelector();
```

### 3.4 集成到 UnifiedEngine

```typescript
// 修改 src/lib/ai-skills/engine/unified-engine.ts

class UnifiedEngine {
  async *execute(
    input: string,
    context: UnifiedContext,
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 1. 意图路由（使用快速层）
    const routeResult = await this.intentRouter.route(input, {
      model: tierSelector.getModelConfig("fast"),
    });

    // 2. 选择执行层级
    const tierSelection = tierSelector.selectTier({
      intent: routeResult.intent,
      complexity: routeResult.complexity,
      hasPreloadedContext: !!context.dynamicContext?.stats,
    });

    // 3. 返回路由信息（包含层级）
    yield this.outputAdapter.createRoutingChunk({
      ...routeResult,
      modelTier: tierSelection.tierId,
      tierReason: tierSelection.reason,
    });

    // 4. 获取对应层级的模型配置
    const modelConfig = tierSelector.getModelConfig(tierSelection.tierId);

    // 5. 执行（传入选定的模型配置）
    if (routeResult.mode === "atomic") {
      yield* this.executeAtomic(input, context, { modelConfig });
    } else {
      yield* this.executeOrchestration(
        routeResult.suggestedSkill!,
        input,
        context,
        { modelConfig },
      );
    }
  }
}
```

### 3.5 与动态上下文的协同

```
┌─────────────────────────────────────────────────────────────┐
│ 用户问题: "我有多少收藏"                                     │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. 动态上下文已预加载（totalBookmarks=156）                  │
│ 2. 意图识别: query:count                                    │
│ 3. 层级选择: fast（有预加载 + 简单问题）                     │
│ 4. 直接回答，不调用工具，不调用 LLM                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 响应: "你有 156 条收藏。" (延迟 < 100ms)                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.6 成本预估

| 场景         | 占比 | 层级 | Token/次 | 成本/千次 |
| ------------ | ---- | ---- | -------- | --------- |
| 简单问答     | 60%  | 快速 | 300      | ¥0.3      |
| 常规操作     | 30%  | 标准 | 800      | ¥1.6      |
| 复杂分析     | 10%  | 深度 | 2000     | ¥16       |
| **加权平均** | -    | -    | ~550     | **¥1.5**  |

相比统一使用标准层（¥1.6/千次），分层策略可节约 **~10% 成本**，同时简单问题响应更快。

---

## 四、模块 5：轻量版 ReAct 思维模式

### 4.1 设计原则

不采用复杂的多轮 ReAct 循环，而是通过 **Prompt 引导 + 示例演示** 让模型内化思考过程。

### 4.2 轻量版 ReAct Prompt

```typescript
// src/lib/ai-agent/core/prompts/knowledge-agent.prompt.ts

export const KNOWLEDGE_AGENT_SYSTEM_PROMPT = `你是 AnyKeep 的 AI 知识助手，帮助用户管理收藏的内容。

## 思维模式

回答问题前，快速过一遍：
1. **理解**：用户真正想要什么？
2. **判断**：上下文信息够不够？需要调用工具吗？
3. **行动**：直接回答 或 调用工具
4. **检查**：结果是否完整？是否需要补充？

### 快速判断规则

| 情况 | 处理方式 |
|------|----------|
| 上下文已有答案 | 直接回答，不调用工具 |
| 需要详细列表 | 调用 list_* 工具 |
| 需要搜索特定内容 | 调用 search_bookmarks |
| 需要执行操作 | 调用对应工具，提示用户确认 |
| 信息不足无法判断 | 先问用户，不要猜 |

## 工具使用

### 优先级原则
1. **能不调就不调**：上下文有答案就直接用
2. **简单优先**：count_total 优于 get_stats
3. **精确优先**：知道条件就用精确工具

### 可用工具

【查询类】
- list_recent(limit?) → 最近收藏
- list_by_folder(folder_id, limit?) → 指定文件夹
- list_by_platform(platform, limit?) → 指定平台
- search_bookmarks(query, limit?) → 搜索

【统计类】
- count_total() → 总数
- count_by_folder(folder_id) → 文件夹数量
- count_by_platform(platform) → 平台数量
- get_stats() → 详细统计（仅需图表时用）

【智能列表类】
- list_smart_lists() → 获取智能列表
- get_smart_list_items(smartListId, limit?) → 列表内容
- get_smart_list_count(smartListId) → 列表数量

【操作类】（界面会弹出确认）
- batch_tags(bookmark_ids, tags, action) → 批量标签
- move_bookmarks(bookmark_ids, folder_id) → 批量移动
- export_bookmarks(format, filter?, bookmarkIds?) → 导出

### 平台代码
WECHAT / BILIBILI / XIAOHONGSHU / ZHIHU / WEIBO / DOUYIN / BROWSER_* / OTHER

## 错误处理

| 错误 | 处理 |
|------|------|
| "not found" | 先查询获取正确 ID |
| 结果为空 | 放宽条件或换工具 |
| 参数错误 | 检查格式后重试 |

## 示例

### 直接回答（上下文已有）
用户: "我有多少收藏"
→ 上下文显示 totalBookmarks=156
→ 回复: "你有 156 条收藏。"（不调用工具）

### 需要工具
用户: "找一下关于 React 的"
→ 需要搜索
→ 调用 search_bookmarks(query="React")
→ 回复: "找到 8 条相关收藏：..."

### 多步骤
用户: "把最近的 B 站视频移到视频文件夹"
→ 1. 调用 list_recent() 获取最近收藏
→ 2. 筛选 BILIBILI 平台
→ 3. 上下文有视频文件夹 ID=8
→ 4. 调用 move_bookmarks()
→ 回复: "找到 3 个 B 站视频，请点击确认移动到「视频」文件夹。"

### 信息不足
用户: "删掉那个"
→ "那个"指代不明
→ 回复: "请问你想删除哪个收藏？可以告诉我标题或关键词。"

## 约束

- 用中文回复
- 简洁直接，不要过度解释
- 批量操作后提示点击确认
- 不确定时先问，不要猜测`;
```

### 4.3 与动态上下文的协同

完整的 System Prompt 结构：

```
┌─────────────────────────────────────────┐
│ 1. 轻量版 ReAct 基础 Prompt             │  ← 静态，约 1500 token
│    - 思维模式                           │
│    - 工具列表                           │
│    - 示例                               │
├─────────────────────────────────────────┤
│ 2. 动态上下文                           │  ← 动态，约 140 token
│    - 时间、统计、偏好、最近活动         │
└─────────────────────────────────────────┘
Total: ~1640 token
```

---

## 五、模块 7：reasoning 参数（隐式思考链）

### 5.1 设计目标

让模型在调用工具时**解释选择理由**，但不输出给用户。用于：

- 日志分析和调试
- 优化工具描述
- 发现意图误判

### 5.2 实现方案

在所有工具的参数中添加可选的 `reasoning` 字段：

```typescript
// src/lib/ai-agent/tools/types.ts

/**
 * 通用工具参数基类
 */
export const BaseToolParams = z.object({
  reasoning: z
    .string()
    .optional()
    .describe("选择此工具的理由（内部使用，不展示给用户）"),
});

// 示例：list_recent 工具
export const listRecentParams = BaseToolParams.extend({
  limit: z.number().int().min(1).max(20).optional().default(10),
});
```

### 5.3 Prompt 引导

在 System Prompt 中添加：

```markdown
## 工具调用规范

调用工具时，请在 reasoning 参数中简要说明选择理由，例如：

- reasoning: "用户问最近收藏，直接用 list_recent"
- reasoning: "需要先获取文件夹ID，所以先调 list_folders"
- reasoning: "关键词搜索比遍历更高效"

这有助于系统优化，不会展示给用户。
```

### 5.4 日志记录

```typescript
// src/lib/ai-agent/tools/tool-registry.ts

async execute<TResult>(
  name: string,
  params: unknown,
  context: AgentContext,
): Promise<ToolResult<TResult>> {
  const tool = this.get(name);

  // 记录 reasoning（如果有）
  if (params && typeof params === "object" && "reasoning" in params) {
    logger.debug({
      event: "tool_reasoning",
      tool: name,
      reasoning: (params as { reasoning?: string }).reasoning,
      userId: context.userId,
    });
  }

  // 执行工具...
}
```

---

## 六、模块 6：智能错误恢复（新增）

### 6.1 设计目标

当工具调用失败或返回意外结果时，系统能够**自动分析错误原因**并选择合适的恢复策略，而不是简单地向用户报错。

### 6.2 错误分类体系

```typescript
// src/lib/ai-agent/error-recovery/error-types.ts

/**
 * AI Agent 错误类型枚举
 */
export enum AgentErrorType {
  // 工具调用错误
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  TOOL_PARAM_INVALID = "TOOL_PARAM_INVALID",
  TOOL_EXECUTION_FAILED = "TOOL_EXECUTION_FAILED",
  TOOL_TIMEOUT = "TOOL_TIMEOUT",

  // 数据错误
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND", // 书签/文件夹不存在
  PERMISSION_DENIED = "PERMISSION_DENIED", // 无权限访问
  DATA_CONFLICT = "DATA_CONFLICT", // 数据冲突

  // 模型错误
  MODEL_RATE_LIMIT = "MODEL_RATE_LIMIT",
  MODEL_CONTEXT_OVERFLOW = "MODEL_CONTEXT_OVERFLOW",
  MODEL_RESPONSE_INVALID = "MODEL_RESPONSE_INVALID",

  // 网络错误
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  NETWORK_UNAVAILABLE = "NETWORK_UNAVAILABLE",
}

/**
 * 结构化错误信息
 */
export interface AgentError {
  type: AgentErrorType;
  message: string;
  context?: {
    toolName?: string;
    params?: unknown;
    originalError?: Error;
    retryCount?: number;
  };
  recoverable: boolean;
  suggestedAction?: string;
}
```

### 6.3 恢复策略定义

```typescript
// src/lib/ai-agent/error-recovery/recovery-strategies.ts

/**
 * 恢复策略类型
 */
export type RecoveryStrategy =
  | "retry" // 重试（适用于临时性错误）
  | "fallback_tool" // 换用备选工具
  | "refresh_context" // 刷新上下文后重试
  | "ask_user" // 请求用户澄清
  | "graceful_degrade" // 优雅降级（返回部分结果）
  | "abort"; // 终止并报错

/**
 * 错误类型 → 恢复策略 映射
 */
export const ERROR_RECOVERY_MAPPING: Record<
  AgentErrorType,
  RecoveryStrategy[]
> = {
  // 工具错误
  [AgentErrorType.TOOL_NOT_FOUND]: ["fallback_tool", "ask_user"],
  [AgentErrorType.TOOL_PARAM_INVALID]: ["ask_user", "abort"],
  [AgentErrorType.TOOL_EXECUTION_FAILED]: [
    "retry",
    "fallback_tool",
    "graceful_degrade",
  ],
  [AgentErrorType.TOOL_TIMEOUT]: ["retry", "graceful_degrade"],

  // 数据错误
  [AgentErrorType.RESOURCE_NOT_FOUND]: ["refresh_context", "ask_user"],
  [AgentErrorType.PERMISSION_DENIED]: ["ask_user", "abort"],
  [AgentErrorType.DATA_CONFLICT]: ["refresh_context", "ask_user"],

  // 模型错误
  [AgentErrorType.MODEL_RATE_LIMIT]: ["retry", "graceful_degrade"],
  [AgentErrorType.MODEL_CONTEXT_OVERFLOW]: ["graceful_degrade", "abort"],
  [AgentErrorType.MODEL_RESPONSE_INVALID]: ["retry", "fallback_tool"],

  // 网络错误
  [AgentErrorType.NETWORK_TIMEOUT]: ["retry", "abort"],
  [AgentErrorType.NETWORK_UNAVAILABLE]: ["abort"],
};

/**
 * 重试配置
 */
export const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelayMs: 500,
  backoffMultiplier: 2, // 指数退避
};
```

### 6.4 错误恢复处理器

```typescript
// src/lib/ai-agent/error-recovery/error-recovery-handler.ts

import { logger } from "@/lib/logger";

export class ErrorRecoveryHandler {
  private retryCount = new Map<string, number>();

  /**
   * 处理错误并尝试恢复
   */
  async handleError(
    error: AgentError,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    const strategies = ERROR_RECOVERY_MAPPING[error.type];
    const errorKey = this.getErrorKey(error, context);

    logger.warn({
      event: "agent_error",
      errorType: error.type,
      message: error.message,
      context: error.context,
    });

    // 依次尝试恢复策略
    for (const strategy of strategies) {
      const result = await this.tryStrategy(strategy, error, context, errorKey);
      if (result.success) {
        logger.info({
          event: "error_recovered",
          strategy,
          errorType: error.type,
        });
        return result;
      }
    }

    // 所有策略都失败
    return {
      success: false,
      action: "abort",
      userMessage: this.getUserFriendlyMessage(error),
    };
  }

  /**
   * 执行具体的恢复策略
   */
  private async tryStrategy(
    strategy: RecoveryStrategy,
    error: AgentError,
    context: RecoveryContext,
    errorKey: string,
  ): Promise<RecoveryResult> {
    switch (strategy) {
      case "retry":
        return this.handleRetry(error, context, errorKey);

      case "fallback_tool":
        return this.handleFallbackTool(error, context);

      case "refresh_context":
        return this.handleRefreshContext(error, context);

      case "ask_user":
        return this.handleAskUser(error, context);

      case "graceful_degrade":
        return this.handleGracefulDegrade(error, context);

      case "abort":
        return { success: false, action: "abort" };
    }
  }

  /**
   * 重试策略
   */
  private async handleRetry(
    error: AgentError,
    context: RecoveryContext,
    errorKey: string,
  ): Promise<RecoveryResult> {
    const currentRetry = this.retryCount.get(errorKey) ?? 0;

    if (currentRetry >= RETRY_CONFIG.maxRetries) {
      return { success: false, action: "retry_exhausted" };
    }

    // 指数退避
    const delay =
      RETRY_CONFIG.baseDelayMs *
      Math.pow(RETRY_CONFIG.backoffMultiplier, currentRetry);
    await this.sleep(delay);

    this.retryCount.set(errorKey, currentRetry + 1);

    return {
      success: true,
      action: "retry",
      retryWith: {
        toolName: error.context?.toolName,
        params: error.context?.params,
      },
    };
  }

  /**
   * 备选工具策略
   */
  private async handleFallbackTool(
    error: AgentError,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    const fallbackTool = this.findFallbackTool(error.context?.toolName);

    if (!fallbackTool) {
      return { success: false, action: "no_fallback" };
    }

    return {
      success: true,
      action: "fallback_tool",
      retryWith: {
        toolName: fallbackTool,
        params: this.transformParams(error.context?.params, fallbackTool),
      },
    };
  }

  /**
   * 刷新上下文策略（适用于资源不存在错误）
   */
  private async handleRefreshContext(
    error: AgentError,
    context: RecoveryContext,
  ): Promise<RecoveryResult> {
    // 触发上下文刷新
    return {
      success: true,
      action: "refresh_context",
      suggestion: "数据可能已更新，正在刷新...",
    };
  }

  /**
   * 请求用户澄清
   */
  private handleAskUser(
    error: AgentError,
    context: RecoveryContext,
  ): RecoveryResult {
    const clarificationQuestion = this.generateClarificationQuestion(error);

    return {
      success: true,
      action: "ask_user",
      userMessage: clarificationQuestion,
    };
  }

  /**
   * 优雅降级
   */
  private handleGracefulDegrade(
    error: AgentError,
    context: RecoveryContext,
  ): RecoveryResult {
    return {
      success: true,
      action: "graceful_degrade",
      userMessage: `无法完成完整操作，但${error.suggestedAction ?? "可以尝试其他方式"}`,
      partialResult: context.partialResult,
    };
  }

  /**
   * 生成用户友好的错误信息
   */
  private getUserFriendlyMessage(error: AgentError): string {
    const messages: Record<AgentErrorType, string> = {
      [AgentErrorType.TOOL_NOT_FOUND]: "抱歉，暂时无法执行这个操作。",
      [AgentErrorType.TOOL_PARAM_INVALID]: "请求参数有误，请检查后重试。",
      [AgentErrorType.TOOL_EXECUTION_FAILED]: "操作执行失败，请稍后重试。",
      [AgentErrorType.TOOL_TIMEOUT]: "操作超时，请稍后重试。",
      [AgentErrorType.RESOURCE_NOT_FOUND]:
        "找不到指定的内容，可能已被删除或移动。",
      [AgentErrorType.PERMISSION_DENIED]: "您没有权限执行此操作。",
      [AgentErrorType.DATA_CONFLICT]: "数据发生冲突，请刷新后重试。",
      [AgentErrorType.MODEL_RATE_LIMIT]: "请求过于频繁，请稍后再试。",
      [AgentErrorType.MODEL_CONTEXT_OVERFLOW]: "对话内容过长，请开启新对话。",
      [AgentErrorType.MODEL_RESPONSE_INVALID]: "AI 响应异常，请重试。",
      [AgentErrorType.NETWORK_TIMEOUT]: "网络超时，请检查网络连接。",
      [AgentErrorType.NETWORK_UNAVAILABLE]: "网络不可用，请检查网络连接。",
    };

    return messages[error.type] ?? "发生未知错误，请稍后重试。";
  }

  /**
   * 生成澄清问题
   */
  private generateClarificationQuestion(error: AgentError): string {
    if (error.type === AgentErrorType.RESOURCE_NOT_FOUND) {
      return `找不到"${error.context?.params}"，您可以告诉我更具体的信息吗？比如标题或关键词。`;
    }
    if (error.type === AgentErrorType.TOOL_PARAM_INVALID) {
      return "请问您能更详细地描述一下需求吗？";
    }
    return error.suggestedAction ?? "请问您能提供更多信息吗？";
  }

  /**
   * 工具备选映射
   */
  private findFallbackTool(toolName?: string): string | undefined {
    const fallbackMap: Record<string, string> = {
      list_by_folder: "list_recent", // 文件夹查询失败 → 列最近
      search_bookmarks: "list_recent", // 搜索失败 → 列最近
      get_stats: "count_total", // 详细统计失败 → 简单计数
    };
    return toolName ? fallbackMap[toolName] : undefined;
  }

  private transformParams(params: unknown, targetTool: string): unknown {
    // 参数转换逻辑
    return params;
  }

  private getErrorKey(error: AgentError, context: RecoveryContext): string {
    return `${error.type}:${error.context?.toolName}:${context.requestId}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const errorRecoveryHandler = new ErrorRecoveryHandler();
```

### 6.5 集成到工具执行流程

```typescript
// 修改 src/lib/ai-agent/tools/tool-registry.ts

async execute<TResult>(
  name: string,
  params: unknown,
  context: AgentContext,
): Promise<ToolResult<TResult>> {
  const tool = this.get(name);

  try {
    // 正常执行
    const result = await tool.execute(params, context);
    return { success: true, data: result };

  } catch (error) {
    // 分类错误
    const agentError = this.classifyError(error, name, params);

    // 尝试恢复
    const recovery = await errorRecoveryHandler.handleError(agentError, {
      requestId: context.requestId,
      partialResult: null,
    });

    if (recovery.success && recovery.action === "retry" && recovery.retryWith) {
      // 重试
      return this.execute(
        recovery.retryWith.toolName ?? name,
        recovery.retryWith.params ?? params,
        context,
      );
    }

    if (recovery.success && recovery.action === "ask_user") {
      // 返回澄清请求
      return {
        success: false,
        error: agentError,
        clarificationNeeded: true,
        userMessage: recovery.userMessage,
      };
    }

    // 其他情况返回错误
    return {
      success: false,
      error: agentError,
      userMessage: recovery.userMessage ?? agentError.message,
    };
  }
}

/**
 * 将原始错误分类为 AgentError
 */
private classifyError(error: unknown, toolName: string, params: unknown): AgentError {
  if (error instanceof Error) {
    // 根据错误消息分类
    if (error.message.includes("not found") || error.message.includes("不存在")) {
      return {
        type: AgentErrorType.RESOURCE_NOT_FOUND,
        message: error.message,
        context: { toolName, params, originalError: error },
        recoverable: true,
        suggestedAction: "尝试使用其他关键词搜索",
      };
    }

    if (error.message.includes("timeout") || error.message.includes("超时")) {
      return {
        type: AgentErrorType.TOOL_TIMEOUT,
        message: error.message,
        context: { toolName, params, originalError: error },
        recoverable: true,
      };
    }

    if (error.message.includes("permission") || error.message.includes("权限")) {
      return {
        type: AgentErrorType.PERMISSION_DENIED,
        message: error.message,
        context: { toolName, params, originalError: error },
        recoverable: false,
      };
    }
  }

  // 默认归类为执行失败
  return {
    type: AgentErrorType.TOOL_EXECUTION_FAILED,
    message: error instanceof Error ? error.message : "Unknown error",
    context: { toolName, params },
    recoverable: true,
  };
}
```

### 6.6 效果示例

**场景：用户请求移动书签到不存在的文件夹**

```
用户: "把最近的移到工作文件夹"
→ 调用 move_bookmarks(folder_id=999) // 文件夹不存在
→ 错误类型: RESOURCE_NOT_FOUND
→ 恢复策略: refresh_context → ask_user
→ 回复: "找不到「工作」文件夹，您的文件夹有：学习(ID:1)、娱乐(ID:2)、技术(ID:3)，请问要移动到哪个？"
```

**场景：搜索超时**

```
用户: "搜一下 AI 相关的"
→ 调用 search_bookmarks(query="AI") // 超时
→ 错误类型: TOOL_TIMEOUT
→ 恢复策略: retry (delay 500ms) → retry (delay 1000ms) → graceful_degrade
→ 回复: "搜索有点慢，这是最近包含 AI 关键词的收藏：..."（展示 list_recent 结果）
```

---

## 七、模块 8：用户画像持久化（P2）

### 7.1 数据库变更

```sql
-- 在 profiles 表添加 ai_preferences 字段
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS ai_preferences JSONB DEFAULT '{}'::jsonb;

-- 索引
CREATE INDEX IF NOT EXISTS idx_profiles_ai_preferences
ON profiles USING GIN (ai_preferences);
```

### 7.2 数据结构

```typescript
// src/lib/ai-agent/preferences/types.ts

export interface AIPreferences {
  // 响应风格
  responseStyle: "concise" | "detailed" | "auto";

  // AI 学习到的偏好（自动更新）
  learned: {
    frequentTags: string[]; // 常用标签 Top 10
    frequentFolders: number[]; // 常用文件夹 ID Top 5
    frequentQueries: string[]; // 常见问题类型
    preferredExportFormat?: string; // 偏好的导出格式
    lastUpdated: string; // ISO 时间戳
  };

  // 用户显式设置
  explicit: {
    skipConfirmation?: boolean; // 跳过确认弹窗
    defaultLimit?: number; // 默认列表数量
  };
}
```

### 7.3 自动学习服务

```typescript
// src/lib/ai-agent/preferences/learning-service.ts

export class PreferenceLearningService {
  /**
   * 记录工具调用，异步更新用户偏好
   */
  async recordToolUsage(
    userId: string,
    toolName: string,
    params: unknown,
    success: boolean,
  ): Promise<void> {
    // 异步执行，不阻塞主流程
    setImmediate(async () => {
      try {
        if (!success) return;

        switch (toolName) {
          case "list_by_folder":
          case "move_bookmarks":
            await this.incrementFolderUsage(
              userId,
              (params as { folder_id: number }).folder_id,
            );
            break;
          case "batch_tags":
            await this.recordTagUsage(
              userId,
              (params as { tags: string[] }).tags,
            );
            break;
          case "export_bookmarks":
            await this.recordExportFormat(
              userId,
              (params as { format: string }).format,
            );
            break;
        }
      } catch (error) {
        logger.warn("Failed to update preferences", {
          error,
          userId,
          toolName,
        });
      }
    });
  }

  private async incrementFolderUsage(
    userId: string,
    folderId: number,
  ): Promise<void> {
    const supabase = await createClient();

    // 使用 JSONB 操作更新
    await supabase.rpc("increment_folder_usage", {
      p_user_id: userId,
      p_folder_id: folderId,
    });
  }

  // ... 其他方法
}
```

---

## 八、实施计划

### 8.1 时间线

```
Week 1 (12/26 - 12/29): P0 任务
├── Day 1: 动态 System Prompt 实现
│   ├── DynamicContextBuilder
│   ├── Prompt 注入模板
│   └── 集成到 KnowledgeAgent
├── Day 2-3: 工具结果增强器（已在进行）
└── Day 4: 工具描述模板化（已在进行）

Week 2 (12/30 - 1/3): P1 任务
├── Day 1: 轻量版 ReAct Prompt
│   ├── 更新 System Prompt
│   └── 测试验证
├── Day 2: reasoning 参数
│   ├── 更新工具定义
│   ├── 日志记录
│   └── Prompt 引导
└── Day 3-5: 集成测试 + 调优

Week 3+: P2 任务（按需）
├── 用户画像持久化
└── 偏好自动学习
```

### 8.2 文件变更清单

| 优先级 | 文件                                                        | 操作 | 说明                      |
| ------ | ----------------------------------------------------------- | ---- | ------------------------- |
| P0     | `src/lib/ai-agent/context/types.ts`                         | 新增 | 动态上下文类型            |
| P0     | `src/lib/ai-agent/context/dynamic-context-builder.ts`       | 新增 | 上下文构建器              |
| P0     | `src/lib/ai-agent/context/prompt-injector.ts`               | 新增 | Prompt 注入               |
| P0     | `src/lib/ai-agent/core/knowledge-agent.ts`                  | 修改 | 集成动态上下文            |
| P0     | `src/lib/ai-providers/model-tier-config.ts`                 | 新增 | 模型分层配置              |
| P0     | `src/lib/ai-providers/task-tier-mapping.ts`                 | 新增 | 任务-层级映射             |
| P0     | `src/lib/ai-providers/tier-selector.ts`                     | 新增 | 层级选择器                |
| P1     | `src/lib/ai-agent/core/prompts/knowledge-agent.prompt.ts`   | 修改 | 轻量版 ReAct              |
| P1     | `src/lib/ai-agent/error-recovery/error-types.ts`            | 新增 | 错误类型定义              |
| P1     | `src/lib/ai-agent/error-recovery/recovery-strategies.ts`    | 新增 | 恢复策略配置              |
| P1     | `src/lib/ai-agent/error-recovery/error-recovery-handler.ts` | 新增 | 错误恢复处理器            |
| P1     | `src/lib/ai-agent/tools/types.ts`                           | 修改 | 添加 reasoning            |
| P1     | `src/lib/ai-agent/tools/tool-registry.ts`                   | 修改 | 记录 reasoning + 错误分类 |
| P2     | `supabase/migrations/xxx_add_ai_preferences.sql`            | 新增 | 数据库变更                |
| P2     | `src/lib/ai-agent/preferences/`                             | 新增 | 偏好学习服务              |

### 8.3 依赖关系

```
工具描述模板化 ──┐
                 ├──→ 模型理解工具更准确
工具结果增强器 ──┤
                 │
动态上下文 ──────┼──→ 减少不必要的工具调用
                 │
模型分层策略 ────┼──→ 简单问题快速响应，成本优化
                 │
轻量版 ReAct ────┤
                 ├──→ 思考更清晰，选择更准确
reasoning 参数 ──┘
                 │
智能错误恢复 ────┴──→ 自动处理异常，提升成功率
```

---

## 九、测试验证

### 9.1 测试用例

| 编号 | 场景                     | 预期行为                             | 验证重点          |
| ---- | ------------------------ | ------------------------------------ | ----------------- |
| T1   | "我有多少收藏"           | 直接从上下文回答，不调用工具         | 动态上下文生效    |
| T2   | "最近收藏了什么"         | 调用 list_recent，reasoning 解释选择 | ReAct + reasoning |
| T3   | "把最近的移到学习文件夹" | 使用上下文中的文件夹 ID              | 上下文利用        |
| T4   | 文件夹不存在             | 先查询文件夹列表                     | 错误恢复          |
| T5   | "删掉那个"               | 主动询问澄清                         | 信息不足处理      |
| T6   | 连续 3 个问题            | 每个问题独立，上下文不干扰           | 会话隔离          |
| T7   | 首次用户（无历史）       | 上下文显示 0 收藏，引导使用          | 边界情况          |

### 9.2 成功指标

| 指标                 | 基线 | 目标 | 测量方式         |
| -------------------- | ---- | ---- | ---------------- |
| 简单问题无工具调用率 | 0%   | 60%+ | 日志统计         |
| 工具选择准确率       | ~70% | 90%+ | 人工标注 20 case |
| 平均响应延迟         | 2.5s | 1.5s | 性能监控         |
| reasoning 填写率     | -    | 80%+ | 日志统计         |

---

## 十、风险评估与缓解

| 风险            | 可能性 | 影响           | 缓解措施                       |
| --------------- | ------ | -------------- | ------------------------------ |
| 统计缓存不一致  | 中     | 用户看到旧数据 | 缓存 TTL 5分钟，操作后主动刷新 |
| 上下文过长超限  | 低     | API 报错       | 控制总长度 <2000 token         |
| Prompt 变更回归 | 中     | 原有功能异常   | 保留旧 Prompt，A/B 测试        |
| 性能下降        | 中     | 响应变慢       | 并行查询，缓存优化             |

---

## 十一、回滚方案

```typescript
// 环境变量控制
const ENABLE_DYNAMIC_CONTEXT = process.env.ENABLE_DYNAMIC_CONTEXT !== "false";
const ENABLE_MODEL_TIERING = process.env.ENABLE_MODEL_TIERING !== "false";
const ENABLE_REACT_PROMPT = process.env.ENABLE_REACT_PROMPT !== "false";
const ENABLE_REASONING = process.env.ENABLE_REASONING !== "false";
const ENABLE_ERROR_RECOVERY = process.env.ENABLE_ERROR_RECOVERY !== "false";

// 在 KnowledgeAgent 中
const systemPrompt = ENABLE_REACT_PROMPT
  ? REACT_SYSTEM_PROMPT
  : LEGACY_SYSTEM_PROMPT;

const contextPrompt = ENABLE_DYNAMIC_CONTEXT
  ? buildContextPrompt(dynamicCtx)
  : "";

// 在 UnifiedEngine 中
const modelConfig = ENABLE_MODEL_TIERING
  ? tierSelector.getModelConfig(tierSelection.tierId)
  : DEFAULT_MODEL_CONFIG;

// 在 ToolRegistry 中
const recovery = ENABLE_ERROR_RECOVERY
  ? await errorRecoveryHandler.handleError(error, context)
  : { success: false, action: "abort" };
```

---

## 十二、审批清单

- [ ] **产品确认**：动态上下文内容符合用户预期
- [ ] **技术确认**：Token 消耗增幅可接受（<200/次）
- [ ] **技术确认**：统计缓存策略合理
- [ ] **测试确认**：7 个测试用例全部通过
- [ ] **运维确认**：回滚方案可行

---

## 附录 A：与原 ReAct 计划的合并说明

原计划文档 `REACT_SYSTEM_PROMPT_UPGRADE_PLAN.md` 的内容已整合到本文档：

- 3.2 节：轻量版 ReAct Prompt（简化后）
- 3.3 节：与动态上下文的协同

原文档可标记为 `[已合并]` 或删除。

---

## 附录 B：完整架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户请求                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                   Context Builder (代码层)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. 构建时间上下文（纯计算）                                 │ │
│  │ 2. 加载统计数据（缓存，5分钟）                              │ │
│  │ 3. 加载用户偏好（Supabase）                                 │ │
│  │ 4. 获取最近活动                                             │ │
│  │ 5. 合并会话上下文（选中书签、当前文件夹）                   │ │
│  │ 6. 组装完整 System Prompt                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    Single LLM (One Pass)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ System Prompt:                                              │ │
│  │ ┌──────────────────────────────────────────────────────┐   │ │
│  │ │ 轻量版 ReAct 基础（~1500 token）                      │   │ │
│  │ │ - 思维模式                                            │   │ │
│  │ │ - 工具列表 + 选择策略                                 │   │ │
│  │ │ - 示例                                                │   │ │
│  │ └──────────────────────────────────────────────────────┘   │ │
│  │ ┌──────────────────────────────────────────────────────┐   │ │
│  │ │ 动态上下文（~140 token）                              │   │ │
│  │ │ - 时间、统计、偏好、最近活动                          │   │ │
│  │ └──────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│              ┌───────────────┴───────────────┐                   │
│              ▼                               ▼                   │
│      直接回复                        调用工具                    │
│   （上下文已有答案）              （需要更多信息）               │
│                                      │                           │
│                                      ▼                           │
│                              工具执行 + 结果增强                 │
│                                      │                           │
│                                      ▼                           │
│                                  生成回复                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                  Post-Processing (异步)                          │
│  - 记录 reasoning 日志                                          │
│  - 更新用户偏好（P2）                                           │
│  - 刷新统计缓存（如有操作）                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

_文档版本: 4.3.1_
_作者: AI Assistant_
_审核人: [待填写]_
_最后更新: 2025-12-26_
_变更说明: 新增模型分层策略(模块2)和智能错误恢复(模块6)_
