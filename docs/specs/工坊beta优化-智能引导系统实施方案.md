# 工坊 Beta 智能引导系统 - 详细实施方案

> **版本**: v1.0
> **日期**: 2026-01-06
> **状态**: 待审核
> **目标**: 降低使用门槛，让用户"不用想就能用"

---

## 一、方案概览

### 1.1 核心功能模块

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        智能引导系统架构                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  场景快速入口    │ →  │  智能蓝图推荐    │ →  │  素材智能推荐    │         │
│  │ ScenarioEntry   │    │ BlueprintReco.   │    │ MaterialReco.  │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                     │                      │                   │
│           ▼                     ▼                      ▼                   │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    素材组合评分面板                          │           │
│  │                 MaterialCombinationScore                    │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 功能清单

| 功能模块     | 前端组件      | 后端 API    | 数据库      | 工作量 |
| ------------ | ------------- | ----------- | ----------- | ------ |
| 场景快速入口 | ✅ 1 个新组件 | ❌ 无需     | ❌ 无需     | 小     |
| 智能蓝图推荐 | ✅ 1 个新组件 | ✅ 1 个 API | ✅ 1 张新表 | 中     |
| 素材智能推荐 | ✅ 2 个新组件 | ✅ 1 个 API | ❌ 复用现有 | 中     |
| 素材组合评分 | ✅ 1 个新组件 | ✅ 扩展现有 | ❌ 无需     | 小     |

### 1.3 页面流程变化

**现有流程**：

```
选择蓝图 → 选择素材 → 生成
   ↓           ↓
(手动浏览)  (手动挑选)
```

**优化后流程**：

```
             ┌─ 场景快速入口 ─┐
             │ "我想写公众号"  │
             └───────┬───────┘
                     ▼
选择蓝图 ────────────────────→ 选择素材 → 生成
   ↓                              ↓
┌──────────────┐           ┌──────────────┐
│ 智能推荐区    │           │ 智能推荐区    │
│ - 历史常用    │           │ - 相关素材    │
│ - 热门蓝图    │           │ - 组合评分    │
│ - 示例预览    │           │ - 优化建议    │
└──────────────┘           └──────────────┘
```

---

## 二、数据库设计

### 2.1 新增表：ks_usage_stats（使用统计）

用于记录用户的蓝图使用行为，支撑智能推荐算法。

```sql
-- supabase/migrations/YYYYMMDD_create_ks_usage_stats.sql

-- ============================================================
-- 1. 创建蓝图使用统计表
-- ============================================================
CREATE TABLE IF NOT EXISTS ks_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blueprint_id TEXT NOT NULL,

  -- 使用统计
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- 成功率统计（用于推荐权重）
  success_count INTEGER DEFAULT 0,  -- 生成成功次数
  cancel_count INTEGER DEFAULT 0,   -- 取消次数

  -- 偏好记录
  preferred_platform_style TEXT,    -- 常用平台风格
  preferred_length_mode TEXT,       -- 常用输出长度

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束：每个用户每个蓝图一条记录
  CONSTRAINT unique_user_blueprint UNIQUE(user_id, blueprint_id)
);

-- 索引优化
CREATE INDEX idx_ks_usage_stats_user ON ks_usage_stats(user_id);
CREATE INDEX idx_ks_usage_stats_blueprint ON ks_usage_stats(blueprint_id);
CREATE INDEX idx_ks_usage_stats_use_count ON ks_usage_stats(use_count DESC);
CREATE INDEX idx_ks_usage_stats_last_used ON ks_usage_stats(last_used_at DESC);

-- RLS 策略
ALTER TABLE ks_usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能查看自己的使用统计"
  ON ks_usage_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的使用统计"
  ON ks_usage_stats FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. 创建全局蓝图热度统计表（聚合数据，用于热门推荐）
-- ============================================================
CREATE TABLE IF NOT EXISTS ks_blueprint_popularity (
  blueprint_id TEXT PRIMARY KEY,

  -- 使用统计
  total_uses INTEGER DEFAULT 0,
  weekly_uses INTEGER DEFAULT 0,
  daily_uses INTEGER DEFAULT 0,

  -- 质量统计
  avg_rating DECIMAL(3,2) DEFAULT 0,  -- 平均评分
  rating_count INTEGER DEFAULT 0,

  -- 时间戳
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_ks_blueprint_popularity_weekly ON ks_blueprint_popularity(weekly_uses DESC);

-- ============================================================
-- 3. 更新统计的 RPC 函数
-- ============================================================
CREATE OR REPLACE FUNCTION record_blueprint_usage(
  p_user_id UUID,
  p_blueprint_id TEXT,
  p_success BOOLEAN DEFAULT true,
  p_platform_style TEXT DEFAULT NULL,
  p_length_mode TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- 更新用户个人统计
  INSERT INTO ks_usage_stats (
    user_id,
    blueprint_id,
    use_count,
    last_used_at,
    success_count,
    preferred_platform_style,
    preferred_length_mode
  )
  VALUES (
    p_user_id,
    p_blueprint_id,
    1,
    NOW(),
    CASE WHEN p_success THEN 1 ELSE 0 END,
    p_platform_style,
    p_length_mode
  )
  ON CONFLICT (user_id, blueprint_id)
  DO UPDATE SET
    use_count = ks_usage_stats.use_count + 1,
    last_used_at = NOW(),
    success_count = ks_usage_stats.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    preferred_platform_style = COALESCE(p_platform_style, ks_usage_stats.preferred_platform_style),
    preferred_length_mode = COALESCE(p_length_mode, ks_usage_stats.preferred_length_mode),
    updated_at = NOW();

  -- 更新全局热度统计
  INSERT INTO ks_blueprint_popularity (blueprint_id, total_uses, weekly_uses, daily_uses, updated_at)
  VALUES (p_blueprint_id, 1, 1, 1, NOW())
  ON CONFLICT (blueprint_id)
  DO UPDATE SET
    total_uses = ks_blueprint_popularity.total_uses + 1,
    weekly_uses = ks_blueprint_popularity.weekly_uses + 1,
    daily_uses = ks_blueprint_popularity.daily_uses + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. 定时重置周/日统计的函数（由 cron job 调用）
-- ============================================================
CREATE OR REPLACE FUNCTION reset_blueprint_daily_stats()
RETURNS VOID AS $$
BEGIN
  UPDATE ks_blueprint_popularity SET daily_uses = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_blueprint_weekly_stats()
RETURNS VOID AS $$
BEGIN
  UPDATE ks_blueprint_popularity SET weekly_uses = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.2 扩展 synthesis_reports 表

在 `generation_metadata` 中记录更多信息（已有 JSONB 字段，无需迁移）：

```typescript
// 扩展 generation_metadata 结构
interface GenerationMetadata {
  // 现有字段
  blueprint_version: string;
  blueprint_id: string;
  source_bookmark_ids: string[];
  has_briefing: boolean;
  has_outline: boolean;
  target_length: string;

