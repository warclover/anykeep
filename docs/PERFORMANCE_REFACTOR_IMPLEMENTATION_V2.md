# AnyKeep 性能优化重构实施计划 V2

**版本**: v2.0 (稳健重构版)
**创建日期**: 2025-12-18
**基于**: 深度风险分析 + 历史重构教训
**状态**: 待审核

---

## 🔴 风险分析总结

### 发现的复杂性

| 维度          | 发现                                          | 风险等级 |
| ------------- | --------------------------------------------- | -------- |
| **事件网络**  | 40+ window events 跨 15+ 文件                 | 🔴 高    |
| **Hook 依赖** | home-page-client 导入 8 个核心 hooks          | 🔴 高    |
| **类型链**    | BookmarkWithFolder → Bookmark → Supabase 类型 | 🟡 中    |
| **缓存耦合**  | 4 套缓存系统互相调用                          | 🟡 中    |
| **部分重构**  | use-home-view-mode.ts 已提取但仍用 events     | 🟡 中    |

### 历史重构问题根因

```
问题链：
大规模代码移动
  → 类型推断失败
    → 手动修复类型
      → 引入隐式 any
        → 运行时数据不匹配
          → 功能异常
```

---

## 🛡️ 质量保障策略

### 策略 1: Strangler Fig Pattern (绞杀者模式)

**原则**: 不直接修改现有代码，而是在旁边构建新代码，逐步替换。

```
阶段演进：
┌─────────────────────────────────────────────────────────┐
│ Phase 0: 现状                                           │
│ ┌─────────────────────────────────────────────────┐    │
│ │           home-page-client.tsx (1787行)          │    │
│ │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │    │
│ │  │状态  │ │事件  │ │数据  │ │渲染  │ │对话框│  │    │
│ │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │    │
│ └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Phase 1: 添加适配层 (不修改原代码)                      │
│ ┌──────────────────┐  ┌─────────────────────────────┐  │
│ │ HomePageAdapter  │→ │ home-page-client.tsx        │  │
│ │ (新增，类型契约)  │  │ (保持不变)                  │  │
│ └──────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Phase 2: 并行运行 (Feature Flag)                       │
│ ┌──────────────────┐  ┌─────────────────────────────┐  │
│ │ HomePageV2       │  │ home-page-client.tsx        │  │
│ │ (新架构)         │  │ (旧代码，备用)              │  │
│ └────────┬─────────┘  └──────────────┬──────────────┘  │
│          │                           │                  │
│          └───────────┬───────────────┘                  │
│                      ▼                                  │
│              [Feature Flag 切换]                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Phase 3: 验证完成后移除旧代码                           │
│ ┌──────────────────────────────────────────────────┐   │
│ │ HomePageV2 (新架构，已验证)                       │   │
│ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │   │
│ │ │Context │ │Toolbar │ │Grid    │ │Dialogs │     │   │
│ │ └────────┘ └────────┘ └────────┘ └────────┘     │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ [已删除] home-page-client.tsx (旧代码)                  │
└─────────────────────────────────────────────────────────┘
```

### 策略 2: 类型契约优先

**原则**: 先定义接口，再实现代码。类型错误在编译期暴露，不留到运行时。

```typescript
// 1. 创建类型契约文件 (首先完成)
// src/components/home/types.ts

import type { Bookmark, Folder } from "@/types/supabase";

// 严格类型定义，不使用 any
export type BookmarkWithFolder = Bookmark & {
  folders: { name: string } | null; // 注意：去掉 ?，明确可空性
};

// Props 接口提前定义
export interface HomeToolbarProps {
  currentSort: string;
  isBrowserPlatform: boolean;
  bookmarkCount: number;
}

export interface HomeBookmarkGridProps {
  bookmarks: readonly BookmarkWithFolder[]; // readonly 防止意外修改
  isBrowserPlatform: boolean;
  isTrashFolder: boolean;
  onDelete: (id: number) => Promise<void>;
  onLoadMore?: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

// ... 所有组件 Props 提前定义
```

