# AnyKeep 智能分类系统 v5.0 完整设计文档（合并版）

> **版本**: 5.0.0  
> **日期**: 2026-01-16  
> **作者**: AnyKeep 架构团队 + BMAD  
> **状态**: 设计完成，已更新（补充新路线图内容）  
> **文档来源**: 
> 
> - BMAD 架构文档: `_bmad-output/architecture-classification-v5.md`
> - 产品设计文档: `docs/specs/smart-classification-v5-design.md`
> - 新路线图: `智能分类 v5.0 架构重构路线图0116.md`
> 
> **更新说明 (v1.1.0)**:
> 
> - ✅ 补充 T0/T1 两阶段向量生成设计
> - ✅ 补充 L0 规则层（最高优先级）
> - ✅ 修正索引类型：IVFFlat → HNSW
> - ✅ 统一阈值参数：Similarity Threshold = 0.82
> - ✅ 补充 Optimistic UI 设计
> - ✅ 补充文件夹生命周期阶段定义（A/B/C）
> - ✅ 补充 Context Boost 数值（+0.15）
> - ✅ 补充同义词查重功能

---

## 目录

### Part 1: 架构设计（基于 BMAD 文档）

1. [设计概述](#part-1-架构设计)
2. [设计概述](#part-1-架构设计)
3. [核心算法原理](#二核心算法原理)
4. [系统架构设计](#三系统架构设计)
5. [Module A: Folder Profiler](#module-a-folder-profiler)
6. [Module B: Classification Pipeline](#module-b-classification-pipeline)
7. [Module C: The Gardener](#module-c-the-gardener)
8. [反馈闭环机制](#反馈闭环机制)

### Part 2: 差异化功能（基于产品设计文档）

8. [Module D: Shadow Sorting（影子分拣）](#module-d-shadow-sorting影子分拣)
9. [Module E: Context Anchor（多维意图锚点）](#module-e-context-anchor多维意图锚点)
10. [Module F: Entropy Reduction（熵减治理）](#module-f-entropy-reduction熵减治理)
11. [Module G: Chat-to-Rule（自然语言调教）](#module-g-chat-to-rule自然语言调教)

### Part 3: 工程化实践（基于 BMAD 文档）

12. [数据库 Schema](#数据库-schema)
13. [API 设计](#api-设计)
14. [监控与可观测性](#监控与可观测性)
15. [测试策略](#测试策略)
16. [迁移策略](#迁移策略)

### Part 4: 竞品分析与技术选型（基于产品设计文档）

17. [竞品技术借鉴](#竞品技术借鉴)
18. [技术选型建议](#技术选型建议)
19. [风险与应对](#风险与应对)

---

# Part 1: 架构设计

## 一、设计概述

### 1.1 核心理念

**文件夹即语义聚类 (Folder as a Semantic Cluster)**

v5.0 将文件夹从简单的路径字符串升级为高维空间中的**聚类中心 (Centroid)**，让 AI 真正"读懂"每个文件夹的语义重心。

### 1.2 项目背景

AnyKeep 当前的智能分类系统 (V4.1) 已实现 92%+ 准确率，但存在以下局限：

| 局限性     | 影响            | v5.0 解决方案       |
| ------- | ------------- | --------------- |
| 单一向量空间  | 无法区分语义 vs 关键词 | 双源语义加权          |
| 固定文件夹边界 | 无法感知文件夹"性格"   | 动态 Profile 计算   |
| 被动式分类   | 仅在收藏时触发       | 主动式 Gardener 系统 |
| 固定阈值    | 不适应不同用户习惯     | 自适应阈值机制         |

### 1.3 设计目标

| 指标            | V4.1 现状   | v5.0 目标 | 提升   |
| ------------- | --------- | ------- | ---- |
| **分类准确率**     | 92%       | 96%+    | +4%  |
| **冷启动延迟**     | 150-200ms | <100ms  | 2x   |
| **LLM 调用成本**  | $0.05/次   | $0.02/次 | -60% |
| **新文件夹建议准确率** | 70%       | 90%+    | +20% |
| **用户接受率**     | 75%       | 85%+    | +10% |
| **用户满意度**     | 4.0/5.0   | 4.5/5.0 | +0.5 |

### 1.4 与现有系统的关系

**当前系统 (V4.1)**:

- ✅ `SimpleClassificationService` - 统一向量搜索
- ✅ `folder_profiles` 表 - 已有基础画像
- ✅ `name_embedding` + `profile_embedding` - 冷启动支持

**v5.0 升级点**:

- 🆕 增强文件夹画像算法（显性+隐性语义融合 + 动态 α 系数）
- 🆕 混合检索服务（向量+规则+上下文）
- 🆕 条件 LLM 调用策略（节省 60%+ 成本）
- 🆕 自适应 Gardener 阈值（根据用户习惯调整）
- 🆕 影子分拣机制（Inbox Zero 模式）
- 🆕 多维意图锚点（浏览器上下文感知）
- 🆕 熵减治理层（主动文件夹重构建议）
- 🆕 自然语言调教（Chat-to-Rule）

---

## 二、核心算法原理

### 2.1 文件夹特征向量化

#### 公式定义

$$V_{folder} = \alpha \cdot \text{Embed}(Name) + (1-\alpha) \cdot \text{Average}(\sum \text{Embed}(Bookmarks_{lastN}))$$

**参数说明**:

- $\alpha$: 动态系数（0-1），根据文件夹状态自动调整
- $N = 20$: 最近 N 个书签用于计算平均向量

#### 动态 α 系数算法（Decision 1）

```typescript
/**
 * 根据文件夹状态动态计算 α 系数
 *
 * α 越大 → 越依赖文件夹名称 (显性语义)
 * α 越小 → 越依赖书签内容 (隐性语义)
 */
const computeDynamicAlpha = (
  folder: Folder,
  bookmarks: Bookmark[]
): number => {
  const bookmarkCount = bookmarks.length;

  // 场景 1: 空文件夹 → 100% 依赖名称
  if (bookmarkCount === 0) {
    return 1.0;
  }

  // 场景 2: 杂物堆文件夹 (is_generic 标记)
  if (folder.isGeneric) {
    return 0.8;  // 80% 名称，20% 内容
  }

  // 场景 3: 内容分散 (内聚性低)
  const internalSimilarity = computeInternalSimilarity(bookmarks);
  if (internalSimilarity < 0.5) {
    return 0.6;  // 60% 名称
  }

  // 场景 4: 成熟稳定文件夹（≥ 5 篇，与新路线图一致）
  if (bookmarkCount >= 5 && internalSimilarity >= 0.7) {
    return 0.2;  // 20% 名称，80% 内容
  }

  // 默认: 平衡
  return 0.3;
};

/**
 * 计算书签集合的内聚性 (Internal Similarity)
 * 使用 pairwise cosine similarity 的平均值
 */
const computeInternalSimilarity = (bookmarks: Bookmark[]): number => {
  if (bookmarks.length < 2) return 1.0;

  let totalSim = 0;
  let count = 0;

  for (let i = 0; i < bookmarks.length; i++) {
    for (let j = i + 1; j < bookmarks.length; j++) {
      totalSim += cosineSimilarity(
        bookmarks[i].embedding,
        bookmarks[j].embedding
      );
      count++;
    }
  }

  return totalSim / count;
};
```

### 2.2 书签向量生成（T0/T1 两阶段）

#### T0/T1 两阶段设计

**设计目标**: 平衡性能与精度，支持 Optimistic UI

**T0 阶段（快速生成）**:

- 用途：Optimistic UI 立即显示
- 输入：`URL + Title`
- 延迟：< 50ms
- 精度：中等（用于初筛）

**T1 阶段（异步精确处理）**:

- 用途：后台精确计算，修正分类结果
- 输入：加权融合（Title 40% + Summary 30% + Keywords 20% + Vision 10%）
- 延迟：200-500ms（异步）
- 精度：高（用于最终分类）

#### 公式定义

$$V_{bookmark\_T0} = \text{Embed}(URL + Title)$$

$$V_{bookmark\_T1} = \text{Norm}(0.4 \cdot V_{title} + 0.3 \cdot V_{summary} + 0.2 \cdot V_{keywords} + 0.1 \cdot V_{vision})$$

**参数说明**:

- $V_{vision}$: 仅当页面包含显著 `og:image` 时启用
- $\text{Norm}$: L2 归一化

#### 实现代码

```typescript
/**
 * T0 阶段：快速生成（用于 Optimistic UI）
 */
const generateT0Embedding = async (
  url: string,
  title: string
): Promise<number[]> => {
  return await generateEmbedding(`${url} ${title}`);
};

/**
 * T1 阶段：异步精确生成（后台处理）
 */
const generateT1Embedding = async (
  bookmark: BookmarkInput
): Promise<number[]> => {
  const weights = {
    title: 0.4,
    summary: 0.3,
    keywords: 0.2,
    vision: 0.1,  // 仅当有 og:image 时
  };

  const titleEmbedding = await generateEmbedding(bookmark.title);
  const summaryEmbedding = bookmark.summary 
    ? await generateEmbedding(bookmark.summary)
    : new Array(1024).fill(0);
  const keywordsEmbedding = bookmark.tags?.length > 0
    ? await generateEmbedding(bookmark.tags.join(', '))
    : new Array(1024).fill(0);

  let visionEmbedding = new Array(1024).fill(0);
  if (bookmark.heroImage) {
    const imageDescription = await extractImageDescription(bookmark.heroImage);
    visionEmbedding = await generateEmbedding(imageDescription);
  }

  // 加权融合并归一化
  const fused = weightedAverage([
    { vector: titleEmbedding, weight: weights.title },
    { vector: summaryEmbedding, weight: weights.summary },
    { vector: keywordsEmbedding, weight: weights.keywords },
    { vector: visionEmbedding, weight: weights.vision },
  ]);

  return l2Normalize(fused);
};
```

### 2.3 分类即向量检索

#### 流程设计

```
新书签 → L0 规则匹配 → T0 Embedding 生成 → 向量检索 (KNN) → 候选文件夹 (Top-K) → 混合评分 → 条件 LLM 裁决 → 最终分类
         ↓ (规则匹配成功，直接返回)
      跳过向量检索
```

#### 混合评分机制

```typescript
/**
 * 混合评分精排
 *
 * Hybrid Score = (VectorSim × 0.60) + (UsageFreq × 0.25) + (TagMatch × 0.15) + ContextBoost
 */
const RERANK_WEIGHTS = {
  VECTOR_SIMILARITY: 0.60,
  USAGE_FREQUENCY: 0.25,
  TAG_MATCH: 0.15,
  CONTEXT_BOOST: 0.15  // 上下文匹配加分（最大 +0.15）
};

const rerankCandidates = async (
  candidates: CandidateFolder[],
  input: ClassificationInput
): Promise<RankedCandidate[]> => {
  return candidates.map(candidate => {
    // 1. 向量相似度 (已有)
    const vectorScore = candidate.vectorSimilarity;

    // 2. 使用频率归一化
    const usageScore = normalizeUsageFrequency(candidate.activityScore);

    // 3. 标签匹配增强
    const tagScore = computeTagMatchScore(input.tags, candidate.topTags);

    // 4. 上下文匹配加分（Module E 提供）
    const contextScore = input.context
      ? computeContextMatch(candidate, input.context) * RERANK_WEIGHTS.CONTEXT_BOOST
      : 0;

    // 5. 计算混合分数
    const hybridScore =
      vectorScore * RERANK_WEIGHTS.VECTOR_SIMILARITY +
      usageScore * RERANK_WEIGHTS.USAGE_FREQUENCY +
      tagScore * RERANK_WEIGHTS.TAG_MATCH +
      contextScore;  // 上下文加分

    return {
      ...candidate,
      hybridScore,
      scores: { vectorScore, usageScore, tagScore }
    };
  }).sort((a, b) => b.hybridScore - a.hybridScore);
};
```

---

## 三、系统架构设计

### 3.1 架构全景图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Semantic Classification v5.0                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Module A       │  │  Module B       │  │  Module C       │         │
│  │  Folder         │  │  Classification │  │  The            │         │
│  │  Profiler       │  │  Pipeline       │  │  Gardener       │         │
│  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │         │
│  │  • 双源向量计算   │  │  • Recall 召回   │  │  • 新建文件夹   │           │
│  │  • 动态 α 系数   │  │  • Rerank 精排   │  │  • 自适应阈值   │           │
│  │  • 惰性更新      │  │  • Arbitrate     │  │  • 命名建议     │          │
│  │  • Dirty Flag   │  │    LLM 裁决      │  │  • 位置推荐     │          │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                  │
│  ┌────────┴────────────────────┼────────────────────┴────────┐         │
│  │  Module D: Shadow Sorting  │  Module E: Context Anchor  │          │
│  │  Module F: Entropy Reduction│  Module G: Chat-to-Rule    │          │
│  └─────────────────────────────┼────────────────────────────┘          │
│                                │                                       │
│  ┌─────────────────────────────▼─────────────────────────────────────┐ │
│  │                    Unified Classification API                     │ │
│  │                    POST /api/classification/v5                    │ │
│  └─────────────────────────────┬─────────────────────────────────────┘ │
│                                │                                       │
├────────────────────────────────┼───────────────────────────────────────┤
│                                │                                       │
│  ┌─────────────────────────────▼─────────────────────────────────────┐ │
│  │                         Data Layer                                │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │  │ folder_     │  │ bookmarks   │  │ classifica- │                │ │
│  │  │ profiles_v5 │  │ (embedding) │  │ tion_logs   │                │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流程图

```
新书签到来
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 0: L0 规则匹配（最高优先级）                                  │
│ • DomainRules: github.com → Dev/Code                            │
│ • 规则匹配成功 → 直接返回，跳过向量检索                               │
└─────────────────────────────────────────────────────────────────┘
    │ (规则未匹配)
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: T0 Embedding Generation（快速生成）                      │
│ V_T0 = Embed(URL + Title)                                       │
│ • 延迟: < 50ms                                                   │
│ • 用途: Optimistic UI 立即显示                                    │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼ (如果启用 Optimistic UI)
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1.5: 立即返回 T0 结果                                       │
│ • UI 立即显示分类结果                                              │
│ • 后台异步启动 T1 精确处理                                          │
└─────────────────────────────────────────────────────────────────┘
    │ (继续 T1 处理)
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: T1 Embedding Generation（异步精确处理）                   │
│ V_T1 = Norm(0.4·V_title + 0.3·V_summary + 0.2·V_keywords + 0.1·V_vision) │
│ • 延迟: 200-500ms（异步）                                       │
│ • 用途: 精确分类，修正 T0 结果                                   │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: Recall (Module B - Classification Pipeline)            │
│ • pgvector HNSW KNN: SELECT * FROM folder_profiles_v5          │
│   ORDER BY semantic_vector <=> V_T1 LIMIT 5                     │
│ • 返回 Top 5 候选文件夹                                          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: Rerank (Hybrid Scoring)                                │
│ Score = (VectorSim × 0.6) + (UsageFreq × 0.25) + (TagMatch × 0.15) │
│ • 标签增强: 匹配 top_tags +5~15 分                               │
│ • 用户习惯: 最近使用文件夹 +10 分                                │
│ • 上下文匹配: Module E 提供场景推断分数                          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 4: Decision Routing                                       │
│                                                                 │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│ │ Score ≥ 85%     │  │ Score 60-84%    │  │ Score < 阈值    │  │
│ │ ───────────────│  │ ───────────────│  │ ───────────────│  │
│ │ 直接分类        │  │ 条件 LLM 裁决   │  │ Gardener 介入   │  │
│ │ (跳过 LLM)      │  │ (仅分数接近时)  │  │ (新建文件夹)    │  │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 5: Shadow Sorting (可选)                                   │
│ • 如果启用影子分拣，建议路径但不移动                                  │
│ • 用户审核后一键归位                                               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 6: Feedback Loop                                          │
│ • 用户接受 → 强化 folder profile                                  │
│ • 用户修改 → 负反馈，更新 profile + 记录 classification_logs        │
│ • 用户规则 → Module G 提取并应用规则                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module A: Folder Profiler（文件夹画像引擎）

### 文件夹生命周期阶段

文件夹向量计算根据**生命周期阶段**采用不同策略：

| 阶段             | 条件      | 策略              | 公式                                                         |
| -------------- | ------- | --------------- | ---------------------------------------------------------- |
| **阶段 A (冷启动)** | 空文件夹    | 100% 依赖名称       | $V = \text{Embed}(Name + Description)$                     |
| **阶段 B (成长期)** | < 5 篇书签 | 名称 70% + 内容 30% | $V = 0.7 \cdot V_{name} + 0.3 \cdot \text{Avg}(Bookmarks)$ |
| **阶段 C (成熟期)** | ≥ 5 篇书签 | 滑动窗口平均          | $V = \text{SlidingWindowAvg}(Last\_20\_Bookmarks)$         |

### 核心算法

**双源语义向量计算（生命周期感知）**：

```typescript
/**
 * 文件夹生命周期阶段
 */
enum FolderLifecycleStage {
  COLD_START = 'A',      // 冷启动：空文件夹
  GROWING = 'B',         // 成长期：< 5 篇
  MATURE = 'C'           // 成熟期：≥ 5 篇
}

/**
 * 计算文件夹的语义向量
 * 根据生命周期阶段采用不同策略
 */
interface FolderSemanticVector {
  folderId: number;
  semanticVector: number[];      // 1024 维
  alpha: number;                  // 动态系数
  stage: FolderLifecycleStage;   // 生命周期阶段
  computedAt: Date;
}

const computeFolderVector = async (
  folder: Folder,
  recentBookmarks: Bookmark[]
): Promise<FolderSemanticVector> => {
  const bookmarkCount = recentBookmarks.length;
  const stage = determineLifecycleStage(bookmarkCount, folder);

  switch (stage) {
    case FolderLifecycleStage.COLD_START:
      // 阶段 A: V = Embed(Name + Description)
      const nameVector = await generateEmbedding(
        `${folder.name} ${folder.description || ''}`
      );
      return {
        folderId: folder.id,
        semanticVector: nameVector,
        alpha: 1.0,
        stage,
        computedAt: new Date()
      };

    case FolderLifecycleStage.GROWING:
      // 阶段 B: V = 0.7 · V_name + 0.3 · Avg(Bookmarks)
      const nameVec = await generateEmbedding(folder.name);
      const contentVec = bookmarkCount > 0
        ? meanPooling(recentBookmarks.map(b => b.embedding))
        : new Array(1024).fill(0);
      return {
        folderId: folder.id,
        semanticVector: weightedSum(nameVec, contentVec, 0.7),
        alpha: 0.7,
        stage,
        computedAt: new Date()
      };

    case FolderLifecycleStage.MATURE:
      // 阶段 C: V = SlidingWindowAvg(Last_20_Bookmarks)
      const last20 = recentBookmarks.slice(0, 20);
      const slidingAvg = slidingWindowAverage(
        last20.map(b => b.embedding)
      );
      return {
        folderId: folder.id,
        semanticVector: slidingAvg,
        alpha: 0.2,  // 成熟期主要依赖内容
        stage,
        computedAt: new Date()
      };
  }
};

/**
 * 滑动窗口平均（用于成熟期）
 */
const slidingWindowAverage = (embeddings: number[][]): number[] => {
  if (embeddings.length === 0) return new Array(1024).fill(0);

  // 简单平均（可扩展为加权平均，最近的书签权重更高）
  return meanPooling(embeddings);
};

/**
 * 确定文件夹生命周期阶段
 */
const determineLifecycleStage = (
  bookmarkCount: number,
  folder: Folder
): FolderLifecycleStage => {
  if (bookmarkCount === 0) {
    return FolderLifecycleStage.COLD_START;
  }
  if (bookmarkCount < 5) {
    return FolderLifecycleStage.GROWING;
  }
  return FolderLifecycleStage.MATURE;
};
```

### 惰性更新机制

```typescript
/**
 * 惰性更新策略
 *
 * 触发条件 (满足任一):
 * 1. 文件夹内书签变动 >= CHANGE_THRESHOLD 次
 * 2. 距离上次更新 >= UPDATE_INTERVAL_HOURS 小时
 * 3. 用户手动触发重新计算
 */
const LAZY_UPDATE_CONFIG = {
  CHANGE_THRESHOLD: 5,           // 变动次数阈值
  UPDATE_INTERVAL_HOURS: 1,      // 最大更新间隔
  SAMPLE_SIZE: 20,               // 取最近 N 个书签
};

/**
 * 标记文件夹为 Dirty
 * 在书签 INSERT/UPDATE/DELETE 时调用
 */
const markFolderDirty = async (folderId: number): Promise<void> => {
  await supabase.rpc('increment_folder_dirty_count', {
    p_folder_id: folderId
  });
};

/**
 * 后台 Job: 处理 Dirty 文件夹
 * 建议使用 Supabase pg_cron 或 Edge Function 定时触发
 */
const processDirtyFolders = async (userId: string): Promise<void> => {
  // 1. 查询需要更新的文件夹
  const dirtyFolders = await supabase
    .from('folder_profiles_v5')
    .select('*')
    .eq('user_id', userId)
    .or(`change_count.gte.${LAZY_UPDATE_CONFIG.CHANGE_THRESHOLD},last_updated.lt.${oneHourAgo()}`);

  // 2. 批量重算向量
  for (const folder of dirtyFolders.data ?? []) {
    await recomputeFolderProfile(folder.folder_id);
  }
};
```

---

## Module B: Classification Pipeline（分类流水线）

### 三阶段流水线

```typescript
/**
 * 分类流水线主入口
 */
interface ClassificationInput {
  title: string;
  summary: string | null;
  tags: string[];
  url: string;
  userId: string;
  context?: ClassificationContext;  // Module E 提供
}

const classifyBookmarkV5 = async (
  input: ClassificationInput
): Promise<ClassificationOutput> => {
  const startTime = Date.now();

  // Stage 1: Embedding
  const embedding = await generateEmbedding(
    `${input.title}。${input.summary ?? ''}。${input.tags.join(',')}`
  );

  // Stage 2: Recall (召回)
  const candidates = await recallCandidates(input.userId, embedding);

  // Stage 3: Rerank (精排)
  const rankedCandidates = await rerankCandidates(candidates, input);

  // Stage 4: Decision Routing
  const result = await routeDecision(rankedCandidates, input);

  return {
    ...result,
    candidates: rankedCandidates,
    executionTime: Date.now() - startTime
  };
};
```

### 条件 LLM 调用策略（Decision 2）

```typescript
/**
 * 条件 LLM 调用策略
 *
 * 仅在必要时调用 LLM，预计降低 60%+ 调用成本
 */
const DECISION_THRESHOLDS = {
  SIMILARITY_THRESHOLD: 0.82,  // 基础相似度阈值（与新路线图一致）
  AUTO_CLASSIFY: 0.85,         // ≥85% 高置信度，直接分类（跳过 LLM）
  LLM_ARBITRATE_GAP: 0.10,     // Top1-Top2 差距 <10% 时调用 LLM
  GARDENER_BASE: 0.70          // 基础 Gardener 阈值
};

const routeDecision = async (
  candidates: RankedCandidate[],
  input: ClassificationInput
): Promise<DecisionResult> => {
  const top1 = candidates[0];
  const top2 = candidates[1];

  // 获取自适应 Gardener 阈值
  const gardenerThreshold = await getAdaptiveGardenerThreshold(input.userId);

  // Case 1: 高置信度 → 直接分类 (跳过 LLM)
  if (top1.hybridScore >= DECISION_THRESHOLDS.AUTO_CLASSIFY) {
    return {
      action: 'classify',
      folderId: top1.folderId,
      folderName: top1.folderName,
      confidence: Math.round(top1.hybridScore * 100),
      reason: `高置信度匹配 (${Math.round(top1.hybridScore * 100)}%)`
    };
  }

  // Case 2: 分数接近 → LLM 裁决
  if (top2 && (top1.hybridScore - top2.hybridScore) < DECISION_THRESHOLDS.LLM_ARBITRATE_GAP) {
    const llmResult = await llmArbitrate(candidates.slice(0, 3), input);
    return {
      action: 'classify',
      folderId: llmResult.folderId,
      folderName: llmResult.folderName,
      confidence: llmResult.confidence,
      reason: `LLM 裁决: ${llmResult.reason}`
    };
  }

  // Case 3: 低于相似度阈值 → 新建文件夹
  if (top1.hybridScore < DECISION_THRESHOLDS.SIMILARITY_THRESHOLD) {
    return {
      action: 'gardener',
      folderId: null,
      folderName: null,
      confidence: Math.round(top1.hybridScore * 100),
      reason: `最佳匹配 (${Math.round(top1.hybridScore * 100)}%) 低于阈值 (${Math.round(DECISION_THRESHOLDS.SIMILARITY_THRESHOLD * 100)}%)`
    };
  }

  // Case 3.5: 低于 Gardener 阈值但高于相似度阈值 → 建议确认
  if (top1.hybridScore < gardenerThreshold) {
    return {
      action: 'suggest',
      folderId: top1.folderId,
      folderName: top1.folderName,
      confidence: Math.round(top1.hybridScore * 100),
      reason: `建议分类到 "${top1.folderName}"（置信度: ${Math.round(top1.hybridScore * 100)}%）`
    };
  }

  // Case 4: 中等置信度 → 建议确认
  return {
    action: 'suggest',
    folderId: top1.folderId,
    folderName: top1.folderName,
    confidence: Math.round(top1.hybridScore * 100),
    reason: `建议分类到 "${top1.folderName}"（置信度: ${Math.round(top1.hybridScore * 100)}%）`
  };
};
```

---

## Module C: The Gardener（园丁系统）

### 自适应阈值（Decision 3）

```typescript
/**
 * 自适应 Gardener 阈值
 *
 * 根据用户的文件夹数量和使用习惯动态调整阈值
 */
const GARDENER_THRESHOLDS = {
  NEW_USER: 0.55,        // 新用户: 更容易匹配现有文件夹
  NORMAL_USER: 0.70,     // 普通用户: 平衡
  POWER_USER: 0.80       // 整理狂人: 更严格，减少新建
};

const getAdaptiveGardenerThreshold = async (
  userId: string
): Promise<number> => {
  // 1. 获取用户文件夹统计
  const { data: stats } = await supabase
    .from('folders')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .is('deleted_at', null);

  const folderCount = stats?.length ?? 0;

  // 2. 根据文件夹数量选择阈值
  if (folderCount < 5) {
    return GARDENER_THRESHOLDS.NEW_USER;       // 新用户
  }
  if (folderCount < 20) {
    return GARDENER_THRESHOLDS.NORMAL_USER;    // 普通用户
  }
  return GARDENER_THRESHOLDS.POWER_USER;       // 整理狂人
};
```

### 新建文件夹流程

```typescript
/**
 * Gardener 新建文件夹流程
 */
const gardenerSuggestFolder = async (
  input: ClassificationInput,
  candidates: RankedCandidate[]
): Promise<GardenerSuggestion> => {
  // 1. LLM 生成文件夹名称建议
  const nameSuggestion = await llmSuggestFolderName(input);

  // 2. 推荐父文件夹位置
  const parentPath = await suggestParentFolder(input, candidates);

  // 3. 检查是否与现有文件夹重名
  const isNameConflict = await checkNameConflict(
    input.userId,
    nameSuggestion.name
  );

  // 4. 同义词查重（防止创建 /Dev/JS 和 /Dev/JavaScript）
  const hasSynonymConflict = await checkSynonymConflict(
    input.userId,
    nameSuggestion.name
  );

  return {
    suggestedName: isNameConflict
      ? `${nameSuggestion.name} (2)`
      : hasSynonymConflict
      ? await suggestAlternativeName(input.userId, nameSuggestion.name)
      : nameSuggestion.name,
    suggestedPath: parentPath,
    confidence: nameSuggestion.confidence,
    reason: nameSuggestion.reason,
    alternativeNames: nameSuggestion.alternatives
  };
};

/**
 * 同义词查重（防止创建 /Dev/JS 和 /Dev/JavaScript）
 */
const checkSynonymConflict = async (
  userId: string,
  suggestedName: string
): Promise<boolean> => {
  // 获取用户所有文件夹名称
  const { data: folders } = await supabase
    .from('folders')
    .select('name')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (!folders || folders.length === 0) return false;

  // 使用 LLM 判断是否为同义词
  const synonyms = await findSynonyms(suggestedName);

  return folders.some(folder => 
    synonyms.some(syn => 
      folder.name.toLowerCase().includes(syn.toLowerCase()) ||
      syn.toLowerCase().includes(folder.name.toLowerCase())
    )
  );
};

/**
 * 查找同义词（使用 LLM）
 */
const findSynonyms = async (name: string): Promise<string[]> => {
  const prompt = `
分析以下文件夹名称，列出可能的同义词或变体：

名称: "${name}"

例如：
- "JS" 的同义词: ["JavaScript", "Javascript", "前端JS"]
- "React" 的同义词: ["React.js", "ReactJS"]

只返回 JSON 数组，例如: ["synonym1", "synonym2"]
`;

  const response = await callLLM(prompt, { model: 'fast' });
  try {
    return JSON.parse(response);
  } catch {
    return [];
  }
};
```

---

## 反馈闭环机制

### 反馈处理流程

```typescript
/**
 * 用户反馈处理
 */
const processFeedback = async (
  feedback: ClassificationFeedback
): Promise<void> => {
  const { bookmarkId, suggestedFolderId, actualFolderId, feedbackType } = feedback;

  switch (feedbackType) {
    case 'accept':
      // 强化建议的文件夹
      await reinforceFolderProfile(suggestedFolderId, bookmarkId);
      break;

    case 'modify':
      // 这是强负反馈
      // 1. 削弱原建议文件夹
      await weakenFolderProfile(suggestedFolderId, bookmarkId);
      // 2. 强化实际选择的文件夹
      await reinforceFolderProfile(actualFolderId, bookmarkId);
      // 3. 记录失败案例
      await logClassificationFailure(feedback);
      break;

    case 'reject':
      // 用户拒绝所有建议，放入收件箱
      await weakenFolderProfile(suggestedFolderId, bookmarkId);
      break;
  }
};

/**
 * 强化文件夹 Profile
 * 将新书签的向量融入文件夹向量（指数移动平均）
 */
const reinforceFolderProfile = async (
  folderId: number,
  bookmarkId: number
): Promise<void> => {
  const { data: bookmark } = await supabase
    .from('bookmarks')
    .select('embedding')
    .eq('id', bookmarkId)
    .single();

  // 增量更新文件夹向量 (指数移动平均)
  const LEARNING_RATE = 0.1;  // 学习率

  await supabase.rpc('update_folder_profile_incremental', {
    p_folder_id: folderId,
    p_new_embedding: bookmark.embedding,
    p_learning_rate: LEARNING_RATE
  });
};
```

---

# Part 2: 差异化功能设计

## Module D: Shadow Sorting（影子分拣）

### 功能概述

**Inbox Zero 模式**：所有新收藏默认通过 v5.0 算法打上"建议标签"和"建议路径"，但物理上暂时留在 **Inbox (收件箱)**。

### 数据库设计

```sql
-- 扩展 bookmarks 表
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS shadow_folder_id BIGINT REFERENCES folders(id),
ADD COLUMN IF NOT EXISTS shadow_folder_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS shadow_confidence FLOAT,
ADD COLUMN IF NOT EXISTS shadow_suggested_at TIMESTAMPTZ;

-- 索引
CREATE INDEX idx_bookmarks_shadow_folder ON bookmarks(shadow_folder_id)
WHERE shadow_folder_id IS NOT NULL;
```

### UI 设计

```typescript
// 文件: src/components/classification/shadow-sorting-card.tsx

export function ShadowSortingCard({
  bookmark,
  shadowFolder,
  onConfirm,
  onReject,
}: ShadowSortingCardProps) {
  return (
    <Card className="border-dashed border-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Ghost className="h-4 w-4 opacity-50" />
          <span className="text-sm text-muted-foreground">
            建议放入: {shadowFolder.name}
          </span>
          <Badge variant="outline">
            {Math.round(shadowFolder.confidence)}% 置信度
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm}>
            确认归位
          </Button>
          <Button size="sm" variant="outline" onClick={onReject}>
            重新分类
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 批量归位功能

```typescript
class ShadowSortingService {
  /**
   * 批量确认归位
   */
  async batchConfirm(
    userId: string,
    bookmarkIds: number[]
  ): Promise<void> {
    // 获取所有待归位书签
    const { data: bookmarks } = await this.supabase
      .from('bookmarks')
      .select('id, shadow_folder_id')
      .eq('user_id', userId)
      .in('id', bookmarkIds)
      .not('shadow_folder_id', 'is', null);

    // 批量移动
    await Promise.all(
      bookmarks.map(b => 
        this.supabase
          .from('bookmarks')
          .update({ 
            folder_id: b.shadow_folder_id,
            shadow_folder_id: null,
            shadow_folder_name: null,
            shadow_confidence: null,
          })
          .eq('id', b.id)
      )
    );
  }
}
```

---

## Module E: Context Anchor（多维意图锚点）

### 上下文捕获

```typescript
interface ClassificationContext {
  // 浏览器上下文
  browserContext?: {
    openTabs: string[];  // 当前打开的 Tab URL
    tabGroup?: string;    // Tab 组名称
    activeTab: string;   // 当前活动 Tab
  };

  // 时间锚点
  timeAnchor?: {
    hour: number;        // 0-23
    dayOfWeek: number;  // 0-6
    isWeekend: boolean;
  };

  // 设备锚点
  deviceAnchor?: {
    platform: 'desktop' | 'mobile' | 'tablet';
    userAgent: string;
  };

  // 场景推断
  inferredScene?: 'work' | 'study' | 'entertainment' | 'read_later';
}

class ContextAnchor {
  /**
   * 推断场景
   */
  inferScene(context: ClassificationContext): string {
    // 规则 1: 工作日 + 桌面端 → Work
    if (context.timeAnchor && !context.timeAnchor.isWeekend) {
      if (context.deviceAnchor?.platform === 'desktop') {
        return 'work';
      }
    }

    // 规则 2: 深夜 + 手机端 → Read Later
    if (context.timeAnchor && context.timeAnchor.hour >= 22) {
      if (context.deviceAnchor?.platform === 'mobile') {
        return 'read_later';
      }
    }

    // 规则 3: 浏览器 Tab 组分析
    if (context.browserContext?.openTabs) {
      const tabs = context.browserContext.openTabs;
      if (tabs.some(url => url.includes('github.com'))) {
        return 'work';
      }
      if (tabs.some(url => url.includes('bilibili.com'))) {
        return 'entertainment';
      }
    }

    return 'default';
  }

  /**
   * 计算上下文匹配度
   */
  computeContextMatch(
    folder: FolderProfile,
    context: ClassificationContext
  ): number {
    const scene = this.inferScene(context);

    // 如果文件夹标签包含场景关键词，加分
    if (folder.keywords.includes(scene)) {
      return 0.8;
    }

    // 如果文件夹名称包含场景关键词，加分
    if (folder.name.toLowerCase().includes(scene)) {
      return 0.6;
    }

    return 0.3; // 默认匹配度
  }
}
```

---

## Module F: Entropy Reduction（熵减治理）

### 熵值计算

```typescript
class EntropyReductionService {
  /**
   * 计算文件夹熵值
   */
  async computeEntropy(folderId: number): Promise<number> {
    // 获取文件夹内所有书签的向量
    const { data: bookmarks } = await this.supabase
      .from('bookmarks')
      .select('embedding')
      .eq('folder_id', folderId)
      .not('embedding', 'is', null);

    if (bookmarks.length < 10) {
      return 0; // 书签太少，熵值无意义
    }

    // 计算向量方差（熵值指标）
    const embeddings = bookmarks.map(b => b.embedding);
    const centroid = this.computeCentroid(embeddings);
    const variance = this.computeVariance(embeddings, centroid);

    // 归一化到 0-1
    return Math.min(1, variance / 0.5);
  }

  /**
   * 智能分裂建议
   */
  async suggestSplit(folderId: number): Promise<SplitSuggestion> {
    // 使用 K-means 聚类分析文件夹内容
    const clusters = await this.clusterBookmarks(folderId, k: 3);

    // 为每个聚类生成文件夹名称
    const suggestions = await Promise.all(
      clusters.map(async (cluster, index) => {
        const name = await this.generateClusterName(cluster);
        return {
          name,
          percentage: cluster.bookmarks.length / totalBookmarks,
          sampleTitles: cluster.bookmarks.slice(0, 3).map(b => b.title),
        };
      })
    );

    return {
      originalFolderId: folderId,
      originalFolderName: folder.name,
      suggestions,
    };
  }
}
```

### UI 组件

```typescript
export function EntropyAlert({ folderId }: { folderId: number }) {
  const { data: suggestion } = useSplitSuggestion(folderId);

  if (!suggestion) return null;

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>文件夹整理建议</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          "{suggestion.originalFolderName}" 文件夹内容较杂，建议拆分为：
        </p>
        <ul className="list-disc list-inside space-y-1">
          {suggestion.suggestions.map((s, i) => (
            <li key={i}>
              {s.name} ({Math.round(s.percentage * 100)}%)
            </li>
          ))}
        </ul>
        <Button className="mt-2" onClick={() => executeSplit(suggestion)}>
          一键执行拆分
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

---

## Module G: Chat-to-Rule（自然语言调教）

### 规则提取

```typescript
class ChatToRuleService {
  /**
   * 从用户输入提取规则
   */
  async extractRule(
    userId: string,
    userInput: string,
    correctionContext: {
      fromFolder: string;
      toFolder: string;
      bookmark: BookmarkInput;
    }
  ): Promise<UserRule | null> {
    const prompt = `
用户手动修正了分类：
- 从: ${correctionContext.fromFolder}
- 到: ${correctionContext.toFolder}
- 书签: ${correctionContext.bookmark.title}

用户说: "${userInput}"

请提取一条分类规则（如果用户输入包含规则信息）。

规则格式:
- 正向规则: "所有包含 '{关键词}' 的书签 → {目标文件夹}"
- 负向规则: "所有包含 '{关键词}' 的书签 → 不要放入 {目标文件夹}"

如果无法提取规则，返回 null。
`;

    const response = await this.llm.generate(prompt);
    return this.parseRule(response, userId, correctionContext);
  }

  /**
   * 应用用户规则
   */
  async applyRule(
    bookmark: BookmarkInput,
    userId: string
  ): Promise<number | null> {
    // 获取用户所有规则（按优先级排序）
    const { data: rules } = await this.supabase
      .from('user_classification_rules')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: false });

    // 匹配规则
    for (const rule of rules) {
      if (this.matchRule(rule, bookmark)) {
        // 找到匹配的文件夹
        const folder = await this.findFolderByName(
          userId,
          rule.targetFolder
        );
        return folder?.id || null;
      }
    }

    return null;
  }
}
```

### 数据库设计

```sql
-- 用户分类规则表
CREATE TABLE user_classification_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 规则类型
  type VARCHAR(20) NOT NULL, -- 'positive' | 'negative'

  -- 规则模式（支持正则）
  pattern TEXT NOT NULL,

  -- 目标文件夹
  target_folder_name VARCHAR(255) NOT NULL,

  -- 优先级（数值越大越优先）
  priority INT DEFAULT 100,

  -- 元数据
  source_text TEXT, -- 用户原始输入
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_user_rules_user ON user_classification_rules(user_id);
CREATE INDEX idx_user_rules_priority ON user_classification_rules(user_id, priority DESC);

-- RLS
ALTER TABLE user_classification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rules"
  ON user_classification_rules FOR ALL
  USING (auth.uid() = user_id);
```

---

# Part 3: 工程化实践

## 数据库 Schema

### folder_profiles_v5 表

```sql
-- folder_profiles_v5 表 (增强版文件夹画像)
CREATE TABLE folder_profiles_v5 (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  folder_id BIGINT UNIQUE NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

  -- 核心向量
  semantic_vector vector(1024),    -- 融合后的语义向量
  name_vector vector(1024),        -- 文件夹名称向量 (缓存)
  content_vector vector(1024),     -- 内容平均向量 (缓存)

  -- 动态参数
  alpha FLOAT DEFAULT 0.3,         -- 当前 α 系数
  internal_similarity FLOAT,       -- 内聚性分数 [0-1]

  -- 元数据
  bookmark_count INT DEFAULT 0,
  top_tags TEXT[],                 -- 高频标签 Top 10
  sample_titles TEXT[],            -- 样本标题 Top 5

  -- 特殊标记
  is_generic BOOLEAN DEFAULT FALSE, -- 杂物堆文件夹
  is_excluded BOOLEAN DEFAULT FALSE, -- 排除自动分类

  -- 惰性更新
  change_count INT DEFAULT 0,      -- 变动计数器
  last_computed_at TIMESTAMP,      -- 上次计算时间

  -- 活跃度 (用于 Rerank)
  activity_score FLOAT DEFAULT 0,  -- 活跃度权重
  last_used_at TIMESTAMP,          -- 最后使用时间

  -- 审计
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_folder_profiles_v5_user ON folder_profiles_v5(user_id);
CREATE INDEX idx_folder_profiles_v5_vector ON folder_profiles_v5
  USING hnsw (semantic_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_folder_profiles_v5_vector IS
'HNSW 向量索引，支持高并发写入和召回。参数: m=16 (图连接数), ef_construction=64 (构建精度)';
CREATE INDEX idx_folder_profiles_v5_dirty ON folder_profiles_v5(user_id, change_count)
  WHERE change_count > 0;

-- RPC: 向量搜索
CREATE OR REPLACE FUNCTION search_folders_v5(
  p_user_id UUID,
  p_embedding vector(1024),
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  folder_id BIGINT,
  folder_name TEXT,
  similarity FLOAT,
  bookmark_count INT,
  top_tags TEXT[],
  alpha FLOAT,
  activity_score FLOAT,
  is_generic BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.folder_id,
    f.name AS folder_name,
    1 - (fp.semantic_vector <=> p_embedding) AS similarity,
    fp.bookmark_count,
    fp.top_tags,
    fp.alpha,
    fp.activity_score,
    fp.is_generic
  FROM folder_profiles_v5 fp
  JOIN folders f ON f.id = fp.folder_id
  WHERE fp.user_id = p_user_id
    AND fp.is_excluded = FALSE
    AND f.deleted_at IS NULL
  ORDER BY fp.semantic_vector <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Trigger: 书签变动时标记 Dirty
CREATE OR REPLACE FUNCTION on_bookmark_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM increment_folder_dirty_count(OLD.folder_id);
    RETURN OLD;
  ELSE
    PERFORM increment_folder_dirty_count(NEW.folder_id);
    IF TG_OP = 'UPDATE' AND OLD.folder_id != NEW.folder_id THEN
      PERFORM increment_folder_dirty_count(OLD.folder_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookmark_change
AFTER INSERT OR UPDATE OR DELETE ON bookmarks
FOR EACH ROW EXECUTE FUNCTION on_bookmark_change();
```

### classification_logs 表

```sql
-- classification_logs 表 (分类日志)
CREATE TABLE classification_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  bookmark_id BIGINT REFERENCES bookmarks(id),

  -- 输入
  input_title TEXT,
  input_tags TEXT[],
  input_embedding vector(1024),

  -- 建议
  suggested_folder_id BIGINT,
  suggested_confidence INT,

  -- 实际
  actual_folder_id BIGINT,
  feedback_type VARCHAR(20),     -- accept|reject|modify

  -- 分析
  top_candidates JSONB,          -- Top 5 候选详情
  execution_time_ms INT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_classification_logs_user ON classification_logs(user_id);
CREATE INDEX idx_classification_logs_feedback ON classification_logs(feedback_type);
CREATE INDEX idx_classification_logs_date ON classification_logs(created_at);
```

---

## API 设计

### 主入口 API

```typescript
// POST /api/classification/v5

interface ClassifyRequestV5 {
  bookmarkId?: number;           // 已存在的书签 ID
  title: string;
  summary?: string;
  tags?: string[];
  url: string;
  context?: ClassificationContext; // Module E 提供
  autoExecute?: boolean;         // 是否自动执行分类 (默认 false)
  enableShadowSorting?: boolean; // 是否启用影子分拣
  optimistic?: boolean;          // 是否启用 Optimistic UI (默认 false)
}

interface ClassifyResponseV5 {
  success: boolean;
  data: {
    action: 'classify' | 'suggest' | 'gardener' | 'shadow';

    // 分类结果
    folderId: number | null;
    folderName: string | null;
    confidence: number;
    reason: string;

    // T0/T1 结果标记（Optimistic UI）
    isT0Result?: boolean;        // 是否为 T0 快速结果
    t1EventId?: string;          // T1 修正结果的事件 ID（用于 WebSocket 接收）

    // T1 修正结果（异步推送）
    t1Result?: {
      folderId: number | null;
      folderName: string;
      confidence: number;
      corrected: boolean;        // 是否与 T0 结果不同
    };

    // Shadow Sorting 信息 (如果启用)
    shadowInfo?: {
      suggestedFolderId: number;
      suggestedFolderName: string;
      confidence: number;
    };

    // Gardener 建议 (action = 'gardener' 时)
    gardenerSuggestion?: {
      suggestedName: string;
      suggestedPath: string;
      alternativeNames: string[];
    };

    // 候选列表 (用于 UI 展示)
    candidates: Array<{
      folderId: number;
      folderName: string;
      score: number;
      matchReason: string;
    }>;

    // 性能指标
    executionTimeMs: number;
    modelCalls: number;
  };
  error?: string;
}
```

### 反馈 API

```typescript
// POST /api/classification/v5/feedback

interface FeedbackRequest {
  bookmarkId: number;
  suggestedFolderId: number;
  actualFolderId: number;
  feedbackType: 'accept' | 'reject' | 'modify';
  userComment?: string;  // 用于 Module G 提取规则
}

// GET /api/classification/v5/shadow/inbox
// Inbox Zero 仪表盘（影子分拣管理）

interface InboxZeroDashboard {
  totalPending: number;
  pendingBookmarks: Array<{
    id: number;
    title: string;
    url: string;
    suggestedFolder: string;
    confidence: number;
    suggestedAt: string;
  }>;
  quickActions: {
    confirmAll: boolean;  // 是否可一键确认所有
    rejectAll: boolean;  // 是否可一键拒绝所有
  };
}
```

### T1 修正结果推送 API

```typescript
// WebSocket: /api/classification/v5/t1-correction/:eventId
// 用于接收 T1 异步修正结果

interface T1CorrectionEvent {
  eventId: string;
  bookmarkId: number;
  t0Result: {
    folderId: number | null;
    folderName: string;
    confidence: number;
  };
  t1Result: {
    folderId: number | null;
    folderName: string;
    confidence: number;
    corrected: boolean;
  };
  timestamp: string;
}
```

---

## 监控与可观测性

### 关键指标

```typescript
const CLASSIFICATION_V5_METRICS = {
  // 准确率
  accuracy_rate: 'classification_v5_accuracy_rate',

  // 性能
  latency_p50: 'classification_v5_latency_p50',
  latency_p99: 'classification_v5_latency_p99',

  // 成本
  llm_calls_per_classification: 'classification_v5_llm_calls',
  llm_tokens_used: 'classification_v5_tokens',

  // 决策分布
  auto_classify_rate: 'classification_v5_auto_rate',
  suggest_rate: 'classification_v5_suggest_rate',
  gardener_rate: 'classification_v5_gardener_rate',
  shadow_sorting_rate: 'classification_v5_shadow_rate',

  // 反馈
  feedback_accept_rate: 'classification_v5_accept_rate',
  feedback_modify_rate: 'classification_v5_modify_rate',
};
```

### 告警规则

```yaml
alerts:
  - name: classification_v5_accuracy_drop
    condition: accuracy_rate < 90%
    severity: critical
    action: page_oncall

  - name: classification_v5_latency_spike
    condition: latency_p99 > 500ms
    severity: warning
    action: slack_notify

  - name: classification_v5_cost_spike
    condition: llm_calls_per_classification > 2
    severity: warning
    action: slack_notify
```

---

## 测试策略

### 单元测试

```typescript
// __tests__/classification-v5/folder-profiler.test.ts

describe('FolderProfiler', () => {
  describe('computeDynamicAlpha', () => {
    it('should return 1.0 for empty folders', () => {
      const alpha = computeDynamicAlpha(emptyFolder, []);
      expect(alpha).toBe(1.0);
    });

    it('should return 0.8 for generic folders', () => {
      const alpha = computeDynamicAlpha(genericFolder, bookmarks);
      expect(alpha).toBe(0.8);
    });

    it('should return 0.2 for mature stable folders', () => {
      const alpha = computeDynamicAlpha(matureFolder, stableBookmarks);
      expect(alpha).toBe(0.2);
    });
  });
});
```

### 集成测试

```typescript
describe('ClassificationPipeline V5', () => {
  it('should auto-classify high confidence matches', async () => {
    const result = await classifyBookmarkV5({
      title: 'React Hooks 最佳实践',
      tags: ['React', 'Frontend'],
      userId: testUserId
    });

    expect(result.action).toBe('classify');
    expect(result.confidence).toBeGreaterThan(85);
  });

  it('should trigger Gardener for new domains', async () => {
    const result = await classifyBookmarkV5({
      title: '量子计算入门',
      tags: ['Quantum', 'Physics'],
      userId: testUserId
    });

    expect(result.action).toBe('gardener');
    expect(result.gardenerSuggestion).toBeDefined();
  });
});
```

---

## 迁移策略

### 三阶段迁移计划

```
Phase 1: 数据基础设施 (Week 1-2)
├── 创建 folder_profiles_v5 表
├── 迁移现有 folder_profiles 数据
├── 实现初始化脚本 (全量计算)
├── 部署 Trigger (书签变动)
└── 验收: Profile 覆盖率 100%

Phase 2: 混合召回服务 (Week 3-4)
├── 实现 SemanticClassificationService
├── 实现三阶段流水线
├── 实现条件 LLM 调用
├── 实现 Gardener 系统
├── A/B 测试: V4.1 vs V5.0
└── 验收: 准确率 ≥95%, 成本降低 50%+

Phase 3: 差异化功能 (Week 5-7)
├── 实现 Shadow Sorting
├── 实现 Context Anchor
├── 实现 Entropy Reduction
├── 实现 Chat-to-Rule
└── 验收: 4 个功能全部可用

Phase 4: 灰度发布 (Week 8-9)
├── Feature Flag: classification_v5_enabled
├── 10% 种子用户灰度
├── 监控指标仪表盘
├── 反馈收集与优化
├── 逐步扩大灰度比例
└── 验收: 全量发布
```

### Feature Flag 配置

```typescript
export const CLASSIFICATION_V5_FLAGS = {
  // 主开关
  ENABLE_V5: process.env.CLASSIFICATION_V5_ENABLED === 'true',

  // 子功能开关
  ENABLE_DYNAMIC_ALPHA: true,           // 动态 α 系数
  ENABLE_CONDITIONAL_LLM: true,         // 条件 LLM 调用
  ENABLE_ADAPTIVE_GARDENER: true,       // 自适应 Gardener
  ENABLE_LAZY_UPDATE: true,             // 惰性更新
  ENABLE_SHADOW_SORTING: true,          // 影子分拣
  ENABLE_CONTEXT_ANCHOR: true,          // 上下文锚点
  ENABLE_ENTROPY_REDUCTION: true,       // 熵减治理
  ENABLE_CHAT_TO_RULE: true,            // 自然语言调教

  // 阈值配置
  SIMILARITY_THRESHOLD: 0.82,      // 基础相似度阈值（与新路线图一致）
  AUTO_CLASSIFY_THRESHOLD: 0.85,   // 高置信度阈值（跳过 LLM）
  LLM_ARBITRATE_GAP: 0.10,

  // 灰度配置
  ROLLOUT_PERCENTAGE: 10,               // 灰度比例
};
```

---

# Part 4: 竞品分析与技术选型

## 竞品技术借鉴

### 四大流派分析

| 流派        | 代表产品             | 核心特点         | 可借鉴点               |
| --------- | ---------------- | ------------ | ------------------ |
| **零分类**   | Mem, Reflect     | 不分类，依赖搜索     | 搜索优先策略             |
| **第二大脑**  | MyMind, Raindrop | 视觉向量 + 规则自动化 | 多模态 Embedding      |
| **规则自动化** | Notion, Obsidian | 基于规则的自动分类    | L0 规则层             |
| **浏览器伴侣** | Arc, Sidekick    | 空间隔离 + 上下文感知 | Work/Life/Study 模式 |

### 技术选型建议

**"Raindrop 的皮 + MyMind 的骨 + Arc 的魂"** 混合路线：

#### 1. 学 MyMind 的"视觉向量"

```typescript
class MultimodalEmbeddingService {
  /**
   * 生成多模态 Embedding
   */
  async generateMultimodalEmbedding(
    bookmark: BookmarkInput
  ): Promise<number[]> {
    // 1. 文本 Embedding
    const textEmbedding = await this.generateTextEmbedding(
      bookmark.title,
      bookmark.summary
    );

    // 2. 视觉 Embedding（如果有图片）
    if (bookmark.heroImage) {
      const imageDescription = await this.extractImageDescription(
        bookmark.heroImage
      );
      const imageEmbedding = await this.generateTextEmbedding(
        imageDescription
      );

      // 加权融合（文本 70% + 视觉 30%）
      return this.weightedAverage(
        textEmbedding,
        imageEmbedding,
        0.7
      );
    }

    return textEmbedding;
  }
}
```

#### 2. 学 Raindrop 的"确定性"

```typescript
class RuleLayer {
  private domainRules: Map<string, string> = new Map([
    ['github.com', 'Dev/Code'],
    ['stackoverflow.com', 'Dev/Reference'],
    ['bilibili.com', 'Entertainment/Video'],
    // ...
  ]);

  /**
   * L0 规则匹配（最高优先级）
   */
  async matchRule(bookmark: BookmarkInput): Promise<string | null> {
    if (!bookmark.url) return null;

    const domain = new URL(bookmark.url).hostname;
    return this.domainRules.get(domain) || null;
  }
}
```

#### 3. 学 Arc 的"空间隔离"

```typescript
// browser-extension/src/context-mode.ts

class ContextModeManager {
  /**
   * 获取当前模式
   */
  async getCurrentMode(): Promise<ContextMode> {
    const { mode } = await chrome.storage.local.get('contextMode');
    return mode || { mode: 'default', enabled: false };
  }

  /**
   * 设置模式
   */
  async setMode(mode: ContextMode['mode']): Promise<void> {
    await chrome.storage.local.set({
      contextMode: { mode, enabled: true },
    });
  }
}
```

---

## 风险与应对

| 风险                | 可能性 | 影响  | 缓解措施           |
| ----------------- | --- | --- | -------------- |
| **Profile 计算延迟**  | 中   | 中   | 惰性更新 + 后台 Job  |
| **LLM 调用失败**      | 低   | 高   | Fallback 到规则匹配 |
| **向量维度不匹配**       | 低   | 高   | 迁移脚本验证         |
| **杂物堆误判**         | 中   | 低   | 用户可手动覆盖        |
| **Gardener 过度创建** | 中   | 中   | 自适应阈值 + 用户确认   |
| **影子分拣用户困惑**      | 中   | 中   | 清晰的 UI 提示和引导   |
| **上下文捕获失败**       | 中   | 低   | 降级到无上下文模式      |

---

## 总结

### 核心价值

1. **精准**: 动态 α + 混合检索，准确率 > 96%
2. **高效**: 条件 LLM 调用，成本降低 60%+
3. **智能**: 上下文感知 + 主动治理，真正"懂你"
4. **差异化**: 4 个独特功能，形成护城河

### 下一步行动

1. ✅ 技术评审：组织架构团队评审本设计文档
2. ✅ 原型验证：先实现 Phase 1 的核心功能，验证可行性
3. ✅ 分阶段实施：按路线图逐步推进，每阶段完成后进行验收

---

---

## 附录：配置参数汇总

### 关键技术参数（与新路线图对齐）

| **参数项**                  | **设定值**                                                   | **备注**                                        |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------- |
| **Embedding Model**      | `text-embedding-3-small`                                  | 维度: 1024 或 512（可配置）                           |
| **Vector DB**            | PostgreSQL (`pgvector`)                                   | 索引类型: **HNSW** (`m=16`, `ef_construction=64`) |
| **Similarity Threshold** | **0.82**                                                  | 低于此值视为"无匹配"，触发新建建议                            |
| **Context Boost**        | **+0.15**                                                 | 上下文匹配时的加权分                                    |
| **Update Strategy**      | **Lazy (Threshold=5)**                                    | 文件夹变动 5 次后触发重算                                |
| **T0 Embedding**         | `Embed(URL + Title)`                                      | 快速生成，< 50ms                                   |
| **T1 Embedding**         | 加权融合（Title 40% + Summary 30% + Keywords 20% + Vision 10%） | 异步精确处理，200-500ms                              |

### 完整配置代码

```typescript
// src/lib/classification/v5/config.ts

export const CLASSIFICATION_V5_CONFIG = {
  // Profiler
  SAMPLE_SIZE: 20,                    // 取最近 N 个书签
  LAZY_UPDATE_THRESHOLD: 5,           // 变动次数阈值
  UPDATE_INTERVAL_HOURS: 1,           // 最大更新间隔

  // 文件夹生命周期阈值
  GROWING_STAGE_THRESHOLD: 5,         // 成长期阈值（< 5 篇）
  MATURE_STAGE_THRESHOLD: 5,          // 成熟期阈值（≥ 5 篇）

  // Pipeline
  RECALL_LIMIT: 5,                    // 召回 Top-K
  SIMILARITY_THRESHOLD: 0.82,         // 基础相似度阈值（与新路线图一致）
  AUTO_CLASSIFY_THRESHOLD: 0.85,      // 高置信度阈值（跳过 LLM）
  LLM_ARBITRATE_GAP: 0.10,            // Top1-Top2 差距阈值

  // Rerank Weights
  VECTOR_WEIGHT: 0.60,                // 向量相似度权重
  USAGE_WEIGHT: 0.25,                 // 使用频率权重
  TAG_WEIGHT: 0.15,                   // 标签匹配权重
  CONTEXT_BOOST: 0.15,                // 上下文匹配加分

  // T0/T1 Embedding 权重
  T1_WEIGHTS: {
    title: 0.4,
    summary: 0.3,
    keywords: 0.2,
    vision: 0.1,                       // 仅当有 og:image 时
  },

  // Gardener
  NEW_USER_THRESHOLD: 0.55,           // 新用户阈值
  NORMAL_USER_THRESHOLD: 0.70,        // 普通用户阈值
  POWER_USER_THRESHOLD: 0.80,         // 整理狂人阈值

  // Feedback
  LEARNING_RATE: 0.1,                 // 增量学习率
};
```

---

_文档版本: 1.1.0_  
_最后更新: 2026-01-16_  
_文档状态: 已更新（补充新路线图内容）_  
_更新内容: T0/T1 两阶段、L0 规则层、HNSW 索引、Optimistic UI、文件夹生命周期阶段_
