# AnyKeep 性能优化计划 V2

> 诊断时间：2025-12-16
> 诊断工具：Playwright + Web Vitals + 服务器日志分析
> **重要更新**：根据服务器日志分析，发现真正的瓶颈在于网络和认证层

---

## 〇、关键发现（重要！）

### 之前的诊断误区

之前的优化方向（移除 `force-dynamic`、替换 `unstable_noStore`）**效果有限且可能破坏功能**，因为：

1. 这些配置是为了确保数据实时性而刻意设置的
2. 真正的瓶颈不在 Next.js 缓存层

### 真正的性能瓶颈

通过服务器日志分析发现：

| 瓶颈              | 耗时       | 说明                      |
| ----------------- | ---------- | ------------------------- |
| **Supabase Auth** | 1-1.5秒/次 | 每个 API 请求都要认证     |
| **网络延迟**      | 500ms-2秒  | Supabase 服务器可能在国外 |
| **并发请求**      | 7+ 个      | 首页同时发起多个 API 请求 |
| **Inbox 分析**    | 10秒+      | 复杂计算导致超时          |

### 日志证据

```log
[BookmarksQuery] Slow operation: CachedAuth took 1141.90ms
[FoldersQuery] Slow operation: CachedAuth took 1508.76ms
GET /api/smart-lists?includePresets=true 200 in 6563ms
GET /api/classification/inbox 500 in 10277ms (超时)
[ConnectTimeoutError: Connect Timeout Error]
```

---

## 一、性能测试结果

### 1.1 Web Vitals 指标

| 页面                      | TTFB      | FCP           | LCP            | FID    | 状态 |
| ------------------------- | --------- | ------------- | -------------- | ------ | ---- |
| 首页 `/`                  | 2320ms ❌ | 612ms ✅      | -              | -      | 严重 |
| 首页 Time to First Render | -         | -             | **11235ms** ❌ | -      | 严重 |
| 详情页 `/bookmark/[id]`   | 458ms ✅  | -             | **14476ms** ❌ | 2ms ✅ | 严重 |
| 文件夹页 `/folders`       | -         | **5112ms** ❌ | **11428ms** ❌ | -      | 严重 |
| 搜索页 `/search`          | -         | **3848ms** ❌ | -              | -      | 严重 |

### 1.2 目标指标（Good 等级）

| 指标                 | 当前值      | 目标值   | 优化幅度 |
| -------------------- | ----------- | -------- | -------- |
| TTFB                 | 2320ms      | < 800ms  | -65%     |
| FCP                  | 3848-5112ms | < 1800ms | -60%     |
| LCP                  | 11-14s      | < 2500ms | -80%     |
| Time to First Render | 11235ms     | < 3000ms | -73%     |

---

## 二、根本原因分析

### 2.1 🚨 致命问题：缓存被全局禁用

**问题代码位置：**

```
src/app/layout.tsx:8          → export const dynamic = "force-dynamic"
src/app/(main)/layout.tsx:13  → export const dynamic = "force-dynamic"
src/app/(main)/home/page.tsx:111 → unstable_noStore()
src/app/(main)/inbox/page.tsx:119 → unstable_noStore()
+ 其他 15+ 页面使用 force-dynamic
```

**影响：**

- Next.js 的所有 SSR 缓存被禁用
- 每次请求都执行完整的服务端渲染
- 数据库查询无法被缓存
- TTFB 严重恶化

### 2.2 SSR 数据获取瀑布流

**问题代码示例（home/page.tsx）：**

```typescript
export default async function HomePage({ searchParams }) {
  unstable_noStore(); // ← 禁用缓存

  const params = await searchParams; // ← 等待参数
  const { bookmarks, error } = await getInitialBookmarks(...); // ← 串行获取

  return <HomePageClient initialBookmarks={bookmarks} />;
}
```

**影响：**

- 每个请求都要重新验证用户
- 数据库查询串行执行
- 无法利用 React 18 并行数据获取

### 2.3 客户端组件过重

**home-page-client.tsx：1763 行代码**

- 30+ 个 import
- 15+ 个 useState
- 10+ 个 useEffect
- 大量事件监听器

**影响：**

- JavaScript 解析时间长
- 首屏水合（Hydration）耗时
- 内存占用高

### 2.4 侧边栏阻塞渲染

**SmartListSection 组件：**

- 在客户端获取智能列表数据
- 首次访问时自动初始化预设
- 使用 DnD 拖拽库（@dnd-kit）

