# AnyKeep 知识图谱演进方案

**版本**: 1.0
**日期**: 2025-12-05
**状态**: 待审核

---

## 一、愿景与目标

### 1.1 产品愿景演进

```
当前状态                         目标状态
─────────────────────────────────────────────────────────
书签管理工具                  →   个人知识管理系统
  ↓                                    ↓
单一文件夹分类               →   智能动态分类 + 知识关联
  ↓                                    ↓
孤立的收藏                   →   互联的知识网络
  ↓                                    ↓
被动存储                     →   主动知识发现
```

### 1.2 核心目标

| 目标         | 描述                         | 衡量指标         |
| ------------ | ---------------------------- | ---------------- |
| **智能分类** | 随着收藏增加，分类越来越准确 | 分类准确率 > 90% |
| **动态优化** | 自动发现分类模式，建议重组   | 文件夹健康度评分 |
| **知识关联** | 发现书签之间的隐藏关系       | 关联发现率       |
| **知识图谱** | 100+ 书签形成可视化知识网络  | 图谱覆盖率       |

---

## 二、技术架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                      知识图谱系统架构                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    用户交互层 (UI Layer)                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐     │   │
│  │  │知识图谱  │  │智能分类  │  │相似推荐  │  │学习路径发现  │     │   │
│  │  │可视化    │  │建议      │  │         │  │             │     │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                    │                               │
│  ┌─────────────────────────────────▼───────────────────────────┐   │
│  │                    智能服务层 (AI Services)                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐      │   │
│  │  │ 实体抽取    │  │ 关系推断    │  │ 聚类分析        │      │   │
│  │  │ (LLM)       │  │ (LLM+规则)  │  │ (向量相似度)    │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐      │   │
│  │  │ 分类优化    │  │ 知识路径    │  │ 图谱生成        │      │   │
│  │  │ (聚类+LLM)  │  │ (图遍历)    │  │ (实体+关系)     │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                    │                               │
│  ┌─────────────────────────────────▼───────────────────────────┐   │
│  │                    数据存储层 (Data Layer)                   │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │              PostgreSQL + pgvector                   │    │   │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────────┐    │    │   │
│  │  │  │bookmarks  │  │entities   │  │relations      │    │    │   │
│  │  │  │(embedding)│  │(实体)     │  │(关系)         │    │    │   │
│  │  │  └───────────┘  └───────────┘  └───────────────┘    │    │   │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────────┐    │    │   │
│  │  │  │clusters   │  │similarity │  │folder_health  │    │    │   │
│  │  │  │(聚类)     │  │(相似度)   │  │(健康度)       │    │    │   │
│  │  │  └───────────┘  └───────────┘  └───────────────┘    │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据模型设计

#### 2.2.1 实体表 (entities)

存储从书签内容中抽取的知识实体：

```sql
-- 实体表：存储从收藏内容中抽取的实体
CREATE TABLE IF NOT EXISTS public.entities (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 实体基本信息
  name VARCHAR(200) NOT NULL,              -- 实体名称（如 "React", "性能优化"）
  normalized_name VARCHAR(200) NOT NULL,   -- 标准化名称（小写、去空格）
  type VARCHAR(50) NOT NULL,               -- 实体类型
  description TEXT,                        -- 实体描述

  -- 实体元数据
  aliases TEXT[],                          -- 别名列表（如 ["ReactJS", "React.js"]）
  properties JSONB DEFAULT '{}',           -- 扩展属性

  -- 统计信息
  mention_count INT DEFAULT 1,             -- 被提及次数
  bookmark_count INT DEFAULT 1,            -- 关联书签数

  -- 向量嵌入（用于实体相似度计算）
  embedding vector(1024),

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束：同一用户下实体名称唯一
  UNIQUE(user_id, normalized_name, type)
);

-- 实体类型枚举
COMMENT ON COLUMN public.entities.type IS '
实体类型:
- TECHNOLOGY: 技术栈（React, Python, PostgreSQL）
- CONCEPT: 概念（微服务, 响应式设计, SOLID原则）
- TOOL: 工具（VSCode, Figma, Docker）
- PERSON: 人物（作者、专家）
- ORGANIZATION: 组织（公司、社区）
- DOMAIN: 领域（前端开发, 数据科学）
- METHODOLOGY: 方法论（敏捷开发, TDD）
- RESOURCE_TYPE: 资源类型（教程, 文档, 案例研究）
';

-- 索引
CREATE INDEX idx_entities_user_type ON public.entities(user_id, type);
CREATE INDEX idx_entities_normalized ON public.entities(user_id, normalized_name);
CREATE INDEX idx_entities_mention_count ON public.entities(user_id, mention_count DESC);
```

#### 2.2.2 书签-实体关系表 (bookmark_entities)