  // 新增字段（P1 修复）
  platform_style?: string;

  // 新增字段（智能引导）
  recommendation_source?: "history" | "popular" | "scenario" | "manual"; // 蓝图选择来源
  material_recommendation_used?: boolean; // 是否使用了素材推荐
  material_combination_score?: number; // 素材组合评分
}
```

---

## 三、后端 API 设计

### 3.1 蓝图推荐 API

**路由**: `GET /api/knowledge-studio/v2/recommendations/blueprints`

**功能**: 返回个性化蓝图推荐列表

```typescript
// src/app/api/knowledge-studio/v2/recommendations/blueprints/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { getBlueprintRegistry } from "@/lib/knowledge-studio/blueprint/blueprint-registry";

const logger = createLogger("api:ks:recommendations:blueprints");

interface BlueprintRecommendation {
  blueprintId: string;
  score: number;
  reason: "history" | "popular" | "new";
  reasonText: string;
  metadata: {
    useCount?: number;
    lastUsedAt?: string;
    weeklyUses?: number;
  };
}

interface RecommendationsResponse {
  history: BlueprintRecommendation[]; // 历史常用（最多 3 个）
  popular: BlueprintRecommendation[]; // 热门推荐（最多 3 个）
  newBlueprints: BlueprintRecommendation[]; // 新蓝图（最多 2 个）
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const registry = getBlueprintRegistry();
    const allBlueprints = registry.getAll();

    // 1. 获取用户历史使用统计
    const { data: userStats } = await supabase
      .from("ks_usage_stats")
      .select("blueprint_id, use_count, last_used_at, success_count")
      .eq("user_id", user.id)
      .order("use_count", { ascending: false })
      .limit(10);

    // 2. 获取全局热度统计
    const { data: popularity } = await supabase
      .from("ks_blueprint_popularity")
      .select("blueprint_id, weekly_uses, total_uses")
      .order("weekly_uses", { ascending: false })
      .limit(10);

    // 3. 构建历史推荐
    const history: BlueprintRecommendation[] = (userStats || [])
      .slice(0, 3)
      .map((stat) => ({
        blueprintId: stat.blueprint_id,
        score:
          stat.use_count * 10 +
          (stat.success_count / Math.max(stat.use_count, 1)) * 20,
        reason: "history" as const,
        reasonText: `你已使用 ${stat.use_count} 次`,
        metadata: {
          useCount: stat.use_count,
          lastUsedAt: stat.last_used_at,
        },
      }));

