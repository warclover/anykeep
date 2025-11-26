# Phase 4: 语义搜索功能开发计划

## 文档信息

| 项目 | 内容 |
|------|------|
| **项目名称** | AnyKeep - Phase 4 语义搜索 |
| **文档版本** | v1.0 |
| **创建日期** | 2025-11-26 |
| **目标版本** | MVP V4.2 |
| **预计工期** | 3-4 天 |

---

## 已明确的决策

基于当前项目状态和 PRD V4.2，以下技术选型和架构决策已确定：

### 1. 技术选型
- ✅ **向量模型**: 阿里云百炼 `text-embedding-v3` (1536 维)
  - 理由: 国内服务稳定、OpenAI 兼容模式、新用户免费额度、中文效果好
- ✅ **向量数据库**: PostgreSQL + pgvector 扩展
  - 理由: 已在 `20251121000000_initial_schema.sql` 中启用
- ✅ **搜索策略**: 混合搜索（关键词 + 语义）
  - 理由: 结合精确匹配和语义理解，提升搜索体验

### 2. 已有基础设施
- ✅ 数据库 `bookmarks` 表已有 `embedding vector(1536)` 字段
- ✅ 全文搜索功能已实现 (`src/lib/utils/fulltext-search.ts`)
- ✅ AI 生成器已集成 DeepSeek API (`src/lib/utils/ai-generator.ts`)
- ✅ 搜索页面已预留 AI 搜索开关 (`src/app/(main)/search/page.tsx:49`)

### 3. API 提供商选择
- **嵌入服务**: 阿里云百炼 DashScope (OpenAI 兼容模式)
  - 模型: `text-embedding-v3` 或 `text-embedding-v4`
  - base_url: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **备选方案**:
  - 智谱 AI embedding-2 (免费额度)
  - 硅基流动 SiliconFlow (多模型可选)
  - Jina AI Embeddings (1M tokens/月免费)

---

## 整体规划概述

### 项目目标

为 AnyKeep 实现基于向量嵌入的语义搜索功能，让用户能够通过自然语言查询找到相关收藏，即使关键词不完全匹配。

**核心价值**：
1. 智能搜索：支持语义理解，如搜索"机器学习教程"可以找到"深度学习入门"
2. 混合搜索：结合关键词精确匹配和语义相似度，提升召回率
3. 用户体验：搜索响应时间 < 500ms，支持实时搜索建议

### 技术栈

| 技术层 | 使用技术 | 版本/配置 |
|--------|---------|----------|
| 前端 | Next.js App Router | 14+ |
| 后端 | Next.js API Routes | 14+ |
| 数据库 | PostgreSQL + pgvector | 扩展版本 0.5.0+ |
| 向量嵌入 | 阿里云百炼 DashScope | text-embedding-v3 (1536维) |
| 搜索算法 | 余弦相似度 + 全文搜索 | - |
| 类型系统 | TypeScript | 5+ |

### 主要阶段

本计划分为 **4 个主要阶段**，预计总工期 **3-4 天**：

1. **阶段 1：向量生成基础设施**（1 天）
   - 创建向量生成工具函数
   - 实现数据库向量搜索函数
   - 添加必要的数据库索引

2. **阶段 2：批量生成现有数据向量**（0.5 天）
   - 创建批量向量生成脚本
   - 为现有收藏生成并存储向量

3. **阶段 3：搜索 API 集成**（1 天）
   - 修改搜索 API 支持语义搜索
   - 实现混合搜索（关键词 + 语义）
   - 优化搜索排序算法

4. **阶段 4：前端集成与优化**（0.5-1 天）
   - 前端搜索页面集成
   - 性能优化与缓存
   - 测试与文档

---

## 详细任务分解

### 阶段 1：向量生成基础设施

#### 任务 1.1：创建 OpenAI Embedding 工具函数

**目标**：封装 OpenAI Embeddings API 调用，提供统一的向量生成接口

**输入**：
- 文本内容（标题 + 摘要 + 标签）
- 环境变量 `OPENAI_API_KEY`

