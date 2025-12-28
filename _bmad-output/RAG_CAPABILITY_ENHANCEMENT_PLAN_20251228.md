# AnyKeep RAG 能力补全方案

> **文档类型**: 技术实施方案
> **起草**: Winston (System Architect)
> **日期**: 2025-12-28
> **修订**: 2025-12-28 (Cohere → 阿里百炼 DashScope)
> **状态**: 待审核

---

## 一、执行摘要

### 当前状态

- **RAG 评分**: 5.6/10 (Phase 1.5 介于 Baseline 和 Advanced 之间)
- **核心差距**: 无 Parent-Child 切片、无交叉编码器重排、无查询改写

### 目标状态

- **目标评分**: 8.0/10 (达到 Phase 2 Advanced RAG 标准)
- **预计周期**: 3 周 (15 个工作日)
- **ROI 预期**: 搜索精度 +40%, 查询速度 +5x

### 优先级策略

采用**"快速 Win 优先"**策略，基于以下原则：

| 原则              | 说明                           |
| ----------------- | ------------------------------ |
| 🎯 **ROI 优先**   | 5 天工作量 → 40% 效果提升      |
| 🔒 **渐进式改造** | 不动现有数据结构，新增而非替换 |
| 🛡️ **低风险回滚** | Feature Flag 控制，可随时关闭  |
| 📊 **可度量**     | 每个阶段都有量化验收指标       |

---

## 二、实施阶段划分

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: 快速提升 (5 天)                                    │
│  ├─ P0-1: LLM 查询改写      [2 天]  召回率 +20%              │
│  ├─ P0-2: 百炼 Rerank       [2 天]  排序精度 +25%            │
│  └─ P0-3: 向量缓存层        [1 天]  查询速度 5x              │
├─────────────────────────────────────────────────────────────┤
│  Phase 2: 架构升级 (6 天)                                    │
│  ├─ P1-1: Parent-Child 切片 [4 天]  长文档精度 +30%          │
│  └─ P1-2: RRF 分数融合      [2 天]  混合搜索质量提升         │
├─────────────────────────────────────────────────────────────┤
│  Phase 3: 评估体系 (4 天)                                    │
│  ├─ P2-1: RAGAS 集成        [2 天]  建立基准线               │
│  └─ P2-2: 监控仪表盘        [2 天]  可视化 + 告警            │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、Phase 1: 快速提升 (5 天)

### P0-1: LLM 查询改写 (2 天)

**问题**: 用户模糊查询 → 召回率低
**方案**: 使用 DeepSeek 对查询进行语义扩展

#### 3.1.1 技术设计

```typescript
// src/lib/ai-agent/query/query-rewriter.ts

export interface QueryRewriteResult {
  original: string; // 原始查询
  rewritten: string; // 改写后查询
  synonyms: string[]; // 同义词扩展
  intent: string; // 识别的意图
  confidence: number; // 改写置信度
}

export class QueryRewriter {
  private readonly model = "deepseek-chat";

  async rewrite(
    query: string,
    context?: UserContext,
  ): Promise<QueryRewriteResult> {
    const prompt = this.buildRewritePrompt(query, context);
    const result = await this.callLLM(prompt);
    return this.parseResult(result);
  }

  private buildRewritePrompt(query: string, context?: UserContext): string {
    return `你是一个查询优化专家。用户的原始查询是："${query}"

任务：
1. 识别用户真实意图
2. 扩展同义词和相关术语
3. 生成更精确的搜索查询

${context ? `用户上下文：收藏 ${context.totalBookmarks} 条，常用平台：${context.topPlatforms.join(", ")}` : ""}

输出 JSON 格式：
{
  "intent": "用户意图描述",
  "rewritten": "改写后的查询",
  "synonyms": ["同义词1", "同义词2"],
  "confidence": 0.85
}`;
  }
}
```

#### 3.1.2 集成位置

```
现有搜索流程:
User Query → QueryParser → Hybrid Search → Ranker → Results

改造后:
User Query → QueryRewriter → QueryParser → Hybrid Search → Ranker → Results
               ↓
        扩展同义词, 明确意图
```

#### 3.1.3 修改文件清单

| 文件                                                  | 修改类型 | 说明                             |
| ----------------------------------------------------- | -------- | -------------------------------- |
| `src/lib/ai-agent/query/query-rewriter.ts`            | 新建     | 查询改写核心类                   |
| `src/lib/ai-agent/query/types.ts`                     | 新建     | 类型定义                         |
| `src/lib/ai-agent/query/index.ts`                     | 新建     | 模块导出                         |
| `src/lib/ai-skills/search/enhanced-search.service.ts` | 修改     | 集成 QueryRewriter               |
| `.env.local`                                          | 修改     | 添加 `ENABLE_QUERY_REWRITE=true` |

#### 3.1.4 Feature Flag

```typescript
// src/lib/ai-agent/config/feature-flags.ts
export const featureFlags = {
  // ... existing flags
  ENABLE_QUERY_REWRITE: process.env.ENABLE_QUERY_REWRITE === "true",
};
```

