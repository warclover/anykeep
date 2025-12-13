# AnyKeep 用户体验优化方案 V5.0

> **核心目标**：启动即显示，操作即响应，永不白屏
>
> **设计理念**：用户体验 > 系统复杂度，感知速度 > 实际速度

---

## 一、方案概述

### 1.1 背景分析

本方案融合了两个优化设计：

- **V4.2.2 本地持久化缓存方案**：解决启动等待问题
- **高可用架构优化方案**：全面提升用户体验

### 1.2 已完成优化（V4.2.1）

| 优化项                         | 状态      | 效果              |
| ------------------------------ | --------- | ----------------- |
| API 字段精简（排除 embedding） | ✅ 已完成 | 响应 14MB → ~30KB |
| HTTP 缓存头（Cache-Control）   | ✅ 已完成 | 浏览器缓存 30s    |
| React.memo 优化 BookmarkCard   | ✅ 已完成 | 减少重渲染        |
| PerformanceMonitor 性能监控    | ✅ 已完成 | 可追踪瓶颈        |
| Web Vitals 报告                | ✅ 已完成 | 可量化指标        |
| 虚拟滚动基础                   | ✅ 已完成 | 支持大列表        |

**当前性能基线**：

- FCP: ~1616ms
- API 响应: ~740ms
- 响应数据: ~30KB

### 1.3 核心痛点（待解决）

| 问题         | 表现              | 根因                     | 优先级      |
| ------------ | ----------------- | ------------------------ | ----------- |
| **启动等待** | 每次启动等 1-3 秒 | 内存缓存丢失，必须等 API | **P0 致命** |
| 页面跳转卡顿 | 点击后无反馈      | 无加载状态               | P1 严重     |
| 网络抖动崩溃 | 白屏或错误页      | 无降级策略               | P1 严重     |
| 操作无反馈   | 删除/编辑后等待   | 无乐观更新               | P2 中等     |

---

## 二、整体架构

### 2.1 优化层次模型

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户交互层                                │
│  骨架屏 → 缓存数据 → 最新数据（无感刷新）                        │
└─────────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│                        感知优化层                                │
│  乐观更新 │ 过渡动画 │ 即时反馈 │ Toast 提示                    │
└─────────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│                        缓存层（核心）                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ 内存缓存    │ ←→ │ 持久化存储  │ ←→ │  API 层     │        │
│  │ (Map)      │    │ (localStorage)│   │ (Supabase)  │        │
│  │ ~0ms 读取  │    │ ~10ms 读取   │   │ ~700ms 响应 │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│                        可靠性层                                  │
│  错误边界 │ 降级策略 │ 网络监听 │ 离线队列                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流设计

```
应用启动
    │
    ├─→ [1] 从 localStorage 恢复缓存 (~10ms)
    │       └─→ 立即显示数据 ✅
    │
    ├─→ [2] 后台请求 API (~700ms)
    │       └─→ 对比数据
    │           ├─→ 有变化: 平滑更新 UI
    │           └─→ 无变化: 无操作
    │
    └─→ [3] 更新持久化缓存

用户操作（删除书签）
    │
    ├─→ [1] 保存快照（用于回滚）
    ├─→ [2] 乐观更新 UI ✅ (~0ms)
    ├─→ [3] 同步持久化到 localStorage
    ├─→ [4] 发起 API 请求
    │       ├─→ 成功: 确认更新
    │       └─→ 失败: 回滚（快照恢复 + UI + localStorage）
    └─→ [5] Toast 反馈
```

---

## 三、分阶段实施计划

### Phase 1：本地持久化缓存（核心，2天）

> **目标**：启动即显示，零等待感

#### 3.1.1 持久化存储层

**新增文件**：`src/lib/cache/persistent-storage.ts`

