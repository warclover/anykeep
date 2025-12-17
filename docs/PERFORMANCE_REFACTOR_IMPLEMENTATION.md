# AnyKeep 性能优化重构实施计划

**版本**: v1.0
**创建日期**: 2025-12-17
**基于**: [性能诊断报告](./PERFORMANCE_OPTIMIZATION_PLAN.md)
**状态**: 待审核

---

## 📋 实施概览

| 阶段    | 名称             | 工作量 | 风险 | 优先级 |
| ------- | ---------------- | ------ | ---- | ------ |
| Phase 1 | 死代码清理       | 0.5 天 | 低   | P0     |
| Phase 2 | Context 架构重构 | 2 天   | 中   | P0     |
| Phase 3 | 组件拆分重构     | 3 天   | 中   | P0     |
| Phase 4 | 缓存策略统一     | 1 天   | 低   | P1     |
| Phase 5 | 渲染优化         | 1 天   | 低   | P2     |

**总计**: 7.5 天

---

## Phase 1: 死代码清理 (0.5 天)

### 目标

移除 `home-page-client.tsx` 中的废弃代码，减少文件体积约 300 行。

### 任务清单

#### 1.1 删除废弃函数

**文件**: `src/components/home/home-page-client.tsx`

```typescript
// 删除以下代码块：

// 1. 废弃的 fetch 函数 (约 40 行)
// 位置: 第 575-616 行
const _fetchBookmarks = useCallback(...);

// 2. 废弃的平台切换处理 (约 90 行)
// 位置: 第 710-796 行
const _handlePlatformChangeOld = useCallback(...);

// 3. 废弃的排序处理 (约 70 行)
// 位置: 第 798-865 行
const _handleSortChangeOld = async (...);
```

#### 1.2 移除废弃 Hook 引用

```typescript
// 删除以下代码：

// 1. 移除 usePlatformCache 引用 (第 564-570 行)
const {
  getCache: _getCacheOld,
  setCache: _setCacheOld,
  updateCacheItem: _updateCacheItemOld,
  removeCacheItem: _removeCacheItemOld,
  appendToCache: _appendToCacheOld,
} = usePlatformCache();

// 2. 移除未使用的 SWR 解构变量
// 将:
const {
  isValidating: _isValidating,
  isStale: _isStale,
  error: _swrError,
  // ...
} = useBookmarksSWR({...});

// 改为:
const {
  // 只保留实际使用的变量
  data: bookmarks,
  hasMore,
  isLoading: isInitialLoading,
  mutate: mutateBookmarks,
  setHasMore,
  updateCacheItem,
  removeCacheItem,
  appendToCache,
} = useBookmarksSWR({...});
```

#### 1.3 清理未使用的导入

```typescript
// 检查并移除未使用的 import
// 使用 ESLint 或 IDE 的 "Organize Imports" 功能
```

### 验收标准

- [ ] 文件行数从 1787 减少至 ~1400
- [ ] `npm run lint` 通过
- [ ] `npm run type-check` 通过
- [ ] 首页功能正常（平台切换、排序、加载更多）

### 回滚方案

```bash
git checkout HEAD -- src/components/home/home-page-client.tsx
```

---

## Phase 2: Context 架构重构 (2 天)

### 目标

使用 React Context 替代 Window Event 通信模式，建立可预测的数据流。

### 任务清单

#### 2.1 创建 HomePageContext

**新建文件**: `src/contexts/home-page-context.tsx`

