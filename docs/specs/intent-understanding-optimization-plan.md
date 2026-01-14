# AnyKeep 意图理解优化方案

> **目标**：在性能（快）与智能（准）之间取得最佳平衡
> **策略**：分级路由，降维打击
> **版本**：v1.0
> **日期**：2026-01-11
> **状态**：待审核

---

## 一、执行摘要

### 1.1 核心指标目标

| 指标 | 当前值 | 目标值 | 提升幅度 |
|------|--------|--------|----------|
| P50 意图分类延迟 | ~5ms | <3ms | 40% ↓ |
| P99 意图分类延迟 | ~500ms (LLM) | <200ms | 60% ↓ |
| LLM 兜底调用率 | ~25% (估计) | <10% | 60% ↓ |
| 缓存命中率 | 0% (无缓存) | >50% | ∞ |
| 意图识别准确率 | ~90% | >95% | 5% ↑ |
| 月 LLM 成本 | 基准 | 基准 × 0.4 | 60% ↓ |

### 1.2 实施周期

```
Phase 1: 快速见效 ─────────────────  1 周
Phase 2: 语义缓存 ─────────────────  2 周
Phase 3: 智能进化 ─────────────────  3 周
Phase 4: 持续优化 ─────────────────  长期
                   ───────────────────────►
                   Week 1    Week 3    Week 6
```

---

## 二、架构总览

### 2.1 优化后的意图理解流水线

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           用户输入 (User Message)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚡ Gate 0: 客户端快捷命令 (Client-side)                                  │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  • 匹配 /search, /delete, /export 等快捷前缀                         │ │
│ │  • 延迟: 0ms (本地执行)                                              │ │
│ │  • 命中率: ~5%                                                       │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ 命中 → 直接执行 | 未命中 → 发送到服务端 (附带预处理后的轻量上下文)          │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚡ Gate 1: 精确匹配缓存 (L1 Cache)                     [Phase 1]         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  • LRU 缓存，Key = message 原文                                      │ │
│ │  • 容量: 10,000 条，TTL: 无限 (LRU 淘汰)                              │ │
│ │  • 延迟: <0.5ms                                                      │ │
│ │  • 预期命中率: 15-20%                                                │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ 命中 → 返回缓存结果 | 未命中 → Gate 2                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚡ Gate 2: 语义相似缓存 (L2 Cache)                     [Phase 2]         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  • pgvector 向量索引，相似度阈值 > 0.95                               │ │
│ │  • 容量: 50,000 条，TTL: 7 天                                        │ │
│ │  • 延迟: 10-30ms (含 Embedding 计算)                                 │ │
│ │  • 预期命中率: 20-30%                                                │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ 命中 → 返回缓存结果 | 未命中 → Gate 3                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 🚀 Gate 3: 规则引擎 (Rule Engine)                      [现有 + 优化]     │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  • 1484 条规则，权重分层 (10-100)                                     │ │
│ │  • 高权重短路: weight ≥ 95 且 confidence ≥ 0.9 时提前返回             │ │
│ │  • 消歧引擎: 多候选置信度接近时触发                                   │ │
│ │  • 延迟: <5ms                                                        │ │
│ │  • 命中率: ~85% (规则覆盖场景)                                        │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ 置信度 ≥ 0.75 → 执行 + 写入缓存 | 置信度 < 0.6 → Gate 4                  │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 🧠 Gate 4: LLM 兜底 (Fallback)                         [现有 + 优化]     │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  • DeepSeek-Chat，结构化输出                                         │ │
│ │  • 超时: 2000ms，重试: 1 次                                          │ │
│ │  • 延迟: 200-500ms                                                   │ │
│ │  • 调用率目标: <10%                                                  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ 执行 + 写入缓存 + 异步规则挖掘                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 预期流量分布 (稳态)

```
100% 用户请求
    │
    ├── 5%   → Gate 0 (客户端快捷命令)     ───→ 0ms
    │
    ├── 15%  → Gate 1 (精确缓存命中)       ───→ <1ms
    │
    ├── 25%  → Gate 2 (语义缓存命中)       ───→ ~20ms
    │
    ├── 47%  → Gate 3 (规则引擎命中)       ───→ ~5ms
    │
    └── 8%   → Gate 4 (LLM 兜底)           ───→ ~300ms

加权平均延迟: 0.05×0 + 0.15×1 + 0.25×20 + 0.47×5 + 0.08×300 = 31.5ms
```

---

## 三、Phase 1: 快速见效 (1 周)

### 3.1 目标

- LLM 调用率降低 30%
- P50 延迟降低 20%
- 零破坏性变更，可随时回滚

### 3.2 任务清单

#### Task 1.1: 精确匹配 LRU 缓存

**文件**: `src/lib/ai-skills/router/intent-cache.ts` (新建)

```typescript
import { LRUCache } from 'lru-cache';
import type { IntentClassification } from './types';

export interface CachedIntentResult {
  classification: IntentClassification;
  cachedAt: number;
  hitCount: number;
}

export class IntentCache {
  private exactCache: LRUCache<string, CachedIntentResult>;

  constructor(options?: { maxSize?: number }) {
    this.exactCache = new LRUCache({
      max: options?.maxSize ?? 10000,
      updateAgeOnGet: true,
    });
  }

  /**
   * 精确匹配查询
   */
  getExact(message: string): IntentClassification | null {
    const normalized = this.normalize(message);
    const cached = this.exactCache.get(normalized);

    if (cached) {
      cached.hitCount++;
      return {
        ...cached.classification,
        source: 'cache_l1' as const,
      };
    }

    return null;
  }

  /**
   * 写入缓存
   */
  set(message: string, classification: IntentClassification): void {
    // 不缓存低置信度结果
    if (classification.confidence < 0.75) return;
    // 不缓存 chitchat
    if (classification.type === 'chitchat') return;

    const normalized = this.normalize(message);
    this.exactCache.set(normalized, {
      classification,
      cachedAt: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * 消息规范化（去除首尾空格，统一小写）
   */
  private normalize(message: string): string {
    return message.trim().toLowerCase();
  }

  /**
   * 缓存统计
   */
  getStats(): { size: number; hitRate: number } {
    return {
      size: this.exactCache.size,
      hitRate: this.calculateHitRate(),
    };
  }

  private calculateHitRate(): number {
    let totalHits = 0;
    let totalEntries = 0;

    for (const entry of this.exactCache.values()) {
      totalHits += entry.hitCount;
      totalEntries++;
    }

    return totalEntries > 0 ? totalHits / (totalHits + totalEntries) : 0;
  }
}

// 单例
let intentCacheInstance: IntentCache | null = null;

export function getIntentCache(): IntentCache {
  if (!intentCacheInstance) {
    intentCacheInstance = new IntentCache();
  }
  return intentCacheInstance;
}
```

