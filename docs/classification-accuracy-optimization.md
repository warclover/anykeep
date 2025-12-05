# 智能分类准确性优化方案

**版本**: 1.0
**日期**: 2025-12-05
**聚焦问题**: 书签智能分类到文件夹不准确

---

## 一、问题诊断

### 1.1 当前实现分析

通过代码审查，发现当前分类推荐有两条路径：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        当前分类推荐流程                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  书签信息 (title, summary, tags)                                        │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    recommendFolder()                             │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │  DeepSeek API 调用                                         │  │   │
│  │  │  输入: 标题 + 摘要 + 标签 + 文件夹名称列表                  │  │   │
│  │  │  输出: 推荐的文件夹ID + 置信度                              │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  │                          │                                      │   │
│  │                    API 失败时                                   │   │
│  │                          ▼                                      │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │  generateFallbackFolderRecommendation()                    │  │   │
│  │  │  • 标签字面匹配 (80分)                                     │  │   │
│  │  │  • 标题关键词匹配 (15分)                                   │  │   │
│  │  │  • 硬编码语义映射 (25分)                                   │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心问题

| 问题                    | 严重程度   | 说明                                      |
| ----------------------- | ---------- | ----------------------------------------- |
| **AI 缺乏文件夹上下文** | ⭐⭐⭐⭐⭐ | AI 只看到文件夹名称，不知道里面有什么内容 |
| **未利用向量相似度**    | ⭐⭐⭐⭐⭐ | 书签已有 1024 维向量，但分类时完全没用    |
| **未学习用户偏好**      | ⭐⭐⭐⭐   | 不知道用户之前把类似内容放在哪里          |
| **硬编码语义映射**      | ⭐⭐⭐     | `semanticKeywords` 覆盖面有限             |
| **没有文件夹画像**      | ⭐⭐⭐⭐⭐ | 文件夹没有语义表示，无法计算相似度        |

### 1.3 具体失败场景

```
场景 1: AI 不理解文件夹内容
─────────────────────────────────────────────────
书签: "React 18 新特性详解"
用户文件夹: ["学习笔记", "技术收藏", "稍后阅读"]

问题: AI 看到"学习笔记"不知道里面是技术文章还是语言学习
结果: 可能推荐"技术收藏"，但用户习惯放"学习笔记"

场景 2: 相似内容应该放一起
─────────────────────────────────────────────────
已有书签: "Vue 3 组合式 API 入门" → 放在"前端学习"
新书签: "React Hooks 最佳实践"

问题: 两者语义高度相似，但 AI 不知道已有书签的分布
结果: 可能推荐"技术文章"而非"前端学习"

场景 3: 用户个性化偏好
─────────────────────────────────────────────────
用户 A: 把所有教程都放"教程"文件夹
用户 B: 把教程按技术分类放"React"、"Vue"等文件夹

问题: 系统不学习用户的分类习惯
结果: 对两个用户给出相同的推荐
```

---

## 二、优化方案设计

### 2.1 核心思路：文件夹画像 + 向量匹配 + 上下文增强

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        优化后的分类推荐流程                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  新书签 (title, summary, tags, embedding)                               │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Step 1: 向量相似度匹配                                           │   │
│  │ ────────────────────────────────────────────────────────────────│   │
│  │  • 计算书签向量与各文件夹画像向量的余弦相似度                      │   │
│  │  • 获取 Top 5 最相似的文件夹                                      │   │
│  │  • 输出: [(folder_id, similarity_score), ...]                   │   │
│  └──────────────────────────┬──────────────────────────────────────┘   │
│                             │                                          │
│                             ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Step 2: 历史行为匹配                                             │   │
│  │ ────────────────────────────────────────────────────────────────│   │
│  │  • 找到与新书签最相似的 K 个历史书签                              │   │
│  │  • 统计这些书签的文件夹分布                                       │   │
│  │  • 输出: [(folder_id, frequency), ...]                          │   │
│  └──────────────────────────┬──────────────────────────────────────┘   │
│                             │                                          │
│                             ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Step 3: AI 上下文增强推荐                                        │   │
│  │ ────────────────────────────────────────────────────────────────│   │
│  │  • 将 Step 1&2 的候选文件夹 + 示例书签提供给 AI                   │   │
│  │  • AI 基于丰富上下文做最终决策                                    │   │
│  │  • 输出: 最终推荐 + 置信度 + 理由                                │   │
│  └──────────────────────────┬──────────────────────────────────────┘   │
│                             │                                          │
│                             ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Step 4: 综合评分 & 输出                                          │   │
│  │ ────────────────────────────────────────────────────────────────│   │
│  │  final_score = 0.4 × vector_score                               │   │
│  │              + 0.3 × history_score                               │   │
│  │              + 0.3 × ai_score                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据模型扩展