**输出**：
- 1536 维浮点数向量数组

**涉及文件**：
- **新建**: `src/lib/utils/embedding-generator.ts`
- **修改**: `.env.local` (添加 DASHSCOPE_API_KEY)

**实现要点**：
```typescript
// src/lib/utils/embedding-generator.ts
export interface EmbeddingConfig {
  model: 'text-embedding-v3' | 'text-embedding-v4'
  dimensions: number  // 支持自定义维度，推荐 1536
}

// 阿里云百炼 API 配置 (OpenAI 兼容模式)
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

export async function generateEmbedding(
  text: string,
  config?: Partial<EmbeddingConfig>
): Promise<number[]> {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY 未配置')

  const response = await fetch(`${DASHSCOPE_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config?.model || 'text-embedding-v3',
      input: text,
      dimensions: config?.dimensions || 1536,
    }),
  })

  const data = await response.json()
  return data.data[0].embedding
}

// 批量生成（支持多个文本）
export async function generateEmbeddingsBatch(
  texts: string[],
  config?: Partial<EmbeddingConfig>
): Promise<number[][]>
```

**错误处理**：
- API 调用超时（15秒）
- Token 超限（自动截断）
- API Key 无效
- 费用配额耗尽

**预估工作量**：2 小时

---

#### 任务 1.2：创建数据库向量搜索函数

**目标**：创建 PostgreSQL 函数，实现高效的向量相似度搜索

**输入**：
- 查询向量 `query_embedding vector(1536)`
- 用户 ID `user_id uuid`
- 相似度阈值 `match_threshold float` (默认 0.7)
- 结果数量 `match_count int` (默认 20)

**输出**：
- 包含相似度分数的书签列表

**涉及文件**：
- **新建**: `supabase/migrations/20251126000001_add_semantic_search.sql`

**实现要点**：
```sql
-- 创建语义搜索函数
CREATE OR REPLACE FUNCTION search_bookmarks_semantic(
  query_embedding vector(1536),
  user_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id bigint,
  title varchar(500),
  url text,
  description text,
  cover_url text,
  platform varchar(50),
  ai_summary text,
  ai_tags text[],
  folder_id bigint,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.url,
    b.description,
    b.cover_url,
    b.platform,
    b.ai_summary,
    b.ai_tags,
    b.folder_id,
    b.created_at,
    1 - (b.embedding <=> query_embedding) as similarity
  FROM bookmarks b
  WHERE b.user_id = search_bookmarks_semantic.user_id
    AND b.deleted_at IS NULL
    AND b.embedding IS NOT NULL
    AND 1 - (b.embedding <=> query_embedding) > match_threshold
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 创建 HNSW 索引（高性能向量搜索）
CREATE INDEX IF NOT EXISTS idx_bookmarks_embedding_hnsw
ON public.bookmarks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 注释
COMMENT ON FUNCTION search_bookmarks_semantic IS '语义搜索书签，基于向量余弦相似度';
COMMENT ON INDEX idx_bookmarks_embedding_hnsw IS 'HNSW 向量索引，支持高效近似最近邻搜索';
```

**索引参数说明**：
- `m = 16`: 图的每个节点最多连接数（默认值，适合大多数场景）
- `ef_construction = 64`: 构建索引时的搜索深度（值越大精度越高但构建越慢）

**预估工作量**：2 小时

---

#### 任务 1.3：更新 TypeScript 类型定义

**目标**：更新类型定义，支持语义搜索相关字段

**输入**：
- 数据库迁移文件

**输出**：
- 更新的类型定义文件

**涉及文件**：
- **修改**: `src/types/supabase.ts`

**实现要点**：
```typescript
// 添加到 Database.public.Functions
export type Database = {
  public: {
    Functions: {
      search_bookmarks_semantic: {
        Args: {
          query_embedding: number[]
          user_id: string
          match_threshold?: number
          match_count?: number
        }
        Returns: Array<{
          id: number
          title: string
          url: string
          description: string | null
          cover_url: string | null
          platform: string
          ai_summary: string | null
          ai_tags: string[] | null
          folder_id: number | null
          created_at: string
          similarity: number
        }>
      }
    }
  }
}
```

**预估工作量**：0.5 小时

---

### 阶段 2：批量生成现有数据向量

#### 任务 2.1：创建批量向量生成脚本

**目标**：为现有的所有书签生成并存储向量嵌入

**输入**：
- 数据库中 `embedding IS NULL` 的所有书签

**输出**：
- 更新后的书签记录（包含 embedding 字段）
- 执行日志和统计信息

**涉及文件**：
- **新建**: `scripts/generate-embeddings-batch.ts`
- **新建**: `scripts/run-embedding-batch.sh`

**实现要点**：
```typescript
// scripts/generate-embeddings-batch.ts
import { createClient } from '@supabase/supabase-js'
import { generateEmbeddingsBatch } from '../src/lib/utils/embedding-generator'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // 使用服务端 Key
  )

  // 1. 获取所有没有向量的书签
  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('id, title, ai_summary, ai_tags')
    .is('embedding', null)
    .is('deleted_at', null)

  console.log(`找到 ${bookmarks?.length || 0} 条需要生成向量的书签`)

  // 2. 分批处理（OpenAI API 单次最多支持 2048 个输入）
  const BATCH_SIZE = 100
  const batches = chunk(bookmarks || [], BATCH_SIZE)

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    console.log(`处理批次 ${i + 1}/${batches.length}...`)

    // 准备文本（标题 + 摘要 + 标签）
    const texts = batch.map(b =>
      `${b.title} ${b.ai_summary || ''} ${(b.ai_tags || []).join(' ')}`
    )

    // 生成向量
    const embeddings = await generateEmbeddingsBatch(texts)

    // 更新数据库
    for (let j = 0; j < batch.length; j++) {
      await supabase
        .from('bookmarks')
        .update({ embedding: embeddings[j] })
        .eq('id', batch[j].id)
    }

    // 避免 API 速率限制
    await sleep(1000)
  }

  console.log('✅ 向量生成完成')
}