```typescript
/**
 * 本地持久化存储管理器
 * 为 DataCacheManager 提供 localStorage 持久化能力
 */

interface PersistedCache {
  version: 1;
  timestamp: number;
  entries: Record<
    string,
    {
      data: unknown;
      timestamp: number;
      staleTime: number;
    }
  >;
}

export class PersistentStorage {
  private readonly storageKey = "anykeep:cache:v1";
  private readonly maxAge = 24 * 60 * 60 * 1000; // 24小时过期
  private readonly maxEntries = 10; // 最多缓存10个键
  private persistTimer: NodeJS.Timeout | null = null;

  /**
   * 从 localStorage 恢复缓存
   */
  restore(): Map<string, CacheEntry> | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return null;

      const parsed: PersistedCache = JSON.parse(stored);

      // 版本检查
      if (parsed.version !== 1) {
        this.clear();
        return null;
      }

      // 过期检查
      if (Date.now() - parsed.timestamp > this.maxAge) {
        this.clear();
        return null;
      }

      const map = new Map<string, CacheEntry>();
      for (const [key, entry] of Object.entries(parsed.entries)) {
        map.set(key, {
          data: entry.data,
          timestamp: entry.timestamp,
          staleTime: entry.staleTime,
        });
      }

      console.log(`[PersistentStorage] Restored ${map.size} entries`);
      return map;
    } catch (error) {
      console.warn("[PersistentStorage] Restore failed:", error);
      this.clear();
      return null;
    }
  }

  /**
   * 持久化到 localStorage（防抖 500ms）
   */
  persist(entries: Map<string, CacheEntry>): void {
    if (typeof window === "undefined") return;

    // 防抖
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      this.doPersist(entries);
    }, 500);
  }

  private doPersist(entries: Map<string, CacheEntry>): void {
    try {
      // 只保留书签相关缓存
      const filtered = new Map<string, CacheEntry>();
      for (const [key, entry] of entries) {
        if (key.startsWith("bookmarks:") && filtered.size < this.maxEntries) {
          filtered.set(key, entry);
        }
      }

      const cache: PersistedCache = {
        version: 1,
        timestamp: Date.now(),
        entries: Object.fromEntries(filtered),
      };

      localStorage.setItem(this.storageKey, JSON.stringify(cache));
      console.log(`[PersistentStorage] Persisted ${filtered.size} entries`);
    } catch (error) {
      console.warn("[PersistentStorage] Persist failed:", error);
      // localStorage 满了，清理旧数据
      this.cleanup();
    }
  }

  /**
   * 清理过期数据
   */
  cleanup(): void {
    if (typeof window === "undefined") return;

    try {
      // 清理所有 anykeep 缓存
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("anykeep:cache:")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // 静默失败
    }
  }

  /**
   * 完全清除
   */
  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.storageKey);
  }
}

export const persistentStorage = new PersistentStorage();
```

#### 3.1.2 DataCacheManager 集成

**修改文件**：`src/lib/cache/data-cache.ts`

```typescript
// 在 DataCacheManager 类中添加：

import { persistentStorage } from "./persistent-storage";

class DataCacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private initialized = false;

  constructor() {
    // 启动时恢复缓存
    this.restoreFromStorage();
  }

  private restoreFromStorage(): void {
    if (this.initialized) return;
    this.initialized = true;

    const restored = persistentStorage.restore();
    if (restored) {
      this.cache = restored;
    }
  }

  // 修改 set 方法
  set<T>(cacheKey: string, data: T, options?: CacheOptions): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
    };
    this.cache.set(cacheKey, entry);

    // 持久化书签数据
    if (cacheKey.startsWith("bookmarks:")) {
      persistentStorage.persist(this.cache);
    }
  }

  // 修改 invalidate 方法
  invalidate(pattern: string | RegExp): void {
    // 原有逻辑...

    // 同步持久化
    persistentStorage.persist(this.cache);
  }

  // 新增：同步读取（用于初始渲染）
  getSync<T>(cacheKey: string): T | null {
    this.restoreFromStorage();
    const entry = this.cache.get(cacheKey);
    return entry ? (entry.data as T) : null;
  }

  // 新增：检查是否有缓存
  hasSync(cacheKey: string): boolean {
    this.restoreFromStorage();
    return this.cache.has(cacheKey);
  }
}
```

