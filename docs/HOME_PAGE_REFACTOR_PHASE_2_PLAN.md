# 首页架构重构实施计划 - Phase 2.2-2.4

**基于**: [PERFORMANCE_REFACTOR_IMPLEMENTATION_V2.md](./PERFORMANCE_REFACTOR_IMPLEMENTATION_V2.md)
**制定日期**: 2025-12-18
**状态**: 待审核
**关联分支**: `refactor/home-page-performance`

---

## 📊 当前进度回顾

### 已完成阶段

| 阶段      | 名称         | 状态    | 交付物                                               |
| --------- | ------------ | ------- | ---------------------------------------------------- |
| Phase 0   | 类型契约准备 | ✅ 完成 | `types.ts` (510行), `HOME_PAGE_TEST_CHECKLIST.md`    |
| Phase 1   | 安全清理     | ✅ 完成 | 删除 217 行死代码，1787 → 1570 行                    |
| Phase 2.1 | 适配层构建   | ✅ 完成 | `HomePageContext`, `useHomeBookmarks`, Feature Flags |

### 待完成阶段

| 阶段          | 名称                      | 状态      | 预估工时 |
| ------------- | ------------------------- | --------- | -------- |
| **Phase 2.2** | 主组件集成 Hooks          | 🔴 待开始 | 2h       |
| **Phase 2.3** | 主组件拆分 (SRP)          | 🔴 待开始 | 4-6h     |
| **Phase 2.4** | 启用 Context + 移除旧系统 | 🔴 待开始 | 3h       |

---

## 🔍 当前问题诊断

### 问题 1: 新 Hooks 创建但未使用

**现状**: [use-home-view-mode.ts](../src/components/home/hooks/use-home-view-mode.ts) 和 [use-home-bookmarks.ts](../src/components/home/hooks/use-home-bookmarks.ts) 已创建，但主组件仍在内部管理相同状态。

```typescript
// home-page-client.tsx:231-238 - 应该被替换
const [viewMode, setViewMode] = useState<ViewMode>("card");
const [layoutMode, setLayoutMode] = useState<LayoutMode>("auto");
const [enableFlipCard, setEnableFlipCard] = useState(false);
```

**影响**: 代码重复 ~60 行，违反 DRY 原则。

### 问题 2: 主组件职责过重

**现状**: `home-page-client.tsx` 1570 行，承担 6+ 职责。

| 职责              | 行数      | 应拆分到                             |
| ----------------- | --------- | ------------------------------------ |
| 状态初始化        | 159-230   | `useHomeViewMode` (已有)             |
| Window Event 监听 | 240-375   | `HomePageContext` (已有)             |
| 数据获取          | 407-470   | `useHomeBookmarks` (已有)            |
| CRUD 操作         | 659-750   | `hooks/use-home-mutations.ts` (新建) |
| 批量操作          | 752-1051  | `hooks/use-home-batch.ts` (新建)     |
| 工具栏渲染        | 1061-1336 | `HomeToolbar.tsx` (新建)             |
| 内容区渲染        | 1338-1512 | `HomeContent.tsx` (新建)             |
| 对话框渲染        | 1514-1565 | `HomeDialogs.tsx` (新建)             |

### 问题 3: Window Event 系统未淘汰

**现状**: 主组件仍使用 10+ window event 监听器，Context Event Bridge 虽已就绪但未启用。

---

## 📋 Phase 2.2: 主组件集成已有 Hooks

### 目标

将已创建的 Hooks 集成到主组件，消除重复代码。

### 预估工时: 2 小时

### 2.2.1 集成 useHomeViewMode

**修改文件**: `src/components/home/home-page-client.tsx`

```typescript
// 修改前 (home-page-client.tsx:231-263)
const [viewMode, setViewMode] = useState<ViewMode>("card");
const [layoutMode, setLayoutMode] = useState<LayoutMode>("auto");
const [enableFlipCard, setEnableFlipCard] = useState(false);

useEffect(() => {
  const savedViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  // ... 约 30 行初始化逻辑
}, []);

// 修改后
import { useHomeViewMode } from "./hooks/use-home-view-mode";

const {
  viewMode,
  setViewMode,
  layoutMode,
  setLayoutMode,
  enableFlipCard,
  setEnableFlipCard,
  effectiveViewMode,
} = useHomeViewMode({ isBrowserPlatform });
```