#### 新增表：文件夹画像 (folder_profiles)

```sql
-- 文件夹画像表：存储文件夹的语义表示
CREATE TABLE IF NOT EXISTS public.folder_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,

  -- 文件夹画像向量（基于内部书签向量的聚合）
  profile_embedding vector(1024),

  -- 统计信息
  bookmark_count INT DEFAULT 0,              -- 书签数量
  last_bookmark_at TIMESTAMPTZ,              -- 最后添加书签时间

  -- 画像元数据
  top_tags TEXT[],                           -- 高频标签 (Top 10)
  top_keywords TEXT[],                       -- 高频关键词 (Top 10)
  sample_titles TEXT[],                      -- 示例标题 (5个代表性书签)

  -- 更新时间
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(folder_id)
);

-- 索引
CREATE INDEX idx_folder_profiles_user ON public.folder_profiles(user_id);
CREATE INDEX idx_folder_profiles_embedding ON public.folder_profiles
  USING hnsw (profile_embedding vector_cosine_ops);

-- RLS
ALTER TABLE public.folder_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folder profiles"
  ON public.folder_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own folder profiles"
  ON public.folder_profiles FOR ALL
  USING (auth.uid() = user_id);
```

#### 新增函数：计算文件夹画像向量

```sql
-- 计算单个文件夹的画像向量（基于内部书签向量的平均值）
CREATE OR REPLACE FUNCTION compute_folder_profile(
  p_user_id UUID,
  p_folder_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_embedding vector(1024);
  v_bookmark_count INT;
  v_top_tags TEXT[];
  v_sample_titles TEXT[];
  v_last_bookmark_at TIMESTAMPTZ;
BEGIN
  -- 1. 计算平均向量
  SELECT
    AVG(embedding)::vector(1024),
    COUNT(*),
    MAX(created_at)
  INTO v_avg_embedding, v_bookmark_count, v_last_bookmark_at
  FROM bookmarks
  WHERE user_id = p_user_id
    AND folder_id = p_folder_id
    AND deleted_at IS NULL
    AND embedding IS NOT NULL;

  -- 如果没有书签或没有向量，跳过
  IF v_bookmark_count = 0 OR v_avg_embedding IS NULL THEN
    DELETE FROM folder_profiles WHERE folder_id = p_folder_id;
    RETURN;
  END IF;

  -- 2. 获取高频标签 (Top 10)
  SELECT ARRAY_AGG(tag ORDER BY cnt DESC)
  INTO v_top_tags
  FROM (
    SELECT UNNEST(ai_tags) as tag, COUNT(*) as cnt
    FROM bookmarks
    WHERE user_id = p_user_id
      AND folder_id = p_folder_id
      AND deleted_at IS NULL
      AND ai_tags IS NOT NULL
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 10
  ) t;

  -- 3. 获取示例标题 (最近5个代表性书签)
  SELECT ARRAY_AGG(title ORDER BY created_at DESC)
  INTO v_sample_titles
  FROM (
    SELECT title
    FROM bookmarks
    WHERE user_id = p_user_id
      AND folder_id = p_folder_id
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 5
  ) t;

  -- 4. 更新或插入画像
  INSERT INTO folder_profiles (
    user_id, folder_id, profile_embedding,
    bookmark_count, last_bookmark_at,
    top_tags, sample_titles,
    computed_at, updated_at
  ) VALUES (
    p_user_id, p_folder_id, v_avg_embedding,
    v_bookmark_count, v_last_bookmark_at,
    v_top_tags, v_sample_titles,
    NOW(), NOW()
  )
  ON CONFLICT (folder_id) DO UPDATE SET
    profile_embedding = EXCLUDED.profile_embedding,
    bookmark_count = EXCLUDED.bookmark_count,
    last_bookmark_at = EXCLUDED.last_bookmark_at,
    top_tags = EXCLUDED.top_tags,
    sample_titles = EXCLUDED.sample_titles,
    computed_at = NOW(),
    updated_at = NOW();
END;
$$;
```