**useUnreadCount Hook：**

- 每次页面切换都获取未读消息数

### 2.5 布局组件问题

**layout.tsx 使用 force-dynamic：**

- 根布局标记为动态会影响所有子页面
- 即使子页面是静态的，也会被迫动态渲染

---

## 三、优化方案

### Phase 1：认证优化（预期提升 60%+）⭐ 核心优化

> **为什么这是核心？** 服务器日志显示每个 API 请求的认证耗时 1-1.5 秒。首页有 7+ 个并发 API 请求，认证就耗费 7-10 秒。

#### P1-1：实现 Session Token 传递机制

**优先级：🔴 紧急 | 风险：🟢 低**

**问题**：每个 API 路由独立调用 `supabase.auth.getUser()`，导致重复网络请求。

**方案**：客户端传递已验证的 Session Token，API 路由直接使用。

```typescript
// === 客户端：统一请求封装 ===
// src/lib/api/fetch-with-auth.ts
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${session?.access_token}`,
    },
  });
}

// === 服务端：统一认证中间件 ===
// src/lib/api/auth-middleware.ts
export async function withAuth(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return { user: null, error: "No token" };
  }

  // 使用 token 直接获取用户，避免 cookie 解析
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  return { user, error };
}
```

**收益**：

- 客户端只需获取一次 session
- API 路由直接验证 token（~50ms vs 1000ms）
- 减少 Supabase Auth 服务压力

#### P1-2：API 聚合（BFF 模式）

**优先级：🔴 紧急 | 风险：🟢 低**

**问题**：首页同时发起 7+ 个 API 请求：

- `/api/bookmarks` - 书签列表
- `/api/smart-lists` - 智能列表
- `/api/messages/unread-count` - 未读消息
- `/api/folders` - 文件夹
- `/api/classification/inbox` - 待整理分析
- 等等...

**方案**：创建聚合端点 `/api/init`，一次请求返回所有初始数据。

```typescript
// src/app/api/init/route.ts
export async function GET(request: NextRequest) {
  const { user, error } = await withAuth(request);
  if (error || !user) return unauthorized();

  // 单次认证后并行获取所有数据
  const [bookmarks, smartLists, unreadCount, folders] = await Promise.all([
    getBookmarks(user.id),
    getSmartLists(user.id),
    getUnreadCount(user.id),
    getFolders(user.id),
  ]);

  return Response.json({
    bookmarks,
    smartLists,
    unreadCount,
    folders,
  });
}
```

**收益**：

- 7 次认证 → 1 次认证（节省 6-9 秒）
- 7 次网络往返 → 1 次（减少网络延迟叠加）
- 服务端并行查询数据库

#### P1-3：延迟非关键数据加载

**优先级：🟡 重要 | 风险：🟢 低**

**问题**：侧边栏的智能列表、未读消息在首屏不是必需的。

**方案**：

1. 首屏只加载核心数据（书签列表）
2. 其他数据在空闲时加载

```typescript
// 侧边栏组件
function SmartListSection() {
  // 延迟 1 秒后才开始获取
  const [shouldFetch, setShouldFetch] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShouldFetch(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const { smartLists } = useSmartLists({ enabled: shouldFetch });

  // 或使用 requestIdleCallback
  useEffect(() => {
    requestIdleCallback(() => setShouldFetch(true), { timeout: 2000 });
  }, []);
}
```

**收益**：

- 首屏渲染时间减少 2-3 秒
- 用户感知的页面加载更快
- 核心功能优先可用

#### P1-4：Middleware 预验证

**优先级：🟡 重要 | 风险：🟡 中**

**问题**：Middleware 已经验证过 session，但 API 路由又重新验证。

**方案**：Middleware 将验证结果注入请求头。

````typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  const { user } = await verifySession(request);

  if (user) {
    // 注入已验证的用户信息到请求头
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-user-verified', 'true');

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }
}

// API 路由中快速获取
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const isVerified = request.headers.get('x-user-verified') === 'true';

  if (!isVerified || !userId) {
    // 回退到完整认证
    const { user } = await getCachedUser();
    // ...
  }

  // 直接使用 userId，跳过认证
  const bookmarks = await getBookmarksByUserId(userId);
}

### Phase 2：网络优化（预期提升 30%+）

#### P2-1：优化 Supabase 连接配置

**优先级：🟡 重要 | 风险：🟢 低**

**问题**：每次请求都创建新的 Supabase 客户端实例。

**方案**：配置连接复用和超时。

```typescript
// src/lib/supabase/server.ts
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { /* ... */ },
      // 添加全局配置
      global: {
        fetch: (url, options) => fetch(url, {
          ...options,
          // 复用 TCP 连接
          keepalive: true,
          // 设置超时
          signal: AbortSignal.timeout(5000),
        }),
      },
      auth: {
        // 禁用自动刷新（由 middleware 处理）
        autoRefreshToken: false,
        // 减少不必要的存储操作
        persistSession: false,
      },
    },
  );
}
````