**预期减少**: ~60 行

### 2.2.2 集成 useHomeBookmarks（可选，需评估）

> ⚠️ **风险评估**: `useHomeBookmarks` 目前设计为独立使用，与现有 SWR 集成方式有差异。建议先完成 2.2.1，验证后再决定是否集成。

**决策点**:

- [ ] A) 暂不集成，保持现有 SWR 调用方式 (推荐)
- [ ] B) 重构 useHomeBookmarks 适配现有调用模式

### 2.2.3 移除冗余的 Event 监听器

已被 Hook 内部处理的事件监听器可移除：

```typescript
// 可移除 (已在 useHomeViewMode 内部处理)
window.addEventListener("viewModeChange", handleViewModeChangeEvent);
window.addEventListener("layoutModeChange", handleLayoutModeChangeEvent);
window.addEventListener("flipCardChange", handleFlipCardChange);
```

**预期减少**: ~30 行

### 验收标准

- [ ] `npm run type-check` 零错误
- [ ] `npm run lint` 零警告
- [ ] 功能测试清单 1.1-1.3 (视图模式) 全部通过
- [ ] 代码行数减少 80-100 行 (1570 → ~1480)

---

## 📋 Phase 2.3: 主组件拆分 (SRP)

### 目标

将主组件拆分为多个职责单一的子组件，提高可维护性。

### 预估工时: 4-6 小时

### 2.3.1 创建 CRUD 操作 Hook

**新建文件**: `src/components/home/hooks/use-home-mutations.ts`

```typescript
/**
 * 首页书签 CRUD 操作 Hook
 *
 * 职责：单个书签的增删改操作
 * 特性：乐观更新 + 失败回滚
 */

import { useCallback } from "react";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";
import { toast } from "sonner";
import type { BookmarkWithFolder } from "../types";

interface UseHomeMutationsOptions {
  /** 获取当前书签列表（用于快照） */
  getBookmarks: () => BookmarkWithFolder[];
  /** 更新书签列表 */
  setBookmarks: (
    updater: (prev: BookmarkWithFolder[]) => BookmarkWithFolder[],
  ) => void;
  /** 更新缓存单项 */
  updateCacheItem?: (
    id: number,
    updater: (b: BookmarkWithFolder) => BookmarkWithFolder,
  ) => void;
  /** 移除缓存单项 */
  removeCacheItem?: (id: number) => void;
}

export interface UseHomeMutationsReturn {
  /** 删除书签 */
  handleDelete: (id: number) => Promise<void>;
  /** 恢复书签 */
  handleRestore: (id: number) => Promise<void>;
  /** 永久删除 */
  handlePermanentDelete: (id: number) => Promise<void>;
  /** 切换已读状态 */
  handleToggleRead: (id: number, isRead: boolean) => Promise<void>;
  /** 编辑书签（跳转） */
  handleEdit: (id: number) => void;
}

export function useHomeMutations(
  options: UseHomeMutationsOptions,
): UseHomeMutationsReturn {
  const { getBookmarks, setBookmarks, updateCacheItem, removeCacheItem } =
    options;
  const { fetchWithAbort } = useAbortableFetch();

  const handleDelete = useCallback(
    async (id: number) => {
      const snapshot = getBookmarks();
      try {
        // 乐观更新
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
        removeCacheItem?.(id);

        const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "删除失败");
        }
        toast.success("删除成功");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    },
    [getBookmarks, setBookmarks, removeCacheItem, fetchWithAbort],
  );

  const handleRestore = useCallback(
    async (id: number) => {
      const snapshot = getBookmarks();
      try {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
        const res = await fetchWithAbort(`/api/bookmarks/${id}/restore`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "恢复失败");
        }
        toast.success("已恢复收藏");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "恢复失败");
      }
    },
    [getBookmarks, setBookmarks, fetchWithAbort],
  );

  const handlePermanentDelete = useCallback(
    async (id: number) => {
      const snapshot = getBookmarks();
      try {
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
        const res = await fetchWithAbort(`/api/bookmarks/${id}/permanent`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "永久删除失败");
        }
        toast.success("已永久删除");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "永久删除失败");
      }
    },
    [getBookmarks, setBookmarks, fetchWithAbort],
  );

  const handleToggleRead = useCallback(
    async (id: number, isRead: boolean) => {
      const snapshot = getBookmarks();
      try {
        setBookmarks((prev) =>
          prev.map((b) =>
            b.id === id
              ? {
                  ...b,
                  is_read: isRead,
                  read_at: isRead ? new Date().toISOString() : null,
                }
              : b,
          ),
        );
        updateCacheItem?.(id, (b) => ({
          ...b,
          is_read: isRead,
          read_at: isRead ? new Date().toISOString() : null,
        }));

        const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "更新失败");
        }
        toast.success(isRead ? "已标记为已读" : "已标记为未读");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "更新失败");
      }
    },
    [getBookmarks, setBookmarks, updateCacheItem, fetchWithAbort],
  );

  const handleEdit = useCallback((id: number) => {
    // 使用 window.location 或 router
    window.location.href = `/bookmark/${id}`;
  }, []);

  return {
    handleDelete,
    handleRestore,
    handlePermanentDelete,
    handleToggleRead,
    handleEdit,
  };
}
```