#### 3.1.3 useBookmarksSWR 适配

**修改文件**：`src/lib/cache/hooks/use-bookmarks-swr.ts`

```typescript
// 关键改动：初始状态从缓存读取

export function useBookmarksSWR(options: UseBookmarksSWROptions) {
  const cacheKey = buildCacheKey(options);

  // V5.0: 同步读取缓存作为初始值
  const [bookmarks, setBookmarks] = useState<BookmarkWithFolder[]>(() => {
    const cached = dataCache.getSync<BookmarksResponse>(cacheKey);
    return cached?.bookmarks || [];
  });

  const [isInitialLoading, setIsInitialLoading] = useState(() => {
    // 有缓存时不显示 loading
    return !dataCache.hasSync(cacheKey);
  });

  // 后台刷新逻辑
  useEffect(() => {
    const hasCache = dataCache.hasSync(cacheKey);

    if (hasCache) {
      // 有缓存：后台静默刷新，不阻塞 UI
      fetchBookmarks().then((newData) => {
        if (newData) {
          setBookmarks(newData.bookmarks);
        }
      });
    } else {
      // 无缓存：显示 loading，等待请求
      setIsInitialLoading(true);
      fetchBookmarks().then((newData) => {
        setIsInitialLoading(false);
        if (newData) {
          setBookmarks(newData.bookmarks);
        }
      });
    }
  }, [cacheKey]);

  return {
    bookmarks,
    isInitialLoading,
    // ...其他返回值
  };
}
```

#### 3.1.4 首屏数量优化

**修改文件**：`src/lib/validation.ts`

```typescript
// 将默认 limit 从 25 改为 12
limit: z.coerce.number().int().min(1).max(100).default(12),
```

**Phase 1 交付物**：

- [ ] `src/lib/cache/persistent-storage.ts` - 持久化存储层
- [ ] `src/lib/cache/data-cache.ts` - 集成持久化
- [ ] `src/lib/cache/hooks/use-bookmarks-swr.ts` - 同步初始化
- [ ] `src/lib/validation.ts` - limit=12

**预期效果**：

- 再次启动 FCP: 3-5s → **<100ms**（97%+ 提升）
- 首屏数据量: 25条 → 12条（52% 减少）

---

### Phase 2：感知性能优化（1.5天）

> **目标**：即使后端慢，用户也感觉快

#### 3.2.1 骨架屏系统

**新增文件**：`src/components/skeleton/page-skeleton.tsx`

```typescript
"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function HomePageSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      {/* 顶部统计区域骨架 */}
      <div className="flex gap-4 items-center">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>

      {/* 书签卡片骨架 - 12条 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border overflow-hidden">
            <Skeleton className="w-full h-40" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BookmarkCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <Skeleton className="w-full h-40" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
```

#### 3.2.2 乐观更新增强

**修改现有乐观更新逻辑**，确保：

1. 操作后立即更新 UI
2. 同步更新持久化缓存
3. 失败时正确回滚

```typescript
// 在 useBookmarksSWR 中增强乐观更新
const deleteBookmark = useCallback(
  async (id: number) => {
    // 1. 保存快照
    const snapshot = [...bookmarks];

    // 2. 乐观更新 UI
    setBookmarks((prev) => prev.filter((b) => b.id !== id));

    // 3. 同步持久化
    dataCache.optimisticUpdate(cacheKey, (data: BookmarksResponse) => ({
      ...data,
      bookmarks: data.bookmarks.filter((b) => b.id !== id),
    }));

    try {
      // 4. 发起请求
      await api.deleteBookmark(id);
      toast.success("删除成功");
    } catch (error) {
      // 5. 失败回滚
      setBookmarks(snapshot);
      dataCache.set(cacheKey, { bookmarks: snapshot });
      toast.error("删除失败，请重试");
    }
  },
  [bookmarks, cacheKey],
);
```

#### 3.2.3 页面过渡动画（可选）

**新增文件**：`src/app/(main)/template.tsx`