#### 3.1.5 验收指标

| 指标           | 基准值 | 目标值  | 测试方法      |
| -------------- | ------ | ------- | ------------- |
| 模糊查询召回率 | 45%    | 65%     | 50 条测试用例 |
| 查询改写延迟   | N/A    | < 500ms | P95 延迟监控  |
| 改写准确率     | N/A    | > 80%   | 人工抽样评估  |

---

### P0-2: 阿里百炼 DashScope Rerank 集成 (2 天)

**问题**: 静态权重排序 → 语义相关性差
**方案**: 集成阿里百炼 DashScope Text Rerank API 作为后处理阶段

> **选型理由**:
>
> - ✅ 国内网络稳定，无需翻墙
> - ✅ 支持中文、英文、日语等 50+ 语言
> - ✅ 支持最多 4000 token 的文档
> - ✅ 已有百炼账号，可直接使用
> - ✅ 支付宝付款，企业合规

#### 3.2.1 技术设计

```typescript
// src/lib/ai-agent/rerank/dashscope-reranker.ts

import { createLogger } from "@/lib/logger";

const logger = createLogger("dashscope-reranker");

export interface DashScopeRerankConfig {
  model: "gte-rerank"; // 阿里 GTE Rerank 模型
  topK: number;
  returnDocuments: boolean;
}

export interface RerankResult {
  index: number;
  relevanceScore: number;
  document?: string;
}

export interface DashScopeRerankResponse {
  output: {
    results: Array<{
      index: number;
      relevance_score: number;
      document?: { text: string };
    }>;
  };
  usage: {
    total_tokens: number;
  };
  request_id: string;
}

export class DashScopeReranker {
  private apiKey: string;
  private baseUrl =
    "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/rerank";
  private config: DashScopeRerankConfig;

  constructor(config?: Partial<DashScopeRerankConfig>) {
    this.apiKey = process.env.DASHSCOPE_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("DASHSCOPE_API_KEY is required");
    }

    this.config = {
      model: "gte-rerank",
      topK: 10,
      returnDocuments: false,
      ...config,
    };
  }

  async rerank(query: string, documents: string[]): Promise<RerankResult[]> {
    if (documents.length === 0) return [];

    // DashScope 限制: 每个文档最多 4000 token
    const truncatedDocs = documents.map(
      (doc) => (doc.length > 8000 ? doc.slice(0, 8000) : doc), // 保守估计 2 字符/token
    );

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          input: {
            query,
            documents: truncatedDocs,
          },
          parameters: {
            top_n: this.config.topK,
            return_documents: this.config.returnDocuments,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error("DashScope Rerank API error", {
          status: response.status,
          error,
        });
        throw new Error(`DashScope API error: ${response.status}`);
      }

      const data: DashScopeRerankResponse = await response.json();

      logger.debug("DashScope Rerank completed", {
        query: query.slice(0, 50),
        inputDocs: documents.length,
        outputDocs: data.output.results.length,
        tokensUsed: data.usage.total_tokens,
      });

      return data.output.results.map((r) => ({
        index: r.index,
        relevanceScore: r.relevance_score,
        document: r.document?.text,
      }));
    } catch (error) {
      logger.error("DashScope Rerank failed", { error });
      // 降级: 返回原始顺序
      return documents.map((_, index) => ({
        index,
        relevanceScore: 1 - index / documents.length, // 线性衰减
      }));
    }
  }
}

// 单例导出
let rerankerInstance: DashScopeReranker | null = null;

export function getDashScopeReranker(): DashScopeReranker {
  if (!rerankerInstance) {
    rerankerInstance = new DashScopeReranker();
  }
  return rerankerInstance;
}
```

#### 3.2.2 LangChain 集成方式（备选）

如果后续需要更深度的 LangChain 集成：

```typescript
// src/lib/ai-agent/rerank/langchain-dashscope.ts

import { ContextualCompressionRetriever } from "langchain/retrievers/contextual_compression";
import { DashScopeRerank } from "langchain_community/document_compressors/dashscope_rerank";

// LangChain 方式（需安装 langchain 依赖）
export function createRerankRetriever(baseRetriever: any) {
  const compressor = new DashScopeRerank({
    apiKey: process.env.DASHSCOPE_API_KEY,
    model: "gte-rerank",
    topN: 10,
  });

  return new ContextualCompressionRetriever({
    baseCompressor: compressor,
    baseRetriever,
  });
}
```

#### 3.2.3 集成位置

```
现有排序流程:
Hybrid Search Results → ResultRanker (静态权重) → Top N

改造后:
Hybrid Search Results → Pre-filter (Top 50) → DashScopeReranker → ResultRanker → Top N
                                                      ↓
                                            GTE 交叉编码器语义排序
```

#### 3.2.4 修改文件清单