```sql
-- 书签与实体的多对多关系
CREATE TABLE IF NOT EXISTS public.bookmark_entities (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  entity_id BIGINT NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,

  -- 关系属性
  relevance_score DECIMAL(5,4) DEFAULT 1.0,  -- 相关度 0-1
  is_primary BOOLEAN DEFAULT FALSE,          -- 是否为主要实体
  context TEXT,                              -- 上下文片段
  extraction_method VARCHAR(50),             -- 抽取方法（AI/规则/手动）

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(bookmark_id, entity_id)
);

CREATE INDEX idx_bookmark_entities_bookmark ON public.bookmark_entities(bookmark_id);
CREATE INDEX idx_bookmark_entities_entity ON public.bookmark_entities(entity_id);
```

#### 2.2.3 实体关系表 (entity_relations)

```sql
-- 实体之间的关系（知识图谱的边）
CREATE TABLE IF NOT EXISTS public.entity_relations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 关系的两端
  source_entity_id BIGINT NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  target_entity_id BIGINT NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,

  -- 关系类型和强度
  relation_type VARCHAR(50) NOT NULL,        -- 关系类型
  strength DECIMAL(5,4) DEFAULT 0.5,         -- 关系强度 0-1
  confidence DECIMAL(5,4) DEFAULT 0.5,       -- 置信度 0-1

  -- 关系来源
  source_type VARCHAR(50),                   -- 来源类型（共现/推断/手动）
  evidence_count INT DEFAULT 1,              -- 证据数量（共同出现的书签数）

  -- 元数据
  properties JSONB DEFAULT '{}',

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束（无向关系）
  UNIQUE(user_id, source_entity_id, target_entity_id, relation_type),

  -- 防止自环
  CHECK (source_entity_id != target_entity_id)
);

COMMENT ON COLUMN public.entity_relations.relation_type IS '
关系类型:
- RELATED_TO: 相关（通用关系）
- BELONGS_TO: 属于（技术属于领域）
- DEPENDS_ON: 依赖（框架依赖语言）
- ALTERNATIVE_TO: 替代（Vue vs React）
- EXTENDS: 扩展（Next.js 扩展 React）
- USED_WITH: 配合使用（TypeScript 配合 React）
- PREREQUISITE: 前置知识（JS 是 React 前置）
- ADVANCED_VERSION: 进阶版本（高级 vs 入门）
';

CREATE INDEX idx_entity_relations_source ON public.entity_relations(source_entity_id);
CREATE INDEX idx_entity_relations_target ON public.entity_relations(target_entity_id);
CREATE INDEX idx_entity_relations_type ON public.entity_relations(user_id, relation_type);
```

#### 2.2.4 书签相似度表 (bookmark_similarity)

```sql
-- 书签之间的相似度（预计算，提高查询性能）
CREATE TABLE IF NOT EXISTS public.bookmark_similarity (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  bookmark_a_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  bookmark_b_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,

  -- 相似度分数
  similarity_score DECIMAL(5,4) NOT NULL,    -- 向量余弦相似度 0-1
  shared_entities INT DEFAULT 0,             -- 共享实体数量
  shared_tags INT DEFAULT 0,                 -- 共享标签数量

  -- 计算时间
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束（无向，确保 a < b）
  UNIQUE(bookmark_a_id, bookmark_b_id),
  CHECK (bookmark_a_id < bookmark_b_id)
);

CREATE INDEX idx_bookmark_similarity_a ON public.bookmark_similarity(bookmark_a_id);
CREATE INDEX idx_bookmark_similarity_b ON public.bookmark_similarity(bookmark_b_id);
CREATE INDEX idx_bookmark_similarity_score ON public.bookmark_similarity(user_id, similarity_score DESC);
```

#### 2.2.5 文件夹健康度表 (folder_health)

```sql
-- 文件夹健康度监控（用于智能分类建议）
CREATE TABLE IF NOT EXISTS public.folder_health (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,

  -- 统计指标
  bookmark_count INT DEFAULT 0,              -- 书签数量
  avg_internal_similarity DECIMAL(5,4),      -- 内部平均相似度
  cluster_count INT DEFAULT 1,               -- 聚类数量
  entropy_score DECIMAL(5,4),                -- 熵值（越低越集中）

  -- 健康建议
  health_score DECIMAL(5,2),                 -- 健康度评分 0-100
  suggested_action VARCHAR(50),              -- 建议操作
  suggestion_details JSONB,                  -- 详细建议

  -- 计算时间
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(folder_id)
);

COMMENT ON COLUMN public.folder_health.suggested_action IS '
建议操作:
- NONE: 无需操作
- SPLIT: 建议拆分（内部有多个明显聚类）
- MERGE: 建议合并（与其他文件夹高度重叠）
- RENAME: 建议重命名（名称与内容不符）
- REORGANIZE: 建议重组（部分内容应移到其他文件夹）
';
```