### 策略 3: 功能测试清单

**原则**: 重构前后，所有功能必须通过相同的测试清单。

```markdown
## 首页功能测试清单 (每个 Phase 完成后执行)

### A. 数据加载

- [ ] A1. 首页初始加载显示书签列表
- [ ] A2. 空状态正确显示（无书签时）
- [ ] A3. 加载状态显示骨架屏
- [ ] A4. 错误状态显示重试按钮

### B. 平台筛选

- [ ] B1. 点击「全部」显示非浏览器书签
- [ ] B2. 点击「微信」只显示微信书签
- [ ] B3. 点击「浏览器书签」切换到虚拟滚动列表
- [ ] B4. 切换平台后 URL 同步更新

### C. 排序功能

- [ ] C1. 按创建时间降序（默认）
- [ ] C2. 按创建时间升序
- [ ] C3. 按标题排序
- [ ] C4. 排序后 URL 同步更新

### D. 视图模式

- [ ] D1. 卡片视图正常渲染
- [ ] D2. 列表视图正常渲染
- [ ] D3. 紧凑视图正常渲染
- [ ] D4. 布局模式切换（自动/行/列）
- [ ] D5. 翻转卡片功能
- [ ] D6. 视图设置持久化到 localStorage

### E. 批量操作

- [ ] E1. 进入批量选择模式
- [ ] E2. 选择/取消选择书签
- [ ] E3. 全选功能
- [ ] E4. 批量删除
- [ ] E5. 批量移动
- [ ] E6. 退出批量模式

### F. 对话框功能

- [ ] F1. 新建收藏对话框打开/关闭
- [ ] F2. 批量导入对话框
- [ ] F3. 浏览器书签导入对话框
- [ ] F4. 导出对话框
- [ ] F5. 新建后书签出现在列表

### G. 数据同步

- [ ] G1. 删除书签后列表即时更新
- [ ] G2. 新建书签后列表即时更新
- [ ] G3. 编辑书签后返回列表数据更新
- [ ] G4. 刷新页面数据不丢失

### H. 虚拟滚动

- [ ] H1. 浏览器书签 1000+ 条流畅滚动
- [ ] H2. 滚动位置记忆

### I. 类型安全验证

- [ ] I1. `npm run type-check` 零错误
- [ ] I2. `npm run lint` 零警告
- [ ] I3. 无 `as any` 或 `// @ts-ignore` 新增
```

### 策略 4: 增量验证

**原则**: 每个小步骤都验证，不累积风险。

```bash
# 每次代码修改后的验证脚本
npm run type-check && npm run lint && npm run build

# 如果失败，立即回滚
git checkout -- .
```

---

## 📋 修订后的实施计划

### 总览

| 阶段    | 名称       | 工作量 | 策略         | 回滚复杂度 |
| ------- | ---------- | ------ | ------------ | ---------- |
| Phase 0 | 准备工作   | 0.5 天 | 类型契约     | 无风险     |
| Phase 1 | 安全清理   | 0.5 天 | 最小改动     | 简单       |
| Phase 2 | 适配层构建 | 1 天   | 绞杀者模式   | 简单       |
| Phase 3 | 渐进迁移   | 3 天   | Feature Flag | 中等       |
| Phase 4 | 验证与切换 | 1 天   | 双写对比     | 简单       |
| Phase 5 | 清理旧代码 | 0.5 天 | 确认后删除   | 不可逆     |

**总计**: 6.5 天 (比原计划减少 1 天，但质量提升)

---

## Phase 0: 准备工作 (0.5 天)

### 目标

建立类型契约和测试基线，为后续重构提供安全网。

### 0.1 创建类型契约文件

**新建文件**: `src/components/home/types.ts`

```typescript
/**
 * 首页组件类型定义
 * @description 所有首页相关组件的类型契约，重构时必须遵守
 * @version 1.0.0
 */

import type { Bookmark, Folder } from "@/types/supabase";

// ============================================
// 核心数据类型
// ============================================

/**
 * 带文件夹信息的书签
 * 注意：folders 可能为 null（未分类），但字段本身必须存在
 */