#### 新增函数：基于向量匹配推荐文件夹

```sql
-- 基于向量相似度推荐文件夹
CREATE OR REPLACE FUNCTION recommend_folder_by_embedding(
  p_user_id UUID,
  p_embedding vector(1024),
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  folder_id BIGINT,
  folder_name VARCHAR(100),
  similarity FLOAT,
  bookmark_count INT,
  top_tags TEXT[],
  sample_titles TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.folder_id,
    f.name as folder_name,
    (1 - (fp.profile_embedding <=> p_embedding))::FLOAT as similarity,
    fp.bookmark_count,
    fp.top_tags,
    fp.sample_titles
  FROM folder_profiles fp
  JOIN folders f ON f.id = fp.folder_id
  WHERE fp.user_id = p_user_id
    AND f.deleted_at IS NULL
    AND fp.profile_embedding IS NOT NULL
  ORDER BY fp.profile_embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;
```

#### 新增函数：基于历史相似书签推荐

```sql
-- 找到相似书签并统计其文件夹分布
CREATE OR REPLACE FUNCTION recommend_folder_by_similar_bookmarks(
  p_user_id UUID,
  p_embedding vector(1024),
  p_similar_count INT DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  folder_id BIGINT,
  folder_name VARCHAR(100),
  similar_bookmark_count INT,
  avg_similarity FLOAT,
  similar_titles TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH similar_bookmarks AS (
    SELECT
      b.id,
      b.title,
      b.folder_id,
      (1 - (b.embedding <=> p_embedding))::FLOAT as similarity
    FROM bookmarks b
    WHERE b.user_id = p_user_id
      AND b.deleted_at IS NULL
      AND b.embedding IS NOT NULL
      AND b.folder_id IS NOT NULL
      AND (1 - (b.embedding <=> p_embedding)) > p_min_similarity
    ORDER BY b.embedding <=> p_embedding
    LIMIT p_similar_count
  )
  SELECT
    sb.folder_id,
    f.name as folder_name,
    COUNT(*)::INT as similar_bookmark_count,
    AVG(sb.similarity)::FLOAT as avg_similarity,
    ARRAY_AGG(sb.title ORDER BY sb.similarity DESC) as similar_titles
  FROM similar_bookmarks sb
  JOIN folders f ON f.id = sb.folder_id
  WHERE f.deleted_at IS NULL
  GROUP BY sb.folder_id, f.name
  ORDER BY COUNT(*) DESC, AVG(sb.similarity) DESC;
END;
$$;
```

---

## 三、核心算法实现

### 3.1 增强版文件夹推荐函数

**文件位置**: `src/lib/utils/folder-recommendation.ts` (新建)

````typescript
/**
 * 增强版文件夹推荐系统
 * 结合向量匹配 + 历史行为 + AI 上下文推荐
 */

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embedding-generator";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

export interface FolderRecommendation {
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason: string;
  suggestNew: boolean;
  scores: {
    vectorScore: number;
    historyScore: number;
    aiScore: number;
  };
}

interface VectorMatchResult {
  folderId: number;
  folderName: string;
  similarity: number;
  bookmarkCount: number;
  topTags: string[];
  sampleTitles: string[];
}

interface HistoryMatchResult {
  folderId: number;
  folderName: string;
  similarBookmarkCount: number;
  avgSimilarity: number;
  similarTitles: string[];
}

