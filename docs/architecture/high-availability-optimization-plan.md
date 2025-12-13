# AnyKeep 高可用架构优化方案

> **核心目标**：让用户第一次使用就感觉丝滑流畅，宁可功能少一点，也要体验好
>
> **设计理念**：低并发场景下，用户体验 > 系统容量

---

## 一、问题诊断

### 1.1 当前用户体验痛点

| 问题           | 表现               | 根因                          | 影响                |
| -------------- | ------------------ | ----------------------------- | ------------------- |
| 首页加载慢     | 白屏 8-15 秒       | API 响应 15s + 数据量 14MB    | **致命** - 用户流失 |
| 页面跳转卡顿   | 点击后无响应感     | 无加载状态 + 全量数据重新获取 | **严重** - 体验差   |
| 交互不丝滑     | 滚动卡顿、列表闪烁 | 无虚拟滚动 + 重复渲染         | **中等** - 不专业   |
| 网络抖动时崩溃 | 白屏或错误页       | 无降级策略                    | **严重** - 不可靠   |

### 1.2 诊断数据（实测）

```
GET /api/classification/inbox
├── 总耗时: 11-22 秒 ← 超过 Vercel 10s 限制！
├── N+1 查询: 74x 性能损耗
└── 缓存命中: 0%

GET /api/bookmarks
├── 总耗时: 15 秒
├── 数据量: 14.3 MB
└── 首屏实际需要: 50 KB
```

---

## 二、优化策略

### 2.1 核心原则

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   1. 感知优先        2. 渐进加载        3. 永不白屏     │
│   ──────────        ──────────        ──────────       │
│   先显示骨架屏      首屏 < 1s         离线也能用       │
│   再填充数据        其余懒加载        出错有降级       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 优化层次

| 层次       | 策略                       | 效果       |
| ---------- | -------------------------- | ---------- |
| **感知层** | 骨架屏、加载动画、乐观更新 | 用户感觉快 |
| **网络层** | 分页、压缩、缓存           | 实际传输快 |
| **数据层** | N+1 修复、索引优化         | 查询真的快 |
| **可靠层** | 降级、重试、离线           | 永远能用   |

---

## 三、实施方案

### Phase 1：感知性能优化（3 天）

> **目标**：即使后端慢，用户也感觉快

#### 3.1.1 全局骨架屏系统

```typescript
// src/components/skeleton/page-skeleton.tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function HomePageSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      {/* 顶部统计卡片骨架 */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* 书签列表骨架 */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 p-4 border rounded-lg">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 使用：在 Suspense 中作为 fallback
<Suspense fallback={<HomePageSkeleton />}>
  <HomePageContent />
</Suspense>
```

#### 3.1.2 路由预加载 + 即时反馈

```typescript
// src/components/layout/nav-link.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";

export function NavLink({ href, children, ...props }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isHovering, setIsHovering] = useState(false);

  // 鼠标悬停时预加载
  const handleMouseEnter = () => {
    setIsHovering(true);
    router.prefetch(href);
  };

  // 点击时立即显示加载状态
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "transition-all",
        isPending && "opacity-70 pointer-events-none"
      )}
      {...props}
    >
      {children}
      {isPending && (
        <span className="ml-2 inline-block animate-spin">⏳</span>
      )}
    </Link>
  );
}
```

#### 3.1.3 乐观更新 + 离线队列