#### 2.2.6 知识聚类表 (knowledge_clusters)

```sql
-- 知识聚类（用于发现隐藏的主题分组）
CREATE TABLE IF NOT EXISTS public.knowledge_clusters (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 聚类信息
  cluster_name VARCHAR(200),                 -- AI 生成的聚类名称
  cluster_description TEXT,                  -- 聚类描述
  center_embedding vector(1024),             -- 聚类中心向量

  -- 聚类属性
  bookmark_count INT DEFAULT 0,              -- 包含书签数
  coherence_score DECIMAL(5,4),              -- 聚类紧密度
  top_entities TEXT[],                       -- 主要实体
  top_tags TEXT[],                           -- 主要标签

  -- 状态
  status VARCHAR(20) DEFAULT 'active',       -- active/merged/archived
  parent_cluster_id BIGINT REFERENCES public.knowledge_clusters(id),

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 书签-聚类关系
CREATE TABLE IF NOT EXISTS public.bookmark_clusters (
  bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id) ON DELETE CASCADE,
  cluster_id BIGINT NOT NULL REFERENCES public.knowledge_clusters(id) ON DELETE CASCADE,
  membership_score DECIMAL(5,4) DEFAULT 1.0, -- 归属度 0-1

  PRIMARY KEY (bookmark_id, cluster_id)
);
```

### 2.3 核心算法设计

#### 2.3.1 实体抽取 Pipeline

```typescript
/**
 * 实体抽取 Pipeline
 * 从书签内容中抽取知识实体
 */

interface ExtractedEntity {
  name: string;
  type: EntityType;
  confidence: number;
  context?: string;
}

type EntityType =
  | "TECHNOLOGY"
  | "CONCEPT"
  | "TOOL"
  | "PERSON"
  | "ORGANIZATION"
  | "DOMAIN"
  | "METHODOLOGY"
  | "RESOURCE_TYPE";

async function extractEntities(
  title: string,
  summary: string,
  tags: string[],
  content?: string,
): Promise<ExtractedEntity[]> {
  const prompt = `你是一个知识实体抽取专家。请从以下内容中抽取知识实体。

【内容信息】
标题：${title}
摘要：${summary}
标签：${tags.join(", ")}
${content ? `正文片段：${content.substring(0, 2000)}` : ""}

【实体类型】
- TECHNOLOGY: 技术栈（React, Python, PostgreSQL）
- CONCEPT: 概念（微服务, 响应式设计）
- TOOL: 工具（VSCode, Figma, Docker）
- PERSON: 人物（作者、专家）
- ORGANIZATION: 组织（公司、社区）
- DOMAIN: 领域（前端开发, 数据科学）
- METHODOLOGY: 方法论（敏捷开发, TDD）
- RESOURCE_TYPE: 资源类型（教程, 文档）

【要求】
1. 抽取 3-10 个最重要的实体
2. 每个实体给出置信度 (0-1)
3. 优先抽取具体的技术/工具/概念
4. 避免过于宽泛的实体（如"技术"、"开发"）

【返回格式】(JSON)
[
  {"name": "React", "type": "TECHNOLOGY", "confidence": 0.95},
  {"name": "状态管理", "type": "CONCEPT", "confidence": 0.85}
]`;

  // 调用 DeepSeek API
  const result = await callDeepSeekAPI(prompt);
  return parseEntityResponse(result);
}
```

#### 2.3.2 关系推断算法

