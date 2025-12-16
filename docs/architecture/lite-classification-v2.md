# AnyKeep 轻量化智能分类系统 V2

> 基于真实使用场景的精准设计

**版本**: v2.0
**日期**: 2024-12-17
**状态**: 待审核

---

## 1. 场景分析

### 1.1 用户旅程

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户生命周期                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  阶段1: 新用户                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  文件夹: [待分类]                                            │   │
│  │  书签: 0                                                     │   │
│  │  状态: 冷启动                                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  阶段2: 开始收藏 (路径A: AI主导)                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  用户收藏 10-20 条 → 全部进入 [待分类]                       │   │
│  │  AI 分析聚类 → 发现可以分成 3 个主题                         │   │
│  │  AI 建议创建: [技术文章] [产品设计] [行业资讯]               │   │
│  │  用户确认 → AI 移动书签到对应文件夹                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  阶段2: 开始收藏 (路径B: 用户主导)                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  用户先创建文件夹: [工作] [学习] [生活]                      │   │
│  │  文件夹只有名称，无内容 → 使用 name_embedding                │   │
│  │  用户收藏 → AI 根据名称语义匹配分类                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  阶段3: 稳定使用                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  文件夹有内容 → 使用 profile_embedding (内容向量)            │   │
│  │  新收藏 → 与现有内容匹配 → 高准确率分类                      │   │
│  │  偶尔: AI 发现新主题 → 建议创建新文件夹                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心挑战

| 挑战                 | 说明                     | 解决思路            |
| -------------------- | ------------------------ | ------------------- |
| **空文件夹匹配**     | 用户创建的文件夹没有内容 | 依赖 name_embedding |
| **冷启动聚类**       | 待分类中的书签如何分组   | 简单聚类算法        |
| **标题+标签 → 向量** | 这是分类的核心输入       | 优化 embedding 生成 |
| **准确率关键**       | 错分一次，用户信任下降   | 宁可不分，不要错分  |

### 1.3 数据流重新梳理

```
书签输入
    │
    ├── 标题: "React 18 新特性解析"
    ├── URL: https://...
    ├── AI 标签: ["前端", "React", "技术"]
    │
    ▼
┌─────────────────────────────────────────┐
│  生成书签向量 (bookmark_embedding)      │
│  输入: 标题 + 标签 (拼接)               │
│  "React 18 新特性解析 前端 React 技术"  │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  匹配文件夹                              │
│                                         │
│  文件夹A [前端技术] (有10条书签)         │
│    → profile_embedding (内容向量)       │
│    → 相似度: 0.85 ✓                     │
│                                         │
│  文件夹B [工作笔记] (空，刚创建)         │
│    → name_embedding (名称向量)          │
│    → 相似度: 0.45                       │
│                                         │
│  文件夹C [待分类] (系统文件夹)           │
│    → 不参与匹配                         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  决策                                    │
│  最高分 0.85 > 阈值 0.70                 │
│  → 自动分类到 [前端技术]                 │
└─────────────────────────────────────────┘
```

---

## 2. 系统设计

### 2.1 核心公式（场景优化版）

```typescript
/**
 * 轻量化评分公式 V2
 *
 * 核心思想：
 * 1. 有内容的文件夹：主要看内容相似度
 * 2. 空文件夹：主要看名称语义匹配
 * 3. 标签匹配作为加成信号
 */

function computeScore(
  folder: FolderCandidate,
  bookmark: BookmarkInput,
): number {
  // ========== 情况1: 文件夹有内容 ==========
  if (folder.bookmarkCount > 0 && folder.profileEmbedding) {
    const contentSim = cosineSimilarity(
      bookmark.embedding,
      folder.profileEmbedding,
    );
    const nameSim = cosineSimilarity(bookmark.embedding, folder.nameEmbedding);
    const tagMatch = computeTagOverlap(bookmark.tags, folder.topTags);

    // 内容为主，名称为辅，标签加成
    return contentSim * 0.65 + nameSim * 0.15 + tagMatch * 0.2;
  }

  // ========== 情况2: 空文件夹（只有名称） ==========
  else {
    const nameSim = cosineSimilarity(bookmark.embedding, folder.nameEmbedding);
    const tagSemanticMatch = computeTagNameMatch(bookmark.tags, folder.name);

    // 名称语义为主，标签语义为辅
    // 注意：空文件夹匹配需要更高的阈值，因为不确定性更大
    return nameSim * 0.75 + tagSemanticMatch * 0.25;
  }
}

/**
 * 标签与文件夹名称的语义匹配
 * 例如：标签["前端", "React"] vs 文件夹名"技术学习" → 有一定匹配
 */
function computeTagNameMatch(tags: string[], folderName: string): number {
  // 简单实现：检查标签是否出现在文件夹名中
  // 或者：计算标签向量与文件夹名称向量的相似度
  const directMatch = tags.some(
    (tag) => folderName.includes(tag) || tag.includes(folderName),
  );
  return directMatch ? 0.3 : 0;
}
```