function chunk<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  )
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main()
```

**错误处理**：
- 记录失败的书签 ID
- 支持断点续传（跳过已有向量的记录）
- 输出详细的进度和错误日志

**预估工作量**：3 小时

---

#### 任务 2.2：修改书签创建流程

**目标**：在创建新书签时自动生成向量

**输入**：
- 新创建的书签数据

**输出**：
- 包含向量的完整书签记录

**涉及文件**：
- **修改**: `src/app/api/bookmarks/route.ts`

**实现要点**：
```typescript
// 在 POST /api/bookmarks 中添加
import { generateEmbedding } from '@/lib/utils/embedding-generator'

// ...（现有代码）

// 6. 生成 AI 摘要和标签后
const { summary, tags } = await generateAIContent({ ... })

// 7. 生成向量嵌入
let embedding: number[] | null = null
try {
  const embeddingText = `${finalTitle} ${summary} ${tags.join(' ')}`
  embedding = await generateEmbedding(embeddingText)
  logger.info({ action: 'embedding_generated' }, 'Embedding: Success')
} catch (error) {
  // 向量生成失败不影响书签创建
  logger.error({ error }, 'Embedding: Failed')
}

// 8. 插入数据库
const bookmarkData: BookmarkInsert = {
  // ...现有字段
  ai_summary: summary,
  ai_tags: tags,
  embedding: embedding, // 新增
  // ...
}
```

**预估工作量**：1 小时

---

### 阶段 3：搜索 API 集成

#### 任务 3.1：创建语义搜索 API 端点

**目标**：实现语义搜索和混合搜索逻辑

**输入**：
- 查询关键词 `q: string`
- 搜索模式 `mode?: 'keyword' | 'semantic' | 'hybrid'`
- 相似度阈值 `threshold?: number`

**输出**：
- 排序后的搜索结果列表

**涉及文件**：
- **修改**: `src/app/(main)/search/page.tsx`
- **新建**: `src/lib/utils/semantic-search.ts`

**实现要点**：
```typescript
// src/lib/utils/semantic-search.ts
import { generateEmbedding } from './embedding-generator'
import { searchBookmarksFulltext } from './fulltext-search'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SearchOptions {
  mode: 'keyword' | 'semantic' | 'hybrid'
  threshold?: number
  limit?: number
}

