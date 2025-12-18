# AnyKeep V4.2 性能优化计划 (完整版)

> 基于 2025-12-12 端到端测试 + 代码分析 + 诊断脚本验证
> 状态：待审核
> 更新日期：2025-12-12

---

## 一、问题总览

| 优先级 | 问题                               | 当前性能            | 目标性能     | 影响范围       | 根因               |
| ------ | ---------------------------------- | ------------------- | ------------ | -------------- | ------------------ |
| **P0** | `/api/classification/inbox` 响应慢 | 11-22s              | <3s          | 首页、待整理页 | N+1查询 + 无缓存   |
| **P0** | `/api/bookmarks` 数据量大          | 14.3MB / 15s        | <100KB / <1s | 首页           | 无分页 + SELECT \* |
| **P1** | `/api/folders` 响应慢              | 4.9-6.2s            | <2s          | 收藏夹页       | 查询未优化         |
| **P1** | Folders 页多个并发锁查询           | 8次请求 / 2-7s each | 1次批量请求  | 收藏夹页       | 串行请求           |
| **P2** | `/api/confirmations` 偶发 401      | 首次偶发失败        | 100% 成功    | 待整理页       | 认证时序           |

---

## 二、诊断数据 (2025-12-12 实测)

### 2.1 N+1 查询问题验证 ✅

```
诊断结果：N+1 问题影响极其严重

┌─────────────────────────────────────────────────────────┐
│  N+1 模式 (10次顺序查询)    │  23,748 ms              │
│  批量模式 (1次查询)          │     319 ms              │
│  ─────────────────────────────────────────────────────  │
│  性能差异                    │   74.4x 更慢            │
│  潜在节省                    │  23,429 ms (~23秒)      │
└─────────────────────────────────────────────────────────┘
```

**根因定位**：

- 文件：`src/lib/classification/services/inbox-organizer.service.ts`
- 方法：`matchClusterToFolder()` 在循环中被调用
- 每个 cluster 单独查询数据库获取 folder_profiles

### 2.2 数据传输问题验证 ✅

```
诊断结果：全量查询数据量过大

┌─────────────────────────────────────────────────────────┐
│  全量查询 (SELECT *)         │  15,108 ms / 14,356 KB  │
│  分页查询 (limit 20)         │     354 ms /      7 KB  │
│  ─────────────────────────────────────────────────────  │
│  时间减少                    │    97.6%                │
│  数据量减少                  │    99.95%               │
└─────────────────────────────────────────────────────────┘
```

**根因定位**：

- 文件：`src/app/api/bookmarks/route.ts`
- 问题 1：`SELECT *` 获取所有字段（包括大字段如 embedding、summary）
- 问题 2：无分页，一次性返回所有书签
- 问题 3：`count: "exact"` 触发额外 COUNT(\*) 查询

### 2.3 数据规模

| 指标                | 数量     |
| ------------------- | -------- |
| 总书签数            | 1,000 条 |
| 有 embedding 的书签 | 181 条   |
| 用户文件夹          | 19 个    |
| 有 profile 的文件夹 | 9 个     |

---

## 三、优化方案详情

### 3.1 [P0-关键] N+1 查询修复

**问题代码**：

```typescript
// ❌ BEFORE: inbox-organizer.service.ts
async analyze(userId: string) {
  const clusters = clusterBookmarks(...);

  // N+1 问题：每个 cluster 单独查询
  for (const cluster of clusters) {
    const matchedFolder = await this.matchClusterToFolder(
      cluster.centroid,
      userId
    );  // 每次都查询数据库
  }
}
```

**优化方案**：

```typescript
// ✅ AFTER: 批量查询 + 内存匹配
async analyze(userId: string) {
  const clusters = clusterBookmarks(...);

  // 1. 一次性获取所有 folder profiles
  const allProfiles = await this.folderProfileRepo.findByUserId(userId);

  // 2. 在内存中匹配
  const suggestions = clusters.map(cluster => ({
    cluster,
    matchedFolder: this.matchClusterInMemory(cluster.centroid, allProfiles)
  }));
}

// 新增内存匹配方法
private matchClusterInMemory(
  centroid: number[],
  profiles: FolderProfile[]
): FolderProfile | null {
  let bestMatch: FolderProfile | null = null;
  let bestSimilarity = 0;

  for (const profile of profiles) {
    if (!profile.computed_embedding) continue;
    const similarity = cosineSimilarity(centroid, profile.computed_embedding);
    if (similarity > bestSimilarity && similarity > 0.7) {
      bestSimilarity = similarity;
      bestMatch = profile;
    }
  }

  return bestMatch;
}
```

**涉及文件**：

- `src/lib/classification/services/inbox-organizer.service.ts`
- `src/lib/classification/repositories/folder-profile.repository.ts`

**预期改进**：
| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 匹配耗时 | 23,748ms | ~320ms | **98.6%** |

**工作量**：0.5 天

---

### 3.2 [P0-关键] Inbox 结果缓存

**问题分析**：

- 每次访问都重新计算聚类和匹配
- 用户数据变化不频繁，但每次都全量计算

**⚠️ 缓存架构选型**：

> **重要提示**：Next.js App Router 在 Serverless 环境下，每次请求可能运行在不同实例上，**内存中的 `Map` 无法跨请求共享**。必须选择合适的缓存策略。

| 方案                         | 适用场景              | 优点                       | 缺点              |
| ---------------------------- | --------------------- | -------------------------- | ----------------- |
| **方案 A：`unstable_cache`** | 推荐用于 Vercel 部署  | Next.js 原生支持，自动失效 | API 仍在实验阶段  |
| **方案 B：Supabase 缓存表**  | 推荐用于自托管/持久化 | 跨实例共享，持久化         | 额外数据库查询    |
| **方案 C：内存 Map**         | 仅适用于单实例部署    | 实现简单                   | Serverless 下无效 |

---

#### 方案 A：使用 `unstable_cache`（推荐）

```typescript
// src/lib/classification/services/inbox-organizer.service.ts
import { unstable_cache } from "next/cache";

export class InboxOrganizerService {
  async analyze(userId: string): Promise<OrganizationAnalysis> {
    // 使用 Next.js 内置缓存，5 分钟 TTL
    const cachedAnalyze = unstable_cache(
      async (uid: string) => {
        return await this.performAnalysis(uid);
      },
      [`inbox-analysis-${userId}`], // 缓存 key
      {
        revalidate: 300, // 5 分钟
        tags: [`user-${userId}-inbox`], // 用于手动失效
      },
    );

    return cachedAnalyze(userId);
  }

  // 缓存失效（书签变化时调用）
  async invalidateCache(userId: string): Promise<void> {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(`user-${userId}-inbox`);
  }
}
```

---

#### 方案 B：Supabase 缓存表（跨实例共享）

```sql
-- 新增迁移文件：supabase/migrations/xxx_add_analysis_cache.sql
CREATE TABLE IF NOT EXISTS analysis_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis JSONB NOT NULL,
  bookmark_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analysis_cache_updated ON analysis_cache(updated_at);
```

