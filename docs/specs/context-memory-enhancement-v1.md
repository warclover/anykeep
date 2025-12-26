# 上下文记忆增强 v1.0 实施方案

**版本**: v1.0.0
**日期**: 2025-12-27
**作者**: Winston (Architect Agent)
**状态**: 待审核

---

## 一、方案概述

### 1.1 目标

构建**四层记忆架构**，让 AI 助手具备跨会话记忆能力，提升用户体验的连续性和个性化程度。

### 1.2 核心价值

| 价值点             | 说明                                  |
| ------------------ | ------------------------------------- |
| **跨会话延续**     | AI 记住上次对话内容，无需用户重复解释 |
| **偏好自动学习**   | 从用户行为中学习，越用越懂用户        |
| **智能上下文压缩** | 长对话不丢失关键信息                  |
| **主动提醒**       | 基于历史记录主动提供建议              |

### 1.3 设计约束

- ✅ 复用现有 `DynamicContext` 结构，最小侵入
- ✅ Feature Flag 控制，支持渐进式发布
- ✅ 情景记忆注入控制在 200-300 token
- ✅ 数据库操作使用 RLS 确保安全
- ✅ 兼容任务理解层 v2.0

---

## 二、架构设计

### 2.1 四层记忆架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Memory Architecture v1.0                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  L4: Semantic Memory (语义记忆) - P2                     │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  • 用户知识图谱 (兴趣、专业领域)                          │   │
│  │  • 收藏语义聚类 (主题、关联)                              │   │
│  │  存储: profiles.knowledge_graph JSONB                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           ▲                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  L3: Episodic Memory (情景记忆) - P0 ⭐                  │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  • 会话摘要 (每会话结束生成)                              │   │
│  │  • 关键决策记录 (用户确认/拒绝)                           │   │
│  │  • 未完成意图追踪                                        │   │
│  │  存储: ai_conversation_summaries 表                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           ▲                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  L2: Working Memory (工作记忆) - 现有                    │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  • DynamicContext (统计、偏好、会话)                      │   │
│  │  • AgentMemory (当前会话消息)                            │   │
│  │  存储: 内存                                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           ▲                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  L1: Sensory Memory (感知记忆) - 现有                    │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  • 当前用户消息                                          │   │
│  │  • 附件上下文                                            │   │
│  │  存储: 请求生命周期                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流设计

```
用户发送消息
      │
      ▼
┌─────────────────┐
│  L1: 感知记忆   │ ← 解析用户输入
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  L2: 工作记忆   │ ← 加载 DynamicContext + 当前会话
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  L3: 情景记忆   │ ← 加载最近 N 次会话摘要 (新增)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  L4: 语义记忆   │ ← 加载用户知识图谱 (P2)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Prompt 组装    │ ← 合并所有上下文
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM 处理      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  响应 + 学习    │ ← 记录交互日志
└─────────────────┘
```

---

## 三、数据库设计

### 3.1 会话摘要表 (情景记忆)

```sql
-- 文件: supabase/migrations/20251227000001_add_ai_conversation_summaries.sql

-- ============================================================================
-- 会话摘要表 - 存储每次对话的摘要和关键信息
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,

  -- 摘要内容
  summary TEXT NOT NULL,

  -- 用户意图关键词 (用于快速检索)
  intents TEXT[] DEFAULT '{}',

  -- 执行的重要操作
  actions JSONB DEFAULT '[]',
  -- 格式: [{ "type": "organize", "target": "B站视频", "outcome": "success" }]

  -- 学习到的用户偏好
  learned_preferences JSONB DEFAULT '{}',
  -- 格式: { "preferFolderOverTag": true, "defaultExportFormat": "markdown" }

  -- 未完成的意图 (用于下次提醒)
  pending_intents TEXT[] DEFAULT '{}',

  -- 消息数量 (用于判断会话深度)
  message_count INT DEFAULT 0,

  -- 会话情感基调
  sentiment TEXT DEFAULT 'neutral',
  -- 可选值: 'positive', 'negative', 'neutral', 'frustrated'

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  CONSTRAINT valid_sentiment CHECK (sentiment IN ('positive', 'negative', 'neutral', 'frustrated'))
);

-- 索引
CREATE INDEX idx_summaries_user_time
  ON ai_conversation_summaries(user_id, created_at DESC);

CREATE INDEX idx_summaries_intents
  ON ai_conversation_summaries USING GIN(intents);

CREATE INDEX idx_summaries_pending
  ON ai_conversation_summaries(user_id)
  WHERE array_length(pending_intents, 1) > 0;

-- RLS 策略
ALTER TABLE ai_conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own summaries"
  ON ai_conversation_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own summaries"
  ON ai_conversation_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own summaries"
  ON ai_conversation_summaries FOR DELETE
  USING (auth.uid() = user_id);

-- 注释
COMMENT ON TABLE ai_conversation_summaries IS '存储 AI 会话摘要，用于跨会话记忆';
COMMENT ON COLUMN ai_conversation_summaries.intents IS '会话中识别到的用户意图关键词';
COMMENT ON COLUMN ai_conversation_summaries.pending_intents IS '用户提到但未执行的意图，下次可主动提醒';
```

### 3.2 交互日志表 (行为学习)