export type BookmarkWithFolder = Bookmark & {
  folders: { name: string } | null;
};

/**
 * 只读书签数组（防止组件意外修改）
 */
export type ReadonlyBookmarks = readonly BookmarkWithFolder[];

// ============================================
// 视图类型
// ============================================

export type ViewMode = "card" | "list" | "compact";
export type LayoutMode = "auto" | "row" | "column";

// ============================================
// Context 类型 (Phase 2 使用)
// ============================================

export interface HomePageState {
  // 视图
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;
  // 筛选
  platform: string;
  folder: string;
  usageTags: readonly string[];
  // 选择
  isSelectionMode: boolean;
  selectedIds: ReadonlySet<number>;
  // 对话框
  dialogs: Readonly<{
    create: boolean;
    import: boolean;
    browserImport: boolean;
    export: boolean;
    move: boolean;
  }>;
}

export interface HomePageActions {
  setViewMode: (mode: ViewMode) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleFlipCard: () => void;
  setPlatform: (platform: string) => void;
  setFolder: (folder: string) => void;
  setUsageTags: (tags: string[]) => void;
  toggleSelectionMode: () => void;
  toggleSelect: (id: number) => void;
  selectAll: (ids: number[]) => void;
  deselectAll: () => void;
  openDialog: (name: keyof HomePageState["dialogs"]) => void;
  closeDialog: (name: keyof HomePageState["dialogs"]) => void;
}

export type HomePageContextType = HomePageState & HomePageActions;

// ============================================
// 组件 Props 类型
// ============================================

export interface HomeToolbarProps {
  readonly currentSort: string;
  readonly isBrowserPlatform: boolean;
  readonly bookmarkCount: number;
}

export interface HomeBookmarkGridProps {
  readonly bookmarks: ReadonlyBookmarks;
  readonly isBrowserPlatform: boolean;
  readonly isTrashFolder: boolean;
  readonly onDelete: (id: number) => Promise<void>;
  readonly onLoadMore?: () => void;
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
}

export interface HomeDialogsProps {
  readonly onBookmarkCreated?: (bookmark: BookmarkWithFolder) => void;
  readonly selectedBookmarkIds?: readonly number[];
}

// ============================================
// Hook 返回类型
// ============================================

export interface UseHomeBookmarksReturn {
  readonly bookmarks: ReadonlyBookmarks;
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly setBookmarks: (
    updater: (prev: BookmarkWithFolder[]) => BookmarkWithFolder[],
  ) => void;
  readonly setHasMore: (hasMore: boolean) => void;
  readonly deleteBookmark: (id: number) => Promise<void>;
  readonly addBookmark: (bookmark: BookmarkWithFolder) => void;
  readonly updateBookmark: (
    id: number,
    updates: Partial<BookmarkWithFolder>,
  ) => void;
}
```

### 0.2 创建功能测试清单文件

**新建文件**: `docs/HOME_PAGE_TEST_CHECKLIST.md`

(内容同上方「策略 3: 功能测试清单」)

### 0.3 记录当前类型检查基线

```bash
# 记录当前类型检查状态
npm run type-check 2>&1 | tee docs/type-check-baseline.txt

# 记录当前 lint 状态
npm run lint 2>&1 | tee docs/lint-baseline.txt
```

### 验收标准

- [ ] `types.ts` 文件创建完成
- [ ] 测试清单文档创建完成
- [ ] 基线文件生成
- [ ] `npm run type-check` 通过（与基线一致）

---

## Phase 1: 安全清理 (0.5 天)

### 目标

删除明确无用的代码，不改变任何功能逻辑。

### 1.1 标记待删除代码（先标记，后删除）

**修改文件**: `src/components/home/home-page-client.tsx`

```typescript
// 步骤 1: 先添加 @deprecated 标记和 console.warn
// 这样可以在运行时确认代码确实未被调用

/** @deprecated V2.0 清理 - 待删除 */
const _fetchBookmarks = useCallback(
  async (...) => {
    console.warn("[DEPRECATED] _fetchBookmarks called - should not happen");
    // ... 原有代码
  },
  [...]
);