### 2.2 决策阈值（保守策略）

```typescript
/**
 * 决策逻辑
 *
 * 核心原则：宁可不分，不要错分
 * 错分会损害用户信任，不分只是需要用户手动处理
 */

interface DecisionConfig {
  // 有内容文件夹的阈值（相对可靠）
  autoThreshold_withContent: 0.75;
  suggestThreshold_withContent: 0.55;

  // 空文件夹的阈值（需要更保守）
  autoThreshold_empty: 0.85; // 更高！因为只有名称匹配
  suggestThreshold_empty: 0.65;

  // 建议创建新文件夹的阈值
  createFolderThreshold: 0.5; // 所有文件夹都低于此值，考虑新建
}

function makeDecision(
  topCandidate: ScoredCandidate,
  config: DecisionConfig,
): Decision {
  const { score, folder } = topCandidate;
  const hasContent = folder.bookmarkCount > 0;

  // 选择对应的阈值
  const autoThreshold = hasContent
    ? config.autoThreshold_withContent
    : config.autoThreshold_empty;

  const suggestThreshold = hasContent
    ? config.suggestThreshold_withContent
    : config.suggestThreshold_empty;

  // 决策
  if (score >= autoThreshold) {
    return {
      action: "auto_classify",
      confidence: Math.round(score * 100),
      reason: hasContent ? "内容高度匹配" : "与文件夹主题高度相关",
    };
  }

  if (score >= suggestThreshold) {
    return {
      action: "suggest",
      confidence: Math.round(score * 100),
      reason: hasContent ? "内容相似，建议确认" : "可能属于此文件夹，请确认",
    };
  }

  // 所有文件夹都不匹配
  if (score < config.createFolderThreshold) {
    return {
      action: "to_inbox_suggest_create",
      confidence: Math.round(score * 100),
      reason: "未找到匹配的文件夹，可能需要创建新分类",
    };
  }

  return {
    action: "to_inbox",
    confidence: Math.round(score * 100),
    reason: "未找到足够匹配的文件夹",
  };
}
```

### 2.3 聚类与文件夹创建建议

```typescript
/**
 * 待分类聚类分析
 *
 * 当待分类中积累了一定数量的书签，分析是否可以创建新文件夹
 */

interface ClusterSuggestion {
  suggestedName: string; // 建议的文件夹名
  bookmarkIds: number[]; // 属于此聚类的书签
  commonTags: string[]; // 共同标签
  confidence: number; // 聚类置信度
  sampleTitles: string[]; // 示例标题（展示给用户）
}

async function analyzeInboxForClustering(
  userId: string,
  minClusterSize: number = 3, // 最少 3 条才建议创建文件夹
  maxClusters: number = 5, // 最多建议 5 个文件夹
): Promise<ClusterSuggestion[]> {
  // 1. 获取待分类中的书签
  const inboxBookmarks = await getInboxBookmarks(userId);

  if (inboxBookmarks.length < minClusterSize) {
    return []; // 数量太少，不分析
  }

  // 2. 简单聚类：基于标签分组
  const tagGroups = groupByTags(inboxBookmarks);

  // 3. 向量聚类：对于标签不明显的，用向量相似度
  const vectorClusters = clusterByEmbedding(
    inboxBookmarks.filter((b) => !b.groupedByTag),
    { minSimilarity: 0.7, minSize: minClusterSize },
  );

  // 4. 合并结果
  const allClusters = [...tagGroups, ...vectorClusters];

  // 5. 生成建议
  return allClusters
    .filter((c) => c.bookmarks.length >= minClusterSize)
    .slice(0, maxClusters)
    .map((cluster) => ({
      suggestedName: generateFolderName(cluster),
      bookmarkIds: cluster.bookmarks.map((b) => b.id),
      commonTags: cluster.commonTags,
      confidence: cluster.cohesion, // 聚类内聚度
      sampleTitles: cluster.bookmarks.slice(0, 3).map((b) => b.title),
    }));
}

/**
 * 基于标签分组（最简单有效的聚类）
 */
function groupByTags(bookmarks: Bookmark[]): TagGroup[] {
  const tagMap = new Map<string, Bookmark[]>();

  for (const bookmark of bookmarks) {
    // 取第一个标签作为主分类
    const primaryTag = bookmark.tags[0];
    if (primaryTag) {
      const group = tagMap.get(primaryTag) || [];
      group.push(bookmark);
      tagMap.set(primaryTag, group);
    }
  }

  return Array.from(tagMap.entries())
    .filter(([_, bookmarks]) => bookmarks.length >= 3)
    .map(([tag, bookmarks]) => ({
      tag,
      bookmarks,
      commonTags: [tag],
      cohesion: computeGroupCohesion(bookmarks),
    }));
}

/**
 * 生成文件夹名称建议
 */
function generateFolderName(cluster: Cluster): string {
  // 优先使用共同标签
  if (cluster.commonTags.length > 0) {
    return cluster.commonTags[0];
  }

  // 否则用 AI 生成（可选）
  // return await aiGenerateFolderName(cluster.bookmarks)

  // 兜底：使用最常见的关键词
  return extractCommonKeyword(cluster.bookmarks);
}
```