```sql
-- 文件: supabase/migrations/20251227000002_add_ai_interaction_logs.sql

-- ============================================================================
-- 交互日志表 - 记录用户与 AI 的交互行为，用于学习偏好
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_interaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,

  -- 交互类型
  action_type TEXT NOT NULL,
  -- 可选值: 'search', 'organize', 'export', 'delete', 'tag', 'move', 'undo', 'confirm', 'cancel'

  -- 操作目标描述
  action_target TEXT,
  -- 如: "B站视频", "前端相关收藏", "React文章"

  -- 用户反馈
  user_feedback TEXT,
  -- 可选值: 'positive' (接受), 'negative' (拒绝/撤销), 'modified' (修改后接受)

  -- AI 建议内容 (如有)
  ai_suggestion JSONB,
  -- 格式: { "suggestedFolder": "技术", "suggestedTags": ["React", "前端"] }

  -- 用户最终选择 (如有)
  user_choice JSONB,
  -- 格式: { "chosenFolder": "编程", "chosenTags": ["React"] }

  -- 上下文信息
  context JSONB DEFAULT '{}',
  -- 格式: { "messageCount": 5, "confidence": 0.85 }

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  CONSTRAINT valid_action_type CHECK (
    action_type IN ('search', 'organize', 'export', 'delete', 'tag', 'move', 'undo', 'confirm', 'cancel', 'clarify')
  ),
  CONSTRAINT valid_feedback CHECK (
    user_feedback IS NULL OR user_feedback IN ('positive', 'negative', 'modified')
  )
);

-- 索引
CREATE INDEX idx_interactions_user_time
  ON ai_interaction_logs(user_id, created_at DESC);

CREATE INDEX idx_interactions_type
  ON ai_interaction_logs(user_id, action_type);

CREATE INDEX idx_interactions_feedback
  ON ai_interaction_logs(user_id, user_feedback)
  WHERE user_feedback IS NOT NULL;

-- RLS 策略
ALTER TABLE ai_interaction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs"
  ON ai_interaction_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert logs"
  ON ai_interaction_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 自动清理超过 90 天的日志 (可选，通过 Edge Function 或 pg_cron)
-- CREATE OR REPLACE FUNCTION cleanup_old_interaction_logs()
-- RETURNS void AS $$
-- BEGIN
--   DELETE FROM ai_interaction_logs WHERE created_at < NOW() - INTERVAL '90 days';
-- END;
-- $$ LANGUAGE plpgsql;

-- 注释
COMMENT ON TABLE ai_interaction_logs IS '记录用户与 AI 的交互行为，用于偏好学习';
COMMENT ON COLUMN ai_interaction_logs.user_feedback IS '用户对 AI 建议的反馈，用于学习用户偏好';
```

### 3.3 数据库函数

```sql
-- 文件: supabase/migrations/20251227000003_add_ai_memory_functions.sql

-- ============================================================================
-- 获取最近会话摘要
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_summaries(
  p_user_id UUID,
  p_limit INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  summary TEXT,
  intents TEXT[],
  actions JSONB,
  pending_intents TEXT[],
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.session_id,
    s.summary,
    s.intents,
    s.actions,
    s.pending_intents,
    s.created_at
  FROM ai_conversation_summaries s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 获取未完成意图
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_intents(p_user_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  result TEXT[] := '{}';
BEGIN
  SELECT array_agg(DISTINCT intent)
  INTO result
  FROM ai_conversation_summaries s,
       unnest(s.pending_intents) AS intent
  WHERE s.user_id = p_user_id
    AND s.created_at > NOW() - INTERVAL '7 days'
    AND array_length(s.pending_intents, 1) > 0;

  RETURN COALESCE(result, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 学习用户偏好 (从交互日志中分析)
-- ============================================================================

CREATE OR REPLACE FUNCTION analyze_user_preferences(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  positive_count INT;
  negative_count INT;
  common_actions TEXT[];
BEGIN
  -- 统计正面/负面反馈比例
  SELECT
    COUNT(*) FILTER (WHERE user_feedback = 'positive'),
    COUNT(*) FILTER (WHERE user_feedback = 'negative')
  INTO positive_count, negative_count
  FROM ai_interaction_logs
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '30 days';

  -- 获取最常用的操作类型
  SELECT array_agg(action_type ORDER BY cnt DESC)
  INTO common_actions
  FROM (
    SELECT action_type, COUNT(*) as cnt
    FROM ai_interaction_logs
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY action_type
    ORDER BY cnt DESC
    LIMIT 3
  ) sub;

  result := jsonb_build_object(
    'positiveRate', CASE WHEN (positive_count + negative_count) > 0
      THEN positive_count::float / (positive_count + negative_count)
      ELSE 0.5 END,
    'commonActions', COALESCE(common_actions, '{}'),
    'totalInteractions', positive_count + negative_count
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授权
GRANT EXECUTE ON FUNCTION get_recent_summaries TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_intents TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_user_preferences TO authenticated;
```

---

## 四、代码实现

### 4.1 文件变更清单

| 文件                                               | 操作 | 说明                |
| -------------------------------------------------- | ---- | ------------------- |
| `src/lib/ai-agent/memory/episodic-memory.ts`       | 新增 | 情景记忆服务        |
| `src/lib/ai-agent/memory/interaction-logger.ts`    | 新增 | 交互日志记录器      |
| `src/lib/ai-agent/memory/memory-prompt-builder.ts` | 新增 | 记忆 Prompt 构建    |
| `src/lib/ai-agent/memory/types.ts`                 | 新增 | 类型定义            |
| `src/lib/ai-agent/memory/index.ts`                 | 新增 | 模块导出            |
| `src/lib/ai-agent/context/types.ts`                | 修改 | 扩展 DynamicContext |
| `src/lib/ai-agent/context/prompt-injector.ts`      | 修改 | 集成情景记忆注入    |
| `src/lib/ai-agent/config/feature-flags.ts`         | 修改 | 添加记忆相关开关    |
| `src/lib/ai-agent/core/agent-memory.ts`            | 修改 | 添加会话结束钩子    |

### 4.2 类型定义

