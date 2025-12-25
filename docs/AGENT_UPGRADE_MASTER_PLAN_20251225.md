# AnyKeep Agent 能力升级总体规划

> **版本**: 1.0.0
> **日期**: 2025-12-25
> **作者**: BMad Master (Acting CTO)
> **状态**: 待审核

---

## 执行摘要

作为 AnyKeep 的 CTO，在深入分析现有 AI 架构后，本文档提出一份**务实可落地**的 Agent 能力升级规划。

### 当前状态评估

**已有优势（5星）**：

- ⭐⭐⭐⭐⭐ 完整的双层执行架构（原子+编排模式）
- ⭐⭐⭐⭐⭐ 95 个 Tools + 15 个 Skills 覆盖主要场景
- ⭐⭐⭐⭐⭐ 统一 API 入口和流式响应
- ⭐⭐⭐⭐ 规则驱动的意图路由系统
- ⭐⭐⭐⭐ Effect 层（确认、通知、审计）

**核心差距（需提升）**：

- ⭐⭐ 主动智能能力（被动响应 → 主动助手）
- ⭐⭐ 长期记忆与个性化
- ⭐ 自主规划与执行能力
- ⭐ 外部世界连接能力
- ⭐⭐ 多模态交互支持

### 升级愿景

> **从「工具型 Agent」升级为「主动型个人 AI 助手」**

让 AnyKeep 的 Agent 不只是执行用户命令的工具，而是能够：

1. **主动思考** - 识别用户需求，提供预见性建议
2. **持续学习** - 从交互中学习，越用越懂用户
3. **自主规划** - 分解复杂任务，自动编排执行
4. **连接世界** - 不仅管理收藏，还能主动获取新知

---

## 第一部分：个人 AI 助手应具备的核心能力矩阵

### 1.1 能力模型：PICAL Framework

```
┌─────────────────────────────────────────────────────────────┐
│                   PICAL Agent 能力模型                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  P - Proactive (主动性)           I - Intelligent (智能性)   │
│  ┌─────────────────────────┐    ┌─────────────────────────┐ │
│  │ • 主动提醒和建议         │    │ • 意图理解             │ │
│  │ • 定时任务执行           │    │ • 上下文感知           │ │
│  │ • 异常检测和预警         │    │ • 推理和规划           │ │
│  │ • 个性化推荐             │    │ • 知识整合             │ │
│  └─────────────────────────┘    └─────────────────────────┘ │
│                                                             │
│  C - Contextual (上下文感知)     A - Autonomous (自主性)     │
│  ┌─────────────────────────┐    ┌─────────────────────────┐ │
│  │ • 会话记忆               │    │ • 自主任务分解         │ │
│  │ • 用户画像               │    │ • 动态工具编排         │ │
│  │ • 行为模式学习           │    │ • 错误恢复             │ │
│  │ • 场景适应               │    │ • 持续执行             │ │
│  └─────────────────────────┘    └─────────────────────────┘ │
│                                                             │
│  L - Learning (学习能力)                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ • 反馈学习   • 偏好记忆   • 技能进化   • 知识更新       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 1.2 AnyKeep 当前能力评估 vs 目标

| 能力维度       | 当前水平 | 目标水平 | 差距分析                   |
| -------------- | -------- | -------- | -------------------------- |
| **P - 主动性** | 20%      | 80%      | 几乎无主动能力，纯被动响应 |
| **I - 智能性** | 60%      | 90%      | 意图路由ok，但复杂推理弱   |
| **C - 上下文** | 40%      | 85%      | 仅会话内上下文，无长期记忆 |
| **A - 自主性** | 30%      | 75%      | Skills预定义，缺动态编排   |
| **L - 学习**   | 10%      | 70%      | 无反馈学习机制             |

---

## 第二部分：务实的升级路线图

### 2.1 分阶段实施策略

```
Phase 1 (4周)          Phase 2 (6周)          Phase 3 (8周)
────────────────      ────────────────       ────────────────
  基础增强              智能进化               高级能力

┌──────────────┐     ┌──────────────┐      ┌──────────────┐
│ • 长期记忆    │     │ • 主动洞察    │      │ • 自主规划    │
│ • 偏好学习    │ →   │ • 智能提醒    │  →   │ • 动态编排    │
│ • 反馈循环    │     │ • 外部连接    │      │ • 多模态      │
│ • 用户画像    │     │ • 学习路径    │      │ • 协作能力    │
└──────────────┘     └──────────────┘      └──────────────┘

   价值: 40%            价值: 35%             价值: 25%
   风险: 低             风险: 中              风险: 中高
```

---

## Phase 1: 基础增强（4周）

### 目标

建立 Agent 的「记忆」和「个性化」基础，让 Agent 能够记住用户并从交互中学习。

### 1.1 长期记忆系统

#### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory Architecture                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐                                        │
│  │  Working Memory │  ← 当前会话上下文（已有）               │
│  │  (Session)      │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ Episodic Memory │  ← 重要交互记忆（新增）                 │
│  │  (Episodes)     │    - 用户关键决策                       │
│  │                 │    - 成功的任务模式                     │
│  │                 │    - 用户纠正/反馈                      │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ Semantic Memory │  ← 知识提炼（新增）                     │
│  │  (Knowledge)    │    - 用户偏好总结                       │
│  │                 │    - 领域知识图谱                       │
│  │                 │    - 行为模式                          │
│  └─────────────────┘                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 数据模型设计

```sql
-- 1. 用户记忆表
CREATE TABLE agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- 记忆类型
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'episode',      -- 重要事件/交互
    'preference',   -- 用户偏好
    'pattern',      -- 行为模式
    'correction',   -- 用户纠正
    'feedback'      -- 用户反馈
  )),

  -- 记忆内容
  content JSONB NOT NULL,
  summary TEXT,              -- 记忆摘要（用于快速检索）
  embedding vector(1536),    -- 语义向量（用于相似度搜索）

  -- 记忆强度
  importance_score FLOAT DEFAULT 0.5,  -- 重要性 [0,1]
  recency_score FLOAT DEFAULT 1.0,     -- 新鲜度 [0,1]
  frequency INT DEFAULT 1,              -- 触发频次

  -- 关联
  related_bookmark_ids INTEGER[],
  related_folder_ids INTEGER[],
  tags TEXT[],

  -- 生命周期
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  decay_rate FLOAT DEFAULT 0.1,  -- 衰减率

  CONSTRAINT valid_scores CHECK (
    importance_score >= 0 AND importance_score <= 1 AND
    recency_score >= 0 AND recency_score <= 1
  )
);