// 运行应用，确认控制台无 warn 输出
// 确认后再删除
```

### 1.2 安全删除确认流程

```bash
# 1. 添加 console.warn 标记
# 2. 运行开发服务器
npm run dev

# 3. 手动测试所有首页功能（按测试清单）
# 4. 确认控制台无 DEPRECATED 警告
# 5. 删除标记的代码
# 6. 验证
npm run type-check && npm run lint && npm run build
```

### 1.3 删除清单

| 代码位置                   | 行数范围 | 描述           | 确认未调用 |
| -------------------------- | -------- | -------------- | ---------- |
| `_fetchBookmarks`          | 575-616  | 废弃的获取函数 | [ ]        |
| `_handlePlatformChangeOld` | 710-796  | 旧平台切换     | [ ]        |
| `_handleSortChangeOld`     | 798-865  | 旧排序处理     | [ ]        |
| `usePlatformCache` 解构    | 564-570  | 旧缓存引用     | [ ]        |

### 验收标准

- [ ] 所有待删除代码已确认未被调用
- [ ] 删除后 `npm run type-check` 通过
- [ ] 删除后 `npm run lint` 通过
- [ ] 功能测试清单 A-I 全部通过
- [ ] 文件行数从 1787 减少到 ~1500

---

## Phase 2: 适配层构建 (1 天)

### 目标

创建新的 Context 和 Hook，但不修改现有组件。

### 2.1 创建 HomePageContext (与现有代码共存)

**新建文件**: `src/contexts/home-page-context.tsx`

```typescript
/**
 * 首页状态上下文 (V2)
 * @description 与现有 window event 系统并行运行
 * @version 2.0.0
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import type {
  ViewMode,
  LayoutMode,
  HomePageState,
  HomePageActions,
  HomePageContextType,
} from "@/components/home/types";

// ============================================
// Context
// ============================================

const HomePageContext = createContext<HomePageContextType | null>(null);

// ============================================
// Storage Keys (与现有保持一致!)
// ============================================

const STORAGE_KEYS = {
  viewMode: "anykeep-view-mode", // 必须与 constants.ts 一致
  layoutMode: "anykeep-layout-mode", // 必须与 constants.ts 一致
  flipCard: "anykeep-flip-card", // 必须与 constants.ts 一致
} as const;

// ============================================
// Provider
// ============================================

interface HomePageProviderProps {
  children: ReactNode;
  initialPlatform?: string;
  initialFolder?: string;
  initialUsageTags?: string[];
  /** 是否启用双向同步（与 window events） */
  enableEventBridge?: boolean;
}

export function HomePageProvider({
  children,
  initialPlatform = "",
  initialFolder = "",
  initialUsageTags = [],
  enableEventBridge = true, // 默认启用，保持兼容
}: HomePageProviderProps) {
  // ... 状态定义同 V1 计划

  // ========== Event Bridge ==========
  // 关键：与现有 window event 系统双向同步

  useEffect(() => {
    if (!enableEventBridge) return;

    // 监听旧系统的事件，同步到 Context
    const handleViewModeEvent = (e: CustomEvent<ViewMode>) => {
      setViewModeState(e.detail);
    };
    const handleLayoutModeEvent = (e: CustomEvent<LayoutMode>) => {
      setLayoutModeState(e.detail);
    };
    const handleFlipCardEvent = (e: CustomEvent<boolean>) => {
      setEnableFlipCard(e.detail);
    };
    const handlePlatformEvent = (
      e: CustomEvent<{ platform: string; folder: string }>,
    ) => {
      setPlatformState(e.detail.platform);
      setFolderState(e.detail.folder);
    };
    const handleUsageTagEvent = (e: CustomEvent<{ usageTags: string[] }>) => {
      setUsageTagsState(e.detail.usageTags);
    };

    // 订阅旧系统事件
    window.addEventListener(
      "viewModeChange",
      handleViewModeEvent as EventListener,
    );
    window.addEventListener(
      "layoutModeChange",
      handleLayoutModeEvent as EventListener,
    );
    window.addEventListener(
      "flipCardChange",
      handleFlipCardEvent as EventListener,
    );
    window.addEventListener(
      "platformChange",
      handlePlatformEvent as EventListener,
    );
    window.addEventListener(
      "usageTagFilterChange",
      handleUsageTagEvent as EventListener,
    );

    return () => {
      window.removeEventListener(
        "viewModeChange",
        handleViewModeEvent as EventListener,
      );
      window.removeEventListener(
        "layoutModeChange",
        handleLayoutModeEvent as EventListener,
      );
      window.removeEventListener(
        "flipCardChange",
        handleFlipCardEvent as EventListener,
      );
      window.removeEventListener(
        "platformChange",
        handlePlatformEvent as EventListener,
      );
      window.removeEventListener(
        "usageTagFilterChange",
        handleUsageTagEvent as EventListener,
      );
    };
  }, [enableEventBridge]);

  // ... 其余实现
}