```typescript
// src/lib/ai-agent/memory/types.ts

/**
 * 上下文记忆类型定义
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

// =============================================================================
// 会话摘要 (情景记忆)
// =============================================================================

/**
 * 操作记录
 */
export interface ActionRecord {
  /** 操作类型 */
  type: "search" | "organize" | "export" | "delete" | "tag" | "move";
  /** 操作目标描述 */
  target: string;
  /** 操作结果 */
  outcome: "success" | "cancelled" | "modified";
  /** 用户反馈 */
  userFeedback?: "positive" | "negative" | "modified";
}

/**
 * 会话摘要
 */
export interface ConversationSummary {
  id: string;
  userId: string;
  sessionId: string;
  /** 会话摘要 (AI 生成或规则生成) */
  summary: string;
  /** 用户意图关键词 */
  intents: string[];
  /** 执行的重要操作 */
  actions: ActionRecord[];
  /** 学习到的用户偏好 */
  learnedPreferences: Record<string, unknown>;
  /** 未完成的意图 */
  pendingIntents: string[];
  /** 消息数量 */
  messageCount: number;
  /** 会话情感基调 */
  sentiment: "positive" | "negative" | "neutral" | "frustrated";
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 创建会话摘要的输入
 */
export interface CreateSummaryInput {
  sessionId: string;
  summary: string;
  intents?: string[];
  actions?: ActionRecord[];
  learnedPreferences?: Record<string, unknown>;
  pendingIntents?: string[];
  messageCount?: number;
  sentiment?: ConversationSummary["sentiment"];
}

// =============================================================================
// 交互日志
// =============================================================================

/**
 * 交互日志记录
 */
export interface InteractionLog {
  id: string;
  userId: string;
  sessionId?: string;
  /** 操作类型 */
  actionType: InteractionActionType;
  /** 操作目标描述 */
  actionTarget?: string;
  /** 用户反馈 */
  userFeedback?: "positive" | "negative" | "modified";
  /** AI 建议内容 */
  aiSuggestion?: Record<string, unknown>;
  /** 用户最终选择 */
  userChoice?: Record<string, unknown>;
  /** 上下文信息 */
  context?: Record<string, unknown>;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 交互类型
 */
export type InteractionActionType =
  | "search"
  | "organize"
  | "export"
  | "delete"
  | "tag"
  | "move"
  | "undo"
  | "confirm"
  | "cancel"
  | "clarify";

/**
 * 记录交互的输入
 */
export interface LogInteractionInput {
  sessionId?: string;
  actionType: InteractionActionType;
  actionTarget?: string;
  userFeedback?: InteractionLog["userFeedback"];
  aiSuggestion?: Record<string, unknown>;
  userChoice?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

// =============================================================================
// 情景记忆上下文 (注入到 DynamicContext)
// =============================================================================

/**
 * 情景记忆上下文
 */
export interface EpisodicMemoryContext {
  /** 最近会话摘要 (最多 3 条) */
  recentSummaries: ConversationSummarySummary[];
  /** 未完成的意图 (跨会话) */
  pendingIntents: string[];
  /** 用户偏好分析结果 */
  preferenceAnalysis?: PreferenceAnalysis;
}

/**
 * 会话摘要精简版 (用于 Prompt 注入)
 */
export interface ConversationSummarySummary {
  /** 相对时间，如 "3天前" */
  relativeTime: string;
  /** 摘要内容 */
  summary: string;
  /** 主要意图 */
  mainIntents: string[];
  /** 未完成意图 (如有) */
  pendingIntents?: string[];
}

/**
 * 偏好分析结果
 */
export interface PreferenceAnalysis {
  /** 正面反馈率 */
  positiveRate: number;
  /** 常用操作类型 */
  commonActions: string[];
  /** 总交互次数 */
  totalInteractions: number;
}
```

### 4.3 情景记忆服务

```typescript
// src/lib/ai-agent/memory/episodic-memory.ts

/**
 * 情景记忆服务
 *
 * 管理会话摘要的存储、检索和分析
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  ConversationSummary,
  CreateSummaryInput,
  EpisodicMemoryContext,
  ConversationSummarySummary,
  PreferenceAnalysis,
} from "./types";
import { formatRelativeTime } from "./utils";

/**
 * 情景记忆服务配置
 */
export interface EpisodicMemoryConfig {
  /** 加载的最近摘要数量 */
  maxRecentSummaries: number;
  /** 未完成意图的有效期 (天) */
  pendingIntentExpiryDays: number;
}

const DEFAULT_CONFIG: EpisodicMemoryConfig = {
  maxRecentSummaries: 3,
  pendingIntentExpiryDays: 7,
};

/**
 * 情景记忆服务
 */
export class EpisodicMemoryService {
  private config: EpisodicMemoryConfig;

  constructor(config: Partial<EpisodicMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 保存会话摘要
   */
  async saveSummary(
    userId: string,
    input: CreateSummaryInput,
  ): Promise<ConversationSummary | null> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("ai_conversation_summaries")
        .insert({
          user_id: userId,
          session_id: input.sessionId,
          summary: input.summary,
          intents: input.intents ?? [],
          actions: input.actions ?? [],
          learned_preferences: input.learnedPreferences ?? {},
          pending_intents: input.pendingIntents ?? [],
          message_count: input.messageCount ?? 0,
          sentiment: input.sentiment ?? "neutral",
        })
        .select()
        .single();

      if (error) {
        logger.error(
          { error, userId },
          "EpisodicMemory: Failed to save summary",
        );
        return null;
      }

      logger.info(
        { summaryId: data.id, userId, sessionId: input.sessionId },
        "EpisodicMemory: Saved conversation summary",
      );

      return this.mapToSummary(data);
    } catch (error) {
      logger.error({ error, userId }, "EpisodicMemory: Error saving summary");
      return null;
    }
  }

  /**
   * 加载情景记忆上下文
   */
  async loadContext(userId: string): Promise<EpisodicMemoryContext> {
    try {
      const supabase = await createClient();

      // 并行加载数据
      const [summariesResult, pendingResult, preferencesResult] =
        await Promise.all([
          // 1. 获取最近摘要
          supabase.rpc("get_recent_summaries", {
            p_user_id: userId,
            p_limit: this.config.maxRecentSummaries,
          }),
          // 2. 获取未完成意图
          supabase.rpc("get_pending_intents", { p_user_id: userId }),
          // 3. 分析用户偏好
          supabase.rpc("analyze_user_preferences", { p_user_id: userId }),
        ]);

      const recentSummaries = this.mapToSummarySummaries(
        summariesResult.data ?? [],
      );
      const pendingIntents = (pendingResult.data as string[]) ?? [];
      const preferenceAnalysis = preferencesResult.data as
        | PreferenceAnalysis
        | undefined;

      logger.debug(
        {
          userId,
          summaryCount: recentSummaries.length,
          pendingCount: pendingIntents.length,
        },
        "EpisodicMemory: Loaded context",
      );

      return {
        recentSummaries,
        pendingIntents,
        preferenceAnalysis,
      };
    } catch (error) {
      logger.error({ error, userId }, "EpisodicMemory: Error loading context");
      return {
        recentSummaries: [],
        pendingIntents: [],
      };
    }
  }

  /**
   * 标记意图为已完成
   */
  async markIntentCompleted(userId: string, intent: string): Promise<void> {
    try {
      const supabase = await createClient();

      // 从最近的摘要中移除该意图
      await supabase.rpc("remove_pending_intent", {
        p_user_id: userId,
        p_intent: intent,
      });

      logger.debug(
        { userId, intent },
        "EpisodicMemory: Marked intent as completed",
      );
    } catch (error) {
      logger.warn(
        { error, userId, intent },
        "EpisodicMemory: Error marking intent completed",
      );
    }
  }

  /**
   * 清理过期摘要
   */
  async cleanup(userId: string, maxAgeDays: number = 30): Promise<number> {
    try {
      const supabase = await createClient();

      const { count, error } = await supabase
        .from("ai_conversation_summaries")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .lt(
          "created_at",
          new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString(),
        );

      if (error) {
        logger.error({ error, userId }, "EpisodicMemory: Error cleaning up");
        return 0;
      }

      return count ?? 0;
    } catch (error) {
      logger.error({ error, userId }, "EpisodicMemory: Cleanup failed");
      return 0;
    }
  }

  /**
   * 映射数据库记录到 ConversationSummary
   */
  private mapToSummary(row: Record<string, unknown>): ConversationSummary {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      sessionId: row.session_id as string,
      summary: row.summary as string,
      intents: (row.intents as string[]) ?? [],
      actions: (row.actions as ConversationSummary["actions"]) ?? [],
      learnedPreferences:
        (row.learned_preferences as Record<string, unknown>) ?? {},
      pendingIntents: (row.pending_intents as string[]) ?? [],
      messageCount: (row.message_count as number) ?? 0,
      sentiment:
        (row.sentiment as ConversationSummary["sentiment"]) ?? "neutral",
      createdAt: new Date(row.created_at as string),
    };
  }

  /**
   * 映射为精简版摘要 (用于 Prompt)
   */
  private mapToSummarySummaries(
    rows: Record<string, unknown>[],
  ): ConversationSummarySummary[] {
    return rows.map((row) => ({
      relativeTime: formatRelativeTime(new Date(row.created_at as string)),
      summary: row.summary as string,
      mainIntents: ((row.intents as string[]) ?? []).slice(0, 3),
      pendingIntents:
        ((row.pending_intents as string[]) ?? []).length > 0
          ? (row.pending_intents as string[])
          : undefined,
    }));
  }
}

/**
 * 默认实例
 */
export const episodicMemory = new EpisodicMemoryService();
```