**预期提取**: ~150 行

### 2.3.2 创建批量操作 Hook

**新建文件**: `src/components/home/hooks/use-home-batch.ts`

```typescript
/**
 * 首页批量操作 Hook
 *
 * 职责：批量删除、批量移动、批量恢复、批量快照
 */

import { useState, useCallback } from "react";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";
import { toast } from "sonner";
import type { BookmarkWithFolder } from "../types";

interface UseHomeBatchOptions {
  getBookmarks: () => BookmarkWithFolder[];
  setBookmarks: (
    updater: (prev: BookmarkWithFolder[]) => BookmarkWithFolder[],
  ) => void;
  removeCacheItem?: (id: number) => void;
  selectedIds: Set<number>;
  exitSelectionMode: () => void;
  deselectAll: () => void;
}

export interface UseHomeBatchReturn {
  /** 批量删除中 */
  isBatchDeleting: boolean;
  /** 批量创建快照中 */
  isBatchCreatingSnapshot: boolean;
  /** 批量删除 */
  handleBatchDelete: () => Promise<void>;
  /** 批量恢复 */
  handleBatchRestore: () => Promise<void>;
  /** 清空回收站 */
  handleEmptyTrash: () => Promise<void>;
  /** 批量创建快照 */
  handleBatchCreateSnapshot: () => Promise<void>;
}

export function useHomeBatch(options: UseHomeBatchOptions): UseHomeBatchReturn {
  const {
    getBookmarks,
    setBookmarks,
    removeCacheItem,
    selectedIds,
    exitSelectionMode,
    deselectAll,
  } = options;

  const { fetchWithAbort } = useAbortableFetch();
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchCreatingSnapshot, setIsBatchCreatingSnapshot] = useState(false);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条收藏吗？`)) return;

    setIsBatchDeleting(true);
    try {
      const res = await fetchWithAbort("/api/bookmarks/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error?.message || "批量删除失败");
        return;
      }

      toast.success(`成功删除 ${result.data?.deletedCount || 0} 条收藏`);
      setBookmarks((prev) => prev.filter((b) => !selectedIds.has(b.id)));
      selectedIds.forEach((id) => removeCacheItem?.(id));
      exitSelectionMode();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("批量删除失败");
    } finally {
      setIsBatchDeleting(false);
    }
  }, [
    selectedIds,
    setBookmarks,
    removeCacheItem,
    exitSelectionMode,
    fetchWithAbort,
  ]);

  const handleBatchRestore = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const snapshot = getBookmarks();
    try {
      setBookmarks((prev) => prev.filter((b) => !ids.includes(b.id)));
      const res = await fetchWithAbort("/api/bookmarks/batch-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkIds: ids }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "批量恢复失败");
      }

      deselectAll();
      toast.success(`已恢复 ${ids.length} 个收藏`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "批量恢复失败");
    }
  }, [selectedIds, getBookmarks, setBookmarks, deselectAll, fetchWithAbort]);

  const handleEmptyTrash = useCallback(async () => {
    try {
      const res = await fetchWithAbort("/api/trash/empty", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "清空回收站失败");
      }
      setBookmarks([]);
      toast.success("垃圾箱已清空");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "清空回收站失败");
    }
  }, [setBookmarks, fetchWithAbort]);

  const handleBatchCreateSnapshot = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const bookmarks = getBookmarks();
    const selectedBookmarks = bookmarks.filter((b) => selectedIds.has(b.id));
    const validBookmarks = selectedBookmarks.filter((b) => b.url);

    if (validBookmarks.length === 0) {
      toast.error("选中的书签没有有效的 URL");
      return;
    }

    if (validBookmarks.length > 10) {
      if (
        !confirm(`将为 ${validBookmarks.length} 个书签创建快照，确定继续吗？`)
      ) {
        return;
      }
    }

    setIsBatchCreatingSnapshot(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const bookmark of validBookmarks) {
        try {
          const res = await fetchWithAbort("/api/snapshots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookmarkId: bookmark.id,
              snapshotType: "standard",
            }),
          });

          if (res.ok) {
            successCount++;
          } else {
            const result = await res.json();
            if (result.error?.code === "QUOTA_EXCEEDED") {
              toast.error("快照配额已满");
              break;
            }
            if (result.error?.code !== "SNAPSHOT_EXISTS") {
              failCount++;
            }
          }
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`已为 ${successCount} 个书签创建快照任务`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} 个书签快照创建失败`);
      }
      exitSelectionMode();
    } finally {
      setIsBatchCreatingSnapshot(false);
    }
  }, [selectedIds, getBookmarks, exitSelectionMode, fetchWithAbort]);

  return {
    isBatchDeleting,
    isBatchCreatingSnapshot,
    handleBatchDelete,
    handleBatchRestore,
    handleEmptyTrash,
    handleBatchCreateSnapshot,
  };
}
```