---

## 3. 数据模型

### 3.1 简化的数据结构

```typescript
// ========== 输入 ==========

interface BookmarkInput {
  id: number;
  title: string;
  url: string;
  tags: string[]; // AI 生成的标签
  embedding: number[]; // 标题+标签 生成的向量
  sourceId?: number; // 来源 ID（可选）
}

// ========== 文件夹 ==========

interface FolderCandidate {
  id: number;
  name: string;
  bookmarkCount: number; // 书签数量（0 表示空文件夹）

  // 向量
  nameEmbedding: number[]; // 文件夹名称向量（始终有）
  profileEmbedding?: number[]; // 内容聚合向量（有内容时才有）

  // 统计（轻量化）
  topTags: string[]; // 高频标签（前 5 个）
  acceptCount: number; // 接受次数
  rejectCount: number; // 拒绝次数
}

// ========== 输出 ==========

interface ClassificationResult {
  action: "auto_classify" | "suggest" | "to_inbox" | "to_inbox_suggest_create";
  folderId?: number;
  folderName?: string;
  confidence: number; // 0-100
  reason: string; // 可解释的理由
  candidates: ScoredCandidate[]; // 前 3 个候选
  clusterSuggestion?: ClusterSuggestion; // 如果建议创建新文件夹
}

interface ScoredCandidate {
  folderId: number;
  folderName: string;
  score: number; // 0-1
  matchType: "content" | "name"; // 匹配类型
}
```

### 3.2 数据库表（最小化）

```sql
-- ============================================================
-- 方案A：复用现有表 + 最小修改
-- ============================================================

-- folder_profiles 已经有我们需要的大部分字段：
-- ✅ name_embedding (文件夹名称向量)
-- ✅ profile_embedding (内容聚合向量)
-- ✅ bookmark_count
-- ✅ top_tags
-- ✅ heat_score

-- 只需要添加准确率统计字段
ALTER TABLE folder_profiles
ADD COLUMN IF NOT EXISTS classification_accept_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS classification_reject_count INT DEFAULT 0;

-- 添加索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_folder_profiles_user_accuracy
ON folder_profiles(user_id, classification_accept_count, classification_reject_count);

-- ============================================================
-- 方案B：新建独立统计表（如果不想改 folder_profiles）
-- ============================================================

CREATE TABLE IF NOT EXISTS folder_classification_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

  accept_count INT DEFAULT 0,
  reject_count INT DEFAULT 0,

  -- 负样本（可选，简化版可以不要）
  rejection_tags TEXT[] DEFAULT '{}',

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, folder_id)
);

-- RLS
ALTER TABLE folder_classification_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY fcs_user_policy ON folder_classification_stats
  FOR ALL USING (auth.uid() = user_id);
```

### 3.3 核心 SQL 函数