```typescript
/**
 * 首页状态上下文
 * @description 替代 window event 通信模式，提供可预测的状态管理
 * @version 1.0.0
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

// ============================================
// 类型定义
// ============================================

export type ViewMode = "card" | "list" | "compact";
export type LayoutMode = "auto" | "row" | "column";

interface HomePageState {
  // 视图状态
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;

  // 筛选状态
  platform: string;
  folder: string;
  usageTags: string[];

  // 选择模式
  isSelectionMode: boolean;
  selectedIds: Set<number>;

  // 对话框状态
  dialogs: {
    create: boolean;
    import: boolean;
    browserImport: boolean;
    export: boolean;
    move: boolean;
  };
}

interface HomePageActions {
  // 视图操作
  setViewMode: (mode: ViewMode) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleFlipCard: () => void;

  // 筛选操作
  setPlatform: (platform: string) => void;
  setFolder: (folder: string) => void;
  setUsageTags: (tags: string[]) => void;

  // 选择模式操作
  toggleSelectionMode: () => void;
  toggleSelect: (id: number) => void;
  selectAll: (ids: number[]) => void;
  deselectAll: () => void;

  // 对话框操作
  openDialog: (name: keyof HomePageState["dialogs"]) => void;
  closeDialog: (name: keyof HomePageState["dialogs"]) => void;
}

type HomePageContextType = HomePageState & HomePageActions;

// ============================================
// Context 创建
// ============================================

const HomePageContext = createContext<HomePageContextType | null>(null);

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  viewMode: "anykeep-view-mode",
  layoutMode: "anykeep-layout-mode",
  flipCard: "anykeep-flip-card",
} as const;

// ============================================
// Provider 实现
// ============================================

interface HomePageProviderProps {
  children: ReactNode;
  initialPlatform?: string;
  initialFolder?: string;
  initialUsageTags?: string[];
}

export function HomePageProvider({
  children,
  initialPlatform = "",
  initialFolder = "",
  initialUsageTags = [],
}: HomePageProviderProps) {
  // 从 localStorage 初始化视图状态
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "card";
    const saved = localStorage.getItem(STORAGE_KEYS.viewMode);
    return (saved as ViewMode) || "card";
  });

  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => {
    if (typeof window === "undefined") return "auto";
    const saved = localStorage.getItem(STORAGE_KEYS.layoutMode);
    return (saved as LayoutMode) || "auto";
  });

  const [enableFlipCard, setEnableFlipCard] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEYS.flipCard) === "true";
  });

  // 筛选状态
  const [platform, setPlatformState] = useState(initialPlatform);
  const [folder, setFolderState] = useState(initialFolder);
  const [usageTags, setUsageTagsState] = useState<string[]>(initialUsageTags);

  // 选择模式状态
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 对话框状态
  const [dialogs, setDialogs] = useState({
    create: false,
    import: false,
    browserImport: false,
    export: false,
    move: false,
  });

  // ========== Actions ==========

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(STORAGE_KEYS.viewMode, mode);
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem(STORAGE_KEYS.layoutMode, mode);
  }, []);

  const toggleFlipCard = useCallback(() => {
    setEnableFlipCard((prev) => {
      const newValue = !prev;
      localStorage.setItem(STORAGE_KEYS.flipCard, String(newValue));
      return newValue;
    });
  }, []);

  const setPlatform = useCallback((value: string) => {
    setPlatformState(value);
    setFolderState(""); // 切换平台时清除文件夹
  }, []);

  const setFolder = useCallback((value: string) => {
    setFolderState(value);
  }, []);

  const setUsageTags = useCallback((tags: string[]) => {
    setUsageTagsState(tags);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        setSelectedIds(new Set()); // 退出时清空选择
      }
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const openDialog = useCallback((name: keyof typeof dialogs) => {
    setDialogs((prev) => ({ ...prev, [name]: true }));
  }, []);

  const closeDialog = useCallback((name: keyof typeof dialogs) => {
    setDialogs((prev) => ({ ...prev, [name]: false }));
  }, []);

  // ========== Context Value ==========

  const value = useMemo<HomePageContextType>(
    () => ({
      // State
      viewMode,
      layoutMode,
      enableFlipCard,
      platform,
      folder,
      usageTags,
      isSelectionMode,
      selectedIds,
      dialogs,
      // Actions
      setViewMode,
      setLayoutMode,
      toggleFlipCard,
      setPlatform,
      setFolder,
      setUsageTags,
      toggleSelectionMode,
      toggleSelect,
      selectAll,
      deselectAll,
      openDialog,
      closeDialog,
    }),
    [
      viewMode,
      layoutMode,
      enableFlipCard,
      platform,
      folder,
      usageTags,
      isSelectionMode,
      selectedIds,
      dialogs,
      setViewMode,
      setLayoutMode,
      toggleFlipCard,
      setPlatform,
      setFolder,
      setUsageTags,
      toggleSelectionMode,
      toggleSelect,
      selectAll,
      deselectAll,
      openDialog,
      closeDialog,
    ]
  );

  return (
    <HomePageContext.Provider value={value}>
      {children}
    </HomePageContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useHomePage() {
  const context = useContext(HomePageContext);
  if (!context) {
    throw new Error("useHomePage must be used within a HomePageProvider");
  }
  return context;
}

// 便捷 hooks
export function useHomeViewMode() {
  const { viewMode, layoutMode, enableFlipCard, setViewMode, setLayoutMode, toggleFlipCard } = useHomePage();
  return { viewMode, layoutMode, enableFlipCard, setViewMode, setLayoutMode, toggleFlipCard };
}

export function useHomeFilters() {
  const { platform, folder, usageTags, setPlatform, setFolder, setUsageTags } = useHomePage();
  return { platform, folder, usageTags, setPlatform, setFolder, setUsageTags };
}

export function useHomeSelection() {
  const { isSelectionMode, selectedIds, toggleSelectionMode, toggleSelect, selectAll, deselectAll } = useHomePage();
  return { isSelectionMode, selectedIds, toggleSelectionMode, toggleSelect, selectAll, deselectAll };
}

export function useHomeDialogs() {
  const { dialogs, openDialog, closeDialog } = useHomePage();
  return { dialogs, openDialog, closeDialog };
}
```