```typescript
// src/lib/utils/optimistic-mutation.ts

interface MutationOptions<T> {
  // 乐观更新：立即更新 UI
  optimisticUpdate: (current: T) => T;
  // 实际请求
  mutationFn: () => Promise<T>;
  // 失败回滚
  onError?: (error: Error, rollback: () => void) => void;
  // 离线时存入队列
  offlineKey?: string;
}

export function useOptimisticMutation<T>(options: MutationOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const previousData = useRef<T | null>(null);

  const mutate = async () => {
    // 1. 保存当前状态用于回滚
    previousData.current = data;

    // 2. 乐观更新 UI
    if (data) {
      setData(options.optimisticUpdate(data));
    }

    try {
      // 3. 执行实际请求
      const result = await options.mutationFn();
      setData(result);
    } catch (error) {
      // 4. 失败时回滚
      setData(previousData.current);

      // 5. 离线时存入队列
      if (!navigator.onLine && options.offlineKey) {
        saveToOfflineQueue(options.offlineKey, options.mutationFn);
        toast.info("已保存，将在网络恢复后同步");
      } else {
        options.onError?.(error as Error, () => setData(previousData.current));
      }
    }
  };

  return { data, mutate };
}

// 离线队列
function saveToOfflineQueue(key: string, fn: () => Promise<unknown>) {
  const queue = JSON.parse(localStorage.getItem("offline_queue") || "[]");
  queue.push({ key, timestamp: Date.now() });
  localStorage.setItem("offline_queue", JSON.stringify(queue));
}
```

#### 3.1.4 页面切换过渡动画

```typescript
// src/app/(main)/template.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

**Phase 1 交付物**：

- [ ] `src/components/skeleton/` - 骨架屏组件库
- [ ] `src/components/layout/nav-link.tsx` - 预加载导航
- [ ] `src/app/(main)/template.tsx` - 页面过渡动画
- [ ] `src/lib/utils/optimistic-mutation.ts` - 乐观更新工具

---

### Phase 2：首屏极速加载（3 天）

> **目标**：首屏 < 1 秒，FCP < 1.8 秒

#### 3.2.1 首屏数据精简

```typescript
// src/app/api/bookmarks/route.ts

// 首屏只返回最少必要字段
const FIRST_SCREEN_FIELDS = `
  id,
  title,
  url,
  platform,
  favicon_url,
  created_at
`;

// 完整字段（详情页按需加载）
const FULL_FIELDS = `
  ${FIRST_SCREEN_FIELDS},
  description,
  summary,
  ai_summary,
  cover_url,
  tags,
  folder_id,
  folders(name)
`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = parseInt(searchParams.get("limit") || "20");
  const minimal = searchParams.get("minimal") === "true";

  // 首屏请求使用精简字段
  const fields = minimal ? FIRST_SCREEN_FIELDS : FULL_FIELDS;

  const query = supabase
    .from("bookmarks")
    .select(fields)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit + 1); // +1 判断是否有更多

  // 游标分页
  if (cursor) {
    const [createdAt, id] = Buffer.from(cursor, "base64").toString().split("_");
    query
      .lt("created_at", createdAt)
      .or(`created_at.eq.${createdAt},id.lt.${id}`);
  }

  const { data, error } = await query;

  // 生成下一页游标
  const hasMore = data && data.length > limit;
  const items = hasMore ? data.slice(0, -1) : data;
  const lastItem = items?.[items.length - 1];
  const nextCursor = lastItem
    ? Buffer.from(`${lastItem.created_at}_${lastItem.id}`).toString("base64")
    : null;

  return successResponse({
    bookmarks: items,
    pagination: { hasMore, nextCursor },
  });
}
```

#### 3.2.2 首屏 SSR + 流式渲染

```typescript
// src/app/(main)/home/page.tsx
import { Suspense } from "react";
import { HomePageSkeleton } from "@/components/skeleton/page-skeleton";