```sql
-- ============================================================
-- 函数1: 获取分类候选（优化版）
-- ============================================================

CREATE OR REPLACE FUNCTION get_classification_candidates_v2(
  p_user_id UUID,
  p_embedding vector(1024),
  p_tags TEXT[] DEFAULT '{}',
  p_limit INT DEFAULT 5
) RETURNS TABLE (
  folder_id BIGINT,
  folder_name VARCHAR,
  bookmark_count INT,
  -- 相似度
  content_similarity FLOAT,
  name_similarity FLOAT,
  -- 统计
  top_tags TEXT[],
  accept_count INT,
  reject_count INT,
  -- 热度
  heat_score FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.folder_id,
    f.name as folder_name,
    COALESCE(fp.bookmark_count, 0)::INT as bookmark_count,

    -- 内容相似度（如果有 profile_embedding）
    CASE
      WHEN fp.profile_embedding IS NOT NULL
      THEN (1 - (fp.profile_embedding <=> p_embedding))::FLOAT
      ELSE 0.0
    END as content_similarity,

    -- 名称相似度（始终有 name_embedding）
    CASE
      WHEN fp.name_embedding IS NOT NULL
      THEN (1 - (fp.name_embedding <=> p_embedding))::FLOAT
      ELSE 0.0
    END as name_similarity,

    fp.top_tags,
    COALESCE(fp.classification_accept_count, 0)::INT as accept_count,
    COALESCE(fp.classification_reject_count, 0)::INT as reject_count,
    COALESCE(fp.heat_score, 50.0)::FLOAT as heat_score

  FROM folder_profiles fp
  JOIN folders f ON f.id = fp.folder_id
  WHERE fp.user_id = p_user_id
    AND f.is_system = false  -- 排除系统文件夹（待分类等）
    AND (
      fp.profile_embedding IS NOT NULL
      OR fp.name_embedding IS NOT NULL
    )
  ORDER BY
    -- 优先按内容相似度排序，其次按名称相似度
    CASE
      WHEN fp.profile_embedding IS NOT NULL
      THEN fp.profile_embedding <=> p_embedding
      ELSE fp.name_embedding <=> p_embedding
    END
  LIMIT p_limit;
END;
$$;


-- ============================================================
-- 函数2: 记录分类反馈（简化版）
-- ============================================================

CREATE OR REPLACE FUNCTION record_lite_feedback(
  p_user_id UUID,
  p_folder_id BIGINT,
  p_is_accepted BOOLEAN
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE folder_profiles
  SET
    classification_accept_count = classification_accept_count + CASE WHEN p_is_accepted THEN 1 ELSE 0 END,
    classification_reject_count = classification_reject_count + CASE WHEN p_is_accepted THEN 0 ELSE 1 END,
    updated_at = NOW()
  WHERE user_id = p_user_id AND folder_id = p_folder_id;

  -- 如果没有记录，插入（理论上不应该发生）
  IF NOT FOUND THEN
    -- folder_profiles 应该已经存在，这里只是兜底
    NULL;
  END IF;
END;
$$;


-- ============================================================
-- 函数3: 获取待分类书签（用于聚类分析）
-- ============================================================

CREATE OR REPLACE FUNCTION get_inbox_bookmarks_for_clustering(
  p_user_id UUID,
  p_limit INT DEFAULT 100
) RETURNS TABLE (
  id BIGINT,
  title VARCHAR,
  tags TEXT[],
  embedding vector(1024),
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_inbox_folder_id BIGINT;
BEGIN
  -- 获取待分类文件夹 ID
  SELECT id INTO v_inbox_folder_id
  FROM folders
  WHERE user_id = p_user_id AND is_system = true AND name = '待分类'
  LIMIT 1;

  IF v_inbox_folder_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.tags,
    b.embedding,
    b.created_at
  FROM bookmarks b
  WHERE b.user_id = p_user_id
    AND b.folder_id = v_inbox_folder_id
    AND b.embedding IS NOT NULL
  ORDER BY b.created_at DESC
  LIMIT p_limit;
END;
$$;
```

---

## 4. 服务实现

### 4.1 LiteClassificationServiceV2