**预期提取**: ~200 行

### 2.3.3 创建工具栏组件

**新建文件**: `src/components/home/home-toolbar.tsx`

```typescript
/**
 * 首页工具栏组件
 *
 * 职责：移动端顶部工具栏（平台筛选、菜单、批量操作栏）
 */

"use client";

import { memo } from "react";
import {
  LayoutGrid, List, Plus, ArrowUpDown, CheckSquare,
  Trash2, FolderInput, Upload, Download, AlignJustify,
  MoreHorizontal, Rows3, Columns3, Sparkles, Globe,
  RotateCcw, Search, Check, Camera, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { HOME_PLATFORMS, SORT_OPTIONS } from "./constants";
import type { ViewMode, LayoutMode } from "./types";

interface HomeToolbarProps {
  // 视图模式
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
  onFlipCardToggle: () => void;

  // 筛选
  currentPlatform: string;
  currentSort: string;
  onPlatformChange: (platform: string) => void;
  onSortChange: (sort: string) => void;

  // 选择模式
  isSelectionMode: boolean;
  selectedCount: number;
  isBatchDeleting: boolean;
  isBatchCreatingSnapshot: boolean;
  onToggleSelectionMode: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchDelete: () => void;
  onBatchMove: () => void;
  onBatchCreateSnapshot?: () => void;

  // 对话框
  onOpenImportDialog: () => void;
  onOpenBrowserImportDialog: () => void;
  onOpenExportDialog: () => void;

  // 其他
  isBrowserPlatform: boolean;
  isTrashFolder: boolean;
  isSnapshotEnabled: boolean;

  // 菜单状态
  isMobileMoreMenuOpen: boolean;
  onMobileMoreMenuOpenChange: (open: boolean) => void;
}

export const HomeToolbar = memo(function HomeToolbar(props: HomeToolbarProps) {
  const {
    viewMode,
    layoutMode,
    enableFlipCard,
    onViewModeChange,
    onLayoutModeChange,
    onFlipCardToggle,
    currentPlatform,
    currentSort,
    onPlatformChange,
    onSortChange,
    isSelectionMode,
    selectedCount,
    isBatchDeleting,
    isBatchCreatingSnapshot,
    onToggleSelectionMode,
    onSelectAll,
    onDeselectAll,
    onBatchDelete,
    onBatchMove,
    onBatchCreateSnapshot,
    onOpenImportDialog,
    onOpenBrowserImportDialog,
    onOpenExportDialog,
    isBrowserPlatform,
    isTrashFolder,
    isSnapshotEnabled,
    isMobileMoreMenuOpen,
    onMobileMoreMenuOpenChange,
  } = props;

  return (
    <header className="sm:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 overflow-hidden">
      {/* 平台筛选 + 右侧操作按钮 */}
      <div className="flex items-center gap-2 max-w-full">
        {/* 移动端平台筛选 */}
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5">
            {HOME_PLATFORMS.map((platform) => {
              const isActive = currentPlatform === platform.value;
              return (
                <button
                  key={platform.id}
                  onClick={() => onPlatformChange(platform.value)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap flex-shrink-0",
                    isActive
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  )}
                >
                  {platform.name}
                </button>
              );
            })}

            {/* 翻转卡片按钮 */}
            {!isBrowserPlatform && viewMode === "card" && (
              <Button
                variant={enableFlipCard ? "default" : "outline"}
                size="sm"
                onClick={onFlipCardToggle}
                title="翻转卡片"
                className={cn(
                  "px-2.5 py-1 h-auto text-xs font-medium rounded-full whitespace-nowrap flex-shrink-0",
                  enableFlipCard
                    ? "bg-purple-500 hover:bg-purple-600 text-white"
                    : "border-gray-200 dark:border-gray-700"
                )}
              >
                <RotateCcw className="size-3 mr-1" />
                翻转
              </Button>
            )}
          </div>
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => (window.location.href = "/search")}
          >
            <Search className="size-4" />
          </Button>

          <DropdownMenu open={isMobileMoreMenuOpen} onOpenChange={onMobileMoreMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* 视图模式 */}
              {!isBrowserPlatform && (
                <>
                  <DropdownMenuLabel className="text-xs">视图模式</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onViewModeChange("card")}>
                    <LayoutGrid className="size-4 mr-2" />
                    <span className="flex-1">瀑布流</span>
                    {viewMode === "card" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("list")}>
                    <List className="size-4 mr-2" />
                    <span className="flex-1">列表</span>
                    {viewMode === "list" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("compact")}>
                    <AlignJustify className="size-4 mr-2" />
                    <span className="flex-1">紧凑</span>
                    {viewMode === "compact" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* 布局模式（仅卡片视图） */}
              {viewMode === "card" && (
                <>
                  <DropdownMenuLabel className="text-xs">布局模式</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onLayoutModeChange("auto")}>
                    <Sparkles className="size-4 mr-2" />
                    <span className="flex-1">自动</span>
                    {layoutMode === "auto" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onLayoutModeChange("row")}>
                    <Rows3 className="size-4 mr-2" />
                    <span className="flex-1">行优先</span>
                    {layoutMode === "row" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onLayoutModeChange("column")}>
                    <Columns3 className="size-4 mr-2" />
                    <span className="flex-1">列优先</span>
                    {layoutMode === "column" && <Check className="size-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* 排序 */}
              <DropdownMenuLabel className="text-xs">排序</DropdownMenuLabel>
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem key={option.value} onClick={() => onSortChange(option.value)}>
                  <ArrowUpDown className="size-4 mr-2" />
                  <span className="flex-1">{option.label}</span>
                  {currentSort === option.value && <Check className="size-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />

              {/* 导入/导出 */}
              <DropdownMenuItem onClick={() => { onOpenImportDialog(); onMobileMoreMenuOpenChange(false); }}>
                <Upload className="size-4 mr-2" />
                批量导入
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { onOpenBrowserImportDialog(); onMobileMoreMenuOpenChange(false); }}>
                <Globe className="size-4 mr-2" />
                导入浏览器书签
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { onOpenExportDialog(); onMobileMoreMenuOpenChange(false); }}>
                <Download className="size-4 mr-2" />
                导出
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {/* 批量选择 */}
              <DropdownMenuItem onClick={() => { onToggleSelectionMode(); onMobileMoreMenuOpenChange(false); }}>
                <CheckSquare className="size-4 mr-2" />
                {isSelectionMode ? "取消批量选择" : "批量选择"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 批量操作工具栏 */}
      {isSelectionMode && selectedCount > 0 && !isTrashFolder && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              已选择 {selectedCount} 条
            </span>
            <Button variant="ghost" size="sm" onClick={onSelectAll} className="text-blue-600 hover:text-blue-700">
              全选
            </Button>
            <Button variant="ghost" size="sm" onClick={onDeselectAll} className="text-blue-600 hover:text-blue-700">
              取消全选
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBatchDelete}
              disabled={isBatchDeleting}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {isBatchDeleting ? (
                <><Loader2 className="size-4 mr-1.5 animate-spin" />删除中...</>
              ) : (
                <><Trash2 className="size-4 mr-1.5" />删除</>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={onBatchMove}>
              <FolderInput className="size-4 mr-1.5" />
              移动到文件夹
            </Button>
            {isSnapshotEnabled && onBatchCreateSnapshot && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBatchCreateSnapshot}
                disabled={isBatchCreatingSnapshot}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                {isBatchCreatingSnapshot ? (
                  <><Loader2 className="size-4 mr-1.5 animate-spin" />创建中...</>
                ) : (
                  <><Camera className="size-4 mr-1.5" />创建快照</>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
});
```