interface RecommendationContext {
  title: string;
  summary: string;
  tags: string[];
  embedding: number[];
  vectorMatches: VectorMatchResult[];
  historyMatches: HistoryMatchResult[];
  allFolders: { id: number; name: string }[];
}

// ============================================
// 主函数：增强版文件夹推荐
// ============================================

export async function recommendFolderEnhanced(
  userId: string,
  title: string,
  summary: string,
  tags: string[],
  existingEmbedding?: number[],
): Promise<FolderRecommendation> {
  const supabase = await createClient();

  try {
    // Step 0: 获取或生成书签向量
    let embedding = existingEmbedding;
    if (!embedding) {
      const embeddingText = [title, summary, tags.join(" ")]
        .filter(Boolean)
        .join(" ");
      embedding = await generateEmbedding(embeddingText);
    }

    // Step 1: 向量相似度匹配
    const vectorMatches = await getVectorMatches(supabase, userId, embedding);
    logger.info(
      { userId, vectorMatchCount: vectorMatches.length },
      "Vector matches found",
    );

    // Step 2: 历史行为匹配
    const historyMatches = await getHistoryMatches(supabase, userId, embedding);
    logger.info(
      { userId, historyMatchCount: historyMatches.length },
      "History matches found",
    );

    // Step 3: 获取所有文件夹（用于 AI 参考）
    const { data: allFolders } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .eq("is_system", false)
      .is("deleted_at", null)
      .order("name");

    // Step 4: 构建推荐上下文
    const context: RecommendationContext = {
      title,
      summary,
      tags,
      embedding,
      vectorMatches,
      historyMatches,
      allFolders: allFolders || [],
    };

    // Step 5: 综合评分并决策
    const recommendation = await computeFinalRecommendation(context);

    logger.info(
      {
        userId,
        title: title.substring(0, 50),
        recommendation: {
          folderId: recommendation.folderId,
          folderName: recommendation.folderName,
          confidence: recommendation.confidence,
          scores: recommendation.scores,
        },
      },
      "Folder recommendation completed",
    );

    return recommendation;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        userId,
        title: title.substring(0, 50),
      },
      "Folder recommendation failed",
    );

    // 返回默认推荐
    return {
      folderId: null,
      folderName: tags[0] || "未分类",
      confidence: 20,
      reason: "推荐系统出错，建议手动选择",
      suggestNew: true,
      scores: { vectorScore: 0, historyScore: 0, aiScore: 0 },
    };
  }
}

// ============================================
// Step 1: 向量相似度匹配
// ============================================

async function getVectorMatches(
  supabase: ReturnType<typeof createClient> extends Promise<infer T>
    ? T
    : never,
  userId: string,
  embedding: number[],
): Promise<VectorMatchResult[]> {
  const { data, error } = await supabase.rpc("recommend_folder_by_embedding", {
    p_user_id: userId,
    p_embedding: embedding,
    p_limit: 5,
  });

  if (error) {
    logger.error({ error: error.message }, "Vector match query failed");
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    folderId: row.folder_id as number,
    folderName: row.folder_name as string,
    similarity: row.similarity as number,
    bookmarkCount: row.bookmark_count as number,
    topTags: (row.top_tags as string[]) || [],
    sampleTitles: (row.sample_titles as string[]) || [],
  }));
}

// ============================================
// Step 2: 历史行为匹配
// ============================================

async function getHistoryMatches(
  supabase: ReturnType<typeof createClient> extends Promise<infer T>
    ? T
    : never,
  userId: string,
  embedding: number[],
): Promise<HistoryMatchResult[]> {
  const { data, error } = await supabase.rpc(
    "recommend_folder_by_similar_bookmarks",
    {
      p_user_id: userId,
      p_embedding: embedding,
      p_similar_count: 10,
      p_min_similarity: 0.6,
    },
  );

  if (error) {
    logger.error({ error: error.message }, "History match query failed");
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    folderId: row.folder_id as number,
    folderName: row.folder_name as string,
    similarBookmarkCount: row.similar_bookmark_count as number,
    avgSimilarity: row.avg_similarity as number,
    similarTitles: (row.similar_titles as string[]) || [],
  }));
}