#### P2-2：SWR 请求去重优化

**优先级：🟡 重要 | 风险：🟢 低**

**问题**：页面切换时 SWR 可能发起重复请求。

**方案**：增加去重间隔和缓存时间。

```typescript
// src/hooks/use-smart-lists.ts
const { data, error, isLoading, mutate } = useSWR<SmartListClient[]>(
  url,
  fetcher,
  {
    // 5 分钟内使用缓存数据，不重新请求
    dedupingInterval: 300000,
    // 聚焦时不自动刷新（用户主动刷新）
    revalidateOnFocus: false,
    // 网络恢复时不自动刷新
    revalidateOnReconnect: false,
    // 使用过期数据先展示，后台刷新
    keepPreviousData: true,
  },
);
```

#### P2-3：HTTP/2 Server Push（如适用）

**优先级：🟢 建议 | 风险：🟢 低**

如果部署在支持 HTTP/2 的平台（如 Vercel），可以利用 Server Push：

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: "/(main)/:path*",
        headers: [
          {
            key: "Link",
            // 预加载关键 API
            value: "</api/init>; rel=preload; as=fetch; crossorigin",
          },
        ],
      },
    ];
  },
};
```

### Phase 3：客户端优化（预期提升 20%+）

#### P3-1：拆分 home-page-client.tsx

**优先级：🟢 建议 | 风险：🟡 中**

**当前状态：** 1763 行单文件

**建议拆分：**

```
src/components/home/
├── home-page-client.tsx      (300 行，主容器)
├── home-toolbar.tsx          (200 行，工具栏)
├── home-content.tsx          (300 行，内容区)
├── home-dialogs.tsx          (200 行，对话框集合)
├── home-selection-mode.tsx   (150 行，批量选择)
├── home-trash-view.tsx       (150 行，垃圾箱视图)
└── hooks/
    ├── use-home-state.ts     (状态管理)
    ├── use-home-actions.ts   (操作函数)
    └── use-home-events.ts    (事件监听)
```

**收益**：

- 代码分割，按需加载
- 更好的 Tree Shaking
- 降低首屏 JavaScript 体积

#### P3-2：优化 DnD 库加载

**优先级：🟢 建议 | 风险：🟢 低**

**当前：** @dnd-kit 在侧边栏始终加载（约 30KB gzipped）

**优化方案：**

```typescript
// 懒加载 DnD 功能
const DraggableSmartList = dynamic(
  () => import('./draggable-smart-list'),
  { ssr: false, loading: () => <StaticSmartList /> }
);

// 只在编辑模式下启用拖拽
{isEditMode ? <DraggableSmartList /> : <StaticSmartList />}
```

#### P3-3：骨架屏优化用户体验

**优先级：🟢 建议 | 风险：🟢 低**

即使数据加载较慢，良好的骨架屏可以改善用户感知。

```typescript
// 首页骨架屏
function HomePageSkeleton() {
  return (
    <div className="animate-pulse">
      {/* 工具栏骨架 */}
      <div className="h-12 bg-gray-200 rounded mb-4" />
      {/* 书签列表骨架 */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 bg-gray-200 rounded mb-2" />
      ))}
    </div>
  );
}
```

### Phase 4：数据库优化（预期提升 10%+）

#### P4-1：添加数据库索引

**优先级：🟢 建议 | 风险：🟢 低**

检查并添加缺失的索引：

```sql
-- 常用查询索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created
ON bookmarks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_platform
ON bookmarks(user_id, platform);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_folder
ON bookmarks(user_id, folder_id);