```typescript
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

**Phase 2 交付物**：

- [ ] `src/components/skeleton/page-skeleton.tsx` - 骨架屏组件
- [ ] 乐观更新增强（删除、编辑、星标等）
- [ ] `src/app/(main)/template.tsx` - 页面过渡动画（可选）

---

### Phase 3：可靠性保障（1天）

> **目标**：网络抖动不崩溃，出错有降级

#### 3.3.1 全局错误边界

**新增文件**：`src/components/error-boundary.tsx`

```typescript
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

#### 3.3.2 网络状态监听

**新增文件**：`src/hooks/use-network-status.ts`

```typescript
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("网络已恢复", {
        description: "正在同步数据...",
        duration: 3000,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("网络已断开", {
        description: "您可以继续浏览缓存内容",
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
```

#### 3.3.3 降级请求工具

**新增文件**：`src/lib/utils/fetch-with-fallback.ts`

```typescript
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

    // 成功后缓存
    if (cacheKey) {
      try {
        localStorage.setItem(
          `fallback_${cacheKey}`,
          JSON.stringify({ data, timestamp: Date.now() }),
        );
      } catch {
        // localStorage 满了，静默失败
      }
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    // 尝试从降级缓存读取
    if (cacheKey) {
      try {
        const cached = localStorage.getItem(`fallback_${cacheKey}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            console.warn(`[Fallback] Using cached data for ${url}`);
            return data;
          }
        }
      } catch {
        // 解析失败
      }
    }

    // 返回默认数据
    if (fallbackData !== undefined) {
      console.warn(`[Fallback] Using default data for ${url}`);
      return fallbackData as T;
    }

    throw error;
  }
}
```

**Phase 3 交付物**：

- [ ] `src/components/error-boundary.tsx` - 错误边界
- [ ] `src/hooks/use-network-status.ts` - 网络状态
- [ ] `src/lib/utils/fetch-with-fallback.ts` - 降级请求

---

### Phase 4：体验增强（0.5天，可选）

> **目标**：锦上添花的细节优化

#### 4.1 图片懒加载组件

```typescript
// src/components/ui/lazy-image.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function LazyImage({ src, alt, className }: LazyImageProps) {
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
      { rootMargin: "200px" }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={cn("relative overflow-hidden bg-muted", className)}>
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

#### 4.2 健康检查端点

```typescript
// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const checks = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: { database: false, auth: false },
  };

  try {
    const supabase = await createClient();

    const { error: dbError } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);
    checks.services.database = !dbError;

    const { error: authError } = await supabase.auth.getSession();
    checks.services.auth = !authError;

    const allHealthy = Object.values(checks.services).every(Boolean);
    checks.status = allHealthy ? "healthy" : "degraded";

    return NextResponse.json(checks, { status: allHealthy ? 200 : 503 });
  } catch {
    checks.status = "unhealthy";
    return NextResponse.json(checks, { status: 503 });
  }
}
```

---

## 四、实施时间表

```
┌─────────────────────────────────────────────────────────────────┐
│ Day 1-2: Phase 1 - 本地持久化缓存（核心）                        │
│   ├─ persistent-storage.ts 创建                                  │
│   ├─ data-cache.ts 集成                                          │
│   ├─ use-bookmarks-swr.ts 适配                                   │
│   └─ 首屏 limit=12                                               │
├─────────────────────────────────────────────────────────────────┤
│ Day 3: Phase 2 - 感知性能优化                                    │
│   ├─ 骨架屏组件                                                  │
│   ├─ 乐观更新增强                                                │
│   └─ 页面过渡动画（可选）                                        │
├─────────────────────────────────────────────────────────────────┤
│ Day 4: Phase 3 - 可靠性保障                                      │
│   ├─ 错误边界                                                    │
│   ├─ 网络状态监听                                                │
│   └─ 降级请求工具                                                │
├─────────────────────────────────────────────────────────────────┤
│ Day 5: Phase 4 + 测试验证                                        │
│   ├─ 图片懒加载（可选）                                          │
│   ├─ 健康检查端点（可选）                                        │
│   └─ 集成测试 + 性能验证                                         │
└─────────────────────────────────────────────────────────────────┘

总计：5 人天
```