**集成位置**: `src/lib/ai-skills/router/intent-router.ts`

```typescript
// 在 route() 方法开头添加
async route(message: string, context: RouteContext): Promise<RouteResult> {
  const startTime = performance.now();

  // Gate 1: 精确缓存检查
  const cached = this.intentCache.getExact(message);
  if (cached) {
    return this.buildRouteResult(cached, {
      source: 'cache_l1',
      durationMs: performance.now() - startTime,
    });
  }

  // ... 现有逻辑 ...

  // 分类完成后写入缓存
  this.intentCache.set(message, classification);
}
```

---

#### Task 1.2: 高权重规则短路优化

**文件**: `src/lib/ai-skills/router/intent-classifier.ts`

```typescript
// 在 collectAllMatches() 中添加短路逻辑
private collectAllMatches(
  message: string,
  normalizedMessage: string
): RuleMatchResult[] {
  const matches: RuleMatchResult[] = [];

  for (const rule of this.sortedRules) {
    const match = this.matchRule(message, normalizedMessage, rule);
    if (!match) continue;

    matches.push(match);

    // 🚀 短路优化：高权重规则直接返回
    if (rule.weight >= 95 && match.confidence >= 0.9) {
      // 记录短路指标
      this.metrics.recordEarlyReturn(rule.id, match.confidence);
      return matches; // 不再遍历剩余规则
    }
  }

  return matches;
}
```

**预期收益**：
- 高权重规则（~10%）匹配时，跳过剩余 1300+ 条规则遍历
- P50 延迟从 ~5ms 降至 ~3ms

---

#### Task 1.3: LLM 缓存 TTL 提升

**文件**: `src/lib/ai-skills/router/llm-classifier.ts`

```typescript
// 修改默认配置
const DEFAULT_CONFIG: LLMClassifierConfig = {
  cacheEnabled: true,
  cacheTTLMs: 5 * 60 * 1000,  // 从 60s 提升到 5 分钟
  timeoutMs: 2000,            // 从 1500ms 提升到 2000ms（给予更多容错）
  maxRetries: 1,
};
```

---

#### Task 1.4: 客户端快捷命令

**文件**: `src/lib/ai-agent/client/fast-commands.ts` (新建)

```typescript
/**
 * 客户端快捷命令映射
 * 用于绕过 AI 意图理解，直接触发操作
 */
export const FAST_COMMANDS = {
  // 搜索
  '/search': { intent: 'query', subType: 'search' },
  '/s': { intent: 'query', subType: 'search' },
  '/找': { intent: 'query', subType: 'search' },

  // 删除
  '/delete': { intent: 'action', subType: 'delete', requireConfirm: true },
  '/del': { intent: 'action', subType: 'delete', requireConfirm: true },
  '/删除': { intent: 'action', subType: 'delete', requireConfirm: true },

  // 导出
  '/export': { intent: 'action', subType: 'export' },
  '/导出': { intent: 'action', subType: 'export' },

  // 整理
  '/organize': { intent: 'organize', subType: 'cleanup' },
  '/整理': { intent: 'organize', subType: 'cleanup' },

  // 帮助
  '/help': { intent: 'query', subType: 'help' },
  '/帮助': { intent: 'query', subType: 'help' },
} as const;

export type FastCommandKey = keyof typeof FAST_COMMANDS;

export interface FastCommandResult {
  intent: string;
  subType: string;
  args: string;
  requireConfirm?: boolean;
}

/**
 * 解析快捷命令
 * @returns 命令结果，或 null 表示不是快捷命令
 */
export function parseFastCommand(input: string): FastCommandResult | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  // 提取命令和参数
  const firstSpace = trimmed.indexOf(' ');
  const cmd = firstSpace > 0 ? trimmed.slice(0, firstSpace) : trimmed;
  const args = firstSpace > 0 ? trimmed.slice(firstSpace + 1).trim() : '';

  const mapping = FAST_COMMANDS[cmd.toLowerCase() as FastCommandKey];
  if (!mapping) return null;

  return {
    ...mapping,
    args,
  };
}
```

**前端集成**: `src/components/ai/ai-chat-input.tsx`

```typescript
import { parseFastCommand } from '@/lib/ai-agent/client/fast-commands';

// 在 handleSubmit 中
const handleSubmit = async (message: string) => {
  // 尝试解析快捷命令
  const fastCmd = parseFastCommand(message);

  if (fastCmd) {
    // 直接执行，不经过 AI
    await executeIntent({
      type: fastCmd.intent,
      subType: fastCmd.subType,
      entities: fastCmd.args ? [{ type: 'keyword', value: fastCmd.args }] : [],
      confidence: 1.0,
      source: 'fast_command',
    });
    return;
  }

  // 正常 AI 处理流程
  await sendToAI(message);
};
```

---

#### Task 1.5: 客户端预处理

**文件**: `src/lib/ai-agent/client/context-preprocessor.ts` (新建)