### 4.4 交互日志记录器

```typescript
// src/lib/ai-agent/memory/interaction-logger.ts

/**
 * 交互日志记录器
 *
 * 异步记录用户与 AI 的交互，用于偏好学习
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { LogInteractionInput, InteractionLog } from "./types";
import { FeatureFlags } from "../config/feature-flags";

/**
 * 交互日志记录器配置
 */
export interface InteractionLoggerConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 批量写入阈值 */
  batchSize: number;
  /** 批量写入间隔 (ms) */
  flushInterval: number;
}

const DEFAULT_CONFIG: InteractionLoggerConfig = {
  enabled: true,
  batchSize: 10,
  flushInterval: 5000,
};

/**
 * 交互日志记录器
 */
export class InteractionLogger {
  private config: InteractionLoggerConfig;
  private buffer: Array<{ userId: string; input: LogInteractionInput }> = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<InteractionLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 记录交互 (异步，不阻塞主流程)
   */
  log(userId: string, input: LogInteractionInput): void {
    if (!this.config.enabled || !FeatureFlags.ENABLE_PREFERENCE_LEARNING) {
      return;
    }

    this.buffer.push({ userId, input });

    // 达到批量阈值时立即写入
    if (this.buffer.length >= this.config.batchSize) {
      void this.flush();
    } else if (!this.flushTimer) {
      // 设置定时写入
      this.flushTimer = setTimeout(() => {
        void this.flush();
      }, this.config.flushInterval);
    }
  }

  /**
   * 记录正面反馈
   */
  logPositive(
    userId: string,
    actionType: LogInteractionInput["actionType"],
    actionTarget?: string,
    context?: Record<string, unknown>,
  ): void {
    this.log(userId, {
      actionType,
      actionTarget,
      userFeedback: "positive",
      context,
    });
  }

  /**
   * 记录负面反馈 (撤销/拒绝)
   */
  logNegative(
    userId: string,
    actionType: LogInteractionInput["actionType"],
    actionTarget?: string,
    aiSuggestion?: Record<string, unknown>,
    context?: Record<string, unknown>,
  ): void {
    this.log(userId, {
      actionType,
      actionTarget,
      userFeedback: "negative",
      aiSuggestion,
      context,
    });
  }

  /**
   * 记录修改后接受
   */
  logModified(
    userId: string,
    actionType: LogInteractionInput["actionType"],
    actionTarget: string,
    aiSuggestion: Record<string, unknown>,
    userChoice: Record<string, unknown>,
    context?: Record<string, unknown>,
  ): void {
    this.log(userId, {
      actionType,
      actionTarget,
      userFeedback: "modified",
      aiSuggestion,
      userChoice,
      context,
    });
  }

  /**
   * 批量写入数据库
   */
  private async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const toWrite = [...this.buffer];
    this.buffer = [];

    try {
      const supabase = await createClient();

      const rows = toWrite.map(({ userId, input }) => ({
        user_id: userId,
        session_id: input.sessionId,
        action_type: input.actionType,
        action_target: input.actionTarget,
        user_feedback: input.userFeedback,
        ai_suggestion: input.aiSuggestion,
        user_choice: input.userChoice,
        context: input.context ?? {},
      }));

      const { error } = await supabase.from("ai_interaction_logs").insert(rows);

      if (error) {
        logger.error(
          { error, count: rows.length },
          "InteractionLogger: Failed to flush logs",
        );
        // 失败时放回 buffer (可选：限制重试次数)
        // this.buffer.unshift(...toWrite);
      } else {
        logger.debug(
          { count: rows.length },
          "InteractionLogger: Flushed interaction logs",
        );
      }
    } catch (error) {
      logger.error({ error }, "InteractionLogger: Error during flush");
    }
  }

  /**
   * 强制刷新 (用于会话结束)
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }
}

/**
 * 默认实例
 */
export const interactionLogger = new InteractionLogger();
```