#### 2.2 更新 Layout 添加 Provider

**修改文件**: `src/app/(main)/home/layout.tsx` 或创建新布局

```typescript
import { HomePageProvider } from "@/contexts/home-page-context";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <HomePageProvider>
      {children}
    </HomePageProvider>
  );
}
```

#### 2.3 重构 PlatformFilter 使用 Context

**修改文件**: `src/components/layout/platform-filter.tsx`

```typescript
// 移除 window event 代码
// 改用 useHomeFilters hook

import { useHomeFilters, useHomeViewMode } from "@/contexts/home-page-context";

export function PlatformFilter() {
  const { platform, setPlatform } = useHomeFilters();
  const { viewMode, enableFlipCard, toggleFlipCard } = useHomeViewMode();

  const handlePlatformChange = (platformValue: string, href: string | null) => {
    if (href) {
      router.push(href);
      return;
    }
    if (platformValue === platform) return;

    // 直接调用 Context action，无需 window.dispatchEvent
    setPlatform(platformValue);

    // URL 同步
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("folder");
    if (platformValue) {
      params.set("platform", platformValue);
    } else {
      params.delete("platform");
    }
    window.history.replaceState({}, "", `/home?${params.toString()}`);
  };

  // 移除所有 window.addEventListener/dispatchEvent 代码
  // ...
}
```

#### 2.4 重构 HeaderMenu 使用 Context

**修改文件**: `src/components/layout/header-menu.tsx`

```typescript
import {
  useHomeViewMode,
  useHomeDialogs,
  useHomeSelection,
} from "@/contexts/home-page-context";

export function HeaderMenu() {
  const { viewMode, setViewMode, layoutMode, setLayoutMode } =
    useHomeViewMode();
  const { openDialog } = useHomeDialogs();
  const { toggleSelectionMode } = useHomeSelection();

  // 移除所有 window.dispatchEvent 调用
  // 直接使用 Context actions
}
```

### 验收标准

- [ ] 所有 `window.addEventListener` 从相关组件中移除
- [ ] 所有 `window.dispatchEvent` 从相关组件中移除
- [ ] Context 正确传递状态
- [ ] 平台切换、视图切换、对话框功能正常
- [ ] `npm run lint` 通过

### 回滚方案

```bash
git checkout HEAD -- src/components/layout/platform-filter.tsx
git checkout HEAD -- src/components/layout/header-menu.tsx
rm src/contexts/home-page-context.tsx
```

---

## Phase 3: 组件拆分重构 (3 天)

### 目标

将 1400+ 行的 `home-page-client.tsx` 拆分为多个职责单一的子组件。

### 目标架构

```
src/components/home/
├── home-page-client.tsx      (~200 行，组件容器)
├── components/
│   ├── HomeToolbar.tsx       (~150 行，工具栏)
│   ├── HomeBookmarkGrid.tsx  (~200 行，书签网格)
│   ├── HomeBatchActions.tsx  (~100 行，批量操作)
│   ├── HomeDialogs.tsx       (~150 行，对话框容器)
│   ├── HomeLoadingState.tsx  (~50 行，加载状态)
│   └── HomeBanners.tsx       (~100 行，横幅组件)
├── hooks/
│   └── useHomeBookmarks.ts   (~150 行，书签数据管理)
└── constants.ts              (现有，保持不变)
```