    // 4. 构建热门推荐（排除用户已常用的）
    const historyIds = new Set(history.map((h) => h.blueprintId));
    const popular: BlueprintRecommendation[] = (popularity || [])
      .filter((p) => !historyIds.has(p.blueprint_id))
      .slice(0, 3)
      .map((p) => ({
        blueprintId: p.blueprint_id,
        score: p.weekly_uses,
        reason: "popular" as const,
        reasonText: `本周 ${p.weekly_uses} 人使用`,
        metadata: {
          weeklyUses: p.weekly_uses,
        },
      }));

    // 5. 新蓝图推荐（isNew 标记的蓝图）
    const newBlueprints: BlueprintRecommendation[] = allBlueprints
      .filter((bp) => bp.getMetadata().isNew)
      .slice(0, 2)
      .map((bp) => ({
        blueprintId: bp.getMetadata().blueprintId,
        score: 100,
        reason: "new" as const,
        reasonText: "新上线",
        metadata: {},
      }));

    return NextResponse.json({
      history,
      popular,
      newBlueprints,
    });
  } catch (error) {
    logger.error({ error }, "Failed to get blueprint recommendations");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### 3.2 素材推荐 API

**路由**: `GET /api/knowledge-studio/v2/recommendations/materials`

**功能**: 基于已选素材，推荐相关素材

```typescript
// src/app/api/knowledge-studio/v2/recommendations/materials/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const logger = createLogger("api:ks:recommendations:materials");

const RequestSchema = z.object({
  selectedBookmarkIds: z.array(z.string()).min(1).max(5),
  limit: z.number().min(1).max(10).default(5),
});

interface MaterialRecommendation {
  bookmarkId: string;
  title: string;
  url: string;
  platform?: string;
  similarity: number; // 0-100
  reason: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { selectedBookmarkIds, limit } = RequestSchema.parse(body);

    // 1. 获取已选书签的 embedding
    const numericIds = selectedBookmarkIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    const { data: selectedBookmarks } = await supabase
      .from("bookmarks")
      .select("id, title, embedding")
      .eq("user_id", user.id)
      .in("id", numericIds);

    if (!selectedBookmarks || selectedBookmarks.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // 2. 计算平均 embedding（作为查询向量）
    const embeddings = selectedBookmarks
      .filter((b) => b.embedding)
      .map((b) => b.embedding);

    if (embeddings.length === 0) {
      // 没有 embedding，返回最近的书签作为备选
      const { data: recentBookmarks } = await supabase
        .from("bookmarks")
        .select("id, title, url, platform")
        .eq("user_id", user.id)
        .not("id", "in", `(${numericIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(limit);

      return NextResponse.json({
        recommendations: (recentBookmarks || []).map((b) => ({
          bookmarkId: String(b.id),
          title: b.title,
          url: b.url,
          platform: b.platform,
          similarity: 50, // 无法计算相似度
          reason: "最近收藏",
        })),
      });
    }

    // 3. 使用 pgvector 查询相似书签
    const { data: similarBookmarks, error } = await supabase.rpc(
      "match_bookmarks_by_embedding",
      {
        query_embedding: averageEmbedding(embeddings),
        match_count: limit + selectedBookmarkIds.length,
        match_threshold: 0.5,
        p_user_id: user.id,
      },
    );

    if (error) {
      logger.error({ error }, "Failed to match bookmarks");
      return NextResponse.json(
        { error: "Failed to find similar materials" },
        { status: 500 },
      );
    }

    // 4. 过滤掉已选的，构建推荐列表
    const recommendations: MaterialRecommendation[] = (similarBookmarks || [])
      .filter((b: any) => !numericIds.includes(b.id))
      .slice(0, limit)
      .map((b: any) => ({
        bookmarkId: String(b.id),
        title: b.title,
        url: b.url,
        platform: b.platform,
        similarity: Math.round(b.similarity * 100),
        reason: `内容相关度 ${Math.round(b.similarity * 100)}%`,
      }));

    return NextResponse.json({ recommendations });
  } catch (error) {
    logger.error({ error }, "Failed to get material recommendations");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// 计算平均 embedding
function averageEmbedding(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  if (embeddings.length === 1) return embeddings[0];

  const length = embeddings[0].length;
  const result = new Array(length).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < length; i++) {
      result[i] += embedding[i];
    }
  }

  return result.map((v) => v / embeddings.length);
}
```

### 3.3 素材组合评分 API

**路由**: `POST /api/knowledge-studio/v2/materials/score`

**功能**: 评估素材组合质量，返回评分和建议

```typescript
// src/app/api/knowledge-studio/v2/materials/score/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { materialScorer } from "@/lib/knowledge-studio/material";
import { z } from "zod";

const logger = createLogger("api:ks:materials:score");

const RequestSchema = z.object({
  bookmarkIds: z.array(z.string()).min(1).max(5),
  blueprintId: z.string().optional(),
});