```typescript
// src/lib/classification/services/inbox-organizer.service.ts

export class InboxOrganizerService {
  private CACHE_TTL = 5 * 60 * 1000; // 5 分钟

  async analyze(userId: string): Promise<OrganizationAnalysis> {
    // 1. 计算当前数据哈希
    const currentHash = await this.computeBookmarkHash(userId);

    // 2. 查询数据库缓存
    const { data: cached } = await this.supabase
      .from("analysis_cache")
      .select("analysis, bookmark_hash, updated_at")
      .eq("user_id", userId)
      .single();

    // 3. 检查缓存有效性
    if (
      cached &&
      cached.bookmark_hash === currentHash &&
      Date.now() - new Date(cached.updated_at).getTime() < this.CACHE_TTL
    ) {
      return cached.analysis as OrganizationAnalysis;
    }

    // 4. 执行分析
    const analysis = await this.performAnalysis(userId);

    // 5. 更新缓存（upsert）
    await this.supabase.from("analysis_cache").upsert({
      user_id: userId,
      analysis,
      bookmark_hash: currentHash,
      updated_at: new Date().toISOString(),
    });

    return analysis;
  }
}
```

---

#### 方案 C：内存 Map（单实例部署备选）

```typescript
// ⚠️ 仅适用于单实例部署（如 Docker 单容器）
// Serverless 环境下此方案无效！

interface CachedAnalysis {
  analysis: OrganizationAnalysis;
  bookmarkHash: string;
  timestamp: number;
}

export class InboxOrganizerService {
  private analysisCache = new Map<string, CachedAnalysis>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 分钟

  async analyze(userId: string): Promise<OrganizationAnalysis> {
    // 1. 计算当前数据哈希
    const currentHash = await this.computeBookmarkHash(userId);

    // 2. 检查缓存
    const cached = this.analysisCache.get(userId);
    if (
      cached &&
      cached.bookmarkHash === currentHash &&
      Date.now() - cached.timestamp < this.CACHE_TTL
    ) {
      return cached.analysis; // 缓存命中
    }

    // 3. 执行分析
    const analysis = await this.performAnalysis(userId);

    // 4. 更新缓存
    this.analysisCache.set(userId, {
      analysis,
      bookmarkHash: currentHash,
      timestamp: Date.now(),
    });

    return analysis;
  }

  private async computeBookmarkHash(userId: string): Promise<string> {
    // 基于最新书签的更新时间生成哈希
    const { data } = await this.supabase
      .from("bookmarks")
      .select("id, updated_at")
      .eq("user_id", userId)
      .is("folder_id", null)
      .order("updated_at", { ascending: false })
      .limit(1);

    const latestUpdate = data?.[0]?.updated_at || "";
    return `${userId}-${latestUpdate}`;
  }
}
```

**缓存失效触发**：

- 新增书签
- 删除书签
- 书签移动到文件夹
- 手动刷新

**预期改进**：
| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 重复访问 | 11-22s | <100ms | **99%+** |

**工作量**：0.5 天

---

### 3.3 [P0] `/api/bookmarks` 分页优化

**问题分析**：

- 当前一次性返回所有书签 (14.3MB)
- 包含完整的 summary、tags、embedding 等大字段
- 首页加载时拖慢整体性能

**优化方案**：

#### 阶段 1：游标分页 (Cursor-based Pagination)

```typescript
// src/app/api/bookmarks/route.ts

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  // 1. 精简字段选择
  const listFields = `
    id,
    title,
    url,
    platform,
    cover_url,
    favicon_url,
    created_at,
    folder_id,
    folders(name)
  `;

  let query = supabase
    .from("bookmarks")
    .select(listFields) // ✅ 精简字段
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit + 1); // 多取一条判断是否有下一页

  // 2. 游标分页
  if (cursor) {
    const [cursorTime, cursorId] = cursor.split("_");
    query = query.or(
      `created_at.lt.${cursorTime},and(created_at.eq.${cursorTime},id.lt.${cursorId})`,
    );
  }

  const { data: bookmarks, error } = await query;

  // 3. 计算下一页游标
  const hasMore = bookmarks && bookmarks.length > limit;
  const items = hasMore ? bookmarks.slice(0, limit) : bookmarks;
  const nextCursor = hasMore
    ? `${items[items.length - 1].created_at}_${items[items.length - 1].id}`
    : null;

  return successResponse({
    items,
    nextCursor,
    hasMore,
  });
}
```

---

#### Total Count 优化策略

当业务确实需要显示总数时，提供以下方案：

| 方案                 | 适用场景         | 优点               | 缺点              |
| -------------------- | ---------------- | ------------------ | ----------------- |
| **方案 A：移除总数** | 无限滚动场景     | 最简单，无额外查询 | 无法显示"共 X 条" |
| **方案 B：异步查询** | 需要总数但非首屏 | 不阻塞首屏         | 需要额外请求      |
| **方案 C：估算值**   | 大数据量场景     | 极快（~1ms）       | 不精确            |
| **方案 D：缓存总数** | 总数变化不频繁   | 精确 + 快速        | 需要维护缓存      |

**方案 A：移除总数（推荐首选）**

```typescript
// 使用 limit + 1 判断是否有下一页，无需 COUNT
.limit(limit + 1)  // 如果返回 limit+1 条，说明有下一页
```

**方案 B：异步查询总数**

```typescript
// src/app/api/bookmarks/count/route.ts
export async function GET(request: NextRequest) {
  const user = await getUser();

  const { count } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true }) // head: true 不返回数据
    .eq("user_id", user.id)
    .is("deleted_at", null);

  return successResponse({ count });
}

// 前端：延迟加载总数
useEffect(() => {
  // 首屏加载后再请求总数
  const timer = setTimeout(() => {
    fetch("/api/bookmarks/count")
      .then((r) => r.json())
      .then((data) => setTotalCount(data.count));
  }, 1000);
  return () => clearTimeout(timer);
}, []);
```

**方案 C：PostgreSQL 估算值**

```sql
-- 使用 pg_class 获取估算行数（~1ms）
SELECT reltuples::bigint AS estimate
FROM pg_class
WHERE relname = 'bookmarks';

-- 或使用 EXPLAIN 获取估算
CREATE OR REPLACE FUNCTION estimate_row_count(table_name text, where_clause text DEFAULT '1=1')
RETURNS bigint AS $$
DECLARE
  plan_json json;
  rows bigint;
BEGIN
  EXECUTE format('EXPLAIN (FORMAT JSON) SELECT 1 FROM %I WHERE %s', table_name, where_clause)
  INTO plan_json;
  rows := (plan_json -> 0 -> 'Plan' ->> 'Plan Rows')::bigint;
  RETURN rows;
END;
$$ LANGUAGE plpgsql;
```

**方案 D：缓存总数**

```typescript
// 在书签增删时更新缓存
async function updateBookmarkCount(userId: string, delta: number) {
  await supabase.rpc("update_bookmark_count", {
    p_user_id: userId,
    p_delta: delta,
  });
}
```

#### 阶段 2：前端虚拟滚动集成 + 智能预取

**预取策略**：在用户滚动到 80% 位置时提前加载下一页，而非等到底部。