**预期提取**: ~250 行

### 2.3.4 更新 Hooks 索引文件

**修改文件**: `src/components/home/hooks/index.ts`

```typescript
// 导出所有首页相关 Hooks
export {
  useHomeViewMode,
  type UseHomeViewModeOptions,
  type UseHomeViewModeReturn,
} from "./use-home-view-mode";
export {
  useHomeBookmarks,
  type UseHomeBookmarksOptions,
  type UseHomeBookmarksReturn,
} from "./use-home-bookmarks";
export {
  useHomeMutations,
  type UseHomeMutationsOptions,
  type UseHomeMutationsReturn,
} from "./use-home-mutations";
export {
  useHomeBatch,
  type UseHomeBatchOptions,
  type UseHomeBatchReturn,
} from "./use-home-batch";
```

### 2.3.5 重构主组件

**修改文件**: `src/components/home/home-page-client.tsx`

主组件重构后的结构：

```typescript
export function HomePageClient(props: HomePageClientProps) {
  // ===== URL 参数处理 =====
  const router = useRouter();
  const searchParams = useSearchParams();
  // ... (保留现有逻辑)

  // ===== 集成新 Hooks =====
  const viewMode = useHomeViewMode({ isBrowserPlatform });

  const mutations = useHomeMutations({
    getBookmarks: () => bookmarks,
    setBookmarks,
    updateCacheItem,
    removeCacheItem,
  });

  const batch = useHomeBatch({
    getBookmarks: () => bookmarks,
    setBookmarks,
    removeCacheItem,
    selectedIds,
    exitSelectionMode,
    deselectAll,
  });

  // ===== 智能列表模式 =====
  if (currentSmartListId) {
    return <SmartListView smartListId={currentSmartListId} />;
  }

  // ===== 渲染 =====
  return (
    <div className="flex flex-col h-full">
      {/* 移动端工具栏 */}
      <HomeToolbar
        viewMode={viewMode.viewMode}
        layoutMode={viewMode.layoutMode}
        // ... 传递所有 props
      />

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-8 py-0.5 md:py-1">
        {/* 保留现有内容渲染逻辑 */}
      </div>

      {/* 对话框（懒加载） */}
      <Suspense fallback={null}>
        {/* 保留现有对话框 */}
      </Suspense>
    </div>
  );
}
```

