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
} from "react";
import {
  Search,
  SortAsc,
  LayoutGrid,
  List,
  ListCollapse,
  Plus,
  Loader2,
  FolderOpen,
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
import { BatchMoveDialog } from "@/components/bookmark/batch-move-dialog";
import { BatchTagDialog } from "@/components/batch/batch-tag-dialog";
import { useSelectionMode } from "@/hooks/core/use-selection-mode";
import { useAbortableFetch } from "@/hooks/core";
import { FOLDER_GROUPS } from "./constants";
import type {
  FolderSelection,
  FolderWithStats,
  BookmarkWithFolder,
} from "./types";

// ==================== 类型定义 ====================

type SortOption = "created" | "title" | "updated";
type ViewMode = "card" | "list" | "compact";

interface FolderBookmarkAreaProps {
  /** 当前选择状态 */
  selection: FolderSelection;
  /** 文件夹列表（用于获取名称和统计） */
  folders: FolderWithStats[];
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
  /** 样式类名 */
  className?: string;
}

// ==================== 排序配置 ====================

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "created", label: "添加时间" },
  { value: "title", label: "标题" },
  { value: "updated", label: "更新时间" },
];

// ==================== 工具函数 ====================

function getSelectionInfo(
  selection: FolderSelection,
  folders: FolderWithStats[],
): {
  title: string;
  icon: typeof FolderOpen;
  colors: { gradient: { from: string; to: string } };
  bookmarkCount: number;
} {
  switch (selection.type) {
    case "group": {
      const config = FOLDER_GROUPS[selection.groupId];
      const groupFolders = folders.filter(
        (f) =>
          !f.is_archived &&
          !f.is_system &&
          (f.folder_group || "other") === selection.groupId,
      );
      const bookmarkCount = groupFolders.reduce(
        (sum, f) => sum + (f.bookmark_count || 0),
        0,
      );
      return {
        title: config?.label || "未知分组",
        icon: config?.icon || FolderOpen,
        colors: config?.colors || FOLDER_GROUPS.other.colors,
        bookmarkCount,
      };
    }
    case "folder":
    case "system": {
      const folder = folders.find((f) => f.id === selection.folderId);
      return {
        title: folder?.name || "未知文件夹",
        icon: FolderOpen,
        colors: folder?.is_system
          ? FOLDER_GROUPS.default.colors
          : FOLDER_GROUPS[folder?.folder_group || "other"]?.colors ||
            FOLDER_GROUPS.other.colors,
        bookmarkCount: folder?.bookmark_count || 0,
      };
    }
  }
}

// ==================== 主组件 ====================

export function FolderBookmarkArea({
  selection,
  folders,
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
  className,
}: FolderBookmarkAreaProps) {
  // 搜索和排序状态
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>("created");

  // 视图模式（从 localStorage 恢复）
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("folder-bookmark-view-mode");
      if (saved === "card" || saved === "list" || saved === "compact") {
        return saved;
      }
    }
    return "list";
  });

  // 持久化视图模式
  useEffect(() => {
    localStorage.setItem("folder-bookmark-view-mode", viewMode);
  }, [viewMode]);

  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      setScrollParent(scrollContainerRef.current);
    }
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
    () => getSelectionInfo(selection, folders),
    [selection, folders],
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
      {/* 标题栏 / 批量工具栏 */}
      {isSelectionMode ? (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
          <BatchToolbar
            selectedCount={selectedIds.size}
            totalCount={filteredBookmarks.length}
            onSelectAll={handleSelectAll}
            onClearSelection={deselectAll}
            onOpenTagDialog={() => setShowBatchTagDialog(true)}
            onOpenMoveDialog={() => setShowBatchMoveDialog(true)}
            onBatchDelete={handleBatchDelete}
            isProcessing={isBatchDeleting}
          />
        </div>
      ) : (
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-4">
            {/* 左侧：图标 + 标题(带统计) */}
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                `bg-gradient-to-br ${selectionInfo.colors.gradient.from} ${selectionInfo.colors.gradient.to}`,
              )}
            >
              <SelectionIcon className="size-4 text-white" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap leading-tight">
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>

              {/* 排序 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-2.5">
                    <SortAsc className="size-4 mr-1" />
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
              <div
                className="hidden md:flex items-center border rounded-md overflow-hidden"
                role="group"
                aria-label="视图切换"
              >
                <Button
                  variant={viewMode === "card" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 w-9 p-0 rounded-none"
                  onClick={() => setViewMode("card")}
                  aria-label="卡片视图"
                  aria-pressed={viewMode === "card"}
                >
                  <LayoutGrid className="size-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 w-9 p-0 rounded-none"
                  onClick={() => setViewMode("list")}
                  aria-label="列表视图"
                  aria-pressed={viewMode === "list"}
                >
                  <List className="size-4" />
                </Button>
                <Button
                  variant={viewMode === "compact" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 w-9 p-0 rounded-none"
                  onClick={() => setViewMode("compact")}
                  aria-label="紧凑视图"
                  aria-pressed={viewMode === "compact"}
                >
                  <ListCollapse className="size-4" />
                </Button>
              </div>

              {/* 批量管理按钮 */}
              {filteredBookmarks.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectionMode}
                  className="h-9 px-2.5 text-xs"
                >
                  <CheckSquare className="size-4 mr-1" />
                  <span className="hidden sm:inline">批量</span>
                </Button>
              )}

              {/* AI 助手 */}
              {onOpenAIAssistant && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenAIAssistant}
                  className="hidden lg:flex text-xs text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950 h-9"
                >
                  AI 助手
                </Button>
              )}
              {onCreateBookmark && (
                <Button size="sm" className="h-9" onClick={onCreateBookmark}>
                  <Plus className="size-4 mr-1" />
                  添加收藏
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

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
            onCreateBookmark={onCreateBookmark}
          />
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

// ==================== 空状态组件 ====================

interface FolderBookmarkEmptyProps {
  hasSearch: boolean;
  selectionTitle: string;
  onCreateBookmark?: () => void;
}

function FolderBookmarkEmpty({
  hasSearch,
  selectionTitle,
  onCreateBookmark,
}: FolderBookmarkEmptyProps) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Search className="size-12 mb-4 opacity-50" />
        <p className="text-sm">没有找到匹配的书签</p>
        <p className="text-xs mt-1">尝试使用不同的关键词搜索</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FolderOpen className="size-12 mb-4 opacity-50" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        「{selectionTitle}」暂无收藏
      </p>
      <p className="text-xs mt-1">添加第一个收藏开始整理吧</p>
      {onCreateBookmark && (
        <Button size="sm" className="mt-4" onClick={onCreateBookmark}>
          <Plus className="size-4 mr-1" />
          添加收藏
        </Button>
      )}
    </div>
  );
}