```typescript
// src/components/home/home-page-client.tsx

import { Virtuoso } from 'react-virtuoso';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

function BookmarkList() {
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['bookmarks'],
    queryFn: ({ pageParam }) => fetchBookmarks(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const items = data?.pages.flatMap(page => page.items) ?? [];
  const prefetchTriggered = useRef(false);

  // 智能预取：80% 位置触发
  const handleRangeChanged = useCallback(({ endIndex }: { startIndex: number; endIndex: number }) => {
    const threshold = Math.floor(items.length * 0.8);  // 80% 位置

    if (
      endIndex >= threshold &&
      hasNextPage &&
      !isFetchingNextPage &&
      !prefetchTriggered.current
    ) {
      prefetchTriggered.current = true;
      fetchNextPage().finally(() => {
        prefetchTriggered.current = false;
      });
    }
  }, [items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <Virtuoso
      data={items}
      rangeChanged={handleRangeChanged}  // 监听可见范围变化
      endReached={() => {
        // 兜底：如果 80% 预取没触发，底部再触发一次
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      itemContent={(index, bookmark) => (
        <BookmarkCard bookmark={bookmark} />
      )}
      components={{
        Footer: () => isFetchingNextPage ? <LoadingSpinner /> : null
      }}
      // 性能优化配置
      overscan={200}  // 预渲染缓冲区 200px
      increaseViewportBy={{ top: 100, bottom: 200 }}  // 视口扩展
    />
  );
}
```

**涉及文件**：

- `src/app/api/bookmarks/route.ts`
- `src/components/home/home-page-client.tsx`
- `src/components/bookmark/bookmark-list.tsx`

**预期改进**：
| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 首屏数据量 | 14,356KB | ~7KB | **99.95%** |
| 首屏响应时间 | 15,108ms | ~350ms | **97.6%** |

**工作量**：2 天

---

### 3.4 [P0] 聚类算法优化

**问题分析**：

- `clusterBookmarks()` 对大数据集（几百个书签）可能耗时 1-5s
- O(n²) 复杂度，阻塞主线程

**优化方案**：

```typescript
// src/lib/classification/utils/clustering.ts

export function clusterBookmarks(
  bookmarks: BookmarkForClustering[],
  similarityThreshold: number,
  minClusterSize: number,
  options: {
    maxBookmarks?: number; // 限制处理数量
    timeoutMs?: number; // 超时保护
  } = {},
): Cluster[] {
  const { maxBookmarks = 200, timeoutMs = 3000 } = options;
  const startTime = Date.now();

  // 1. 数量限制：只处理最近的 N 个
  const limitedBookmarks = bookmarks
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, maxBookmarks);

  const clusters: Cluster[] = [];
  const processed = new Set<string>();

  for (const bookmark of limitedBookmarks) {
    // 2. 超时保护
    if (Date.now() - startTime > timeoutMs) {
      console.warn(
        `[Clustering] Timeout after ${timeoutMs}ms, processed ${clusters.length} clusters`,
      );
      break;
    }

    if (processed.has(bookmark.id)) continue;

    // ... 聚类逻辑
  }

  return clusters;
}
```

**预期改进**：
| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 聚类时间 | 1-5s | <1s | **80%+** |

**工作量**：0.5 天

---

### 3.5 [P0] 匹配器并行执行

**问题分析**：

- `classification.service.ts` 中匹配器顺序执行
- Vector Matcher、History Matcher、AI Recommender 串行运行

**优化方案**：

```typescript
// src/lib/classification/services/classification.service.ts

// ❌ BEFORE: 顺序执行
async classify(request: ClassificationRequest) {
  const results: MatchResult[] = [];
  for (const matcher of this.matchers) {
    const result = await matcher.match(request);
    results.push(result);
  }
  return this.aggregateResults(results);
}

// ✅ AFTER: 并行执行
async classify(request: ClassificationRequest) {
  const results = await Promise.all(
    this.matchers.map(matcher =>
      matcher.match(request).catch(error => {
        console.error(`[Matcher] ${matcher.name} failed:`, error);
        return null;  // 单个匹配器失败不影响整体
      })
    )
  );

  const validResults = results.filter((r): r is MatchResult => r !== null);
  return this.aggregateResults(validResults);
}
```

**预期改进**：
| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 匹配总时间 | 300-500ms | 150-200ms | **50%+** |

**工作量**：0.5 天

---

### 3.6 [P1] `/api/folders` 优化

**问题分析**：

- 响应时间 4.9-6.2s
- 每次都查询完整的文件夹树

**优化方案**：

```typescript
// src/app/api/folders/route.ts

export async function GET(request: NextRequest) {
  const user = await getUser();

  // 1. 精简字段
  const { data: folders } = await supabase
    .from("folders")
    .select(
      "id, name, parent_id, icon, color, is_system, system_type, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // 2. 添加缓存头
  const response = successResponse({ folders });
  response.headers.set("Cache-Control", "private, max-age=300"); // 5分钟

  return response;
}
```

**数据库索引优化**：

```sql
-- supabase/migrations/xxx_add_performance_indexes.sql

-- =====================================================
-- 1. Folders 表索引
-- =====================================================

-- 用户文件夹查询（user_id + parent_id 组合查询）
CREATE INDEX IF NOT EXISTS idx_folders_user_parent
ON folders(user_id, parent_id);

-- 文件夹排序（按创建时间）
CREATE INDEX IF NOT EXISTS idx_folders_user_created
ON folders(user_id, created_at DESC);

-- =====================================================
-- 2. Bookmarks 表索引（关键）
-- =====================================================

-- 游标分页查询（user_id + created_at + id 复合索引）
-- 支持 WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_cursor
ON bookmarks(user_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

-- 收件箱查询（未分类书签）
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_inbox
ON bookmarks(user_id, created_at DESC)
WHERE folder_id IS NULL AND deleted_at IS NULL;

-- 平台筛选（按平台查询）
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_platform
ON bookmarks(user_id, platform, created_at DESC)
WHERE deleted_at IS NULL;

-- =====================================================
-- 3. Folder Profiles 表索引
-- =====================================================

-- 批量获取用户的所有 folder profiles
CREATE INDEX IF NOT EXISTS idx_folder_profiles_user
ON folder_profiles(user_id);

-- =====================================================
-- 4. Classification 相关表索引
-- =====================================================

-- 待确认分类查询
CREATE INDEX IF NOT EXISTS idx_confirmations_user_status
ON classification_confirmations(user_id, status, created_at DESC)
WHERE status = 'pending';

-- LLM 使用记录查询（成本统计）
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_date
ON llm_usage_log(user_id, created_at DESC);

-- =====================================================
-- 5. 索引维护建议
-- =====================================================

-- 定期分析表统计信息（建议每周执行）
-- ANALYZE bookmarks;
-- ANALYZE folders;
-- ANALYZE folder_profiles;

-- 检查索引使用情况
-- SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;
```

**索引影响评估**：

| 索引                            | 受益查询           | 预期提升   |
| ------------------------------- | ------------------ | ---------- |
| `idx_bookmarks_user_cursor`     | 书签分页列表       | 15s → <1s  |
| `idx_bookmarks_user_inbox`      | 收件箱书签         | 5s → <0.5s |
| `idx_folder_profiles_user`      | 文件夹画像批量获取 | 消除 N+1   |
| `idx_confirmations_user_status` | 待确认列表         | 3s → <0.5s |