```typescript
/**
 * 关系推断算法
 * 基于共现和语义分析推断实体关系
 */

interface EntityRelation {
  sourceId: number;
  targetId: number;
  relationType: RelationType;
  strength: number;
  confidence: number;
  evidenceCount: number;
}

type RelationType =
  | "RELATED_TO"
  | "BELONGS_TO"
  | "DEPENDS_ON"
  | "ALTERNATIVE_TO"
  | "EXTENDS"
  | "USED_WITH"
  | "PREREQUISITE";

async function inferEntityRelations(
  userId: string,
  minCoOccurrence: number = 2,
): Promise<EntityRelation[]> {
  // 1. 计算共现关系（基于书签共享）
  const coOccurrenceQuery = `
    SELECT
      be1.entity_id as source_id,
      be2.entity_id as target_id,
      COUNT(DISTINCT be1.bookmark_id) as co_occurrence_count,
      e1.name as source_name,
      e2.name as target_name,
      e1.type as source_type,
      e2.type as target_type
    FROM bookmark_entities be1
    JOIN bookmark_entities be2 ON be1.bookmark_id = be2.bookmark_id
      AND be1.entity_id < be2.entity_id
    JOIN entities e1 ON be1.entity_id = e1.id
    JOIN entities e2 ON be2.entity_id = e2.id
    WHERE be1.user_id = $1
    GROUP BY be1.entity_id, be2.entity_id, e1.name, e2.name, e1.type, e2.type
    HAVING COUNT(DISTINCT be1.bookmark_id) >= $2
    ORDER BY co_occurrence_count DESC
  `;

  const coOccurrences = await db.query(coOccurrenceQuery, [
    userId,
    minCoOccurrence,
  ]);

  // 2. 使用 LLM 推断具体关系类型
  const relations: EntityRelation[] = [];

  for (const co of coOccurrences) {
    const relationType = await inferRelationType(
      co.source_name,
      co.source_type,
      co.target_name,
      co.target_type,
    );

    relations.push({
      sourceId: co.source_id,
      targetId: co.target_id,
      relationType,
      strength: calculateStrength(co.co_occurrence_count),
      confidence: 0.7, // 基于共现的默认置信度
      evidenceCount: co.co_occurrence_count,
    });
  }

  return relations;
}

// LLM 推断关系类型
async function inferRelationType(
  sourceName: string,
  sourceType: string,
  targetName: string,
  targetType: string,
): Promise<RelationType> {
  const prompt = `判断以下两个实体之间的关系类型：

实体A: ${sourceName} (${sourceType})
实体B: ${targetName} (${targetType})

可选关系类型：
- BELONGS_TO: A属于B（如 React 属于 前端开发）
- DEPENDS_ON: A依赖B（如 Next.js 依赖 React）
- ALTERNATIVE_TO: A和B是替代关系（如 Vue 和 React）
- EXTENDS: A扩展B（如 TypeScript 扩展 JavaScript）
- USED_WITH: A和B经常配合使用（如 React 配合 Redux）
- PREREQUISITE: A是B的前置知识（如 JavaScript 是 React 的前置）
- RELATED_TO: 其他相关关系

只返回关系类型名称，不要其他内容。`;

  const result = await callDeepSeekAPI(prompt);
  return parseRelationType(result) || "RELATED_TO";
}
```

#### 2.3.3 智能聚类算法

```typescript
/**
 * 智能聚类算法
 * 基于向量相似度对书签进行自动聚类
 */

interface ClusterResult {
  clusterId: number;
  clusterName: string;
  bookmarkIds: number[];
  coherenceScore: number;
  topEntities: string[];
  centerEmbedding: number[];
}

async function performClustering(
  userId: string,
  folderId?: number,
  minClusterSize: number = 5,
): Promise<ClusterResult[]> {
  // 1. 获取书签及其向量
  const bookmarks = await getBookmarksWithEmbeddings(userId, folderId);

  if (bookmarks.length < minClusterSize * 2) {
    return []; // 数据量不足
  }

  // 2. 使用 HDBSCAN 或 K-means 聚类
  // 这里使用基于相似度矩阵的层次聚类
  const similarityMatrix = computeSimilarityMatrix(bookmarks);
  const clusters = hierarchicalClustering(similarityMatrix, {
    minClusterSize,
    threshold: 0.6, // 相似度阈值
  });

  // 3. 为每个聚类生成名称和描述
  const results: ClusterResult[] = [];

  for (const cluster of clusters) {
    const clusterBookmarks = cluster.memberIds.map((id) =>
      bookmarks.find((b) => b.id === id),
    );

    // 计算聚类中心
    const centerEmbedding = computeClusterCenter(
      clusterBookmarks.map((b) => b.embedding),
    );

    // 获取主要实体
    const topEntities = await getTopEntitiesForBookmarks(cluster.memberIds);

    // 使用 LLM 生成聚类名称
    const clusterName = await generateClusterName(
      clusterBookmarks.map((b) => b.title),
      topEntities,
    );

    results.push({
      clusterId: cluster.id,
      clusterName,
      bookmarkIds: cluster.memberIds,
      coherenceScore: cluster.coherence,
      topEntities,
      centerEmbedding,
    });
  }

  return results;
}

// 使用 SQL 计算相似度（利用 pgvector）
async function computeSimilarityMatrix(
  bookmarks: Bookmark[],
): Promise<number[][]> {
  const ids = bookmarks.map((b) => b.id);

  // 使用 pgvector 的余弦相似度
  const query = `
    SELECT
      b1.id as id1,
      b2.id as id2,
      1 - (b1.embedding <=> b2.embedding) as similarity
    FROM bookmarks b1
    CROSS JOIN bookmarks b2
    WHERE b1.id = ANY($1)
      AND b2.id = ANY($1)
      AND b1.id < b2.id
      AND b1.embedding IS NOT NULL
      AND b2.embedding IS NOT NULL
  `;

  const results = await db.query(query, [ids]);
  return buildMatrix(results, ids);
}
```