| 文件                                            | 修改类型 | 说明                                           |
| ----------------------------------------------- | -------- | ---------------------------------------------- |
| `src/lib/ai-agent/rerank/dashscope-reranker.ts` | 新建     | Reranker 核心类                                |
| `src/lib/ai-agent/rerank/types.ts`              | 新建     | 类型定义                                       |
| `src/lib/ai-agent/rerank/index.ts`              | 新建     | 模块导出                                       |
| `src/lib/ai-skills/search/result-ranker.ts`     | 修改     | 集成 Reranker                                  |
| `.env.local`                                    | 修改     | 添加 `DASHSCOPE_API_KEY`, `ENABLE_RERANK=true` |

#### 3.2.5 成本控制

| 模型       | 计费方式 | 价格            | 预算控制              |
| ---------- | -------- | --------------- | --------------------- |
| gte-rerank | 按 Token | ¥0.001/千 Token | 每日上限 100 万 Token |

```typescript
// src/lib/ai-agent/rerank/usage-tracker.ts

interface UsageStats {
  dailyTokens: number;
  dailyRequests: number;
  lastResetDate: string;
}

export class RerankUsageTracker {
  private stats: UsageStats = {
    dailyTokens: 0,
    dailyRequests: 0,
    lastResetDate: new Date().toISOString().split("T")[0],
  };

  private readonly dailyTokenLimit = 1_000_000; // 100 万 Token/天

  async trackUsage(tokensUsed: number): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    // 跨天重置
    if (this.stats.lastResetDate !== today) {
      this.stats = {
        dailyTokens: 0,
        dailyRequests: 0,
        lastResetDate: today,
      };
    }

    this.stats.dailyTokens += tokensUsed;
    this.stats.dailyRequests++;

    if (this.stats.dailyTokens >= this.dailyTokenLimit * 0.8) {
      logger.warn("Rerank daily token usage at 80%", this.stats);
    }
  }

  canMakeRequest(): boolean {
    return this.stats.dailyTokens < this.dailyTokenLimit;
  }

  getStats(): UsageStats {
    return { ...this.stats };
  }
}
```

#### 3.2.6 环境变量配置

```bash
# .env.local

# 阿里百炼 DashScope API
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# Feature Flag
ENABLE_RERANK=true
```

#### 3.2.7 验收指标

| 指标               | 基准值 | 目标值  | 测试方法                     |
| ------------------ | ------ | ------- | ---------------------------- |
| 排序精度 (NDCG@10) | 0.65   | 0.82    | 标注数据集评估               |
| Rerank 延迟        | N/A    | < 200ms | P95 延迟监控（国内网络更快） |
| 首结果点击率       | 35%    | 50%     | 用户行为追踪                 |

---

### P0-3: 向量缓存层 (1 天)

**问题**: 每次搜索都请求向量 API → 延迟高
**方案**: 使用 LRU 缓存常用查询向量

#### 3.3.1 技术设计

```typescript
// src/lib/cache/vector-cache.ts

import { LRUCache } from "lru-cache";

export interface VectorCacheConfig {
  maxSize: number; // 最大缓存条目
  ttlMs: number; // 过期时间
  updateAgeOnGet: boolean; // 访问时刷新 TTL
}

export class VectorCache {
  private cache: LRUCache<string, number[]>;

  constructor(config?: Partial<VectorCacheConfig>) {
    const options = {
      max: config?.maxSize ?? 10000,
      ttl: config?.ttlMs ?? 1000 * 60 * 60 * 24, // 24 小时
      updateAgeOnGet: config?.updateAgeOnGet ?? true,
    };

    this.cache = new LRUCache(options);
  }

  async getOrGenerate(
    text: string,
    generator: (text: string) => Promise<number[]>,
  ): Promise<number[]> {
    const cacheKey = this.hashText(text);

    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug("Vector cache hit", { text: text.slice(0, 50) });
      return cached;
    }

    const vector = await generator(text);
    this.cache.set(cacheKey, vector);
    return vector;
  }

  private hashText(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.cache.stats?.hits ?? 0,
      misses: this.cache.stats?.misses ?? 0,
      hitRate: this.cache.stats
        ? this.cache.stats.hits /
          (this.cache.stats.hits + this.cache.stats.misses)
        : 0,
    };
  }
}

// 单例导出
export const vectorCache = new VectorCache();
```

#### 3.3.2 集成位置

```typescript
// src/lib/utils/embedding-generator.ts 修改

import { vectorCache } from "@/lib/cache/vector-cache";

export async function generateEmbedding(text: string): Promise<number[]> {
  if (featureFlags.ENABLE_VECTOR_CACHE) {
    return vectorCache.getOrGenerate(text, generateEmbeddingInternal);
  }
  return generateEmbeddingInternal(text);
}
```

#### 3.3.3 修改文件清单

| 文件                                   | 修改类型 | 说明                            |
| -------------------------------------- | -------- | ------------------------------- |
| `src/lib/cache/vector-cache.ts`        | 新建     | 缓存核心类                      |
| `src/lib/cache/types.ts`               | 新建     | 类型定义                        |
| `src/lib/cache/index.ts`               | 新建     | 模块导出                        |
| `src/lib/utils/embedding-generator.ts` | 修改     | 集成缓存                        |
| `package.json`                         | 修改     | 添加 `lru-cache` 依赖           |
| `.env.local`                           | 修改     | 添加 `ENABLE_VECTOR_CACHE=true` |