### 验收标准

- [ ] `npm run type-check` 零错误
- [ ] `npm run lint` 零警告
- [ ] 所有新文件创建完成
- [ ] 主组件行数减少至 ~800 行（从 1570 行）
- [ ] 功能测试清单全部通过

---

## 📋 Phase 2.4: 启用 Context + 移除旧系统

### 目标

启用 HomePageContext 功能开关，验证后移除 Window Event 监听。

### 预估工时: 3 小时

### 2.4.1 启用 Feature Flag

**修改文件**: `src/lib/feature-flags.ts`

```typescript
export const FEATURE_FLAGS = {
  // 首页重构
  home_use_context: true, // 启用 Context
  home_use_new_bookmarks_hook: false, // 暂不启用
} as const;
```

### 2.4.2 主组件集成 Context

**修改文件**: `src/components/home/home-page-client.tsx`

```typescript
import { useHomePageSafe } from "@/contexts/home-page-context";
import { getFeatureFlag } from "@/lib/feature-flags";

export function HomePageClient(props: HomePageClientProps) {
  // 尝试使用 Context
  const homePageContext = useHomePageSafe();
  const useContext =
    getFeatureFlag("home_use_context") && homePageContext !== null;

  // 使用 Context 数据（如果启用）
  const viewMode = useContext ? homePageContext.view.viewMode : localViewMode;

  // ...
}
```