#### 2.3.4 文件夹健康度评估

```typescript
/**
 * 文件夹健康度评估
 * 分析文件夹内容的一致性，提供优化建议
 */

interface FolderHealthReport {
  folderId: number;
  folderName: string;
  healthScore: number;
  metrics: {
    bookmarkCount: number;
    avgInternalSimilarity: number;
    clusterCount: number;
    entropyScore: number;
    outlierCount: number;
  };
  suggestedAction: SuggestedAction;
  details: {
    subclusters?: SubclusterInfo[];
    overlappingFolders?: OverlappingFolder[];
    outliers?: OutlierBookmark[];
    suggestedName?: string;
  };
}

type SuggestedAction = "NONE" | "SPLIT" | "MERGE" | "RENAME" | "REORGANIZE";

async function evaluateFolderHealth(
  userId: string,
  folderId: number,
): Promise<FolderHealthReport> {
  // 1. 获取文件夹书签
  const bookmarks = await getBookmarksInFolder(userId, folderId);
  const folder = await getFolder(folderId);

  if (bookmarks.length < 5) {
    return {
      folderId,
      folderName: folder.name,
      healthScore: 100,
      metrics: { bookmarkCount: bookmarks.length /* ... */ },
      suggestedAction: "NONE",
      details: {},
    };
  }

  // 2. 计算内部相似度
  const avgSimilarity = await computeAverageInternalSimilarity(bookmarks);

  // 3. 检测子聚类
  const clusters = await performClustering(userId, folderId, 3);

  // 4. 计算熵值（内容分散程度）
  const entropy = computeEntropy(clusters);

  // 5. 检测离群点
  const outliers = await detectOutliers(bookmarks, avgSimilarity);

  // 6. 检测与其他文件夹的重叠
  const overlaps = await detectFolderOverlaps(userId, folderId);

  // 7. 计算综合健康分数
  const healthScore = calculateHealthScore({
    avgSimilarity,
    clusterCount: clusters.length,
    entropy,
    outlierRatio: outliers.length / bookmarks.length,
    overlapRatio: overlaps.length > 0 ? overlaps[0].overlapRatio : 0,
  });

  // 8. 生成建议
  const suggestion = generateSuggestion({
    clusters,
    outliers,
    overlaps,
    avgSimilarity,
    folderName: folder.name,
    bookmarks,
  });

  return {
    folderId,
    folderName: folder.name,
    healthScore,
    metrics: {
      bookmarkCount: bookmarks.length,
      avgInternalSimilarity: avgSimilarity,
      clusterCount: clusters.length,
      entropyScore: entropy,
      outlierCount: outliers.length,
    },
    suggestedAction: suggestion.action,
    details: suggestion.details,
  };
}

// 生成优化建议
function generateSuggestion(params: AnalysisParams): Suggestion {
  const { clusters, outliers, overlaps, avgSimilarity, folderName, bookmarks } =
    params;

  // 情况1: 多个明显的子聚类 → 建议拆分
  if (clusters.length >= 3 && avgSimilarity < 0.5) {
    return {
      action: "SPLIT",
      details: {
        subclusters: clusters.map((c) => ({
          suggestedName: c.clusterName,
          bookmarkIds: c.bookmarkIds,
          size: c.bookmarkIds.length,
        })),
      },
    };
  }

  // 情况2: 与其他文件夹高度重叠 → 建议合并
  if (overlaps.length > 0 && overlaps[0].overlapRatio > 0.4) {
    return {
      action: "MERGE",
      details: {
        overlappingFolders: overlaps,
      },
    };
  }

  // 情况3: 有明显离群点 → 建议重组
  if (outliers.length > bookmarks.length * 0.2) {
    return {
      action: "REORGANIZE",
      details: {
        outliers: outliers.map((o) => ({
          bookmarkId: o.id,
          title: o.title,
          suggestedFolder: o.suggestedFolder,
        })),
      },
    };
  }

  // 情况4: 文件夹名称与内容不符 → 建议重命名
  const suggestedName = await suggestFolderName(bookmarks);
  if (calculateNameSimilarity(folderName, suggestedName) < 0.5) {
    return {
      action: "RENAME",
      details: {
        suggestedName,
      },
    };
  }

  return { action: "NONE", details: {} };
}
```

---

## 三、知识图谱可视化

### 3.1 图谱数据结构