```typescript
import type { Bookmark } from '@/types/bookmark';

/**
 * 轻量级书签，用于 AI 上下文
 * 减少 Token 消耗 60-80%
 */
export interface LightweightBookmark {
  id: string;
  title: string;          // 截断至 100 字符
  description?: string;   // 截断至 200 字符
  platform: string;
  tags?: string[];        // 最多 5 个
  folderName?: string;
}

/**
 * 预处理书签列表，生成轻量级上下文
 */
export function preprocessBookmarks(
  bookmarks: Bookmark[],
  options?: { maxCount?: number }
): LightweightBookmark[] {
  const maxCount = options?.maxCount ?? 20;

  return bookmarks.slice(0, maxCount).map(b => ({
    id: b.id,
    title: truncate(b.title, 100),
    description: b.description ? truncate(b.description, 200) : undefined,
    platform: b.platform,
    tags: b.tags?.slice(0, 5),
    folderName: b.folder?.name,
  }));
}

/**
 * 预处理选中书签的统计摘要
 * 用于批量操作场景
 */
export function preprocessSelectionSummary(
  bookmarks: Bookmark[]
): SelectionSummary {
  const platformCounts = new Map<string, number>();
  const tagSet = new Set<string>();

  for (const b of bookmarks) {
    platformCounts.set(b.platform, (platformCounts.get(b.platform) ?? 0) + 1);
    b.tags?.forEach(t => tagSet.add(t));
  }

  return {
    totalCount: bookmarks.length,
    platforms: Object.fromEntries(platformCounts),
    uniqueTags: Array.from(tagSet).slice(0, 20),
    hasUntagged: bookmarks.some(b => !b.tags?.length),
    // 只发送前 5 个书签的详情
    samples: preprocessBookmarks(bookmarks.slice(0, 5)),
  };
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export interface SelectionSummary {
  totalCount: number;
  platforms: Record<string, number>;
  uniqueTags: string[];
  hasUntagged: boolean;
  samples: LightweightBookmark[];
}
```

---

### 3.3 Phase 1 验收标准

| 检查项 | 验收标准 | 验证方法 |
|--------|----------|----------|
| LRU 缓存功能 | 缓存命中时返回正确结果 | 单元测试 |
| 缓存统计 | 可查看缓存大小和命中率 | 日志 / 监控 |
| 高权重短路 | weight ≥ 95 时跳过剩余规则 | 单元测试 + 指标 |
| 快捷命令 | /search xxx 直接触发搜索 | E2E 测试 |
| 预处理 | Token 消耗减少 60%+ | 对比日志 |
| 回滚能力 | Feature Flag 可禁用所有优化 | 手动验证 |

---

## 四、Phase 2: 语义缓存 (2 周)

### 4.1 目标

- 引入语义相似度缓存
- 缓存总命中率达到 40%+
- 支持缓存预热和持久化

### 4.2 任务清单

#### Task 2.1: 数据库迁移 - 意图缓存表

**文件**: `supabase/migrations/20260112000001_add_intent_cache_table.sql`

```sql
-- 意图缓存表
CREATE TABLE IF NOT EXISTS intent_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 缓存键
  message_hash TEXT NOT NULL,              -- 消息哈希（精确匹配）
  message_embedding vector(1536),          -- 消息向量（语义匹配）

  -- 缓存值
  intent_type TEXT NOT NULL,
  intent_sub_type TEXT,
  confidence REAL NOT NULL,
  entities JSONB DEFAULT '[]',
  slots JSONB,

  -- 元数据
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                  -- TTL

  -- 来源追踪
  source TEXT NOT NULL,                    -- 'rule' | 'llm' | 'user_correction'

  CONSTRAINT intent_cache_message_hash_key UNIQUE (message_hash)
);

-- 向量索引（HNSW，高性能近似最近邻）
CREATE INDEX IF NOT EXISTS intent_cache_embedding_idx
  ON intent_cache
  USING hnsw (message_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 过期清理索引
CREATE INDEX IF NOT EXISTS intent_cache_expires_at_idx
  ON intent_cache (expires_at)
  WHERE expires_at IS NOT NULL;

-- 统计索引
CREATE INDEX IF NOT EXISTS intent_cache_intent_type_idx
  ON intent_cache (intent_type, intent_sub_type);

-- 自动清理过期缓存（每小时）
CREATE OR REPLACE FUNCTION cleanup_expired_intent_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM intent_cache
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 定时任务（需要 pg_cron 扩展）
-- SELECT cron.schedule('cleanup-intent-cache', '0 * * * *', 'SELECT cleanup_expired_intent_cache()');
```

---

#### Task 2.2: 语义缓存服务

**文件**: `src/lib/ai-skills/router/semantic-cache.ts` (新建)

```typescript
import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/embedding';
import type { IntentClassification } from './types';

export interface SemanticCacheConfig {
  similarityThreshold: number;  // 默认 0.95
  ttlDays: number;              // 默认 7
  maxResults: number;           // 默认 1
}

const DEFAULT_CONFIG: SemanticCacheConfig = {
  similarityThreshold: 0.95,
  ttlDays: 7,
  maxResults: 1,
};

export class SemanticCache {
  private config: SemanticCacheConfig;

  constructor(config?: Partial<SemanticCacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 语义相似度查询
   */
  async get(message: string): Promise<IntentClassification | null> {
    const supabase = await createClient();

    // 计算消息向量
    const embedding = await getEmbedding(message);

    // 向量相似度搜索
    const { data, error } = await supabase.rpc('match_intent_cache', {
      query_embedding: embedding,
      similarity_threshold: this.config.similarityThreshold,
      match_count: this.config.maxResults,
    });

    if (error || !data?.length) {
      return null;
    }

    const cached = data[0];

    // 更新命中统计（异步，不阻塞）
    this.updateHitStats(cached.id).catch(console.error);

    return {
      type: cached.intent_type,
      subType: cached.intent_sub_type,
      confidence: cached.confidence,
      entities: cached.entities ?? [],
      slots: cached.slots,
      source: 'cache_l2' as const,
    };
  }

  /**
   * 写入缓存
   */
  async set(
    message: string,
    classification: IntentClassification,
    options?: { ttlDays?: number }
  ): Promise<void> {
    // 不缓存低置信度结果
    if (classification.confidence < 0.75) return;
    // 不缓存 chitchat
    if (classification.type === 'chitchat') return;

    const supabase = await createClient();
    const embedding = await getEmbedding(message);
    const messageHash = this.hash(message);

    const ttlDays = options?.ttlDays ?? this.config.ttlDays;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    await supabase.from('intent_cache').upsert({
      message_hash: messageHash,
      message_embedding: embedding,
      intent_type: classification.type,
      intent_sub_type: classification.subType,
      confidence: classification.confidence,
      entities: classification.entities,
      slots: classification.slots,
      source: classification.source,
      expires_at: expiresAt.toISOString(),
    }, {
      onConflict: 'message_hash',
    });
  }

  /**
   * 批量预热（启动时加载热门意图）
   */
  async warmup(topK: number = 100): Promise<number> {
    const supabase = await createClient();

    // 加载最近 7 天命中次数最多的缓存
    const { data, error } = await supabase
      .from('intent_cache')
      .select('*')
      .order('hit_count', { ascending: false })
      .limit(topK);

    if (error || !data) return 0;

    // 预热到内存缓存（可选，配合 L1 LRU）
    // ...

    return data.length;
  }

  private async updateHitStats(id: string): Promise<void> {
    const supabase = await createClient();

    await supabase.rpc('increment_intent_cache_hit', { cache_id: id });
  }

  private hash(message: string): string {
    // djb2 哈希
    let hash = 5381;
    for (let i = 0; i < message.length; i++) {
      hash = ((hash << 5) + hash) + message.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}

// 单例
let semanticCacheInstance: SemanticCache | null = null;

export function getSemanticCache(): SemanticCache {
  if (!semanticCacheInstance) {
    semanticCacheInstance = new SemanticCache();
  }
  return semanticCacheInstance;
}
```