### 2.4.3 验证 Event Bridge 同步

在开发环境添加同步验证日志：

```typescript
useEffect(() => {
  if (process.env.NODE_ENV === "development" && homePageContext) {
    const localState = { viewMode: localViewMode, platform: localPlatform };
    const contextState = {
      viewMode: homePageContext.view.viewMode,
      platform: homePageContext.filter.platform,
    };

    if (JSON.stringify(localState) !== JSON.stringify(contextState)) {
      console.warn("[EventBridge] State mismatch:", {
        local: localState,
        context: contextState,
      });
    }
  }
}, [localViewMode, localPlatform, homePageContext]);
```

### 2.4.4 移除旧 Event 监听器

确认 Event Bridge 正常后，移除主组件中的直接事件监听：

```typescript
// 删除这些监听器（已在 Context 中处理）
// window.addEventListener("viewModeChange", ...);
// window.addEventListener("layoutModeChange", ...);
// window.addEventListener("flipCardChange", ...);
// window.addEventListener("platformChange", ...);
// window.addEventListener("usageTagFilterChange", ...);
```

**预期减少**: ~100 行

### 验收标准

- [ ] Feature Flag 开启后功能正常
- [ ] 控制台无 State mismatch 警告
- [ ] Event 监听器移除后功能正常
- [ ] 功能测试清单全部通过
- [ ] 主组件最终行数 ~700 行（从 1570 行，减少 55%）

---

## 📅 执行时间线

```
Day 1 (4h)
├── [09:00-11:00] Phase 2.2.1: 集成 useHomeViewMode
├── [11:00-12:00] 验证 + 功能测试清单 1.1-1.3
├── [14:00-16:00] Phase 2.3.1: 创建 use-home-mutations.ts
└── [16:00-17:00] 验证 + 功能测试清单 10.1-10.5

Day 2 (4h)
├── [09:00-11:00] Phase 2.3.2: 创建 use-home-batch.ts
├── [11:00-12:00] 验证 + 功能测试清单 8.1-8.4
├── [14:00-17:00] Phase 2.3.3: 创建 HomeToolbar.tsx
└── [17:00-18:00] 验证 + 功能测试清单全量

Day 3 (3h)
├── [09:00-10:00] Phase 2.4.1-2.4.2: 启用 Context
├── [10:00-11:00] Phase 2.4.3: 验证 Event Bridge
├── [11:00-12:00] Phase 2.4.4: 移除旧 Event 监听器
└── [14:00-15:00] 全量功能测试 + 性能验证
```

**总计**: 11 小时 (约 1.5 个工作日)

---

## 🔄 回滚方案

### 快速回滚

```bash
# 方案 A: 关闭 Feature Flag（推荐）
# 在浏览器控制台执行
localStorage.setItem("ff_home_use_context", "false");
location.reload();

# 方案 B: Git 回滚到 Phase 2.1
git log --oneline -5
git revert <commit-hash>

# 方案 C: 分支回滚
git checkout feature/classification-v4.2
```

### 回滚验证

回滚后执行功能测试清单 1-14 确认功能正常。

---

## ✅ 审核清单

请确认以下内容：

### 技术决策

- [ ] **2.2.2 决策**: 是否集成 useHomeBookmarks？
  - [ ] A) 暂不集成（推荐）
  - [ ] B) 重构后集成

### 计划确认

- [ ] 同意 Phase 2.2-2.4 的拆分方式
- [ ] 同意 11 小时工作量估算
- [ ] 同意新文件的命名和位置

### 风险接受

- [ ] 理解主组件拆分可能影响其他引用
- [ ] 理解 Feature Flag 切换期间可能有状态不一致

---

**制定人**: Winston (Architect Agent)
**制定日期**: 2025-12-18
**审核人**: ******\_******
**审核日期**: ******\_******