```typescript
/**
 * 知识图谱可视化数据结构
 */

interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  stats: GraphStats;
}

interface GraphNode {
  id: string;
  type: "bookmark" | "entity" | "folder" | "cluster";
  label: string;
  data: {
    // 书签节点
    url?: string;
    summary?: string;
    coverUrl?: string;
    // 实体节点
    entityType?: EntityType;
    mentionCount?: number;
    // 通用
    importance: number; // 节点重要性 0-1
  };
  position?: { x: number; y: number };
  style?: {
    size: number;
    color: string;
    opacity: number;
  };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  data: {
    strength: number;
    label?: string;
  };
  style?: {
    width: number;
    color: string;
    opacity: number;
  };
}

interface GraphCluster {
  id: string;
  name: string;
  nodeIds: string[];
  color: string;
}

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  avgDegree: number;
  density: number;
  componentCount: number;
}
```

### 3.2 图谱生成 API

```typescript
/**
 * 生成用户知识图谱
 * GET /api/knowledge-graph
 */

async function generateKnowledgeGraph(
  userId: string,
  options: {
    folderId?: number; // 限定文件夹
    maxNodes?: number; // 最大节点数
    minRelationStrength?: number; // 最小关系强度
    includeBookmarks?: boolean; // 是否包含书签节点
    layout?: "force" | "hierarchical" | "radial";
  },
): Promise<KnowledgeGraphData> {
  const {
    folderId,
    maxNodes = 200,
    minRelationStrength = 0.3,
    includeBookmarks = true,
    layout = "force",
  } = options;

  // 1. 获取实体节点
  const entities = await getTopEntities(userId, {
    folderId,
    limit: maxNodes / 2,
    minMentionCount: 2,
  });

  // 2. 获取实体关系
  const entityRelations = await getEntityRelations(userId, {
    entityIds: entities.map((e) => e.id),
    minStrength: minRelationStrength,
  });

  // 3. 构建节点
  const nodes: GraphNode[] = entities.map((entity) => ({
    id: `entity-${entity.id}`,
    type: "entity",
    label: entity.name,
    data: {
      entityType: entity.type,
      mentionCount: entity.mention_count,
      importance: calculateEntityImportance(entity),
    },
    style: {
      size: mapToSize(entity.mention_count, 20, 60),
      color: getEntityColor(entity.type),
      opacity: 1,
    },
  }));

  // 4. 可选：添加书签节点
  if (includeBookmarks) {
    const bookmarks = await getConnectedBookmarks(userId, {
      entityIds: entities.map((e) => e.id),
      folderId,
      limit: maxNodes / 2,
    });

    for (const bookmark of bookmarks) {
      nodes.push({
        id: `bookmark-${bookmark.id}`,
        type: "bookmark",
        label: truncate(bookmark.title, 30),
        data: {
          url: bookmark.url,
          summary: bookmark.ai_summary,
          coverUrl: bookmark.cover_url,
          importance: 0.5,
        },
        style: {
          size: 15,
          color: "#6B7280",
          opacity: 0.7,
        },
      });
    }
  }

  // 5. 构建边
  const edges: GraphEdge[] = entityRelations.map((rel) => ({
    id: `rel-${rel.id}`,
    source: `entity-${rel.source_entity_id}`,
    target: `entity-${rel.target_entity_id}`,
    type: rel.relation_type,
    data: {
      strength: rel.strength,
      label: getRelationLabel(rel.relation_type),
    },
    style: {
      width: mapToWidth(rel.strength, 1, 4),
      color: getRelationColor(rel.relation_type),
      opacity: rel.confidence,
    },
  }));

  // 6. 添加书签-实体边
  if (includeBookmarks) {
    const bookmarkEntityEdges = await getBookmarkEntityEdges(userId, {
      entityIds: entities.map((e) => e.id),
      folderId,
    });

    for (const edge of bookmarkEntityEdges) {
      edges.push({
        id: `be-${edge.bookmark_id}-${edge.entity_id}`,
        source: `bookmark-${edge.bookmark_id}`,
        target: `entity-${edge.entity_id}`,
        type: "MENTIONS",
        data: { strength: edge.relevance_score },
        style: {
          width: 1,
          color: "#D1D5DB",
          opacity: 0.5,
        },
      });
    }
  }

  // 7. 聚类
  const clusters = await getGraphClusters(nodes, edges);

  // 8. 计算布局
  const layoutResult = computeLayout(nodes, edges, layout);

  // 9. 统计
  const stats = computeGraphStats(nodes, edges);

  return {
    nodes: layoutResult.nodes,
    edges,
    clusters,
    stats,
  };
}
```

### 3.3 前端可视化组件