-- 2. 用户画像表
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),

  -- 基础画像
  interests JSONB DEFAULT '[]',        -- 兴趣领域
  expertise_level JSONB DEFAULT '{}',  -- 各领域熟练度
  learning_style TEXT,                  -- 学习风格

  -- 行为特征
  active_hours JSONB DEFAULT '{}',     -- 活跃时段分布
  platform_preferences JSONB DEFAULT '{}', -- 平台偏好
  interaction_style TEXT,               -- 交互风格（简洁/详细）

  -- Agent 适配
  preferred_response_length TEXT DEFAULT 'medium',
  preferred_language TEXT DEFAULT 'zh-CN',
  confirmation_threshold FLOAT DEFAULT 0.7,  -- 何时需要确认

  -- 统计
  total_interactions INT DEFAULT 0,
  successful_tasks INT DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 学习反馈表
CREATE TABLE agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- 关联
  conversation_id UUID,
  skill_id TEXT,
  tool_name TEXT,

  -- 反馈内容
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'explicit_positive',   -- 用户明确好评
    'explicit_negative',   -- 用户明确差评
    'implicit_positive',   -- 隐式正反馈（采纳建议）
    'implicit_negative',   -- 隐式负反馈（忽略/取消）
    'correction',          -- 用户纠正
    'clarification'        -- 用户澄清
  )),

  context JSONB NOT NULL,      -- 触发上下文
  user_action JSONB,           -- 用户后续行为
  learned_pattern JSONB,       -- 提炼的模式

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_memories_user_type ON agent_memories(user_id, memory_type);
CREATE INDEX idx_memories_embedding ON agent_memories
  USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_feedback_user ON agent_feedback(user_id, created_at DESC);
```

#### 核心实现

```typescript
// src/lib/ai-memory/memory-manager.ts

interface Memory {
  id: string;
  type: MemoryType;
  content: unknown;
  summary: string;
  embedding?: number[];
  importanceScore: number;
  recencyScore: number;
  frequency: number;
  createdAt: Date;
  lastAccessedAt: Date;
}

interface UserProfile {
  userId: string;
  interests: string[];
  expertiseLevel: Record<string, number>;
  learningStyle: "visual" | "reading" | "interactive";
  interactionStyle: "concise" | "detailed" | "adaptive";
  preferredResponseLength: "short" | "medium" | "long";
  activeHours: Record<number, number>; // hour -> activity count
}

export class MemoryManager {
  /**
   * 存储重要记忆
   */
  async storeMemory(params: {
    userId: string;
    type: MemoryType;
    content: unknown;
    context: EngineContext;
    importance?: number;
  }): Promise<Memory> {
    // 1. 生成摘要
    const summary = await this.generateSummary(params.content);

    // 2. 生成嵌入向量
    const embedding = await this.generateEmbedding(summary);

    // 3. 计算重要性
    const importanceScore =
      params.importance ?? (await this.calculateImportance(params));

    // 4. 存储到数据库
    return await this.db.insert("agent_memories", {
      user_id: params.userId,
      memory_type: params.type,
      content: params.content,
      summary,
      embedding,
      importance_score: importanceScore,
    });
  }

  /**
   * 检索相关记忆
   */
  async retrieveRelevantMemories(params: {
    userId: string;
    query: string;
    context: EngineContext;
    limit?: number;
  }): Promise<Memory[]> {
    // 1. 生成查询向量
    const queryEmbedding = await this.generateEmbedding(params.query);

    // 2. 混合检索（语义 + 关键词 + 时间衰减）
    const memories = await this.db.query(
      `
      SELECT
        *,
        1 - (embedding <=> $1) as semantic_score,
        importance_score * power(0.9, extract(days from now() - last_accessed_at)) as adjusted_score
      FROM agent_memories
      WHERE user_id = $2
      ORDER BY (semantic_score * 0.6 + adjusted_score * 0.4) DESC
      LIMIT $3
    `,
      [queryEmbedding, params.userId, params.limit ?? 10],
    );

    // 3. 更新访问时间
    await this.updateAccessTime(memories.map((m) => m.id));

    return memories;
  }

  /**
   * 更新用户画像
   */
  async updateUserProfile(params: {
    userId: string;
    interaction: Interaction;
  }): Promise<void> {
    const profile = await this.getUserProfile(params.userId);

    // 1. 更新兴趣领域
    const topics = await this.extractTopics(params.interaction);
    profile.interests = this.mergeInterests(profile.interests, topics);

    // 2. 更新活跃时段
    const hour = new Date().getHours();
    profile.activeHours[hour] = (profile.activeHours[hour] ?? 0) + 1;

    // 3. 更新交互风格偏好
    const styleSignals = this.analyzeStyleSignals(params.interaction);
    profile.interactionStyle = this.updateStyle(
      profile.interactionStyle,
      styleSignals,
    );

    // 4. 保存
    await this.db.update("user_profiles", profile);
  }

  /**
   * 从反馈中学习
   */
  async learnFromFeedback(params: {
    userId: string;
    feedbackType: FeedbackType;
    context: FeedbackContext;
  }): Promise<void> {
    // 1. 记录反馈
    await this.storeFeedback(params);

    // 2. 提炼模式
    const pattern = await this.extractPattern(params);

    // 3. 如果模式有意义，存储为记忆
    if (pattern.confidence > 0.7) {
      await this.storeMemory({
        userId: params.userId,
        type: "pattern",
        content: pattern,
        context: params.context,
        importance: pattern.confidence,
      });
    }

    // 4. 更新用户画像
    await this.updateProfileFromPattern(params.userId, pattern);
  }
}
```

### 1.2 反馈学习循环

#### 反馈触发点设计

```typescript
// src/lib/ai-feedback/feedback-collector.ts

export class FeedbackCollector {
  /**
   * 隐式反馈收集点
   */
  readonly IMPLICIT_TRIGGERS = {
    // 正反馈信号
    positive: [
      "user_executed_suggested_action", // 用户执行了建议的操作
      "user_saved_deliverable", // 用户保存了交付物
      "user_shared_content", // 用户分享了内容
      "user_continued_conversation", // 用户继续对话（满意）
      "user_used_same_skill_again", // 用户再次使用相同Skill
    ],
    // 负反馈信号
    negative: [
      "user_cancelled_operation", // 用户取消了操作
      "user_modified_result_heavily", // 用户大幅修改结果
      "user_asked_for_redo", // 用户要求重做
      "user_switched_topic_abruptly", // 用户突然换话题
      "user_abandoned_conversation", // 用户放弃对话
    ],
  };

  /**
   * 显式反馈 UI 组件
   */
  generateFeedbackUI(context: FeedbackContext): FeedbackUI {
    return {
      type: "inline-feedback",
      components: [
        {
          type: "thumbs",
          options: ["helpful", "not-helpful"],
          compact: true,
        },
        {
          type: "quick-actions",
          options: [
            { label: "太长了", action: "prefer_shorter" },
            { label: "不够详细", action: "prefer_detailed" },
            { label: "不是我要的", action: "misunderstood" },
          ],
          show_on: "not-helpful",
        },
      ],
    };
  }
}
```

### 1.3 用户偏好系统

#### 偏好维度

```typescript
// src/lib/ai-preferences/preference-types.ts