interface CombinationScore {
  overall: number; // 0-100
  dimensions: {
    relevance: number; // 内容相关度
    coherence: number; // 主题聚焦度
    richness: number; // 信息丰富度
    freshness: number; // 时效性
  };
  qualityLevel: "excellent" | "good" | "fair" | "poor";
  suggestions: string[];
  recommendedAction?: {
    type: "add" | "remove" | "replace";
    message: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bookmarkIds, blueprintId } = RequestSchema.parse(body);

    // 使用现有的 materialScorer 获取基础评分
    const analysisResult = await materialScorer.analyze({
      userId: user.id,
      bookmarkIds,
      targetBlueprintType: blueprintId,
    });

    if (!analysisResult.success || !analysisResult.scores) {
      return NextResponse.json(
        {
          error: analysisResult.error?.message || "Failed to analyze materials",
        },
        { status: 400 },
      );
    }

    const scores = analysisResult.scores;

    // 计算组合维度评分
    const dimensions = {
      relevance: calculateRelevanceScore(scores),
      coherence: calculateCoherenceScore(scores),
      richness: calculateRichnessScore(scores),
      freshness: calculateFreshnessScore(scores),
    };

    // 计算综合评分
    const overall = Math.round(
      dimensions.relevance * 0.3 +
        dimensions.coherence * 0.3 +
        dimensions.richness * 0.25 +
        dimensions.freshness * 0.15,
    );

    // 确定质量等级
    const qualityLevel = getQualityLevel(overall);

    // 生成建议
    const suggestions = generateSuggestions(dimensions, scores.length);

    // 生成推荐行动
    const recommendedAction = generateRecommendedAction(
      dimensions,
      scores.length,
    );