#### 3.3.4 验收指标

| 指标          | 基准值 | 目标值 | 测试方法     |
| ------------- | ------ | ------ | ------------ |
| 缓存命中率    | 0%     | > 60%  | 缓存统计 API |
| 搜索 P50 延迟 | 800ms  | 150ms  | APM 监控     |
| 搜索 P95 延迟 | 1500ms | 400ms  | APM 监控     |

---

## 四、Phase 2: 架构升级 (6 天)

### P1-1: Parent-Child 切片策略 (4 天)

**问题**: 长文档整体嵌入 → 无法定位具体段落
**方案**: 实现语义分块，支持 Parent-Child 索引

#### 4.1.1 数据库 Schema

```sql
-- supabase/migrations/20251229000001_add_bookmark_chunks.sql

-- 切片表
CREATE TABLE bookmark_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  parent_chunk_id UUID REFERENCES bookmark_chunks(id) ON DELETE CASCADE,

  -- 切片内容
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL, -- 用于去重

  -- 切片元数据
  chunk_type VARCHAR(20) DEFAULT 'child' CHECK (chunk_type IN ('parent', 'child')),
  token_count INT NOT NULL,
  start_offset INT, -- 在原文中的起始位置
  end_offset INT,   -- 在原文中的结束位置

  -- 向量嵌入
  embedding VECTOR(1024),
  embedding_version VARCHAR(20),

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  CONSTRAINT unique_chunk_index UNIQUE (bookmark_id, chunk_index)
);

-- HNSW 向量索引
CREATE INDEX idx_chunks_embedding ON bookmark_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 查询优化索引
CREATE INDEX idx_chunks_bookmark_id ON bookmark_chunks(bookmark_id);
CREATE INDEX idx_chunks_parent_id ON bookmark_chunks(parent_chunk_id);
CREATE INDEX idx_chunks_type ON bookmark_chunks(chunk_type);
CREATE INDEX idx_chunks_content_hash ON bookmark_chunks(content_hash);

-- RLS 策略
ALTER TABLE bookmark_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chunks" ON bookmark_chunks
  FOR SELECT
  USING (bookmark_id IN (
    SELECT id FROM bookmarks WHERE user_id = auth.uid()
  ));

-- 切片搜索函数
CREATE OR REPLACE FUNCTION search_bookmark_chunks(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 20,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  chunk_id UUID,
  bookmark_id UUID,
  chunk_content TEXT,
  chunk_type VARCHAR(20),
  parent_content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.bookmark_id,
    c.content AS chunk_content,
    c.chunk_type,
    COALESCE(p.content, c.content) AS parent_content, -- 返回 parent 上下文
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM bookmark_chunks c
  LEFT JOIN bookmark_chunks p ON c.parent_chunk_id = p.id
  JOIN bookmarks b ON c.bookmark_id = b.id
  WHERE b.user_id = p_user_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

#### 4.1.2 语义切片器

```typescript
// src/lib/chunking/semantic-chunker.ts

export interface ChunkConfig {
  maxTokens: number; // 单个 chunk 最大 token 数
  overlapTokens: number; // 重叠 token 数
  splitByHeaders: boolean; // 是否按标题分割
  preserveCodeBlocks: boolean; // 是否保留代码块完整性
}

export interface Chunk {
  content: string;
  index: number;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
  parentIndex?: number; // Parent chunk 索引
  type: "parent" | "child";
}

export class SemanticChunker {
  private config: ChunkConfig;

  constructor(config?: Partial<ChunkConfig>) {
    this.config = {
      maxTokens: 256, // Child chunk 大小
      overlapTokens: 32, // 重叠保持上下文
      splitByHeaders: true,
      preserveCodeBlocks: true,
      ...config,
    };
  }

  /**
   * 对文本进行 Parent-Child 切片
   * Parent: 完整段落/章节 (用于上下文)
   * Child: 小块 (用于精准检索)
   */
  chunk(text: string): Chunk[] {
    const chunks: Chunk[] = [];

    // Step 1: 按段落/标题拆分 Parent
    const parents = this.splitIntoParents(text);

    let chunkIndex = 0;

    for (let i = 0; i < parents.length; i++) {
      const parent = parents[i];

      // 创建 Parent chunk
      const parentChunk: Chunk = {
        content: parent.content,
        index: chunkIndex++,
        tokenCount: this.estimateTokens(parent.content),
        startOffset: parent.startOffset,
        endOffset: parent.endOffset,
        type: "parent",
      };
      chunks.push(parentChunk);

      // Step 2: 将 Parent 拆分为多个 Child
      const children = this.splitIntoChildren(
        parent.content,
        parent.startOffset,
      );

      for (const child of children) {
        chunks.push({
          ...child,
          index: chunkIndex++,
          parentIndex: parentChunk.index,
          type: "child",
        });
      }
    }

    return chunks;
  }