---

#### Task 2.3: RPC 函数 - 向量相似度搜索

**文件**: `supabase/migrations/20260112000002_add_intent_cache_rpc.sql`

```sql
-- 向量相似度搜索
CREATE OR REPLACE FUNCTION match_intent_cache(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.95,
  match_count int DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  intent_type TEXT,
  intent_sub_type TEXT,
  confidence REAL,
  entities JSONB,
  slots JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ic.id,
    ic.intent_type,
    ic.intent_sub_type,
    ic.confidence,
    ic.entities,
    ic.slots,
    1 - (ic.message_embedding <=> query_embedding) AS similarity
  FROM intent_cache ic
  WHERE
    ic.message_embedding IS NOT NULL
    AND (ic.expires_at IS NULL OR ic.expires_at > NOW())
    AND 1 - (ic.message_embedding <=> query_embedding) >= similarity_threshold
  ORDER BY ic.message_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 命中计数递增
CREATE OR REPLACE FUNCTION increment_intent_cache_hit(cache_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE intent_cache
  SET
    hit_count = hit_count + 1,
    last_hit_at = NOW()
  WHERE id = cache_id;
END;
$$;
```

---

#### Task 2.4: 集成到 IntentRouter

**文件**: `src/lib/ai-skills/router/intent-router.ts`

```typescript
import { getIntentCache } from './intent-cache';
import { getSemanticCache } from './semantic-cache';
import { isFeatureEnabled } from '@/lib/ai-agent/config/feature-flags';

export class IntentRouter {
  private intentCache = getIntentCache();
  private semanticCache = getSemanticCache();

  async route(message: string, context: RouteContext): Promise<RouteResult> {
    const startTime = performance.now();
    const metrics: RouteMetrics = { source: 'unknown' };

    // Gate 1: 精确缓存
    const exactCached = this.intentCache.getExact(message);
    if (exactCached) {
      metrics.source = 'cache_l1';
      metrics.durationMs = performance.now() - startTime;
      return this.buildRouteResult(exactCached, metrics);
    }

    // Gate 2: 语义缓存（可通过 Feature Flag 控制）
    if (isFeatureEnabled('ENABLE_SEMANTIC_CACHE')) {
      const semanticCached = await this.semanticCache.get(message);
      if (semanticCached) {
        // 同时写入 L1 缓存，加速后续精确匹配
        this.intentCache.set(message, semanticCached);

        metrics.source = 'cache_l2';
        metrics.durationMs = performance.now() - startTime;
        return this.buildRouteResult(semanticCached, metrics);
      }
    }

    // Gate 3: 规则引擎
    const ruleResult = await this.classifier.classify(message, context);

    if (ruleResult.confidence >= 0.75) {
      // 写入双层缓存
      this.intentCache.set(message, ruleResult);
      if (isFeatureEnabled('ENABLE_SEMANTIC_CACHE')) {
        this.semanticCache.set(message, ruleResult).catch(console.error);
      }

      metrics.source = ruleResult.source;
      metrics.durationMs = performance.now() - startTime;
      return this.buildRouteResult(ruleResult, metrics);
    }

    // Gate 4: LLM 兜底
    if (ruleResult.confidence < 0.6) {
      const llmResult = await this.llmClassifier.classify(message, context);

      // 写入缓存 + 异步规则挖掘
      this.intentCache.set(message, llmResult);
      if (isFeatureEnabled('ENABLE_SEMANTIC_CACHE')) {
        this.semanticCache.set(message, llmResult).catch(console.error);
      }
      this.scheduleRuleMining(message, llmResult);

      metrics.source = 'llm';
      metrics.llmFallbackUsed = true;
      metrics.durationMs = performance.now() - startTime;
      return this.buildRouteResult(llmResult, metrics);
    }

    // 中等置信度，使用规则结果
    metrics.source = ruleResult.source;
    metrics.durationMs = performance.now() - startTime;
    return this.buildRouteResult(ruleResult, metrics);
  }

  private scheduleRuleMining(message: string, result: IntentClassification): void {
    // 异步任务，不阻塞主流程
    // 详见 Phase 3
  }
}
```

---

### 4.3 Phase 2 验收标准

| 检查项 | 验收标准 | 验证方法 |
|--------|----------|----------|
| 数据库迁移 | 表和索引创建成功 | `supabase db push` |
| 向量索引 | HNSW 索引正常工作 | 查询计划分析 |
| 语义缓存命中 | 相似消息（>0.95）命中 | 集成测试 |
| 缓存穿透 | 未命中时回退规则引擎 | 集成测试 |
| 缓存预热 | 启动时加载 Top 100 | 日志验证 |
| 过期清理 | 7 天后自动清理 | 定时任务日志 |
| 命中统计 | hit_count 正确递增 | 数据库查询 |
| Feature Flag | 可动态开关语义缓存 | 手动验证 |

---

## 五、Phase 3: 智能进化 (3 周)

### 5.1 目标

- 置信度校准系统上线
- 规则自动挖掘 Pipeline
- 动态权重调优
- 意图识别准确率达到 95%+

### 5.2 任务清单

#### Task 3.1: 用户反馈收集

**数据库迁移**: `supabase/migrations/20260119000001_add_intent_feedback_table.sql`