// ============================================
// Step 3: AI 上下文增强推荐
// ============================================

async function getAIRecommendation(
  context: RecommendationContext,
): Promise<{
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason: string;
}> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      folderId: null,
      folderName: "",
      confidence: 0,
      reason: "API 未配置",
    };
  }

  // 构建增强版 Prompt
  const prompt = buildEnhancedPrompt(context);

  try {
    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "你是一个精准的内容分类专家。根据书签内容和文件夹上下文，选择最合适的文件夹。",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2, // 低温度，更稳定
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    return parseAIRecommendation(content, context.allFolders);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "AI recommendation failed",
    );
    return {
      folderId: null,
      folderName: "",
      confidence: 0,
      reason: "AI 推荐失败",
    };
  }
}

function buildEnhancedPrompt(context: RecommendationContext): string {
  const { title, summary, tags, vectorMatches, historyMatches, allFolders } =
    context;

  // 构建候选文件夹信息（包含上下文）
  let candidateFolders = "";

  // 添加向量匹配的候选
  if (vectorMatches.length > 0) {
    candidateFolders += "\n【内容相似度最高的文件夹】\n";
    for (const match of vectorMatches.slice(0, 3)) {
      candidateFolders += `- "${match.folderName}" (相似度: ${(match.similarity * 100).toFixed(0)}%)\n`;
      candidateFolders += `  已有 ${match.bookmarkCount} 个书签\n`;
      candidateFolders += `  高频标签: ${match.topTags.slice(0, 5).join(", ") || "无"}\n`;
      candidateFolders += `  示例内容: ${match.sampleTitles.slice(0, 2).join("; ") || "无"}\n`;
    }
  }

  // 添加历史行为的候选
  if (historyMatches.length > 0) {
    candidateFolders += "\n【用户历史偏好（相似书签的去向）】\n";
    for (const match of historyMatches.slice(0, 3)) {
      candidateFolders += `- "${match.folderName}": ${match.similarBookmarkCount} 个相似书签\n`;
      candidateFolders += `  相似书签: ${match.similarTitles.slice(0, 2).join("; ")}\n`;
    }
  }

  // 添加其他文件夹
  const otherFolders = allFolders
    .filter((f) => !vectorMatches.some((v) => v.folderId === f.id))
    .filter((f) => !historyMatches.some((h) => h.folderId === f.id))
    .slice(0, 5);

  if (otherFolders.length > 0) {
    candidateFolders += "\n【其他文件夹】\n";
    candidateFolders += otherFolders.map((f) => `- "${f.name}"`).join("\n");
  }

  return `请为以下书签选择最合适的文件夹。

【书签信息】
标题：${title}
摘要：${summary || "无"}
标签：${tags.join(", ") || "无"}
${candidateFolders}

【决策要求】
1. 优先考虑"内容相似度最高"的文件夹
2. 参考"用户历史偏好"了解用户的分类习惯
3. 如果候选文件夹都不合适，可以从"其他文件夹"选择
4. 只有完全不匹配时，才建议新建文件夹

【返回格式】(JSON)
{
  "folderId": 123,           // 推荐的文件夹ID，新建则为 null
  "folderName": "文件夹名",  // 推荐的文件夹名
  "confidence": 85,          // 置信度 0-100
  "reason": "选择理由"       // 简短说明
}

只返回 JSON，不要其他内容。`;
}

function parseAIRecommendation(
  content: string,
  allFolders: { id: number; name: string }[],
): {
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason: string;
} {
  try {
    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const result = JSON.parse(cleaned);

    // 验证文件夹 ID
    let folderId: number | null = null;
    let folderName = result.folderName || "未分类";

    if (result.folderId) {
      const folder = allFolders.find((f) => f.id === result.folderId);
      if (folder) {
        folderId = folder.id;
        folderName = folder.name;
      }
    }

    return {
      folderId,
      folderName,
      confidence: Math.min(100, Math.max(0, result.confidence || 50)),
      reason: result.reason || "基于 AI 分析",
    };
  } catch {
    return {
      folderId: null,
      folderName: "",
      confidence: 0,
      reason: "解析失败",
    };
  }
}

