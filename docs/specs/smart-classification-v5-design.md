# AnyKeep 智能分类系统 v5.0 设计文档

> **版本**: 5.0.0  
> **日期**: 2026-01-15  
> **作者**: AnyKeep 架构团队  
> **状态**: 设计阶段

---

## 目录

1. [设计概述](#一设计概述)
2. [核心算法原理](#二核心算法原理)
3. [系统架构设计](#三系统架构设计)
4. [差异化功能设计](#四差异化功能设计)
5. [数据库 Schema](#五数据库-schema)
6. [API 设计](#六api-设计)
7. [实施路线图](#七实施路线图)
8. [技术选型建议](#八技术选型建议)

---

## 一、设计概述

### 1.1 核心理念

**文件夹即语义聚类 (Folder as a Semantic Cluster)**

v5.0 将文件夹从简单的路径字符串升级为高维空间中的**聚类中心 (Centroid)**，让 AI 真正"读懂"每个文件夹的语义重心。

### 1.2 设计目标

| 目标 | 描述 | 度量指标 |
|------|------|----------|
| **精准度** | 分类准确率提升 | 准确率 > 85% |
| **信任感** | 消除用户对 AI 分类的恐惧 | 用户接受率 > 80% |
| **智能化** | 上下文感知、主动治理 | 用户满意度 > 4.5/5.0 |
| **差异化** | 形成护城河级功能 | 竞品对比优势明显 |

### 1.3 与现有系统的关系

**当前系统 (V4.1)**:
- ✅ `SimpleClassificationService` - 统一向量搜索
- ✅ `folder_profiles` 表 - 已有基础画像
- ✅ `name_embedding` + `profile_embedding` - 冷启动支持

**v5.0 升级点**:
- 🆕 增强文件夹画像算法（显性+隐性语义融合）
- 🆕 混合检索服务（向量+规则+上下文）
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
- $\alpha = 0.3$ (显性语义权重，文件夹名称)
- $1-\alpha = 0.7$ (隐性语义权重，内容向量)
- $N = 20$ (最近 N 个书签)

#### 实现细节

```typescript
// 文件: src/lib/classification/v5/folder-profiler.ts

interface FolderProfileVector {
  // 显性语义：文件夹名称向量
  nameEmbedding: number[];
  
  // 隐性语义：最近 N 个书签的平均向量
  contentEmbedding: number[];
  
  // 融合向量（加权平均）
  fusedEmbedding: number[];
  
  // 关键词标签（从内容中提取）
  keywords: string[];
  
  // 活跃度权重（基于使用频率）
  activityScore: number;
}

class FolderProfiler {
  /**
   * 计算文件夹特征向量
   */
  async computeFolderVector(
    folderId: number,
    userId: string
  ): Promise<FolderProfileVector> {
    // 1. 获取文件夹名称向量
    const nameEmbedding = await this.getNameEmbedding(folderId);
    
    // 2. 获取最近 N 个书签的向量
    const recentBookmarks = await this.getRecentBookmarks(folderId, 20);
    const contentEmbedding = this.computeMeanPooling(
      recentBookmarks.map(b => b.embedding)
    );
    
    // 3. 加权融合
    const alpha = 0.3;
    const fusedEmbedding = this.weightedAverage(
      nameEmbedding,
      contentEmbedding,
      alpha
    );
    
    // 4. 提取关键词
    const keywords = await this.extractKeywords(recentBookmarks);
    
    // 5. 计算活跃度
    const activityScore = await this.computeActivityScore(folderId);
    
    return {
      nameEmbedding,
      contentEmbedding,
      fusedEmbedding,
      keywords,
      activityScore,
    };
  }
}
```

### 2.2 分类即向量检索

#### 流程设计

```
新书签 → Embedding 生成 → 向量检索 (KNN) → 候选文件夹 (Top-K) → LLM 裁决 → 最终分类
```

#### 混合评分机制

```typescript
// 文件: src/lib/classification/v5/classification-pipeline.ts

interface HybridScore {
  // 向量相似度 (0-1)
  vectorSimilarity: number;
  
  // 使用频率归一化 (0-1)
  usageFrequencyNorm: number;
  
  // 树深度惩罚 (0-1，越深惩罚越大)
  treeDepthPenalty: number;
  
  // 上下文匹配度 (0-1)
  contextMatch: number;
  
  // 最终得分
  finalScore: number;
}

class ClassificationPipeline {
  /**
   * 计算混合得分
   */
  computeHybridScore(
    vectorSim: number,
    usageFreq: number,
    depth: number,
    contextMatch: number
  ): HybridScore {
    // 权重配置
    const weights = {
      vector: 0.7,      // 语义相似度权重最高
      usage: 0.2,       // 使用频率
      depth: 0.05,      // 深度惩罚（轻微）
      context: 0.05,    // 上下文匹配
    };
    
    const finalScore = 
      vectorSim * weights.vector +
      usageFreq * weights.usage +
      (1 - depth / 10) * weights.depth +  // 深度惩罚
      contextMatch * weights.context;
    
    return {
      vectorSimilarity: vectorSim,
      usageFrequencyNorm: usageFreq,
      treeDepthPenalty: depth / 10,
      contextMatch,
      finalScore,
    };
  }
}
```

---

## 三、系统架构设计

### 3.1 模块划分

```
┌─────────────────────────────────────────────────────────────────┐
│                 智能分类系统 v5.0                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Module A: Folder Profiler (文件夹画像引擎)              │ │
│  │  - 维护 folder_profiles 表                                │ │
│  │  - 异步更新文件夹向量                                      │ │
│  │  - 惰性更新策略                                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │  Module B: Classification Pipeline (分类流水线)         │ │
│  │  - Ingestion: 书签解析 + Embedding                        │ │
│  │  - Recall: 向量检索 (pgvector)                           │ │
│  │  - Rerank: 混合评分                                        │ │
│  │  - Arbitration: LLM 裁决                                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │  Module C: The Gardener (园丁系统)                        │ │
│  │  - 新建文件夹逻辑                                          │ │
│  │  - 智能命名                                                │ │
│  │  - 路径建议                                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Module D: Shadow Sorting (影子分拣)                      │ │
│  │  - Inbox Zero 模式                                         │ │
│  │  - 幽灵路径显示                                            │ │
│  │  - 一键归位                                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Module E: Context Anchor (多维意图锚点)                  │ │
│  │  - 浏览器上下文捕获                                        │ │
│  │  - 时间/设备锚点                                           │ │
│  │  - 场景推断                                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Module F: Entropy Reduction (熵减治理)                   │ │
│  │  - 熵值预警                                                │ │
│  │  - 智能分裂                                                │ │
│  │  - 重构建议                                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Module G: Chat-to-Rule (自然语言调教)                    │ │
│  │  - 规则提取                                                │ │
│  │  - 负向约束                                                │ │
│  │  - 用户偏好学习                                            │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Module A: Folder Profiler

#### 职责

- 维护 `folder_profiles` 表的 `semantic_vector` 字段
- 异步更新文件夹画像（惰性更新策略）
- 处理文件夹变动事件（新增/移动/删除书签）

#### 触发机制

```typescript
// 文件: src/lib/classification/v5/folder-profiler.ts

class FolderProfiler {
  /**
   * 标记文件夹为"待更新"（Dirty）
   */
  async markDirty(folderId: number): Promise<void> {
    await this.supabase
      .from('folder_profiles')
      .update({ 
        dirty: true,
        dirty_since: new Date().toISOString()
      })
      .eq('folder_id', folderId);
  }
  
  /**
   * 批量更新脏文件夹（后台 Job）
   */
  async updateDirtyFolders(userId: string): Promise<void> {
    // 获取所有脏文件夹
    const { data: dirtyFolders } = await this.supabase
      .from('folder_profiles')
      .select('folder_id')
      .eq('user_id', userId)
      .eq('dirty', true);
    
    // 批量更新（限制并发数）
    const BATCH_SIZE = 5;
    for (let i = 0; i < dirtyFolders.length; i += BATCH_SIZE) {
      const batch = dirtyFolders.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(f => this.computeFolderVector(f.folder_id, userId))
      );
    }
  }
}
```

#### 惰性更新策略

| 触发条件 | 更新策略 |
|---------|---------|
| 书签新增/移动/删除 | 标记为 Dirty，延迟更新 |
| 文件夹变动 > 5 次 | 立即更新 |
| 距离上次更新 > 1 小时 | 定时更新 |
| 用户手动触发 | 立即更新 |

### 3.3 Module B: Classification Pipeline

#### 流程设计

```typescript
// 文件: src/lib/classification/v5/classification-pipeline.ts

class ClassificationPipeline {
  /**
   * 执行分类流水线
   */
  async classify(
    userId: string,
    bookmark: BookmarkInput,
    context?: ClassificationContext
  ): Promise<ClassificationResult> {
    // 1. Ingestion: 生成书签 Embedding
    const embedding = await this.generateEmbedding(bookmark);
    
    // 2. Recall: 向量检索 Top-K 候选
    const candidates = await this.vectorRecall(
      userId,
      embedding,
      limit: 5
    );
    
    // 3. Rerank: 混合评分
    const reranked = await this.rerank(
      candidates,
      userId,
      context
    );
    
    // 4. Arbitration: LLM 裁决
    const result = await this.llmArbitration(
      bookmark,
      reranked.slice(0, 3)
    );
    
    return result;
  }
  
  /**
   * 向量召回
   */
  private async vectorRecall(
    userId: string,
    embedding: number[],
    limit: number
  ): Promise<CandidateFolder[]> {
    const { data } = await this.supabase.rpc('search_similar_folders', {
      query_embedding: embedding,
      p_user_id: userId,
      match_threshold: 0.5,
      match_count: limit,
    });
    
    return data.map(row => ({
      folderId: row.folder_id,
      folderName: row.folder_name,
      similarity: row.similarity,
      matchType: row.match_type,
    }));
  }
  
  /**
   * 重排序（混合评分）
   */
  private async rerank(
    candidates: CandidateFolder[],
    userId: string,
    context?: ClassificationContext
  ): Promise<CandidateFolder[]> {
    // 获取用户使用频率
    const usageFreq = await this.getUsageFrequency(userId);
    
    // 计算混合得分
    return candidates.map(candidate => {
      const hybridScore = this.computeHybridScore(
        candidate.similarity,
        usageFreq[candidate.folderId] || 0,
        candidate.depth,
        context?.matchScore || 0
      );
      
      return {
        ...candidate,
        finalScore: hybridScore.finalScore,
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }
  
  /**
   * LLM 裁决器
   */
  private async llmArbitration(
    bookmark: BookmarkInput,
    candidates: CandidateFolder[]
  ): Promise<ClassificationResult> {
    const prompt = this.buildArbitrationPrompt(bookmark, candidates);
    const response = await this.llm.generate(prompt);
    
    return this.parseLLMResponse(response);
  }
}
```

#### LLM 裁决 Prompt 模板

```
用户想要保存书签: "{title}"

候选文件夹:
1. {folderName1} (置信度: {confidence1}%)
2. {folderName2} (置信度: {confidence2}%)
3. {folderName3} (置信度: {confidence3}%)

请选择最合适的文件夹，或者建议一个新的文件夹名称（如果都不合适）。

回复格式:
- 选择现有: "选择 1" 或 "选择 2"
- 新建文件夹: "新建: {新文件夹名称}"
```

### 3.4 Module C: The Gardener

#### 职责

- 处理"新建文件夹"逻辑
- 当 Top 1 候选相似度 < 0.75 时，触发新建流程
- 智能生成文件夹名称和路径

#### 实现

```typescript
// 文件: src/lib/classification/v5/gardener.ts

class Gardener {
  /**
   * 判断是否需要新建文件夹
   */
  shouldCreateNewFolder(
    topCandidate: CandidateFolder,
    threshold: number = 0.75
  ): boolean {
    return topCandidate.similarity < threshold;
  }
  
  /**
   * 生成新文件夹名称
   */
  async generateFolderName(
    bookmark: BookmarkInput
  ): Promise<string> {
    const prompt = `
分析以下书签内容，生成一个简洁、准确的文件夹名称（2-4 个字）：

标题: ${bookmark.title}
摘要: ${bookmark.summary}
标签: ${bookmark.tags?.join(', ')}

要求:
1. 名称要简洁（2-4 个字）
2. 能准确概括内容主题
3. 避免使用"其他"、"杂项"等通用词

只返回文件夹名称，不要其他说明。
`;
    
    const name = await this.llm.generate(prompt);
    return this.sanitizeFolderName(name);
  }
  
  /**
   * 建议文件夹路径
   */
  async suggestFolderPath(
    folderName: string,
    userId: string
  ): Promise<string> {
    // 查找相似文件夹，推断路径
    const similarFolders = await this.findSimilarFolders(
      folderName,
      userId
    );
    
    if (similarFolders.length > 0) {
      // 使用相似文件夹的父路径
      return similarFolders[0].parentPath;
    }
    
    // 默认根目录
    return '/';
  }
}
```

---

## 四、差异化功能设计

### 4.1 影子分拣机制 (Shadow Sorting)

#### 功能概述

**Inbox Zero 模式**：所有新收藏默认通过 v5.0 算法打上"建议标签"和"建议路径"，但物理上暂时留在 **Inbox (收件箱)**。

#### 数据库设计

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

#### UI 设计

```typescript
// 文件: src/components/classification/shadow-sorting-card.tsx

interface ShadowSortingCardProps {
  bookmark: Bookmark;
  shadowFolder: {
    id: number;
    name: string;
    confidence: number;
  };
  onConfirm: () => void;
  onReject: () => void;
}

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

#### 批量归位功能

```typescript
// 文件: src/lib/classification/v5/shadow-sorting.ts

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

### 4.2 多维意图锚点 (Multi-dimensional Intent Anchors)

#### 上下文捕获

```typescript
// 文件: src/lib/classification/v5/context-anchor.ts

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
   * 捕获浏览器上下文（插件端）
   */
  async captureBrowserContext(): Promise<BrowserContext> {
    // 通过浏览器扩展 API 获取
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeTab = tabs.find(t => t.active);
    
    return {
      openTabs: tabs.map(t => t.url || ''),
      activeTab: activeTab?.url || '',
    };
  }
  
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

### 4.3 熵减治理层 (Entropy Reduction)

#### 熵值计算

```typescript
// 文件: src/lib/classification/v5/entropy-reduction.ts

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
   * 检查是否需要分裂
   */
  async shouldSplit(folderId: number): Promise<boolean> {
    const entropy = await this.computeEntropy(folderId);
    const { data: folder } = await this.supabase
      .from('folders')
      .select('name, bookmark_count')
      .eq('id', folderId)
      .single();
    
    // 熵值 > 0.7 且书签数量 > 50，建议分裂
    return entropy > 0.7 && (folder?.bookmark_count || 0) > 50;
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

#### UI 组件

```typescript
// 文件: src/components/classification/entropy-alert.tsx

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

### 4.4 自然语言调教 (Chat-to-Rule)

#### 规则提取

```typescript
// 文件: src/lib/classification/v5/chat-to-rule.ts

interface UserRule {
  id: string;
  userId: string;
  type: 'positive' | 'negative';
  pattern: string;
  targetFolder: string;
  priority: number;
  createdAt: string;
}

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

#### 数据库设计

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

## 五、数据库 Schema

### 5.1 扩展 folder_profiles 表

```sql
-- ===========================================
-- v5.0: 扩展 folder_profiles 表
-- ===========================================

-- 1. 语义向量字段（融合向量）
ALTER TABLE folder_profiles
ADD COLUMN IF NOT EXISTS semantic_vector vector(1024);

COMMENT ON COLUMN folder_profiles.semantic_vector IS 
'v5.0 融合向量: α * name_embedding + (1-α) * content_embedding';

-- 2. 关键词标签
ALTER TABLE folder_profiles
ADD COLUMN IF NOT EXISTS keywords TEXT[];

COMMENT ON COLUMN folder_profiles.keywords IS 
'从内容中提取的关键词标签（如 ["React", "Frontend"]）';

-- 3. 活跃度权重
ALTER TABLE folder_profiles
ADD COLUMN IF NOT EXISTS activity_score FLOAT DEFAULT 0.0;

COMMENT ON COLUMN folder_profiles.activity_score IS 
'活跃度权重（基于使用频率，用于重排序）';

-- 4. 脏标记（用于惰性更新）
ALTER TABLE folder_profiles
ADD COLUMN IF NOT EXISTS dirty BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dirty_since TIMESTAMPTZ;

COMMENT ON COLUMN folder_profiles.dirty IS 
'标记文件夹是否需要更新画像';

-- 5. 通用文件夹标记
ALTER TABLE folder_profiles
ADD COLUMN IF NOT EXISTS is_generic BOOLEAN DEFAULT false;

COMMENT ON COLUMN folder_profiles.is_generic IS 
'是否为通用文件夹（如 Desktop、Inbox），禁止作为自动分类目标';

-- 6. 索引优化
CREATE INDEX IF NOT EXISTS idx_folder_profiles_semantic_vector 
ON folder_profiles USING hnsw (semantic_vector vector_cosine_ops)
WHERE semantic_vector IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_folder_profiles_dirty 
ON folder_profiles(user_id, dirty) 
WHERE dirty = true;
```

### 5.2 扩展 bookmarks 表（影子分拣）

```sql
-- ===========================================
-- v5.0: 扩展 bookmarks 表（影子分拣）
-- ===========================================

ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS shadow_folder_id BIGINT REFERENCES folders(id),
ADD COLUMN IF NOT EXISTS shadow_folder_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS shadow_confidence FLOAT,
ADD COLUMN IF NOT EXISTS shadow_suggested_at TIMESTAMPTZ;

-- 索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_shadow_folder 
ON bookmarks(shadow_folder_id) 
WHERE shadow_folder_id IS NOT NULL;
```

### 5.3 新增表：用户分类规则

```sql
-- ===========================================
-- v5.0: 用户分类规则表
-- ===========================================

CREATE TABLE IF NOT EXISTS user_classification_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  type VARCHAR(20) NOT NULL CHECK (type IN ('positive', 'negative')),
  pattern TEXT NOT NULL,
  target_folder_name VARCHAR(255) NOT NULL,
  priority INT DEFAULT 100,
  
  source_text TEXT,
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

### 5.4 新增表：分类失败记录

```sql
-- ===========================================
-- v5.0: 分类失败记录表（用于优化）
-- ===========================================

CREATE TABLE IF NOT EXISTS classification_failures (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT REFERENCES bookmarks(id) ON DELETE CASCADE,
  
  -- 失败信息
  suggested_folder_id BIGINT,
  suggested_folder_name VARCHAR(255),
  actual_folder_id BIGINT,
  actual_folder_name VARCHAR(255),
  
  -- 上下文
  bookmark_title TEXT,
  bookmark_summary TEXT,
  bookmark_tags TEXT[],
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_classification_failures_user 
ON classification_failures(user_id, created_at DESC);

-- RLS
ALTER TABLE classification_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own failures"
  ON classification_failures FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 六、API 设计

### 6.1 分类 API

```typescript
// POST /api/v5/classification/classify

interface ClassifyRequest {
  bookmark: {
    title: string;
    summary?: string;
    tags?: string[];
    url?: string;
  };
  context?: {
    browserTabs?: string[];
    device?: 'desktop' | 'mobile' | 'tablet';
    scene?: 'work' | 'study' | 'entertainment';
  };
  options?: {
    enableShadowSorting?: boolean;  // 是否启用影子分拣
    trustMode?: 'auto' | 'confirm' | 'manual';
  };
}

interface ClassifyResponse {
  result: {
    folderId: number | null;
    folderName: string;
    confidence: number;
    action: 'classify' | 'create' | 'shadow' | 'inbox';
  };
  shadowInfo?: {
    suggestedFolderId: number;
    suggestedFolderName: string;
    confidence: number;
  };
  candidates?: Array<{
    folderId: number;
    folderName: string;
    score: number;
  }>;
}
```

### 6.2 影子分拣 API

```typescript
// POST /api/v5/classification/shadow/confirm
// 确认归位

interface ConfirmShadowRequest {
  bookmarkIds: number[];
}

// POST /api/v5/classification/shadow/reject
// 拒绝建议，重新分类

interface RejectShadowRequest {
  bookmarkId: number;
  reason?: string;
}

// POST /api/v5/classification/shadow/batch-confirm
// 批量确认归位

interface BatchConfirmRequest {
  bookmarkIds: number[];
}
```

### 6.3 规则管理 API

```typescript
// POST /api/v5/classification/rules
// 创建规则

interface CreateRuleRequest {
  type: 'positive' | 'negative';
  pattern: string;
  targetFolder: string;
  priority?: number;
  sourceText?: string;
}

// GET /api/v5/classification/rules
// 获取用户规则列表

// DELETE /api/v5/classification/rules/:id
// 删除规则
```

### 6.4 熵减治理 API

```typescript
// GET /api/v5/classification/entropy/:folderId
// 获取文件夹熵值和分裂建议

interface EntropyResponse {
  folderId: number;
  folderName: string;
  entropy: number;
  bookmarkCount: number;
  shouldSplit: boolean;
  splitSuggestion?: {
    suggestions: Array<{
      name: string;
      percentage: number;
      sampleTitles: string[];
    }>;
  };
}

// POST /api/v5/classification/split
// 执行文件夹分裂

interface SplitRequest {
  folderId: number;
  splits: Array<{
    name: string;
    bookmarkIds: number[];
  }>;
}
```

---

## 七、实施路线图

### Phase 1: 数据基础设施建设 (2 周)

**目标**: 让 AI "看见" 现有文件夹

#### 任务清单

1. **Schema 变更**
   - [ ] 扩展 `folder_profiles` 表（semantic_vector, keywords, activity_score, dirty）
   - [ ] 扩展 `bookmarks` 表（shadow_* 字段）
   - [ ] 创建 `user_classification_rules` 表
   - [ ] 创建 `classification_failures` 表

2. **初始化脚本**
   - [ ] 编写迁移脚本：遍历所有文件夹，计算 semantic_vector
   - [ ] 批量更新现有 folder_profiles
   - [ ] 数据验证和修复

3. **触发器实现**
   - [ ] 实现 Post-Write Hook（书签变动时标记 Dirty）
   - [ ] 实现后台 Job（批量更新 Dirty 文件夹）
   - [ ] 性能测试和优化

**验收标准**:
- ✅ 所有现有文件夹都有 semantic_vector
- ✅ 书签变动能正确触发 Dirty 标记
- ✅ 后台 Job 能稳定运行

### Phase 2: 混合检索服务开发 (2 周)

**目标**: 实现 v5.0 分类服务

#### 任务清单

1. **向量召回**
   - [ ] 实现 `search_similar_folders` RPC 函数（使用 semantic_vector）
   - [ ] 优化 HNSW 索引参数
   - [ ] 性能测试（1000+ 文件夹场景）

2. **逻辑层开发**
   - [ ] 实现 `ClassificationPipeline` 类
   - [ ] 实现混合评分算法
   - [ ] 实现 LLM 裁决器

3. **集成测试**
   - [ ] 端到端测试（新书签分类流程）
   - [ ] 准确率测试（对比 V4.1）
   - [ ] 性能测试（延迟 < 500ms）

**验收标准**:
- ✅ 分类准确率 > 85%
- ✅ 平均响应时间 < 500ms
- ✅ 支持 1000+ 文件夹场景

### Phase 3: 差异化功能开发 (3 周)

**目标**: 实现 4 个差异化功能

#### 任务清单

1. **影子分拣 (Week 1)**
   - [ ] 实现 `ShadowSortingService`
   - [ ] 开发 UI 组件（ShadowSortingCard）
   - [ ] 实现批量归位功能
   - [ ] 集成到收藏流程

2. **多维意图锚点 (Week 1-2)**
   - [ ] 实现 `ContextAnchor` 类
   - [ ] 浏览器扩展 API 集成（捕获 Tab 组）
   - [ ] 时间/设备锚点逻辑
   - [ ] 场景推断算法

3. **熵减治理 (Week 2)**
   - [ ] 实现 `EntropyReductionService`
   - [ ] 熵值计算算法
   - [ ] K-means 聚类分析
   - [ ] UI 组件（EntropyAlert）

4. **自然语言调教 (Week 3)**
   - [ ] 实现 `ChatToRuleService`
   - [ ] 规则提取和解析
   - [ ] 规则应用逻辑
   - [ ] UI 组件（规则管理界面）

**验收标准**:
- ✅ 影子分拣功能完整可用
- ✅ 上下文感知准确率 > 70%
- ✅ 熵减建议准确率 > 80%
- ✅ 规则提取成功率 > 60%

### Phase 4: 灰度与自适应学习 (2 周)

**目标**: 通过用户反馈进化

#### 任务清单

1. **反馈闭环**
   - [ ] 实现分类失败记录
   - [ ] 实现反馈学习算法
   - [ ] 实现向量微调机制

2. **Feature Flag 切换**
   - [ ] 添加 `ENABLE_CLASSIFICATION_V5` Feature Flag
   - [ ] 实现灰度发布机制（10% → 50% → 100%）
   - [ ] 监控和告警

3. **数据分析**
   - [ ] 准确率追踪
   - [ ] 用户满意度调研
   - [ ] 性能监控

**验收标准**:
- ✅ 灰度发布流程完整
- ✅ 反馈学习机制生效
- ✅ 用户满意度 > 4.0/5.0

---

## 八、技术选型建议

### 8.1 竞品技术借鉴

基于文档中的竞品分析，建议采用 **"Raindrop 的皮 + MyMind 的骨 + Arc 的魂"** 混合路线：

#### 1. 学 MyMind 的"视觉向量"

**落地**: 在计算 `V_content` 时，如果网页包含显著图片，使用 Vision 模型提取图片描述并加入 Embedding。

```typescript
// 文件: src/lib/classification/v5/multimodal-embedding.ts

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

**落地**: 保留 L0 规则层，对于强特征域名（如 `github.com`）直接走规则，不浪费 AI 算力。

```typescript
// 文件: src/lib/classification/v5/rule-layer.ts

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

#### 3. 学 Mem 的"关联推荐"

**落地**: 在保存成功后的 Toast 提示里，显示"发现它与文件夹 B 里的《XXX》内容高度相关"。

```typescript
// 文件: src/lib/classification/v5/related-discovery.ts

class RelatedDiscoveryService {
  /**
   * 发现相关内容
   */
  async findRelated(
    bookmarkId: number,
    folderId: number,
    userId: string
  ): Promise<RelatedBookmark[]> {
    const { data: bookmark } = await this.supabase
      .from('bookmarks')
      .select('embedding')
      .eq('id', bookmarkId)
      .single();
    
    // 搜索其他文件夹中的相似书签
    const { data: related } = await this.supabase.rpc(
      'search_similar_bookmarks',
      {
        query_embedding: bookmark.embedding,
        p_user_id: userId,
        exclude_folder_id: folderId,
        match_threshold: 0.75,
        match_count: 3,
      }
    );
    
    return related.map(r => ({
      bookmarkId: r.bookmark_id,
      title: r.title,
      folderName: r.folder_name,
      similarity: r.similarity,
    }));
  }
}
```

#### 4. 学 Arc 的"空间隔离"

**落地**: 在插件端允许用户选择"当前模式"（Work / Life / Study），作为最强的 re-ranking 权重。

```typescript
// 文件: browser-extension/src/context-mode.ts

interface ContextMode {
  mode: 'work' | 'life' | 'study' | 'default';
  enabled: boolean;
}

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

### 8.2 性能优化建议

#### 1. 向量检索优化

- 使用 HNSW 索引（已实现）
- 限制检索范围（只搜索用户自己的文件夹）
- 缓存常用文件夹向量

#### 2. LLM 调用优化

- 使用轻量级模型（GPT-4o-mini / DeepSeek）进行裁决
- 批量处理（多个书签一起裁决）
- 缓存常见场景的裁决结果

#### 3. 异步处理

- 文件夹画像更新异步化
- 使用 Job Queue 处理批量更新
- 乐观 UI（先显示结果，后台异步确认）

---

## 九、风险与应对

### 9.1 冷启动问题

**问题**: 新用户或空文件夹没有足够数据计算画像。

**应对**:
- 空文件夹仅使用 `name_embedding` 作为特征向量
- 提供预设文件夹模板（基于用户兴趣）
- 逐步积累数据，动态更新画像

### 9.2 "杂物堆"陷阱

**问题**: 用户有 `Desktop`、`Inbox` 等通用文件夹，向量混乱。

**应对**:
- 在 `folder_profiles` 中标记 `is_generic = true`
- 禁止作为 AI 自动分类目标（除非用户明确指定）
- 提供"整理建议"功能

### 9.3 性能问题

**问题**: Embedding 生成（200ms）+ LLM 裁决（500ms）可能阻塞保存动作。

**应对**:
- **乐观 UI**: 用户点击收藏后，前端先显示"正在整理..."
- 后台异步分类完成后，通过 Toast 通知
- 允许用户一键撤销

### 9.4 成本控制

**问题**: 每次书签变动都重算文件夹向量，成本高。

**应对**:
- **惰性更新**: 标记为 Dirty，延迟更新
- 批量处理（每小时批量更新一次）
- 限制更新频率（每个文件夹最多每小时更新一次）

---

## 十、总结

v5.0 智能分类系统将 AnyKeep 从"基于规则的死板分类"升级为"基于语义的动态感知"。

**核心价值**:
1. **精准**: 文件夹画像 + 混合检索，准确率 > 85%
2. **信任**: 影子分拣机制，消除用户恐惧
3. **智能**: 上下文感知 + 主动治理，真正"懂你"
4. **差异化**: 4 个独特功能，形成护城河

**下一步**: 按照实施路线图，分阶段推进，优先实现 Phase 1-2 的核心功能，再逐步完善差异化功能。

---

_文档版本: 1.0.0_  
_最后更新: 2026-01-15_