**预期改进**：
| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 响应时间 | 4.9-6.2s | <2s | **60%+** |

**工作量**：1 天（含索引创建 + 验证）

---

### 3.7 [P1] Folders 页批量锁查询

**问题分析**：

- 当前每个文件夹单独请求 `/api/folders/[id]/lock`
- 8 个文件夹 = 8 次网络请求

**优化方案**：

```typescript
// 新增 src/app/api/folders/batch-lock-status/route.ts

export async function POST(request: NextRequest) {
  const user = await getUser();
  const { folderIds } = await request.json();

  const { data: locks } = await supabase
    .from("folder_locks")
    .select("folder_id, locked_by, locked_at")
    .in("folder_id", folderIds)
    .eq("user_id", user.id);

  // 构建响应 Map
  const lockStatus = Object.fromEntries(
    folderIds.map((id) => [
      id,
      { locked: locks?.some((l) => l.folder_id === id) || false },
    ]),
  );

  return successResponse(lockStatus);
}
```

**前端调用**：

```typescript
// 批量获取锁状态
const lockStatus = await fetch("/api/folders/batch-lock-status", {
  method: "POST",
  body: JSON.stringify({ folderIds: [2, 14, 16, 17, 18, 19, 20, 21] }),
}).then((r) => r.json());
```

**预期改进**：
| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 请求数 | 8 次 | 1 次 | **87%** |
| 总耗时 | 16-56s | <3s | **80%+** |

**工作量**：0.5 天

---

### 3.8 [P2] `/api/confirmations` 401 修复

**问题分析**：

- 首次请求偶发 401
- 可能是 session 初始化时序问题

**优化方案**：

```typescript
// 前端：添加重试机制
async function fetchConfirmations() {
  try {
    return await fetch("/api/confirmations").then((r) => r.json());
  } catch (error) {
    // 401 时自动重试一次
    if (error.status === 401) {
      await new Promise((r) => setTimeout(r, 500));
      return await fetch("/api/confirmations").then((r) => r.json());
    }
    throw error;
  }
}

// 后端：添加日志
export async function GET() {
  const user = await getUser();
  if (!user) {
    console.warn("[Confirmations] Auth failed, session:", await getSession());
    return errorResponse(401, "Unauthorized");
  }
  // ...
}
```

**工作量**：0.5 天

---

### 3.9 [P1] HTTP 响应压缩

**问题分析**：

- `/api/bookmarks` 响应 14.3MB，网络传输耗时长
- 即使分页后首屏 ~50KB，仍可进一步压缩
- JSON 文本压缩率可达 70-90%

**优化方案**：

#### Next.js 压缩配置

```typescript
// next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用 gzip/brotli 压缩
  compress: true, // 默认已启用，确保未被禁用

  // 自定义响应头（CDN/反向代理场景）
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Content-Encoding",
            value: "gzip", // 由 Next.js 自动处理
          },
          {
            key: "Vary",
            value: "Accept-Encoding",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

#### Vercel 部署自动压缩

Vercel 默认启用 Brotli 和 Gzip 压缩，无需额外配置。

#### 自托管 Nginx 配置

```nginx
# /etc/nginx/conf.d/compression.conf

gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
gzip_types
    application/json
    application/javascript
    text/css
    text/plain
    text/xml
    application/xml;

# Brotli (需要 ngx_brotli 模块)
brotli on;
brotli_comp_level 6;
brotli_types application/json application/javascript text/css text/plain;
```

**预期改进**：

| 指标     | 压缩前 | 压缩后 (gzip) | 压缩后 (brotli) |
| -------- | ------ | ------------- | --------------- |
| 首屏数据 | 50KB   | ~15KB         | ~12KB           |
| 全量数据 | 14.3MB | ~2MB          | ~1.5MB          |
| 压缩率   | -      | 70%           | 80%             |

**工作量**：0.25 天（配置验证）

---

### 3.10 [P2] 全局错误边界与降级

**问题分析**：

- 当前缺乏统一的错误处理机制
- API 失败时用户体验不佳（白屏或无反馈）
- 性能优化可能引入新的边界情况

**优化方案**：

#### 全局错误边界组件

```typescript
// src/components/error-boundary.tsx
"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 上报错误到监控服务
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);

    // 调用自定义错误处理
    this.props.onError?.(error, errorInfo);

    // 可选：上报到 Sentry/LogRocket 等
    // Sentry.captureException(error, { extra: errorInfo });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">出了点问题</h2>
          <p className="text-muted-foreground mb-4">
            {this.state.error?.message || "页面加载时发生错误"}
          </p>
          <Button onClick={this.handleRetry} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### 在布局中集成

```typescript
// src/app/(main)/layout.tsx

import { ErrorBoundary } from "@/components/error-boundary";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error) => {
        // 可选：上报错误
        fetch("/api/error-report", {
          method: "POST",
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});  // 静默失败
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

#### 列表组件专用降级

```typescript
// src/components/bookmark/bookmark-list-fallback.tsx

export function BookmarkListFallback() {
  return (
    <div className="space-y-4 p-4">
      <p className="text-muted-foreground text-center">
        书签列表加载失败
      </p>
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          刷新页面
        </Button>
        <Button variant="ghost" asChild>
          <a href="/search">去搜索</a>
        </Button>
      </div>
    </div>
  );
}

// 使用
<ErrorBoundary fallback={<BookmarkListFallback />}>
  <BookmarkList />