---

## 五、预期效果

### 5.1 性能指标对比

| 指标             | V4.2.1 (当前) | V5.0 (目标)   | 提升    |
| ---------------- | ------------- | ------------- | ------- |
| **再次启动 FCP** | 1.6s          | **<100ms**    | **94%** |
| 首次启动 FCP     | 1.6s          | 1.6s (骨架屏) | -       |
| API 响应时间     | 740ms         | 740ms         | -       |
| 首屏数据量       | ~30KB (25条)  | ~15KB (12条)  | 50%     |
| 操作响应         | 等待 API      | **即时**      | 质变    |

### 5.2 用户体验对比

| 场景         | 当前        | 优化后           |
| ------------ | ----------- | ---------------- |
| **应用启动** | 等待 1-3 秒 | **立即显示内容** |
| 删除书签     | 等待后消失  | 立即消失 + 确认  |
| 星标操作     | 等待后更新  | 立即更新         |
| 网络断开     | 白屏/报错   | 显示缓存 + 提示  |
| 页面切换     | 闪烁        | 平滑过渡         |

---

## 六、不做的事情

| 不做              | 原因                                  |
| ----------------- | ------------------------------------- |
| ❌ IndexedDB      | localStorage 足够，IndexedDB 过度设计 |
| ❌ Service Worker | 复杂度高，当前场景不需要完整离线能力  |
| ❌ Redis 缓存     | 低并发场景不需要服务端缓存            |
| ❌ SSR 首屏数据   | 客户端缓存已解决启动问题              |

---

## 七、风险与回退

| 风险                   | 概率 | 影响 | 缓解措施                   |
| ---------------------- | ---- | ---- | -------------------------- |
| localStorage 容量不足  | 低   | 低   | maxEntries 限制 + 自动清理 |
| 缓存与服务器数据不一致 | 中   | 低   | 后台静默刷新               |
| JSON 序列化错误        | 低   | 中   | try-catch + 错误时清除缓存 |

**回退方案**：

- 添加 Feature Flag `NEXT_PUBLIC_FEATURE_PERSISTENT_CACHE`
- 默认开启，问题时可立即关闭

---

## 八、验收标准

### 必须达成

- [ ] 再次启动时，首页在 **100ms 内**显示内容
- [ ] 删除/星标等操作**立即**响应
- [ ] 网络断开时**不白屏**，显示缓存内容
- [ ] 无新增 TypeScript 错误
- [ ] 所有现有测试通过

### 加分项

- [ ] FCP < 100ms (Web Vitals)
- [ ] 离线时操作可暂存，上线后同步
- [ ] 页面切换有平滑动画

---

## 九、关键文件清单

| 文件                                        | 操作 | 优先级 | 预估行数 |
| ------------------------------------------- | ---- | ------ | -------- |
| `src/lib/cache/persistent-storage.ts`       | 新增 | P0     | ~150     |
| `src/lib/cache/data-cache.ts`               | 修改 | P0     | ~30      |
| `src/lib/cache/hooks/use-bookmarks-swr.ts`  | 修改 | P0     | ~40      |
| `src/lib/validation.ts`                     | 修改 | P0     | 1        |
| `src/components/skeleton/page-skeleton.tsx` | 新增 | P1     | ~60      |
| `src/components/error-boundary.tsx`         | 新增 | P1     | ~80      |
| `src/hooks/use-network-status.ts`           | 新增 | P1     | ~40      |
| `src/lib/utils/fetch-with-fallback.ts`      | 新增 | P2     | ~60      |
| `src/components/ui/lazy-image.tsx`          | 新增 | P3     | ~50      |
| `src/app/api/health/route.ts`               | 新增 | P3     | ~40      |

**总改动量**：~550 行代码

---

**方案制定人**: Claude Code
**方案日期**: 2025-12-13
**预计工时**: 5 人天
**核心理念**: 启动即显示，操作即响应，永不白屏