// ============================================
// Step 4: 综合评分与决策
// ============================================

async function computeFinalRecommendation(
  context: RecommendationContext,
): Promise<FolderRecommendation> {
  const { vectorMatches, historyMatches, allFolders, tags, title } = context;

  // 获取 AI 推荐
  const aiResult = await getAIRecommendation(context);

  // 计算各维度分数
  const scoreMap = new Map<
    number,
    {
      vectorScore: number;
      historyScore: number;
      aiScore: number;
      folderName: string;
      reasons: string[];
    }
  >();

  // 初始化所有文件夹
  for (const folder of allFolders) {
    scoreMap.set(folder.id, {
      vectorScore: 0,
      historyScore: 0,
      aiScore: 0,
      folderName: folder.name,
      reasons: [],
    });
  }

  // 向量匹配分数（最高 100 分）
  for (let i = 0; i < vectorMatches.length; i++) {
    const match = vectorMatches[i];
    const score = scoreMap.get(match.folderId);
    if (score) {
      // 相似度转换为分数，并根据排名加权
      score.vectorScore = match.similarity * 100 * (1 - i * 0.1);
      score.reasons.push(`内容相似度 ${(match.similarity * 100).toFixed(0)}%`);
    }
  }

  // 历史行为分数（最高 100 分）
  const maxHistoryCount = Math.max(
    ...historyMatches.map((h) => h.similarBookmarkCount),
    1,
  );
  for (const match of historyMatches) {
    const score = scoreMap.get(match.folderId);
    if (score) {
      // 基于相似书签数量和平均相似度
      score.historyScore =
        (match.similarBookmarkCount / maxHistoryCount) * 50 +
        match.avgSimilarity * 50;
      score.reasons.push(`${match.similarBookmarkCount} 个相似书签也在此`);
    }
  }

  // AI 推荐分数
  if (aiResult.folderId) {
    const score = scoreMap.get(aiResult.folderId);
    if (score) {
      score.aiScore = aiResult.confidence;
      score.reasons.push(`AI: ${aiResult.reason}`);
    }
  }

  // 综合评分
  const weights = { vector: 0.4, history: 0.3, ai: 0.3 };
  let bestFolderId: number | null = null;
  let bestScore = 0;
  let bestScores = { vectorScore: 0, historyScore: 0, aiScore: 0 };
  let bestReasons: string[] = [];
  let bestFolderName = "";

  for (const [folderId, scores] of scoreMap.entries()) {
    const finalScore =
      scores.vectorScore * weights.vector +
      scores.historyScore * weights.history +
      scores.aiScore * weights.ai;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestFolderId = folderId;
      bestScores = {
        vectorScore: scores.vectorScore,
        historyScore: scores.historyScore,
        aiScore: scores.aiScore,
      };
      bestReasons = scores.reasons;
      bestFolderName = scores.folderName;
    }
  }

  // 阈值判断：分数太低则建议新建
  const CONFIDENCE_THRESHOLD = 30;

  if (bestScore < CONFIDENCE_THRESHOLD || !bestFolderId) {
    // 建议新建文件夹
    const suggestedName = generateNewFolderName(tags, title, aiResult);

    return {
      folderId: null,
      folderName: suggestedName,
      confidence: Math.round(bestScore),
      reason:
        bestScore > 0
          ? `最佳匹配"${bestFolderName}"置信度不足 (${Math.round(bestScore)}%)，建议新建`
          : "没有找到匹配的文件夹，建议新建",
      suggestNew: true,
      scores: bestScores,
    };
  }

  return {
    folderId: bestFolderId,
    folderName: bestFolderName,
    confidence: Math.round(bestScore),
    reason: bestReasons.slice(0, 2).join("；") || "综合匹配",
    suggestNew: false,
    scores: bestScores,
  };
}