</ErrorBoundary>
```

**涉及文件**：

- `src/components/error-boundary.tsx`（新增）
- `src/app/(main)/layout.tsx`
- `src/components/bookmark/bookmark-list-fallback.tsx`（新增）

**工作量**：0.5 天

---

## 四、实施计划（详细分解）

### 前端现状分析

| 模块       | 当前实现                         | 优化影响                |
| ---------- | -------------------------------- | ----------------------- |
| 数据获取   | SWR 缓存系统 (`useBookmarksSWR`) | 需适配新响应格式        |
| 书签列表   | 普通书签无虚拟滚动               | 需集成 `react-virtuoso` |
| 浏览器书签 | 已有虚拟滚动                     | 无需改动 ✅             |
| 分页机制   | 已有 cursor + limit              | 需完善 `loadMore` 逻辑  |
| 文件夹锁   | 每个文件夹单独请求               | 需改为批量请求          |
| 错误处理   | 乐观更新 + 回滚                  | 需增加 401 重试         |

---

### 第一周：P0 问题 (关键路径)

#### Day 0.5：性能监控基建

| 序号 | 任务                             | 类型 | 涉及文件                                    | 产出           |
| ---- | -------------------------------- | ---- | ------------------------------------------- | -------------- |
| 0.1  | 创建 PerformanceMonitor 工具类   | 后端 | `src/lib/utils/performance-monitor.ts`      | 性能埋点工具   |
| 0.2  | 埋点 `/api/classification/inbox` | 后端 | `src/app/api/classification/inbox/route.ts` | 各阶段耗时日志 |
| 0.3  | 埋点 `/api/bookmarks`            | 后端 | `src/app/api/bookmarks/route.ts`            | 查询耗时日志   |
| 0.4  | 收集基线数据 (10+ 次请求)        | 测试 | -                                           | 基线报告       |

---

#### Day 1：N+1 查询修复

| 序号 | 任务                             | 类型 | 涉及文件                                                           | 产出         |
| ---- | -------------------------------- | ---- | ------------------------------------------------------------------ | ------------ |
| 1.1  | 新增 `findByUserId` 批量查询方法 | 后端 | `src/lib/classification/repositories/folder-profile.repository.ts` | 批量获取接口 |
| 1.2  | 新增 `matchClusterInMemory` 方法 | 后端 | `src/lib/classification/services/inbox-organizer.service.ts`       | 内存匹配函数 |
| 1.3  | 重构 `analyze()` 使用批量查询    | 后端 | `src/lib/classification/services/inbox-organizer.service.ts`       | 消除 N+1     |
| 1.4  | 单元测试：验证匹配结果一致性     | 测试 | `src/lib/classification/__tests__/`                                | 测试用例     |

**前端影响**：无 ✅（纯后端优化）

---

#### Day 1.5：Inbox 结果缓存

| 序号  | 任务                                 | 类型 | 涉及文件                                                          | 产出         |
| ----- | ------------------------------------ | ---- | ----------------------------------------------------------------- | ------------ |
| 1.5.1 | 实现 `CachedAnalysis` 接口和缓存 Map | 后端 | `src/lib/classification/services/inbox-organizer.service.ts`      | 缓存数据结构 |
| 1.5.2 | 实现 `computeBookmarkHash()` 方法    | 后端 | `src/lib/classification/services/inbox-organizer.service.ts`      | 数据哈希函数 |
| 1.5.3 | 缓存命中/失效逻辑                    | 后端 | `src/lib/classification/services/inbox-organizer.service.ts`      | 缓存层       |
| 1.5.4 | API 返回 `cacheHit` 标识             | 后端 | `src/app/api/classification/inbox/route.ts`                       | 响应增强     |
| 1.5.5 | **[前端]** 添加手动刷新按钮          | 前端 | `src/components/classification/pending-confirmations-section.tsx` | 刷新功能     |
| 1.5.6 | **[前端]** 显示缓存状态指示器        | 前端 | `src/components/classification/pending-confirmations-section.tsx` | UX 优化      |

**前端改动详情**：

```typescript
// pending-confirmations-section.tsx 新增

// 1. 刷新按钮
<Button
  variant="ghost"
  size="sm"
  onClick={() => fetchConfirmations(true)}  // force refresh
  disabled={isRefreshing}
>
  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
</Button>

// 2. 缓存状态指示
{data?.cacheHit && (
  <span className="text-xs text-muted-foreground">
    已缓存 · 点击刷新获取最新
  </span>
)}
```

---

#### Day 2：Bookmarks API 游标分页

| 序号 | 任务                                         | 类型 | 涉及文件                                   | 产出      |
| ---- | -------------------------------------------- | ---- | ------------------------------------------ | --------- |
| 2.1  | 修改 API 支持 `cursor` 参数                  | 后端 | `src/app/api/bookmarks/route.ts`           | 分页参数  |
| 2.2  | 实现游标生成逻辑 (`created_at_id`)           | 后端 | `src/app/api/bookmarks/route.ts`           | 游标编码  |
| 2.3  | 修改响应格式返回 `nextCursor`                | 后端 | `src/app/api/bookmarks/route.ts`           | 响应格式  |
| 2.4  | 移除 `count: "exact"` 改用 `limit + 1`       | 后端 | `src/app/api/bookmarks/route.ts`           | 性能优化  |
| 2.5  | **[前端]** 更新 `useBookmarksSWR` 解析新响应 | 前端 | `src/lib/cache/hooks/use-bookmarks-swr.ts` | Hook 适配 |
| 2.6  | **[前端]** 完善 `loadMore()` 使用 nextCursor | 前端 | `src/lib/cache/hooks/use-bookmarks-swr.ts` | 加载更多  |

**API 响应格式变更**：

```typescript
// BEFORE
{
  success: true,
  data: {
    bookmarks: [...],
    pagination: { hasMore, cursor, count }
  }
}

// AFTER (向后兼容)
{
  success: true,
  data: {
    bookmarks: [...],       // 保持不变
    pagination: {
      hasMore: boolean,
      nextCursor: string | null,  // 新增：游标字符串
      cursor: number,             // 保留：兼容旧客户端
    }
  }
}
```

**前端改动详情**：

```typescript
// use-bookmarks-swr.ts 修改

// 1. 解析新响应格式
const { bookmarks, pagination } = data;
const { hasMore, nextCursor } = pagination;

// 2. loadMore 使用 nextCursor
const loadMore = async () => {
  if (!hasMore || isLoadingMore) return;

  const params = new URLSearchParams({
    ...baseParams,
    cursor: nextCursor, // 使用字符串游标
    limit: "20",
  });

  const res = await fetch(`/api/bookmarks?${params}`);
  // ...
};
```

---

#### Day 3：字段精简 + 前端虚拟滚动

| 序号 | 任务                                       | 类型 | 涉及文件                                             | 产出       |
| ---- | ------------------------------------------ | ---- | ---------------------------------------------------- | ---------- |
| 3.1  | 定义 `LIST_FIELDS` 常量 (精简字段)         | 后端 | `src/app/api/bookmarks/route.ts`                     | 字段定义   |
| 3.2  | GET 请求使用精简字段                       | 后端 | `src/app/api/bookmarks/route.ts`                     | 数据量减少 |
| 3.3  | 新增 `/api/bookmarks/[id]/detail` 详情接口 | 后端 | `src/app/api/bookmarks/[id]/detail/route.ts`         | 详情 API   |
| 3.4  | **[前端]** 更新 `BookmarkWithFolder` 类型  | 前端 | `src/types/bookmark.ts`                              | 类型更新   |
| 3.5  | **[前端]** 集成虚拟滚动到 `HomePageClient` | 前端 | `src/components/home/home-page-client.tsx`           | 虚拟滚动   |
| 3.6  | **[前端]** 实现滚动加载下一页              | 前端 | `src/components/home/home-page-client.tsx`           | 无限滚动   |
| 3.7  | **[前端]** 详情页按需获取完整数据          | 前端 | `src/components/bookmark/bookmark-detail-client.tsx` | 详情加载   |

**前端改动详情**：

```typescript
// home-page-client.tsx 集成虚拟滚动

import { Virtuoso } from 'react-virtuoso';

// 替换现有的 map 渲染
{viewMode === 'card' ? (
  // 卡片视图：使用 Masonry + Virtuoso
  <Virtuoso
    useWindowScroll
    data={bookmarks}
    endReached={() => hasMore && !isLoadingMore && loadMore()}
    itemContent={(index, bookmark) => (
      <BookmarkCard
        key={bookmark.id}
        bookmark={bookmark}
        onDelete={handleDelete}
        // ...
      />
    )}
    components={{
      Footer: () => isLoadingMore ? <LoadingSpinner /> : null,
    }}
  />
) : (
  // 列表视图：使用 react-virtuoso
  <Virtuoso
    style={{ height: 'calc(100vh - 200px)' }}
    data={bookmarks}
    endReached={() => hasMore && !isLoadingMore && loadMore()}
    itemContent={(index, bookmark) => (
      <BookmarkListItem key={bookmark.id} bookmark={bookmark} />
    )}
    overscan={200}
  />
)}
```

**类型更新**：

```typescript
// src/types/bookmark.ts