// ============================================
// Hooks
// ============================================

export function useHomePage(): HomePageContextType {
  const context = useContext(HomePageContext);
  if (!context) {
    throw new Error("useHomePage must be used within HomePageProvider");
  }
  return context;
}

// 安全版本：在 Context 外部返回默认值而非抛错
export function useHomePageSafe(): HomePageContextType | null {
  return useContext(HomePageContext);
}
```

### 2.2 创建 useHomeBookmarks Hook

**新建文件**: `src/components/home/hooks/use-home-bookmarks.ts`

```typescript
/**
 * 首页书签数据管理 Hook (V2)
 * @description 整合数据获取逻辑，提供类型安全的接口
 */

import { useCallback, useEffect, useRef } from "react";
import { useInitData } from "@/hooks/use-init-data";
import { useBookmarksSWR, cachePerformanceTracker } from "@/lib/cache";
import { useProcessingPoller } from "@/hooks/use-processing-poller";
import { useClassificationPolling } from "@/hooks/use-classification-polling";
import type { BookmarkWithFolder, UseHomeBookmarksReturn } from "../types";

interface UseHomeBookmarksOptions {
  platform: string;
  sort: string;
  folder: string;
  usageTags: readonly string[];
  initialBookmarks?: readonly BookmarkWithFolder[];
}