    return NextResponse.json({
      overall,
      dimensions,
      qualityLevel,
      suggestions,
      recommendedAction,
    } satisfies CombinationScore);
  } catch (error) {
    logger.error({ error }, "Failed to score material combination");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function calculateRelevanceScore(scores: any[]): number {
  return Math.round(
    scores.reduce((sum, s) => sum + s.dimensions.relevance, 0) / scores.length,
  );
}

function calculateCoherenceScore(scores: any[]): number {
  // 主题聚焦度：基于素材之间的相似性
  // 如果只有 1-2 个素材，默认较高
  if (scores.length <= 2) return 85;

  // 多个素材时，基于深度分数的方差
  const depths = scores.map((s) => s.dimensions.depth);
  const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
  const variance =
    depths.reduce((sum, d) => sum + Math.pow(d - avgDepth, 2), 0) /
    depths.length;

  // 方差越小，聚焦度越高
  return Math.round(Math.max(50, 100 - variance / 2));
}

function calculateRichnessScore(scores: any[]): number {
  // 信息丰富度：基于素材数量和深度
  const avgDepth =
    scores.reduce((sum, s) => sum + s.dimensions.depth, 0) / scores.length;
  const countBonus = Math.min(scores.length * 10, 30); // 素材越多，加分越高，最高 30
  return Math.round(Math.min(100, avgDepth * 0.7 + countBonus));
}

function calculateFreshnessScore(scores: any[]): number {
  return Math.round(
    scores.reduce((sum, s) => sum + s.dimensions.freshness, 0) / scores.length,
  );
}

function getQualityLevel(
  score: number,
): "excellent" | "good" | "fair" | "poor" {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

function generateSuggestions(dimensions: any, count: number): string[] {
  const suggestions: string[] = [];

  if (dimensions.relevance < 60) {
    suggestions.push("素材之间关联度较低，建议选择主题更接近的内容");
  }

  if (dimensions.coherence < 60) {
    suggestions.push("主题较为分散，建议聚焦于某一核心主题");
  }

  if (dimensions.richness < 60 && count < 3) {
    suggestions.push("建议增加 1-2 篇相关素材，丰富生成内容");
  }

  if (dimensions.freshness < 60) {
    suggestions.push("部分素材较为陈旧，建议查找更新的资料");
  }

  if (suggestions.length === 0) {
    suggestions.push("素材组合质量良好，可以开始生成");
  }

  return suggestions;
}

function generateRecommendedAction(
  dimensions: any,
  count: number,
): { type: string; message: string } | undefined {
  if (dimensions.richness < 50 && count < 3) {
    return {
      type: "add",
      message: "建议增加 1-2 篇相关素材以提升生成效果",
    };
  }

  if (dimensions.coherence < 50 && count > 3) {
    return {
      type: "remove",
      message: "素材主题较分散，建议精简到 2-3 篇核心内容",
    };
  }

  if (dimensions.freshness < 40) {
    return {
      type: "replace",
      message: "建议替换部分陈旧素材为更新的内容",
    };
  }

  return undefined;
}
```

### 3.4 记录使用行为 API

**路由**: `POST /api/knowledge-studio/v2/usage/record`

**功能**: 生成完成后记录使用行为

```typescript
// src/app/api/knowledge-studio/v2/usage/record/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const logger = createLogger("api:ks:usage:record");

const RequestSchema = z.object({
  blueprintId: z.string(),
  success: z.boolean(),
  platformStyle: z.string().optional(),
  lengthMode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { blueprintId, success, platformStyle, lengthMode } =
      RequestSchema.parse(body);

    // 调用 RPC 函数记录使用
    const { error } = await supabase.rpc("record_blueprint_usage", {
      p_user_id: user.id,
      p_blueprint_id: blueprintId,
      p_success: success,
      p_platform_style: platformStyle,
      p_length_mode: lengthMode,
    });

    if (error) {
      logger.error({ error }, "Failed to record usage");
      return NextResponse.json({ error: "Failed to record" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to record usage");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

---

## 四、前端组件设计

### 4.1 场景快速入口组件

```typescript
// src/components/knowledge-studio/v2/scenario-quick-entry.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * 场景配置
 */
const SCENARIOS = [
  {
    id: "wechat_article",
    icon: "📱",
    label: "写公众号文章",
    description: "生成适合微信公众号的图文",
    blueprintIds: ["content-synthesizer", "deep-analysis"],
    defaultPlatformStyle: "wechat",
  },
  {
    id: "xiaohongshu_note",
    icon: "📕",
    label: "写小红书笔记",
    description: "生成种草风格的短内容",
    blueprintIds: ["content-synthesizer"],
    defaultPlatformStyle: "xiaohongshu",
  },
  {
    id: "competitor_analysis",
    icon: "📊",
    label: "做竞品分析",
    description: "生成竞品对比矩阵",
    blueprintIds: ["competitor-scout", "tech-decider"],
    defaultPlatformStyle: "general",
  },
  {
    id: "learning_notes",
    icon: "📝",
    label: "整理学习笔记",
    description: "提炼知识要点",
    blueprintIds: ["tutorial-architect", "arxiv-decoder"],
    defaultPlatformStyle: "general",
  },
  {
    id: "video_script",
    icon: "🎬",
    label: "写视频脚本",
    description: "生成分镜脚本",
    blueprintIds: ["scriptwriter"],
    defaultPlatformStyle: "general",
  },
  {
    id: "research_report",
    icon: "🔍",
    label: "深度研究报告",
    description: "综合分析多篇资料",
    blueprintIds: ["deep-analysis", "literature-matrix"],
    defaultPlatformStyle: "general",
  },
] as const;

export type ScenarioId = (typeof SCENARIOS)[number]["id"];

interface ScenarioQuickEntryProps {
  onSelect: (scenario: {
    id: ScenarioId;
    blueprintIds: readonly string[];
    defaultPlatformStyle: string;
  }) => void;
  className?: string;
}

export function ScenarioQuickEntry({
  onSelect,
  className,
}: ScenarioQuickEntryProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="pt-6">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold">🎯 你想做什么？</h3>
          <p className="text-sm text-muted-foreground mt-1">
            快速选择场景，我们帮你推荐最合适的蓝图
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => onSelect(scenario)}
              className={cn(
                "flex flex-col items-center p-4 rounded-lg border",
                "hover:border-primary hover:bg-accent/50 transition-colors",
                "text-center group"
              )}
            >
              <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                {scenario.icon}
              </span>
              <span className="font-medium text-sm">{scenario.label}</span>
              <span className="text-xs text-muted-foreground mt-1">
                {scenario.description}
              </span>
            </button>
          ))}
        </div>

        <div className="text-center mt-4 pt-4 border-t">
          <button className="text-sm text-muted-foreground hover:text-primary">
            💡 不确定？查看全部蓝图 →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export { SCENARIOS };
```

### 4.2 智能蓝图推荐组件

```typescript
// src/components/knowledge-studio/v2/blueprint-recommendations.tsx

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BlueprintListItem } from "./blueprint-selector";

interface BlueprintRecommendation {
  blueprintId: string;
  score: number;
  reason: "history" | "popular" | "new";
  reasonText: string;
  metadata: {
    useCount?: number;
    lastUsedAt?: string;
    weeklyUses?: number;
  };
}

interface BlueprintRecommendationsProps {
  blueprints: BlueprintListItem[];
  onSelect: (blueprintId: string) => void;
  selectedId?: string;
  className?: string;
}

export function BlueprintRecommendations({
  blueprints,
  onSelect,
  selectedId,
  className,
}: BlueprintRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<{
    history: BlueprintRecommendation[];
    popular: BlueprintRecommendation[];
    newBlueprints: BlueprintRecommendation[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const response = await fetch(
          "/api/knowledge-studio/v2/recommendations/blueprints"
        );
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data);
        }
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecommendations();
  }, []);

  // 根据 blueprintId 获取蓝图信息
  const getBlueprintInfo = (blueprintId: string) =>
    blueprints.find((bp) => bp.blueprintId === blueprintId);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">✨ 为你推荐</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!recommendations) {
    return null;
  }

  const hasRecommendations =
    recommendations.history.length > 0 ||
    recommendations.popular.length > 0 ||
    recommendations.newBlueprints.length > 0;

  if (!hasRecommendations) {
    return null;
  }

  const renderRecommendation = (rec: BlueprintRecommendation) => {
    const blueprint = getBlueprintInfo(rec.blueprintId);
    if (!blueprint) return null;

    return (
      <button
        key={rec.blueprintId}
        onClick={() => onSelect(rec.blueprintId)}
        className={cn(
          "flex items-center gap-3 w-full p-3 rounded-lg border text-left",
          "hover:border-primary hover:bg-accent/50 transition-colors",
          selectedId === rec.blueprintId && "border-primary bg-accent"
        )}
      >
        <span className="text-2xl">{blueprint.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {blueprint.displayName}
            </span>
            {rec.reason === "new" && (
              <Badge variant="secondary" className="text-xs">
                新
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{rec.reasonText}</span>
        </div>
      </button>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">✨ 为你推荐</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 历史常用 */}
        {recommendations.history.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              📌 最近使用
            </h4>
            <div className="space-y-2">
              {recommendations.history.map(renderRecommendation)}
            </div>
          </div>
        )}

        {/* 热门推荐 */}
        {recommendations.popular.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              🔥 热门蓝图
            </h4>
            <div className="space-y-2">
              {recommendations.popular.map(renderRecommendation)}
            </div>
          </div>
        )}

        {/* 新蓝图 */}
        {recommendations.newBlueprints.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              🆕 新上线
            </h4>
            <div className="space-y-2">
              {recommendations.newBlueprints.map(renderRecommendation)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4.3 素材智能推荐组件

```typescript
// src/components/knowledge-studio/v2/material-recommendations.tsx

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MaterialRecommendation {
  bookmarkId: string;
  title: string;
  url: string;
  platform?: string;
  similarity: number;
  reason: string;
}

interface MaterialRecommendationsProps {
  selectedIds: string[];
  onAdd: (bookmarkId: string) => void;
  maxSelection: number;
  className?: string;
}

export function MaterialRecommendations({
  selectedIds,
  onAdd,
  maxSelection,
  className,
}: MaterialRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<
    MaterialRecommendation[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setRecommendations([]);
      return;
    }

    async function fetchRecommendations() {
      setIsLoading(true);
      try {
        const response = await fetch(
          "/api/knowledge-studio/v2/recommendations/materials",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              selectedBookmarkIds: selectedIds,
              limit: 5,
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommendations || []);
        }
      } catch (error) {
        console.error("Failed to fetch material recommendations:", error);
      } finally {
        setIsLoading(false);
      }
    }

    // 防抖：500ms 后请求
    const timer = setTimeout(fetchRecommendations, 500);
    return () => clearTimeout(timer);
  }, [selectedIds]);

  if (selectedIds.length === 0) {
    return null;
  }

  const canAddMore = selectedIds.length < maxSelection;

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          推荐搭配这些素材
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无推荐，继续选择素材试试
          </p>
        ) : (
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div
                key={rec.bookmarkId}
                className="flex items-center gap-3 p-2 rounded-lg border bg-accent/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{rec.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">
                      相关度 {rec.similarity}%
                    </Badge>
                    {rec.platform && (
                      <span className="text-xs text-muted-foreground">
                        {rec.platform}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAdd(rec.bookmarkId)}
                  disabled={
                    !canAddMore || selectedIds.includes(rec.bookmarkId)
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4.4 素材组合评分面板

```typescript
// src/components/knowledge-studio/v2/material-combination-score.tsx

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface CombinationScore {
  overall: number;
  dimensions: {
    relevance: number;
    coherence: number;
    richness: number;
    freshness: number;
  };
  qualityLevel: "excellent" | "good" | "fair" | "poor";
  suggestions: string[];
  recommendedAction?: {
    type: "add" | "remove" | "replace";
    message: string;
  };
}

const QUALITY_CONFIG = {
  excellent: {
    label: "优秀",
    color: "text-green-600",
    bgColor: "bg-green-500",
    icon: CheckCircle2,
  },
  good: {
    label: "良好",
    color: "text-blue-600",
    bgColor: "bg-blue-500",
    icon: CheckCircle2,
  },
  fair: {
    label: "一般",
    color: "text-yellow-600",
    bgColor: "bg-yellow-500",
    icon: Info,
  },
  poor: {
    label: "较差",
    color: "text-red-600",
    bgColor: "bg-red-500",
    icon: AlertCircle,
  },
};

const DIMENSION_LABELS = {
  relevance: "内容相关度",
  coherence: "主题聚焦度",
  richness: "信息丰富度",
  freshness: "时效性",
};

interface MaterialCombinationScoreProps {
  selectedIds: string[];
  blueprintId?: string;
  className?: string;
}

export function MaterialCombinationScore({
  selectedIds,
  blueprintId,
  className,
}: MaterialCombinationScoreProps) {
  const [score, setScore] = useState<CombinationScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedIds.length < 2) {
      setScore(null);
      return;
    }

    async function fetchScore() {
      setIsLoading(true);
      try {
        const response = await fetch(
          "/api/knowledge-studio/v2/materials/score",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookmarkIds: selectedIds,
              blueprintId,
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          setScore(data);
        }
      } catch (error) {
        console.error("Failed to fetch combination score:", error);
      } finally {
        setIsLoading(false);
      }
    }

    // 防抖：800ms 后请求
    const timer = setTimeout(fetchScore, 800);
    return () => clearTimeout(timer);
  }, [selectedIds, blueprintId]);

  if (selectedIds.length < 2) {
    return null;
  }

  if (isLoading || !score) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📊 素材组合分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const config = QUALITY_CONFIG[score.qualityLevel];
  const QualityIcon = config.icon;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">📊 素材组合分析</CardTitle>
          <Badge variant="outline" className={config.color}>
            <QualityIcon className="h-3 w-3 mr-1" />
            {config.label} ({score.overall}分)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 维度评分 */}
        <div className="space-y-2">
          {Object.entries(score.dimensions).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]}
                </span>
                <span className="font-medium">{value}%</span>
              </div>
              <Progress value={value} className="h-1.5" />
            </div>
          ))}
        </div>

        {/* 建议 */}
        {score.suggestions.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-2">💡 优化建议</p>
            <ul className="text-sm space-y-1">
              {score.suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 推荐行动 */}
        {score.recommendedAction && (
          <div
            className={cn(
              "p-3 rounded-lg text-sm",
              score.recommendedAction.type === "add" && "bg-blue-50 text-blue-700",
              score.recommendedAction.type === "remove" && "bg-yellow-50 text-yellow-700",
              score.recommendedAction.type === "replace" && "bg-orange-50 text-orange-700"
            )}
          >
            {score.recommendedAction.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 五、页面集成改造

### 5.1 改造后的页面结构

```typescript
// src/app/(main)/knowledge-studio/v2/knowledge-studio-v2-page-client.tsx
// 主要变更点标注

export function KnowledgeStudioV2PageClient() {
  // ... 现有 state ...

  // 🆕 新增：场景选择状态
  const [showScenarioEntry, setShowScenarioEntry] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId | null>(null);

  // 🆕 新增：处理场景选择
  const handleScenarioSelect = useCallback((scenario: {
    id: ScenarioId;
    blueprintIds: readonly string[];
    defaultPlatformStyle: string;
  }) => {
    setSelectedScenario(scenario.id);
    setShowScenarioEntry(false);

    // 自动选中第一个推荐的蓝图
    if (scenario.blueprintIds.length > 0) {
      const firstBlueprint = blueprints.find(
        bp => scenario.blueprintIds.includes(bp.blueprintId)
      );
      if (firstBlueprint) {
        setSelectedBlueprintId(firstBlueprint.blueprintId);
      }
    }

    // 存储默认平台风格，供后续使用
    sessionStorage.setItem("ks-v2-default-platform-style", scenario.defaultPlatformStyle);
  }, [blueprints]);

  // 🆕 新增：记录使用行为
  const recordUsage = useCallback(async (success: boolean) => {
    if (!selectedBlueprintId) return;

    try {
      await fetch("/api/knowledge-studio/v2/usage/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintId: selectedBlueprintId,
          success,
          platformStyle: sessionStorage.getItem("ks-v2-default-platform-style"),
        }),
      });
    } catch (error) {
      // 静默失败，不影响主流程
    }
  }, [selectedBlueprintId]);

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* 页面标题 */}
      {/* ... 现有代码 ... */}

      {/* 🆕 新增：场景快速入口（仅在第一步显示） */}
      {step === "blueprint" && showScenarioEntry && (
        <ScenarioQuickEntry
          onSelect={handleScenarioSelect}
          className="mb-6"
        />
      )}

      {/* 步骤指示器 */}
      {/* ... 现有代码 ... */}

      {/* 主内容区 - 蓝图选择 */}
      {step === "blueprint" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 🆕 新增：左侧推荐区域 */}
          <div className="lg:col-span-1">
            <BlueprintRecommendations
              blueprints={blueprints}
              onSelect={handleBlueprintSelect}
              selectedId={selectedBlueprintId}
            />
          </div>

          {/* 右侧蓝图网格 */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                {/* ... 现有代码 ... */}
              </CardHeader>
              <CardContent>
                <BlueprintSelectorV2
                  blueprints={blueprints}
                  value={selectedBlueprintId}
                  onChange={handleBlueprintSelect}
                  userTier={userTier}
                  onUpgradeClick={handleUpgrade}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 主内容区 - 素材选择 */}
      {step === "materials" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 🆕 新增：左侧推荐和评分区域 */}
          <div className="lg:col-span-1 space-y-4">
            <MaterialRecommendations
              selectedIds={selectedMaterialIds}
              onAdd={(id) => handleMaterialsChange([...selectedMaterialIds, id])}
              maxSelection={MATERIAL_LIMITS.HARD_MAX}
            />

            <MaterialCombinationScore
              selectedIds={selectedMaterialIds}
              blueprintId={selectedBlueprintId}
            />
          </div>

          {/* 右侧素材列表 */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                {/* ... 现有代码 ... */}
              </CardHeader>
              <CardContent>
                <MaterialSelector
                  materials={materials}
                  selected={selectedMaterialIds}
                  onChange={handleMaterialsChange}
                  maxSelection={MATERIAL_LIMITS.HARD_MAX}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {/* ... 现有代码 ... */}
    </div>
  );
}
```

---

## 六、文件清单

### 6.1 新建文件

| 文件路径                                                              | 类型   | 说明       |
| --------------------------------------------------------------------- | ------ | ---------- |
| `supabase/migrations/YYYYMMDD_create_ks_usage_stats.sql`              | 数据库 | 使用统计表 |
| `src/app/api/knowledge-studio/v2/recommendations/blueprints/route.ts` | API    | 蓝图推荐   |
| `src/app/api/knowledge-studio/v2/recommendations/materials/route.ts`  | API    | 素材推荐   |
| `src/app/api/knowledge-studio/v2/materials/score/route.ts`            | API    | 素材评分   |
| `src/app/api/knowledge-studio/v2/usage/record/route.ts`               | API    | 记录使用   |
| `src/components/knowledge-studio/v2/scenario-quick-entry.tsx`         | 组件   | 场景入口   |
| `src/components/knowledge-studio/v2/blueprint-recommendations.tsx`    | 组件   | 蓝图推荐   |
| `src/components/knowledge-studio/v2/material-recommendations.tsx`     | 组件   | 素材推荐   |
| `src/components/knowledge-studio/v2/material-combination-score.tsx`   | 组件   | 素材评分   |

### 6.2 修改文件

| 文件路径                                                                 | 变更内容               |
| ------------------------------------------------------------------------ | ---------------------- |
| `src/app/(main)/knowledge-studio/v2/knowledge-studio-v2-page-client.tsx` | 集成新组件，调整布局   |
| `src/components/knowledge-studio/v2/index.ts`                            | 导出新组件             |
| `src/app/api/knowledge-studio/v2/generate/route.ts`                      | 生成完成后调用记录 API |

---

## 七、实施计划

```
Week 1: 基础设施
├── Day 1-2: 数据库迁移 + RPC 函数
├── Day 3: 蓝图推荐 API + 组件
└── Day 4-5: 场景快速入口组件 + 集成

Week 2: 素材智能化
├── Day 1-2: 素材推荐 API + 组件
├── Day 3: 素材组合评分 API + 组件
├── Day 4: 页面布局调整 + 集成
└── Day 5: 测试 + 修复

Week 3: 优化迭代
├── Day 1-2: 用户反馈收集
├── Day 3-4: 算法优化
└── Day 5: 性能优化
```

---

## 八、预期效果

| 指标                     | 当前估计 | 优化后目标 | 提升 |
| ------------------------ | -------- | ---------- | ---- |
| 蓝图选择时间             | ~30 秒   | ~10 秒     | -67% |
| 素材选择时间             | ~60 秒   | ~25 秒     | -58% |
| 新用户完成首次生成率     | ~60%     | ~85%       | +42% |
| 素材组合质量（评分 ≥70） | ~50%     | ~80%       | +60% |

---

## 九、审核确认

请确认以下内容：

- [ ] **数据库设计**：使用统计表结构是否合理？
- [ ] **API 设计**：4 个新 API 的功能和接口是否合理？
- [ ] **组件设计**：4 个新组件的交互是否符合预期？
- [ ] **页面布局**：左侧推荐区 + 右侧主内容区的布局是否接受？
- [ ] **实施计划**：2-3 周的实施周期是否可接受？

---

**审核通过后，BMad Master 将按计划开始实施。**