export async function searchBookmarks(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  options: SearchOptions = { mode: 'hybrid', threshold: 0.7, limit: 50 }
) {
  const { mode, threshold = 0.7, limit = 50 } = options

  if (mode === 'keyword') {
    // 仅关键词搜索
    return searchBookmarksFulltext(supabase, userId, query, limit)
  }

  if (mode === 'semantic') {
    // 仅语义搜索
    const queryEmbedding = await generateEmbedding(query)
    const { data, error } = await supabase.rpc('search_bookmarks_semantic', {
      query_embedding: queryEmbedding,
      user_id: userId,
      match_threshold: threshold,
      match_count: limit,
    })
    return { data, error }
  }

  // 混合搜索（默认）
  const [keywordResults, semanticResults] = await Promise.all([
    searchBookmarksFulltext(supabase, userId, query, limit),
    (async () => {
      const queryEmbedding = await generateEmbedding(query)
      return supabase.rpc('search_bookmarks_semantic', {
        query_embedding: queryEmbedding,
        user_id: userId,
        match_threshold: threshold,
        match_count: limit,
      })
    })(),
  ])

  // 合并结果（语义搜索优先，关键词搜索补充）
  const mergedResults = mergeSearchResults(
    semanticResults.data || [],
    keywordResults.data || []
  )

  return { data: mergedResults.slice(0, limit), error: null }
}

// 合并算法：语义相似度高的排前面，相同 ID 去重
function mergeSearchResults(semantic: any[], keyword: any[]) {
  const seen = new Set<number>()
  const merged = []

  // 1. 添加语义搜索结果（按相似度排序）
  for (const item of semantic) {
    if (!seen.has(item.id)) {
      merged.push({ ...item, source: 'semantic' })
      seen.add(item.id)
    }
  }

  // 2. 补充关键词搜索结果
  for (const item of keyword) {
    if (!seen.has(item.id)) {
      merged.push({ ...item, source: 'keyword', similarity: 0 })
      seen.add(item.id)
    }
  }

  return merged
}
```

**预估工作量**：3 小时

---

#### 任务 3.2：修改搜索页面集成语义搜索

**目标**：在搜索页面集成语义搜索开关

**输入**：
- 用户搜索查询
- AI 搜索开关状态

**输出**：
- 渲染的搜索结果

**涉及文件**：
- **修改**: `src/app/(main)/search/page.tsx`

**实现要点**：
```typescript
// src/app/(main)/search/page.tsx
import { searchBookmarks } from '@/lib/utils/semantic-search'