export interface UserPreferences {
  // 响应风格偏好
  responseStyle: {
    length: "concise" | "balanced" | "detailed";
    tone: "professional" | "friendly" | "casual";
    format: "prose" | "bullets" | "structured";
    includeEmoji: boolean;
  };

  // 交互偏好
  interaction: {
    confirmationLevel: "always" | "risky_only" | "never";
    autoSuggestEnabled: boolean;
    suggestionsCount: number;
    showProgress: boolean;
  };

  // 内容偏好
  content: {
    preferredPlatforms: string[];
    ignoredPlatforms: string[];
    preferredTopics: string[];
    readingLevel: "beginner" | "intermediate" | "advanced";
  };

  // 时间偏好
  timing: {
    reminderEnabled: boolean;
    preferredReminderTime: string; // "09:00"
    digestFrequency: "daily" | "weekly" | "never";
    quietHours: { start: string; end: string };
  };

  // 隐私偏好
  privacy: {
    allowBehaviorTracking: boolean;
    allowPersonalization: boolean;
    dataRetentionDays: number;
  };
}
```

#### 偏好推断引擎

```typescript
// src/lib/ai-preferences/preference-inferrer.ts

export class PreferenceInferrer {
  /**
   * 从用户行为推断偏好
   */
  async inferPreferences(userId: string): Promise<Partial<UserPreferences>> {
    const behaviors = await this.collectBehaviors(userId);

    return {
      responseStyle: {
        length: this.inferLengthPreference(behaviors),
        format: this.inferFormatPreference(behaviors),
      },
      content: {
        preferredPlatforms: this.inferPlatformPreference(behaviors),
        preferredTopics: await this.inferTopicPreference(behaviors),
      },
      timing: {
        preferredReminderTime: this.inferBestTime(behaviors),
      },
    };
  }

  private inferLengthPreference(behaviors: Behavior[]): string {
    // 分析用户对不同长度响应的反馈
    const lengthFeedback = behaviors
      .filter((b) => b.type === "response_feedback")
      .map((b) => ({
        length: b.responseLength,
        positive: b.feedback === "positive",
      }));

    // 计算各长度的正反馈率
    const stats = this.groupAndCalculate(lengthFeedback);

    // 返回正反馈率最高的长度偏好
    return (
      stats.sort((a, b) => b.positiveRate - a.positiveRate)[0]?.length ??
      "balanced"
    );
  }
}
```

### 1.4 实施任务清单

| 任务                      | 优先级 | 预估工时 | 依赖              |
| ------------------------- | ------ | -------- | ----------------- |
| 设计并创建记忆数据库表    | P0     | 4h       | -                 |
| 实现 MemoryManager 核心类 | P0     | 16h      | 数据库表          |
| 集成记忆到 UnifiedEngine  | P0     | 8h       | MemoryManager     |
| 实现 FeedbackCollector    | P1     | 8h       | -                 |
| 前端反馈 UI 组件          | P1     | 8h       | FeedbackCollector |
| 实现 PreferenceInferrer   | P1     | 12h      | 记忆系统          |
| 设计用户画像表            | P1     | 4h       | -                 |
| 实现用户画像更新逻辑      | P1     | 8h       | 画像表            |
| 编写单元测试              | P1     | 12h      | 全部              |
| 集成测试                  | P2     | 8h       | 全部              |

**Phase 1 总计: ~88 小时（约 4 周，单人开发）**

---

## Phase 2: 智能进化（6周）

### 目标

让 Agent 具备「主动思考」能力，能够主动提供洞察、提醒和建议。

### 2.1 主动洞察系统

#### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                 Proactive Intelligence System                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Insight Generator Engine                │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐│   │
│  │  │ Pattern      │  │ Anomaly      │  │ Opportunity ││   │
│  │  │ Detector     │  │ Detector     │  │ Detector    ││   │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘│   │
│  │         │                 │                │       │   │
│  │         └─────────────────┼────────────────┘       │   │
│  │                           ▼                        │   │
│  │                  ┌─────────────────┐              │   │
│  │                  │ Insight Ranker  │              │   │
│  │                  └────────┬────────┘              │   │
│  │                           │                        │   │
│  └───────────────────────────┼────────────────────────┘   │
│                              │                             │
│                              ▼                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Delivery Scheduler                  │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│   │
│  │  │ Push         │ │ In-App       │ │ Digest       ││   │
│  │  │ Notification │ │ Card         │ │ Email        ││   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 洞察类型定义

```typescript
// src/lib/ai-proactive/insight-types.ts

export type InsightCategory =
  | "learning" // 学习建议
  | "organization" // 整理建议
  | "discovery" // 新发现
  | "reminder" // 复习提醒
  | "trend" // 趋势洞察
  | "warning"; // 预警提示

export interface Insight {
  id: string;
  category: InsightCategory;
  title: string;
  summary: string;
  detail?: string;

  // 相关数据
  relatedBookmarks?: number[];
  relatedFolders?: number[];
  relatedTopics?: string[];

  // 建议行动
  suggestedActions: SuggestedAction[];

  // 优先级
  priority: "high" | "medium" | "low";
  urgency: number; // 0-1, 时间敏感度
  relevance: number; // 0-1, 与用户的相关度

  // 状态
  status: "pending" | "delivered" | "acted" | "dismissed";
  createdAt: Date;
  expiresAt?: Date;
}

export interface SuggestedAction {
  type: "skill" | "tool" | "navigation" | "external";
  label: string;
  description?: string;
  skillId?: string;
  toolName?: string;
  params?: Record<string, unknown>;
  url?: string;
}
```

#### 洞察生成器

```typescript
// src/lib/ai-proactive/insight-generators/

// 1. 复习提醒生成器
export class ReviewReminderGenerator implements InsightGenerator {
  async generate(context: ProactiveContext): Promise<Insight[]> {
    const insights: Insight[] = [];

    // 基于艾宾浩斯遗忘曲线
    const dueForReview = await this.findDueForReview(context.userId);

    if (dueForReview.length > 0) {
      insights.push({
        category: "reminder",
        title: `${dueForReview.length} 篇收藏需要复习`,
        summary: `根据记忆曲线，这些内容正处于遗忘临界点，现在复习效果最佳`,
        relatedBookmarks: dueForReview.map((b) => b.id),
        suggestedActions: [
          {
            type: "skill",
            label: "开始复习",
            skillId: "knowledge_review",
            params: { bookmarkIds: dueForReview.map((b) => b.id) },
          },
        ],
        priority: "medium",
        urgency: 0.7,
        relevance: 0.8,
      });
    }

    return insights;
  }
}