```typescript
// src/lib/classification/lite/lite-classification-v2.service.ts

import { SupabaseClient } from "@supabase/supabase-js";

interface ClassificationConfig {
  // 有内容文件夹的阈值
  autoThreshold_withContent: number;
  suggestThreshold_withContent: number;
  // 空文件夹的阈值（更保守）
  autoThreshold_empty: number;
  suggestThreshold_empty: number;
  // 建议创建新文件夹的阈值
  createFolderThreshold: number;
}

const DEFAULT_CONFIG: ClassificationConfig = {
  autoThreshold_withContent: 0.75,
  suggestThreshold_withContent: 0.55,
  autoThreshold_empty: 0.85,
  suggestThreshold_empty: 0.65,
  createFolderThreshold: 0.5,
};

export class LiteClassificationServiceV2 {
  constructor(
    private supabase: SupabaseClient,
    private config: ClassificationConfig = DEFAULT_CONFIG,
  ) {}

  /**
   * 分类书签
   */
  async classify(
    userId: string,
    bookmark: {
      embedding: number[];
      tags: string[];
      title: string;
    },
  ): Promise<ClassificationResult> {
    // 1. 获取候选文件夹
    const { data: candidates, error } = await this.supabase.rpc(
      "get_classification_candidates_v2",
      {
        p_user_id: userId,
        p_embedding: bookmark.embedding,
        p_tags: bookmark.tags,
        p_limit: 5,
      },
    );

    if (error) throw error;

    // 2. 没有候选 → 待分类
    if (!candidates || candidates.length === 0) {
      return {
        action: "to_inbox",
        confidence: 0,
        reason: "暂无可用文件夹",
        candidates: [],
      };
    }

    // 3. 计算分数
    const scored = candidates.map((c) => this.scoreCandidate(c, bookmark));
    scored.sort((a, b) => b.score - a.score);

    // 4. 决策
    const top = scored[0];
    const decision = this.makeDecision(top);

    return {
      action: decision.action,
      folderId: decision.action.startsWith("to_inbox")
        ? undefined
        : top.folderId,
      folderName: decision.action.startsWith("to_inbox")
        ? undefined
        : top.folderName,
      confidence: decision.confidence,
      reason: decision.reason,
      candidates: scored.slice(0, 3),
    };
  }

  /**
   * 计算单个候选的分数
   */
  private scoreCandidate(
    candidate: any,
    bookmark: { tags: string[] },
  ): ScoredCandidate {
    const hasContent = candidate.bookmark_count > 0;

    let score: number;
    let matchType: "content" | "name";

    if (hasContent && candidate.content_similarity > 0) {
      // 有内容：内容相似度为主
      const tagMatch = this.computeTagOverlap(
        bookmark.tags,
        candidate.top_tags,
      );

      score =
        candidate.content_similarity * 0.65 +
        candidate.name_similarity * 0.15 +
        tagMatch * 0.2;

      matchType = "content";
    } else {
      // 空文件夹：名称相似度为主
      const tagNameMatch = this.computeTagNameMatch(
        bookmark.tags,
        candidate.folder_name,
      );

      score = candidate.name_similarity * 0.75 + tagNameMatch * 0.25;

      matchType = "name";
    }

    // 准确率加成/惩罚（轻量版）
    const total = candidate.accept_count + candidate.reject_count;
    if (total > 5) {
      const accuracyRate = candidate.accept_count / total;
      // 准确率影响 ±10%
      score = score * (0.9 + accuracyRate * 0.2);
    }

    return {
      folderId: candidate.folder_id,
      folderName: candidate.folder_name,
      score: Math.max(0, Math.min(1, score)),
      matchType,
      bookmarkCount: candidate.bookmark_count,
      rawSimilarity: hasContent
        ? candidate.content_similarity
        : candidate.name_similarity,
    };
  }

  /**
   * 标签重叠度
   */
  private computeTagOverlap(
    bookmarkTags: string[],
    folderTags: string[],
  ): number {
    if (!bookmarkTags?.length || !folderTags?.length) return 0;
    const overlap = bookmarkTags.filter((t) => folderTags.includes(t)).length;
    return Math.min(1, overlap / Math.max(1, bookmarkTags.length));
  }

  /**
   * 标签与文件夹名称匹配
   */
  private computeTagNameMatch(tags: string[], folderName: string): number {
    if (!tags?.length || !folderName) return 0;
    const nameWords = folderName.toLowerCase().split(/\s+/);
    const match = tags.some((tag) =>
      nameWords.some(
        (word) =>
          word.includes(tag.toLowerCase()) || tag.toLowerCase().includes(word),
      ),
    );
    return match ? 0.3 : 0;
  }

  /**
   * 决策
   */
  private makeDecision(candidate: ScoredCandidate): {
    action: ClassificationResult["action"];
    confidence: number;
    reason: string;
  } {
    const { score, matchType, bookmarkCount } = candidate;
    const hasContent = bookmarkCount > 0;

    // 选择对应阈值
    const autoThreshold = hasContent
      ? this.config.autoThreshold_withContent
      : this.config.autoThreshold_empty;

    const suggestThreshold = hasContent
      ? this.config.suggestThreshold_withContent
      : this.config.suggestThreshold_empty;

    const confidence = Math.round(score * 100);

    // 决策
    if (score >= autoThreshold) {
      return {
        action: "auto_classify",
        confidence,
        reason: hasContent ? "内容高度匹配" : "与文件夹主题高度相关",
      };
    }

    if (score >= suggestThreshold) {
      return {
        action: "suggest",
        confidence,
        reason: hasContent ? "内容相似，建议确认" : "可能属于此文件夹，请确认",
      };
    }

    if (score < this.config.createFolderThreshold) {
      return {
        action: "to_inbox_suggest_create",
        confidence,
        reason: "未找到匹配的文件夹，可能需要创建新分类",
      };
    }

    return {
      action: "to_inbox",
      confidence,
      reason: "未找到足够匹配的文件夹",
    };
  }

  /**
   * 记录反馈
   */
  async recordFeedback(
    userId: string,
    folderId: number,
    isAccepted: boolean,
  ): Promise<void> {
    await this.supabase.rpc("record_lite_feedback", {
      p_user_id: userId,
      p_folder_id: folderId,
      p_is_accepted: isAccepted,
    });
  }

  /**
   * 分析待分类，生成文件夹创建建议
   */
  async analyzeInboxForClustering(
    userId: string,
  ): Promise<ClusterSuggestion[]> {
    // 1. 获取待分类书签
    const { data: bookmarks } = await this.supabase.rpc(
      "get_inbox_bookmarks_for_clustering",
      { p_user_id: userId, p_limit: 100 },
    );

    if (!bookmarks || bookmarks.length < 3) {
      return [];
    }

    // 2. 基于标签分组
    const tagGroups = this.groupByPrimaryTag(bookmarks);

    // 3. 生成建议
    return tagGroups
      .filter((g) => g.bookmarks.length >= 3)
      .slice(0, 5)
      .map((group) => ({
        suggestedName: group.primaryTag,
        bookmarkIds: group.bookmarks.map((b) => b.id),
        commonTags: [group.primaryTag],
        confidence: Math.min(100, group.bookmarks.length * 15),
        sampleTitles: group.bookmarks.slice(0, 3).map((b) => b.title),
      }));
  }

  /**
   * 基于主标签分组
   */
  private groupByPrimaryTag(
    bookmarks: any[],
  ): { primaryTag: string; bookmarks: any[] }[] {
    const map = new Map<string, any[]>();

    for (const b of bookmarks) {
      const primaryTag = b.tags?.[0];
      if (primaryTag) {
        const list = map.get(primaryTag) || [];
        list.push(b);
        map.set(primaryTag, list);
      }
    }

    return Array.from(map.entries())
      .map(([tag, items]) => ({ primaryTag: tag, bookmarks: items }))
      .sort((a, b) => b.bookmarks.length - a.bookmarks.length);
  }
}
```