export default async function SearchPage({ searchParams }: SearchPageProps) {
  // ...现有代码

  if (params.q) {
    const validatedQuery = validationResult.data.q
    const isAISearch = params.ai === 'true'

    try {
      // 使用统一的搜索接口
      const { data, error } = await searchBookmarks(
        supabase,
        user.id,
        validatedQuery,
        {
          mode: isAISearch ? 'hybrid' : 'keyword',
          threshold: 0.7,
          limit: QUERY_LIMITS.SEARCH_RESULTS_PER_PAGE,
        }
      )

      if (error) throw error
      searchResults = data || []
    } catch (_error) {
      searchError = '搜索时出错，请稍后重试'
    }
  }

  // ...
}
```

**预估工作量**：1 小时

---

### 阶段 4：前端集成与优化

#### 任务 4.1：添加搜索模式切换 UI

**目标**：优化搜索页面 UI，提供清晰的搜索模式指示

**输入**：
- 用户交互（点击切换按钮）

**输出**：
- 更新的搜索结果

**涉及文件**：
- **修改**: `src/components/search/search-page-client.tsx`

**实现要点**：
- AI 搜索开关旁边显示"语义搜索"标签
- 搜索结果显示来源标签（语义/关键词）
- 添加相似度分数显示（仅语义搜索结果）

**预估工作量**：2 小时

---

#### 任务 4.2：性能优化

**目标**：优化搜索性能，确保响应时间 < 500ms

**优化策略**：

1. **向量生成缓存**：
   - 缓存常见查询的向量（使用 Redis 或内存缓存）
   - LRU 缓存策略，最多缓存 1000 个查询

2. **数据库查询优化**：
   - 确保 HNSW 索引已创建
   - 调整 `ef_search` 参数（查询时的搜索深度）

3. **并发请求优化**：
   - 关键词和语义搜索并行执行
   - 使用 `Promise.all` 减少等待时间

**涉及文件**：
- **新建**: `src/lib/cache/query-cache.ts`
- **修改**: `src/lib/utils/semantic-search.ts`

**预估工作量**：2 小时

---

#### 任务 4.3：测试与文档

**目标**：编写测试用例和使用文档

**测试用例**：

1. **单元测试**：
   - ✅ 向量生成函数正常工作
   - ✅ 向量维度正确（1536）
   - ✅ 错误处理（API Key 无效、网络超时）

2. **集成测试**：
   - ✅ 数据库函数返回正确结果
   - ✅ 混合搜索正确合并结果
   - ✅ 相似度阈值过滤有效

3. **端到端测试**：
   - ✅ 搜索页面切换 AI 搜索开关
   - ✅ 搜索结果正确显示
   - ✅ 性能满足要求（< 500ms）

**涉及文件**：
- **新建**: `__tests__/lib/utils/embedding-generator.test.ts`
- **新建**: `__tests__/lib/utils/semantic-search.test.ts`
- **修改**: `docs/plans/phase4-semantic-search-plan.md` (本文档)

**预估工作量**：3 小时

---

## 需要进一步明确的问题

### 问题 1：向量嵌入 API 选择 ✅ 已确定

**决策**: 使用 **阿里云百炼 DashScope** (`text-embedding-v3`)

**理由**:
- ✅ 国内服务稳定，无需翻墙
- ✅ OpenAI 兼容模式，代码改动最小
- ✅ 新用户免费额度充足
- ✅ 中文效果优秀
- ✅ 用户已有阿里云账号或可快速注册

**备选方案**: 智谱 AI、硅基流动、Jina AI

---

### 问题 2：相似度阈值设置

**背景**：相似度阈值决定搜索结果的精准度和召回率。

**推荐方案**：

- **方案 A：固定阈值 0.7**
  - 优点：简单、稳定
  - 缺点：无法适应不同场景

- **方案 B：动态阈值（根据结果数量调整）**
  - 优点：自适应、用户体验好
  - 缺点：实现复杂
  - 逻辑：如果结果 < 5 条，降低阈值到 0.6；如果结果 > 50 条，提高到 0.8

**等待用户选择**：

```
请选择您偏好的方案：
[ ] 方案 A - 固定阈值 0.7 (推荐，简单)
[ ] 方案 B - 动态阈值
```

---

### 问题 3：是否需要搜索历史和热门查询

**背景**：可以为用户提供搜索建议，提升体验。

**推荐方案**：

- **方案 A：仅当前阶段实现基础搜索**
  - 优点：专注核心功能、快速上线
  - **推荐**

- **方案 B：同步实现搜索历史**
  - 优点：提升用户体验
  - 缺点：增加开发时间（+1 天）
  - 需要新表：`search_history` (id, user_id, query, created_at)

**等待用户选择**：

```
是否需要在本阶段实现搜索历史？
[ ] 否，专注核心搜索功能 (推荐)
[ ] 是，同步实现搜索历史
```

---

## 数据库迁移脚本设计

### 迁移文件：`20251126000001_add_semantic_search.sql`

```sql
-- ===========================================
-- AnyKeep 语义搜索功能迁移
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-11-26
-- 说明: 添加向量搜索函数和索引