  private splitIntoParents(
    text: string,
  ): Array<{ content: string; startOffset: number; endOffset: number }> {
    const parents: Array<{
      content: string;
      startOffset: number;
      endOffset: number;
    }> = [];

    if (this.config.splitByHeaders) {
      // 按 Markdown 标题分割
      const headerPattern = /^(#{1,6})\s+(.+)$/gm;
      let lastEnd = 0;
      let match;

      while ((match = headerPattern.exec(text)) !== null) {
        if (match.index > lastEnd) {
          const content = text.slice(lastEnd, match.index).trim();
          if (content) {
            parents.push({
              content,
              startOffset: lastEnd,
              endOffset: match.index,
            });
          }
        }
        lastEnd = match.index;
      }

      // 最后一段
      if (lastEnd < text.length) {
        parents.push({
          content: text.slice(lastEnd).trim(),
          startOffset: lastEnd,
          endOffset: text.length,
        });
      }
    } else {
      // 按段落分割
      const paragraphs = text.split(/\n\n+/);
      let offset = 0;

      for (const para of paragraphs) {
        if (para.trim()) {
          parents.push({
            content: para.trim(),
            startOffset: offset,
            endOffset: offset + para.length,
          });
        }
        offset += para.length + 2; // +2 for \n\n
      }
    }

    return parents;
  }

  private splitIntoChildren(text: string, baseOffset: number): Chunk[] {
    const children: Chunk[] = [];
    const tokens = this.tokenize(text);

    let i = 0;
    while (i < tokens.length) {
      const chunkTokens = tokens.slice(i, i + this.config.maxTokens);
      const content = chunkTokens.join("");

      children.push({
        content,
        index: -1, // Will be assigned later
        tokenCount: chunkTokens.length,
        startOffset: baseOffset + i,
        endOffset: baseOffset + i + content.length,
        type: "child",
      });

      i += this.config.maxTokens - this.config.overlapTokens;
    }

    return children;
  }

  private tokenize(text: string): string[] {
    // 简单分词：中文按字，英文按词
    return (
      text.match(/[\u4e00-\u9fff]|[a-zA-Z]+|\d+|[^\s\u4e00-\u9fff\w]+|\s+/g) ||
      []
    );
  }

  private estimateTokens(text: string): number {
    const tokens = this.tokenize(text);
    return tokens.length;
  }
}
```

#### 4.1.3 切片服务

```typescript
// src/lib/chunking/chunk-service.ts

export class ChunkService {
  private chunker: SemanticChunker;
  private embeddingGenerator: EmbeddingGenerator;

  constructor() {
    this.chunker = new SemanticChunker();
    this.embeddingGenerator = new EmbeddingGenerator();
  }

  /**
   * 为书签创建切片
   * 适用于：新书签创建、内容更新、批量重建
   */
  async createChunksForBookmark(
    bookmarkId: string,
    content: string,
  ): Promise<void> {
    // 1. 生成切片
    const chunks = this.chunker.chunk(content);

    // 2. 批量生成向量 (只为 child 生成，parent 用于上下文)
    const childChunks = chunks.filter((c) => c.type === "child");
    const embeddings = await this.embeddingGenerator.batchGenerate(
      childChunks.map((c) => c.content),
    );

    // 3. 存储到数据库
    const chunkRecords = chunks.map((chunk, i) => ({
      bookmark_id: bookmarkId,
      chunk_index: chunk.index,
      content: chunk.content,
      content_hash: this.hashContent(chunk.content),
      chunk_type: chunk.type,
      token_count: chunk.tokenCount,
      start_offset: chunk.startOffset,
      end_offset: chunk.endOffset,
      parent_chunk_id:
        chunk.parentIndex !== undefined
          ? null // 需要后续更新关联
          : null,
      embedding:
        chunk.type === "child"
          ? embeddings[childChunks.findIndex((c) => c.index === chunk.index)]
          : null,
    }));

    // 4. 批量插入
    const { data, error } = await supabase
      .from("bookmark_chunks")
      .upsert(chunkRecords, {
        onConflict: "bookmark_id,chunk_index",
        ignoreDuplicates: false,
      })
      .select("id, chunk_index, chunk_type");

    if (error) throw error;

    // 5. 更新 parent-child 关联
    await this.updateParentChildRelations(bookmarkId, chunks, data);
  }

