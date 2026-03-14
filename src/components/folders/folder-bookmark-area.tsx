/**
 * 文件夹书签内容区域 (v2.1 批量操作集成)
 *
 * 替换原 folder-content-area.tsx，显示选中文件夹/分组的书签列表
 * 支持搜索、排序、视图切换、拖拽移动和批量操作
 */

"use client";

import {
  useMemo,
  useState,
  useCallback,
  useDeferredValue,
  useRef,
  useEffect,
  useLayoutEffect as useReactLayoutEffect,
} from "react";

// SSR 兼容：服务端渲染时降级为 useEffect，避免 React 警告
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useReactLayoutEffect : useEffect;
import {
  Search,
  SortAsc,
  LayoutGrid,
  Plus,
  Loader2,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VirtualBookmarkList } from "@/components/bookmark/virtual-bookmark-list";
import { BatchToolbar } from "@/components/batch/batch-toolbar";
import { BatchSelectionHint } from "@/components/batch/batch-selection-hint";
import { BatchMoveDialog } from "@/components/bookmark/batch-move-dialog";
import { BatchTagDialog } from "@/components/batch/batch-tag-dialog";
import { useSelectionMode } from "@/hooks/core/use-selection-mode";
import { useAbortableFetch } from "@/hooks/core";
import type {
  FolderSelection,
  FolderWithStats,
  BookmarkWithFolder,
} from "./types";
import type { FolderCategory } from "@/types/domain";
import {
  SORT_OPTIONS,
  VIEW_OPTIONS,
  getSelectionInfo,
  type SortOption,
  type ViewMode,
} from "./folder-bookmark-constants";
import { FolderBookmarkEmpty } from "./folder-bookmark-empty";

// ==================== 类型定义 ====================