```sql
-- 意图理解反馈表
CREATE TABLE IF NOT EXISTS intent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 原始输入
  message TEXT NOT NULL,
  message_embedding vector(1536),

  -- AI 预测结果
  predicted_intent TEXT NOT NULL,
  predicted_sub_type TEXT,
  predicted_confidence REAL NOT NULL,
  prediction_source TEXT NOT NULL,  -- 'rule' | 'llm' | 'cache'

  -- 用户反馈
  feedback_type TEXT NOT NULL,      -- 'correct' | 'wrong' | 'corrected'
  corrected_intent TEXT,            -- 用户纠正后的意图
  corrected_sub_type TEXT,

  -- 上下文
  context JSONB,                    -- 选中书签、当前页面等

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 分析标记
  analyzed BOOLEAN DEFAULT FALSE,
  analyzed_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX IF NOT EXISTS intent_feedback_user_id_idx
  ON intent_feedback (user_id);
CREATE INDEX IF NOT EXISTS intent_feedback_predicted_intent_idx
  ON intent_feedback (predicted_intent, predicted_sub_type);
CREATE INDEX IF NOT EXISTS intent_feedback_analyzed_idx
  ON intent_feedback (analyzed)
  WHERE analyzed = FALSE;
```

---

#### Task 3.2: 置信度校准器

**文件**: `src/lib/ai-skills/router/confidence-calibrator.ts` (新建)

```typescript
/**
 * 置信度校准器
 * 使用 Platt Scaling 校准原始置信度
 */
export class ConfidenceCalibrator {
  // 校准参数（离线训练，定期更新）
  private weights: number[] = [
    0.6,   // rawConfidence
    0.1,   // messageLength
    0.15,  // ruleWeight
    0.05,  // matchCount
    0.05,  // hasEntities
    0.05,  // disambiguationUsed
  ];
  private bias: number = -0.3;

  /**
   * 校准置信度
   */
  calibrate(
    rawConfidence: number,
    features: CalibrationFeatures
  ): number {
    const featureVector = [
      rawConfidence,
      Math.min(features.messageLength / 100, 1),
      Math.min(features.ruleWeight / 100, 1),
      Math.min(features.matchCount / 10, 1),
      features.hasEntities ? 1 : 0,
      features.disambiguationUsed ? 1 : 0,
    ];

    // 逻辑回归
    const logit = this.weights.reduce(
      (sum, w, i) => sum + w * featureVector[i],
      this.bias
    );

    return sigmoid(logit);
  }

  /**
   * 加载训练好的参数
   */
  async loadParams(): Promise<void> {
    // 从数据库或配置文件加载
    // 每周离线训练一次
  }
}

export interface CalibrationFeatures {
  messageLength: number;
  ruleWeight: number;
  matchCount: number;
  hasEntities: boolean;
  disambiguationUsed: boolean;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
```

---

#### Task 3.3: 规则自动挖掘 Pipeline

**文件**: `src/lib/ai-skills/router/rule-miner.ts` (新建)

```typescript
import { createClient } from '@/lib/supabase/server';

/**
 * 规则挖掘 Pipeline
 * 从 LLM 兜底案例中自动生成候选规则
 */
export class RuleMiner {
  /**
   * 收集待挖掘的 case
   */
  async collectPendingCases(): Promise<MiningCase[]> {
    const supabase = await createClient();

    // 获取最近 7 天的 LLM 兜底案例
    const { data } = await supabase
      .from('intent_feedback')
      .select('*')
      .eq('prediction_source', 'llm')
      .eq('analyzed', false)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500);

    return data ?? [];
  }

  /**
   * 聚类相似消息
   */
  async clusterMessages(cases: MiningCase[]): Promise<MessageCluster[]> {
    // 按意图分组
    const intentGroups = this.groupByIntent(cases);
    const clusters: MessageCluster[] = [];

    for (const [intentKey, group] of Object.entries(intentGroups)) {
      if (group.length < 3) continue; // 最少 3 条才值得挖掘

      // 提取共同模式
      const patterns = await this.extractCommonPatterns(group);

      clusters.push({
        intentKey,
        messages: group.map(c => c.message),
        patterns,
        size: group.length,
        avgConfidence: group.reduce((s, c) => s + c.predicted_confidence, 0) / group.length,
      });
    }

    return clusters;
  }

  /**
   * 生成候选规则
   */
  async generateCandidateRules(clusters: MessageCluster[]): Promise<CandidateRule[]> {
    const candidates: CandidateRule[] = [];

    for (const cluster of clusters) {
      // 使用 LLM 生成正则模式
      const regexPattern = await this.generateRegexWithLLM(cluster);

      if (!regexPattern) continue;

      candidates.push({
        pattern: regexPattern,
        intent: cluster.intentKey.split(':')[0],
        subType: cluster.intentKey.split(':')[1],
        weight: 60, // 初始低权重
        examples: cluster.messages.slice(0, 5),
        confidence: cluster.avgConfidence,
        status: 'pending_review',
      });
    }

    return candidates;
  }

  private async generateRegexWithLLM(cluster: MessageCluster): Promise<string | null> {
    // 调用 LLM 生成正则
    // Prompt: "根据以下消息示例，生成一个能匹配它们的正则表达式..."
    // ...
    return null; // 实现略
  }

  private groupByIntent(cases: MiningCase[]): Record<string, MiningCase[]> {
    const groups: Record<string, MiningCase[]> = {};

    for (const c of cases) {
      const key = `${c.predicted_intent}:${c.predicted_sub_type ?? ''}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }

    return groups;
  }

  private async extractCommonPatterns(cases: MiningCase[]): Promise<string[]> {
    // 简单实现：提取共同的关键词
    const wordCounts = new Map<string, number>();

    for (const c of cases) {
      const words = c.message.split(/\s+/);
      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }

    // 出现在 >50% case 中的词
    const threshold = cases.length * 0.5;
    return Array.from(wordCounts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([word]) => word);
  }
}

interface MiningCase {
  id: string;
  message: string;
  predicted_intent: string;
  predicted_sub_type?: string;
  predicted_confidence: number;
}

interface MessageCluster {
  intentKey: string;
  messages: string[];
  patterns: string[];
  size: number;
  avgConfidence: number;
}

interface CandidateRule {
  pattern: string;
  intent: string;
  subType?: string;
  weight: number;
  examples: string[];
  confidence: number;
  status: 'pending_review' | 'approved' | 'rejected';
}
```

---

#### Task 3.4: 动态权重调优

**文件**: `src/lib/ai-skills/router/weight-optimizer.ts` (新建)

```typescript
/**
 * 动态权重优化器
 * 基于用户反馈自动调整规则权重
 */