```typescript
/**
 * 知识图谱可视化组件
 * 使用 React Flow 或 D3.js 实现
 */

// components/knowledge-graph/knowledge-graph-viewer.tsx

'use client'

import { useCallback, useMemo, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { EntityNode } from './entity-node'
import { BookmarkNode } from './bookmark-node'
import { KnowledgeGraphData } from '@/types/knowledge-graph'
import { KnowledgeGraphSidebar } from './knowledge-graph-sidebar'

const nodeTypes = {
  entity: EntityNode,
  bookmark: BookmarkNode,
}

interface KnowledgeGraphViewerProps {
  data: KnowledgeGraphData
  onNodeClick?: (nodeId: string, nodeType: string) => void
  onExplore?: (entityId: number) => void
}

export function KnowledgeGraphViewer({
  data,
  onNodeClick,
  onExplore,
}: KnowledgeGraphViewerProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  // 转换为 ReactFlow 格式
  const initialNodes = useMemo(() =>
    data.nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position || { x: 0, y: 0 },
      data: {
        label: node.label,
        ...node.data,
        style: node.style,
      },
    })),
    [data.nodes]
  )

  const initialEdges = useMemo(() =>
    data.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.data.label,
      style: {
        strokeWidth: edge.style?.width || 1,
        stroke: edge.style?.color || '#B0B0B0',
        opacity: edge.style?.opacity || 1,
      },
      animated: edge.data.strength > 0.7,
    })),
    [data.edges]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const handleNodeClick: NodeMouseHandler = useCallback((event, node) => {
    setSelectedNode(node)
    onNodeClick?.(node.id, node.type || 'unknown')
  }, [onNodeClick])

  return (
    <div className="w-full h-[600px] bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => node.data.style?.color || '#6B7280'}
          maskColor="rgb(0, 0, 0, 0.1)"
        />
      </ReactFlow>

      {/* 侧边栏：显示选中节点详情 */}
      {selectedNode && (
        <KnowledgeGraphSidebar
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onExplore={onExplore}
        />
      )}

      {/* 统计信息 */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90
                      rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
        <span>{data.stats.totalNodes} 节点</span>
        <span className="mx-2">·</span>
        <span>{data.stats.totalEdges} 关系</span>
        <span className="mx-2">·</span>
        <span>密度 {(data.stats.density * 100).toFixed(1)}%</span>
      </div>
    </div>
  )
}
```

---

## 四、演进路线图

### 4.1 阶段规划

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       知识图谱演进路线图                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 1: 基础设施 (2-3 周)                                             │
│  ════════════════════════════════════════════════════════════════════  │
│  Week 1-2: 数据模型扩展                                                 │
│    ├── 创建 entities 表                                                │
│    ├── 创建 entity_relations 表                                        │
│    ├── 创建 bookmark_entities 表                                       │
│    └── 创建 bookmark_similarity 表                                     │
│                                                                         │
│  Week 3: 实体抽取 Pipeline                                              │
│    ├── 实现 extractEntities() 函数                                     │
│    ├── 集成到书签创建流程                                               │
│    └── 批量处理历史书签                                                 │
│                                                                         │
│  Phase 2: 智能分类增强 (2-3 周)                                         │
│  ════════════════════════════════════════════════════════════════════  │
│  Week 4-5: 关系推断 & 相似度计算                                        │
│    ├── 实现 inferEntityRelations()                                     │
│    ├── 实现 computeBookmarkSimilarity()                                │
│    └── 定期任务：更新相似度和关系                                       │
│                                                                         │
│  Week 6: 文件夹健康度                                                   │
│    ├── 实现 evaluateFolderHealth()                                     │
│    ├── 创建健康度仪表盘 UI                                              │
│    └── 集成到分类建议系统                                               │
│                                                                         │
│  Phase 3: 知识聚类 (2 周)                                               │
│  ════════════════════════════════════════════════════════════════════  │
│  Week 7: 聚类算法                                                       │
│    ├── 实现 performClustering()                                        │
│    ├── 自动发现隐藏主题                                                 │
│    └── 聚类命名生成                                                     │
│                                                                         │
│  Week 8: 聚类 UI & 交互                                                 │
│    ├── 聚类浏览页面                                                     │
│    ├── 一键创建文件夹                                                   │
│    └── 聚类合并/拆分操作                                                │
│                                                                         │
│  Phase 4: 知识图谱 (3-4 周)                                             │
│  ════════════════════════════════════════════════════════════════════  │
│  Week 9-10: 图谱生成                                                    │
│    ├── 实现 generateKnowledgeGraph() API                               │
│    ├── 图数据结构优化                                                   │
│    └── 图布局算法                                                       │
│                                                                         │
│  Week 11-12: 图谱可视化                                                 │
│    ├── ReactFlow/D3.js 集成                                            │
│    ├── 交互式探索（点击、缩放、筛选）                                   │
│    ├── 节点详情面板                                                     │
│    └── 学习路径发现                                                     │
│                                                                         │
│  Phase 5: 高级功能 (持续迭代)                                           │
│  ════════════════════════════════════════════════════════════════════  │
│    ├── 知识问答（GraphRAG）                                            │
│    ├── 学习计划生成                                                     │
│    ├── 知识缺口分析                                                     │
│    └── 跨用户知识共享                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 详细里程碑