### 任务清单

#### 3.1 创建 useHomeBookmarks Hook

**新建文件**: `src/components/home/hooks/useHomeBookmarks.ts`

```typescript
/**
 * 首页书签数据管理 Hook
 * @description 整合书签获取、轮询、乐观更新逻辑
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useInitData } from "@/hooks/use-init-data";
import { useBookmarksSWR, cachePerformanceTracker } from "@/lib/cache";
import { useProcessingPoller } from "@/hooks/use-processing-poller";
import { useClassificationPolling } from "@/hooks/use-classification-polling";
import type { Bookmark } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface UseHomeBookmarksOptions {
  platform: string;
  sort: string;
  folder: string;
  usageTags: string[];
  initialBookmarks?: BookmarkWithFolder[];
}

export function useHomeBookmarks(options: UseHomeBookmarksOptions) {
  const { platform, sort, folder, usageTags, initialBookmarks } = options;

  // 判断是否使用聚合 API
  const shouldUseInitData =
    !initialBookmarks?.length && !platform && !folder && !usageTags.length;

  // 聚合数据获取
  const { bookmarks: initBookmarks, isLoading: isInitDataLoading } =
    useInitData({
      enabled: shouldUseInitData,
    });

  // 有效初始数据
  const effectiveInitialData = initialBookmarks?.length
    ? initialBookmarks
    : initBookmarks.length
      ? initBookmarks
      : undefined;

  // SWR 数据获取
  const {
    data: bookmarks,
    hasMore,
    isLoading,
    mutate: mutateBookmarks,
    setHasMore,
    updateCacheItem,
    removeCacheItem,
    appendToCache,
  } = useBookmarksSWR({
    platform,
    sort,
    folder,
    usageTags,
    initialData: effectiveInitialData,
    enabled: !shouldUseInitData || !isInitDataLoading,
  });

  // 性能追踪
  const hasTrackedFirstRenderRef = useRef(false);
  useEffect(() => {
    if (bookmarks.length > 0 && !hasTrackedFirstRenderRef.current) {
      hasTrackedFirstRenderRef.current = true;
      cachePerformanceTracker.markFirstRender("data-cache");
      setTimeout(() => {
        cachePerformanceTracker.endSession("data-cache");
      }, 100);
    }
  }, [bookmarks]);

  // 处理中书签轮询
  useProcessingPoller({
    bookmarks,
    onUpdate: useCallback(
      (updatedBookmark: BookmarkWithFolder) => {
        mutateBookmarks((prev) =>
          prev.map((b) => (b.id === updatedBookmark.id ? updatedBookmark : b)),
        );
      },
      [mutateBookmarks],
    ),
    enabled: !isLoading,
  });

  // 分类轮询
  const { trackBookmark } = useClassificationPolling();

  // 删除书签
  const deleteBookmark = useCallback(
    async (id: number) => {
      const snapshot = [...bookmarks];
      try {
        mutateBookmarks((prev) => prev.filter((b) => b.id !== id));
        removeCacheItem(id);

        const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
        if (!res.ok) {
          throw new Error("删除失败");
        }
      } catch {
        mutateBookmarks(snapshot);
        throw new Error("删除失败");
      }
    },
    [bookmarks, mutateBookmarks, removeCacheItem],
  );

  // 添加书签
  const addBookmark = useCallback(
    (bookmark: BookmarkWithFolder) => {
      mutateBookmarks((prev) => [bookmark, ...prev]);
      appendToCache(bookmark);
      if (!bookmark.folder_id) {
        trackBookmark(bookmark.id);
      }
    },
    [mutateBookmarks, appendToCache, trackBookmark],
  );

  return {
    bookmarks,
    hasMore,
    isLoading: isLoading || isInitDataLoading,
    setBookmarks: mutateBookmarks,
    setHasMore,
    updateCacheItem,
    deleteBookmark,
    addBookmark,
  };
}
```

#### 3.2 创建 HomeToolbar 组件