### 4.5 记忆 Prompt 构建器

```typescript
// src/lib/ai-agent/memory/memory-prompt-builder.ts

/**
 * 记忆 Prompt 构建器
 *
 * 将情景记忆转换为可注入 System Prompt 的文本
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type {
  EpisodicMemoryContext,
  ConversationSummarySummary,
} from "./types";

/**
 * 构建情景记忆 Prompt 片段
 *
 * @param context 情景记忆上下文
 * @returns Prompt 文本 (约 200-300 token)
 */
export function buildEpisodicMemoryPrompt(
  context: EpisodicMemoryContext,
): string {
  const lines: string[] = [];

  // 标题
  lines.push("## 历史上下文");
  lines.push("");

  // 最近会话摘要
  if (context.recentSummaries.length > 0) {
    lines.push("### 近期对话");
    for (const summary of context.recentSummaries) {
      lines.push(formatSummaryLine(summary));
    }
    lines.push("");
  }

  // 未完成意图
  if (context.pendingIntents.length > 0) {
    lines.push("### 未完成事项");
    lines.push(
      `用户之前提到想：${context.pendingIntents.join("、")}（可主动询问是否继续）`,
    );
    lines.push("");
  }

  // 偏好分析
  if (
    context.preferenceAnalysis &&
    context.preferenceAnalysis.totalInteractions > 10
  ) {
    const analysis = context.preferenceAnalysis;
    lines.push("### 用户偏好");
    if (analysis.commonActions.length > 0) {
      lines.push(`常用操作：${analysis.commonActions.join("、")}`);
    }
    if (analysis.positiveRate > 0.8) {
      lines.push("用户对 AI 建议接受度高，可适当主动");
    } else if (analysis.positiveRate < 0.5) {
      lines.push("用户较少直接采纳建议，应更多询问确认");
    }
    lines.push("");
  }

  // 使用说明
  if (lines.length > 2) {
    lines.push("**注意**：可参考历史上下文提供更连贯的帮助，但不要过度依赖。");
  }

  // 如果没有任何历史信息，返回空字符串
  if (lines.length <= 2) {
    return "";
  }

  return lines.join("\n");
}

/**
 * 格式化单条摘要
 */
function formatSummaryLine(summary: ConversationSummarySummary): string {
  const parts: string[] = [`【${summary.relativeTime}】${summary.summary}`];

  if (summary.pendingIntents && summary.pendingIntents.length > 0) {
    parts.push(`(未完成: ${summary.pendingIntents.join("、")})`);
  }

  return parts.join(" ");
}

/**
 * 构建精简版记忆 Prompt (用于简单查询)
 */
export function buildMinimalMemoryPrompt(
  context: EpisodicMemoryContext,
): string {
  // 仅包含未完成意图，控制在 50 token 内
  if (context.pendingIntents.length > 0) {
    return `历史: 用户曾想${context.pendingIntents[0]}`;
  }
  return "";
}

/**
 * 估算记忆 Prompt 的 Token 数量
 */
export function estimateMemoryTokens(context: EpisodicMemoryContext): number {
  const prompt = buildEpisodicMemoryPrompt(context);
  // 中英混合，约 3 字符/token
  return Math.ceil(prompt.length / 3);
}
```

### 4.6 扩展 DynamicContext

```typescript
// 修改 src/lib/ai-agent/context/types.ts

// 在现有类型基础上添加：

import type { EpisodicMemoryContext } from "../memory/types";

/**
 * 动态上下文 - 每次对话开始时由代码层组装
 */
export interface DynamicContext {
  /** 时间信息 */
  time: TimeContext;
  /** 用户数据概况（带缓存，5分钟刷新） */
  stats: StatsContext;
  /** 用户偏好（从 Profile 读取） */
  preferences: PreferencesContext;
  /** 最近活动 */
  recentActivity: RecentActivityContext;
  /** 当前会话上下文 */
  session: SessionContext;

  // ===== 新增 =====
  /** 情景记忆 (跨会话历史) */
  episodic?: EpisodicMemoryContext;
}
```

### 4.7 Feature Flags 扩展

```typescript
// 添加到 src/lib/ai-agent/config/feature-flags.ts

// ===========================================================================
// 上下文记忆相关开关
// ===========================================================================

/**
 * 是否启用情景记忆
 * @default true
 * @description 跨会话记忆，记住用户历史对话
 */
get ENABLE_EPISODIC_MEMORY(): boolean {
  return process.env.ENABLE_EPISODIC_MEMORY !== 'false';
},

/**
 * 是否启用交互日志
 * @default true
 * @description 记录用户反馈，用于偏好学习
 */
get ENABLE_INTERACTION_LOGGING(): boolean {
  return process.env.ENABLE_INTERACTION_LOGGING !== 'false';
},

/**
 * 是否启用未完成意图提醒
 * @default true
 * @description 主动提醒用户之前未完成的操作
 */
get ENABLE_PENDING_INTENT_REMINDER(): boolean {
  return process.env.ENABLE_PENDING_INTENT_REMINDER !== 'false';
},

/**
 * 情景记忆最大加载数量
 * @default 3
 */
get EPISODIC_MEMORY_MAX_SUMMARIES(): number {
  return parseInt(process.env.EPISODIC_MEMORY_MAX_SUMMARIES || '3', 10);
},
```

---

## 五、Prompt 集成

### 5.1 更新 prompt-injector.ts