  private hashContent(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private async updateParentChildRelations(
    bookmarkId: string,
    chunks: Chunk[],
    insertedData: Array<{
      id: string;
      chunk_index: number;
      chunk_type: string;
    }>,
  ): Promise<void> {
    const indexToId = new Map(insertedData.map((d) => [d.chunk_index, d.id]));

    const updates = chunks
      .filter((c) => c.parentIndex !== undefined)
      .map((c) => ({
        id: indexToId.get(c.index),
        parent_chunk_id: indexToId.get(c.parentIndex!),
      }))
      .filter((u) => u.id && u.parent_chunk_id);

    if (updates.length > 0) {
      for (const update of updates) {
        await supabase
          .from("bookmark_chunks")
          .update({ parent_chunk_id: update.parent_chunk_id })
          .eq("id", update.id);
      }
    }
  }
}
```

#### 4.1.4 搜索集成

```typescript
// src/lib/ai-skills/search/chunk-search.service.ts

export class ChunkSearchService {
  /**
   * 基于切片的语义搜索
   * 返回 Child 用于精准匹配，同时返回 Parent 上下文
   */
  async searchChunks(
    query: string,
    options: SearchOptions,
  ): Promise<ChunkSearchResult[]> {
    // 1. 生成查询向量
    const queryEmbedding = await vectorCache.getOrGenerate(
      query,
      generateEmbedding,
    );

    // 2. 调用切片搜索 RPC
    const { data, error } = await supabase.rpc("search_bookmark_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: options.threshold ?? 0.5,
      match_count: options.limit ?? 20,
    });

    if (error) throw error;

    // 3. 结果增强：去重、合并同一书签的多个切片
    return this.mergeChunkResults(data);
  }

  private mergeChunkResults(chunks: RawChunkResult[]): ChunkSearchResult[] {
    const bookmarkMap = new Map<string, ChunkSearchResult>();

    for (const chunk of chunks) {
      if (!bookmarkMap.has(chunk.bookmark_id)) {
        bookmarkMap.set(chunk.bookmark_id, {
          bookmarkId: chunk.bookmark_id,
          matchedChunks: [],
          parentContext: chunk.parent_content,
          maxSimilarity: chunk.similarity,
        });
      }

      const result = bookmarkMap.get(chunk.bookmark_id)!;
      result.matchedChunks.push({
        content: chunk.chunk_content,
        similarity: chunk.similarity,
      });
      result.maxSimilarity = Math.max(result.maxSimilarity, chunk.similarity);
    }

    return Array.from(bookmarkMap.values()).sort(
      (a, b) => b.maxSimilarity - a.maxSimilarity,
    );
  }
}
```

#### 4.1.5 修改文件清单

| 文件                                                         | 修改类型 | 说明               |
| ------------------------------------------------------------ | -------- | ------------------ |
| `supabase/migrations/20251229000001_add_bookmark_chunks.sql` | 新建     | 数据库迁移         |
| `src/lib/chunking/semantic-chunker.ts`                       | 新建     | 语义切片器         |
| `src/lib/chunking/chunk-service.ts`                          | 新建     | 切片服务           |
| `src/lib/chunking/types.ts`                                  | 新建     | 类型定义           |
| `src/lib/chunking/index.ts`                                  | 新建     | 模块导出           |
| `src/lib/ai-skills/search/chunk-search.service.ts`           | 新建     | 切片搜索           |
| `src/lib/ai-skills/search/enhanced-search.service.ts`        | 修改     | 集成切片搜索       |
| `src/app/api/bookmarks/route.ts`                             | 修改     | 创建书签时生成切片 |

#### 4.1.6 迁移策略

```
Phase A: 新增数据 (Day 1-2)
├─ 新书签自动生成切片
├─ 切片搜索与现有搜索并行
└─ Feature Flag 控制切换

Phase B: 存量数据迁移 (Day 3-4)
├─ 后台批量任务处理历史书签
├─ 优先处理：最近 30 天活跃书签
├─ 进度追踪 API
└─ 可断点续传

Phase C: 切换验证 (Day 4)
├─ A/B 测试：10% 流量使用切片搜索
├─ 监控指标对比
└─ 全量切换或回滚
```

#### 4.1.7 验收指标

| 指标           | 基准值 | 目标值 | 测试方法               |
| -------------- | ------ | ------ | ---------------------- |
| 长文档搜索精度 | 55%    | 85%    | 人工标注测试集         |
| 段落定位准确率 | 0%     | 75%    | "第三段讲了什么"类查询 |
| 切片生成延迟   | N/A    | < 2s   | 性能监控               |

---

### P1-2: RRF 分数融合 (2 天)

**问题**: 向量分数和全文分数无法直接比较
**方案**: 实现 Reciprocal Rank Fusion (RRF) 标准融合算法

#### 4.2.1 技术设计

```typescript
// src/lib/ai-skills/search/rrf-fusion.ts

/**
 * Reciprocal Rank Fusion (RRF) 算法
 * 标准公式: score = Σ 1/(k + rank)
 * 其中 k 通常取 60
 */
export class RRFFusion {
  private readonly k: number;

  constructor(k: number = 60) {
    this.k = k;
  }