export class WeightOptimizer {
  /**
   * 计算规则表现统计
   */
  async calculateRuleStats(): Promise<Map<string, RuleStats>> {
    const supabase = await createClient();

    const { data } = await supabase
      .from('intent_feedback')
      .select('*')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const stats = new Map<string, RuleStats>();

    for (const feedback of data ?? []) {
      const key = `${feedback.predicted_intent}:${feedback.predicted_sub_type ?? ''}`;

      if (!stats.has(key)) {
        stats.set(key, { triggerCount: 0, correctCount: 0, wrongCount: 0 });
      }

      const s = stats.get(key)!;
      s.triggerCount++;

      if (feedback.feedback_type === 'correct') {
        s.correctCount++;
      } else if (feedback.feedback_type === 'wrong' || feedback.feedback_type === 'corrected') {
        s.wrongCount++;
      }
    }

    return stats;
  }

  /**
   * 生成权重调整建议
   */
  async generateWeightUpdates(): Promise<WeightUpdate[]> {
    const stats = await this.calculateRuleStats();
    const updates: WeightUpdate[] = [];

    for (const [intentKey, s] of stats) {
      if (s.triggerCount < 20) continue; // 样本不足

      const accuracy = s.correctCount / s.triggerCount;

      if (accuracy < 0.7) {
        // 低准确率：降权
        updates.push({
          intentKey,
          delta: -10,
          reason: `low_accuracy (${(accuracy * 100).toFixed(1)}%)`,
          stats: s,
        });
      } else if (accuracy > 0.95 && s.triggerCount > 50) {
        // 高准确率 + 高频：提权
        updates.push({
          intentKey,
          delta: +5,
          reason: `high_accuracy (${(accuracy * 100).toFixed(1)}%)`,
          stats: s,
        });
      }
    }

    return updates;
  }
}

interface RuleStats {
  triggerCount: number;
  correctCount: number;
  wrongCount: number;
}

interface WeightUpdate {
  intentKey: string;
  delta: number;
  reason: string;
  stats: RuleStats;
}
```

---

### 5.3 Phase 3 验收标准

| 检查项 | 验收标准 | 验证方法 |
|--------|----------|----------|
| 反馈收集 | 用户纠正记录入库 | 数据库查询 |
| 置信度校准 | 校准后准确率提升 | A/B 测试 |
| 规则挖掘 | 每周生成 5-10 条候选规则 | Pipeline 日志 |
| 权重调优 | 低准确率规则自动降权 | 规则对比 |
| 审核 UI | 候选规则可人工审核 | 功能测试 |

---

## 六、Phase 4: 持续优化 (长期)

### 6.1 监控与告警

**文件**: `src/lib/ai-skills/router/metrics-collector.ts`

```typescript
export interface IntentMetrics {
  // 延迟分布
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;

  // 命中率
  cacheL1HitRate: number;
  cacheL2HitRate: number;
  ruleHitRate: number;
  llmFallbackRate: number;

  // 准确率（基于反馈）
  accuracyRate: number;
  correctionRate: number;

  // 成本
  llmTokensUsed: number;
  embeddingTokensUsed: number;
}

// 告警阈值
const ALERT_THRESHOLDS = {
  p99LatencyMs: 500,
  llmFallbackRate: 0.2,
  correctionRate: 0.1,
};
```

### 6.2 A/B 测试框架

- 支持新规则灰度发布
- 支持校准参数对比测试
- 支持缓存策略对比

### 6.3 持续改进流程

```
每日:
  - 监控指标巡检
  - 异常 case 标记

每周:
  - 规则挖掘 Pipeline 执行
  - 候选规则人工审核
  - 权重调优执行

每月:
  - 置信度校准模型重训练
  - 缓存策略评估
  - 架构回顾
```

---

## 七、Feature Flags

```typescript
// src/lib/ai-agent/config/feature-flags.ts

