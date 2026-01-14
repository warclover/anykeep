# 首页性能优化方案

**版本**: 1.0.0
**日期**: 2026-01-13
**状态**: 待审核

---

## 一、问题诊断总结

### 1.1 性能数据

| 指标 | 当前值 | 目标值 | 差距 |
|------|--------|--------|------|
| DOMContentLoaded | **24.14 秒** | < 3 秒 | 8x |
| 完成时间 | **54.13 秒** | < 5 秒 | 10x |
| API 请求数 | 53 次 | < 15 次 | 3.5x |

### 1.2 根因分析

```
┌─────────────────────────────────────────────────────────────────────┐
│                        首页加载瀑布图分析                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔴 P0 - recommend API 极慢 (17-26秒)                               │
│  ├── 原因: 串行数据库查询 (文件夹循环 + 标签聚合)                      │
│  └── 来源: use-synthesis-recommend.ts → /api/synthesis/recommend    │
│                                                                     │
│  🔴 P0 - confirmations 重复请求 (4次, 共 35秒)                       │
│  ├── 原因: 两套独立的 useConfirmations Hook                          │
│  │   ├── src/hooks/ui/use-confirmations.ts (无缓存)                 │
│  │   └── src/components/classification/pending-confirmations/       │
│  │       hooks/useConfirmations.ts (无缓存, 还独立请求 folders)      │
│  └── 影响: 8.75s + 9.17s + 8.77s + 8.62s = 35.31s                   │
│                                                                     │
│  🟡 P1 - folders 重复请求 (3次, 共 26秒)                             │
│  ├── 原因: pending-confirmations 的 useConfirmations 独立请求        │
│  │         绕过了 useFolders SWR 缓存                                │
│  └── 影响: 8.69s + 8.92s + 8.62s = 26.23s                           │
│                                                                     │
│  🟡 P1 - Brain-Sync queue 慢 (11.62秒)                              │
│  ├── 原因: sidebar-reminder 组件首次加载时请求                        │
│  └── 建议: 懒加载 + 缓存                                             │
│                                                                     │
│  🟢 P2 - bookmarks 查询慢 (9.78秒)                                  │
│  └── 原因: 数据量大 (55.6kB), 需考虑分页优化                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、优化方案

### 2.1 P0-1: recommend API 后端优化

**问题代码**: [route.ts](src/app/api/synthesis/recommend/route.ts)

**当前问题**:
```typescript
// 问题: 串行执行 N+1 查询
for (const folder of folders) {
  // 每个文件夹独立查询书签数量 → N 次查询
  const { data: folderBookmarks, count } = await supabase
    .from("bookmarks")
    .select("id, title", { count: "exact" })
    .eq("folder_id", folder.id);
}

// 问题: 全表扫描标签
const { data: tagStats } = await supabase
  .from("bookmarks")
  .select("id, title, ai_tags")
  .not("ai_tags", "is", null);  // 返回所有有标签的书签
```

**优化方案**:

#### 方案 A: 数据库优化 (推荐)

```sql
-- 1. 创建文件夹书签统计物化视图 (每小时刷新)
CREATE MATERIALIZED VIEW folder_bookmark_stats AS
SELECT
  folder_id,
  COUNT(*) as bookmark_count,
  array_agg(id ORDER BY created_at DESC) FILTER (WHERE row_num <= 3) as sample_ids
FROM (
  SELECT id, folder_id, created_at,
         ROW_NUMBER() OVER (PARTITION BY folder_id ORDER BY created_at DESC) as row_num
  FROM bookmarks
  WHERE deleted_at IS NULL
) sub
GROUP BY folder_id;

-- 2. 创建标签频率统计物化视图
CREATE MATERIALIZED VIEW tag_frequency_stats AS
SELECT
  user_id,
  tag,
  COUNT(*) as count,
  array_agg(bookmark_id ORDER BY created_at DESC) FILTER (WHERE row_num <= 3) as sample_ids
FROM (
  SELECT
    b.user_id,
    b.id as bookmark_id,
    b.created_at,
    unnest(b.ai_tags) as tag,
    ROW_NUMBER() OVER (PARTITION BY unnest(b.ai_tags) ORDER BY b.created_at DESC) as row_num
  FROM bookmarks b
  WHERE b.ai_tags IS NOT NULL AND array_length(b.ai_tags, 1) > 0
) sub
GROUP BY user_id, tag;