  /**
   * 融合多个排序列表
   * @param rankings - 多个排序列表，每个列表按相关性降序排列
   * @returns 融合后的排序结果
   */
  fuse(rankings: RankingList[]): FusedResult[] {
    const scoreMap = new Map<string, { score: number; sources: string[] }>();

    for (const ranking of rankings) {
      for (let rank = 0; rank < ranking.items.length; rank++) {
        const item = ranking.items[rank];
        const rrfScore = 1 / (this.k + rank + 1); // rank 从 0 开始

        const existing = scoreMap.get(item.id);
        if (existing) {
          existing.score += rrfScore;
          existing.sources.push(ranking.source);
        } else {
          scoreMap.set(item.id, {
            score: rrfScore,
            sources: [ranking.source],
          });
        }
      }
    }

    // 按融合分数排序
    return Array.from(scoreMap.entries())
      .map(([id, { score, sources }]) => ({ id, score, sources }))
      .sort((a, b) => b.score - a.score);
  }
}

export interface RankingList {
  source: string; // 'vector' | 'fulltext' | 'title' | 'tag'
  items: Array<{ id: string; originalScore: number }>;
}

export interface FusedResult {
  id: string;
  score: number;
  sources: string[]; // 来自哪些检索方法
}
```

#### 4.2.2 集成到混合搜索

```typescript
// src/lib/ai-skills/search/enhanced-search.service.ts 修改

export class EnhancedSearchService {
  private rrfFusion = new RRFFusion();

  async searchHybrid(
    query: string,
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    // 并行执行多路检索
    const [vectorResults, fulltextResults, titleResults] = await Promise.all([
      this.semanticSearch(query, options),
      this.fulltextSearch(query, options),
      this.titleVectorSearch(query, options),
    ]);

    // 构建排序列表
    const rankings: RankingList[] = [
      {
        source: "vector",
        items: vectorResults.map((r) => ({
          id: r.id,
          originalScore: r.similarity,
        })),
      },
      {
        source: "fulltext",
        items: fulltextResults.map((r) => ({
          id: r.id,
          originalScore: r.score,
        })),
      },
      {
        source: "title",
        items: titleResults.map((r) => ({
          id: r.id,
          originalScore: r.similarity,
        })),
      },
    ];

    // RRF 融合
    const fusedResults = this.rrfFusion.fuse(rankings);

    // 获取完整书签数据
    return this.enrichResults(fusedResults, options.limit);
  }
}
```

#### 4.2.3 验收指标

| 指标           | 基准值 | 目标值 | 测试方法     |
| -------------- | ------ | ------ | ------------ |
| 多路召回覆盖率 | 75%    | 90%    | 测试查询集   |
| 融合排序 NDCG  | 0.72   | 0.80   | 标注数据评估 |

---

## 五、Phase 3: 评估体系 (4 天)

### P2-1: RAGAS 评估框架 (2 天)

**目标**: 建立 RAG 质量基准线和持续监控

#### 5.1.1 评估脚本

```python
# scripts/evaluate_rag.py

from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
)
import json
from pathlib import Path

# 测试数据集
TEST_DATASET = [
    {
        "query": "React Hooks 最佳实践",
        "expected_answer_keywords": ["useState", "useEffect", "依赖数组"],
        "ground_truth_context": "..."
    },
    {
        "query": "微信公众号数据分析方法",
        "expected_answer_keywords": ["阅读量", "用户画像", "内容分析"],
        "ground_truth_context": "..."
    },
    # ... 更多测试用例
]

def run_evaluation():
    """运行 RAGAS 评估"""
    results = []

    for test_case in TEST_DATASET:
        # 调用 AnyKeep 搜索 API
        response = call_anykeep_search(test_case["query"])

        # 准备 RAGAS 输入
        evaluation_input = {
            "question": test_case["query"],
            "answer": response["answer"],
            "contexts": response["contexts"],
            "ground_truth": test_case.get("ground_truth_context", "")
        }

        results.append(evaluation_input)

    # 批量评估
    scores = evaluate(
        results,
        metrics=[
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall
        ]
    )

    # 保存结果
    output_path = Path("reports/ragas_evaluation.json")
    output_path.parent.mkdir(exist_ok=True)

    with open(output_path, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "scores": {
                "faithfulness": float(scores["faithfulness"]),
                "answer_relevancy": float(scores["answer_relevancy"]),
                "context_precision": float(scores["context_precision"]),
                "context_recall": float(scores["context_recall"])
            },
            "details": results
        }, f, indent=2, ensure_ascii=False)

    return scores

if __name__ == "__main__":
    scores = run_evaluation()
    print(f"Faithfulness: {scores['faithfulness']:.2f}")
    print(f"Answer Relevancy: {scores['answer_relevancy']:.2f}")
    print(f"Context Precision: {scores['context_precision']:.2f}")
    print(f"Context Recall: {scores['context_recall']:.2f}")
```

#### 5.1.2 目标指标

| 指标              | 目标值 | 说明                      |
| ----------------- | ------ | ------------------------- |
| Faithfulness      | > 0.85 | AI 回答基于检索内容的程度 |
| Answer Relevancy  | > 0.80 | AI 是否回答了用户问题     |
| Context Precision | > 0.75 | 检索结果的相关性排序质量  |
| Context Recall    | > 0.70 | 检索到了多少相关内容      |

---

### P2-2: 监控仪表盘 (2 天)

#### 5.2.1 核心指标

```typescript
// src/lib/monitoring/rag-metrics.ts