interface FolderBookmarkAreaProps {
  /** 当前选择状态 */
  selection: FolderSelection;
  /** 文件夹列表（用于获取名称和统计） */
  folders: FolderWithStats[];
  /** 用户自定义栏目列表（用于显示栏目名称、颜色等） */
  categories?: FolderCategory[];
  /** 书签数据 */
  bookmarks: BookmarkWithFolder[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否有更多数据 */
  hasMore?: boolean;
  /** 加载更多回调 */
  onLoadMore?: () => void;
  /** 创建书签回调 */
  onCreateBookmark?: () => void;
  /** 打开 AI 助手回调 */
  onOpenAIAssistant?: () => void;
  /** 编辑书签回调 */
  onEditBookmark?: (id: number) => void;
  /** 删除书签回调 */
  onDeleteBookmark?: (id: number) => void;
  /** 切换已读状态回调 */
  onToggleRead?: (id: number, isRead: boolean) => void;
  /** 切换星标回调 */
  onToggleStarred?: (id: number, isStarred: boolean) => void;
  /** 批量移动成功回调（用于父组件更新文件夹计数） */
  onBatchMoveSuccess?: (bookmarkIds: number[]) => void;
  /** 批量删除成功回调 */
  onBatchDeleteSuccess?: (bookmarkIds: number[]) => void;
  /**
   * 工具栏位置：
   * - "inline" = 在内容区顶部显示（默认）
   * - "none" = 不显示工具栏（由页面在外部渲染）
   */
  toolbarPosition?: "inline" | "none";
  /** 受控搜索关键词（toolbarPosition="none" 时由外部控制） */
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  /** 受控排序方式 */
  sortBy?: SortOption;
  setSortBy?: (s: SortOption) => void;
  /** 受控视图模式 */
  viewMode?: ViewMode;
  setViewMode?: (v: ViewMode) => void;
  /** 样式类名 */
  className?: string;
}

// Re-export for external consumers
export { getSelectionInfo } from "./folder-bookmark-constants";

// ==================== 主组件 ====================

export function FolderBookmarkArea({
  selection,
  folders,
  categories = [],
  bookmarks,
  isLoading,
  hasMore = false,
  onLoadMore,
  onCreateBookmark,
  onOpenAIAssistant,
  onEditBookmark,
  onDeleteBookmark,
  onToggleRead,
  onToggleStarred,
  onBatchMoveSuccess,
  onBatchDeleteSuccess,
  toolbarPosition = "inline",
  searchQuery: searchQueryProp,
  setSearchQuery: setSearchQueryProp,
  sortBy: sortByProp,
  setSortBy: setSortByProp,
  viewMode: viewModeProp,
  setViewMode: setViewModeProp,
  className,
}: FolderBookmarkAreaProps) {
  const isToolbarExternal = toolbarPosition === "none";

  // 搜索和排序状态（支持受控或内部）
  const [internalSearch, setInternalSearch] = useState("");
  const [internalSortBy, setInternalSortBy] = useState<SortOption>("created");
  const searchQuery = isToolbarExternal
    ? (searchQueryProp ?? "")
    : internalSearch;
  const setSearchQuery = isToolbarExternal
    ? (setSearchQueryProp ?? (() => {}))
    : setInternalSearch;
  const sortBy = isToolbarExternal ? (sortByProp ?? "created") : internalSortBy;
  const setSortBy = isToolbarExternal
    ? (setSortByProp ?? (() => {}))
    : setInternalSortBy;
  const deferredSearch = useDeferredValue(searchQuery);

  // 视图模式（从 localStorage 恢复，或受控）
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("folder-bookmark-view-mode");
      if (saved === "card" || saved === "list" || saved === "compact") {
        return saved;
      }
    }
    return "list";
  });
  const viewMode = isToolbarExternal
    ? (viewModeProp ?? "list")
    : internalViewMode;
  const setViewMode = isToolbarExternal
    ? (setViewModeProp ?? (() => {}))
    : setInternalViewMode;

  // 持久化视图模式（仅在内部管理模式下写入，避免与外部 toolbar hook 重复写入）
  useEffect(() => {
    if (!isToolbarExternal) {
      localStorage.setItem("folder-bookmark-view-mode", viewMode);
    }
  }, [viewMode, isToolbarExternal]);

  // 滚动容器引用（useLayoutEffect 同步执行，确保 Virtuoso 挂载时滚动父元素已就绪）
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);

  // 使用 ResizeObserver 确保容器有有效高度后再设置 scrollParent
  // 这避免了 Virtuoso 在容器高度为 0 时初始化导致的 "Zero-sized element" 警告
  useIsomorphicLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 如果容器已经有高度，直接设置
    if (container.offsetHeight > 0) {
      setScrollParent(container);
      return;
    }

    // 否则等待容器有高度
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.height > 0) {
        setScrollParent(container);
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(container);
    // 返回清理函数
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // ==================== 批量选择模式 ====================

  const {
    isSelectionMode,
    selectedIds,
    isBatchDeleting,
    toggleSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    setIsBatchDeleting,
    exitSelectionMode,
  } = useSelectionMode();

  // 批量操作对话框状态
  const [showBatchMoveDialog, setShowBatchMoveDialog] = useState(false);
  const [showBatchTagDialog, setShowBatchTagDialog] = useState(false);

  // 单个书签移动状态（复用 BatchMoveDialog）
  const [singleMoveId, setSingleMoveId] = useState<number | null>(null);
  const singleMoveIds = useMemo(
    () => (singleMoveId ? new Set([singleMoveId]) : new Set<number>()),
    [singleMoveId],
  );

  const { fetchWithAbort } = useAbortableFetch();

  // 切换文件夹/分组时自动退出选择模式
  const prevSelectionRef = useRef(selection);
  useEffect(() => {
    const prev = prevSelectionRef.current;
    const changed =
      prev.type !== selection.type ||
      (prev.type === "category" &&
        selection.type === "category" &&
        prev.categoryId !== selection.categoryId) ||
      (prev.type === "group" &&
        selection.type === "group" &&
        prev.groupId !== selection.groupId) ||
      ((prev.type === "folder" || prev.type === "system") &&
        (selection.type === "folder" || selection.type === "system") &&
        prev.folderId !== selection.folderId);

    if (changed && isSelectionMode) {
      exitSelectionMode();
    }
    prevSelectionRef.current = selection;
  }, [selection, isSelectionMode, exitSelectionMode]);

  // Esc 退出选择模式
  useEffect(() => {
    if (!isSelectionMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        exitSelectionMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectionMode, exitSelectionMode]);

  // 获取选择信息
  const selectionInfo = useMemo(
    () => getSelectionInfo(selection, folders, categories),
    [selection, folders, categories],
  );
  const SelectionIcon = selectionInfo.icon;

  // 过滤和排序书签
  const filteredBookmarks = useMemo(() => {
    let result = [...bookmarks];

    if (deferredSearch.trim()) {
      const query = deferredSearch.toLowerCase();
      result = result.filter(
        (b) =>
          b.title?.toLowerCase().includes(query) ||
          b.ai_summary?.toLowerCase().includes(query) ||
          b.ai_tags?.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return (a.title || "").localeCompare(b.title || "", "zh-CN");
        case "updated":
          return (
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
          );
        case "created":
        default:
          return (
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
          );
      }
    });

    return result;
  }, [bookmarks, deferredSearch, sortBy]);

  // 所有可见书签的 ID（用于全选和 Shift 选择）
  const allBookmarkIds = useMemo(
    () => filteredBookmarks.map((b) => b.id),
    [filteredBookmarks],
  );

  // 选中的书签数据（用于批量标签对话框）
  const selectedBookmarks = useMemo(
    () => filteredBookmarks.filter((b) => selectedIds.has(b.id)),
    [filteredBookmarks, selectedIds],
  );

  // ==================== 批量操作回调 ====================

  const handleSelectAll = useCallback(() => {
    selectAll(allBookmarkIds);
  }, [selectAll, allBookmarkIds]);

  const handleToggleSelect = useCallback(
    (id: number) => {
      if (!isSelectionMode) return;
      toggleSelect(id);
    },
    [isSelectionMode, toggleSelect],
  );

  const handleBatchMoveSuccess = useCallback(() => {
    const movedIds = Array.from(selectedIds);
    exitSelectionMode();
    onBatchMoveSuccess?.(movedIds);
  }, [selectedIds, exitSelectionMode, onBatchMoveSuccess]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `确定要删除选中的 ${selectedIds.size} 条收藏吗？此操作会将它们移到回收站。`,
    );
    if (!confirmed) return;

    setIsBatchDeleting(true);
    try {
      const res = await fetchWithAbort("/api/v1/bookmarks/batch/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "删除失败");
      }

      const deletedCount = data.data?.deletedCount || selectedIds.size;
      toast.success(`已删除 ${deletedCount} 条收藏`);

      const deletedIds = Array.from(selectedIds);
      exitSelectionMode();
      onBatchDeleteSuccess?.(deletedIds);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setIsBatchDeleting(false);
    }
  }, [
    selectedIds,
    setIsBatchDeleting,
    fetchWithAbort,
    exitSelectionMode,
    onBatchDeleteSuccess,
  ]);

  const handleBatchTagSuccess = useCallback(() => {
    exitSelectionMode();
  }, [exitSelectionMode]);

  // 单个书签移动
  const handleMoveBookmark = useCallback((id: number) => {
    setSingleMoveId(id);
  }, []);

  const handleSingleMoveSuccess = useCallback(() => {
    const movedId = singleMoveId;
    setSingleMoveId(null);
    if (movedId) {
      onBatchMoveSuccess?.([movedId]);
    }
  }, [singleMoveId, onBatchMoveSuccess]);

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* 标题栏 / 批量工具栏（toolbarPosition="none" 时仅保留批量栏，普通栏由页面在外部渲染） */}
      {isSelectionMode ? (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
          <BatchSelectionHint />
          <BatchToolbar
            selectedCount={selectedIds.size}
            totalCount={filteredBookmarks.length}
            onSelectAll={handleSelectAll}
            onClearSelection={deselectAll}
            onExit={exitSelectionMode}
            onOpenTagDialog={() => setShowBatchTagDialog(true)}
            onOpenMoveDialog={() => setShowBatchMoveDialog(true)}
            onBatchDelete={handleBatchDelete}
            isProcessing={isBatchDeleting}
          />
        </div>
      ) : !isToolbarExternal ? (
        <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-4">
            {/* 左侧：图标 + 标题(带统计) */}
            {selectionInfo.titleEmoji ? (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: selectionInfo.categoryColor
                    ? `${selectionInfo.categoryColor}20`
                    : undefined,
                }}
              >
                <span className="text-base">{selectionInfo.titleEmoji}</span>
              </div>
            ) : (
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                  `bg-gradient-to-br ${selectionInfo.colors.gradient.from} ${selectionInfo.colors.gradient.to}`,
                )}
              >
                <SelectionIcon className="size-3.5 text-white" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <h2
                className="text-sm font-semibold whitespace-nowrap leading-tight"
                style={{
                  color: selectionInfo.categoryColor || undefined,
                }}
              >
                {selectionInfo.title}
              </h2>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {isLoading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" />
                    加载中...
                  </span>
                ) : (
                  `${filteredBookmarks.length} 条收藏`
                )}
              </span>
            </div>

            {/* 右侧：搜索框 + 工具栏 + 按钮组 */}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              {/* 搜索框 */}
              <div className="relative w-40 lg:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>

              {/* 排序 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-2.5">
                    <SortAsc className="size-3.5 mr-1" />
                    <span className="hidden sm:inline text-xs">
                      {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={sortBy === option.value ? "bg-accent" : ""}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 视图切换 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-2.5">
                    {(() => {
                      const Icon =
                        VIEW_OPTIONS.find((o) => o.value === viewMode)?.icon ||
                        LayoutGrid;
                      return <Icon className="size-3.5 mr-1" />;
                    })()}
                    <span className="hidden sm:inline text-xs">
                      {VIEW_OPTIONS.find((o) => o.value === viewMode)?.label}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {VIEW_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setViewMode(option.value)}
                      className={viewMode === option.value ? "bg-accent" : ""}
                    >
                      <option.icon className="size-3.5 mr-2" />
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 批量管理按钮 */}
              {filteredBookmarks.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectionMode}
                  className="h-8 px-2.5 text-xs"
                >
                  <CheckSquare className="size-3.5 mr-1" />
                  <span className="hidden sm:inline">批量</span>
                </Button>
              )}

              {/* AI 助手 */}
              {onOpenAIAssistant && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenAIAssistant}
                  className="hidden lg:flex text-xs text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950 h-8"
                >
                  AI 助手
                </Button>
              )}
              {onCreateBookmark && (
                <Button size="sm" className="h-8" onClick={onCreateBookmark}>
                  <Plus className="size-3.5 mr-1" />
                  添加收藏
                </Button>
              )}
            </div>
          </div>
          {/* 拖拽提示 */}
          <div className="px-6 pb-1.5 text-xs text-muted-foreground">
            拖拽收藏到左侧文件夹可快速实现分类和移动
          </div>
        </div>
      ) : null}

      {/* 内容区域 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">正在加载书签...</p>
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <FolderBookmarkEmpty
            hasSearch={!!searchQuery}
            selectionTitle={selectionInfo.title}
            selectionType={selection.type}
            onCreateBookmark={onCreateBookmark}
          />
        ) : !scrollParent ? (
          // scrollParent 未就绪时显示骨架屏，避免 Virtuoso "Zero-sized element" 警告
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[140px] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <VirtualBookmarkList
            bookmarks={filteredBookmarks}
            viewMode={viewMode}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            onEdit={onEditBookmark}
            onDelete={onDeleteBookmark}
            onMove={handleMoveBookmark}
            onToggleRead={onToggleRead}
            onToggleStarred={onToggleStarred}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            customScrollParent={scrollParent}
            draggable={!isSelectionMode}
          />
        )}
      </div>

      {/* 批量移动对话框 */}
      <BatchMoveDialog
        open={showBatchMoveDialog}
        onOpenChange={setShowBatchMoveDialog}
        selectedIds={selectedIds}
        onSuccess={handleBatchMoveSuccess}
      />

      {/* 批量标签对话框 */}
      <BatchTagDialog
        open={showBatchTagDialog}
        onOpenChange={setShowBatchTagDialog}
        selectedIds={Array.from(selectedIds)}
        selectedBookmarks={selectedBookmarks}
        onSuccess={handleBatchTagSuccess}
      />

      {/* 单个书签移动对话框（复用 BatchMoveDialog） */}
      <BatchMoveDialog
        open={singleMoveId !== null}
        onOpenChange={(open) => {
          if (!open) setSingleMoveId(null);
        }}
        selectedIds={singleMoveIds}
        onSuccess={handleSingleMoveSuccess}
      />
    </div>
  );
}