**新建文件**: `src/components/home/components/HomeToolbar.tsx`

```typescript
/**
 * 首页工具栏组件
 * @description 包含排序、视图切换、操作按钮
 */

"use client";

import { memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  List,
  AlignJustify,
  Rows3,
  Columns3,
  ArrowUpDown,
  Plus,
  CheckSquare,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHomeViewMode, useHomeDialogs, useHomeSelection } from "@/contexts/home-page-context";
import { SORT_OPTIONS } from "../constants";
import { cn } from "@/lib/utils";

interface HomeToolbarProps {
  currentSort: string;
  isBrowserPlatform: boolean;
  bookmarkCount: number;
}

export const HomeToolbar = memo(function HomeToolbar({
  currentSort,
  isBrowserPlatform,
  bookmarkCount,
}: HomeToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { viewMode, setViewMode, layoutMode, setLayoutMode } = useHomeViewMode();
  const { openDialog } = useHomeDialogs();
  const { isSelectionMode, toggleSelectionMode } = useHomeSelection();

  const handleSortChange = (sortValue: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sort", sortValue);
    router.replace(`/home?${params.toString()}`);
  };

  // 浏览器书签固定使用列表视图
  const effectiveViewMode = isBrowserPlatform ? "list" : viewMode;

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      {/* 左侧：排序 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowUpDown className="size-4" />
            <span className="hidden sm:inline">
              {SORT_OPTIONS.find((o) => o.value === currentSort)?.label || "排序"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              className={cn(currentSort === option.value && "bg-accent")}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-1">
        {/* 视图切换（非浏览器平台） */}
        {!isBrowserPlatform && (
          <div className="hidden sm:flex items-center border rounded-lg p-0.5">
            <Button
              variant={effectiveViewMode === "card" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("card")}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={effectiveViewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("list")}
            >
              <List className="size-4" />
            </Button>
            <Button
              variant={effectiveViewMode === "compact" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode("compact")}
            >
              <AlignJustify className="size-4" />
            </Button>
          </div>
        )}

        {/* 批量选择 */}
        {bookmarkCount > 0 && (
          <Button
            variant={isSelectionMode ? "secondary" : "ghost"}
            size="sm"
            onClick={toggleSelectionMode}
          >
            <CheckSquare className="size-4" />
          </Button>
        )}

        {/* 新建按钮 */}
        <Button size="sm" onClick={() => openDialog("create")}>
          <Plus className="size-4 mr-1" />
          <span className="hidden sm:inline">新建</span>
        </Button>

        {/* 更多菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openDialog("import")}>
              批量导入
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog("browserImport")}>
              导入浏览器书签
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog("export")}>
              导出数据
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
```

#### 3.3 创建 HomeBookmarkGrid 组件

**新建文件**: `src/components/home/components/HomeBookmarkGrid.tsx`

```typescript
/**
 * 书签网格/列表组件
 * @description 根据视图模式渲染书签
 */

"use client";

import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BookmarkCard } from "@/components/bookmark/bookmark-card";
import { FlipBookmarkCard } from "@/components/bookmark/bookmark-card-flip";
import { BrowserBookmarkVirtualList } from "@/components/bookmark/browser-bookmark-virtual-list";
import { VirtualBookmarkList } from "@/components/bookmark/virtual-bookmark-list";
import { useHomeViewMode, useHomeSelection } from "@/contexts/home-page-context";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface HomeBookmarkGridProps {
  bookmarks: BookmarkWithFolder[];
  isBrowserPlatform: boolean;
  isTrashFolder: boolean;
  onDelete: (id: number) => Promise<void>;
  onLoadMore?: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

export const HomeBookmarkGrid = memo(function HomeBookmarkGrid({
  bookmarks,
  isBrowserPlatform,
  isTrashFolder,
  onDelete,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: HomeBookmarkGridProps) {
  const router = useRouter();
  const { viewMode, layoutMode, enableFlipCard } = useHomeViewMode();
  const { isSelectionMode, selectedIds, toggleSelect } = useHomeSelection();

  const handleEdit = useCallback(
    (id: number) => {
      router.push(`/bookmark/${id}`);
    },
    [router]
  );

  // 浏览器书签使用虚拟滚动列表
  if (isBrowserPlatform) {
    return (
      <BrowserBookmarkVirtualList
        bookmarks={bookmarks}
        onEdit={handleEdit}
        onDelete={onDelete}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />
    );
  }

  // 列表/紧凑视图使用虚拟滚动
  if (viewMode === "list" || viewMode === "compact") {
    return (
      <VirtualBookmarkList
        bookmarks={bookmarks}
        viewMode={viewMode}
        onEdit={handleEdit}
        onDelete={onDelete}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        isLoadingMore={isLoadingMore}
      />
    );
  }

  // 卡片视图
  const gridClassName = cn(
    "masonry-grid",
    layoutMode === "row" && "layout-row",
    layoutMode === "column" && "layout-column"
  );

  const CardComponent = enableFlipCard ? FlipBookmarkCard : BookmarkCard;

  return (
    <div className={gridClassName}>
      {bookmarks.map((bookmark) => (
        <CardComponent
          key={bookmark.id}
          bookmark={bookmark}
          onEdit={() => handleEdit(bookmark.id)}
          onDelete={() => onDelete(bookmark.id)}
          isSelected={selectedIds.has(bookmark.id)}
          onToggleSelect={isSelectionMode ? () => toggleSelect(bookmark.id) : undefined}
          showFolder
        />
      ))}
    </div>
  );
});
```

