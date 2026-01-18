# AnyKeep 智能分类 v5.0 实施指南

**文档版本**: 1.0
**创建日期**: 2026-01-16
**架构文档**: `_bmad-output/architecture-classification-v5.md`

---

## 📋 快速导航

- [前置准备](#前置准备)
- [6 步实施路线图](#6-步实施路线图)
- [验证检查点](#验证检查点)
- [常见问题排查](#常见问题排查)
- [灰度发布指南](#灰度发布指南)

---

## 🚀 前置准备

### 环境要求

```bash
# Node.js 版本
node -v  # 需要 >= 18.x

# npm 版本
npm -v   # 需要 >= 9.x

# Supabase CLI
supabase --version  # 需要 >= 1.123.0
```

### 关键架构决策回顾

| 决策编号 | 决策内容                     | 关键参数                              |
| -------- | ---------------------------- | ------------------------------------- |
| 决策 1   | 双源向量 + 动态 α 系数       | α = f(时间衰减, 数量比例, 多样性, 新鲜度) |
| 决策 2   | IVFFlat 向量索引             | `lists = 10` (适用 <100 文件夹)       |
| 决策 3   | 混合检索（向量 + 行为）      | 内容向量 70% + 行为向量 30%           |
| 决策 4   | T0/T1 两阶段生成             | T0 <500ms, T1 <5s, SSE 流式推送       |
| 决策 5   | Feature Flag 灰度发布        | 0% → 1% → 5% → 20% → 50% → 100%       |
| 决策 6   | 三级降级策略                 | v5.0 → v4.1 → 规则匹配                |

---

## 📅 6 步实施路线图

### Step 1: 数据层准备 (Week 1)

**工作目标**: 创建 3 张新表 + IVFFlat 索引 + RLS 策略

#### 1.1 创建数据库迁移文件

```bash
# 创建迁移文件
supabase migration new add_classification_v5_tables
```

**迁移文件路径**: `supabase/migrations/20260116000001_add_classification_v5_tables.sql`

#### 1.2 迁移 SQL 脚本

```sql
-- ============================================
-- Classification v5.0 数据表
-- ============================================

-- 表 1: 文件夹画像表（双源向量 + 动态 α）
CREATE TABLE classification_folder_profiles_v5 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

  -- 双源向量
  content_embedding vector(1024) NOT NULL,     -- 内容向量（OpenAI）
  behavior_embedding vector(1024) NOT NULL,    -- 行为向量

  -- 动态 α 系数
  alpha_coefficient DECIMAL(3,2) NOT NULL DEFAULT 0.50,

  -- 懒更新元数据
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bookmark_count INTEGER NOT NULL DEFAULT 0,
  needs_update BOOLEAN NOT NULL DEFAULT FALSE,

  -- 统计信息
  avg_classification_score DECIMAL(3,2),
  total_classifications INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, folder_id)
);

-- 表 2: T1 纠正队列（异步 LLM 纠正）
CREATE TABLE classification_t1_queue_v5 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

  -- T0 结果
  t0_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  t0_confidence DECIMAL(3,2) NOT NULL,
  t0_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 触发 T1 的原因
  trigger_reason TEXT NOT NULL, -- 'low_confidence' | 'vector_conflict' | 'manual_request'

  -- T1 处理状态
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'

  -- T1 结果
  t1_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  t1_confidence DECIMAL(3,2),
  t1_reasoning TEXT,
  t1_timestamp TIMESTAMPTZ,

  -- 错误信息
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 表 3: 分类指标记录（监控与分析）
CREATE TABLE classification_metrics_v5 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 分类元数据
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

  -- 性能指标
  stage TEXT NOT NULL, -- 'T0' | 'T1'
  latency_ms INTEGER NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,

  -- 成本指标
  embedding_tokens INTEGER,
  llm_tokens INTEGER,

  -- 准确性指标（需要人工反馈）
  is_correct BOOLEAN,
  user_corrected_to_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

  -- 降级信息
  degradation_level INTEGER DEFAULT 0, -- 0=v5.0, 1=v4.1, 2=规则匹配

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 索引
-- ============================================

-- IVFFlat 索引（决策 2: lists=10）
CREATE INDEX classification_folder_profiles_v5_content_embedding_idx
  ON classification_folder_profiles_v5
  USING ivfflat (content_embedding vector_cosine_ops)
  WITH (lists = 10);

CREATE INDEX classification_folder_profiles_v5_behavior_embedding_idx
  ON classification_folder_profiles_v5
  USING ivfflat (behavior_embedding vector_cosine_ops)
  WITH (lists = 10);

-- 常规索引
CREATE INDEX classification_folder_profiles_v5_user_id_idx
  ON classification_folder_profiles_v5(user_id);

CREATE INDEX classification_folder_profiles_v5_needs_update_idx
  ON classification_folder_profiles_v5(user_id, needs_update)
  WHERE needs_update = TRUE;

CREATE INDEX classification_t1_queue_v5_user_status_idx
  ON classification_t1_queue_v5(user_id, status);

CREATE INDEX classification_t1_queue_v5_pending_idx
  ON classification_t1_queue_v5(created_at)
  WHERE status = 'pending';

CREATE INDEX classification_metrics_v5_user_id_idx
  ON classification_metrics_v5(user_id, created_at DESC);

-- ============================================
-- RLS 策略（多租户隔离）
-- ============================================

ALTER TABLE classification_folder_profiles_v5 ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_t1_queue_v5 ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_metrics_v5 ENABLE ROW LEVEL SECURITY;

-- Folder Profiles RLS
CREATE POLICY "用户只能访问自己的文件夹画像"
  ON classification_folder_profiles_v5
  FOR ALL
  USING (auth.uid() = user_id);

-- T1 Queue RLS
CREATE POLICY "用户只能访问自己的 T1 队列"
  ON classification_t1_queue_v5
  FOR ALL
  USING (auth.uid() = user_id);

-- Metrics RLS
CREATE POLICY "用户只能访问自己的分类指标"
  ON classification_metrics_v5
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 触发器（自动更新 updated_at）
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_classification_folder_profiles_v5_updated_at
  BEFORE UPDATE ON classification_folder_profiles_v5
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classification_t1_queue_v5_updated_at
  BEFORE UPDATE ON classification_t1_queue_v5
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 1.3 执行迁移

```bash
# 本地开发环境
supabase db reset  # 重置本地数据库（开发环境）

# 生产环境
supabase db push  # 推送到远程 Supabase 项目
```

#### 1.4 验证数据表创建

```bash
# 连接到数据库
supabase db psql

# 验证表存在
\dt classification_*_v5

# 验证索引
\di classification_*_v5_*

# 验证 RLS 策略
SELECT tablename, policyname FROM pg_policies
WHERE tablename LIKE 'classification_%_v5';
```

**✅ Step 1 完成标志**:
- 3 张表创建成功
- 6 个 IVFFlat/常规索引创建成功
- 3 个 RLS 策略启用成功

---

### Step 2: 共享服务层 (Week 1-2)

**工作目标**: 实施 5 个共享服务（Logger, Embedding, LLM, VectorSearch, FeatureFlag）

#### 2.1 实施顺序（按依赖关系）

```
1. Logger Service       (基础日志，无依赖)
   ↓
2. Embedding Service    (依赖 Logger)
   ↓
3. LLM Service          (依赖 Logger)
   ↓
4. VectorSearch Service (依赖 Logger + Supabase)
   ↓
5. FeatureFlag Service  (依赖 Logger)
```

#### 2.2 文件结构

```
src/lib/classification/v5/
├── shared/
│   ├── logger/
│   │   ├── logger.service.ts
│   │   ├── logger.service.test.ts
│   │   └── types.ts
│   ├── embedding/
│   │   ├── embedding.service.ts
│   │   ├── embedding.service.test.ts
│   │   └── types.ts
│   ├── llm/
│   │   ├── llm.service.ts
│   │   ├── llm.service.test.ts
│   │   └── types.ts
│   ├── vector-search/
│   │   ├── vector-search.service.ts
│   │   ├── vector-search.service.test.ts
│   │   └── types.ts
│   └── feature-flag/
│       ├── feature-flag.service.ts
│       ├── feature-flag.service.test.ts
│       └── types.ts
```

#### 2.3 关键实现要点

**Embedding Service (OpenAI)**:
```typescript
// src/lib/classification/v5/shared/embedding/embedding.service.ts
import OpenAI from 'openai';

export class EmbeddingService {
  private client: OpenAI;

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1024, // ⚠️ 关键：必须是 1024 维
    });

    return response.data[0].embedding;
  }

  // 💡 Week 2 补充：添加指数退避重试（差距 3）
  // 最多 3 次，延迟 1s, 2s, 4s
}
```

**LLM Service (DeepSeek)**:
```typescript
// src/lib/classification/v5/shared/llm/llm.service.ts
import OpenAI from 'openai'; // DeepSeek 兼容 OpenAI SDK

export class LLMService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
  }

  async classify(prompt: string): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat', // ⚠️ 关键：明确模型版本（解决差距 1）
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    // ... 解析响应
  }
}
```

**VectorSearch Service (pgvector)**:
```typescript
// src/lib/classification/v5/shared/vector-search/vector-search.service.ts
import { SupabaseClient } from '@supabase/supabase-js';