// 列表字段（精简）
export interface BookmarkListItem {
  id: number;
  title: string;
  url: string;
  platform: string;
  cover_url: string | null;
  favicon_url: string | null;
  created_at: string;
  folder_id: number | null;
  folders: { name: string } | null;
}

// 详情字段（完整）
export interface BookmarkDetail extends BookmarkListItem {
  description: string | null;
  summary: string | null;
  ai_summary: string | null;
  tags: string[];
  embedding: number[] | null;
  // ...
}
```

---

#### Day 4：聚类优化 + 匹配器并行化

| 序号 | 任务                                   | 类型 | 涉及文件                                                    | 产出     |
| ---- | -------------------------------------- | ---- | ----------------------------------------------------------- | -------- |
| 4.1  | 添加 `maxBookmarks` 数量限制           | 后端 | `src/lib/classification/utils/clustering.ts`                | 数量限制 |
| 4.2  | 添加 `timeoutMs` 超时保护              | 后端 | `src/lib/classification/utils/clustering.ts`                | 超时机制 |
| 4.3  | 修改 `classify()` 使用 `Promise.all()` | 后端 | `src/lib/classification/services/classification.service.ts` | 并行执行 |
| 4.4  | 添加单个匹配器失败容错                 | 后端 | `src/lib/classification/services/classification.service.ts` | 错误隔离 |
| 4.5  | 性能测试验证                           | 测试 | -                                                           | 性能报告 |

**前端影响**：无 ✅（纯后端优化）

---

#### Day 5：集成测试 + 性能验证

| 序号 | 任务                     | 类型 | 涉及文件                                | 产出     |
| ---- | ------------------------ | ---- | --------------------------------------- | -------- |
| 5.1  | 运行诊断脚本对比优化前后 | 测试 | `scripts/diagnose-inbox-performance.ts` | 对比报告 |
| 5.2  | E2E 测试：首页加载流程   | 测试 | -                                       | 测试通过 |
| 5.3  | E2E 测试：无限滚动功能   | 测试 | -                                       | 测试通过 |
| 5.4  | E2E 测试：待整理页功能   | 测试 | -                                       | 测试通过 |
| 5.5  | 性能基线记录             | 文档 | `docs/performance/`                     | 基线文档 |
| 5.6  | 修复发现的问题           | 修复 | -                                       | Bug 修复 |

---

### 第二周：P1/P2 问题

#### Day 6 (Week2 D1)：Folders API 优化

| 序号 | 任务                                 | 类型 | 涉及文件                                 | 产出      |
| ---- | ------------------------------------ | ---- | ---------------------------------------- | --------- |
| 6.1  | 定义 `FOLDER_LIST_FIELDS` 精简字段   | 后端 | `src/app/api/folders/route.ts`           | 字段定义  |
| 6.2  | 添加 `Cache-Control` 响应头          | 后端 | `src/app/api/folders/route.ts`           | HTTP 缓存 |
| 6.3  | 检查/添加数据库索引                  | 后端 | `supabase/migrations/`                   | 索引优化  |
| 6.4  | **[前端]** 创建 `useFoldersSWR` Hook | 前端 | `src/lib/cache/hooks/use-folders-swr.ts` | 缓存 Hook |
| 6.5  | **[前端]** 替换现有 folders 获取逻辑 | 前端 | `src/components/folder/`                 | 集成 SWR  |

**前端改动详情**：

```typescript
// 新增 src/lib/cache/hooks/use-folders-swr.ts

export function useFoldersSWR(options: {
  enabled?: boolean;
  initialData?: Folder[];
}) {
  const [folders, setFolders] = useState<Folder[]>(options.initialData || []);
  const [isLoading, setIsLoading] = useState(!options.initialData);

  const fetchFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    const data = await res.json();
    setFolders(data.folders);
  }, []);

  // SWR 配置：5分钟缓存，1分钟新鲜
  // ...

  return { folders, isLoading, refetch: fetchFolders };
}
```

---

#### Day 7 (Week2 D2)：批量锁查询

| 序号 | 任务                                       | 类型 | 涉及文件                                         | 产出      |
| ---- | ------------------------------------------ | ---- | ------------------------------------------------ | --------- |
| 7.1  | 新增 `/api/folders/batch-lock-status`      | 后端 | `src/app/api/folders/batch-lock-status/route.ts` | 批量 API  |
| 7.2  | 实现批量查询逻辑                           | 后端 | `src/app/api/folders/batch-lock-status/route.ts` | 查询实现  |
| 7.3  | **[前端]** 新增 `useFolderLockStatus` Hook | 前端 | `src/hooks/use-folder-lock-status.ts`            | 批量 Hook |
| 7.4  | **[前端]** 重构文件夹列表使用批量查询      | 前端 | `src/components/folder/folder-list.tsx`          | 集成批量  |
| 7.5  | **[前端]** 移除单个 lock 请求调用          | 前端 | `src/components/folder/`                         | 代码清理  |

**前端改动详情**：

```typescript
// 新增 src/hooks/use-folder-lock-status.ts

export function useFolderLockStatus(folderIds: number[]) {
  const [lockStatus, setLockStatus] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (folderIds.length === 0) return;

    const fetchLockStatus = async () => {
      const res = await fetch('/api/folders/batch-lock-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderIds }),
      });
      const data = await res.json();
      setLockStatus(data);
      setIsLoading(false);
    };

    fetchLockStatus();
  }, [folderIds.join(',')]);  // 依赖 ID 列表

  return { lockStatus, isLoading };
}

// 使用示例
function FolderList({ folders }) {
  const folderIds = folders.map(f => f.id);
  const { lockStatus, isLoading } = useFolderLockStatus(folderIds);

  return folders.map(folder => (
    <FolderItem
      key={folder.id}
      folder={folder}
      isLocked={lockStatus[folder.id] || false}
    />
  ));
}
```

---

#### Day 8 (Week2 D3)：401 问题修复

| 序号 | 任务                                      | 类型 | 涉及文件                                                          | 产出     |
| ---- | ----------------------------------------- | ---- | ----------------------------------------------------------------- | -------- |
| 8.1  | 后端添加认证失败日志                      | 后端 | `src/app/api/classification/confirmations/route.ts`               | 日志增强 |
| 8.2  | 检查 middleware 认证时序                  | 后端 | `src/middleware.ts`                                               | 问题定位 |
| 8.3  | **[前端]** 创建 `fetchWithRetry` 工具函数 | 前端 | `src/lib/utils/fetch-with-retry.ts`                               | 重试工具 |
| 8.4  | **[前端]** 集成到 `fetchConfirmations`    | 前端 | `src/components/classification/pending-confirmations-section.tsx` | 重试集成 |

**前端改动详情**：

```typescript
// 新增 src/lib/utils/fetch-with-retry.ts