-- 3. 创建索引
CREATE INDEX idx_folder_bookmark_stats_folder ON folder_bookmark_stats(folder_id);
CREATE INDEX idx_tag_frequency_user_tag ON tag_frequency_stats(user_id, count DESC);
```

**优化后代码**:
```typescript
// 单次查询获取所有文件夹统计
const { data: folderStats } = await supabase
  .from("folder_bookmark_stats")
  .select("folder_id, bookmark_count, sample_ids")
  .in("folder_id", folders.map(f => f.id));

// 单次查询获取标签统计
const { data: tagStats } = await supabase
  .from("tag_frequency_stats")
  .select("tag, count, sample_ids")
  .eq("user_id", user.id)
  .gte("count", MIN_BOOKMARKS_COUNT)
  .order("count", { ascending: false })
  .limit(5);
```

**预期效果**: 17-26秒 → **< 500ms** (查询优化 30-50x)

---

#### 方案 B: API 拆分 + 懒加载 (兜底)

如果物化视图维护成本高，可采用 API 拆分:

```typescript
// 拆分为 3 个轻量 API
GET /api/synthesis/recommend/folders    // 文件夹推荐 (轻量)
GET /api/synthesis/recommend/tags       // 标签推荐 (轻量)
GET /api/synthesis/recommend/recent     // 近期推荐 (轻量)

// 前端并行请求 + 渐进式渲染
const [folders, tags, recent] = await Promise.all([
  fetch('/api/synthesis/recommend/folders'),
  fetch('/api/synthesis/recommend/tags'),
  fetch('/api/synthesis/recommend/recent'),
]);
```

---

### 2.2 P0-2: recommend 前端优化 - 延迟加载

**问题代码**: [home-page-client.tsx:383-432](src/components/home/home-page-client.tsx#L383-L432)

**当前实现**:
```typescript
// 已有延迟加载，但 refreshSynthesisRecommend 仍在 idle callback 中执行
useEffect(() => {
  const scheduleAILoad = () => {
    requestIdleCallback(() => {
      setDeferredAIReady(true);
      refreshSynthesisRecommend(); // 问题: 即使延迟也会阻塞
    }, { timeout: 3000 });
  };
  scheduleAILoad();
}, [refreshSynthesisRecommend]);
```

**优化方案**:

```typescript
// 1. 更激进的延迟策略: 等用户交互后再加载
const [shouldLoadRecommend, setShouldLoadRecommend] = useState(false);