// 服务端获取首屏数据
async function getInitialBookmarks(userId: string) {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("bookmarks")
    .select("id, title, url, platform, favicon_url, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return data || [];
}

export default async function HomePage() {
  const user = await getUser();

  // 服务端预取首屏数据
  const initialBookmarks = await getInitialBookmarks(user.id);

  return (
    <div className="container py-6">
      {/* 统计卡片 - 流式加载 */}
      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsCards />
      </Suspense>

      {/* 书签列表 - 带初始数据 */}
      <Suspense fallback={<BookmarkListSkeleton />}>
        <BookmarkList initialData={initialBookmarks} />
      </Suspense>
    </div>
  );
}
```

#### 3.2.3 API 响应缓存头

```typescript
// src/app/api/bookmarks/route.ts

export async function GET(request: NextRequest) {
  // ... 查询逻辑 ...

  const response = NextResponse.json({ success: true, data });

  // 私有缓存：30 秒新鲜，5 分钟可用
  response.headers.set(
    "Cache-Control",
    "private, max-age=30, stale-while-revalidate=300",
  );

  return response;
}
```

#### 3.2.4 N+1 查询修复（关键）

```typescript
// src/lib/classification/repositories/folder-profile.repository.ts

export class FolderProfileRepository {
  // 新增：批量获取用户所有 profiles
  async findByUserId(userId: string): Promise<FolderProfile[]> {
    const { data, error } = await this.supabase
      .from("folder_profiles")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    return data || [];
  }
}

// src/lib/classification/services/inbox-organizer.service.ts

export class InboxOrganizerService {
  async analyze(userId: string): Promise<OrganizationAnalysis> {
    // 1. 一次性获取所有 profiles（替代 N+1）
    const allProfiles = await this.folderProfileRepo.findByUserId(userId);

    // 2. 构建内存索引
    const profileMap = new Map(allProfiles.map((p) => [p.folder_id, p]));

    // 3. 内存中匹配（无数据库查询）
    for (const cluster of clusters) {
      const match = this.matchClusterInMemory(cluster, profileMap);
      // ...
    }
  }

  private matchClusterInMemory(
    cluster: BookmarkCluster,
    profileMap: Map<number, FolderProfile>,
  ): FolderMatch | null {
    let bestMatch: FolderMatch | null = null;
    let bestScore = 0;

    for (const [folderId, profile] of profileMap) {
      const score = this.calculateSimilarity(
        cluster.centroid,
        profile.computed_embedding,
      );
      if (score > bestScore && score > 0.7) {
        bestScore = score;
        bestMatch = { folderId, score, profile };
      }
    }

    return bestMatch;
  }
}
```

**Phase 2 交付物**：

- [ ] API 游标分页 + 精简字段
- [ ] 首页 SSR + 流式渲染
- [ ] N+1 查询修复
- [ ] HTTP 缓存头配置

---

### Phase 3：交互丝滑优化（2 天）

> **目标**：60fps 滚动，无卡顿

#### 3.3.1 虚拟滚动集成

```typescript
// src/components/bookmark/bookmark-virtual-list.tsx
"use client";

import { Virtuoso } from "react-virtuoso";
import { BookmarkCard } from "./bookmark-card";
import { useBookmarksSWR } from "@/lib/cache/hooks/use-bookmarks-swr";

interface Props {
  initialData?: Bookmark[];
}

export function BookmarkVirtualList({ initialData }: Props) {
  const {
    bookmarks,
    isLoading,
    hasMore,
    loadMore,
    isLoadingMore,
  } = useBookmarksSWR({ initialData });

  if (isLoading && !initialData) {
    return <BookmarkListSkeleton />;
  }

  return (
    <Virtuoso
      useWindowScroll
      data={bookmarks}
      overscan={200}
      increaseViewportBy={{ top: 100, bottom: 300 }}
      endReached={() => {
        if (hasMore && !isLoadingMore) {
          loadMore();
        }
      }}
      itemContent={(index, bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          className="mb-4"
        />
      )}
      components={{
        Footer: () =>
          isLoadingMore ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : null,
      }}
    />
  );
}
```

#### 3.3.2 图片懒加载 + 占位

```typescript
// src/components/ui/lazy-image.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderColor?: string;
}

export function LazyImage({
  src,
  alt,
  className,
  placeholderColor = "bg-muted",
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }  // 提前 200px 开始加载
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={imgRef}
      className={cn(
        "relative overflow-hidden",
        placeholderColor,
        className
      )}
    >
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setIsLoaded(true)}
        />
      )}
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}
    </div>
  );
}
```

#### 3.3.3 防抖搜索 + 即时反馈

```typescript
// src/hooks/use-debounced-search.ts
"use client";