interface FetchWithRetryOptions extends RequestInit {
  retryOn?: number[]; // 重试的状态码，默认 [401]
  maxRetries?: number; // 最大重试次数，默认 1
  retryDelay?: number; // 重试延迟 ms，默认 500
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    retryOn = [401],
    maxRetries = 1,
    retryDelay = 500,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      if (!retryOn.includes(response.status) || attempt === maxRetries) {
        return response;
      }

      // 需要重试
      console.warn(
        `[fetchWithRetry] ${response.status} on ${url}, retrying...`,
      );
      await new Promise((r) => setTimeout(r, retryDelay));
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries) throw lastError;
      await new Promise((r) => setTimeout(r, retryDelay));
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

// 使用示例
const fetchConfirmations = async () => {
  const res = await fetchWithRetry("/api/classification/confirmations");
  return res.json();
};
```

---

#### Day 9 (Week2 D4)：全量回归测试

| 序号 | 任务                 | 类型 | 涉及文件 | 产出     |
| ---- | -------------------- | ---- | -------- | -------- |
| 9.1  | 功能回归：书签 CRUD  | 测试 | -        | 测试通过 |
| 9.2  | 功能回归：文件夹操作 | 测试 | -        | 测试通过 |
| 9.3  | 功能回归：分类确认   | 测试 | -        | 测试通过 |
| 9.4  | 功能回归：搜索筛选   | 测试 | -        | 测试通过 |
| 9.5  | 性能回归：对比基线   | 测试 | -        | 性能报告 |
| 9.6  | TypeScript 类型检查  | 测试 | -        | 无错误   |
| 9.7  | 修复发现的问题       | 修复 | -        | Bug 修复 |

---

#### Day 10 (Week2 D5)：监控与文档

| 序号 | 任务                            | 类型 | 涉及文件               | 产出      |
| ---- | ------------------------------- | ---- | ---------------------- | --------- |
| 10.1 | **[前端]** 添加 Web Vitals 监控 | 前端 | `src/app/layout.tsx`   | 性能监控  |
| 10.2 | **[前端]** 添加 API 耗时上报    | 前端 | `src/lib/utils/`       | 埋点上报  |
| 10.3 | 创建性能监控仪表盘              | 后端 | `src/app/api/metrics/` | 指标 API  |
| 10.4 | 更新技术文档                    | 文档 | `docs/`                | 文档更新  |
| 10.5 | 更新 CLAUDE.md                  | 文档 | `CLAUDE.md`            | AI 上下文 |
| 10.6 | 代码审查与合并                  | 代码 | -                      | PR 合并   |

---

### 前后端任务汇总

#### 后端任务 (共 25 项)

| 日期 | 任务数 | 关键任务            |
| ---- | ------ | ------------------- |
| D0.5 | 4      | 性能监控工具        |
| D1   | 4      | N+1 查询修复        |
| D1.5 | 4      | Inbox 缓存层        |
| D2   | 4      | API 游标分页        |
| D3   | 3      | 字段精简 + 详情 API |
| D4   | 4      | 聚类优化 + 并行化   |
| D6   | 3      | Folders 优化        |
| D7   | 2      | 批量锁 API          |
| D8   | 2      | 401 日志            |

#### 前端任务 (共 15 项)

| 日期 | 任务数 | 关键任务            |
| ---- | ------ | ------------------- |
| D1.5 | 2      | 刷新按钮 + 缓存指示 |
| D2   | 2      | SWR Hook 适配       |
| D3   | 4      | 虚拟滚动 + 类型更新 |
| D6   | 2      | useFoldersSWR       |
| D7   | 3      | 批量锁 Hook + 集成  |
| D8   | 2      | 重试工具 + 集成     |
| D10  | 2      | Web Vitals + 埋点   |

---

## 五、预期收益

| 指标                        | 优化前   | 优化后 | 提升      |
| --------------------------- | -------- | ------ | --------- |
| `/api/classification/inbox` | 11-22s   | <3s    | **86%**   |
| `/api/bookmarks` 数据量     | 14,356KB | ~50KB  | **99.6%** |
| `/api/bookmarks` 响应时间   | 15,108ms | <500ms | **96.7%** |
| 首页 FCP                    | 8.5s     | <3s    | **65%**   |
| 待整理页加载                | 14s      | <3s    | **78%**   |
| 收藏夹页请求数              | 8次      | 1次    | **87%**   |
| API 成功率                  | 92%      | 100%   | **8%**    |

---

## 六、风险与回退方案

| 风险                       | 概率 | 影响 | 缓解措施                             |
| -------------------------- | ---- | ---- | ------------------------------------ |
| N+1 修复后内存匹配精度下降 | 低   | 中   | 阈值可调，保留原方法作为回退         |
| 缓存导致数据不一致         | 中   | 低   | 短 TTL (5min) + hash 校验 + 手动刷新 |
| 分页导致无限滚动体验问题   | 中   | 低   | 预加载下一页，平滑过渡               |
| 游标分页排序稳定性         | 低   | 中   | 使用 `created_at + id` 复合排序      |
| 批量 API 单点故障          | 低   | 中   | 降级回退到单个请求                   |

**回退策略**：

- 所有修改通过 feature flag 控制
- 保留原代码路径，可随时切换
- 分阶段灰度发布

---

## 七、验收标准

### 7.1 功能验收

- [ ] 所有现有功能正常工作
- [ ] 无新增 TypeScript 错误
- [ ] 单元测试通过率 100%
- [ ] E2E 测试通过

### 7.2 性能验收

- [ ] `/api/classification/inbox` 响应 < 3s (首次) / < 100ms (缓存)
- [ ] `/api/bookmarks` 首屏数据 < 100KB
- [ ] `/api/bookmarks` 首屏响应 < 1s
- [ ] `/api/folders` 响应 < 2s
- [ ] Folders 页网络请求数 ≤ 3
- [ ] API 成功率 100%

### 7.3 监控验收

- [ ] 关键 API 性能埋点已部署
- [ ] 性能基线数据已记录
- [ ] 异常告警已配置

---

## 八、附录

### A. 诊断脚本位置

- `scripts/diagnose-inbox-performance.ts`

### B. 性能监控工具实现

#### B.1 后端性能监控工具

```typescript
// src/lib/utils/performance-monitor.ts