// 2. 内容过期检测器
export class StaleContentDetector implements InsightGenerator {
  async generate(context: ProactiveContext): Promise<Insight[]> {
    const insights: Insight[] = [];

    // 检测失效链接
    const brokenLinks = await this.detectBrokenLinks(context.userId);

    if (brokenLinks.length > 0) {
      insights.push({
        category: "warning",
        title: `发现 ${brokenLinks.length} 个失效链接`,
        summary: "这些收藏的链接可能已失效，建议检查或清理",
        relatedBookmarks: brokenLinks.map((b) => b.id),
        suggestedActions: [
          {
            type: "skill",
            label: "批量检查",
            skillId: "link_validator",
            params: { bookmarkIds: brokenLinks.map((b) => b.id) },
          },
          {
            type: "tool",
            label: "批量删除",
            toolName: "batch_delete_bookmarks",
            params: { ids: brokenLinks.map((b) => b.id) },
          },
        ],
        priority: "low",
        urgency: 0.3,
        relevance: 0.6,
      });
    }

    return insights;
  }
}

// 3. 学习机会发现器
export class LearningOpportunityDetector implements InsightGenerator {
  async generate(context: ProactiveContext): Promise<Insight[]> {
    const insights: Insight[] = [];

    // 分析用户最近收藏的主题
    const recentTopics = await this.analyzeRecentTopics(context.userId);

    // 找到主题聚集（用户正在深入某领域）
    const clusters = this.findTopicClusters(recentTopics);

    for (const cluster of clusters) {
      if (cluster.density > 0.7) {
        // 高密度聚集
        insights.push({
          category: "learning",
          title: `您似乎对「${cluster.topic}」很感兴趣`,
          summary: `最近一周您收藏了 ${cluster.count} 篇相关内容，要生成学习路径吗？`,
          relatedBookmarks: cluster.bookmarkIds,
          relatedTopics: [cluster.topic, ...cluster.relatedTopics],
          suggestedActions: [
            {
              type: "skill",
              label: "生成学习路径",
              skillId: "learning_path",
              params: {
                topic: cluster.topic,
                bookmarkIds: cluster.bookmarkIds,
              },
            },
          ],
          priority: "medium",
          urgency: 0.5,
          relevance: 0.9,
        });
      }
    }

    return insights;
  }
}

// 4. 知识空白发现器
export class KnowledgeGapDetector implements InsightGenerator {
  async generate(context: ProactiveContext): Promise<Insight[]> {
    // 基于用户收藏构建知识图谱
    const knowledgeGraph = await this.buildKnowledgeGraph(context.userId);

    // 发现知识空白（缺失的关键连接）
    const gaps = this.findKnowledgeGaps(knowledgeGraph);

    return gaps.map((gap) => ({
      category: "discovery",
      title: `知识空白：${gap.missingConcept}`,
      summary: `您在「${gap.domain}」领域收藏丰富，但缺少「${gap.missingConcept}」相关内容`,
      relatedTopics: [gap.domain, gap.missingConcept],
      suggestedActions: [
        {
          type: "external",
          label: "搜索相关内容",
          url: `https://www.google.com/search?q=${encodeURIComponent(gap.missingConcept)}`,
        },
      ],
      priority: "low",
      relevance: 0.7,
    }));
  }
}
```

### 2.2 智能提醒系统

#### 提醒类型

```typescript
// src/lib/ai-proactive/reminder-types.ts

export type ReminderType =
  | "review_due" // 复习到期
  | "content_expiring" // 内容即将过期
  | "goal_progress" // 目标进度
  | "weekly_digest" // 每周摘要
  | "new_related_content" // 相关新内容
  | "storage_warning" // 存储空间预警
  | "inactive_alert"; // 长期未使用提醒

export interface Reminder {
  id: string;
  type: ReminderType;
  userId: string;

  title: string;
  body: string;

  // 调度
  scheduledFor: Date;
  timezone: string;

  // 投递渠道
  channels: ("push" | "email" | "in_app")[];

  // 状态
  status: "scheduled" | "delivered" | "clicked" | "dismissed";
  deliveredAt?: Date;

  // 关联数据
  payload: Record<string, unknown>;
  deepLink?: string;
}
```

#### 调度引擎

```typescript
// src/lib/ai-proactive/reminder-scheduler.ts

export class ReminderScheduler {
  /**
   * 基于用户偏好调度提醒
   */
  async scheduleReminder(params: {
    userId: string;
    type: ReminderType;
    content: { title: string; body: string };
    payload: Record<string, unknown>;
    urgency: number;
  }): Promise<Reminder> {
    // 1. 获取用户偏好
    const prefs = await this.getUserPreferences(params.userId);

    // 2. 检查静默时段
    const now = new Date();
    const quietHours = prefs.timing.quietHours;

    // 3. 计算最佳投递时间
    let scheduledFor = this.calculateBestTime({
      urgency: params.urgency,
      quietHours,
      preferredTime: prefs.timing.preferredReminderTime,
      userTimezone: prefs.timezone,
    });

    // 4. 选择投递渠道
    const channels = this.selectChannels(params.type, params.urgency, prefs);

    // 5. 创建提醒
    return await this.createReminder({
      ...params,
      scheduledFor,
      channels,
      timezone: prefs.timezone,
    });
  }

  /**
   * 每日洞察摘要
   */
  async generateDailyDigest(userId: string): Promise<void> {
    const insights = await this.insightService.getPendingInsights(userId);
    const stats = await this.statsService.getDailyStats(userId);

    if (insights.length === 0 && stats.changes === 0) {
      return; // 无内容，不发送
    }

    const digest = await this.formatDigest({ insights, stats });

    await this.scheduleReminder({
      userId,
      type: "weekly_digest",
      content: {
        title: "今日知识小报",
        body: digest.summary,
      },
      payload: { fullDigest: digest },
      urgency: 0.3,
    });
  }
}
```

### 2.3 外部世界连接

#### Web 抓取能力

```typescript
// src/lib/ai-external/web-fetcher.ts

export class WebFetcher {
  /**
   * 抓取 URL 内容
   */
  async fetchContent(url: string): Promise<WebContent> {
    // 1. 获取页面
    const response = await this.fetch(url);

    // 2. 解析 HTML
    const $ = cheerio.load(response.data);

    // 3. 提取结构化内容
    return {
      url,
      title: this.extractTitle($),
      description: this.extractDescription($),
      content: this.extractMainContent($),
      publishedAt: this.extractPublishDate($),
      author: this.extractAuthor($),
      images: this.extractImages($),
      metadata: this.extractMetadata($),
    };
  }