function generateNewFolderName(
  tags: string[],
  title: string,
  aiResult: { folderName: string },
): string {
  // 优先使用 AI 建议的名称
  if (aiResult.folderName && aiResult.folderName !== "未分类") {
    return aiResult.folderName;
  }

  // 其次使用第一个标签
  if (tags.length > 0 && tags[0].length <= 10) {
    return tags[0];
  }

  // 从标题提取关键词
  const keywords = [
    "前端",
    "后端",
    "AI",
    "设计",
    "产品",
    "数据",
    "运维",
    "学习",
    "教程",
    "工具",
  ];
  for (const keyword of keywords) {
    if (title.includes(keyword)) {
      return keyword;
    }
  }

  return "未分类";
}
````

### 3.2 文件夹画像更新触发器

**文件位置**: `src/lib/utils/folder-profile-manager.ts`

```typescript
/**
 * 文件夹画像管理器
 * 负责触发和管理文件夹画像的更新
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * 更新单个文件夹的画像
 */
export async function updateFolderProfile(
  userId: string,
  folderId: number,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("compute_folder_profile", {
    p_user_id: userId,
    p_folder_id: folderId,
  });

  if (error) {
    logger.error(
      {
        userId,
        folderId,
        error: error.message,
      },
      "Failed to update folder profile",
    );
  }
}

/**
 * 批量更新用户所有文件夹的画像
 */
export async function updateAllFolderProfiles(userId: string): Promise<void> {
  const supabase = await createClient();

  // 获取所有文件夹
  const { data: folders, error: foldersError } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (foldersError || !folders) {
    logger.error(
      { userId, error: foldersError?.message },
      "Failed to fetch folders",
    );
    return;
  }

  // 逐个更新
  for (const folder of folders) {
    await updateFolderProfile(userId, folder.id);
  }

  logger.info(
    {
      userId,
      folderCount: folders.length,
    },
    "All folder profiles updated",
  );
}

/**
 * 在书签移动/删除时更新相关文件夹画像
 */
export async function updateAffectedFolderProfiles(
  userId: string,
  affectedFolderIds: number[],
): Promise<void> {
  for (const folderId of affectedFolderIds) {
    await updateFolderProfile(userId, folderId);
  }
}
```

### 3.3 集成到书签创建流程

在书签创建/移动时触发画像更新：

```typescript
// 在书签创建 API 中添加
import { updateFolderProfile } from "@/lib/utils/folder-profile-manager";

// 书签创建成功后
if (folderId) {
  // 异步更新文件夹画像，不阻塞主流程
  updateFolderProfile(userId, folderId).catch((err) => {
    logger.error(
      { error: err.message },
      "Background folder profile update failed",
    );
  });
}
```

---

## 四、实施计划

### 4.1 阶段分解

```
Phase 1: 数据基础 (2 天)
├── Day 1 上午: 创建 folder_profiles 表和索引
├── Day 1 下午: 实现 compute_folder_profile 函数
├── Day 2 上午: 实现向量匹配函数 recommend_folder_by_embedding
└── Day 2 下午: 实现历史匹配函数 recommend_folder_by_similar_bookmarks

Phase 2: 核心算法 (2 天)
├── Day 3: 实现 recommendFolderEnhanced() 主函数
├── Day 4 上午: 实现增强版 AI Prompt
└── Day 4 下午: 实现综合评分算法

Phase 3: 集成与测试 (1 天)
├── Day 5 上午: 集成到现有分类建议 API
├── Day 5 下午: 历史数据迁移（计算所有文件夹画像）
└── Day 5 晚上: 端到端测试

总计: 5 个工作日
```

### 4.2 详细任务清单

| 任务                           | 文件                                 | 预计时间 | 优先级 |
| ------------------------------ | ------------------------------------ | -------- | ------ |
| 创建 folder_profiles 表        | `supabase/migrations/xxx.sql`        | 1h       | P0     |
| 实现 compute_folder_profile    | `supabase/migrations/xxx.sql`        | 2h       | P0     |
| 实现向量匹配 SQL 函数          | `supabase/migrations/xxx.sql`        | 2h       | P0     |
| 实现历史匹配 SQL 函数          | `supabase/migrations/xxx.sql`        | 2h       | P0     |
| 新建 folder-recommendation.ts  | `src/lib/utils/`                     | 4h       | P0     |
| 新建 folder-profile-manager.ts | `src/lib/utils/`                     | 2h       | P0     |
| 修改 reclassify API            | `src/app/api/reclassify/route.ts`    | 2h       | P0     |
| 修改书签创建 API               | 相关文件                             | 1h       | P1     |
| 历史数据迁移脚本               | `scripts/migrate-folder-profiles.ts` | 2h       | P1     |
| 单元测试                       | `__tests__/`                         | 3h       | P1     |