interface PerformanceEntry {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface PerformanceReport {
  totalDuration: number;
  entries: PerformanceEntry[];
  slowEntries: PerformanceEntry[]; // > 1s
}

export class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private startTime: number;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.startTime = performance.now();
  }

  // 记录阶段耗时
  mark(stageName: string, metadata?: Record<string, unknown>): void {
    const now = performance.now();
    const duration = now - this.startTime;

    this.entries.push({
      name: stageName,
      duration,
      timestamp: now,
      metadata,
    });

    // 开发环境输出日志
    if (process.env.NODE_ENV === "development") {
      console.log(`[${this.name}] ${stageName}: ${duration.toFixed(2)}ms`);
    }
  }

  // 记录单个操作的耗时
  async measure<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - start;

      this.entries.push({
        name: operationName,
        duration,
        timestamp: performance.now(),
        metadata: { ...metadata, success: true },
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      this.entries.push({
        name: operationName,
        duration,
        timestamp: performance.now(),
        metadata: { ...metadata, success: false, error: String(error) },
      });

      throw error;
    }
  }

  // 生成报告
  getReport(): PerformanceReport {
    const totalDuration = performance.now() - this.startTime;
    const slowEntries = this.entries.filter((e) => e.duration > 1000);

    return {
      totalDuration,
      entries: this.entries,
      slowEntries,
    };
  }

  // 输出报告到控制台
  logReport(): void {
    const report = this.getReport();

    console.log(`\n[${this.name}] Performance Report:`);
    console.log(`  Total Duration: ${report.totalDuration.toFixed(2)}ms`);
    console.log(`  Stages: ${report.entries.length}`);

    if (report.slowEntries.length > 0) {
      console.warn(`  ⚠️ Slow operations (>1s):`);
      report.slowEntries.forEach((e) => {
        console.warn(`    - ${e.name}: ${e.duration.toFixed(2)}ms`);
      });
    }
  }
}

// 使用示例
// const monitor = new PerformanceMonitor("InboxAnalysis");
// monitor.mark("Start");
// await monitor.measure("FetchProfiles", () => fetchProfiles());
// monitor.mark("ProfilesFetched");
// await monitor.measure("Clustering", () => clusterBookmarks());
// monitor.logReport();
```

#### B.2 前端 Web Vitals 监控

```typescript
// src/lib/utils/web-vitals-reporter.ts

import { onCLS, onFCP, onFID, onLCP, onTTFB, type Metric } from "web-vitals";

interface VitalMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
}

// 上报函数
async function reportVital(metric: VitalMetric): Promise<void> {
  // 开发环境：输出到控制台
  if (process.env.NODE_ENV === "development") {
    const color =
      metric.rating === "good"
        ? "color: green"
        : metric.rating === "needs-improvement"
          ? "color: orange"
          : "color: red";

    console.log(
      `%c[WebVitals] ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
      color,
    );
    return;
  }

  // 生产环境：上报到后端
  try {
    await fetch("/api/metrics/web-vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...metric,
        url: window.location.pathname,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }),
      // 使用 keepalive 确保页面卸载时也能发送
      keepalive: true,
    });
  } catch {
    // 静默失败，不影响用户体验
  }
}

// 转换 web-vitals 的 Metric 到我们的格式
function formatMetric(metric: Metric): VitalMetric {
  return {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
  };
}

// 初始化 Web Vitals 监控
export function initWebVitals(): void {
  onCLS((metric) => reportVital(formatMetric(metric)));
  onFCP((metric) => reportVital(formatMetric(metric)));
  onFID((metric) => reportVital(formatMetric(metric)));
  onLCP((metric) => reportVital(formatMetric(metric)));
  onTTFB((metric) => reportVital(formatMetric(metric)));
}

// 在 app/layout.tsx 中使用
// useEffect(() => { initWebVitals(); }, []);
```

#### B.3 API 耗时监控 Hook

```typescript
// src/hooks/use-api-timing.ts

import { useCallback, useRef } from "react";

interface ApiTiming {
  url: string;
  method: string;
  duration: number;
  status: number;
  size?: number;
}

export function useApiTiming() {
  const timings = useRef<ApiTiming[]>([]);

  const trackFetch = useCallback(
    async <T>(
      url: string,
      options?: RequestInit,
    ): Promise<{ data: T; timing: ApiTiming }> => {
      const start = performance.now();
      const method = options?.method || "GET";

      try {
        const response = await fetch(url, options);
        const duration = performance.now() - start;

        // 获取响应大小
        const contentLength = response.headers.get("content-length");
        const size = contentLength ? parseInt(contentLength, 10) : undefined;

        const timing: ApiTiming = {
          url,
          method,
          duration,
          status: response.status,
          size,
        };

        timings.current.push(timing);

        // 慢请求警告 (>3s)
        if (duration > 3000) {
          console.warn(`[API Slow] ${method} ${url}: ${duration.toFixed(0)}ms`);
        }

        const data = await response.json();
        return { data, timing };
      } catch (error) {
        const duration = performance.now() - start;

        const timing: ApiTiming = {
          url,
          method,
          duration,
          status: 0, // 网络错误
        };

        timings.current.push(timing);
        throw error;
      }
    },
    [],
  );

  const getTimings = useCallback(() => {
    return [...timings.current];
  }, []);

  const getSlowRequests = useCallback((threshold = 3000) => {
    return timings.current.filter((t) => t.duration > threshold);
  }, []);

  return { trackFetch, getTimings, getSlowRequests };
}
```

#### B.4 后端 API 指标收集端点

```typescript
// src/app/api/metrics/web-vitals/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const metric = await request.json();

    // 验证数据
    if (!metric.name || typeof metric.value !== "number") {
      return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
    }

    // 这里可以：
    // 1. 写入数据库
    // 2. 发送到 Analytics 服务 (Google Analytics, Mixpanel)
    // 3. 发送到 APM 服务 (Datadog, New Relic)
    // 4. 写入日志文件

    // 示例：写入 Supabase
    // await supabase.from("web_vitals").insert({
    //   metric_name: metric.name,
    //   metric_value: metric.value,
    //   metric_rating: metric.rating,
    //   url: metric.url,
    //   user_agent: metric.userAgent,
    //   created_at: metric.timestamp,
    // });

    // 开发环境日志
    if (process.env.NODE_ENV === "development") {
      console.log("[WebVitals API]", metric);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to record metric" },
      { status: 500 },
    );
  }
}
```

### C. 根因分析详细文档

- `docs/performance/root-cause-analysis-plan.md`

### D. 性能阈值参考

| 指标 | Good   | Needs Improvement | Poor   |
| ---- | ------ | ----------------- | ------ |
| LCP  | ≤2.5s  | 2.5s - 4s         | >4s    |
| FID  | ≤100ms | 100ms - 300ms     | >300ms |
| CLS  | ≤0.1   | 0.1 - 0.25        | >0.25  |
| FCP  | ≤1.8s  | 1.8s - 3s         | >3s    |
| TTFB | ≤800ms | 800ms - 1.8s      | >1.8s  |

### E. 补充优化清单

基于代码审查发现的补充优化点：

| 序号 | 优化项                         | 优先级 | 状态          |
| ---- | ------------------------------ | ------ | ------------- |
| E.1  | 缓存架构选型 (Serverless 兼容) | P0     | ✅ 已添加方案 |
| E.2  | HTTP 响应压缩                  | P1     | ✅ 已添加配置 |
| E.3  | Total Count 优化策略           | P1     | ✅ 已添加方案 |
| E.4  | 前端智能预取策略               | P1     | ✅ 已添加代码 |
| E.5  | 数据库索引补充                 | P1     | ✅ 已添加索引 |
| E.6  | 全局错误边界                   | P2     | ✅ 已添加组件 |
| E.7  | 性能监控实现                   | P2     | ✅ 已添加代码 |

---

**计划制定人**: Claude Code (Architect Mode)
**计划日期**: 2025-12-12
**预计工时**: 8-10 人天
**诊断数据来源**: 实测诊断脚本 (2025-12-12)