  /**
   * 智能摘要
   */
  async summarize(content: WebContent): Promise<Summary> {
    const prompt = `请为以下内容生成摘要：

标题：${content.title}
内容：${content.content.substring(0, 5000)}

要求：
1. 200字以内
2. 提取关键信息
3. 保持客观`;

    return await this.llm.generate(prompt);
  }
}
```

#### 相关内容发现

```typescript
// src/lib/ai-external/content-discovery.ts

export class ContentDiscovery {
  /**
   * 发现相关内容
   */
  async discoverRelated(params: {
    userId: string;
    topic: string;
    existingUrls: string[];
  }): Promise<DiscoveredContent[]> {
    // 1. 搜索相关内容
    const searchResults = await this.searchEngine.search(params.topic);

    // 2. 过滤已有内容
    const newResults = searchResults.filter(
      (r) => !params.existingUrls.includes(r.url),
    );

    // 3. 相关性排序
    const ranked = await this.rankByRelevance(newResults, params.topic);

    // 4. 返回 Top N
    return ranked.slice(0, 10);
  }

  /**
   * 监控主题更新
   */
  async monitorTopic(params: {
    userId: string;
    topic: string;
    frequency: "daily" | "weekly";
  }): Promise<void> {
    // 创建监控任务
    await this.createMonitorJob({
      userId: params.userId,
      topic: params.topic,
      frequency: params.frequency,
      callback: async (newContent) => {
        // 发现新内容时通知用户
        await this.insightService.createInsight({
          userId: params.userId,
          category: "discovery",
          title: `「${params.topic}」有新内容`,
          relatedContent: newContent,
        });
      },
    });
  }
}
```

### 2.4 学习路径增强

```typescript
// src/lib/ai-learning/learning-path-engine.ts

export class LearningPathEngine {
  /**
   * 生成个性化学习路径
   */
  async generatePath(params: {
    userId: string;
    topic: string;
    targetLevel: "beginner" | "intermediate" | "advanced";
    timeCommitment: "light" | "moderate" | "intensive";
  }): Promise<LearningPath> {
    // 1. 分析用户当前水平
    const currentLevel = await this.assessCurrentLevel(
      params.userId,
      params.topic,
    );

    // 2. 获取相关收藏
    const bookmarks = await this.getTopicBookmarks(params.userId, params.topic);

    // 3. 构建知识图谱
    const graph = await this.buildKnowledgeGraph(bookmarks);

    // 4. 规划学习路径
    const nodes = this.planPath({
      graph,
      currentLevel,
      targetLevel: params.targetLevel,
      timeCommitment: params.timeCommitment,
    });

    // 5. 生成里程碑
    const milestones = this.generateMilestones(nodes);

    return {
      id: generateId(),
      topic: params.topic,
      currentLevel,
      targetLevel: params.targetLevel,
      nodes,
      milestones,
      estimatedDuration: this.estimateDuration(nodes, params.timeCommitment),
      progress: 0,
    };
  }

  /**
   * 追踪学习进度
   */
  async trackProgress(
    pathId: string,
    nodeId: string,
    status: NodeStatus,
  ): Promise<void> {
    const path = await this.getPath(pathId);

    // 更新节点状态
    const node = path.nodes.find((n) => n.id === nodeId);
    node.status = status;

    // 检查里程碑
    const completedMilestone = this.checkMilestones(path);

    if (completedMilestone) {
      // 发送庆祝通知
      await this.celebrateMilestone(path.userId, completedMilestone);
    }

    // 建议下一步
    const nextNode = this.suggestNextNode(path);
    if (nextNode) {
      await this.suggestNext(path.userId, nextNode);
    }
  }
}
```

### 2.5 实施任务清单

| 任务                       | 优先级 | 预估工时 | 依赖              |
| -------------------------- | ------ | -------- | ----------------- |
| 设计洞察系统架构           | P0     | 8h       | -                 |
| 实现 InsightGenerator 基类 | P0     | 8h       | -                 |
| 实现复习提醒生成器         | P0     | 12h      | InsightGenerator  |
| 实现内容过期检测器         | P1     | 8h       | InsightGenerator  |
| 实现学习机会发现器         | P1     | 16h      | InsightGenerator  |
| 实现知识空白检测器         | P2     | 12h      | InsightGenerator  |
| 设计提醒调度系统           | P0     | 8h       | -                 |
| 实现 ReminderScheduler     | P0     | 16h      | 提醒设计          |
| 实现每日摘要生成           | P1     | 8h       | ReminderScheduler |
| 实现 WebFetcher            | P1     | 12h      | -                 |
| 实现 ContentDiscovery      | P1     | 16h      | WebFetcher        |
| 增强学习路径引擎           | P1     | 20h      | -                 |
| 前端洞察展示组件           | P1     | 16h      | 洞察系统          |
| 前端提醒管理界面           | P1     | 12h      | 提醒系统          |
| 单元测试                   | P1     | 20h      | 全部              |
| 集成测试                   | P2     | 12h      | 全部              |

**Phase 2 总计: ~194 小时（约 6 周，单人开发）**

---

## Phase 3: 高级能力（8周）

### 目标

让 Agent 具备真正的「自主规划」和「动态编排」能力，能够理解复杂任务并自动分解执行。

### 3.1 自主规划系统

#### ReAct 架构实现

```
┌─────────────────────────────────────────────────────────────┐
│                    Autonomous Planner                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Request                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Task Decomposer                     │   │
│  │  - 任务分解                                          │   │
│  │  - 依赖分析                                          │   │
│  │  - 优先级排序                                        │   │
│  └────────────────────────┬────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Execution Planner                   │   │
│  │  - 工具选择                                          │   │
│  │  - 参数准备                                          │   │
│  │  - 执行顺序                                          │   │
│  └────────────────────────┬────────────────────────────┘   │
│                           │                                 │
│         ┌─────────────────┼─────────────────┐              │
│         │                 │                 │              │
│         ▼                 ▼                 ▼              │
│    ┌─────────┐      ┌─────────┐      ┌─────────┐          │
│    │ Step 1  │  →   │ Step 2  │  →   │ Step N  │          │
│    │ Action  │      │ Action  │      │ Action  │          │
│    └────┬────┘      └────┬────┘      └────┬────┘          │
│         │                 │                 │              │
│         ▼                 ▼                 ▼              │
│    ┌─────────┐      ┌─────────┐      ┌─────────┐          │
│    │ Observe │      │ Observe │      │ Observe │          │
│    │ Result  │      │ Result  │      │ Result  │          │
│    └────┬────┘      └────┬────┘      └────┬────┘          │
│         │                 │                 │              │
│         └─────────────────┼─────────────────┘              │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Reflector                           │   │
│  │  - 结果评估                                          │   │
│  │  - 计划调整                                          │   │
│  │  - 错误恢复                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 核心实现