export const INTENT_OPTIMIZATION_FLAGS = {
  // Phase 1
  ENABLE_INTENT_CACHE_L1: true,           // 精确匹配缓存
  ENABLE_EARLY_RETURN: true,              // 高权重规则短路
  ENABLE_CLIENT_FAST_COMMANDS: true,      // 客户端快捷命令
  ENABLE_CLIENT_PREPROCESSING: true,      // 客户端预处理

  // Phase 2
  ENABLE_SEMANTIC_CACHE: false,           // 语义缓存（默认关闭，Phase 2 开启）
  SEMANTIC_CACHE_SIMILARITY: 0.95,        // 相似度阈值
  SEMANTIC_CACHE_TTL_DAYS: 7,             // 缓存 TTL

  // Phase 3
  ENABLE_CONFIDENCE_CALIBRATION: false,   // 置信度校准
  ENABLE_RULE_MINING: false,              // 规则挖掘
  ENABLE_WEIGHT_OPTIMIZATION: false,      // 权重调优
  ENABLE_FEEDBACK_COLLECTION: false,      // 反馈收集
};
```

---

## 八、风险评估与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 语义缓存引入脏数据 | 中 | 高 | 相似度阈值 0.95，缓存 TTL 7 天 |
| 高权重短路误判 | 低 | 中 | 仅对 weight ≥ 95 且 confidence ≥ 0.9 生效 |
| LLM 兜底超时增加 | 低 | 低 | 超时从 1500ms 调整为 2000ms，可回滚 |
| 规则挖掘生成低质量规则 | 中 | 低 | 人工审核流程，初始低权重 |
| 向量索引性能问题 | 低 | 中 | HNSW 索引，监控查询耗时 |

---

## 九、资源估算

### 9.1 开发工时

| Phase | 任务 | 工时 | 优先级 |
|-------|------|------|--------|
| Phase 1 | LRU 缓存 | 4h | P0 |
| Phase 1 | 高权重短路 | 2h | P0 |
| Phase 1 | LLM TTL 调整 | 0.5h | P0 |
| Phase 1 | 快捷命令 | 4h | P1 |
| Phase 1 | 客户端预处理 | 4h | P1 |
| Phase 2 | 数据库迁移 | 2h | P0 |
| Phase 2 | 语义缓存服务 | 8h | P0 |
| Phase 2 | 集成 IntentRouter | 4h | P0 |
| Phase 2 | 缓存预热 | 2h | P1 |
| Phase 3 | 反馈收集 | 4h | P1 |
| Phase 3 | 置信度校准 | 8h | P2 |
| Phase 3 | 规则挖掘 | 16h | P2 |
| Phase 3 | 权重调优 | 8h | P2 |

**总计**: ~66 小时 (~8.5 人天)

### 9.2 基础设施成本

| 资源 | 用量 | 月成本估算 |
|------|------|-----------|
| pgvector 存储 | ~100MB (5万条缓存) | 包含在 Supabase 套餐 |
| Embedding 调用 | ~10 万次/月 | ~$10 (阿里云百炼) |
| LLM 兜底 (减少后) | ~2 万次/月 | ~$20 (DeepSeek) |

---

## 十、验收清单

### Phase 1 验收 (Week 1)

- [ ] LRU 缓存单元测试通过
- [ ] 高权重短路指标可观测
- [ ] 快捷命令 E2E 测试通过
- [ ] 预处理 Token 减少验证
- [ ] 所有 Feature Flag 可正常开关

### Phase 2 验收 (Week 3)

- [ ] 数据库迁移成功
- [ ] 语义缓存集成测试通过
- [ ] 缓存命中率 > 40%
- [ ] P99 延迟 < 200ms

### Phase 3 验收 (Week 6)

- [ ] 反馈收集流程完整
- [ ] 置信度校准模型上线
- [ ] 规则挖掘 Pipeline 可运行
- [ ] 意图识别准确率 > 95%

---

## 十一、与现有架构集成分析

### 11.1 集成可行性评估：⭐⭐⭐⭐⭐ 非常高

| 维度 | 评估 | 说明 |
|------|------|------|
| 缓存基础设施 | ✅ 完善 | VectorCache、LLMClassifier 缓存可直接复用 |
| Feature Flags | ✅ 成熟 | 现有 8+ 开关，扩展简单 |
| 接口兼容性 | ✅ 良好 | RouteResult、IntentClassification 接口支持扩展 |
| 回滚能力 | ✅ 完整 | Flag 关闭即回退原有逻辑 |
| 测试框架 | ✅ 完备 | 30+ 测试套件，缓存测试易添加 |

### 11.2 现有可复用组件

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          现有缓存基础设施                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐    ┌─────────────────────┐                    │
│  │ VectorCache         │    │ LLMClassifier       │                    │
│  │ src/lib/cache/      │    │ 内置缓存            │                    │
│  │                     │    │                     │                    │
│  │ • LRU 自动淘汰      │    │ • Map<key, entry>   │                    │
│  │ • TTL 自动过期      │    │ • djb2 哈希键       │                    │
│  │ • 命中率统计        │    │ • 60s TTL (可配置)  │                    │
│  │ • 可直接复用 ⭐⭐⭐   │    │ • 已集成 ⭐⭐⭐       │                    │
│  └─────────────────────┘    └─────────────────────┘                    │
│                                                                         │
│  ┌─────────────────────┐    ┌─────────────────────┐                    │
│  │ Embedding Service   │    │ SemanticMatcher     │                    │
│  │ src/lib/embedding/  │    │ 内置 Embedding 缓存 │                    │
│  │                     │    │                     │                    │
│  │ • generateEmbedding │    │ • embeddings Map    │                    │
│  │ • batch 批量生成    │    │ • 意图锚点向量      │                    │
│  │ • 可直接复用 ⭐⭐⭐   │    │ • 可扩展 ⭐⭐⭐       │                    │
│  └─────────────────────┘    └─────────────────────┘                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.3 集成点与修改文件

#### Phase 1 修改清单（8 个文件）

| 文件 | 修改类型 | 修改内容 | 风险 |
|------|----------|----------|------|
| `feature-flags.ts` | 扩展 | 添加 5 个新 Flag | ⭐ 极低 |
| `intent-router.ts` | 增强 | 添加 L1 缓存层 | ⭐ 低 |
| `intent-classifier.ts` | 优化 | 高权重规则短路 | ⭐ 低 |
| `llm-classifier.ts` | 配置 | TTL 调整 60s→5min | ⭐ 极低 |
| `intent-cache.ts` | 新建 | L1 精确匹配缓存 | ⭐ 低 |
| `fast-commands.ts` | 新建 | 客户端快捷命令 | ⭐ 低 |
| `context-preprocessor.ts` | 新建 | 上下文预处理 | ⭐ 低 |
| `types.ts` | 扩展 | 缓存相关类型 | ⭐ 极低 |

#### Phase 2 修改清单（6 个文件）

| 文件 | 修改类型 | 修改内容 | 风险 |
|------|----------|----------|------|
| `migrations/xxx.sql` | 新建 | intent_cache 表 | ⭐ 低 |
| `semantic-cache.ts` | 新建 | L2 语义缓存服务 | ⭐⭐ 中 |
| `intent-router.ts` | 增强 | 集成 L2 缓存 | ⭐ 低 |
| `embedding/index.ts` | 复用 | 调用现有服务 | ⭐ 极低 |

### 11.4 关键适配点

#### 1. 复用 VectorCache 替代自建 LRU

```typescript
// 原方案：自建 LRU
import { LRUCache } from 'lru-cache';

// 适配后：复用现有 VectorCache
import { VectorCache } from '@/lib/cache/vector-cache';

export class IntentCache {
  private cache: VectorCache<CachedIntentResult>;

  constructor() {
    this.cache = new VectorCache({
      maxSize: 10000,
      ttlMs: Infinity,  // LRU 淘汰，不设 TTL
      updateAgeOnGet: true,
    });
  }
}
```

#### 2. 复用现有 Embedding 服务

```typescript
// 原方案：独立调用
const embedding = await getEmbedding(message);

// 适配后：复用现有服务
import { generateEmbedding } from '@/lib/embedding';

const embedding = await generateEmbedding(message);
```

#### 3. 扩展 Feature Flags（非破坏性）

```typescript
// src/lib/ai-agent/config/feature-flags.ts
// 在现有 Flags 基础上添加

// === 意图理解优化 (Phase 1) ===
get ENABLE_INTENT_CACHE_L1(): boolean {
  return process.env.ENABLE_INTENT_CACHE_L1 !== "false";
}