-- -------------------------------------------
-- 1. 创建语义搜索函数
-- -------------------------------------------

CREATE OR REPLACE FUNCTION search_bookmarks_semantic(
  query_embedding vector(1536),
  user_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id bigint,
  title varchar(500),
  url text,
  description text,
  cover_url text,
  platform varchar(50),
  ai_summary text,
  ai_tags text[],
  folder_id bigint,
  author varchar(200),
  publish_time timestamptz,
  content_type varchar(50),
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.url,
    b.description,
    b.cover_url,
    b.platform,
    b.ai_summary,
    b.ai_tags,
    b.folder_id,
    b.author,
    b.publish_time,
    b.content_type,
    b.created_at,
    1 - (b.embedding <=> query_embedding) as similarity
  FROM bookmarks b
  WHERE b.user_id = search_bookmarks_semantic.user_id
    AND b.deleted_at IS NULL
    AND b.embedding IS NOT NULL
    AND 1 - (b.embedding <=> query_embedding) > match_threshold
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 添加注释
COMMENT ON FUNCTION search_bookmarks_semantic IS
'语义搜索书签，基于向量余弦相似度。返回相似度 > match_threshold 的结果，按相似度降序排列。';

-- -------------------------------------------
-- 2. 创建 HNSW 向量索引
-- -------------------------------------------

-- 删除可能存在的旧索引
DROP INDEX IF EXISTS idx_bookmarks_embedding;

-- 创建 HNSW 索引（高性能近似最近邻搜索）
CREATE INDEX idx_bookmarks_embedding_hnsw
ON public.bookmarks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 添加注释
COMMENT ON INDEX idx_bookmarks_embedding_hnsw IS
'HNSW 向量索引，用于高效近似最近邻搜索。参数: m=16 (图连接数), ef_construction=64 (构建精度)';

-- -------------------------------------------
-- 3. 创建性能监控视图（可选）
-- -------------------------------------------

CREATE OR REPLACE VIEW embedding_stats AS
SELECT
  COUNT(*) as total_bookmarks,
  COUNT(embedding) as bookmarks_with_embedding,
  COUNT(*) - COUNT(embedding) as bookmarks_without_embedding,
  ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2) as embedding_coverage_percent
FROM bookmarks
WHERE deleted_at IS NULL;

COMMENT ON VIEW embedding_stats IS
'向量嵌入统计视图，用于监控向量覆盖率';

-- -------------------------------------------
-- 4. 授权（确保 authenticated 用户可调用）
-- -------------------------------------------

GRANT EXECUTE ON FUNCTION search_bookmarks_semantic TO authenticated;
GRANT SELECT ON embedding_stats TO authenticated;
```

### 回滚脚本：`20251126000001_add_semantic_search_rollback.sql`

```sql
-- 回滚语义搜索功能

-- 删除视图
DROP VIEW IF EXISTS embedding_stats;

-- 删除索引
DROP INDEX IF EXISTS idx_bookmarks_embedding_hnsw;

-- 删除函数
DROP FUNCTION IF EXISTS search_bookmarks_semantic;