---

## 5. 关键流程

### 5.1 完整分类流程

```typescript
async function classifyNewBookmark(
  userId: string,
  bookmark: Bookmark,
): Promise<void> {
  const service = new LiteClassificationServiceV2(supabase);

  // 1. 分类
  const result = await service.classify(userId, {
    embedding: bookmark.embedding,
    tags: bookmark.tags,
    title: bookmark.title,
  });

  // 2. 根据结果处理
  switch (result.action) {
    case "auto_classify":
      // 自动移动到目标文件夹
      await moveBookmark(bookmark.id, result.folderId);
      // 记录成功（用于准确率统计）
      // 注意：这里先假设成功，如果用户后续移动了，会有修正
      break;

    case "suggest":
      // 创建待确认建议
      await createSuggestion({
        bookmarkId: bookmark.id,
        suggestedFolderId: result.folderId,
        confidence: result.confidence,
        reason: result.reason,
      });
      // 书签暂时放入待分类
      await moveBookmark(bookmark.id, INBOX_FOLDER_ID);
      break;

    case "to_inbox_suggest_create":
      // 放入待分类
      await moveBookmark(bookmark.id, INBOX_FOLDER_ID);
      // 检查是否需要建议创建文件夹
      await checkAndSuggestNewFolder(userId);
      break;

    case "to_inbox":
    default:
      // 放入待分类
      await moveBookmark(bookmark.id, INBOX_FOLDER_ID);
      break;
  }
}
```

### 5.2 文件夹创建建议流程

```typescript
async function checkAndSuggestNewFolder(userId: string): Promise<void> {
  const service = new LiteClassificationServiceV2(supabase);

  // 获取聚类建议
  const suggestions = await service.analyzeInboxForClustering(userId);

  if (suggestions.length === 0) return;

  // 创建组织建议（展示给用户）
  for (const suggestion of suggestions) {
    await createOrganizationSuggestion({
      userId,
      type: "create_folder",
      suggestedName: suggestion.suggestedName,
      bookmarkIds: suggestion.bookmarkIds,
      confidence: suggestion.confidence,
      reason: `发现 ${suggestion.bookmarkIds.length} 条相关收藏，建议创建文件夹「${suggestion.suggestedName}」`,
    });
  }
}
```

