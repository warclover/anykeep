# AnyKeep AI 秘书进化技术设计文档 v1.0

> **文档版本**: 1.0.0
> **创建日期**: 2025-12-30
> **作者**: Winston (System Architect)
> **状态**: 草案 (Draft)

---

## 目录

1. [背景与目标](#1-背景与目标)
2. [问题诊断](#2-问题诊断)
3. [设计原则](#3-设计原则)
4. [架构总览](#4-架构总览)
5. [核心模块设计](#5-核心模块设计)
   - 5.1 [主动简报引擎](#51-主动简报引擎-proactive-briefing-engine)
   - 5.2 [慢思考层](#52-慢思考层-slow-thinking-layer)
   - 5.3 [全局洞察服务](#53-全局洞察服务-global-insight-service)
   - 5.4 [意图预测模块](#54-意图预测模块-intent-predictor)
   - 5.5 [偏好规则学习](#55-偏好规则学习-preference-rule-learning)
   - 5.6 [异步分析服务](#56-异步分析服务-async-analysis-service)
   - 5.7 [上下文记忆增强](#57-上下文记忆增强-context-memory-enhancement)
6. [数据库设计](#6-数据库设计)
7. [API 设计](#7-api-设计)
8. [与现有架构融合](#8-与现有架构融合)
9. [实施计划](#9-实施计划)
10. [风险评估与缓解](#10-风险评估与缓解)
11. [成功指标](#11-成功指标)
12. [附录](#12-附录)

---

## 1. 背景与目标

### 1.1 现状分析

AnyKeep 当前的 AI Agent 架构虽然在工程上已相当完整（24 个 Skills、意图分类、上下文管理等），但在实际使用体验上仍然停留在「自动工具」层面，距离设计初衷的「专家秘书」存在显著差距。

**用户反馈的核心痛点**：

- AI 只能执行明确的用户指令，缺乏主动性
- 每次打开应用都是"空状态"，需要用户主动发起对话
- 对话之间缺乏连续性，AI "不记得"之前的交流
- 即使有 24 个 Skills，用户感受不到"智能"

**使用场景特点**：

- **偶发性使用**：用户使用频率不高
- **高价值收藏**：用户浏览到好内容时才触发收藏欲望
- **学习驱动**：用户期望 AI 帮助内化收藏内容

### 1.2 目标定义

**核心目标**：从「被动响应的工具」转变为「主动管理的数字秘书」

**具体目标**：

| 维度       | 当前状态      | 目标状态           | 衡量指标                 |
| ---------- | ------------- | ------------------ | ------------------------ |
| **主动性** | 等待用户输入  | 主动推送洞察和建议 | 主动简报使用率 > 60%     |
| **连续性** | 每次对话孤立  | 跨会话记忆保持     | 用户感知连续性评分 > 4/5 |
| **深度**   | 快速路由执行  | 深度思考后执行     | 任务完成质量评分 > 4/5   |
| **认知**   | 局部 RAG 检索 | 全局知识画像       | 推荐准确率 > 70%         |
| **学习**   | 静态偏好配置  | 动态规则学习       | 自动化程度提升 > 30%     |

### 1.3 设计约束

1. **零破坏性变更**：所有新能力通过扩展而非重构实现
2. **渐进式发布**：Feature Flags 控制，支持灰度发布
3. **成本可控**：避免过度依赖 LLM 调用，优先使用规则和缓存
4. **偶发场景适配**：利用用户"不在场"时间创造价值

---

## 2. 问题诊断

### 2.1 架构层面的范式问题

| 当前状态                      | 目标状态                              | 差距根源                         |
| ----------------------------- | ------------------------------------- | -------------------------------- |
| **Reactive（被动）**          | **Proactive（主动）**                 | Agent 只在用户输入时"醒来"       |
| **Task-Isolated（任务孤立）** | **Context-Aware（全局认知）**         | RAG 仅检索局部事实，无法形成洞察 |
| **Fast Routing（快速路由）**  | **Deep Reasoning（深度推理）**        | 缺少 System 2 慢思考层           |
| **Text Output（文本输出）**   | **Actionable Artifact（结构化交付）** | 回复即结束，无持续价值           |
| **Static Config（静态配置）** | **Dynamic Learning（动态学习）**      | 偏好配置不会自动演化             |

### 2.2 用户体验层面的问题

```
用户期望的交互模式：
┌─────────────────────────────────────────────────────────────┐
│ 用户打开 App                                                 │
│     ↓                                                        │
│ 秘书："老板，自你上次（3天前）离线以来，我处理了 5 篇新文章。│
│       我发现你最近在关注 LLM 架构，已为你汇总了对比报告，    │
│       建议你先花 2 分钟阅读第二篇。"                         │
│     ↓                                                        │
│ 用户感受到"智能"和"被关心"                                   │
└─────────────────────────────────────────────────────────────┘

当前实际的交互模式：
┌─────────────────────────────────────────────────────────────┐
│ 用户打开 App                                                 │
│     ↓                                                        │
│ AI："你好，请问需要什么帮助？"                               │
│     ↓                                                        │
│ 用户感受到"又是一个等待指令的工具"                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 "秘书感"的本质特征

通过分析，"秘书感"的核心来源于：

1. **主动性**：不等老板开口就准备好信息
2. **记忆力**：记得上次交代的事和偏好
3. **前瞻性**：预判需求，提前准备
4. **深度思考**：理解背后的意图，而非字面执行
5. **持续学习**：越用越懂你

---

## 3. 设计原则

### 3.1 核心设计哲学

> **"秘书感"来源于离线时的思考与上线时的惊喜。**

针对偶发性使用场景，Agent 必须在用户"不在场"的时间里通过异步处理创造价值，并在用户"在场"时通过高度浓缩的洞察减少用户的认知负荷。

### 3.2 具体设计原则

| 原则               | 说明                             | 实践                   |
| ------------------ | -------------------------------- | ---------------------- |
| **懒惰馆长**       | 不追求实时 Cron，利用延迟触发    | 用户上线时触发异步分析 |
| **最小可感知改进** | 找到最能让用户感知智能的单点突破 | 优先实现主动简报       |
| **做少做精**       | 聚焦 3-5 个高频场景深度优化      | 收藏后、回顾时、学习时 |
| **透明即信任**     | 让用户看到 AI 的思考过程         | 显示内心独白           |
| **上下文丰富**     | 问题不在分类准确率，在上下文贫瘠 | 注入更多动态上下文     |

### 3.3 场景聚焦

| 场景       | 用户心智               | Agent 行为              | 优先级 |
| ---------- | ---------------------- | ----------------------- | ------ |
| **收藏后** | "我存了，回头再看"     | 自动深度处理 + 下次提醒 | P0     |
| **回顾时** | "我之前存的那个..."    | 语义搜索 + 相关推荐     | P0     |
| **学习时** | "帮我整理一下这个主题" | 主题合成 + 学习路径     | P1     |
| **空闲时** | 无明确需求             | 主动推送洞察            | P1     |

---

## 4. 架构总览

### 4.1 目标架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户请求                                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UnifiedEngine v3.1 (扩展)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │InputPreproc  │  │🆕 SlowThink  │  │ExecCoordnr   │  │OutputEnhncr  │     │
│  │(记忆注入)    │  │(内心独白)    │  │(执行协调)    │  │(输出增强)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │                  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     IntentRouter v2.0 (扩展)                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │   │
│  │  │Classifier  │  │Complexity  │  │ModeSelect  │  │🆕Predictor │      │   │
│  │  │(意图分类)  │  │(复杂度)    │  │(模式选择)  │  │(意图预测)  │      │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────────┐
│  KnowledgeAgent   │    │  Orchestration    │    │ 🆕 AsyncAnalysis      │
│  (原子模式)       │    │  Skills (24个)    │    │ Service (后台)        │
└───────────────────┘    └───────────────────┘    └───────────────────────┘
            │                       │                       │
            └───────────────────────┼───────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Context Layer v2.0 (扩展)                            │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐     │
│  │ DynamicContext     │  │ SessionMemory      │  │🆕GlobalInsight     │     │
│  │ + ProactiveBriefing│  │ + CrossSession     │  │ Service            │     │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘     │
│                                    │                                         │
│  ┌────────────────────┐  ┌────────────────────────────────────────────┐     │
│  │ PreferencesService │  │🆕PreferenceLearning + RuleExtractor        │     │
│  │ (现有)             │  │ (扩展：从纠正中学习规则)                   │     │
│  └────────────────────┘  └────────────────────────────────────────────┘     │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Supabase (扩展)                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐       │
│  │ profiles         │  │ ai_session_      │  │🆕proactive_insights │       │
│  │ + globalInsight  │  │ memory (扩展)    │  │ (主动洞察存储)       │       │
│  │ + customRules    │  │                  │  │                      │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 新增模块概览

| 模块                        | 职责                   | 优先级 | 依赖                          |
| --------------------------- | ---------------------- | ------ | ----------------------------- |
| **ProactiveBriefingEngine** | 主动简报生成与推送     | P0     | DynamicContext, GlobalInsight |
| **SlowThinkingLayer**       | 内心独白生成，深度推理 | P0     | ExecutionCoordinator          |
| **GlobalInsightService**    | 全局知识画像，趋势分析 | P1     | AsyncAnalysis                 |
| **IntentPredictor**         | 意图预测，主动建议     | P1     | IntentRouter                  |
| **RuleExtractor**           | 从纠正行为中学习规则   | P2     | PreferenceLearning            |
| **AsyncAnalysisService**    | 后台异步分析任务       | P2     | -                             |
| **CrossSessionMemory**      | 跨会话记忆持久化       | P1     | SessionMemory                 |

---

## 5. 核心模块设计

### 5.1 主动简报引擎 (Proactive Briefing Engine)

#### 5.1.1 设计目标

将用户进入 App 的动作转化为"听取汇报"，打破"空状态"的尴尬。

#### 5.1.2 核心逻辑

```
用户打开 App
    ↓
检查上次访问时间
    ↓
计算离线期间的变化
    ├── 新增收藏数量
    ├── 主题分布变化
    ├── 待处理任务
    └── 洞察发现
    ↓
生成简报内容
    ↓
推送到首页组件
```

#### 5.1.3 类型定义

```typescript
// src/lib/ai-agent/proactive-briefing/types.ts

/**
 * 主动简报配置
 */
interface ProactiveBriefingConfig {
  /** 最小离线时长（毫秒），低于此值不生成简报 */
  minOfflineDuration: number; // 默认 4 小时
  /** 最大洞察数量 */
  maxInsights: number; // 默认 5
  /** 最大建议操作数量 */
  maxSuggestions: number; // 默认 3
  /** 是否启用 LLM 生成摘要 */
  enableLLMSummary: boolean; // 默认 true
}

/**
 * 主动简报数据
 */
interface ProactiveBriefing {
  /** 是否启用简报 */
  enabled: boolean;
  /** 上次访问时间 */
  lastVisit: string;
  /** 离线天数 */
  daysSinceLastVisit: number;
  /** 离线期间新增收藏数 */
  newCollectionsCount: number;
  /** 主题变化摘要 */
  topicChangeSummary?: string;
  /** 待推送的洞察列表 */
  pendingInsights: ProactiveInsight[];
  /** 建议的操作 */
  suggestedActions: SuggestedAction[];
  /** 生成时间 */
  generatedAt: string;
}

/**
 * 单条洞察
 */
interface ProactiveInsight {
  /** 洞察 ID */
  id: string;
  /** 洞察类型 */
  type: InsightType;
  /** 标题 */
  title: string;
  /** 摘要内容 */
  summary: string;
  /** 相关书签 ID 列表 */
  relatedBookmarkIds: number[];
  /** 优先级 (1-10, 10 最高) */
  priority: number;
  /** 创建时间 */
  createdAt: string;
  /** 是否已读 */
  isRead: boolean;
}

type InsightType =
  | "topic_emergence" // 新主题涌现
  | "pattern_detected" // 模式检测
  | "recommendation" // 推荐内容
  | "knowledge_gap" // 知识盲区
  | "content_update" // 内容更新
  | "link_health"; // 链接健康

/**
 * 建议操作
 */
interface SuggestedAction {
  /** 操作 ID */
  id: string;
  /** 操作类型 */
  type: ActionType;
  /** 显示文本 */
  label: string;
  /** 操作描述 */
  description: string;
  /** 预估影响范围 */
  affectedCount?: number;
  /** 一键执行的参数 */
  executeParams?: Record<string, unknown>;
}

type ActionType =
  | "organize_topic" // 整理主题
  | "review_unread" // 复习未读
  | "cleanup_duplicates" // 清理重复
  | "tag_untagged" // 标记未标签
  | "archive_old"; // 归档旧内容
```

#### 5.1.4 服务实现

```typescript
// src/lib/ai-agent/proactive-briefing/proactive-briefing-service.ts

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  ProactiveBriefing,
  ProactiveInsight,
  SuggestedAction,
  ProactiveBriefingConfig,
} from "./types";

const DEFAULT_CONFIG: ProactiveBriefingConfig = {
  minOfflineDuration: 4 * 60 * 60 * 1000, // 4 小时
  maxInsights: 5,
  maxSuggestions: 3,
  enableLLMSummary: true,
};

export class ProactiveBriefingService {
  private config: ProactiveBriefingConfig;
  private insightGenerators: InsightGenerator[];

  constructor(config: Partial<ProactiveBriefingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.insightGenerators = [
      new TopicEmergenceGenerator(),
      new PatternDetectionGenerator(),
      new KnowledgeGapGenerator(),
    ];
  }

  /**
   * 生成主动简报
   */
  async generateBriefing(userId: string): Promise<ProactiveBriefing | null> {
    const startTime = Date.now();

    try {
      // 1. 获取上次访问时间
      const lastVisit = await this.getLastVisitTime(userId);
      const offlineDuration = Date.now() - lastVisit.getTime();

      // 如果离线时间太短，不生成简报
      if (offlineDuration < this.config.minOfflineDuration) {
        logger.debug(
          { userId, offlineDuration },
          "Offline duration too short, skip briefing",
        );
        return null;
      }

      // 2. 收集离线期间的变化数据
      const changes = await this.collectOfflineChanges(userId, lastVisit);

      // 3. 生成洞察
      const insights = await this.generateInsights(userId, changes);

      // 4. 生成建议操作
      const suggestions = await this.generateSuggestions(
        userId,
        changes,
        insights,
      );

      // 5. 可选：使用 LLM 生成摘要
      let topicChangeSummary: string | undefined;
      if (this.config.enableLLMSummary && insights.length > 0) {
        topicChangeSummary = await this.generateLLMSummary(changes, insights);
      }

      const briefing: ProactiveBriefing = {
        enabled: true,
        lastVisit: lastVisit.toISOString(),
        daysSinceLastVisit: Math.floor(offlineDuration / (24 * 60 * 60 * 1000)),
        newCollectionsCount: changes.newBookmarksCount,
        topicChangeSummary,
        pendingInsights: insights.slice(0, this.config.maxInsights),
        suggestedActions: suggestions.slice(0, this.config.maxSuggestions),
        generatedAt: new Date().toISOString(),
      };

      // 6. 持久化简报（用于审计和分析）
      await this.saveBriefing(userId, briefing);

      // 7. 更新最后访问时间
      await this.updateLastVisitTime(userId);

      logger.info(
        {
          userId,
          insightCount: insights.length,
          duration: Date.now() - startTime,
        },
        "Proactive briefing generated",
      );

      return briefing;
    } catch (error) {
      logger.error({ userId, error }, "Failed to generate proactive briefing");
      return null;
    }
  }

  /**
   * 收集离线期间的变化
   */
  private async collectOfflineChanges(
    userId: string,
    since: Date,
  ): Promise<OfflineChanges> {
    const supabase = await createClient();

    // 并行查询多个维度的变化
    const [newBookmarks, topicDistribution, untaggedCount, pendingReviews] =
      await Promise.all([
        // 新增书签
        supabase
          .from("bookmarks")
          .select("id, title, platform, tags, created_at")
          .eq("user_id", userId)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false }),

        // 主题分布变化
        this.analyzeTopicDistribution(userId, since),

        // 未标签数量
        supabase
          .from("bookmarks")
          .select("id", { count: "exact" })
          .eq("user_id", userId)
          .or("tags.is.null,tags.eq.{}"),

        // 待复习数量
        this.getPendingReviewCount(userId),
      ]);

    return {
      newBookmarksCount: newBookmarks.data?.length ?? 0,
      newBookmarks: newBookmarks.data ?? [],
      topicDistribution,
      untaggedCount: untaggedCount.count ?? 0,
      pendingReviewsCount: pendingReviews,
      since,
    };
  }

  /**
   * 生成洞察列表
   */
  private async generateInsights(
    userId: string,
    changes: OfflineChanges,
  ): Promise<ProactiveInsight[]> {
    const allInsights: ProactiveInsight[] = [];

    // 使用各个生成器生成洞察
    for (const generator of this.insightGenerators) {
      try {
        const insights = await generator.generate(userId, changes);
        allInsights.push(...insights);
      } catch (error) {
        logger.warn(
          { generator: generator.name, error },
          "Insight generator failed",
        );
      }
    }

    // 按优先级排序
    return allInsights.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 生成建议操作
   */
  private async generateSuggestions(
    userId: string,
    changes: OfflineChanges,
    insights: ProactiveInsight[],
  ): Promise<SuggestedAction[]> {
    const suggestions: SuggestedAction[] = [];

    // 根据变化数据生成建议
    if (changes.untaggedCount > 10) {
      suggestions.push({
        id: `suggest_tag_${Date.now()}`,
        type: "tag_untagged",
        label: "智能标签",
        description: `有 ${changes.untaggedCount} 条收藏未添加标签，是否需要我帮你自动分类？`,
        affectedCount: changes.untaggedCount,
        executeParams: { skillId: "smart_tagging" },
      });
    }

    if (changes.pendingReviewsCount > 0) {
      suggestions.push({
        id: `suggest_review_${Date.now()}`,
        type: "review_unread",
        label: "开始复习",
        description: `有 ${changes.pendingReviewsCount} 条内容等待复习`,
        affectedCount: changes.pendingReviewsCount,
        executeParams: { skillId: "active_recall" },
      });
    }

    // 根据洞察生成建议
    const topicInsight = insights.find((i) => i.type === "topic_emergence");
    if (topicInsight) {
      suggestions.push({
        id: `suggest_organize_${Date.now()}`,
        type: "organize_topic",
        label: "整理新主题",
        description: topicInsight.summary,
        affectedCount: topicInsight.relatedBookmarkIds.length,
        executeParams: {
          skillId: "batch_organize",
          bookmarkIds: topicInsight.relatedBookmarkIds,
        },
      });
    }

    return suggestions;
  }

  /**
   * 使用 LLM 生成摘要
   */
  private async generateLLMSummary(
    changes: OfflineChanges,
    insights: ProactiveInsight[],
  ): Promise<string> {
    // 实现 LLM 调用生成自然语言摘要
    // 使用 fast 模型降低成本
    const prompt = this.buildSummaryPrompt(changes, insights);
    // TODO: 调用 LLM
    return `在你离开的 ${changes.newBookmarksCount} 天里，我注意到你收藏了一些新内容...`;
  }

  // ... 其他辅助方法
}
```

#### 5.1.5 与 DynamicContext 集成

```typescript
// src/lib/ai-agent/context/dynamic-context-builder.ts（扩展）

interface DynamicContext {
  // ... 现有字段

  /** 🆕 主动简报数据 */
  proactiveBriefing?: ProactiveBriefing;
}

export class DynamicContextBuilder {
  private proactiveBriefingService: ProactiveBriefingService;

  async buildContext(userId: string): Promise<DynamicContext> {
    const [
      // ... 现有并行查询
      proactiveBriefing,
    ] = await Promise.all([
      // ... 现有查询
      featureFlags.isEnabled("ENABLE_PROACTIVE_BRIEFING")
        ? this.proactiveBriefingService.generateBriefing(userId)
        : null,
    ]);

    return {
      // ... 现有字段
      proactiveBriefing,
    };
  }
}
```

#### 5.1.6 前端组件集成

```typescript
// src/components/ai/proactive-briefing-card.tsx

'use client';

import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProactiveBriefing } from '@/lib/ai-agent/proactive-briefing/types';

interface ProactiveBriefingCardProps {
  briefing: ProactiveBriefing;
  onActionClick: (action: SuggestedAction) => void;
  onDismiss: () => void;
}

export function ProactiveBriefingCard({
  briefing,
  onActionClick,
  onDismiss,
}: ProactiveBriefingCardProps) {
  if (!briefing.enabled || briefing.pendingInsights.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="font-medium">秘书汇报</span>
            <Badge variant="secondary" className="text-xs">
              {briefing.daysSinceLastVisit} 天未见
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            稍后再看
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 摘要 */}
        {briefing.topicChangeSummary && (
          <p className="text-sm text-muted-foreground mb-4">
            {briefing.topicChangeSummary}
          </p>
        )}

        {/* 洞察列表 */}
        <div className="space-y-2 mb-4">
          {briefing.pendingInsights.slice(0, 3).map((insight) => (
            <div key={insight.id} className="flex items-start gap-2">
              <InsightIcon type={insight.type} />
              <div>
                <p className="text-sm font-medium">{insight.title}</p>
                <p className="text-xs text-muted-foreground">{insight.summary}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 建议操作 */}
        <div className="flex gap-2">
          {briefing.suggestedActions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              onClick={() => onActionClick(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 5.2 慢思考层 (Slow Thinking Layer)

#### 5.2.1 设计目标

在执行任何任务前，Agent 进行一段"自我对话"，理解用户的深层意图，而非字面执行。

#### 5.2.2 核心理念

借鉴 System 2 思维和 DeepSeek-R1 / OpenAI o1 的思路：

```
用户说："整理一下我的书签。"

快思考（当前）:
    → 意图分类: organize
    → 执行 batch_organize Skill
    → 输出: "已按类别整理..."

慢思考（目标）:
    → 内心独白: "用户说整理，但我发现他最近正在准备 AI 研讨会。
                 直接按类别整理太普通了，我应该：
                 1. 先识别出与研讨会相关的核心文献
                 2. 把它们挑出来单独标记
                 3. 其他的按时序归类
                 4. 检查有没有失效的链接
                 这样老板明天开会时能快速找到需要的资料。"
    → 执行定制化整理策略
    → 输出: "我注意到你最近在准备 AI 研讨会，所以我优先整理了相关的 12 篇文献..."
```

#### 5.2.3 类型定义

```typescript
// src/lib/ai-agent/slow-thinking/types.ts

/**
 * 内心独白配置
 */
interface SlowThinkingConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 是否向用户展示思考过程 */
  showToUser: boolean;
  /** 最大思考时间（毫秒） */
  maxThinkingTime: number; // 默认 5000
  /** 使用的模型层级 */
  modelTier: "fast" | "standard" | "deep"; // 默认 'standard'
  /** 触发慢思考的复杂度阈值 */
  complexityThreshold: number; // 默认 40
}

/**
 * 内心独白结果
 */
interface InternalMonologue {
  /** 原始用户输入 */
  originalInput: string;
  /** 思考内容 */
  thinking: string;
  /** 推理步骤 */
  reasoningSteps: ReasoningStep[];
  /** 推断的用户真实意图 */
  inferredIntent: string;
  /** 推断的用户目标 */
  inferredGoal?: string;
  /** 建议的执行策略 */
  suggestedStrategy: ExecutionStrategy;
  /** 是否建议修改路由 */
  suggestRouteChange: boolean;
  /** 修改后的路由（如果建议修改） */
  modifiedRoute?: Partial<RouteResult>;
  /** 思考耗时（毫秒） */
  thinkingDurationMs: number;
  /** 置信度 */
  confidence: number;
}

/**
 * 推理步骤
 */
interface ReasoningStep {
  /** 步骤序号 */
  step: number;
  /** 思考内容 */
  thought: string;
  /** 得出的结论 */
  conclusion?: string;
}

/**
 * 执行策略
 */
interface ExecutionStrategy {
  /** 策略类型 */
  type: "default" | "customized" | "multi_step";
  /** 策略描述 */
  description: string;
  /** 预处理步骤 */
  preProcessing?: string[];
  /** 后处理步骤 */
  postProcessing?: string[];
  /** 额外上下文注入 */
  additionalContext?: Record<string, unknown>;
}
```

#### 5.2.4 服务实现

```typescript
// src/lib/ai-agent/slow-thinking/slow-thinking-service.ts

import { generateText } from "ai";
import { getModelByTier } from "@/lib/ai-agent/config/model-tiering";
import { logger } from "@/lib/logger";
import type {
  SlowThinkingConfig,
  InternalMonologue,
  ReasoningStep,
} from "./types";
import type { RouteResult } from "@/lib/ai-skills/router/types";
import type { DynamicContext } from "@/lib/ai-agent/context/types";

const DEFAULT_CONFIG: SlowThinkingConfig = {
  enabled: true,
  showToUser: true,
  maxThinkingTime: 5000,
  modelTier: "standard",
  complexityThreshold: 40,
};

export class SlowThinkingService {
  private config: SlowThinkingConfig;

  constructor(config: Partial<SlowThinkingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成内心独白
   */
  async generateMonologue(
    userMessage: string,
    routeResult: RouteResult,
    context: DynamicContext,
  ): Promise<InternalMonologue | null> {
    // 检查是否需要慢思考
    if (!this.shouldThink(routeResult)) {
      return null;
    }

    const startTime = Date.now();

    try {
      const prompt = this.buildThinkingPrompt(
        userMessage,
        routeResult,
        context,
      );

      const model = getModelByTier(this.config.modelTier);

      const result = await generateText({
        model,
        prompt,
        maxTokens: 1000,
        temperature: 0.7,
      });

      const monologue = this.parseMonologue(result.text, userMessage);
      monologue.thinkingDurationMs = Date.now() - startTime;

      logger.info(
        {
          userMessage: userMessage.slice(0, 50),
          duration: monologue.thinkingDurationMs,
          suggestRouteChange: monologue.suggestRouteChange,
        },
        "Slow thinking completed",
      );

      return monologue;
    } catch (error) {
      logger.error({ error }, "Slow thinking failed");
      return null;
    }
  }

  /**
   * 判断是否需要慢思考
   */
  private shouldThink(routeResult: RouteResult): boolean {
    if (!this.config.enabled) return false;

    // 复杂度超过阈值才触发
    if (routeResult.complexity.score < this.config.complexityThreshold) {
      return false;
    }

    // 特定意图类型总是触发
    const alwaysThinkIntents = ["organize", "analyze", "learn"];
    if (alwaysThinkIntents.includes(routeResult.intent.type)) {
      return true;
    }

    return routeResult.complexity.level !== "simple";
  }

  /**
   * 构建思考 Prompt
   */
  private buildThinkingPrompt(
    userMessage: string,
    routeResult: RouteResult,
    context: DynamicContext,
  ): string {
    return `你是一个专业的知识管理秘书，正在分析用户的请求。

## 用户请求
"${userMessage}"

## 初步分析
- 意图分类: ${routeResult.intent.type} (${routeResult.intent.subType})
- 复杂度: ${routeResult.complexity.level} (${routeResult.complexity.score}/100)
- 默认执行模式: ${routeResult.mode}

## 用户上下文
- 总收藏数: ${context.stats?.totalBookmarks ?? "未知"}
- 最近活跃: ${context.recentActivity?.lastSaved?.title ?? "无"}
- 主要关注: ${
      context.globalInsight?.topicDistribution
        ?.slice(0, 3)
        .map((t) => t.topic)
        .join(", ") ?? "未知"
    }
${context.proactiveBriefing ? `- 离线天数: ${context.proactiveBriefing.daysSinceLastVisit}` : ""}

## 任务
请进行深度思考，输出你的内心独白。格式如下：

<thinking>
[你的思考过程，包括：
1. 用户字面上说了什么？
2. 用户真正想要什么？（深层意图）
3. 用户当前的状态和需求是什么？
4. 默认的执行方式是否最优？
5. 有没有更好的执行策略？]
</thinking>

<inferred_intent>
[用户的真实意图，一句话]
</inferred_intent>

<inferred_goal>
[用户的最终目标，如果能推断的话]
</inferred_goal>

<strategy>
type: [default | customized | multi_step]
description: [策略描述]
pre_processing: [可选，预处理步骤]
post_processing: [可选，后处理步骤]
</strategy>

<suggest_route_change>
[true | false]
</suggest_route_change>

<confidence>
[0-100]
</confidence>`;
  }

  /**
   * 解析 LLM 输出
   */
  private parseMonologue(
    llmOutput: string,
    originalInput: string,
  ): InternalMonologue {
    // 解析各个部分
    const thinking = this.extractTag(llmOutput, "thinking") ?? "";
    const inferredIntent =
      this.extractTag(llmOutput, "inferred_intent") ?? originalInput;
    const inferredGoal = this.extractTag(llmOutput, "inferred_goal");
    const strategyStr = this.extractTag(llmOutput, "strategy") ?? "";
    const suggestChange =
      this.extractTag(llmOutput, "suggest_route_change") === "true";
    const confidence = parseInt(
      this.extractTag(llmOutput, "confidence") ?? "70",
      10,
    );

    // 解析推理步骤
    const reasoningSteps = this.parseReasoningSteps(thinking);

    // 解析策略
    const suggestedStrategy = this.parseStrategy(strategyStr);

    return {
      originalInput,
      thinking,
      reasoningSteps,
      inferredIntent,
      inferredGoal,
      suggestedStrategy,
      suggestRouteChange: suggestChange,
      thinkingDurationMs: 0, // 由调用方填充
      confidence,
    };
  }

  private extractTag(text: string, tag: string): string | undefined {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
    const match = text.match(regex);
    return match?.[1]?.trim();
  }

  private parseReasoningSteps(thinking: string): ReasoningStep[] {
    const steps: ReasoningStep[] = [];
    const lines = thinking.split("\n").filter((l) => l.trim());

    lines.forEach((line, index) => {
      if (line.match(/^\d+\./)) {
        steps.push({
          step: index + 1,
          thought: line.replace(/^\d+\./, "").trim(),
        });
      }
    });

    return steps;
  }

  private parseStrategy(strategyStr: string): ExecutionStrategy {
    // 简化解析，实际实现需要更健壮
    const typeMatch = strategyStr.match(/type:\s*(\w+)/);
    const descMatch = strategyStr.match(/description:\s*(.+)/);

    return {
      type: (typeMatch?.[1] as ExecutionStrategy["type"]) ?? "default",
      description: descMatch?.[1] ?? "",
    };
  }
}
```

#### 5.2.5 与 ExecutionCoordinator 集成

```typescript
// src/lib/ai-skills/engine/execution-coordinator.ts（扩展）

import { SlowThinkingService } from "@/lib/ai-agent/slow-thinking";
import { featureFlags } from "@/lib/ai-agent/config/feature-flags";

export class ExecutionCoordinator {
  private slowThinkingService: SlowThinkingService;

  async *coordinate(
    message: string,
    routeResult: RouteResult,
    context: EngineContext,
    options: EngineExecuteOptions,
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 🆕 Step 0: 慢思考（如果启用）
    if (featureFlags.isEnabled("ENABLE_SLOW_THINKING")) {
      const dynamicContext = await this.contextBuilder.buildContext(
        context.userId,
      );

      const monologue = await this.slowThinkingService.generateMonologue(
        message,
        routeResult,
        dynamicContext,
      );

      if (monologue) {
        // 输出思考过程（如果配置为用户可见）
        if (this.slowThinkingService.config.showToUser) {
          yield {
            type: "thinking",
            data: {
              monologue: monologue.thinking,
              reasoning: monologue.reasoningSteps.map((s) => s.thought),
              inferredIntent: monologue.inferredIntent,
              confidence: monologue.confidence,
            },
          };
        }

        // 思考可能修正路由决策
        if (monologue.suggestRouteChange && monologue.modifiedRoute) {
          routeResult = { ...routeResult, ...monologue.modifiedRoute };

          yield {
            type: "routing",
            data: {
              mode: routeResult.mode,
              reason: `基于深度分析调整: ${monologue.suggestedStrategy.description}`,
              confidence: monologue.confidence,
            },
          };
        }

        // 注入额外上下文
        if (monologue.suggestedStrategy.additionalContext) {
          context = {
            ...context,
            ...monologue.suggestedStrategy.additionalContext,
          };
        }
      }
    }

    // ... 继续现有执行流程
    yield* this.executeRoute(routeResult, context, options);
  }
}
```

#### 5.2.6 新增流类型

```typescript
// src/lib/ai-skills/output/types.ts（扩展）

/**
 * 🆕 思考过程输出块
 */
interface ThinkingChunk {
  type: "thinking";
  data: {
    /** 内心独白全文 */
    monologue: string;
    /** 推理步骤列表 */
    reasoning: string[];
    /** 推断的用户意图 */
    inferredIntent: string;
    /** 置信度 */
    confidence: number;
  };
}

// 扩展联合类型
type UnifiedStreamChunk =
  | TextChunk
  | ProgressChunk
  | DeliverableChunk
  | ConfirmationChunk
  | RoutingChunk
  | FallbackChunk
  | ErrorChunk
  | DoneChunk
  | ThinkingChunk; // 🆕
```

---

### 5.3 全局洞察服务 (Global Insight Service)

#### 5.3.1 设计目标

超越局部 RAG 检索，为用户的整个知识库生成"宏观画像"，让 AI 理解：

- 用户的关注点在过去三个月是如何变化的
- 哪些是核心知识，哪些是边缘兴趣
- 知识库中存在哪些盲区

#### 5.3.2 类型定义

```typescript
// src/lib/ai-agent/global-insight/types.ts

/**
 * 全局洞察数据
 */
interface GlobalInsight {
  /** 版本号 */
  version: number;
  /** 主题分布 */
  topicDistribution: TopicWeight[];
  /** 兴趣趋势（30天） */
  interestTrend: TrendPoint[];
  /** 知识盲区 */
  knowledgeGaps: string[];
  /** 核心知识领域 */
  coreKnowledge: string[];
  /** 边缘兴趣 */
  peripheralInterests: string[];
  /** 平台偏好 */
  platformPreference: PlatformWeight[];
  /** 活跃时段 */
  activeTimeSlots: TimeSlot[];
  /** 最后分析时间 */
  lastAnalyzedAt: string;
  /** 分析覆盖的书签数 */
  analyzedBookmarkCount: number;
}

/**
 * 主题权重
 */
interface TopicWeight {
  /** 主题名称 */
  topic: string;
  /** 权重 (0-1) */
  weight: number;
  /** 相关书签数 */
  bookmarkCount: number;
  /** 最近活跃度 (0-1) */
  recentActivity: number;
  /** 趋势方向 */
  trend: "rising" | "stable" | "declining";
}

/**
 * 趋势点
 */
interface TrendPoint {
  /** 日期 */
  date: string;
  /** 主题 */
  topic: string;
  /** 活跃度 */
  activity: number;
}

/**
 * 平台权重
 */
interface PlatformWeight {
  /** 平台标识 */
  platform: string;
  /** 权重 (0-1) */
  weight: number;
  /** 书签数 */
  bookmarkCount: number;
}

/**
 * 活跃时段
 */
interface TimeSlot {
  /** 星期几 (0-6) */
  dayOfWeek: number;
  /** 小时 (0-23) */
  hour: number;
  /** 活跃度 */
  activity: number;
}
```

#### 5.3.3 服务实现

```typescript
// src/lib/ai-agent/global-insight/global-insight-service.ts

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { GlobalInsight, TopicWeight, TrendPoint } from "./types";

/**
 * 全局洞察服务配置
 */
interface GlobalInsightConfig {
  /** 分析周期（天） */
  analysisPeriodDays: number; // 默认 90
  /** 最大主题数 */
  maxTopics: number; // 默认 20
  /** 更新间隔（小时） */
  updateIntervalHours: number; // 默认 24
  /** 是否使用 LLM 辅助分析 */
  enableLLMAnalysis: boolean; // 默认 true
}

const DEFAULT_CONFIG: GlobalInsightConfig = {
  analysisPeriodDays: 90,
  maxTopics: 20,
  updateIntervalHours: 24,
  enableLLMAnalysis: true,
};

export class GlobalInsightService {
  private config: GlobalInsightConfig;

  constructor(config: Partial<GlobalInsightConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取或生成全局洞察
   */
  async getInsight(
    userId: string,
    forceRefresh = false,
  ): Promise<GlobalInsight | null> {
    // 1. 尝试从缓存获取
    if (!forceRefresh) {
      const cached = await this.getCachedInsight(userId);
      if (cached && this.isInsightFresh(cached)) {
        return cached;
      }
    }

    // 2. 生成新的洞察
    return this.generateInsight(userId);
  }

  /**
   * 生成全局洞察
   */
  async generateInsight(userId: string): Promise<GlobalInsight | null> {
    const startTime = Date.now();

    try {
      const supabase = await createClient();

      // 1. 获取用户所有书签
      const { data: bookmarks, error } = await supabase
        .from("bookmarks")
        .select("id, title, tags, platform, created_at, summary")
        .eq("user_id", userId)
        .gte("created_at", this.getAnalysisStartDate().toISOString())
        .order("created_at", { ascending: false });

      if (error || !bookmarks?.length) {
        logger.warn(
          { userId, error },
          "No bookmarks found for insight generation",
        );
        return null;
      }

      // 2. 分析主题分布
      const topicDistribution = await this.analyzeTopicDistribution(bookmarks);

      // 3. 分析兴趣趋势
      const interestTrend = this.analyzeInterestTrend(
        bookmarks,
        topicDistribution,
      );

      // 4. 识别知识盲区
      const knowledgeGaps = await this.identifyKnowledgeGaps(topicDistribution);

      // 5. 识别核心知识和边缘兴趣
      const { coreKnowledge, peripheralInterests } =
        this.classifyKnowledge(topicDistribution);

      // 6. 分析平台偏好
      const platformPreference = this.analyzePlatformPreference(bookmarks);

      // 7. 分析活跃时段
      const activeTimeSlots = this.analyzeActiveTimeSlots(bookmarks);

      const insight: GlobalInsight = {
        version: 1,
        topicDistribution,
        interestTrend,
        knowledgeGaps,
        coreKnowledge,
        peripheralInterests,
        platformPreference,
        activeTimeSlots,
        lastAnalyzedAt: new Date().toISOString(),
        analyzedBookmarkCount: bookmarks.length,
      };

      // 8. 缓存洞察
      await this.cacheInsight(userId, insight);

      logger.info(
        {
          userId,
          bookmarkCount: bookmarks.length,
          duration: Date.now() - startTime,
        },
        "Global insight generated",
      );

      return insight;
    } catch (error) {
      logger.error({ userId, error }, "Failed to generate global insight");
      return null;
    }
  }

  /**
   * 分析主题分布
   */
  private async analyzeTopicDistribution(
    bookmarks: Array<{
      id: number;
      title: string;
      tags: string[];
      created_at: string;
    }>,
  ): Promise<TopicWeight[]> {
    // 1. 统计标签频率
    const tagFrequency = new Map<string, number>();
    const tagRecency = new Map<string, Date>();

    for (const bookmark of bookmarks) {
      const tags = bookmark.tags ?? [];
      const createdAt = new Date(bookmark.created_at);

      for (const tag of tags) {
        tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);

        const existing = tagRecency.get(tag);
        if (!existing || createdAt > existing) {
          tagRecency.set(tag, createdAt);
        }
      }
    }

    // 2. 计算权重
    const totalBookmarks = bookmarks.length;
    const now = new Date();
    const topics: TopicWeight[] = [];

    for (const [tag, count] of tagFrequency) {
      const weight = count / totalBookmarks;
      const lastActivity = tagRecency.get(tag) ?? now;
      const daysSinceActivity =
        (now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
      const recentActivity = Math.max(0, 1 - daysSinceActivity / 30);

      // 判断趋势
      const trend = this.calculateTrend(tag, bookmarks);

      topics.push({
        topic: tag,
        weight,
        bookmarkCount: count,
        recentActivity,
        trend,
      });
    }

    // 3. 排序并限制数量
    return topics
      .sort((a, b) => b.weight - a.weight)
      .slice(0, this.config.maxTopics);
  }

  /**
   * 计算主题趋势
   */
  private calculateTrend(
    tag: string,
    bookmarks: Array<{ tags: string[]; created_at: string }>,
  ): "rising" | "stable" | "declining" {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    let recentCount = 0;
    let olderCount = 0;

    for (const bookmark of bookmarks) {
      if (!bookmark.tags?.includes(tag)) continue;

      const createdAt = new Date(bookmark.created_at);
      if (createdAt >= thirtyDaysAgo) {
        recentCount++;
      } else if (createdAt >= sixtyDaysAgo) {
        olderCount++;
      }
    }

    if (recentCount > olderCount * 1.5) return "rising";
    if (recentCount < olderCount * 0.5) return "declining";
    return "stable";
  }

  /**
   * 识别知识盲区
   */
  private async identifyKnowledgeGaps(
    topicDistribution: TopicWeight[],
  ): Promise<string[]> {
    // 基于主题关联性识别可能的盲区
    // 例如：用户关注 React 但没有 TypeScript 相关内容
    const gaps: string[] = [];

    const topicRelations: Record<string, string[]> = {
      React: ["TypeScript", "Next.js", "Redux"],
      Python: ["机器学习", "数据分析", "Django"],
      AI: ["深度学习", "LLM", "Prompt Engineering"],
      // ... 更多关联
    };

    const existingTopics = new Set(topicDistribution.map((t) => t.topic));

    for (const topic of topicDistribution.slice(0, 5)) {
      const relatedTopics = topicRelations[topic.topic] ?? [];
      for (const related of relatedTopics) {
        if (!existingTopics.has(related)) {
          gaps.push(related);
        }
      }
    }

    return [...new Set(gaps)].slice(0, 5);
  }

  /**
   * 分类核心知识和边缘兴趣
   */
  private classifyKnowledge(topicDistribution: TopicWeight[]): {
    coreKnowledge: string[];
    peripheralInterests: string[];
  } {
    const totalWeight = topicDistribution.reduce((sum, t) => sum + t.weight, 0);
    const coreThreshold = totalWeight * 0.7;

    let accumulatedWeight = 0;
    const coreKnowledge: string[] = [];
    const peripheralInterests: string[] = [];

    for (const topic of topicDistribution) {
      if (accumulatedWeight < coreThreshold) {
        coreKnowledge.push(topic.topic);
        accumulatedWeight += topic.weight;
      } else {
        peripheralInterests.push(topic.topic);
      }
    }

    return { coreKnowledge, peripheralInterests };
  }

  // ... 其他分析方法

  /**
   * 获取缓存的洞察
   */
  private async getCachedInsight(
    userId: string,
  ): Promise<GlobalInsight | null> {
    const supabase = await createClient();

    const { data } = await supabase
      .from("profiles")
      .select("ai_preferences")
      .eq("id", userId)
      .single();

    return data?.ai_preferences?.globalInsight ?? null;
  }

  /**
   * 缓存洞察
   */
  private async cacheInsight(
    userId: string,
    insight: GlobalInsight,
  ): Promise<void> {
    const supabase = await createClient();

    await supabase.rpc("update_ai_global_insight", {
      p_user_id: userId,
      p_insight: insight,
    });
  }

  /**
   * 检查洞察是否新鲜
   */
  private isInsightFresh(insight: GlobalInsight): boolean {
    const lastAnalyzed = new Date(insight.lastAnalyzedAt);
    const now = new Date();
    const hoursSinceAnalysis =
      (now.getTime() - lastAnalyzed.getTime()) / (60 * 60 * 1000);
    return hoursSinceAnalysis < this.config.updateIntervalHours;
  }

  private getAnalysisStartDate(): Date {
    const now = new Date();
    return new Date(
      now.getTime() - this.config.analysisPeriodDays * 24 * 60 * 60 * 1000,
    );
  }
}
```

---

### 5.4 意图预测模块 (Intent Predictor)

#### 5.4.1 设计目标

基于用户历史行为预测下一步意图，支持：

- 主动简报中的"建议操作"
- 前端 UI 的"快捷操作"按钮
- System-Reminder 的智能提示

#### 5.4.2 类型定义

```typescript
// src/lib/ai-skills/router/intent-predictor/types.ts

/**
 * 预测的意图
 */
interface PredictedIntent {
  /** 意图类型 */
  intent: IntentType;
  /** 子类型 */
  subType?: string;
  /** 预测概率 (0-1) */
  probability: number;
  /** 触发条件描述 */
  triggerCondition: string;
  /** 建议的主动行为 */
  suggestedAction: string;
  /** 是否建议主动推送 */
  shouldPush: boolean;
}

/**
 * 意图历史记录
 */
interface IntentHistoryEntry {
  /** 意图类型 */
  intent: IntentType;
  /** 子类型 */
  subType?: string;
  /** 时间戳 */
  timestamp: number;
  /** 执行是否成功 */
  success: boolean;
  /** 用户满意度（如有反馈） */
  satisfaction?: number;
}

/**
 * 预测配置
 */
interface IntentPredictorConfig {
  /** 历史记录保留天数 */
  historyRetentionDays: number; // 默认 30
  /** 最小历史样本数 */
  minHistorySamples: number; // 默认 10
  /** 预测阈值 */
  predictionThreshold: number; // 默认 0.3
  /** 最大预测数量 */
  maxPredictions: number; // 默认 3
}
```

#### 5.4.3 服务实现

```typescript
// src/lib/ai-skills/router/intent-predictor/intent-predictor.ts

import { logger } from "@/lib/logger";
import type {
  PredictedIntent,
  IntentHistoryEntry,
  IntentPredictorConfig,
} from "./types";
import type { IntentClassification, IntentType } from "../types";

const DEFAULT_CONFIG: IntentPredictorConfig = {
  historyRetentionDays: 30,
  minHistorySamples: 10,
  predictionThreshold: 0.3,
  maxPredictions: 3,
};

export class IntentPredictor {
  private config: IntentPredictorConfig;

  // 意图转移矩阵（马尔可夫链）
  private transitionMatrix: Map<string, Map<string, number>> = new Map();

  constructor(config: Partial<IntentPredictorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 预测下一步意图
   */
  async predict(
    userId: string,
    currentMessage: string,
    currentIntent: IntentClassification,
  ): Promise<PredictedIntent[]> {
    try {
      // 1. 获取用户历史意图
      const history = await this.getIntentHistory(userId);

      if (history.length < this.config.minHistorySamples) {
        // 历史数据不足，使用默认预测
        return this.getDefaultPredictions(currentIntent);
      }

      // 2. 更新转移矩阵
      this.updateTransitionMatrix(history);

      // 3. 基于当前意图预测下一步
      const predictions = this.predictFromMatrix(currentIntent);

      // 4. 结合上下文调整预测
      const adjustedPredictions = await this.adjustByContext(
        userId,
        predictions,
        currentMessage,
      );

      // 5. 记录当前意图（用于未来预测）
      await this.recordIntent(userId, currentIntent);

      return adjustedPredictions;
    } catch (error) {
      logger.error({ userId, error }, "Intent prediction failed");
      return [];
    }
  }

  /**
   * 基于转移矩阵预测
   */
  private predictFromMatrix(
    currentIntent: IntentClassification,
  ): PredictedIntent[] {
    const key = `${currentIntent.type}:${currentIntent.subType ?? ""}`;
    const transitions = this.transitionMatrix.get(key);

    if (!transitions) {
      return [];
    }

    const predictions: PredictedIntent[] = [];

    for (const [nextKey, probability] of transitions) {
      if (probability < this.config.predictionThreshold) continue;

      const [intent, subType] = nextKey.split(":") as [IntentType, string?];

      predictions.push({
        intent,
        subType,
        probability,
        triggerCondition: this.describeTriggerCondition(currentIntent, intent),
        suggestedAction: this.describeSuggestedAction(intent, subType),
        shouldPush: probability > 0.6,
      });
    }

    return predictions
      .sort((a, b) => b.probability - a.probability)
      .slice(0, this.config.maxPredictions);
  }

  /**
   * 更新转移矩阵
   */
  private updateTransitionMatrix(history: IntentHistoryEntry[]): void {
    // 重置矩阵
    this.transitionMatrix.clear();

    // 计算转移频率
    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const next = history[i + 1];

      const currentKey = `${current.intent}:${current.subType ?? ""}`;
      const nextKey = `${next.intent}:${next.subType ?? ""}`;

      if (!this.transitionMatrix.has(currentKey)) {
        this.transitionMatrix.set(currentKey, new Map());
      }

      const transitions = this.transitionMatrix.get(currentKey)!;
      transitions.set(nextKey, (transitions.get(nextKey) ?? 0) + 1);
    }

    // 归一化为概率
    for (const transitions of this.transitionMatrix.values()) {
      const total = Array.from(transitions.values()).reduce((a, b) => a + b, 0);
      for (const [key, count] of transitions) {
        transitions.set(key, count / total);
      }
    }
  }

  /**
   * 结合上下文调整预测
   */
  private async adjustByContext(
    userId: string,
    predictions: PredictedIntent[],
    currentMessage: string,
  ): Promise<PredictedIntent[]> {
    // 根据用户偏好和当前状态调整预测概率
    // 例如：如果用户刚搜索了内容，增加"导出"或"整理"的预测概率

    // TODO: 实现上下文调整逻辑

    return predictions;
  }

  /**
   * 获取默认预测（数据不足时）
   */
  private getDefaultPredictions(
    currentIntent: IntentClassification,
  ): PredictedIntent[] {
    const defaultTransitions: Record<IntentType, PredictedIntent[]> = {
      query: [
        {
          intent: "action",
          subType: "organize",
          probability: 0.4,
          triggerCondition: "查询后通常需要整理",
          suggestedAction: "整理搜索结果",
          shouldPush: false,
        },
      ],
      action: [
        {
          intent: "query",
          subType: "list",
          probability: 0.5,
          triggerCondition: "操作后确认结果",
          suggestedAction: "查看操作结果",
          shouldPush: false,
        },
      ],
      // ... 其他默认转移
    };

    return defaultTransitions[currentIntent.type] ?? [];
  }

  private describeTriggerCondition(
    current: IntentClassification,
    next: IntentType,
  ): string {
    const descriptions: Record<string, Record<string, string>> = {
      query: {
        action: "搜索后可能需要对结果进行操作",
        organize: "搜索后可能需要整理结果",
      },
      action: {
        query: "操作后可能需要确认结果",
      },
      // ... 更多描述
    };

    return descriptions[current.type]?.[next] ?? "基于历史行为预测";
  }

  private describeSuggestedAction(
    intent: IntentType,
    subType?: string,
  ): string {
    const descriptions: Record<string, string> = {
      "query:count": "查看统计数据",
      "action:organize": "整理收藏",
      "learn:review": "开始复习",
      // ... 更多描述
    };

    return descriptions[`${intent}:${subType}`] ?? "执行相关操作";
  }

  // ... 数据库交互方法
}
```

---

### 5.5 偏好规则学习 (Preference Rule Learning)

#### 5.5.1 设计目标

从用户的纠正行为中自动学习规则，例如：

- "当书签标题包含 'Rust' 时，优先放入 '编程语言' 文件夹"
- "用户对长文更倾向于周末阅读"

#### 5.5.2 类型定义

```typescript
// src/lib/ai-agent/preferences/rule-learning/types.ts

/**
 * 用户纠正行为
 */
interface UserCorrection {
  /** 纠正 ID */
  id: string;
  /** 原始操作 */
  originalAction: {
    tool: string;
    params: Record<string, unknown>;
  };
  /** 纠正后的操作 */
  correctedAction: {
    tool: string;
    params: Record<string, unknown>;
  };
  /** 上下文 */
  context: {
    bookmarkId?: number;
    bookmarkTitle?: string;
    folderId?: number;
    tags?: string[];
  };
  /** 时间戳 */
  timestamp: string;
}

/**
 * 自定义规则
 */
interface CustomRule {
  /** 规则 ID */
  id: string;
  /** 条件描述 */
  condition: string;
  /** 条件表达式（用于程序匹配） */
  conditionExpr: RuleCondition;
  /** 操作描述 */
  action: string;
  /** 操作参数 */
  actionParams: Record<string, unknown>;
  /** 置信度 (0-1) */
  confidence: number;
  /** 来源 */
  source: "learned" | "explicit";
  /** 创建时间 */
  createdAt: string;
  /** 应用次数 */
  applyCount: number;
  /** 成功次数 */
  successCount: number;
}

/**
 * 规则条件
 */
interface RuleCondition {
  /** 条件类型 */
  type:
    | "title_contains"
    | "platform_is"
    | "tag_includes"
    | "time_is"
    | "composite";
  /** 条件值 */
  value: string | string[];
  /** 复合条件（当 type 为 composite） */
  conditions?: RuleCondition[];
  /** 复合逻辑 */
  logic?: "and" | "or";
}
```

#### 5.5.3 服务实现

```typescript
// src/lib/ai-agent/preferences/rule-learning/rule-extractor.ts

import { generateText } from "ai";
import { getModelByTier } from "@/lib/ai-agent/config/model-tiering";
import { logger } from "@/lib/logger";
import type { UserCorrection, CustomRule, RuleCondition } from "./types";

export class RuleExtractor {
  /**
   * 从纠正行为中提取规则
   */
  async extractRule(correction: UserCorrection): Promise<CustomRule | null> {
    try {
      // 1. 分析纠正行为
      const analysis = this.analyzeCorrection(correction);

      if (!analysis.isSignificant) {
        logger.debug(
          { correction },
          "Correction not significant enough for rule extraction",
        );
        return null;
      }

      // 2. 使用 LLM 生成规则描述
      const ruleDescription = await this.generateRuleDescription(
        correction,
        analysis,
      );

      // 3. 解析为结构化规则
      const rule = this.parseRule(ruleDescription, correction);

      // 4. 验证规则（可选：历史数据回测）
      const isValid = await this.validateRule(rule, correction.context);

      if (!isValid) {
        logger.debug({ rule }, "Rule validation failed");
        return null;
      }

      logger.info({ rule }, "Rule extracted from correction");
      return rule;
    } catch (error) {
      logger.error(
        { correction, error },
        "Failed to extract rule from correction",
      );
      return null;
    }
  }

  /**
   * 分析纠正行为
   */
  private analyzeCorrection(correction: UserCorrection): CorrectionAnalysis {
    const { originalAction, correctedAction } = correction;

    // 判断是否是有意义的纠正
    const isSignificant =
      originalAction.tool !== correctedAction.tool ||
      JSON.stringify(originalAction.params) !==
        JSON.stringify(correctedAction.params);

    // 识别纠正的维度
    const dimensions: string[] = [];

    if (originalAction.params.folder_id !== correctedAction.params.folder_id) {
      dimensions.push("folder");
    }
    if (
      JSON.stringify(originalAction.params.tags) !==
      JSON.stringify(correctedAction.params.tags)
    ) {
      dimensions.push("tags");
    }

    return {
      isSignificant,
      dimensions,
      originalTool: originalAction.tool,
      correctedTool: correctedAction.tool,
    };
  }

  /**
   * 使用 LLM 生成规则描述
   */
  private async generateRuleDescription(
    correction: UserCorrection,
    analysis: CorrectionAnalysis,
  ): Promise<string> {
    const prompt = `分析以下用户纠正行为，并提取一条通用规则：

## 原始操作
工具: ${correction.originalAction.tool}
参数: ${JSON.stringify(correction.originalAction.params)}

## 用户纠正为
工具: ${correction.correctedAction.tool}
参数: ${JSON.stringify(correction.correctedAction.params)}

## 上下文
书签标题: ${correction.context.bookmarkTitle ?? "未知"}
原有标签: ${correction.context.tags?.join(", ") ?? "无"}

## 任务
请提取一条规则，格式为：
条件: [当...时]
操作: [执行...]
置信度: [0-100]

只输出规则，不要解释。`;

    const model = getModelByTier("fast");
    const result = await generateText({
      model,
      prompt,
      maxTokens: 200,
    });

    return result.text;
  }

  /**
   * 解析规则文本为结构化规则
   */
  private parseRule(ruleText: string, correction: UserCorrection): CustomRule {
    // 简化解析，实际实现需要更健壮
    const conditionMatch = ruleText.match(/条件:\s*(.+)/);
    const actionMatch = ruleText.match(/操作:\s*(.+)/);
    const confidenceMatch = ruleText.match(/置信度:\s*(\d+)/);

    const condition = conditionMatch?.[1] ?? "";
    const action = actionMatch?.[1] ?? "";
    const confidence = parseInt(confidenceMatch?.[1] ?? "70", 10) / 100;

    // 构建条件表达式
    const conditionExpr = this.buildConditionExpr(condition, correction);

    return {
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      condition,
      conditionExpr,
      action,
      actionParams: correction.correctedAction.params,
      confidence,
      source: "learned",
      createdAt: new Date().toISOString(),
      applyCount: 0,
      successCount: 0,
    };
  }

  /**
   * 构建条件表达式
   */
  private buildConditionExpr(
    conditionText: string,
    correction: UserCorrection,
  ): RuleCondition {
    // 简化实现，基于关键词识别条件类型
    if (conditionText.includes("标题") && conditionText.includes("包含")) {
      const keyword = correction.context.bookmarkTitle?.split(/\s+/)[0] ?? "";
      return {
        type: "title_contains",
        value: keyword,
      };
    }

    if (conditionText.includes("平台")) {
      return {
        type: "platform_is",
        value: "", // 从上下文提取
      };
    }

    // 默认返回空条件
    return {
      type: "title_contains",
      value: "",
    };
  }

  /**
   * 验证规则
   */
  private async validateRule(
    rule: CustomRule,
    context: UserCorrection["context"],
  ): Promise<boolean> {
    // 基本验证
    if (!rule.condition || !rule.action) return false;
    if (rule.confidence < 0.5) return false;

    // TODO: 历史数据回测验证

    return true;
  }
}

interface CorrectionAnalysis {
  isSignificant: boolean;
  dimensions: string[];
  originalTool: string;
  correctedTool: string;
}
```

---

### 5.6 异步分析服务 (Async Analysis Service)

#### 5.6.1 设计目标

在用户"不在场"时进行深度分析，采用"延迟触发"而非真正的 Cron 任务。

#### 5.6.2 工作流程

```
用户收藏内容
    ↓
标记为"待深度处理"
    ↓
用户下次上线
    ↓
检查待处理任务
    ├── 有任务 → 触发异步分析（不阻塞用户）
    └── 无任务 → 跳过
    ↓
异步分析执行
    ├── 语义聚类
    ├── 冲突/互补检测
    ├── 链接健康检查
    └── 全局洞察更新
    ↓
结果缓存
    ↓
用户第三次上线
    ↓
展示分析结果（主动简报）
```

#### 5.6.3 类型定义

```typescript
// src/lib/ai-agent/async-analysis/types.ts

/**
 * 异步分析任务
 */
interface AsyncAnalysisTask {
  /** 任务 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 任务类型 */
  type: AnalysisTaskType;
  /** 优先级 */
  priority: "low" | "medium" | "high";
  /** 状态 */
  status: "pending" | "running" | "completed" | "failed";
  /** 触发条件 */
  trigger: "post_interaction" | "post_collection" | "scheduled" | "manual";
  /** 输入数据 */
  input?: Record<string, unknown>;
  /** 输出结果 */
  output?: Record<string, unknown>;
  /** 创建时间 */
  createdAt: string;
  /** 开始时间 */
  startedAt?: string;
  /** 完成时间 */
  completedAt?: string;
  /** 错误信息 */
  error?: string;
}

type AnalysisTaskType =
  | "topic_clustering" // 主题聚类
  | "pattern_detection" // 模式检测
  | "link_health_check" // 链接健康检查
  | "global_insight_update" // 全局洞察更新
  | "duplicate_detection" // 重复检测
  | "content_enrichment"; // 内容增强

/**
 * 分析结果
 */
interface AnalysisResult {
  /** 任务 ID */
  taskId: string;
  /** 结果类型 */
  type: AnalysisTaskType;
  /** 结果数据 */
  data: unknown;
  /** 生成的洞察 */
  insights: ProactiveInsight[];
  /** 建议的操作 */
  suggestedActions: SuggestedAction[];
  /** 完成时间 */
  completedAt: string;
}
```

#### 5.6.4 服务实现

```typescript
// src/lib/ai-agent/async-analysis/async-analysis-service.ts

import { logger } from "@/lib/logger";
import type {
  AsyncAnalysisTask,
  AnalysisResult,
  AnalysisTaskType,
} from "./types";

export class AsyncAnalysisService {
  private analyzers: Map<AnalysisTaskType, Analyzer> = new Map();

  constructor() {
    // 注册分析器
    this.analyzers.set("topic_clustering", new TopicClusteringAnalyzer());
    this.analyzers.set("pattern_detection", new PatternDetectionAnalyzer());
    this.analyzers.set("link_health_check", new LinkHealthCheckAnalyzer());
    this.analyzers.set(
      "global_insight_update",
      new GlobalInsightUpdateAnalyzer(),
    );
  }

  /**
   * 调度分析任务（延迟执行）
   */
  async scheduleAnalysis(
    userId: string,
    options: {
      trigger: AsyncAnalysisTask["trigger"];
      priority: AsyncAnalysisTask["priority"];
      types?: AnalysisTaskType[];
    },
  ): Promise<void> {
    const types = options.types ?? this.getDefaultTaskTypes(options.trigger);

    for (const type of types) {
      const task: AsyncAnalysisTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        type,
        priority: options.priority,
        status: "pending",
        trigger: options.trigger,
        createdAt: new Date().toISOString(),
      };

      await this.saveTask(task);
    }

    logger.info(
      { userId, taskCount: types.length },
      "Async analysis tasks scheduled",
    );
  }

  /**
   * 执行待处理任务（用户上线时调用）
   */
  async executePendingTasks(userId: string): Promise<AnalysisResult[]> {
    const pendingTasks = await this.getPendingTasks(userId);

    if (pendingTasks.length === 0) {
      return [];
    }

    logger.info(
      { userId, taskCount: pendingTasks.length },
      "Executing pending analysis tasks",
    );

    const results: AnalysisResult[] = [];

    // 按优先级排序
    const sortedTasks = pendingTasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // 执行任务（可以并行，这里简化为串行）
    for (const task of sortedTasks) {
      try {
        const result = await this.executeTask(task);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        logger.error({ taskId: task.id, error }, "Task execution failed");
        await this.updateTaskStatus(task.id, "failed", {
          error: String(error),
        });
      }
    }

    return results;
  }

  /**
   * 执行单个任务
   */
  private async executeTask(
    task: AsyncAnalysisTask,
  ): Promise<AnalysisResult | null> {
    const analyzer = this.analyzers.get(task.type);

    if (!analyzer) {
      logger.warn({ taskType: task.type }, "No analyzer found for task type");
      return null;
    }

    await this.updateTaskStatus(task.id, "running");

    const startTime = Date.now();
    const result = await analyzer.analyze(task);
    const duration = Date.now() - startTime;

    await this.updateTaskStatus(task.id, "completed", { output: result });

    logger.info({ taskId: task.id, duration }, "Analysis task completed");

    return {
      taskId: task.id,
      type: task.type,
      data: result.data,
      insights: result.insights,
      suggestedActions: result.suggestedActions,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * 根据触发条件获取默认任务类型
   */
  private getDefaultTaskTypes(
    trigger: AsyncAnalysisTask["trigger"],
  ): AnalysisTaskType[] {
    switch (trigger) {
      case "post_collection":
        return ["topic_clustering", "duplicate_detection"];
      case "post_interaction":
        return ["pattern_detection", "global_insight_update"];
      case "scheduled":
        return ["link_health_check", "global_insight_update"];
      default:
        return ["global_insight_update"];
    }
  }

  // ... 数据库交互方法
}

/**
 * 分析器接口
 */
interface Analyzer {
  analyze(task: AsyncAnalysisTask): Promise<{
    data: unknown;
    insights: ProactiveInsight[];
    suggestedActions: SuggestedAction[];
  }>;
}
```

---

### 5.7 上下文记忆增强 (Context Memory Enhancement)

#### 5.7.1 设计目标

实现跨会话记忆，让用户感受到对话的连续性。

#### 5.7.2 扩展 ConversationState

```typescript
// src/lib/ai-memory/types.ts（扩展）

interface ConversationState {
  // ... 现有字段

  /** 🆕 上次会话摘要（跨会话记忆） */
  previousSessionSummary?: {
    /** 上次会话的主题 */
    topic: string;
    /** 关键操作列表 */
    keyActions: string[];
    /** 未完成的任务 */
    pendingTasks: string[];
    /** 上次访问时间 */
    lastVisit: string;
    /** 会话 ID */
    sessionId?: string;
  };

  /** 🆕 用户当前关注点（实时更新） */
  currentFocus?: {
    /** 关注的主题 */
    topics: string[];
    /** 紧急程度 */
    urgency: "low" | "medium" | "high";
    /** 推断的目标 */
    inferredGoal?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  /** 🆕 长期记忆引用 */
  longTermMemory?: {
    /** 用户的核心关注点（从 GlobalInsight 获取） */
    coreInterests: string[];
    /** 用户的习惯模式 */
    patterns: UserPattern[];
    /** 重要的历史事件 */
    significantEvents: SignificantEvent[];
  };
}

interface UserPattern {
  type: string;
  description: string;
  frequency: number;
}

interface SignificantEvent {
  type: string;
  description: string;
  timestamp: string;
  relatedBookmarkIds?: number[];
}
```

---

## 6. 数据库设计

### 6.1 新增表

#### 6.1.1 proactive_insights（主动洞察表）

```sql
-- 主动洞察存储表
CREATE TABLE IF NOT EXISTS proactive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 洞察类型
  type TEXT NOT NULL CHECK (type IN (
    'topic_emergence',
    'pattern_detected',
    'recommendation',
    'knowledge_gap',
    'content_update',
    'link_health'
  )),

  -- 洞察内容
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  related_bookmark_ids BIGINT[] DEFAULT '{}',

  -- 优先级和状态
  priority INT NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,

  -- 元数据
  metadata JSONB DEFAULT '{}',

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 索引
CREATE INDEX idx_proactive_insights_user_unread
  ON proactive_insights(user_id, is_read, is_dismissed)
  WHERE NOT is_read AND NOT is_dismissed;

CREATE INDEX idx_proactive_insights_expires
  ON proactive_insights(expires_at)
  WHERE NOT is_dismissed;

CREATE INDEX idx_proactive_insights_priority
  ON proactive_insights(user_id, priority DESC);

-- RLS 策略
ALTER TABLE proactive_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON proactive_insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON proactive_insights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
```

#### 6.1.2 async_analysis_tasks（异步分析任务表）

```sql
-- 异步分析任务表
CREATE TABLE IF NOT EXISTS async_analysis_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 任务类型
  type TEXT NOT NULL CHECK (type IN (
    'topic_clustering',
    'pattern_detection',
    'link_health_check',
    'global_insight_update',
    'duplicate_detection',
    'content_enrichment'
  )),

  -- 任务状态
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'low' CHECK (priority IN ('low', 'medium', 'high')),
  trigger TEXT NOT NULL CHECK (trigger IN (
    'post_interaction', 'post_collection', 'scheduled', 'manual'
  )),

  -- 输入输出
  input JSONB DEFAULT '{}',
  output JSONB,
  error TEXT,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 索引
CREATE INDEX idx_async_tasks_pending
  ON async_analysis_tasks(user_id, status, priority)
  WHERE status = 'pending';

CREATE INDEX idx_async_tasks_created
  ON async_analysis_tasks(created_at);

-- RLS 策略
ALTER TABLE async_analysis_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON async_analysis_tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

#### 6.1.3 user_corrections（用户纠正记录表）

```sql
-- 用户纠正记录表（用于规则学习）
CREATE TABLE IF NOT EXISTS user_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 原始操作
  original_action JSONB NOT NULL,

  -- 纠正后的操作
  corrected_action JSONB NOT NULL,

  -- 上下文
  context JSONB NOT NULL DEFAULT '{}',

  -- 是否已用于规则提取
  rule_extracted BOOLEAN NOT NULL DEFAULT FALSE,
  extracted_rule_id TEXT,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 索引
CREATE INDEX idx_corrections_unprocessed
  ON user_corrections(user_id, rule_extracted)
  WHERE NOT rule_extracted;

-- RLS 策略
ALTER TABLE user_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own corrections"
  ON user_corrections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);
```

### 6.2 扩展现有表

#### 6.2.1 profiles.ai_preferences 扩展

```sql
-- 更新 ai_preferences 结构的 RPC 函数
CREATE OR REPLACE FUNCTION update_ai_global_insight(
  p_user_id UUID,
  p_insight JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET ai_preferences = jsonb_set(
    COALESCE(ai_preferences, '{}'),
    '{globalInsight}',
    p_insight
  )
  WHERE id = p_user_id;
END;
$$;

-- 更新自定义规则的 RPC 函数
CREATE OR REPLACE FUNCTION update_ai_custom_rules(
  p_user_id UUID,
  p_rules JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET ai_preferences = jsonb_set(
    COALESCE(ai_preferences, '{}'),
    '{explicit,customRules}',
    p_rules
  )
  WHERE id = p_user_id;
END;
$$;

-- 添加单条规则的 RPC 函数
CREATE OR REPLACE FUNCTION add_ai_custom_rule(
  p_user_id UUID,
  p_rule JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_rules JSONB;
BEGIN
  SELECT COALESCE(ai_preferences->'explicit'->'customRules', '[]'::JSONB)
  INTO existing_rules
  FROM profiles
  WHERE id = p_user_id;

  UPDATE profiles
  SET ai_preferences = jsonb_set(
    COALESCE(ai_preferences, '{}'),
    '{explicit,customRules}',
    existing_rules || p_rule
  )
  WHERE id = p_user_id;
END;
$$;
```

#### 6.2.2 ai_session_memory 扩展

```sql
-- 添加跨会话摘要字段
ALTER TABLE ai_session_memory
ADD COLUMN IF NOT EXISTS previous_session_summary JSONB;

ALTER TABLE ai_session_memory
ADD COLUMN IF NOT EXISTS current_focus JSONB;

-- 更新跨会话摘要的 RPC 函数
CREATE OR REPLACE FUNCTION update_session_cross_memory(
  p_user_id UUID,
  p_conversation_id TEXT,
  p_previous_summary JSONB,
  p_current_focus JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ai_session_memory
  SET
    previous_session_summary = p_previous_summary,
    current_focus = COALESCE(p_current_focus, current_focus),
    updated_at = NOW()
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id;
END;
$$;
```

---

## 7. API 设计

### 7.1 主动简报 API

```typescript
// POST /api/agent/briefing
// 获取主动简报

interface BriefingRequest {
  /** 是否强制刷新 */
  forceRefresh?: boolean;
}

interface BriefingResponse {
  /** 简报数据 */
  briefing: ProactiveBriefing | null;
  /** 是否有新洞察 */
  hasNewInsights: boolean;
  /** 未读洞察数量 */
  unreadInsightCount: number;
}

// GET /api/agent/insights
// 获取洞察列表

interface InsightsRequest {
  /** 是否只获取未读 */
  unreadOnly?: boolean;
  /** 分页 */
  limit?: number;
  offset?: number;
}

interface InsightsResponse {
  insights: ProactiveInsight[];
  total: number;
}

// PATCH /api/agent/insights/:id
// 更新洞察状态（已读/忽略）

interface UpdateInsightRequest {
  isRead?: boolean;
  isDismissed?: boolean;
}
```

### 7.2 异步分析 API

```typescript
// POST /api/agent/analysis/trigger
// 手动触发异步分析

interface TriggerAnalysisRequest {
  types?: AnalysisTaskType[];
  priority?: "low" | "medium" | "high";
}

interface TriggerAnalysisResponse {
  taskIds: string[];
  message: string;
}

// GET /api/agent/analysis/status
// 获取分析任务状态

interface AnalysisStatusResponse {
  pendingCount: number;
  runningCount: number;
  recentResults: AnalysisResult[];
}
```

### 7.3 偏好规则 API

```typescript
// GET /api/agent/rules
// 获取自定义规则列表

interface RulesResponse {
  rules: CustomRule[];
}

// POST /api/agent/rules
// 添加自定义规则

interface AddRuleRequest {
  condition: string;
  action: string;
  source: "explicit";
}

// DELETE /api/agent/rules/:id
// 删除规则

// POST /api/agent/corrections
// 记录用户纠正（用于规则学习）

interface RecordCorrectionRequest {
  originalAction: {
    tool: string;
    params: Record<string, unknown>;
  };
  correctedAction: {
    tool: string;
    params: Record<string, unknown>;
  };
  context?: Record<string, unknown>;
}
```

---

## 8. 与现有架构融合

### 8.1 融合点总结

| 新模块                  | 融合点                    | 融合方式            | 侵入性 |
| ----------------------- | ------------------------- | ------------------- | ------ |
| ProactiveBriefingEngine | DynamicContextBuilder     | 扩展 buildContext() | 低     |
| SlowThinkingLayer       | ExecutionCoordinator      | 增加前置步骤        | 中     |
| GlobalInsightService    | PreferencesService        | 扩展 ai_preferences | 低     |
| IntentPredictor         | IntentRouter              | 新增子模块          | 中     |
| RuleExtractor           | PreferenceLearningService | 扩展现有服务        | 低     |
| AsyncAnalysisService    | UnifiedEngine             | 执行后触发          | 低     |
| CrossSessionMemory      | SessionMemory             | 扩展类型定义        | 低     |

### 8.2 Feature Flags

```typescript
// src/lib/ai-agent/config/feature-flags.ts（扩展）

export const AI_SECRETARY_FLAGS = {
  /** 主动简报 */
  ENABLE_PROACTIVE_BRIEFING: "ENABLE_PROACTIVE_BRIEFING",
  /** 慢思考 */
  ENABLE_SLOW_THINKING: "ENABLE_SLOW_THINKING",
  /** 慢思考用户可见 */
  ENABLE_SLOW_THINKING_VISIBLE: "ENABLE_SLOW_THINKING_VISIBLE",
  /** 全局洞察 */
  ENABLE_GLOBAL_INSIGHT: "ENABLE_GLOBAL_INSIGHT",
  /** 意图预测 */
  ENABLE_INTENT_PREDICTION: "ENABLE_INTENT_PREDICTION",
  /** 规则学习 */
  ENABLE_RULE_LEARNING: "ENABLE_RULE_LEARNING",
  /** 异步分析 */
  ENABLE_ASYNC_ANALYSIS: "ENABLE_ASYNC_ANALYSIS",
  /** 跨会话记忆 */
  ENABLE_CROSS_SESSION_MEMORY: "ENABLE_CROSS_SESSION_MEMORY",
};

// 默认值（全部关闭，渐进式开启）
export const DEFAULT_AI_SECRETARY_FLAGS: Record<string, boolean> = {
  [AI_SECRETARY_FLAGS.ENABLE_PROACTIVE_BRIEFING]: false,
  [AI_SECRETARY_FLAGS.ENABLE_SLOW_THINKING]: false,
  [AI_SECRETARY_FLAGS.ENABLE_SLOW_THINKING_VISIBLE]: false,
  [AI_SECRETARY_FLAGS.ENABLE_GLOBAL_INSIGHT]: false,
  [AI_SECRETARY_FLAGS.ENABLE_INTENT_PREDICTION]: false,
  [AI_SECRETARY_FLAGS.ENABLE_RULE_LEARNING]: false,
  [AI_SECRETARY_FLAGS.ENABLE_ASYNC_ANALYSIS]: false,
  [AI_SECRETARY_FLAGS.ENABLE_CROSS_SESSION_MEMORY]: false,
};
```

### 8.3 目录结构变更

```
src/lib/ai-agent/
├── async-analysis/                    # 🆕 异步分析
│   ├── types.ts
│   ├── async-analysis-service.ts
│   ├── analyzers/
│   │   ├── topic-clustering.ts
│   │   ├── pattern-detection.ts
│   │   └── link-health.ts
│   └── index.ts
├── global-insight/                    # 🆕 全局洞察
│   ├── types.ts
│   ├── global-insight-service.ts
│   ├── insight-generator.ts
│   └── index.ts
├── proactive-briefing/                # 🆕 主动简报
│   ├── types.ts
│   ├── proactive-briefing-service.ts
│   ├── insight-generators/
│   │   ├── topic-emergence.ts
│   │   ├── pattern-detection.ts
│   │   └── knowledge-gap.ts
│   └── index.ts
├── slow-thinking/                     # 🆕 慢思考
│   ├── types.ts
│   ├── slow-thinking-service.ts
│   └── index.ts
├── preferences/
│   ├── rule-learning/                 # 🆕 规则学习
│   │   ├── types.ts
│   │   ├── rule-extractor.ts
│   │   └── index.ts
│   ├── preferences-service.ts         # 现有
│   └── learning-service.ts            # 现有（扩展）
├── context/                           # 现有（扩展）
│   ├── dynamic-context-builder.ts     # 扩展
│   └── ...
└── ...

src/lib/ai-skills/router/
├── intent-predictor/                  # 🆕 意图预测
│   ├── types.ts
│   ├── intent-predictor.ts
│   └── index.ts
├── intent-router.ts                   # 现有（扩展）
└── ...

src/lib/ai-memory/
├── types.ts                           # 扩展
├── session-memory.ts                  # 扩展
├── cross-session-memory.ts            # 🆕 跨会话记忆
└── ...
```

---

## 9. 实施计划

### 9.1 阶段划分

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Phase 0: 验证性原型 (1 周)                                                  │
│  ├── 目标: 验证"秘书感"是否提升                                             │
│  ├── 范围: 最简版主动简报（硬编码 3 条洞察）                                │
│  ├── 交付物:                                                                │
│  │   ├── ProactiveBriefingCard 组件                                         │
│  │   ├── 简化版 ProactiveBriefingService                                    │
│  │   └── 首页集成                                                           │
│  └── 决策点: 用户测试通过则继续，否则重新评估方向                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 1: 上下文增强 (2-3 周)                                                │
│  ├── 目标: 提升 AI 的上下文认知能力                                         │
│  ├── 范围:                                                                  │
│  │   ├── GlobalInsightService 完整实现                                      │
│  │   ├── CrossSessionMemory 实现                                            │
│  │   ├── DynamicContext 扩展                                                │
│  │   └── 数据库迁移（ai_preferences 扩展）                                  │
│  └── 交付物:                                                                │
│      ├── 全局洞察生成和缓存                                                 │
│      ├── 跨会话记忆持久化                                                   │
│      └── 上下文 Prompt 注入增强                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 2: 慢思考层 (2 周)                                                    │
│  ├── 目标: 提升任务执行的深度和准确性                                       │
│  ├── 范围:                                                                  │
│  │   ├── SlowThinkingService 实现                                           │
│  │   ├── ExecutionCoordinator 集成                                          │
│  │   ├── ThinkingChunk 流类型                                               │
│  │   └── 前端思考过程展示组件                                               │
│  └── 交付物:                                                                │
│      ├── 内心独白生成                                                       │
│      ├── 路由决策修正                                                       │
│      └── 思考过程用户可见（可配置）                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 3: 智能预测 (2-3 周)                                                  │
│  ├── 目标: 实现意图预测和规则学习                                           │
│  ├── 范围:                                                                  │
│  │   ├── IntentPredictor 模块                                               │
│  │   ├── RuleExtractor 实现                                                 │
│  │   ├── 用户纠正记录                                                       │
│  │   └── 建议操作推送                                                       │
│  └── 交付物:                                                                │
│      ├── 意图预测（马尔可夫链 + 上下文调整）                                │
│      ├── 规则自动学习                                                       │
│      └── 快捷操作按钮                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 4: 异步分析 (2 周)                                                    │
│  ├── 目标: 利用离线时间创造价值                                             │
│  ├── 范围:                                                                  │
│  │   ├── AsyncAnalysisService 实现                                          │
│  │   ├── 分析器实现（聚类、检测、健康检查）                                 │
│  │   ├── 延迟触发机制                                                       │
│  │   └── 分析结果与主动简报集成                                             │
│  └── 交付物:                                                                │
│      ├── 后台异步分析                                                       │
│      ├── 主题聚类                                                           │
│      ├── 模式检测                                                           │
│      └── 链接健康检查                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 5: 完整集成 (1-2 周)                                                  │
│  ├── 目标: 端到端集成测试和优化                                             │
│  ├── 范围:                                                                  │
│  │   ├── 全功能集成测试                                                     │
│  │   ├── 性能优化                                                           │
│  │   ├── 文档完善                                                           │
│  │   └── 灰度发布配置                                                       │
│  └── 交付物:                                                                │
│      ├── 集成测试套件                                                       │
│      ├── 性能基准报告                                                       │
│      └── 发布计划                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 时间线

| 阶段    | 开始时间 | 结束时间 | 工时估算 | 里程碑         |
| ------- | -------- | -------- | -------- | -------------- |
| Phase 0 | Week 1   | Week 1   | 5 人天   | 原型验证通过   |
| Phase 1 | Week 2   | Week 4   | 12 人天  | 上下文增强完成 |
| Phase 2 | Week 5   | Week 6   | 8 人天   | 慢思考上线     |
| Phase 3 | Week 7   | Week 9   | 12 人天  | 智能预测上线   |
| Phase 4 | Week 10  | Week 11  | 8 人天   | 异步分析上线   |
| Phase 5 | Week 12  | Week 13  | 6 人天   | 全功能发布     |

**总计**: 约 51 人天，13 周

---

## 10. 风险评估与缓解

### 10.1 技术风险

| 风险             | 概率 | 影响 | 缓解措施                               |
| ---------------- | ---- | ---- | -------------------------------------- |
| 慢思考增加延迟   | 高   | 中   | Feature Flag 控制，设置超时，可选显示  |
| LLM 调用成本增加 | 高   | 中   | 使用 fast 模型，增加缓存，设置预算上限 |
| 规则学习误导     | 中   | 高   | 规则验证机制，置信度阈值，用户确认     |
| 异步分析资源消耗 | 中   | 低   | 延迟触发，优先级队列，限制并发         |
| 数据库迁移兼容性 | 低   | 高   | JSONB 扩展（非破坏性），默认值处理     |

### 10.2 产品风险

| 风险               | 概率 | 影响 | 缓解措施                             |
| ------------------ | ---- | ---- | ------------------------------------ |
| 主动推送打扰用户   | 中   | 高   | 可关闭设置，智能频率控制，优先级过滤 |
| 慢思考显示影响体验 | 中   | 中   | 可选隐藏，简洁展示，动画优化         |
| 预测不准确降低信任 | 中   | 中   | 显示置信度，允许反馈，持续优化       |

### 10.3 运维风险

| 风险         | 概率 | 影响 | 缓解措施                 |
| ------------ | ---- | ---- | ------------------------ |
| 异步任务积压 | 中   | 中   | 任务超时清理，优先级调度 |
| 数据膨胀     | 中   | 低   | 过期清理机制，数据压缩   |

---

## 11. 成功指标

### 11.1 用户体验指标

| 指标               | 当前基线 | 目标值 | 测量方式                |
| ------------------ | -------- | ------ | ----------------------- |
| 主动简报使用率     | N/A      | > 60%  | 简报展示 / 用户上线次数 |
| 用户感知连续性评分 | N/A      | > 4/5  | 用户调研                |
| 任务完成质量评分   | N/A      | > 4/5  | 用户反馈                |
| 建议操作点击率     | N/A      | > 30%  | 点击 / 展示             |
| 规则学习准确率     | N/A      | > 70%  | 用户确认 / 规则应用     |

### 11.2 技术指标

| 指标             | 当前基线 | 目标值 | 测量方式        |
| ---------------- | -------- | ------ | --------------- |
| 主动简报生成延迟 | N/A      | < 2s   | P95 延迟        |
| 慢思考增加延迟   | N/A      | < 3s   | 平均增加时间    |
| 全局洞察生成时间 | N/A      | < 10s  | 平均时间        |
| LLM 调用成本增加 | 基线     | < 30%  | Token 消耗对比  |
| 测试覆盖率       | 基线     | > 80%  | 单元 + 集成测试 |

---

## 12. 附录

### 12.1 术语表

| 术语       | 定义                                    |
| ---------- | --------------------------------------- |
| 主动简报   | Agent 在用户上线时主动推送的洞察和建议  |
| 慢思考     | Agent 在执行前进行的深度推理过程        |
| 全局洞察   | 基于用户整个知识库生成的宏观画像        |
| 意图预测   | 基于历史行为预测用户下一步操作的能力    |
| 规则学习   | 从用户纠正行为中自动提取规则的能力      |
| 延迟触发   | 在用户上线时触发后台任务，而非使用 Cron |
| 跨会话记忆 | 在不同会话之间保持上下文的能力          |

### 12.2 参考文档

- [task-understanding-v2-implementation.md](./task-understanding-v2-implementation.md) - 任务理解层设计
- [context-memory-enhancement-v1.md](./context-memory-enhancement-v1.md) - 上下文增强规范
- [ai-context-enhancement-v2.md](./ai-context-enhancement-v2.md) - AI 上下文增强规范
- [CLAUDE.md](../../CLAUDE.md) - AI 上下文文档

### 12.3 变更记录

| 版本  | 日期       | 作者    | 变更内容 |
| ----- | ---------- | ------- | -------- |
| 1.0.0 | 2025-12-30 | Winston | 初始版本 |

---

**文档结束**