import { useState, useDeferredValue, useTransition } from "react";

export function useDebouncedSearch() {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // React 18 自动延迟非紧急更新
  const deferredQuery = useDeferredValue(query);

  const handleSearch = (value: string) => {
    // 立即更新输入框（紧急）
    setQuery(value);

    // 延迟更新搜索结果（非紧急）
    startTransition(() => {
      // 触发搜索
    });
  };

  return {
    query,
    deferredQuery,
    isPending,
    handleSearch,
  };
}
```

**Phase 3 交付物**：

- [ ] `react-virtuoso` 虚拟滚动集成
- [ ] `LazyImage` 图片懒加载组件
- [ ] 搜索防抖优化

---

### Phase 4：可靠性保障（2 天）

> **目标**：网络抖动不崩溃，出错有降级

#### 3.4.1 全局错误边界

```typescript
// src/components/error-boundary.tsx
"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 上报错误（可选）
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-orange-500 mb-6" />
          <h2 className="text-xl font-semibold mb-2">页面加载出错了</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            别担心，您的数据是安全的。请尝试刷新页面或返回首页。
          </p>
          <div className="flex gap-3">
            <Button onClick={this.handleRetry} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
            <Button variant="outline" asChild>
              <a href="/">
                <Home className="h-4 w-4 mr-2" />
                返回首页
              </a>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### 3.4.2 API 请求降级策略

```typescript
// src/lib/utils/fetch-with-fallback.ts

interface FetchOptions extends RequestInit {
  timeout?: number;
  cacheKey?: string;
  fallbackData?: unknown;
}

export async function fetchWithFallback<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const { timeout = 5000, cacheKey, fallbackData, ...fetchOptions } = options;

  // 1. 创建超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // 2. 成功后缓存到本地
    if (cacheKey) {
      try {
        localStorage.setItem(
          `cache_${cacheKey}`,
          JSON.stringify({ data, timestamp: Date.now() }),
        );
      } catch {
        // localStorage 满了，静默失败
      }
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    // 3. 尝试从缓存读取
    if (cacheKey) {
      try {
        const cached = localStorage.getItem(`cache_${cacheKey}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          // 缓存 24 小时内有效
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            console.warn(`[Fallback] Using cached data for ${url}`);
            return data;
          }
        }
      } catch {
        // 解析失败，继续
      }
    }

    // 4. 返回默认数据
    if (fallbackData !== undefined) {
      console.warn(`[Fallback] Using default data for ${url}`);
      return fallbackData as T;
    }

    throw error;
  }
}

// 使用示例
const bookmarks = await fetchWithFallback<Bookmark[]>("/api/bookmarks", {
  cacheKey: "home_bookmarks",
  fallbackData: [],
  timeout: 5000,
});
```

#### 3.4.3 网络状态监听 + Toast 提示

```typescript
// src/hooks/use-network-status.ts
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // 初始状态
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("网络已恢复", {
        description: "正在同步数据...",
        duration: 3000,
      });
      // 触发离线队列同步
      syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("网络已断开", {
        description: "您的操作将在恢复后同步",
        duration: 5000,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
}

// 同步离线队列
async function syncOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem("offline_queue") || "[]");
  if (queue.length === 0) return;

  for (const item of queue) {
    try {
      await item.fn();
    } catch {
      // 仍然失败，保留在队列中
      continue;
    }
  }

  // 清空已同步的
  localStorage.removeItem("offline_queue");
}
```

#### 3.4.4 健康检查端点

```typescript
// src/app/api/health/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const checks = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: false,
      auth: false,
    },
  };

  try {
    const supabase = createClient();

    // 检查数据库连接
    const { error: dbError } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);
    checks.services.database = !dbError;

    // 检查认证服务
    const { error: authError } = await supabase.auth.getSession();
    checks.services.auth = !authError;

    // 判断整体状态
    const allHealthy = Object.values(checks.services).every(Boolean);
    checks.status = allHealthy ? "healthy" : "degraded";

    return NextResponse.json(checks, {
      status: allHealthy ? 200 : 503,
    });
  } catch {
    checks.status = "unhealthy";
    return NextResponse.json(checks, { status: 503 });
  }
}
```

**Phase 4 交付物**：

- [ ] `ErrorBoundary` 全局错误边界
- [ ] `fetchWithFallback` 降级请求工具
- [ ] `useNetworkStatus` 网络状态监听
- [ ] `/api/health` 健康检查端点

---

## 四、实施时间线

```
Week 1 (5 天)
├── Day 1-2: Phase 1 - 感知性能优化
│   ├── 骨架屏系统
│   ├── 路由预加载
│   └── 页面过渡动画
├── Day 3-4: Phase 2 - 首屏极速加载
│   ├── API 分页 + 精简字段
│   ├── N+1 查询修复
│   └── SSR + 流式渲染
└── Day 5: Phase 3 - 交互丝滑
    ├── 虚拟滚动
    └── 图片懒加载