### 5.3 用户反馈处理

```typescript
async function handleUserFeedback(
  userId: string,
  suggestionId: number,
  action: "accept" | "reject" | "modify",
  newFolderId?: number,
): Promise<void> {
  const service = new LiteClassificationServiceV2(supabase);
  const suggestion = await getSuggestion(suggestionId);

  switch (action) {
    case "accept":
      // 移动书签
      await moveBookmark(suggestion.bookmarkId, suggestion.suggestedFolderId);
      // 记录正反馈
      await service.recordFeedback(userId, suggestion.suggestedFolderId, true);
      break;

    case "reject":
      // 记录负反馈
      await service.recordFeedback(userId, suggestion.suggestedFolderId, false);
      // 书签保持在待分类
      break;

    case "modify":
      // 移动到用户选择的文件夹
      await moveBookmark(suggestion.bookmarkId, newFolderId);
      // 记录负反馈（对原建议）
      await service.recordFeedback(userId, suggestion.suggestedFolderId, false);
      // 记录正反馈（对用户选择）
      await service.recordFeedback(userId, newFolderId, true);
      break;
  }

  // 更新建议状态
  await updateSuggestionStatus(suggestionId, action);
}
```

---

## 6. 准确率提升策略

### 6.1 Embedding 质量优化

```typescript
/**
 * 书签 Embedding 生成优化
 *
 * 关键：标题 + 标签 的组合方式影响匹配质量
 */

function prepareTextForEmbedding(bookmark: Bookmark): string {
  // 方案1：简单拼接
  // return `${bookmark.title} ${bookmark.tags.join(' ')}`

  // 方案2：加权拼接（标签重复以增强权重）
  const tagText = bookmark.tags.join(" ");
  return `${bookmark.title} ${tagText} ${tagText}`;

  // 方案3：结构化（如果 embedding 模型支持）
  // return `标题: ${bookmark.title}\n标签: ${bookmark.tags.join(', ')}`
}

/**
 * 文件夹名称 Embedding 生成优化
 *
 * 关键：扩展文件夹名称的语义范围
 */

async function prepareFolderNameForEmbedding(
  folderName: string,
): Promise<string> {
  // 方案1：直接使用名称
  // return folderName

  // 方案2：AI 扩展同义词（推荐）
  const expanded = await expandFolderName(folderName);
  // "前端技术" → "前端技术 前端开发 Web开发 JavaScript React Vue"
  return expanded;

  // 方案3：固定映射表
  // const synonyms = FOLDER_SYNONYMS[folderName] || []
  // return `${folderName} ${synonyms.join(' ')}`
}

/**
 * AI 扩展文件夹名称
 */
async function expandFolderName(name: string): Promise<string> {
  const prompt = `
文件夹名称: "${name}"

请列出 5-8 个与此文件夹相关的关键词或同义词，用于提高内容匹配准确率。
只输出关键词，用空格分隔。
`;
  const response = await callAI(prompt);
  return `${name} ${response}`;
}
```

### 6.2 标签质量保障

```typescript
/**
 * AI 标签生成质量控制
 *
 * 标签是分类的关键信号，需要保证质量
 */

interface TagQualityConfig {
  minTags: 2; // 最少 2 个标签
  maxTags: 5; // 最多 5 个标签
  minConfidence: 0.7; // 最低置信度
  useHierarchy: true; // 使用层级标签
}

async function generateQualityTags(
  bookmark: Bookmark,
  config: TagQualityConfig,
): Promise<string[]> {
  const prompt = `
分析以下内容，生成 ${config.minTags}-${config.maxTags} 个分类标签。

标题: ${bookmark.title}
URL: ${bookmark.url}
${bookmark.description ? `描述: ${bookmark.description}` : ""}

要求：
1. 标签应该是通用的分类词，不是专有名词
2. 优先使用常见的分类词：技术、设计、产品、营销、管理、生活、学习等
3. 如果是技术内容，可以加上具体技术栈：React、Python、AI 等
4. 按相关度排序，最相关的放前面

输出格式（JSON 数组）：
["标签1", "标签2", ...]
`;

  const response = await callAI(prompt);
  const tags = JSON.parse(response);

  return tags.slice(0, config.maxTags);
}
```

### 6.3 阈值自适应