| 阶段        | 里程碑       | 交付物                 | 预计时间 |
| ----------- | ------------ | ---------------------- | -------- |
| **Phase 1** | 数据模型就绪 | 数据库迁移文件         | Week 2   |
|             | 实体抽取上线 | extractEntities() API  | Week 3   |
| **Phase 2** | 关系推断上线 | inferEntityRelations() | Week 5   |
|             | 文件夹健康度 | 健康度仪表盘           | Week 6   |
| **Phase 3** | 智能聚类上线 | 聚类浏览页面           | Week 8   |
| **Phase 4** | 知识图谱 MVP | 可视化组件             | Week 12  |
| **Phase 5** | GraphRAG     | 知识问答功能           | 持续     |

### 4.3 技术选型建议

| 功能         | 推荐方案            | 备选方案      | 理由                   |
| ------------ | ------------------- | ------------- | ---------------------- |
| **向量存储** | pgvector (已有)     | -             | 已集成，性能足够       |
| **图可视化** | ReactFlow           | D3.js, vis.js | React 生态，声明式 API |
| **聚类算法** | HDBSCAN (JS)        | K-means       | 自动确定聚类数         |
| **实体抽取** | DeepSeek (已有)     | GPT-4, Claude | 成本低，中文优化       |
| **图数据库** | PostgreSQL + 自定义 | Neo4j         | 避免增加复杂度         |

---

## 五、关键收益

### 5.1 用户价值

| 功能           | 用户价值                           |
| -------------- | ---------------------------------- |
| **智能分类**   | 不再需要手动整理，AI 自动分类      |
| **知识关联**   | 发现"原来这两篇文章是相关的"       |
| **学习路径**   | "从入门到精通 React"的阅读顺序     |
| **知识缺口**   | "你了解 React，但缺少状态管理知识" |
| **健康度监控** | "这个文件夹太杂了，建议拆分"       |

### 5.2 商业价值

| 维度         | 价值                            |
| ------------ | ------------------------------- |
| **差异化**   | 从书签工具升级为知识管理平台    |
| **留存率**   | 知识积累越多，用户越难离开      |
| **付费点**   | 高级知识图谱功能可作为 Pro 特性 |
| **数据壁垒** | 个人知识图谱是独特资产          |

---

## 六、风险与缓解

| 风险                   | 可能性 | 影响 | 缓解措施                |
| ---------------------- | ------ | ---- | ----------------------- |
| **实体抽取质量不稳定** | 中     | 高   | 人工校验 + 用户反馈机制 |
| **图谱可视化性能**     | 中     | 中   | 限制节点数 + 分层加载   |
| **存储成本增加**       | 低     | 中   | 定期清理 + 压缩存储     |
| **用户理解成本**       | 高     | 中   | 渐进式引导 + 简化 UI    |

---

## 七、决策点（需要您确认）

### 7.1 优先级确认

请确认以下功能的优先级排序：

- [ ] A. 先做实体抽取和关系推断（基础）
- [ ] B. 先做文件夹健康度（实用）
- [ ] C. 先做知识图谱可视化（酷炫）

**建议**: A → B → C（由基础到上层）

### 7.2 技术选型确认

- [ ] 图可视化使用 ReactFlow 还是 D3.js？
- [ ] 是否需要独立的图数据库（Neo4j）？
- [ ] 实体抽取是否需要支持自定义类型？

### 7.3 产品策略确认

- [ ] 知识图谱功能是否作为 Pro 特性？
- [ ] 是否需要支持导出知识图谱数据？
- [ ] 是否需要多用户知识共享功能？

---

**文档状态**: 待审核
**下一步**: 请审核以上方案，确认优先级和技术选型后开始实施

---

## 参考资源

### 技术参考

- [Neo4j: Knowledge Graph Extraction](https://neo4j.com/blog/developer/knowledge-graph-extraction-challenges/)
- [AI-Enhanced Personal Knowledge Graphs](https://aicompetence.org/ai-enhanced-personal-knowledge-graphs/)
- [pgvector Tutorial](https://www.datacamp.com/tutorial/pgvector-tutorial)
- [Building Knowledge Graphs in 2025](https://www.pageon.ai/blog/knowledge-graph)

### 工具参考

- [ReactFlow](https://reactflow.dev/) - React 图可视化
- [KGGen](https://arxiv.org/html/2502.09956v1) - LLM 知识图谱抽取
- [Neo4j LLM Graph Builder](https://neo4j.com/developer/genai-ecosystem/importing-graph-from-unstructured-data/)