```typescript
// 修改 src/lib/ai-agent/context/prompt-injector.ts

import {
  buildEpisodicMemoryPrompt,
  estimateMemoryTokens,
} from "../memory/memory-prompt-builder";
import { FeatureFlags } from "../config/feature-flags";

/**
 * 合并基础 Prompt 和动态上下文
 */
export function mergeSystemPrompt(
  basePrompt: string,
  ctx: DynamicContext,
  options: MergePromptOptions = {},
): string {
  const {
    minimal = false,
    enableReminders = FeatureFlags.ENABLE_SYSTEM_REMINDER,
    enableEpisodicMemory = FeatureFlags.ENABLE_EPISODIC_MEMORY,
    enableProactive = true,
    maxReminders = 2,
  } = options;

  // 1. 构建动态上下文
  const contextPrompt = minimal
    ? buildMinimalContextPrompt(ctx)
    : buildContextPrompt(ctx);

  let result = `${basePrompt}\n\n${contextPrompt}`;

  // 2. 注入情景记忆（新增）
  if (enableEpisodicMemory && ctx.episodic) {
    const memoryPrompt = buildEpisodicMemoryPrompt(ctx.episodic);
    if (memoryPrompt) {
      result = `${result}\n\n${memoryPrompt}`;
    }
  }

  // 3. 注入 System-Reminder
  if (enableReminders && shouldInjectReminders(ctx)) {
    result = injectSystemReminders(result, ctx, {
      maxReminders,
      enableProactive,
    });
  }

  return result;
}
```

### 5.2 扩展 System-Reminder 触发器

```typescript
// 添加到 src/lib/ai-agent/context/system-reminder-injector.ts

// 在 REMINDER_TRIGGERS 数组中添加：

{
  id: 'pending-intent-reminder',
  condition: (ctx) =>
    ctx.episodic?.pendingIntents && ctx.episodic.pendingIntents.length > 0,
  reminder: `用户之前提到想 ${'{pendingIntent}'}，可主动询问是否继续`,
  priority: 88,
  isProactive: true,
},
{
  id: 'low-acceptance-rate',
  condition: (ctx) =>
    ctx.episodic?.preferenceAnalysis &&
    ctx.episodic.preferenceAnalysis.positiveRate < 0.5 &&
    ctx.episodic.preferenceAnalysis.totalInteractions > 10,
  reminder: '用户较少直接采纳建议，执行操作前应多确认',
  priority: 75,
  isProactive: false,
},

// 更新 formatReminder 函数
function formatReminder(reminder: string, context: DynamicContext): string {
  return reminder
    .replace('{topPlatform}', context.stats.topPlatform.name)
    .replace(
      '{selectedCount}',
      String(context.session.selectedBookmarkIds?.length ?? 0)
    )
    // 新增：未完成意图占位符
    .replace(
      '{pendingIntent}',
      context.episodic?.pendingIntents?.[0] ?? ''
    );
}
```

---

## 六、会话结束处理

### 6.1 会话摘要生成

```typescript
// src/lib/ai-agent/memory/summary-generator.ts

/**
 * 会话摘要生成器
 *
 * 在会话结束时生成摘要，存储到情景记忆
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { AgentMessage } from "../core/types";
import type { CreateSummaryInput, ActionRecord } from "./types";

/**
 * 从会话消息生成摘要
 *
 * 使用规则生成（简单场景）或 LLM 生成（复杂场景）
 */
export function generateSummaryFromMessages(
  messages: AgentMessage[],
  sessionId: string,
): CreateSummaryInput {
  // 过滤出用户消息和助手消息
  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  // 提取意图关键词
  const intents = extractIntents(userMessages);

  // 提取执行的操作
  const actions = extractActions(assistantMessages);

  // 提取未完成意图
  const pendingIntents = extractPendingIntents(userMessages, actions);

  // 生成摘要文本
  const summary = generateSummaryText(userMessages, actions);

  // 判断情感基调
  const sentiment = analyzeSentiment(userMessages);

  return {
    sessionId,
    summary,
    intents,
    actions,
    pendingIntents,
    messageCount: messages.length,
    sentiment,
  };
}

/**
 * 提取意图关键词
 */
function extractIntents(userMessages: AgentMessage[]): string[] {
  const intentKeywords = new Set<string>();

  const patterns: Array<{ pattern: RegExp; intent: string }> = [
    { pattern: /整理|分类|归档/, intent: "整理收藏" },
    { pattern: /搜索|找|查/, intent: "搜索内容" },
    { pattern: /导出|备份/, intent: "导出数据" },
    { pattern: /删除|清理|移除/, intent: "删除内容" },
    { pattern: /标签|打标/, intent: "标签管理" },
    { pattern: /统计|分析|报告/, intent: "数据分析" },
  ];

  for (const msg of userMessages) {
    for (const { pattern, intent } of patterns) {
      if (pattern.test(msg.content)) {
        intentKeywords.add(intent);
      }
    }
  }

  return Array.from(intentKeywords);
}

/**
 * 提取执行的操作
 */
function extractActions(assistantMessages: AgentMessage[]): ActionRecord[] {
  const actions: ActionRecord[] = [];

  for (const msg of assistantMessages) {
    if (msg.toolCalls) {
      for (const call of msg.toolCalls) {
        const action = mapToolCallToAction(call);
        if (action) {
          actions.push(action);
        }
      }
    }
  }

  return actions;
}

/**
 * 将工具调用映射为操作记录
 */
function mapToolCallToAction(toolCall: {
  name: string;
  arguments?: Record<string, unknown>;
}): ActionRecord | null {
  const toolTypeMap: Record<string, ActionRecord["type"]> = {
    search_bookmarks: "search",
    batch_tags: "tag",
    move_bookmarks: "move",
    export_bookmarks: "export",
    delete_bookmark: "delete",
    list_by_folder: "search",
    list_by_platform: "search",
  };

  const type = toolTypeMap[toolCall.name];
  if (!type) return null;

  return {
    type,
    target: extractTargetFromArgs(toolCall.arguments),
    outcome: "success", // 默认成功，可通过后续逻辑更新
  };
}

/**
 * 从参数提取操作目标描述
 */
function extractTargetFromArgs(args?: Record<string, unknown>): string {
  if (!args) return "收藏内容";

  if (args.query) return String(args.query);
  if (args.platform) return `${args.platform}平台`;
  if (args.folder_id) return "指定文件夹";
  if (args.tags) return `标签: ${(args.tags as string[]).join(", ")}`;

  return "收藏内容";
}

/**
 * 提取未完成意图
 */
function extractPendingIntents(
  userMessages: AgentMessage[],
  completedActions: ActionRecord[],
): string[] {
  const pending: string[] = [];

  // 检测用户提到但未执行的操作
  const pendingPatterns: Array<{
    pattern: RegExp;
    intent: string;
    actionType: ActionRecord["type"];
  }> = [
    {
      pattern: /想|打算|准备|以后/.test("") ? /想导出|想备份/ : /想导出|想备份/,
      intent: "导出收藏",
      actionType: "export",
    },
    { pattern: /想整理|想分类/, intent: "整理收藏", actionType: "organize" },
  ];

  for (const msg of userMessages) {
    for (const { pattern, intent, actionType } of pendingPatterns) {
      if (pattern.test(msg.content)) {
        const hasCompleted = completedActions.some(
          (a) => a.type === actionType,
        );
        if (!hasCompleted) {
          pending.push(intent);
        }
      }
    }
  }

  return [...new Set(pending)];
}

/**
 * 生成摘要文本
 */
function generateSummaryText(
  userMessages: AgentMessage[],
  actions: ActionRecord[],
): string {
  if (userMessages.length === 0) {
    return "空会话";
  }

  const parts: string[] = [];

  // 添加用户主要请求
  const firstRequest = userMessages[0]?.content.slice(0, 50);
  if (firstRequest) {
    parts.push(
      `用户请求: ${firstRequest}${userMessages[0].content.length > 50 ? "..." : ""}`,
    );
  }

  // 添加执行的操作
  if (actions.length > 0) {
    const actionSummary = actions
      .slice(0, 3)
      .map((a) => `${a.type}(${a.target})`)
      .join(", ");
    parts.push(`执行: ${actionSummary}`);
  }

  return parts.join("; ") || "一般对话";
}

/**
 * 分析会话情感基调
 */
function analyzeSentiment(
  userMessages: AgentMessage[],
): CreateSummaryInput["sentiment"] {
  const text = userMessages.map((m) => m.content).join(" ");

  if (/谢谢|感谢|棒|好的|不错/.test(text)) return "positive";
  if (/不对|错了|不是|重新|撤销/.test(text)) return "negative";
  if (/为什么|怎么回事|不行|没用/.test(text)) return "frustrated";

  return "neutral";
}
```