#### 3.4 创建 HomeDialogs 组件

**新建文件**: `src/components/home/components/HomeDialogs.tsx`

```typescript
/**
 * 首页对话框容器
 * @description 懒加载所有对话框组件
 */

"use client";

import { lazy, Suspense, memo } from "react";
import { useHomeDialogs } from "@/contexts/home-page-context";

// 懒加载对话框
const CreateBookmarkDrawer = lazy(() =>
  import("@/components/bookmark/create-bookmark-drawer").then((mod) => ({
    default: mod.CreateBookmarkDrawer,
  }))
);

const BatchImportDialog = lazy(() =>
  import("@/components/bookmark/batch-import-dialog").then((mod) => ({
    default: mod.BatchImportDialog,
  }))
);

const BatchMoveDialog = lazy(() =>
  import("@/components/bookmark/batch-move-dialog").then((mod) => ({
    default: mod.BatchMoveDialog,
  }))
);

const ExportDialog = lazy(() =>
  import("@/components/bookmark/export-dialog").then((mod) => ({
    default: mod.ExportDialog,
  }))
);

const BrowserBookmarkImportDialog = lazy(() =>
  import("@/components/browser-bookmark").then((mod) => ({
    default: mod.BrowserBookmarkImportDialog,
  }))
);

interface HomeDialogsProps {
  onBookmarkCreated?: (bookmark: { id: number; title: string; folder_id?: number | null }) => void;
  selectedBookmarkIds?: number[];
}

export const HomeDialogs = memo(function HomeDialogs({
  onBookmarkCreated,
  selectedBookmarkIds = [],
}: HomeDialogsProps) {
  const { dialogs, closeDialog } = useHomeDialogs();

  return (
    <Suspense fallback={null}>
      {/* 新建收藏 */}
      {dialogs.create && (
        <CreateBookmarkDrawer
          open={dialogs.create}
          onOpenChange={(open) => !open && closeDialog("create")}
          onSuccess={onBookmarkCreated}
        />
      )}

      {/* 批量导入 */}
      {dialogs.import && (
        <BatchImportDialog
          open={dialogs.import}
          onOpenChange={(open) => !open && closeDialog("import")}
        />
      )}

      {/* 浏览器书签导入 */}
      {dialogs.browserImport && (
        <BrowserBookmarkImportDialog
          open={dialogs.browserImport}
          onOpenChange={(open) => !open && closeDialog("browserImport")}
        />
      )}

      {/* 导出 */}
      {dialogs.export && (
        <ExportDialog
          open={dialogs.export}
          onOpenChange={(open) => !open && closeDialog("export")}
        />
      )}

      {/* 批量移动 */}
      {dialogs.move && selectedBookmarkIds.length > 0 && (
        <BatchMoveDialog
          open={dialogs.move}
          onOpenChange={(open) => !open && closeDialog("move")}
          bookmarkIds={selectedBookmarkIds}
        />
      )}
    </Suspense>
  );
});
```