export function useHomeBookmarks(
  options: UseHomeBookmarksOptions,
): UseHomeBookmarksReturn {
  const { platform, sort, folder, usageTags, initialBookmarks } = options;

  // ========== 数据获取逻辑 ==========
  // (与原 home-page-client.tsx 中的逻辑完全一致)

  const shouldUseInitData =
    !initialBookmarks?.length && !platform && !folder && !usageTags.length;

  const { bookmarks: initBookmarks, isLoading: isInitDataLoading } =
    useInitData({
      enabled: shouldUseInitData,
    });

  const effectiveInitialData = initialBookmarks?.length
    ? [...initialBookmarks] // 转换为可变数组
    : initBookmarks.length
      ? initBookmarks
      : undefined;

  const {
    data: bookmarks,
    hasMore,
    isLoading,
    error,
    mutate: mutateBookmarks,
    setHasMore,
    updateCacheItem,
    removeCacheItem,
    appendToCache,
  } = useBookmarksSWR({
    platform,
    sort,
    folder,
    usageTags: [...usageTags], // 转换为可变数组
    initialData: effectiveInitialData,
    enabled: !shouldUseInitData || !isInitDataLoading,
  });

  // ========== 性能追踪 ==========
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

  // ========== 处理中书签轮询 ==========
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

  // ========== 分类轮询 ==========
  const { trackBookmark } = useClassificationPolling();

  // ========== 操作方法 ==========

  const deleteBookmark = useCallback(
    async (id: number): Promise<void> => {
      const snapshot = [...bookmarks];
      try {
        mutateBookmarks((prev) => prev.filter((b) => b.id !== id));
        removeCacheItem(id);

        const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
        if (!res.ok) {
          throw new Error("删除失败");
        }
      } catch (err) {
        // 回滚
        mutateBookmarks(snapshot);
        throw err;
      }
    },
    [bookmarks, mutateBookmarks, removeCacheItem],
  );

  const addBookmark = useCallback(
    (bookmark: BookmarkWithFolder): void => {
      mutateBookmarks((prev) => [bookmark, ...prev]);
      appendToCache(bookmark);
      if (!bookmark.folder_id) {
        trackBookmark(bookmark.id);
      }
    },
    [mutateBookmarks, appendToCache, trackBookmark],
  );

  const updateBookmark = useCallback(
    (id: number, updates: Partial<BookmarkWithFolder>): void => {
      mutateBookmarks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      );
      updateCacheItem(id, updates);
    },
    [mutateBookmarks, updateCacheItem],
  );

  // ========== 返回 ==========
  return {
    bookmarks,
    hasMore,
    isLoading: isLoading || isInitDataLoading,
    error: error ?? null,
    setBookmarks: mutateBookmarks,
    setHasMore,
    deleteBookmark,
    addBookmark,
    updateBookmark,
  };
}
```

### 2.3 添加 Provider 到 Layout (不影响现有代码)

**修改文件**: `src/app/(main)/layout.tsx`

```typescript
import { HomePageProvider } from "@/contexts/home-page-context";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <HomePageProvider enableEventBridge={true}>
      {/* 现有布局代码保持不变 */}
      {children}
    </HomePageProvider>
  );
}
```

### 验收标准

- [ ] Context 创建完成，类型检查通过
- [ ] Hook 创建完成，类型检查通过
- [ ] Provider 添加后，现有功能完全正常
- [ ] Event Bridge 双向同步正常工作
- [ ] 功能测试清单全部通过

---

## Phase 3: 渐进迁移 (3 天)

### 目标

逐个组件迁移到新架构，每个迁移后立即验证。

### 3.1 Feature Flag 配置

**新建文件**: `src/lib/feature-flags.ts`

```typescript
/**
 * Feature Flags
 * 控制新旧代码切换
 */

export const FEATURE_FLAGS = {
  // 首页重构相关
  HOME_USE_CONTEXT: false, // Phase 3.2 后开启
  HOME_USE_NEW_TOOLBAR: false, // Phase 3.3 后开启
  HOME_USE_NEW_GRID: false, // Phase 3.4 后开启
  HOME_USE_NEW_DIALOGS: false, // Phase 3.5 后开启
} as const;

// 从环境变量读取（支持运行时切换）
export function getFeatureFlag(key: keyof typeof FEATURE_FLAGS): boolean {
  if (typeof window !== "undefined") {
    const override = localStorage.getItem(`ff_${key}`);
    if (override !== null) {
      return override === "true";
    }
  }
  return FEATURE_FLAGS[key];
}
```

### 3.2 迁移 HomePageClient 到 Context

**修改文件**: `src/components/home/home-page-client.tsx`

```typescript
// 添加 Feature Flag 条件渲染

import { getFeatureFlag } from "@/lib/feature-flags";
import { useHomePageSafe } from "@/contexts/home-page-context";