// 方案 A: 滚动触发
useEffect(() => {
  const handleScroll = () => {
    if (window.scrollY > 100 && !shouldLoadRecommend) {
      setShouldLoadRecommend(true);
    }
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, [shouldLoadRecommend]);

// 方案 B: 10秒后自动加载 (作为兜底)
useEffect(() => {
  const timer = setTimeout(() => {
    setShouldLoadRecommend(true);
  }, 10000); // 10秒后
  return () => clearTimeout(timer);
}, []);

// 2. 条件触发请求
useEffect(() => {
  if (shouldLoadRecommend) {
    refreshSynthesisRecommend();
  }
}, [shouldLoadRecommend, refreshSynthesisRecommend]);
```

**预期效果**: 首屏不请求 recommend API，DOMContentLoaded 减少 17-26 秒

---

### 2.3 P0-3: 统一 confirmations 缓存

**问题**: 存在两套独立的 `useConfirmations` Hook

| 文件 | 缓存 | 请求 |
|------|------|------|
| `src/hooks/ui/use-confirmations.ts` | ❌ 无 | 独立 fetch |
| `src/components/classification/pending-confirmations/hooks/useConfirmations.ts` | ❌ 无 | 独立 fetch + 独立 folders 请求 |

**优化方案**:

#### Step 1: 创建统一的 SWR Hook

```typescript
// src/hooks/data/use-confirmations-swr.ts
import useSWR from "swr";

const SWR_KEY = "/api/confirmations?status=pending";
const DEDUPING_INTERVAL = 60000; // 1 分钟

async function confirmationsFetcher(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("获取确认消息失败");
  const data = await response.json();
  return data.data?.confirmations || [];
}

export function useConfirmationsSWR() {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    SWR_KEY,
    confirmationsFetcher,
    {
      dedupingInterval: DEDUPING_INTERVAL,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
    }
  );

  return {
    confirmations: data || [],
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}
```

#### Step 2: 迁移 pending-confirmations 使用统一缓存

```typescript
// src/components/classification/pending-confirmations/hooks/useConfirmations.ts
import { useConfirmationsSWR } from "@/hooks/data/use-confirmations-swr";
import { useFolders } from "@/hooks/data"; // 复用已有的 SWR 缓存

export function useConfirmations(): UseConfirmationsReturn {
  // 使用统一缓存
  const { confirmations: rawData, isLoading, refresh } = useConfirmationsSWR();
  const { folders } = useFolders(); // 复用 useFolders 缓存

  // ... 转换和操作逻辑
}
```

**预期效果**:
- confirmations: 4 次 → 1 次
- folders: 3 次 → 1 次 (已有 SWR 缓存)
- 节省: ~35 秒 (confirmations) + ~17 秒 (folders) = **~52 秒**

---

### 2.4 P1-1: Brain-Sync queue 优化

**问题代码**: [sidebar-reminder.tsx:186](src/components/brain-sync/sidebar-reminder.tsx#L186)

**当前问题**:
```typescript
// 首次加载时同步请求，阻塞渲染
useEffect(() => {
  loadStats(); // 立即执行，包含 queue 请求
}, [loadStats]);
```

**优化方案**:

```typescript
// 1. 添加 SWR 缓存
import useSWR from "swr";

const QUEUE_SWR_KEY = "/api/brain-sync/queue?limit=100";
const QUEUE_CACHE_TIME = 5 * 60 * 1000; // 5 分钟

export function useBrainSyncStats() {
  const { data, isLoading } = useSWR(
    QUEUE_SWR_KEY,
    async (url) => {
      const res = await fetch(url);
      const data = await res.json();
      return data.data?.stats;
    },
    {
      dedupingInterval: QUEUE_CACHE_TIME,
      revalidateOnFocus: false,
    }
  );

  return { stats: data, isLoading };
}

// 2. SidebarReminder 使用缓存
export function SidebarReminder() {
  const { stats, isLoading } = useBrainSyncStats();
  // ...
}
```

**预期效果**: 11.62 秒 → **< 500ms** (缓存命中) 或首屏不请求

---

### 2.5 P1-2: 首页数据聚合 API 增强

**现状**: 已有 `useInitData` 聚合 API，但未包含 confirmations/folders

**优化方案**: 扩展聚合 API

```typescript
// GET /api/init-data
// 当前返回: bookmarks, folders, platforms, etc.
// 扩展返回: + confirmations + brainSyncStats

interface InitDataResponse {
  bookmarks: Bookmark[];
  folders: Folder[];
  platforms: Platform[];
  // 新增
  confirmations: Confirmation[];
  brainSyncStats: { total: number; overdue: number; dueToday: number };
}
```

**预期效果**: 多个独立请求合并为 1 个，减少 RTT 和认证开销

---

## 三、实施计划

### Phase 1: 快速见效 (1-2 天)

| 任务 | 优先级 | 预期收益 | 工作量 |
|------|--------|----------|--------|
| 2.2 recommend 延迟加载 | P0 | -17~26秒 | 0.5 天 |
| 2.3 统一 confirmations SWR | P0 | -35秒 | 1 天 |

### Phase 2: 根本解决 (3-5 天)

| 任务 | 优先级 | 预期收益 | 工作量 |
|------|--------|----------|--------|
| 2.1 recommend API 数据库优化 | P0 | 17-26秒→<0.5秒 | 2 天 |
| 2.4 Brain-Sync SWR 缓存 | P1 | -11秒 | 1 天 |
| 2.5 聚合 API 增强 | P1 | 减少请求数 | 1 天 |

### Phase 3: 持续优化 (后续)

| 任务 | 优先级 | 说明 |
|------|--------|------|
| bookmarks 分页优化 | P2 | 首屏只加载 10 条 |
| Prefetch 预加载 | P2 | 侧边栏 hover 时预加载 |
| Service Worker 缓存 | P3 | 离线支持 + 缓存优先 |

---

## 四、预期效果

| 指标 | 当前 | Phase 1 后 | Phase 2 后 |
|------|------|------------|------------|
| DOMContentLoaded | 24.14s | ~8s | **< 3s** |
| 完成时间 | 54.13s | ~15s | **< 5s** |
| API 请求数 | 53 | ~30 | **< 15** |

---

## 五、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 物化视图维护成本 | 中 | 定时刷新 (每小时) + 降级方案 B |
| SWR 缓存一致性 | 低 | 操作后主动 mutate |
| 延迟加载影响体验 | 低 | 渐进式加载 + 骨架屏 |

---

## 六、验收标准

1. **DOMContentLoaded < 3 秒** (Core Web Vitals LCP 达标)
2. **首屏 API 请求 < 10 个**
3. **无重复 API 调用** (同一数据只请求一次)
4. **所有现有测试通过**

---

**审核人**: _________________
**审核日期**: _________________
**审核意见**:

- [ ] 通过
- [ ] 需修改 (意见: _________________)