```typescript
/**
 * 根据用户反馈历史动态调整阈值
 *
 * 核心思想：
 * - 如果用户经常拒绝 → 提高阈值，更保守
 * - 如果用户经常接受 → 可以适当降低阈值
 */

async function getAdaptiveThresholds(
  userId: string,
  baseConfig: ClassificationConfig,
): Promise<ClassificationConfig> {
  // 获取近期反馈统计
  const { data } = await supabase
    .from("folder_profiles")
    .select("classification_accept_count, classification_reject_count")
    .eq("user_id", userId);

  if (!data || data.length === 0) {
    return baseConfig; // 新用户，使用默认值
  }

  const totalAccept = data.reduce(
    (sum, f) => sum + (f.classification_accept_count || 0),
    0,
  );
  const totalReject = data.reduce(
    (sum, f) => sum + (f.classification_reject_count || 0),
    0,
  );
  const total = totalAccept + totalReject;

  if (total < 10) {
    return baseConfig; // 样本太少，使用默认值
  }

  const acceptRate = totalAccept / total;

  // 根据接受率调整阈值
  const adjustment = (acceptRate - 0.7) * 0.1; // 基准 70%

  return {
    ...baseConfig,
    autoThreshold_withContent: clamp(
      baseConfig.autoThreshold_withContent - adjustment,
      0.65,
      0.9,
    ),
    autoThreshold_empty: clamp(
      baseConfig.autoThreshold_empty - adjustment,
      0.75,
      0.95,
    ),
    suggestThreshold_withContent: clamp(
      baseConfig.suggestThreshold_withContent - adjustment,
      0.45,
      0.7,
    ),
    suggestThreshold_empty: clamp(
      baseConfig.suggestThreshold_empty - adjustment,
      0.55,
      0.8,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

---

## 7. 实施计划

### 7.1 Phase 1: 核心功能（3天）

| 天    | 任务                                  | 产出       |
| ----- | ------------------------------------- | ---------- |
| Day 1 | 添加 folder_profiles 统计字段         | SQL 迁移   |
| Day 1 | 实现 get_classification_candidates_v2 | SQL 函数   |
| Day 2 | 实现 LiteClassificationServiceV2      | TypeScript |
| Day 2 | 实现 record_lite_feedback             | SQL 函数   |
| Day 3 | 集成到现有分类 API                    | API 更新   |
| Day 3 | 基础测试                              | 测试用例   |

### 7.2 Phase 2: 聚类建议（2天）

| 天    | 任务                                    | 产出       |
| ----- | --------------------------------------- | ---------- |
| Day 4 | 实现 get_inbox_bookmarks_for_clustering | SQL 函数   |
| Day 4 | 实现 analyzeInboxForClustering          | TypeScript |
| Day 5 | 集成到组织建议系统                      | API 更新   |
| Day 5 | 前端展示适配                            | UI 更新    |

### 7.3 Phase 3: 优化（可选）

| 任务               | 优先级 | 说明                    |
| ------------------ | ------ | ----------------------- |
| Embedding 质量优化 | P1     | 优化标题+标签的组合方式 |
| 文件夹名称扩展     | P1     | AI 扩展同义词           |
| 阈值自适应         | P2     | 根据反馈动态调整        |
| 标签质量提升       | P2     | 优化 AI 标签生成        |

---

## 8. 总结

### 8.1 核心设计要点

| 要点           | 说明                                                  |
| -------------- | ----------------------------------------------------- |
| **双向量匹配** | 有内容用 profile_embedding，空文件夹用 name_embedding |
| **保守阈值**   | 空文件夹阈值更高，宁可不分不要错分                    |
| **即时反馈**   | 每次反馈立即更新计数器                                |
| **标签驱动**   | 标签是分类的关键信号                                  |
| **聚类建议**   | 待分类积累后自动建议创建文件夹                        |

### 8.2 与原系统的区别

| 维度     | 原系统 | V2 轻量化           |
| -------- | ------ | ------------------- |
| 评分因素 | 10+    | 3-4                 |
| 阈值策略 | 统一   | 区分有内容/空文件夹 |
| 学习机制 | 复杂   | 简单计数器          |
| 聚类     | 无     | 基于标签分组        |
| 代码量   | ~500行 | ~300行              |

### 8.3 预期效果

| 场景                 | 预期准确率 |
| -------------------- | ---------- |
| 有内容文件夹匹配     | 80-85%     |
| 空文件夹（名称匹配） | 65-75%     |
| 聚类建议             | 70-80%     |

---

**文档结束**

请审核此方案，如有问题或需要调整，请告知。