### 4.3 回滚方案

如果新算法效果不佳，可以通过环境变量切换：

```typescript
const USE_ENHANCED_RECOMMENDATION = process.env.USE_ENHANCED_RECOMMENDATION === 'true'

if (USE_ENHANCED_RECOMMENDATION) {
  return await recommendFolderEnhanced(...)
} else {
  return await recommendFolder(...) // 原有逻辑
}
```

---

## 五、效果评估

### 5.1 评估指标

| 指标             | 定义                         | 目标  |
| ---------------- | ---------------------------- | ----- |
| **准确率**       | 用户接受推荐的比例           | > 80% |
| **首选命中率**   | 推荐的第一个就是用户选择的   | > 70% |
| **新建文件夹率** | 建议新建但实际放入已有文件夹 | < 15% |
| **平均置信度**   | 推荐结果的置信度均值         | > 70  |

### 5.2 A/B 测试方案

```typescript
// 随机分配用户到实验组
const isExperimentGroup = hash(userId) % 100 < 50 // 50% 用户

if (isExperimentGroup) {
  // 使用新算法
  const result = await recommendFolderEnhanced(...)
  logExperiment('enhanced', userId, result, userChoice)
} else {
  // 使用原算法
  const result = await recommendFolder(...)
  logExperiment('original', userId, result, userChoice)
}
```

### 5.3 用户反馈机制

在分类建议界面添加反馈按钮：

```typescript
interface ClassificationFeedback {
  suggestionId: number;
  action: "accepted" | "rejected" | "modified";
  actualFolderId?: number; // 用户实际选择的文件夹
  reason?: string; // 可选：拒绝原因
}
```

---

## 六、预期效果

### 6.1 对比

| 维度           | 当前方案                | 优化后                                 |
| -------------- | ----------------------- | -------------------------------------- |
| **输入信息**   | 标题+摘要+标签+文件夹名 | + 文件夹画像向量 + 示例书签 + 历史行为 |
| **匹配方式**   | AI 推断 + 字面匹配      | 向量相似度 + 历史统计 + AI 上下文推荐  |
| **个性化**     | 无                      | 基于用户历史分类行为                   |
| **置信度评估** | AI 自评                 | 多维度综合评分                         |

### 6.2 场景改进

```
场景 1 改进: AI 理解文件夹内容
─────────────────────────────────────────────────
书签: "React 18 新特性详解"
文件夹: "学习笔记" (画像: 技术文章为主，Top标签: React, Vue, TypeScript)

优化后: 向量匹配发现"学习笔记"内技术文章多，相似度高
结果: 准确推荐"学习笔记" ✓

场景 2 改进: 相似内容归类
─────────────────────────────────────────────────
已有: "Vue 3 组合式 API 入门" → "前端学习"
新书签: "React Hooks 最佳实践"

优化后: 历史匹配发现相似书签都在"前端学习"
结果: 推荐"前端学习" ✓

场景 3 改进: 用户偏好学习
─────────────────────────────────────────────────
用户习惯: 把所有教程都放"教程"文件夹

优化后: 历史行为统计发现用户偏好
结果: 尊重用户习惯，推荐"教程" ✓
```

---

## 七、需要确认的决策点

1. **权重配置**: 向量 40% + 历史 30% + AI 30% 是否合适？
2. **阈值设置**: 综合评分 < 30 建议新建，是否合理？
3. **历史匹配**: 参考最近 10 个相似书签，数量是否足够？
4. **画像更新频率**: 每次书签变动都更新 vs 定时批量更新？

---

**文档状态**: 待审核
**预计工期**: 5 个工作日
**下一步**: 确认方案后开始实施