```typescript
// src/lib/ai-planner/autonomous-planner.ts

export interface Task {
  id: string;
  description: string;
  type: "atomic" | "composite";
  subtasks?: Task[];
  dependencies: string[];
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: unknown;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  tasks: Task[];
  currentTaskIndex: number;
  status: "planning" | "executing" | "completed" | "failed";
  startedAt?: Date;
  completedAt?: Date;
}

export class AutonomousPlanner {
  private llm: LLM;
  private toolRegistry: ToolRegistry;
  private skillRegistry: SkillRegistry;

  /**
   * 分解复杂任务
   */
  async decompose(request: string, context: PlannerContext): Promise<Task[]> {
    const prompt = `作为任务规划专家，请分解以下用户请求：

用户请求：${request}

用户上下文：
- 书签总数：${context.totalBookmarks}
- 文件夹数：${context.totalFolders}
- 最近活动：${context.recentActivity}

可用工具：
${this.formatAvailableTools()}

可用技能：
${this.formatAvailableSkills()}

请输出任务分解结果（JSON格式）：
{
  "goal": "总体目标描述",
  "tasks": [
    {
      "id": "task_1",
      "description": "任务描述",
      "type": "atomic",
      "tool_or_skill": "要使用的工具或技能名称",
      "params": {},
      "dependencies": []
    }
  ],
  "reasoning": "分解理由"
}`;

    const response = await this.llm.generate(prompt);
    const plan = JSON.parse(response);

    // 验证计划合理性
    this.validatePlan(plan);

    return plan.tasks;
  }

  /**
   * 执行计划
   */
  async *execute(
    plan: ExecutionPlan,
    context: PlannerContext,
  ): AsyncGenerator<PlannerEvent> {
    yield { type: "plan_started", plan };

    for (const task of plan.tasks) {
      // 检查依赖
      const dependenciesMet = await this.checkDependencies(task, plan);
      if (!dependenciesMet) {
        yield { type: "task_blocked", task, reason: "dependencies_not_met" };
        continue;
      }

      // 开始执行
      task.status = "in_progress";
      yield { type: "task_started", task };

      try {
        // 执行任务
        const result = await this.executeTask(task, context);
        task.result = result;
        task.status = "completed";
        yield { type: "task_completed", task, result };

        // 反思并可能调整计划
        const adjustment = await this.reflect(task, result, plan);
        if (adjustment) {
          yield { type: "plan_adjusted", adjustment };
          this.applyAdjustment(plan, adjustment);
        }
      } catch (error) {
        task.status = "failed";
        task.error = error.message;
        yield { type: "task_failed", task, error };

        // 尝试恢复
        const recovery = await this.attemptRecovery(task, error, plan);
        if (recovery) {
          yield { type: "recovery_attempted", recovery };
          // 继续或中止根据恢复结果
        }
      }
    }

    yield { type: "plan_completed", plan };
  }

  /**
   * 反思执行结果
   */
  private async reflect(
    task: Task,
    result: unknown,
    plan: ExecutionPlan,
  ): Promise<PlanAdjustment | null> {
    const prompt = `评估任务执行结果：

任务：${task.description}
预期结果：${task.expectedResult}
实际结果：${JSON.stringify(result)}

整体目标：${plan.goal}
剩余任务：${this.formatRemainingTasks(plan)}

问题：
1. 任务是否成功完成？
2. 结果是否符合预期？
3. 是否需要调整后续计划？

如需调整，请输出：
{
  "needsAdjustment": true,
  "adjustments": [
    { "action": "add|remove|modify", "task": {...} }
  ],
  "reasoning": "调整原因"
}`;

    const response = await this.llm.generate(prompt);
    const reflection = JSON.parse(response);

    return reflection.needsAdjustment ? reflection : null;
  }
}
```

### 3.2 动态工具编排

```typescript
// src/lib/ai-planner/dynamic-orchestrator.ts

export class DynamicOrchestrator {
  /**
   * 动态组合工具完成任务
   */
  async orchestrate(params: {
    goal: string;
    context: OrchestratorContext;
    constraints?: OrchestratorConstraints;
  }): Promise<OrchestratorResult> {
    // 1. 分析目标，选择工具组合
    const toolSelection = await this.selectTools(params.goal, params.context);

    // 2. 规划执行顺序
    const executionOrder = this.planExecutionOrder(toolSelection);

    // 3. 准备数据流
    const dataFlow = this.prepareDataFlow(executionOrder);

    // 4. 执行工具链
    const results: ToolResult[] = [];

    for (const step of executionOrder) {
      const input = this.resolveInput(step, dataFlow, results);
      const result = await this.executeTool(step.tool, input);
      results.push(result);

      // 动态调整（如果需要）
      if (this.shouldAdjust(result, step.expectedOutput)) {
        const adjustment = await this.planAdjustment(result, executionOrder);
        this.applyAdjustment(executionOrder, adjustment);
      }
    }

    // 5. 整合结果
    return this.synthesizeResults(results, params.goal);
  }

  /**
   * 智能工具选择
   */
  private async selectTools(
    goal: string,
    context: OrchestratorContext,
  ): Promise<ToolSelection[]> {
    // 获取所有可用工具
    const allTools = await this.toolRegistry.getAll();

    // 使用 LLM 选择合适的工具
    const prompt = `根据以下目标选择工具：

目标：${goal}