export interface RAGMetrics {
  // 搜索性能
  searchLatencyP50: number;
  searchLatencyP95: number;
  searchLatencyP99: number;

  // 缓存效率
  vectorCacheHitRate: number;
  queryCacheHitRate: number;

  // 质量指标
  avgSimilarityScore: number;
  zeroResultRate: number;

  // 成本追踪
  embeddingApiCalls: number;
  rerankApiCalls: number;
  llmTokensUsed: number;
  estimatedCost: number;
}

export class RAGMetricsCollector {
  async collectMetrics(): Promise<RAGMetrics> {
    const [latency, cache, quality, cost] = await Promise.all([
      this.collectLatencyMetrics(),
      this.collectCacheMetrics(),
      this.collectQualityMetrics(),
      this.collectCostMetrics(),
    ]);

    return { ...latency, ...cache, ...quality, ...cost };
  }
}
```

#### 5.2.2 API 端点

```typescript
// src/app/api/admin/rag-metrics/route.ts

export async function GET(request: Request) {
  // 验证管理员权限
  const user = await getAuthUser(request);
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collector = new RAGMetricsCollector();
  const metrics = await collector.collectMetrics();

  return NextResponse.json(metrics);
}
```

---

## 六、风险评估与缓解

| 风险                 | 概率 | 影响 | 缓解措施                       |
| -------------------- | ---- | ---- | ------------------------------ |
| DashScope API 不稳定 | 低   | 高   | Feature Flag + 降级到静态排序  |
| 切片迁移数据量大     | 高   | 中   | 分批处理 + 可断点续传          |
| 向量模型切换兼容性   | 低   | 高   | 保留旧模型向量，新模型并行运行 |
| LLM 查询改写延迟     | 中   | 中   | 缓存常用查询改写结果           |

---

## 七、资源需求

### 7.1 人力

| 阶段    | 工作量 | 技能要求                |
| ------- | ------ | ----------------------- |
| Phase 1 | 5 人天 | TypeScript, AI API 集成 |
| Phase 2 | 6 人天 | PostgreSQL, 向量数据库  |
| Phase 3 | 4 人天 | Python, 监控系统        |

### 7.2 基础设施

| 组件                  | 成本预估 | 说明                           |
| --------------------- | -------- | ------------------------------ |
| 百炼 DashScope Rerank | ~¥30/月  | 按 Token 计费，100 万 Token/天 |
| 额外数据库存储        | ~$10/月  | 切片表约 2x 原数据             |
| 监控服务              | $0       | 使用现有基础设施               |

### 7.3 依赖

```json
// package.json 新增依赖
{
  "dependencies": {
    "lru-cache": "^10.0.0"
  },
  "devDependencies": {
    "@types/lru-cache": "^7.0.0"
  }
}
```

> **注意**: DashScope Rerank 使用原生 fetch 调用，无需额外 SDK 依赖

---

## 八、验收标准

### 8.1 Phase 1 验收 (第 5 天)

- [ ] 查询改写功能上线，Feature Flag 控制
- [ ] DashScope Rerank 集成完成，用量监控
- [ ] 向量缓存命中率 > 50%
- [ ] 搜索 P95 延迟 < 500ms

### 8.2 Phase 2 验收 (第 11 天)

- [ ] bookmark_chunks 表创建并有数据
- [ ] 切片搜索 API 可用
- [ ] 至少 50% 历史书签已切片化
- [ ] RRF 融合算法上线

### 8.3 Phase 3 验收 (第 15 天)

- [ ] RAGAS 评估脚本可运行
- [ ] 基准线指标已记录
- [ ] 监控 API 可访问
- [ ] 文档更新完成

---

## 九、附录

### A. Feature Flags 完整列表

```bash
# .env.local

# Phase 1
ENABLE_QUERY_REWRITE=true
ENABLE_RERANK=true
ENABLE_VECTOR_CACHE=true

# Phase 2
ENABLE_CHUNK_SEARCH=true
ENABLE_RRF_FUSION=true

# API Keys
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx  # 阿里百炼 API Key
```

### B. 数据库迁移清单

| 迁移文件                                 | 说明                |
| ---------------------------------------- | ------------------- |
| `20251229000001_add_bookmark_chunks.sql` | 切片表 + 索引 + RLS |

### C. 测试用例模板

```typescript
// __tests__/rag/query-rewriter.test.ts

describe("QueryRewriter", () => {
  it("should expand synonyms for technical terms", async () => {
    const rewriter = new QueryRewriter();
    const result = await rewriter.rewrite("React状态管理");

    expect(result.synonyms).toContain("useState");
    expect(result.synonyms).toContain("Redux");
  });

  it("should handle ambiguous queries", async () => {
    const result = await rewriter.rewrite("那个红色按钮");

    expect(result.intent).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
```

---

**文档状态**: 待审核

**下一步**: 请审核此方案，确认后我将开始 Phase 1 实施。

---

_起草: Winston (System Architect)_
_AnyKeep Project - 2025-12-28_