-- 恢复原索引（如果需要）
-- CREATE INDEX idx_bookmarks_embedding ON public.bookmarks USING ivfflat (embedding vector_cosine_ops);
```

---

## API 接口设计

### 1. 搜索 API（已有，需修改）

**端点**: `GET /search?q={query}&ai={true|false}`

**请求参数**：
```typescript
interface SearchParams {
  q: string              // 搜索关键词（必填）
  ai?: 'true' | 'false'  // 是否启用 AI 搜索（默认 false）
  threshold?: number     // 相似度阈值（默认 0.7，范围 0-1）
  limit?: number         // 结果数量（默认 50）
}
```

**响应格式**：
```typescript
interface SearchResult {
  id: number
  title: string
  url: string
  description: string | null
  cover_url: string | null
  platform: string
  ai_summary: string | null
  ai_tags: string[] | null
  folder_id: number | null
  created_at: string
  similarity?: number    // 仅语义搜索结果有此字段
  source?: 'semantic' | 'keyword'  // 结果来源
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
  mode: 'keyword' | 'semantic' | 'hybrid'
  executionTime: number  // 查询耗时（毫秒）
}
```

### 2. 批量生成向量 API（内部使用）

**端点**: `POST /api/internal/embeddings/batch`

**请求体**：
```typescript
interface BatchEmbeddingRequest {
  bookmarkIds: number[]  // 书签 ID 列表
}
```

**响应**：
```typescript
interface BatchEmbeddingResponse {
  success: boolean
  processed: number
  failed: number
  errors?: Array<{ id: number; error: string }>
}
```

---

## 验收标准

### 功能验收

- [ ] **向量生成**
  - [ ] 新创建书签自动生成向量
  - [ ] 批量脚本成功为现有书签生成向量
  - [ ] 向量维度正确（1536）
  - [ ] 错误处理完善（API 失败不影响书签创建）

- [ ] **语义搜索**
  - [ ] 支持纯关键词搜索（mode=keyword）
  - [ ] 支持纯语义搜索（mode=semantic）
  - [ ] 支持混合搜索（mode=hybrid，默认）
  - [ ] 相似度阈值过滤有效
  - [ ] 结果按相似度排序

- [ ] **前端集成**
  - [ ] AI 搜索开关正常工作
  - [ ] 搜索结果正确显示
  - [ ] 显示结果来源标签（语义/关键词）
  - [ ] UI 响应流畅

### 性能验收

- [ ] **响应时间**
  - [ ] 搜索 API 响应时间 < 500ms (P95)
  - [ ] 向量生成时间 < 200ms (单个)
  - [ ] 批量向量生成 1000 条 < 5 分钟

- [ ] **准确性**
  - [ ] 语义搜索能找到相关但关键词不匹配的内容
  - [ ] 混合搜索结果优于纯关键词搜索
  - [ ] 相似度分数合理（0-1 范围）

### 质量验收

- [ ] **代码质量**
  - [ ] TypeScript 类型完整
  - [ ] 错误处理完善
  - [ ] 日志记录充分
  - [ ] 代码符合项目规范

- [ ] **测试覆盖**
  - [ ] 单元测试通过
  - [ ] 集成测试通过
  - [ ] 手动端到端测试通过

- [ ] **文档完整**
  - [ ] API 文档更新
  - [ ] 数据库迁移文档完整
  - [ ] 用户使用文档（如需）

---

## 风险评估与应对

### 技术风险

| 风险 | 等级 | 影响 | 应对措施 |
|------|------|------|----------|
| OpenAI API 费用超预算 | 中 | 成本增加 | 1. 使用免费的 Jina AI 备选<br>2. 设置 API 调用上限<br>3. 实现本地缓存 |
| pgvector 性能不足 | 低 | 搜索慢 | 1. 优化 HNSW 索引参数<br>2. 限制搜索数据量<br>3. 考虑专用向量数据库（Qdrant） |
| 向量生成失败 | 中 | 搜索功能不可用 | 1. 实现降级策略（仅关键词搜索）<br>2. 异步重试机制<br>3. 错误监控告警 |
| 批量生成超时 | 低 | 迁移时间长 | 1. 分批处理<br>2. 断点续传<br>3. 并行处理（注意 API 限流） |

### 业务风险

| 风险 | 等级 | 影响 | 应对措施 |
|------|------|------|----------|
| 用户感知不到 AI 搜索优势 | 中 | 功能价值低 | 1. 提供搜索示例<br>2. 显示相似度分数<br>3. 教育用户使用场景 |
| 搜索结果不准确 | 高 | 用户体验差 | 1. 调整相似度阈值<br>2. 优化混合搜索权重<br>3. 收集用户反馈迭代 |

---

## 成本估算

### 开发成本

- **开发时间**: 3-4 天
- **测试时间**: 0.5 天
- **总计**: 3.5-4.5 天

### API 调用成本（阿里云百炼）

**模型**: `text-embedding-v3`
**定价**: 新用户免费额度 + 超出后约 ¥0.0005/千tokens

| 场景 | Token 消耗 | 费用估算 |
|------|-----------|----------|
| 初始 1000 条书签 | ~200k tokens | 免费额度内 |
| 每天新增 50 条 | ~10k tokens | 免费额度内 |
| 每天 1000 次搜索 | ~100k tokens | ~¥0.05/天 |
| **月度总计** | ~3.2M tokens | **¥1.6/月** (超出免费额度后) |

**结论**：成本极低，新用户免费额度足够 MVP 阶段使用。

### 备选方案

| 服务商 | 免费额度 | 超额价格 | 优势 |
|--------|---------|---------|------|
| 智谱 AI | 新用户赠送 | ~¥0.0005/千tokens | 中文效果好 |
| 硅基流动 | 较多 | 更低 | 多模型可选 |
| Jina AI | 1M tokens/月 | $0.02/1M tokens | 免费额度高 |

---

## 里程碑与交付

### 第 1 天

- ✅ 任务 1.1: 创建 embedding-generator.ts
- ✅ 任务 1.2: 数据库迁移（搜索函数 + 索引）
- ✅ 任务 1.3: 更新 TypeScript 类型

**交付物**：
- 向量生成工具可用
- 数据库搜索函数可调用

### 第 2 天

- ✅ 任务 2.1: 批量向量生成脚本
- ✅ 任务 2.2: 修改书签创建流程

**交付物**：
- 现有书签已生成向量
- 新书签自动生成向量

### 第 3 天

- ✅ 任务 3.1: 语义搜索 API 实现
- ✅ 任务 3.2: 搜索页面集成

**交付物**：
- 搜索 API 支持语义搜索
- 前端可切换搜索模式

### 第 4 天

- ✅ 任务 4.1: UI 优化
- ✅ 任务 4.2: 性能优化
- ✅ 任务 4.3: 测试与文档

**交付物**：
- 功能完整可用
- 性能达标
- 文档完善

---

## 用户反馈区域

请在此区域补充您对整体规划的意见和建议：

```
用户补充内容：