### 6.2 集成到 AgentMemory

```typescript
// 修改 src/lib/ai-agent/core/agent-memory.ts

import { episodicMemory } from '../memory/episodic-memory';
import { interactionLogger } from '../memory/interaction-logger';
import { generateSummaryFromMessages } from '../memory/summary-generator';
import { FeatureFlags } from '../config/feature-flags';

// 在 AgentMemory 类中添加方法：

/**
 * 结束会话并生成摘要
 */
async endConversation(conversationId: string): Promise<void> {
  const cached = this.cache.get(conversationId);
  if (!cached) {
    return;
  }

  // 1. 强制刷新交互日志
  await interactionLogger.forceFlush();

  // 2. 生成并保存会话摘要
  if (FeatureFlags.ENABLE_EPISODIC_MEMORY && cached.messages.length > 2) {
    const summaryInput = generateSummaryFromMessages(
      cached.messages,
      conversationId
    );

    await episodicMemory.saveSummary(cached.userId, summaryInput);
  }

  // 3. 清理会话
  this.cache.delete(conversationId);

  logger.info(
    { conversationId, userId: cached.userId },
    'AgentMemory: Conversation ended and summarized'
  );
}
```

---

## 七、测试用例

### 7.1 情景记忆测试

```typescript
// src/lib/ai-agent/memory/__tests__/episodic-memory.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EpisodicMemoryService } from "../episodic-memory";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: {
                  id: "test-id",
                  user_id: "user-1",
                  session_id: "session-1",
                  summary: "Test summary",
                  intents: ["搜索"],
                  actions: [],
                  pending_intents: [],
                  message_count: 5,
                  sentiment: "neutral",
                  created_at: new Date().toISOString(),
                },
                error: null,
              }),
            ),
          })),
        })),
      })),
      rpc: vi.fn((name) => {
        if (name === "get_recent_summaries") {
          return Promise.resolve({
            data: [
              {
                id: "sum-1",
                session_id: "sess-1",
                summary: "用户搜索了React文章",
                intents: ["搜索"],
                actions: [],
                pending_intents: ["导出"],
                created_at: new Date(Date.now() - 86400000).toISOString(),
              },
            ],
            error: null,
          });
        }
        if (name === "get_pending_intents") {
          return Promise.resolve({ data: ["导出收藏"], error: null });
        }
        if (name === "analyze_user_preferences") {
          return Promise.resolve({
            data: {
              positiveRate: 0.8,
              commonActions: ["search"],
              totalInteractions: 15,
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    }),
  ),
}));

describe("EpisodicMemoryService", () => {
  let service: EpisodicMemoryService;

  beforeEach(() => {
    service = new EpisodicMemoryService();
  });

  describe("saveSummary", () => {
    it("should save conversation summary", async () => {
      const result = await service.saveSummary("user-1", {
        sessionId: "session-1",
        summary: "Test summary",
        intents: ["搜索"],
        messageCount: 5,
      });

      expect(result).not.toBeNull();
      expect(result?.summary).toBe("Test summary");
    });
  });

  describe("loadContext", () => {
    it("should load episodic memory context", async () => {
      const context = await service.loadContext("user-1");

      expect(context.recentSummaries).toHaveLength(1);
      expect(context.pendingIntents).toContain("导出收藏");
      expect(context.preferenceAnalysis?.positiveRate).toBe(0.8);
    });
  });
});
```