可用工具：
${allTools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

请选择完成目标所需的工具（可能需要多个）：
{
  "tools": [
    {
      "name": "工具名称",
      "purpose": "在本任务中的作用",
      "requiredParams": ["需要的参数"],
      "outputUsedFor": "输出将如何被使用"
    }
  ],
  "reasoning": "选择理由"
}`;

    const response = await this.llm.generate(prompt);
    return JSON.parse(response).tools;
  }
}
```

### 3.3 多模态支持

```typescript
// src/lib/ai-multimodal/multimodal-handler.ts

export class MultimodalHandler {
  /**
   * 处理图片输入
   */
  async processImage(params: {
    image: Buffer;
    query?: string;
    context: MultimodalContext;
  }): Promise<ImageAnalysisResult> {
    // 1. 图片识别
    const recognition = await this.visionModel.analyze(params.image);

    // 2. 提取文本（OCR）
    const extractedText = await this.ocr.extract(params.image);

    // 3. 理解图片内容
    const understanding = await this.llm.analyzeImage({
      image: params.image,
      recognition,
      extractedText,
      query: params.query,
    });

    // 4. 关联到书签系统
    const relatedBookmarks = await this.findRelatedBookmarks(
      understanding.topics,
      params.context.userId,
    );

    return {
      recognition,
      extractedText,
      understanding,
      relatedBookmarks,
      suggestedActions: this.suggestActions(understanding),
    };
  }

  /**
   * 处理语音输入
   */
  async processVoice(params: {
    audio: Buffer;
    context: MultimodalContext;
  }): Promise<VoiceInputResult> {
    // 1. 语音转文字
    const transcription = await this.speechToText.transcribe(params.audio);

    // 2. 意图理解
    const intent = await this.intentClassifier.classify(transcription.text);

    // 3. 转发到统一引擎
    return {
      transcription,
      intent,
      // 可以直接传递给 UnifiedEngine 处理
      message: transcription.text,
    };
  }

  /**
   * 生成可视化
   */
  async generateVisualization(params: {
    type: "chart" | "mindmap" | "timeline";
    data: unknown;
    style?: VisualizationStyle;
  }): Promise<Visualization> {
    switch (params.type) {
      case "chart":
        return await this.chartGenerator.generate(params.data, params.style);
      case "mindmap":
        return await this.mindmapGenerator.generate(params.data, params.style);
      case "timeline":
        return await this.timelineGenerator.generate(params.data, params.style);
    }
  }
}
```

### 3.4 协作能力

```typescript
// src/lib/ai-collaboration/collaboration-manager.ts

export class CollaborationManager {
  /**
   * 分享知识库
   */
  async shareKnowledge(params: {
    userId: string;
    bookmarkIds: number[];
    targetUsers: string[];
    permissions: SharePermission;
  }): Promise<ShareResult> {
    // 1. 创建分享包
    const bundle = await this.createShareBundle(params.bookmarkIds);

    // 2. 设置权限
    await this.setPermissions(bundle.id, params.permissions);

    // 3. 通知目标用户
    await this.notifyTargetUsers(params.targetUsers, bundle);

    return {
      bundleId: bundle.id,
      shareLink: this.generateShareLink(bundle.id),
      expiresAt: params.permissions.expiresAt,
    };
  }

  /**
   * 协作整理
   */
  async collaborativeOrganize(params: {
    teamId: string;
    folderIds: number[];
    strategy: OrganizeStrategy;
  }): Promise<CollaborativeOrganizeResult> {
    // 1. 获取团队成员
    const members = await this.getTeamMembers(params.teamId);

    // 2. 分配整理任务
    const assignments = this.assignTasks(members, params.folderIds);

    // 3. 协调执行
    const results = await Promise.all(
      assignments.map((a) => this.executeAssignment(a)),
    );

    // 4. 合并结果
    return this.mergeResults(results);
  }
}
```

### 3.5 实施任务清单

| 任务                     | 优先级 | 预估工时 | 依赖             |
| ------------------------ | ------ | -------- | ---------------- |
| 设计自主规划架构         | P0     | 12h      | -                |
| 实现 TaskDecomposer      | P0     | 20h      | -                |
| 实现 ExecutionPlanner    | P0     | 20h      | TaskDecomposer   |
| 实现 Reflector           | P0     | 16h      | ExecutionPlanner |
| 实现 DynamicOrchestrator | P0     | 24h      | -                |
| 实现错误恢复机制         | P1     | 12h      | Reflector        |
| 图片处理能力             | P1     | 16h      | -                |
| 语音输入能力             | P1     | 12h      | -                |
| 可视化生成器             | P1     | 20h      | -                |
| 协作分享能力             | P2     | 16h      | -                |
| 协作整理能力             | P2     | 12h      | -                |
| 前端规划可视化           | P1     | 16h      | 规划系统         |
| 前端多模态输入           | P1     | 12h      | 多模态处理       |
| 单元测试                 | P1     | 24h      | 全部             |
| 集成测试                 | P2     | 16h      | 全部             |
| 性能优化                 | P2     | 12h      | 全部             |

**Phase 3 总计: ~260 小时（约 8 周，单人开发）**

---

## 第三部分：技术架构升级

### 3.1 整体架构演进

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AnyKeep Agent 2.0 Architecture                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                          ┌──────────────────┐                           │
│                          │   用户交互层      │                           │
│                          │ - 文本/语音/图片  │                           │
│                          │ - Web/Mobile/API │                           │
│                          └────────┬─────────┘                           │
│                                   │                                     │
│                                   ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                       Unified Gateway                               ││
│  │  - 统一入口                                                         ││
│  │  - 多模态处理                                                       ││
│  │  - 认证/限流                                                        ││
│  └────────────────────────────────┬───────────────────────────────────┘│
│                                   │                                     │
│     ┌─────────────────────────────┼─────────────────────────────────┐  │
│     │                             │                                 │  │
│     ▼                             ▼                                 ▼  │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐  │
│  │ 记忆系统      │         │ 意图理解层    │         │ 主动智能层   │  │
│  │             │         │              │         │              │  │
│  │ - 长期记忆   │◄────────│ - 意图分类   │         │ - 洞察生成   │  │
│  │ - 用户画像   │         │ - 复杂度评估  │         │ - 提醒调度   │  │
│  │ - 偏好学习   │         │ - 实体提取   │         │ - 趋势监控   │  │
│  └──────┬───────┘         └──────┬───────┘         └──────┬───────┘  │
│         │                        │                        │          │
│         └────────────────────────┼────────────────────────┘          │
│                                  │                                    │
│                                  ▼                                    │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                      Autonomous Planner                            ││
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            ││
│  │  │ 任务分解    │ →  │ 执行规划    │ →  │ 反思调整    │            ││
│  │  └─────────────┘    └─────────────┘    └─────────────┘            ││
│  └────────────────────────────────┬───────────────────────────────────┘│
│                                   │                                     │
│                 ┌─────────────────┼─────────────────┐                  │
│                 │                 │                 │                  │
│                 ▼                 ▼                 ▼                  │
│  ┌────────────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Atomic Engine    │  │ Orchestrator │  │  Dynamic Combiner    │   │
│  │                    │  │              │  │                      │   │
│  │ - KnowledgeAgent   │  │ - 15 Skills  │  │ - 动态工具组合        │   │
│  │ - 95 Tools         │  │ - 多步骤执行  │  │ - 运行时编排          │   │
│  └────────────────────┘  └──────────────┘  └──────────────────────┘   │
│                                   │                                     │
│                                   ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                        Effect Layer                                 ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           ││
│  │  │ 确认服务  │  │ 通知服务  │  │ 审计日志  │  │ 反馈收集  │           ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           ││
│  └────────────────────────────────┬───────────────────────────────────┘│
│                                   │                                     │
│                                   ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                        Data Layer                                   ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           ││
│  │  │ Supabase │  │ 向量存储  │  │ 记忆存储  │  │ 缓存层    │           ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                      External Connections                           ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           ││
│  │  │ Web抓取  │  │ 搜索引擎  │  │ 第三方API │  │ 推送服务  │           ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 数据库架构扩展

```sql
-- 新增表汇总
-- Phase 1
CREATE TABLE agent_memories (...);      -- 记忆存储
CREATE TABLE user_profiles (...);       -- 用户画像
CREATE TABLE agent_feedback (...);      -- 反馈记录

-- Phase 2
CREATE TABLE insights (...);            -- 洞察记录
CREATE TABLE reminders (...);           -- 提醒调度
CREATE TABLE monitored_topics (...);    -- 主题监控
CREATE TABLE learning_paths (...);      -- 学习路径

-- Phase 3
CREATE TABLE execution_plans (...);     -- 执行计划
CREATE TABLE task_logs (...);           -- 任务日志
CREATE TABLE shared_bundles (...);      -- 分享包
CREATE TABLE team_collaborations (...); -- 团队协作
```

### 3.3 API 扩展

```typescript
// 新增 API 端点

// Phase 1
POST /api/agent/feedback          // 提交反馈
GET  /api/agent/memories          // 获取记忆
GET  /api/user/profile            // 获取用户画像
PUT  /api/user/preferences        // 更新偏好

// Phase 2
GET  /api/agent/insights          // 获取洞察
POST /api/agent/insights/dismiss  // 忽略洞察
GET  /api/agent/reminders         // 获取提醒
POST /api/agent/topics/monitor    // 添加主题监控
GET  /api/agent/learning-paths    // 获取学习路径

// Phase 3
POST /api/agent/plan              // 创建执行计划
GET  /api/agent/plan/:id          // 获取计划状态
POST /api/agent/plan/:id/adjust   // 调整计划
POST /api/agent/multimodal        // 多模态输入
POST /api/agent/share             // 创建分享
```

---

## 第四部分：成本与风险评估

### 4.1 资源需求

| Phase    | 开发工时 | 预估周期 | 所需角色          |
| -------- | -------- | -------- | ----------------- |
| Phase 1  | 88h      | 4周      | 全栈 ×1           |
| Phase 2  | 194h     | 6周      | 全栈 ×1 + AI ×0.5 |
| Phase 3  | 260h     | 8周      | 全栈 ×1 + AI ×1   |
| **总计** | **542h** | **18周** | -                 |

### 4.2 LLM 成本估算

| 功能     | 调用频率    | 单次 Token | 月估算成本 (GPT-4) |
| -------- | ----------- | ---------- | ------------------ |
| 意图理解 | 高 (10k/月) | 500        | $150               |
| 任务规划 | 中 (2k/月)  | 2000       | $120               |
| 洞察生成 | 低 (500/月) | 1500       | $22                |
| 摘要生成 | 中 (3k/月)  | 1000       | $90                |
| **总计** | -           | -          | **~$400/月**       |

### 4.3 风险矩阵

| 风险           | 影响 | 概率 | 缓解措施             |
| -------------- | ---- | ---- | -------------------- |
| LLM API 不稳定 | 高   | 中   | 多模型备份、降级策略 |
| 成本超预期     | 中   | 中   | 分层缓存、规则优先   |
| 隐私合规问题   | 高   | 低   | 数据本地化、透明授权 |
| 用户不适应     | 中   | 中   | 渐进式引导、可关闭   |
| 性能问题       | 中   | 低   | 异步处理、缓存优化   |

---

## 第五部分：成功指标

### 5.1 用户价值指标

| 指标         | 当前基线 | Phase 1 目标 | Phase 2 目标 | Phase 3 目标 |
| ------------ | -------- | ------------ | ------------ | ------------ |
| 日活跃率     | 20%      | 30%          | 45%          | 60%          |
| 平均会话时长 | 3min     | 5min         | 8min         | 12min        |
| Agent 使用率 | 10%      | 25%          | 50%          | 70%          |
| 用户满意度   | -        | 3.5/5        | 4.0/5        | 4.5/5        |
| 任务完成率   | 60%      | 75%          | 85%          | 92%          |

### 5.2 技术指标

| 指标                 | 当前基线 | 目标值 |
| -------------------- | -------- | ------ |
| 意图识别准确率       | 75%      | 95%    |
| 首次响应时间         | 2s       | <1s    |
| 复杂任务成功率       | 40%      | 85%    |
| API 可用性           | 99%      | 99.9%  |
| 单位成本 ($/用户/月) | $0.5     | <$1    |

---

## 第六部分：实施建议

### 6.1 优先级建议

作为 CTO，我的建议是：

1. **Phase 1 必做** - 记忆和个性化是 Agent 进化的基础
2. **Phase 2 高优** - 主动智能是差异化竞争的关键
3. **Phase 3 择优** - 根据用户反馈选择性实施

### 6.2 快速验证策略

1. **MVP 验证** (2周)
   - 仅实现「用户画像 + 偏好推断」
   - 观察用户采纳率

2. **A/B 测试**
   - 对比有无记忆系统的用户留存
   - 对比有无主动提醒的活跃度

3. **用户访谈**
   - 每 Phase 后进行 5-10 人深度访谈
   - 收集真实需求和反馈

### 6.3 渐进式发布

```
Week 1-4:   Phase 1 开发 → Alpha 内测
Week 5-6:   数据收集 → 调优
Week 7-12:  Phase 2 开发 → Beta 测试
Week 13-14: 稳定化 → 正式发布
Week 15-22: Phase 3 开发 → 分批发布
```

---

## 附录

### A. 竞品分析

| 产品            | 主动性   | 个性化   | 自主规划 | 多模态   | 参考价值 |
| --------------- | -------- | -------- | -------- | -------- | -------- |
| Notion AI       | ⭐⭐     | ⭐⭐⭐   | ⭐       | ⭐⭐     | 内容整理 |
| Mem.ai          | ⭐⭐⭐   | ⭐⭐⭐⭐ | ⭐⭐     | ⭐⭐     | 记忆系统 |
| Rewind.ai       | ⭐⭐⭐⭐ | ⭐⭐⭐   | ⭐       | ⭐⭐⭐⭐ | 多模态   |
| Claude Projects | ⭐⭐     | ⭐⭐     | ⭐⭐⭐   | ⭐⭐⭐   | 自主规划 |

### B. 技术选型建议

| 领域     | 建议选型          | 理由                 |
| -------- | ----------------- | -------------------- |
| LLM      | Claude 3.5 Sonnet | 性价比高、工具调用强 |
| 向量存储 | pgvector (已有)   | 无需新增基础设施     |
| 语音识别 | Whisper API       | 多语言、高准确率     |
| 图像识别 | Claude Vision     | 已集成、理解力强     |
| 推送服务 | Firebase FCM      | 跨平台、免费         |

### C. 相关文档链接

- [现有 AI Skills 架构](./CLAUDE.md#5-ai-skills-统一智能架构-)
- [现有 Tools 清单](../src/lib/ai-agent/tools/)
- [现有 Skills 清单](../src/lib/ai-skills/skills/)
- [API 文档](../src/app/api/agent/)

---

**文档结束**

> 请审核后告知 BMad Master，我将根据您的反馈调整计划。