```

---

## 附录

### A. 参考资料

- [pgvector 官方文档](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Jina AI Embeddings](https://jina.ai/embeddings/)
- [HNSW 算法论文](https://arxiv.org/abs/1603.09320)

### B. 相关文件清单

**新建文件**：
- `src/lib/utils/embedding-generator.ts`
- `src/lib/utils/semantic-search.ts`
- `src/lib/cache/query-cache.ts` (可选)
- `scripts/generate-embeddings-batch.ts`
- `scripts/run-embedding-batch.sh`
- `supabase/migrations/20251126000001_add_semantic_search.sql`
- `__tests__/lib/utils/embedding-generator.test.ts`
- `__tests__/lib/utils/semantic-search.test.ts`

**修改文件**：
- `src/app/(main)/search/page.tsx`
- `src/app/api/bookmarks/route.ts`
- `src/components/search/search-page-client.tsx`
- `src/types/supabase.ts`
- `.env.local` (添加 DASHSCOPE_API_KEY)

### C. 环境变量配置

在 `.env.local` 添加：

```bash
# 阿里云百炼 API Key（用于向量嵌入）
# 获取地址: https://dashscope.console.aliyun.com/apiKey
DASHSCOPE_API_KEY=sk-...

# 备选方案（任选其一）:
# 智谱 AI: ZHIPU_API_KEY=your-key
# 硅基流动: SILICONFLOW_API_KEY=your-key
# Jina AI: JINA_API_KEY=jina_...

# 语义搜索配置
EMBEDDING_MODEL=text-embedding-v3
EMBEDDING_DIMENSIONS=1536
SEMANTIC_SEARCH_THRESHOLD=0.7
```

---

**文档结束**

如有任何问题或需要调整，请在"用户反馈区域"补充意见。