#### 3.5 重构 HomePageClient 主组件

**修改文件**: `src/components/home/home-page-client.tsx`

```typescript
/**
 * 首页客户端组件（重构后）
 * @description 组件容器，组合子组件
 * @version 2.0.0
 */

"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Context
import { useHomeFilters, useHomeSelection } from "@/contexts/home-page-context";

// Hooks
import { useHomeBookmarks } from "./hooks/useHomeBookmarks";
import { prefetchCustomUsageTags } from "@/hooks/use-custom-usage-tags";

// Components
import { HomeToolbar } from "./components/HomeToolbar";
import { HomeBookmarkGrid } from "./components/HomeBookmarkGrid";
import { HomeDialogs } from "./components/HomeDialogs";
import { EmptyState } from "@/components/bookmark/empty-state";
import { BrowserBookmarkEmptyState } from "@/components/bookmark/browser-bookmark-empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import { SmartListView } from "@/components/smart-list";

import type { Bookmark } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface HomePageClientProps {
  initialBookmarks?: BookmarkWithFolder[];
  error?: string;
  urlFolder?: string;
  urlPlatform?: string;
  smartListId?: number | null;
}

export function HomePageClient({
  initialBookmarks,
  error,
  urlFolder: propFolder,
  urlPlatform: propPlatform,
  smartListId,
}: HomePageClientProps = {}) {
  const searchParams = useSearchParams();

  // 预加载自定义用途标签
  useEffect(() => {
    prefetchCustomUsageTags();
  }, []);

  // Context 状态
  const { platform, folder, usageTags, setPlatform, setFolder, setUsageTags } = useHomeFilters();
  const { selectedIds } = useHomeSelection();

  // 同步 URL 参数到 Context
  useEffect(() => {
    const urlPlatform = propPlatform ?? searchParams?.get("platform") ?? "";
    const urlFolder = propFolder ?? searchParams?.get("folder") ?? "";
    const urlUsageTags = searchParams?.get("usageTags") || "";

    if (urlPlatform !== platform) setPlatform(urlPlatform);
    if (urlFolder !== folder) setFolder(urlFolder);

    const newUsageTags = urlUsageTags ? urlUsageTags.split(",").filter(Boolean) : [];
    if (JSON.stringify(newUsageTags) !== JSON.stringify(usageTags)) {
      setUsageTags(newUsageTags);
    }
  }, [propPlatform, propFolder, searchParams, platform, folder, usageTags, setPlatform, setFolder, setUsageTags]);

  // 当前排序
  const currentSort = searchParams?.get("sort") || "created_desc";

  // 书签数据
  const {
    bookmarks,
    hasMore,
    isLoading,
    deleteBookmark,
    addBookmark,
  } = useHomeBookmarks({
    platform,
    sort: currentSort,
    folder,
    usageTags,
    initialBookmarks,
  });

  // 智能列表模式
  const urlSmartListParam = searchParams?.get("smartList");
  const urlSmartListId = urlSmartListParam ? parseInt(urlSmartListParam, 10) : null;
  const currentSmartListId = urlSmartListId && !isNaN(urlSmartListId) ? urlSmartListId : smartListId;

  if (currentSmartListId) {
    return <SmartListView smartListId={currentSmartListId} />;
  }

  // 派生状态
  const isBrowserPlatform = platform === "browser";
  const isTrashFolder = folder === "trash";

  // 错误状态
  if (error) {
    return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 空状态
  if (bookmarks.length === 0) {
    if (isBrowserPlatform) {
      return <BrowserBookmarkEmptyState />;
    }
    return <EmptyState />;
  }

  // 新建书签回调
  const handleBookmarkCreated = (bookmark: { id: number; title: string; folder_id?: number | null }) => {
    // 只在当前筛选条件匹配时添加
    if (!platform && !folder) {
      addBookmark(bookmark as BookmarkWithFolder);
    }
    toast.success("收藏成功");
  };

  // 删除书签回调
  const handleDelete = async (id: number) => {
    try {
      await deleteBookmark(id);
      toast.success("删除成功");
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <HomeToolbar
        currentSort={currentSort}
        isBrowserPlatform={isBrowserPlatform}
        bookmarkCount={bookmarks.length}
      />

      {/* 书签网格 */}
      <HomeBookmarkGrid
        bookmarks={bookmarks}
        isBrowserPlatform={isBrowserPlatform}
        isTrashFolder={isTrashFolder}
        onDelete={handleDelete}
        hasMore={hasMore}
        isLoadingMore={false}
      />

      {/* 对话框 */}
      <HomeDialogs
        onBookmarkCreated={handleBookmarkCreated}
        selectedBookmarkIds={Array.from(selectedIds)}
      />
    </div>
  );
}

export default HomePageClient;
```