-- 复合索引（覆盖常用查询）
CREATE INDEX IF NOT EXISTS idx_bookmarks_list_query
ON bookmarks(user_id, is_in_trash, deleted_at, created_at DESC);
```

#### P4-2：优化 Inbox 分析（修复超时）

**优先级：🟡 重要 | 风险：🟢 低**

**问题**：`/api/classification/inbox` 超时（10秒+），导致 500 错误。

**方案**：

1. 增加超时时间或异步处理
2. 分页处理大量数据
3. 使用缓存避免重复计算

```typescript
// 方案 A：后台任务 + 缓存结果
export async function GET(request: NextRequest) {
  const cacheKey = `inbox-analysis:${userId}`;

  // 1. 先返回缓存数据
  const cached = await redis.get(cacheKey);
  if (cached) {
    return Response.json(JSON.parse(cached));
  }

  // 2. 触发后台计算
  await triggerBackgroundJob("analyze-inbox", { userId });

  // 3. 返回空数据，前端轮询等待
  return Response.json({ status: "processing" });
}

// 方案 B：分页处理
export async function GET(request: NextRequest) {
  const limit = 100; // 每次只处理 100 条
  const offset = parseInt(searchParams.get("offset") || "0");

  const result = await analyzeInboxBatch(userId, limit, offset);

  return Response.json({
    ...result,
    hasMore: result.total > offset + limit,
    nextOffset: offset + limit,
  });
}
```

### Phase 5：高级优化（可选）

#### P5-1：实现 Streaming SSR

**优先级：🟢 建议 | 风险：🟡 中**

使用 React 18 Suspense + Streaming 让页面更快显示：

```typescript
export default async function HomePage() {
  return (
    <>
      {/* 立即显示的静态部分 */}
      <HomeToolbar />

      {/* 异步加载的数据部分 */}
      <Suspense fallback={<BookmarkListSkeleton />}>
        <BookmarkListAsync />
      </Suspense>

      {/* 延迟加载的侧边栏数据 */}
      <Suspense fallback={<SmartListSkeleton />}>
        <SmartListAsync />
      </Suspense>
    </>
  );
}

async function BookmarkListAsync() {
  const bookmarks = await getBookmarks();
  return <BookmarkList bookmarks={bookmarks} />;
}
```

#### P5-2：Service Worker 离线缓存

**优先级：🟢 建议 | 风险：🟡 中**

```typescript
// public/sw.js
const CACHE_NAME = "anykeep-v1";
const API_CACHE = "anykeep-api-v1";