get ENABLE_EARLY_RETURN(): boolean {
  return process.env.ENABLE_EARLY_RETURN !== "false";
}

get ENABLE_CLIENT_FAST_COMMANDS(): boolean {
  return process.env.ENABLE_CLIENT_FAST_COMMANDS !== "false";
}

// === 意图理解优化 (Phase 2) ===
get ENABLE_SEMANTIC_CACHE(): boolean {
  return process.env.ENABLE_SEMANTIC_CACHE === "true";  // 默认关闭
}

get SEMANTIC_CACHE_SIMILARITY(): number {
  return parseFloat(process.env.SEMANTIC_CACHE_SIMILARITY || "0.95");
}
```

#### 4. IntentRouter 缓存集成点

```typescript
// src/lib/ai-skills/router/intent-router.ts
// 在 route() 方法中插入缓存层

async route(message: string, context: RouteContext): Promise<RouteResult> {
  const startTime = performance.now();

  // ✨ Gate 1: 精确缓存（新增）
  if (isFeatureEnabled('ENABLE_INTENT_CACHE_L1')) {
    const cached = this.intentCache.getExact(message);
    if (cached) {
      return this.buildRouteResult(cached, {
        source: 'cache_l1',
        durationMs: performance.now() - startTime,
      });
    }
  }

  // ✨ Gate 2: 语义缓存（Phase 2 新增）
  if (isFeatureEnabled('ENABLE_SEMANTIC_CACHE')) {
    const semanticCached = await this.semanticCache.get(message);
    if (semanticCached) {
      this.intentCache.set(message, semanticCached);  // 回填 L1
      return this.buildRouteResult(semanticCached, {
        source: 'cache_l2',
        durationMs: performance.now() - startTime,
      });
    }
  }

  // === 原有逻辑（完全不变）===
  const classification = await this.classifier.classify(message, context);
  const complexity = this.complexityEvaluator.evaluate(classification, context);
  const mode = this.modeSelector.select(classification, complexity);

  // ✨ 写入缓存（新增）
  if (isFeatureEnabled('ENABLE_INTENT_CACHE_L1')) {
    this.intentCache.set(message, classification);
  }

  return this.buildRouteResult(classification, complexity, mode);
}
```

### 11.5 零破坏性保证

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        回滚能力验证                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  场景 1: 全部禁用                                                        │
│  ───────────────────                                                    │
│  ENABLE_INTENT_CACHE_L1=false                                           │
│  ENABLE_EARLY_RETURN=false                                              │
│  ENABLE_SEMANTIC_CACHE=false                                            │
│                                                                         │
│  → 完全回退到原有逻辑，零影响                                             │
│                                                                         │
│  场景 2: 仅启用 L1 缓存                                                  │
│  ───────────────────                                                    │
│  ENABLE_INTENT_CACHE_L1=true                                            │
│  ENABLE_SEMANTIC_CACHE=false                                            │
│                                                                         │
│  → 渐进式启用，风险最小化                                                 │
│                                                                         │
│  场景 3: 语义缓存问题                                                    │
│  ───────────────────                                                    │
│  ENABLE_SEMANTIC_CACHE=false                                            │
│                                                                         │
│  → 即时关闭 L2 层，L1 + 规则引擎继续工作                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.6 集成测试策略

```typescript
// __tests__/integration/intent-cache-integration.test.ts

describe('Intent Cache Integration', () => {
  describe('L1 Cache', () => {
    it('should return cached result for exact match', async () => {
      const router = getIntentRouter();

      // 首次调用
      const result1 = await router.route('搜索 React');
      expect(result1.metrics?.source).not.toBe('cache_l1');

      // 二次调用应命中缓存
      const result2 = await router.route('搜索 React');
      expect(result2.metrics?.source).toBe('cache_l1');
      expect(result2.intent).toEqual(result1.intent);
    });

    it('should bypass cache when flag disabled', async () => {
      process.env.ENABLE_INTENT_CACHE_L1 = 'false';
      const router = getIntentRouter();

      await router.route('搜索 React');
      const result = await router.route('搜索 React');

      expect(result.metrics?.source).not.toBe('cache_l1');
    });
  });

  describe('Fallback Behavior', () => {
    it('should work normally when all caches miss', async () => {
      const router = getIntentRouter();
      const result = await router.route('这是一个全新的查询');

      expect(result.intent).toBeDefined();
      expect(result.mode).toBeDefined();
    });
  });
});
```

---

## 十二、决策确认

基于集成分析，以下决策点已确定最优选项：

| 决策点 | 确定选项 | 理由 |
|--------|----------|------|
| 语义缓存阈值 | **0.95** | 平衡命中率与准确率 |
| 反馈收集方式 | **隐式 + 显式结合** | 最大化信号收集 |
| 规则挖掘审核 | **简易管理页** | 中期适用，可扩展 |
| 灰度策略 | **Phase 1 灰度 10%** | 风险可控 |
| Embedding 预算 | **$50/月** | 超出降级纯规则 |
| 缓存实现 | **复用 VectorCache** | 减少重复开发 |

---

## 十三、最终实施计划

```
Week 1 ─────────────────────────────────────────────────────────────────
│
├── Day 1-2: Phase 1.1 - 基础设施
│   ├── 添加 Feature Flags (5 个)
│   ├── 创建 IntentCache 类 (复用 VectorCache)
│   └── 单元测试
│
├── Day 3-4: Phase 1.2 - 规则引擎优化
│   ├── 高权重规则短路
│   ├── LLM TTL 调整
│   └── 集成测试
│
├── Day 5: Phase 1.3 - 客户端优化
│   ├── 快捷命令实现
│   ├── 上下文预处理
│   └── E2E 测试
│
├── Day 6-7: 灰度发布 10%
│   └── 监控指标验证
│
Week 2-3 ───────────────────────────────────────────────────────────────
│
├── Phase 2: 语义缓存
│   ├── 数据库迁移
│   ├── SemanticCache 服务
│   ├── 集成测试
│   └── 全量发布
│
Week 4-6 ───────────────────────────────────────────────────────────────
│
└── Phase 3: 智能进化
    ├── 反馈收集
    ├── 置信度校准
    ├── 规则挖掘
    └── 权重调优
```

---

> **状态**: ✅ 方案已完成，与现有架构无缝集成验证通过
>
> **下一步**: 确认后开始 Phase 1 实施