Week 2 (3 天)
├── Day 1: Phase 4 - 可靠性保障
│   ├── 错误边界
│   └── 降级策略
├── Day 2: 集成测试 + 性能验证
└── Day 3: 文档更新 + 发布
```

---

## 五、预期效果

### 5.1 性能指标

| 指标               | 优化前 | 优化后 | 目标    |
| ------------------ | ------ | ------ | ------- |
| FCP (首次内容绘制) | 8.5s   | < 1.8s | ✅ Good |
| LCP (最大内容绘制) | 15s    | < 2.5s | ✅ Good |
| TTI (可交互时间)   | 20s    | < 3s   | ✅ Good |
| CLS (布局偏移)     | 0.3    | < 0.1  | ✅ Good |
| 首屏数据量         | 14.3MB | < 50KB | 99.6% ↓ |

### 5.2 用户体验

| 场景     | 优化前     | 优化后                  |
| -------- | ---------- | ----------------------- |
| 首次访问 | 白屏 15 秒 | 骨架屏 + 1 秒内显示内容 |
| 页面跳转 | 点击无反馈 | 即时过渡动画            |
| 列表滚动 | 卡顿、闪烁 | 60fps 流畅滚动          |
| 网络断开 | 白屏报错   | 显示缓存 + 提示         |
| 操作失败 | 无反馈     | 自动重试 + Toast        |

---

## 六、不做的事情（保持简单）

| 不做          | 原因                            |
| ------------- | ------------------------------- |
| ❌ Redis 缓存 | 低并发场景不需要，增加复杂度    |
| ❌ 微服务拆分 | 当前规模不需要，Supabase 已足够 |
| ❌ 多区域部署 | 用户规模不需要，成本高          |
| ❌ 消息队列   | 无高并发写入需求                |
| ❌ 自建数据库 | Supabase 托管更可靠             |

---

## 七、风险与应对

| 风险                   | 概率 | 影响 | 应对措施           |
| ---------------------- | ---- | ---- | ------------------ |
| 骨架屏与实际布局不匹配 | 中   | 低   | 设计时同步骨架屏   |
| SSR 增加服务端负载     | 低   | 中   | 监控服务端响应时间 |
| 虚拟滚动兼容性问题     | 低   | 中   | 充分测试各浏览器   |
| 离线缓存数据过期       | 中   | 低   | 显示缓存时间提示   |

---

## 八、成功标准

### 8.1 必须达成

- [ ] 首屏加载 < 3 秒（含骨架屏时间）
- [ ] 页面跳转有即时反馈
- [ ] 列表滚动无卡顿
- [ ] 网络断开时不白屏

### 8.2 加分项

- [ ] FCP < 1.8 秒
- [ ] LCP < 2.5 秒
- [ ] 离线时可查看缓存数据

---

**方案制定人**: Claude Code (Architect)
**制定日期**: 2025-12-13
**预计工时**: 8 人天
**核心理念**: 宁可慢一点，不能挂；宁可简单一点，不能卡