// 缓存策略
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.url.includes("/api/")) {
    // API: 网络优先，失败用缓存
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)),
    );
  }
});
```

---

## 四、实施路线图（修订版）

### ✅ Week 1：核心认证优化（Phase 1）— 已完成

**目标**：解决 Supabase Auth 延迟问题，这是当前最大瓶颈。

| 任务                           | 工作量 | 预期收益      | 状态      |
| ------------------------------ | ------ | ------------- | --------- |
| P1-1: Session Token 传递机制   | 2天    | 认证时间 -80% | ✅ 已完成 |
| P1-2: API 聚合端点 `/api/init` | 2天    | 请求数 -85%   | ✅ 已完成 |
| P1-3: 延迟加载非关键数据       | 1天    | 首屏时间 -30% | ✅ 已完成 |

**实现文件**：

- `src/lib/api/fetch-with-auth.ts` - 客户端 token 缓存与自动携带
- `src/lib/api/auth-middleware.ts` - 服务端三级认证（Header/Token/Cookie）
- `src/app/api/init/route.ts` - 数据聚合端点
- `src/hooks/use-init-data.ts` - 聚合数据 Hook
- `src/hooks/use-unread-count.ts` - 延迟加载优化
- `src/hooks/use-smart-lists.ts` - SWR 缓存优化
- `src/components/smart-list/smart-list-section.tsx` - requestIdleCallback 延迟加载

**预期效果：** TTFB -60%, Time to First Render -70%

**验证指标**：

- [ ] 首页 TTFB < 1000ms
- [ ] 首屏渲染 < 3000ms
- [ ] API 请求数从 7+ 降至 2-3

> **下一步**：在首页 `home-page-client.tsx` 中集成 `useInitData` Hook 以获得完整收益

### ✅ Week 2：网络与缓存优化（Phase 2）— 已完成

**目标**：减少网络延迟和重复请求。

| 任务                        | 工作量 | 预期收益      | 状态      |
| --------------------------- | ------ | ------------- | --------- |
| P2-1: Supabase 连接配置优化 | 0.5天  | 连接时间 -20% | ✅ 已完成 |
| P2-2: SWR 请求去重配置      | 0.5天  | 重复请求 -90% | ✅ 已完成 |
| P1-4: Middleware 预验证     | 1天    | 认证时间 -30% | ✅ 已完成 |
| P2-3: HTTP/2 预连接配置     | 0.5天  | 连接时间 -15% | ✅ 已完成 |

**实现文件**：

- `src/lib/supabase/server.ts` - 服务端 fetch 超时 + keepalive + 禁用自动刷新
- `src/lib/supabase/client.ts` - 客户端 fetch 超时 + realtime 心跳优化
- `src/middleware.ts` - V4.2.24 用户预验证注入（x-user-id, x-user-verified headers）
- `next.config.mjs` - HTTP/2 Link headers（preconnect Supabase + Google）

**预期效果：** FCP -40%, 页面切换 -50%

### 🟢 Week 3：客户端优化（Phase 3）

**目标**：减少 JavaScript 体积，改善用户体验。

| 任务                 | 工作量 | 预期收益      |
| -------------------- | ------ | ------------- |
| P3-2: DnD 库懒加载   | 0.5天  | JS 体积 -30KB |
| P3-3: 骨架屏优化     | 1天    | 感知性能 ↑    |
| P4-2: Inbox 分析优化 | 1天    | 修复超时      |

**预期效果：** LCP -30%, TTI -25%

### 🔵 Week 4：验证与长期优化

| 任务                     | 工作量 | 说明                    |
| ------------------------ | ------ | ----------------------- |
| 性能回归测试             | 1天    | Playwright + Web Vitals |
| P3-1: 组件拆分（可选）   | 2-3天  | 如有需要                |
| P4-1: 数据库索引（可选） | 0.5天  | 如查询慢                |
| 监控告警配置             | 0.5天  | 持续监控                |

---

## 五、优先级矩阵

| 优化项             | 收益       | 风险  | 工作量 | 推荐顺序 |
| ------------------ | ---------- | ----- | ------ | -------- |
| Session Token 传递 | ⭐⭐⭐⭐⭐ | 🟢 低 | 2天    | **1**    |
| API 聚合端点       | ⭐⭐⭐⭐⭐ | 🟢 低 | 2天    | **2**    |
| 延迟加载非关键数据 | ⭐⭐⭐⭐   | 🟢 低 | 1天    | **3**    |
| SWR 请求去重       | ⭐⭐⭐     | 🟢 低 | 0.5天  | **4**    |
| Supabase 连接优化  | ⭐⭐⭐     | 🟢 低 | 0.5天  | **5**    |
| DnD 库懒加载       | ⭐⭐       | 🟢 低 | 0.5天  | **6**    |
| Inbox 超时修复     | ⭐⭐⭐     | 🟢 低 | 1天    | **7**    |
| 组件拆分           | ⭐⭐       | 🟡 中 | 3天    | 可选     |
| Middleware 预验证  | ⭐⭐⭐     | 🟡 中 | 1天    | 可选     |
| Streaming SSR      | ⭐⭐       | 🟡 中 | 2天    | 可选     |

---

## 六、风险评估（修订版）

| 优化项             | 风险等级 | 风险说明              | 缓解措施                      |
| ------------------ | -------- | --------------------- | ----------------------------- |
| Session Token 传递 | 🟢 低    | 需要修改所有 API 调用 | 创建统一 fetch 封装，逐步迁移 |
| API 聚合端点       | 🟢 低    | 新增端点，不影响现有  | 保持原有 API 可用，渐进迁移   |
| 延迟加载数据       | 🟢 低    | 用户可能注意到延迟    | 显示加载状态，使用骨架屏      |
| SWR 配置修改       | 🟢 低    | 缓存时间可能过长      | 提供手动刷新按钮              |
| Middleware 预验证  | 🟡 中    | 可能与某些 API 不兼容 | 保留回退逻辑                  |
| 组件拆分           | 🟡 中    | 重构工作量大          | 逐步拆分，充分测试            |
| Streaming SSR      | 🟡 中    | 需要重构页面结构      | 渐进式迁移，保留回退          |

### 不推荐的优化（已尝试，效果有限）

| 优化项                                     | 问题           | 原因                       |
| ------------------------------------------ | -------------- | -------------------------- |
| ❌ 移除 `force-dynamic`                    | 破坏实时性     | 配置是为确保数据新鲜度而设 |
| ❌ 替换 `unstable_noStore` 为 `revalidate` | 效果有限       | 真正瓶颈在认证，不在缓存   |
| ❌ Next.js 静态缓存                        | 不适合动态数据 | 应用数据高度个性化         |

---

## 七、监控指标

### 7.1 Core Web Vitals 监控

项目已集成 Web Vitals 监控：

- `src/components/analytics/web-vitals-reporter.tsx`

建议添加告警阈值：

```typescript
const ALERT_THRESHOLDS = {
  TTFB: 1000, // > 1s 告警
  FCP: 2500, // > 2.5s 告警
  LCP: 4000, // > 4s 告警
  FID: 100, // > 100ms 告警
  CLS: 0.1, // > 0.1 告警
};
```

### 7.2 新增监控指标

针对认证优化，建议新增：

```typescript
// 认证耗时监控
const AUTH_METRICS = {
  // API 认证时间
  apiAuthTime: "api.auth.duration",
  // Session Token 验证时间
  tokenVerifyTime: "auth.token.verify",
  // 聚合端点响应时间
  initApiTime: "api.init.duration",
};