### 验收标准

- [ ] `home-page-client.tsx` 行数 < 250
- [ ] 所有子组件独立可测试
- [ ] 首页所有功能正常
- [ ] 无 TypeScript 错误
- [ ] 无 ESLint 警告

---

## Phase 4: 缓存策略统一 (1 天)

### 目标

移除冗余缓存系统，统一使用 SWR。

### 任务清单

#### 4.1 废弃 usePlatformCache

**修改文件**: `src/hooks/use-platform-cache.ts`

```typescript
/**
 * @deprecated 使用 useBookmarksSWR 替代
 * 此 hook 保留仅用于兼容性，将在下个版本移除
 */
export function usePlatformCache() {
  console.warn("usePlatformCache is deprecated. Use useBookmarksSWR instead.");

  return {
    getCache: () => null,
    setCache: () => {},
    updateCacheItem: () => {},
    removeCacheItem: () => {},
    appendToCache: () => {},
  };
}
```

#### 4.2 优化 useInitData 与 useBookmarksSWR 集成

**修改文件**: `src/hooks/use-init-data.ts`

```typescript
// 添加 SWR 全局缓存预热
import { mutate } from "swr";

export function useInitData(options: UseInitDataOptions = {}) {
  // ... 现有代码

  // 当聚合数据加载完成后，预热相关 SWR 缓存
  useEffect(() => {
    if (data) {
      // 预热书签缓存
      mutate("/api/bookmarks", data.bookmarks, { revalidate: false });
      // 预热文件夹缓存
      mutate("/api/folders", data.folders, { revalidate: false });
    }
  }, [data]);

  return { ... };
}
```

### 验收标准

- [ ] 首页只发出 1 个聚合请求（/api/init）
- [ ] 无重复请求
- [ ] 缓存正常工作

---

## Phase 5: 渲染优化 (1 天)

### 目标

添加 React 性能优化措施。

### 任务清单

#### 5.1 添加 React.memo

所有子组件已在 Phase 3 中使用 `memo` 包装。

#### 5.2 添加 useDeferredValue

```typescript
// 用于搜索输入等高频更新场景
import { useDeferredValue } from "react";

function SearchInput({ onSearch }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    onSearch(deferredQuery);
  }, [deferredQuery, onSearch]);

  return <Input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

#### 5.3 配置 Bundle Analyzer

```bash
npm install @next/bundle-analyzer --save-dev
```

```javascript
// next.config.mjs
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
```

### 验收标准

- [ ] React DevTools Profiler 无明显重渲染
- [ ] Bundle size 报告生成

---

## 🔄 回滚策略

### Git 分支策略

```bash
# 创建重构分支
git checkout -b refactor/home-page-performance

# 每个 Phase 完成后提交
git commit -m "refactor(Phase1): remove dead code from home-page-client"
git commit -m "refactor(Phase2): implement HomePageContext"
git commit -m "refactor(Phase3): split home-page-client into components"
git commit -m "refactor(Phase4): unify cache strategy with SWR"
git commit -m "refactor(Phase5): add React render optimizations"

# 完成后合并
git checkout feature/classification-v4.2
git merge refactor/home-page-performance
```

### 紧急回滚

```bash
# 回滚到重构前
git revert --no-commit HEAD~5..HEAD
git commit -m "revert: rollback home page refactoring"
```

---

## ✅ 审核清单

请确认以下事项后开始实施：

- [ ] 同意 Phase 1-5 的实施顺序
- [ ] 确认工作量估算可接受 (7.5 天)
- [ ] 同意创建 `HomePageContext` 架构
- [ ] 同意组件拆分方案
- [ ] 确认回滚策略可行

---

**文档版本**: v1.0
**审核状态**: 待确认