export function HomePageClient(props: HomePageClientProps) {
  // 尝试使用新 Context
  const homePageContext = useHomePageSafe();
  const useNewContext = getFeatureFlag("HOME_USE_CONTEXT") && homePageContext;

  // 根据 Feature Flag 选择数据源
  const platform = useNewContext ? homePageContext.platform : localPlatform;

  const folder = useNewContext ? homePageContext.folder : localFolder;

  // ... 其余代码保持不变，只替换数据源
}
```

### 3.3-3.5 逐个组件迁移

每个组件迁移遵循相同模式：

1. 创建新组件 `ComponentV2.tsx`
2. 在原位置添加 Feature Flag 切换
3. 验证新组件功能
4. 开启 Feature Flag
5. 监控 1-2 天确认无问题
6. 删除旧代码

### 验收标准 (每个子阶段)

- [ ] 新组件类型检查通过
- [ ] Feature Flag 关闭时，功能正常（旧代码）
- [ ] Feature Flag 开启时，功能正常（新代码）
- [ ] 功能测试清单全部通过

---

## Phase 4: 验证与切换 (1 天)

### 目标

全面验证新架构，逐步开启所有 Feature Flag。

### 4.1 双写对比验证

```typescript
// 临时添加对比逻辑
useEffect(() => {
  if (process.env.NODE_ENV === "development") {
    // 对比新旧 Context 数据
    console.log("[V2 对比]", {
      oldPlatform: localPlatform,
      newPlatform: homePageContext?.platform,
      match: localPlatform === homePageContext?.platform,
    });
  }
}, [localPlatform, homePageContext?.platform]);
```

### 4.2 Feature Flag 逐步开启

```bash
# 每开启一个 Flag，执行完整测试
localStorage.setItem("ff_HOME_USE_CONTEXT", "true");
# 测试 -> 确认 -> 下一个

localStorage.setItem("ff_HOME_USE_NEW_TOOLBAR", "true");
# 测试 -> 确认 -> 下一个

# ...
```

### 4.3 性能对比

```typescript
// 使用 React Profiler 对比渲染性能
<Profiler id="HomePageOld" onRender={onRenderCallback}>
  <HomePageClientOld {...props} />
</Profiler>

<Profiler id="HomePageNew" onRender={onRenderCallback}>
  <HomePageClientNew {...props} />
</Profiler>
```

### 验收标准

- [ ] 所有 Feature Flag 开启状态下，功能测试清单全部通过
- [ ] 性能对比显示新架构无退化
- [ ] 无控制台错误/警告
- [ ] 生产构建成功

---

## Phase 5: 清理旧代码 (0.5 天)

### 目标

移除所有旧代码和 Feature Flag。

### 5.1 删除旧代码

```bash
# 删除顺序（先确认 git status 干净）
rm src/components/home/home-page-client-old.tsx  # 如有备份
# 移除 Feature Flag 相关代码
# 移除 window event 相关代码
```

### 5.2 移除 Event Bridge

```typescript
// home-page-context.tsx
export function HomePageProvider({
  enableEventBridge = false, // 默认关闭
}: HomePageProviderProps) {
  // ...
}
```

### 5.3 更新文档

- 更新 CLAUDE.md 架构说明
- 更新 README.md

### 验收标准

- [ ] 无旧代码残留
- [ ] 无 Feature Flag 残留
- [ ] `npm run type-check` 通过
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过
- [ ] 功能测试清单全部通过
- [ ] 文档已更新

---

## 🔄 紧急回滚方案

### 任意阶段回滚

```bash
# 方案 A: Feature Flag 回滚（推荐）
# 关闭所有新功能 Flag，立即恢复旧代码
localStorage.setItem("ff_HOME_USE_CONTEXT", "false");
localStorage.setItem("ff_HOME_USE_NEW_TOOLBAR", "false");
# ...

# 方案 B: Git 回滚
git log --oneline -10  # 查看最近提交
git revert <commit-hash>  # 回滚特定提交

# 方案 C: 分支回滚
git checkout feature/classification-v4.2  # 回到重构前分支
```

---

## ✅ 修订后的审核清单

请确认以下事项：

### 策略确认

- [ ] 同意「绞杀者模式」渐进迁移策略
- [ ] 同意使用 Feature Flag 控制新旧代码切换
- [ ] 同意 Event Bridge 双向同步方案

### 质量保障确认

- [ ] 同意「类型契约优先」原则
- [ ] 同意每阶段执行功能测试清单
- [ ] 同意增量验证（每次修改后立即验证）

### 计划确认

- [ ] 同意 Phase 0-5 的阶段划分
- [ ] 同意 6.5 天工作量估算
- [ ] 同意回滚方案

### 风险接受

- [ ] 理解 Phase 5 后无法回滚
- [ ] 理解迁移期间存在代码冗余（双份代码）

---

**文档版本**: v2.0
**审核状态**: 待确认