// 在 API 路由中记录
console.log(`[Auth] Token verify took ${duration}ms`);
```

### 7.3 业务指标监控

- 页面加载成功率
- API 响应时间 P95
- 错误率
- 用户会话时长

---

## 八、相关文件

### 核心文件

| 文件路径                                   | 说明                     |
| ------------------------------------------ | ------------------------ |
| `src/app/(main)/home/page.tsx`             | 首页服务端组件           |
| `src/components/home/home-page-client.tsx` | 首页客户端组件（1763行） |
| `src/app/(main)/layout.tsx`                | 主布局（force-dynamic）  |
| `src/lib/supabase/server.ts`               | Supabase 服务端客户端    |
| `src/lib/supabase/cached-auth.ts`          | 认证缓存（请求级别）     |
| `src/middleware.ts`                        | 认证中间件               |

### 需优化的 Hooks

| 文件路径                                   | API 调用                     | 说明               |
| ------------------------------------------ | ---------------------------- | ------------------ |
| `src/hooks/use-smart-lists.ts`             | `/api/smart-lists`           | 智能列表           |
| `src/hooks/use-unread-count.ts`            | `/api/messages/unread-count` | 未读消息           |
| `src/lib/cache/hooks/use-bookmarks-swr.ts` | `/api/bookmarks`             | 书签列表           |
| `src/hooks/use-inbox-organization.ts`      | `/api/classification/inbox`  | Inbox 分析（超时） |

### 侧边栏组件

| 文件路径                                           | 说明                |
| -------------------------------------------------- | ------------------- |
| `src/components/layout/app-sidebar.tsx`            | 侧边栏入口          |
| `src/components/smart-list/smart-list-section.tsx` | 智能列表区块（DnD） |

---

## 九、执行摘要

### 问题总结

1. **真正的瓶颈**：Supabase Auth 认证延迟（1-1.5秒/次），不是 Next.js 缓存
2. **首页问题**：7+ 个并发 API 请求，每个都独立认证
3. **Inbox 超时**：复杂计算导致 10秒+ 超时

### 核心解决方案

1. **Session Token 传递**：客户端传递 token，避免重复认证
2. **API 聚合**：`/api/init` 一次请求返回所有数据
3. **延迟加载**：非关键数据空闲时加载

### 预期收益

| 指标       | 当前值         | 目标值   | 预期提升 |
| ---------- | -------------- | -------- | -------- |
| TTFB       | 2320ms         | < 800ms  | -65%     |
| 首屏渲染   | 11235ms        | < 3000ms | -73%     |
| API 请求数 | 7+             | 2-3      | -70%     |
| 认证耗时   | 7-10秒（累计） | < 1秒    | -90%     |

### 实施建议

1. **优先实施 Phase 1**（认证优化），这是最大杠杆点
2. **保留现有配置**（force-dynamic 等），它们保证数据实时性
3. **渐进式迁移**，保持系统稳定性

---

**文档版本：** 2.1.0
**最后更新：** 2025-12-16
**作者**：AI 性能分析助手

### 更新历史

| 版本  | 日期       | 变更内容                         |
| ----- | ---------- | -------------------------------- |
| 2.1.0 | 2025-12-16 | Phase 2 网络优化完成             |
| 2.0.0 | 2025-12-16 | Phase 1 认证优化完成，重新诊断   |
| 1.0.0 | 2025-12-16 | 初始性能诊断，发现真正瓶颈在认证 |