export class VectorSearchService {
  constructor(private supabase: SupabaseClient) {}

  async searchSimilarFolders(
    userId: string,
    queryEmbedding: number[],
    limit: number = 5
  ): Promise<SimilarFolder[]> {
    const { data, error } = await this.supabase.rpc(
      'match_folder_profiles_v5',
      {
        query_user_id: userId,
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: limit,
      }
    );

    if (error) throw error;
    return data;
  }
}
```

**RPC 函数（Supabase）**:
```sql
-- 在迁移文件中添加
CREATE OR REPLACE FUNCTION match_folder_profiles_v5(
  query_user_id UUID,
  query_embedding vector(1024),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  folder_id UUID,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cfp.folder_id,
    1 - (cfp.content_embedding <=> query_embedding) AS similarity
  FROM classification_folder_profiles_v5 cfp
  WHERE cfp.user_id = query_user_id
    AND 1 - (cfp.content_embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

**FeatureFlag Service**:
```typescript
// src/lib/classification/v5/shared/feature-flag/feature-flag.service.ts
export class FeatureFlagService {
  isV5Enabled(userId: string): boolean {
    const rolloutPercentage = parseInt(
      process.env.CLASSIFICATION_V5_ROLLOUT_PERCENTAGE || '0'
    );

    // 白名单检查
    const whitelist = process.env.CLASSIFICATION_V5_WHITELIST?.split(',') || [];
    if (whitelist.includes(userId)) return true;

    // 黑名单检查
    const blacklist = process.env.CLASSIFICATION_V5_BLACKLIST?.split(',') || [];
    if (blacklist.includes(userId)) return false;

    // 百分比灰度
    const hash = this.hashUserId(userId);
    return (hash % 100) < rolloutPercentage;
  }

  private hashUserId(userId: string): number {
    // 简单哈希函数（确保同一用户始终得到相同结果）
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
```

#### 2.4 环境变量配置

```bash
# .env.local
OPENAI_API_KEY=sk-xxx                  # OpenAI Embedding
DEEPSEEK_API_KEY=sk-xxx                # DeepSeek LLM

# Feature Flag 配置
CLASSIFICATION_V5_ENABLED=true
CLASSIFICATION_V5_ROLLOUT_PERCENTAGE=0  # 初始 0%
CLASSIFICATION_V5_WHITELIST=user-id-1,user-id-2
CLASSIFICATION_V5_BLACKLIST=
```

**✅ Step 2 完成标志**:
- 5 个共享服务实施完成
- 每个服务有对应测试文件（覆盖率 ≥80%）
- 环境变量配置完成
- RPC 函数部署到 Supabase

---

### Step 3: 核心模块实施 (Week 2-4)

**工作目标**: 并行实施 3 个核心模块（Module A/B/C）

#### 3.1 Module A: FolderProfiler（文件夹画像）

**文件结构**:
```
src/lib/classification/v5/folder-profiler/
├── dual-source-builder.ts           # 双源向量构建
├── dual-source-builder.test.ts
├── alpha-calculator.ts              # 动态 α 系数
├── alpha-calculator.test.ts
├── lazy-updater.ts                  # 懒更新机制
├── lazy-updater.test.ts
├── folder-profiler.service.ts       # 主服务
├── folder-profiler.service.test.ts
└── types.ts
```

**关键算法实现**:

```typescript
// alpha-calculator.ts - 动态 α 系数计算（决策 1）
export class AlphaCalculator {
  calculate(folderStats: FolderStats): number {
    // 4 个影响因素
    const timeFactor = this.calculateTimeFactor(folderStats.lastUsed);
    const quantityFactor = this.calculateQuantityFactor(
      folderStats.behaviorCount,
      folderStats.contentCount
    );
    const diversityFactor = this.calculateDiversityFactor(folderStats);
    const freshnessFactor = this.calculateFreshnessFactor(folderStats.recentActivity);

    // 加权平均
    const alpha =
      0.3 * timeFactor +
      0.3 * quantityFactor +
      0.2 * diversityFactor +
      0.2 * freshnessFactor;

    // 限制在 [0.2, 0.8] 范围
    return Math.max(0.2, Math.min(0.8, alpha));
  }

  private calculateTimeFactor(lastUsedAt: Date): number {
    const daysSinceLastUse =
      (Date.now() - lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);

    // 指数衰减：7 天内 → 1.0, 30 天后 → 0.2
    return Math.max(0.2, Math.exp(-daysSinceLastUse / 14));
  }

  // ... 其他因素计算
}
```

```typescript
// lazy-updater.ts - 懒更新机制（4 触发条件）
export class LazyUpdater {
  shouldUpdate(profile: FolderProfile): boolean {
    // 条件 1: 时间阈值（7 天未更新）
    const daysSinceUpdate = this.getDaysSince(profile.lastUpdatedAt);
    if (daysSinceUpdate > 7) return true;

    // 条件 2: 新增书签阈值（新增 10+ 条）
    const newBookmarksSinceUpdate = this.getNewBookmarksCount(profile);
    if (newBookmarksSinceUpdate >= 10) return true;

    // 条件 3: 分类准确率下降（<85%）
    if (profile.avgClassificationScore < 0.85) return true;

    // 条件 4: 手动触发标记
    if (profile.needsUpdate) return true;

    return false;
  }
}
```

#### 3.2 Module B: ClassificationPipeline（分类流水线）

**文件结构**:
```
src/lib/classification/v5/classification-pipeline/
├── l0-rule-matcher.ts               # L0 规则层
├── l0-rule-matcher.test.ts
├── t0-generator.ts                  # T0 快速生成
├── t0-generator.test.ts
├── t1-corrector.ts                  # T1 异步纠正
├── t1-corrector.test.ts
├── hybrid-retriever.ts              # 混合检索（决策 3）
├── hybrid-retriever.test.ts
├── llm-caller.ts                    # 条件 LLM 调用
├── llm-caller.test.ts
├── classification-pipeline.service.ts
├── classification-pipeline.service.test.ts
└── types.ts
```

**关键算法实现**:

```typescript
// hybrid-retriever.ts - 混合检索（决策 3: 70/30）
export class HybridRetriever {
  async retrieve(
    userId: string,
    contentEmbedding: number[],
    behaviorEmbedding: number[]
  ): Promise<RankedFolder[]> {
    // 1. 内容向量检索（权重 0.7）
    const contentResults = await this.vectorSearch.search(
      userId,
      contentEmbedding,
      10
    );

    // 2. 行为向量检索（权重 0.3）
    const behaviorResults = await this.vectorSearch.search(
      userId,
      behaviorEmbedding,
      10
    );

    // 3. RRF（Reciprocal Rank Fusion）融合
    const fusedResults = this.fuseRanks(contentResults, behaviorResults, {
      contentWeight: 0.7,
      behaviorWeight: 0.3,
      k: 60, // RRF 常数
    });

    return fusedResults.slice(0, 5); // Top 5
  }

  private fuseRanks(
    contentResults: SearchResult[],
    behaviorResults: SearchResult[],
    weights: { contentWeight: number; behaviorWeight: number; k: number }
  ): RankedFolder[] {
    const scoreMap = new Map<string, number>();

    // 内容向量贡献
    contentResults.forEach((result, index) => {
      const rrf = 1 / (weights.k + index + 1);
      const score = weights.contentWeight * rrf;
      scoreMap.set(result.folderId, (scoreMap.get(result.folderId) || 0) + score);
    });

    // 行为向量贡献
    behaviorResults.forEach((result, index) => {
      const rrf = 1 / (weights.k + index + 1);
      const score = weights.behaviorWeight * rrf;
      scoreMap.set(result.folderId, (scoreMap.get(result.folderId) || 0) + score);
    });

    // 排序
    return Array.from(scoreMap.entries())
      .map(([folderId, score]) => ({ folderId, score }))
      .sort((a, b) => b.score - a.score);
  }
}
```

```typescript
// llm-caller.ts - 条件 LLM 调用（3 触发条件）
export class LLMCaller {
  shouldCallLLM(t0Result: T0Result): boolean {
    // 条件 1: 低置信度（<0.75）
    if (t0Result.confidence < 0.75) return true;

    // 条件 2: 向量冲突（Top 2 分数接近）
    if (t0Result.topCandidates.length >= 2) {
      const scoreDiff =
        t0Result.topCandidates[0].score - t0Result.topCandidates[1].score;
      if (scoreDiff < 0.1) return true; // 分数差 <10%
    }

    // 条件 3: 用户手动请求
    if (t0Result.manualLLMRequest) return true;

    return false;
  }

  async callLLM(bookmark: Bookmark, candidates: Folder[]): Promise<LLMResult> {
    const prompt = this.buildPrompt(bookmark, candidates);

    const response = await this.llmService.classify(prompt);

    return {
      folderId: response.selectedFolderId,
      confidence: response.confidence,
      reasoning: response.reasoning,
    };
  }

  private buildPrompt(bookmark: Bookmark, candidates: Folder[]): string {
    return `你是一个智能书签分类助手。请分析以下书签，并从候选文件夹中选择最合适的一个。

**书签信息**:
- 标题: ${bookmark.title}
- 描述: ${bookmark.description || '无'}
- URL: ${bookmark.url}
- 摘要: ${bookmark.summary || '无'}

**候选文件夹** (按推荐度排序):
${candidates.map((f, i) => `${i + 1}. ${f.name} - ${f.description || '无描述'}`).join('\n')}

**要求**:
1. 选择最合适的文件夹 ID
2. 给出置信度分数 (0.0-1.0)
3. 简要说明选择理由

**输出 JSON 格式**:
{
  "folderId": "选择的文件夹 UUID",
  "confidence": 0.95,
  "reasoning": "选择理由"
}`;
  }
}
```

#### 3.3 Module C: Gardener（文件夹园丁）

**文件结构**:
```
src/lib/classification/v5/gardener/
├── threshold-adapter.ts             # 自适应阈值
├── threshold-adapter.test.ts
├── folder-suggester.ts              # 新文件夹建议
├── folder-suggester.test.ts
├── synonym-detector.ts              # 同义词检测
├── synonym-detector.test.ts
├── naming-engine.ts                 # 智能命名
├── naming-engine.test.ts
├── gardener.service.ts
├── gardener.service.test.ts
└── types.ts
```

**关键算法实现**:

```typescript
// threshold-adapter.ts - 自适应阈值（4 调整因素）
export class ThresholdAdapter {
  adapt(userStats: UserStats, currentThreshold: number): number {
    // 因素 1: 文件夹数量（越多 → 阈值越高）
    const folderCountFactor = Math.min(1.0, userStats.folderCount / 50);

    // 因素 2: 历史准确率（越高 → 阈值越低）
    const accuracyFactor = 1.0 - userStats.avgAccuracy;

    // 因素 3: 用户活跃度（越活跃 → 阈值越低）
    const activityFactor = 1.0 - Math.min(1.0, userStats.dailyClassifications / 20);

    // 因素 4: 误分类率（越高 → 阈值越高）
    const errorFactor = userStats.misclassificationRate;

    // 调整量（-0.1 到 +0.1）
    const adjustment =
      0.05 * folderCountFactor +
      0.03 * accuracyFactor +
      0.02 * activityFactor +
      0.05 * errorFactor -
      0.075; // 中心偏移

    // 限制在 [0.5, 0.9] 范围
    const newThreshold = currentThreshold + adjustment;
    return Math.max(0.5, Math.min(0.9, newThreshold));
  }
}
```

**✅ Step 3 完成标志**:
- 3 个模块所有文件实施完成（35 个服务文件 + 35 个测试文件）
- 单元测试覆盖率 ≥80%
- 集成测试通过（3 个模块协同工作）

---

### Step 4: API 层 + UI 层 (Week 4)

**工作目标**: 5 个 API 端点 + 6 个 UI 组件

#### 4.1 API Routes

**文件结构**:
```
src/app/api/classification/v5/
├── classify/
│   └── route.ts                     # POST /api/classification/v5/classify
├── folder-profiles/
│   └── route.ts                     # GET /api/classification/v5/folder-profiles
├── t1-stream/
│   └── route.ts                     # GET /api/classification/v5/t1-stream (SSE)
├── metrics/
│   └── route.ts                     # GET /api/classification/v5/metrics
└── gardener/
    └── route.ts                     # POST /api/classification/v5/gardener
```

**关键 API 实现**:

```typescript
// classify/route.ts - 主分类 API
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { bookmarkId } = await request.json();
    const userId = await getUserId(request);

    // Feature Flag 检查
    if (!featureFlagService.isV5Enabled(userId)) {
      // 降级到 v4.1
      return await classifyWithV4(bookmarkId);
    }

    // T0 快速生成
    const t0Result = await classificationPipeline.generateT0(bookmarkId);

    // 检查是否需要 T1 纠正
    if (llmCaller.shouldCallLLM(t0Result)) {
      // 加入 T1 队列（异步处理）
      await t1Queue.enqueue({
        bookmarkId,
        t0Result,
        triggerReason: 'low_confidence',
      });

      // 返回 T0 结果 + T1 pending 标志
      return NextResponse.json({
        folderId: t0Result.folderId,
        confidence: t0Result.confidence,
        t1Pending: true,
        t1StreamUrl: `/api/classification/v5/t1-stream?bookmarkId=${bookmarkId}`,
      });
    }

    // 只返回 T0 结果
    return NextResponse.json({
      folderId: t0Result.folderId,
      confidence: t0Result.confidence,
      t1Pending: false,
    });

  } catch (error) {
    // 降级处理
    if (error instanceof EmbeddingError || error instanceof VectorSearchError) {
      return await classifyWithDegradation(bookmarkId, error);
    }
    throw error;
  }
}
```

```typescript
// t1-stream/route.ts - SSE 流式推送 T1 结果
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bookmarkId = searchParams.get('bookmarkId');

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // 订阅 T1 队列更新
      const unsubscribe = t1Queue.subscribe(bookmarkId, (update) => {
        const data = `data: ${JSON.stringify(update)}\n\n`;
        controller.enqueue(encoder.encode(data));

        if (update.status === 'completed' || update.status === 'failed') {
          controller.close();
        }
      });

      // 客户端断开连接时清理
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

#### 4.2 UI 组件

**文件结构**:
```
src/components/classification/v5/
├── classification-card-v5.tsx       # 分类结果卡片
├── classification-card-v5.test.tsx
├── t1-notification.tsx              # T1 纠正通知
├── t1-notification.test.tsx
├── confidence-indicator.tsx         # 置信度指示器
├── confidence-indicator.test.tsx
├── folder-profile-list.tsx          # 文件夹画像列表
├── folder-profile-list.test.tsx
├── gardener-suggestions.tsx         # 园丁建议面板
├── gardener-suggestions.test.tsx
├── metrics-dashboard.tsx            # 指标仪表盘
└── metrics-dashboard.test.tsx
```

**关键 UI 组件**:

```tsx
// classification-card-v5.tsx
'use client';

import { useState, useEffect } from 'react';

export function ClassificationCardV5({ bookmarkId }: Props) {
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [t1Update, setT1Update] = useState<T1Update | null>(null);

  useEffect(() => {
    // 调用分类 API
    classifyBookmark(bookmarkId).then(setResult);
  }, [bookmarkId]);

  useEffect(() => {
    if (!result?.t1Pending) return;

    // 订阅 T1 SSE 流
    const eventSource = new EventSource(result.t1StreamUrl);

    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setT1Update(update);

      if (update.status === 'completed') {
        eventSource.close();
      }
    };

    return () => eventSource.close();
  }, [result]);

  return (
    <div className="classification-card">
      {result && (
        <>
          <FolderBadge folderId={result.folderId} />
          <ConfidenceIndicator confidence={result.confidence} />

          {result.t1Pending && !t1Update && (
            <T1PendingBadge />
          )}

          {t1Update?.status === 'completed' && (
            <T1Notification
              oldFolderId={result.folderId}
              newFolderId={t1Update.folderId}
              reasoning={t1Update.reasoning}
            />
          )}
        </>
      )}
    </div>
  );
}
```

**✅ Step 4 完成标志**:
- 5 个 API 端点实施完成
- 6 个 UI 组件实施完成
- SSE 流式推送正常工作
- Feature Flag 路由正确执行

---

### Step 5: Edge Functions + 后台任务 (Week 5)

**工作目标**: 2 个 Edge Functions + 1 个迁移脚本

#### 5.1 Edge Function 1: 文件夹画像后台更新

**文件路径**: `supabase/functions/update-folder-profiles-v5/index.ts`

```typescript
// supabase/functions/update-folder-profiles-v5/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 查询需要更新的文件夹画像
    const { data: profiles, error } = await supabase
      .from('classification_folder_profiles_v5')
      .select('*')
      .eq('needs_update', true)
      .limit(50); // 批量处理 50 个

    if (error) throw error;

    for (const profile of profiles) {
      // 重新计算双源向量
      const contentEmbedding = await generateContentEmbedding(profile.folderId);
      const behaviorEmbedding = await generateBehaviorEmbedding(profile.folderId);

      // 重新计算 α 系数
      const alpha = await calculateAlpha(profile.folderId);

      // 更新数据库
      await supabase
        .from('classification_folder_profiles_v5')
        .update({
          content_embedding: contentEmbedding,
          behavior_embedding: behaviorEmbedding,
          alpha_coefficient: alpha,
          needs_update: false,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
    }

    return new Response(
      JSON.stringify({ updated: profiles.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

**部署 Edge Function**:
```bash
supabase functions deploy update-folder-profiles-v5
```

**设置定时任务（Supabase Cron）**:
```sql
-- 每天凌晨 3 点执行
SELECT cron.schedule(
  'update-folder-profiles-v5',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/update-folder-profiles-v5',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  )
  $$
);
```

#### 5.2 Edge Function 2: T1 队列后台处理

**文件路径**: `supabase/functions/process-t1-corrections/index.ts`

```typescript
// supabase/functions/process-t1-corrections/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  try {
    // 查询 pending 状态的 T1 任务
    const { data: tasks } = await supabase
      .from('classification_t1_queue_v5')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10); // 批量处理 10 个

    for (const task of tasks) {
      // 更新状态为 processing
      await supabase
        .from('classification_t1_queue_v5')
        .update({ status: 'processing' })
        .eq('id', task.id);

      try {
        // 调用 LLM 进行 T1 纠正
        const result = await llmCaller.callLLM(
          task.bookmark_id,
          task.t0_candidates
        );

        // 更新为 completed
        await supabase
          .from('classification_t1_queue_v5')
          .update({
            status: 'completed',
            t1_folder_id: result.folderId,
            t1_confidence: result.confidence,
            t1_reasoning: result.reasoning,
            t1_timestamp: new Date().toISOString(),
          })
          .eq('id', task.id);

        // 发送 SSE 通知（通过 Realtime）
        await supabase
          .channel(`t1_updates:${task.bookmark_id}`)
          .send({
            type: 'broadcast',
            event: 't1_completed',
            payload: result,
          });

      } catch (error) {
        // 更新为 failed
        await supabase
          .from('classification_t1_queue_v5')
          .update({
            status: 'failed',
            error_message: error.message,
            retry_count: task.retry_count + 1,
          })
          .eq('id', task.id);
      }
    }

    return new Response(
      JSON.stringify({ processed: tasks.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

**部署 Edge Function**:
```bash
supabase functions deploy process-t1-corrections
```

**设置定时任务（每 5 分钟）**:
```sql
SELECT cron.schedule(
  'process-t1-corrections',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/process-t1-corrections',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  )
  $$
);
```

#### 5.3 数据迁移脚本（v4.1 → v5.0）

**文件路径**: `scripts/classification/migrate-v4-to-v5.ts`

```typescript
// scripts/classification/migrate-v4-to-v5.ts
import { createClient } from '@supabase/supabase-js';

async function migrateV4ToV5() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('开始迁移 v4.1 → v5.0...');

  // 1. 查询所有用户的文件夹
  const { data: folders } = await supabase
    .from('folders')
    .select('id, user_id, name, description');

  console.log(`找到 ${folders.length} 个文件夹`);

  // 2. 为每个文件夹生成初始画像
  for (const folder of folders) {
    console.log(`处理文件夹: ${folder.name}`);

    // 生成内容向量（基于文件夹内书签）
    const contentEmbedding = await generateInitialContentEmbedding(folder.id);

    // 生成行为向量（初始为零向量）
    const behaviorEmbedding = new Array(1024).fill(0);

    // 初始 α 系数 = 0.5
    const alpha = 0.5;

    // 插入 v5 画像表
    await supabase
      .from('classification_folder_profiles_v5')
      .insert({
        user_id: folder.user_id,
        folder_id: folder.id,
        content_embedding: contentEmbedding,
        behavior_embedding: behaviorEmbedding,
        alpha_coefficient: alpha,
        needs_update: false,
      });
  }

  console.log('迁移完成！');
}

async function generateInitialContentEmbedding(folderId: string): Promise<number[]> {
  // 1. 查询文件夹内所有书签
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('title, description, summary')
    .eq('folder_id', folderId)
    .limit(50);

  if (!bookmarks || bookmarks.length === 0) {
    // 空文件夹：使用文件夹名称生成向量
    return await embeddingService.generateEmbedding(folderName);
  }

  // 2. 合并所有书签文本
  const combinedText = bookmarks
    .map(b => `${b.title} ${b.description || ''} ${b.summary || ''}`)
    .join(' ')
    .slice(0, 8000); // OpenAI 限制

  // 3. 生成 Embedding
  return await embeddingService.generateEmbedding(combinedText);
}

// 执行迁移
migrateV4ToV5().catch(console.error);
```

**运行迁移脚本**:
```bash
# 开发环境
npx ts-node scripts/classification/migrate-v4-to-v5.ts

# 生产环境（需要人工确认）
NODE_ENV=production npx ts-node scripts/classification/migrate-v4-to-v5.ts
```

**✅ Step 5 完成标志**:
- 2 个 Edge Functions 部署成功
- 定时任务配置完成
- 数据迁移脚本执行成功（所有用户文件夹已初始化）

---

### Step 6: 灰度发布与监控 (Week 5-6)

**工作目标**: 6 步灰度发布 + 实时监控

#### 6.1 灰度发布计划

**阶段 1: 内部测试（0% → 1%）**

```bash
# .env.local
CLASSIFICATION_V5_ROLLOUT_PERCENTAGE=1  # 1% 用户

# 白名单（包含内部测试账号）
CLASSIFICATION_V5_WHITELIST=user-1,user-2,user-3
```

**验证指标**:
- T0 准确率 ≥85%
- T0 延迟 <500ms
- LLM 调用率 <30%
- 无 P0/P1 错误

**持续时间**: 2 天

---

**阶段 2: 早期用户（1% → 5%）**

```bash
CLASSIFICATION_V5_ROLLOUT_PERCENTAGE=5
```

**验证指标**:
- T0 准确率 ≥87%
- T1 准确率 ≥92%
- 用户反馈 NPS ≥70

**持续时间**: 3 天

---

**阶段 3: 小范围（5% → 20%）**

```bash
CLASSIFICATION_V5_ROLLOUT_PERCENTAGE=20
```

**验证指标**:
- 所有核心指标稳定
- 成本在预算内（Embedding $0.015/月, LLM $0.10/月）
- 降级触发率 <1%

**持续时间**: 5 天

---

**阶段 4: 半数用户（20% → 50%）**

```bash
CLASSIFICATION_V5_ROLLOUT_PERCENTAGE=50
```

**验证指标**:
- 准确率对比 v4.1 提升 >10%
- 用户满意度调查通过

**持续时间**: 7 天

---

**阶段 5: 大多数用户（50% → 100%）**

```bash
CLASSIFICATION_V5_ROLLOUT_PERCENTAGE=100
```

**验证指标**:
- 所有指标稳定 7 天以上
- 无回归问题

**持续时间**: 7 天

---

**阶段 6: 完全上线（100%）**

```bash
CLASSIFICATION_V5_ENABLED=true
CLASSIFICATION_V5_ROLLOUT_PERCENTAGE=100
```

**后续工作**:
- 下线 v4.1 代码（保留降级入口）
- 归档旧数据表（保留 90 天）

#### 6.2 监控指标配置

**关键指标（实时监控）**:

```typescript
// src/lib/classification/v5/metrics/metrics-recorder.ts
export class MetricsRecorder {
  async recordClassification(result: ClassificationResult) {
    await supabase.from('classification_metrics_v5').insert({
      user_id: result.userId,
      bookmark_id: result.bookmarkId,
      folder_id: result.folderId,
      stage: result.stage, // 'T0' | 'T1'
      latency_ms: result.latencyMs,
      confidence: result.confidence,
      embedding_tokens: result.embeddingTokens,
      llm_tokens: result.llmTokens,
      degradation_level: result.degradationLevel,
    });
  }

  async getMetricsSummary(userId: string, days: number = 7): Promise<Summary> {
    const { data } = await supabase
      .from('classification_metrics_v5')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    return {
      t0Accuracy: this.calculateAccuracy(data, 'T0'),
      t1Accuracy: this.calculateAccuracy(data, 'T1'),
      avgLatency: this.calculateAvgLatency(data),
      llmCallRate: this.calculateLLMCallRate(data),
      totalCost: this.calculateCost(data),
    };
  }
}
```

**Supabase Dashboard 查询**:

```sql
-- T0 准确率（最近 7 天）
SELECT
  AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) AS t0_accuracy
FROM classification_metrics_v5
WHERE stage = 'T0'
  AND created_at >= NOW() - INTERVAL '7 days'
  AND is_correct IS NOT NULL;

-- T0 平均延迟
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99
FROM classification_metrics_v5
WHERE stage = 'T0'
  AND created_at >= NOW() - INTERVAL '7 days';

-- LLM 调用率
SELECT
  COUNT(*) FILTER (WHERE stage = 'T1') * 1.0 / COUNT(*) AS llm_call_rate
FROM classification_metrics_v5
WHERE created_at >= NOW() - INTERVAL '7 days';

-- 成本统计
SELECT
  SUM(embedding_tokens) * 0.00002 / 1000 AS embedding_cost, -- $0.00002 per 1K tokens
  SUM(llm_tokens) * 0.0014 / 1000 AS llm_cost             -- $0.0014 per 1K tokens (DeepSeek)
FROM classification_metrics_v5
WHERE created_at >= NOW() - INTERVAL '30 days';
```

**告警规则（Sentry / Supabase）**:

| 指标             | 阈值          | 告警级别 |
| ---------------- | ------------- | -------- |
| T0 准确率        | <85%          | P1       |
| T1 准确率        | <92%          | P1       |
| T0 延迟 P95      | >800ms        | P2       |
| T1 延迟 P95      | >8s           | P2       |
| LLM 调用率       | >40%          | P2       |
| 降级触发率       | >5%           | P1       |
| Edge Function 失败率 | >10%      | P0       |

**✅ Step 6 完成标志**:
- 6 阶段灰度发布全部完成
- 所有监控指标稳定
- 用户反馈积极（NPS ≥70）
- 100% 用户已使用 v5.0

---

## ✅ 验证检查点

### Week 1 检查点

- [ ] 3 张数据表创建成功
- [ ] 6 个索引构建完成（包含 IVFFlat）
- [ ] 3 个 RLS 策略启用
- [ ] 5 个共享服务实施完成
- [ ] 环境变量配置完成

### Week 2-4 检查点

- [ ] Module A 实施完成（7 个文件）
- [ ] Module B 实施完成（12 个文件）
- [ ] Module C 实施完成（9 个文件）
- [ ] 单元测试覆盖率 ≥80%
- [ ] 集成测试通过

### Week 4 检查点

- [ ] 5 个 API 端点实施完成
- [ ] 6 个 UI 组件实施完成
- [ ] SSE 流式推送正常工作
- [ ] Feature Flag 路由正确

### Week 5 检查点

- [ ] 2 个 Edge Functions 部署成功
- [ ] 定时任务配置完成
- [ ] 数据迁移脚本执行成功

### Week 5-6 检查点

- [ ] 灰度发布 0% → 100% 完成
- [ ] 所有监控指标达标
- [ ] 无 P0/P1 错误
- [ ] 用户反馈积极

---

## 🔧 常见问题排查

### 问题 1: IVFFlat 索引构建失败

**错误信息**:
```
ERROR: index row size exceeds btree version 4 maximum
```

**原因**: pgvector 扩展未安装或版本过低

**解决方案**:
```sql
-- 安装 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 检查版本（需要 ≥0.5.0）
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

### 问题 2: T0 延迟 >500ms

**排查步骤**:

1. **检查 IVFFlat 索引是否生效**:
```sql
EXPLAIN ANALYZE
SELECT folder_id, 1 - (content_embedding <=> $1) AS similarity
FROM classification_folder_profiles_v5
WHERE user_id = $2
ORDER BY similarity DESC
LIMIT 5;

-- 应该看到 "Index Scan using ... ivfflat"
```

2. **检查向量缓存**（Week 2 补充）:
```typescript
// 添加 LRU 缓存
import LRU from 'lru-cache';

const vectorCache = new LRU<string, number[]>({
  max: 1000, // 缓存 1000 个文件夹画像
  ttl: 1000 * 60 * 60, // 1 小时过期
});
```

---

### 问题 3: LLM 调用率 >30%

**排查步骤**:

1. **检查置信度阈值**:
```typescript
// llm-caller.ts
if (t0Result.confidence < 0.75) return true; // 是否过高？尝试降低到 0.70
```

2. **检查向量冲突阈值**:
```typescript
const scoreDiff = top1Score - top2Score;
if (scoreDiff < 0.1) return true; // 是否过小？尝试提高到 0.15
```

---

### 问题 4: Edge Function 超时

**错误信息**:
```
Function execution timed out after 60000ms
```

**解决方案**:
```typescript
// 减少批量处理数量
const { data: tasks } = await supabase
  .from('classification_t1_queue_v5')
  .select('*')
  .eq('status', 'pending')
  .limit(5); // 从 10 改为 5
```

---

## 🚀 灰度发布指南

### 前置检查清单

- [ ] 所有单元测试通过（覆盖率 ≥80%）
- [ ] 所有集成测试通过
- [ ] E2E 测试通过（5+ 场景）
- [ ] 性能测试通过（T0 <500ms, T1 <5s）
- [ ] 数据迁移脚本已执行
- [ ] 监控告警已配置

### 灰度发布执行

**启动灰度（1%）**:
```bash
# 更新环境变量
CLASSIFICATION_V5_ROLLOUT_PERCENTAGE=1

# 重启应用
vercel --prod  # 或 docker restart anykeep
```

**监控关键指标（24 小时）**:
```bash
# 实时监控
watch -n 60 'curl https://your-app.com/api/classification/v5/metrics | jq'
```

**验证通过后提升到 5%**:
```bash
CLASSIFICATION_V5_ROLLOUT_PERCENTAGE=5
```

**重复上述流程直至 100%**

### 回滚操作

**紧急回滚（降回 0%）**:
```bash
# 立即禁用 v5.0
CLASSIFICATION_V5_ROLLOUT_PERCENTAGE=0

# 或直接禁用 Feature Flag
CLASSIFICATION_V5_ENABLED=false
```

**清理 T1 队列（可选）**:
```sql
-- 清空 pending 队列
DELETE FROM classification_t1_queue_v5
WHERE status = 'pending';
```

---

## 📚 参考资源

- **架构文档**: `_bmad-output/architecture-classification-v5.md`
- **需求文档**:
  - `docs/specs/智能分类0116（待开发）.md`
  - `docs/specs/smart-classification-v5-design.md`
  - `docs/specs/smart-classification-v5-complete.md`
- **对比评审**: `docs/specs/classification-v5-comparison-review.md`
- **落地保障**: `docs/specs/智能分类v5.0-落地保障方案.md`

---

## 🎯 成功标准

**实施完成标准**:
- ✅ 所有 73 个文件实施完成
- ✅ 3 张新表创建成功
- ✅ 单元测试覆盖率 ≥80%
- ✅ 集成测试通过
- ✅ 灰度发布 100% 完成

**质量目标**:
- ✅ T0 准确率 ≥85%
- ✅ T1 准确率 ≥92%
- ✅ T0 延迟 <500ms
- ✅ T1 延迟 <5s
- ✅ LLM 调用率 <30%
- ✅ 成本：Embedding ≤$0.015/月, LLM ≤$0.10/月

**用户体验**:
- ✅ NPS ≥70
- ✅ 分类准确度提升 >10%（vs v4.1）
- ✅ 无 P0/P1 线上事故

---

**文档更新**: 2026-01-16
**下一次审查**: 实施完成后（预计 Week 6）