### 7.2 Prompt 构建测试

```typescript
// src/lib/ai-agent/memory/__tests__/memory-prompt-builder.test.ts

import { describe, it, expect } from "vitest";
import {
  buildEpisodicMemoryPrompt,
  estimateMemoryTokens,
} from "../memory-prompt-builder";
import type { EpisodicMemoryContext } from "../types";

describe("buildEpisodicMemoryPrompt", () => {
  it("should build prompt with recent summaries", () => {
    const context: EpisodicMemoryContext = {
      recentSummaries: [
        {
          relativeTime: "昨天",
          summary: "用户整理了B站视频收藏",
          mainIntents: ["整理"],
        },
      ],
      pendingIntents: [],
    };

    const prompt = buildEpisodicMemoryPrompt(context);

    expect(prompt).toContain("## 历史上下文");
    expect(prompt).toContain("昨天");
    expect(prompt).toContain("整理了B站视频");
  });

  it("should include pending intents", () => {
    const context: EpisodicMemoryContext = {
      recentSummaries: [],
      pendingIntents: ["导出前端收藏", "整理微信文章"],
    };

    const prompt = buildEpisodicMemoryPrompt(context);

    expect(prompt).toContain("未完成事项");
    expect(prompt).toContain("导出前端收藏");
    expect(prompt).toContain("整理微信文章");
  });

  it("should return empty string when no history", () => {
    const context: EpisodicMemoryContext = {
      recentSummaries: [],
      pendingIntents: [],
    };

    const prompt = buildEpisodicMemoryPrompt(context);

    expect(prompt).toBe("");
  });

  it("should estimate tokens correctly", () => {
    const context: EpisodicMemoryContext = {
      recentSummaries: [
        {
          relativeTime: "3天前",
          summary: "用户搜索了React相关文章，执行了标签操作",
          mainIntents: ["搜索", "标签"],
          pendingIntents: ["导出"],
        },
      ],
      pendingIntents: ["导出"],
      preferenceAnalysis: {
        positiveRate: 0.85,
        commonActions: ["search", "tag"],
        totalInteractions: 20,
      },
    };

    const tokens = estimateMemoryTokens(context);

    // 应控制在 200-300 token
    expect(tokens).toBeGreaterThan(50);
    expect(tokens).toBeLessThan(400);
  });
});
```

---

## 八、实施计划

### 8.1 Phase 1: 基础设施 (Day 1-2)

| 步骤 | 任务                              | 预计时间 |
| ---- | --------------------------------- | -------- |
| 1.1  | 创建数据库迁移文件                | 1h       |
| 1.2  | 执行迁移并验证表结构              | 30min    |
| 1.3  | 创建 `memory/types.ts`            | 30min    |
| 1.4  | 创建 `memory/utils.ts` (工具函数) | 30min    |

### 8.2 Phase 2: 核心服务 (Day 2-3)

| 步骤 | 任务                            | 预计时间 |
| ---- | ------------------------------- | -------- |
| 2.1  | 实现 `EpisodicMemoryService`    | 2h       |
| 2.2  | 实现 `InteractionLogger`        | 1.5h     |
| 2.3  | 实现 `memory-prompt-builder.ts` | 1h       |
| 2.4  | 实现 `summary-generator.ts`     | 1.5h     |
| 2.5  | 创建 `memory/index.ts` 导出     | 15min    |

### 8.3 Phase 3: 集成 (Day 3-4)

| 步骤 | 任务                                | 预计时间 |
| ---- | ----------------------------------- | -------- |
| 3.1  | 扩展 `DynamicContext` 类型          | 30min    |
| 3.2  | 更新 `feature-flags.ts`             | 30min    |
| 3.3  | 修改 `prompt-injector.ts`           | 1h       |
| 3.4  | 扩展 `system-reminder-injector.ts`  | 45min    |
| 3.5  | 修改 `AgentMemory` 添加会话结束钩子 | 1h       |
| 3.6  | 在 API 层集成情景记忆加载           | 1h       |

### 8.4 Phase 4: 测试 (Day 4-5)

| 步骤 | 任务         | 预计时间 |
| ---- | ------------ | -------- |
| 4.1  | 编写单元测试 | 2h       |
| 4.2  | 运行测试套件 | 30min    |
| 4.3  | 手动场景测试 | 1h       |
| 4.4  | 修复问题     | 1h       |

**总预计时间**: 约 4-5 个工作日

---

## 九、验收标准

### 9.1 功能验收

| 场景               | 预期行为                | 状态 |
| ------------------ | ----------------------- | ---- |
| 新会话开始         | 加载最近 3 次会话摘要   | ⬜   |
| 会话正常结束       | 自动生成并保存摘要      | ⬜   |
| 用户提到未完成操作 | 下次对话主动提醒        | ⬜   |
| 用户撤销 AI 建议   | 记录负面反馈            | ⬜   |
| 历史摘要显示       | Prompt 中包含历史上下文 | ⬜   |

### 9.2 性能验收

| 指标              | 目标               | 状态 |
| ----------------- | ------------------ | ---- |
| 情景记忆加载时间  | < 200ms            | ⬜   |
| 记忆 Prompt Token | < 300              | ⬜   |
| 交互日志写入延迟  | 异步，不阻塞主流程 | ⬜   |
| 测试通过率        | 100%               | ⬜   |

### 9.3 回滚方案

```bash
# 通过环境变量禁用
ENABLE_EPISODIC_MEMORY=false
ENABLE_INTERACTION_LOGGING=false
ENABLE_PENDING_INTENT_REMINDER=false
```

---

## 十、后续规划 (P2)

### 10.1 语义记忆 (未来版本)

- 用户知识图谱构建
- 收藏内容 Embedding 聚类
- 主题关联分析

### 10.2 高级功能

- LLM 生成会话摘要 (替代规则生成)
- 情感分析优化
- 跨设备记忆同步

---

**文档结束**

_此方案由 Winston (Architect Agent) 生成，待 Xiafe 审核。_
