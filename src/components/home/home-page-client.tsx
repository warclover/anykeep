/**
 * 首页客户端组件
 * 实现平台筛选、加载更多、编辑删除等交互功能
 */

"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  List,
  Plus,
  Loader2,
  ArrowUpDown,
  CheckSquare,
  Trash2,
  FolderInput,
  Upload,
  Download,
  AlignJustify,
  MoreHorizontal,
  Rows3,
  Columns3,
  Sparkles,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookmarkCard } from "@/components/bookmark/bookmark-card";
import { TrashBookmarkCard } from "@/components/bookmark/trash-bookmark-card";
import { BrowserBookmarkVirtualList } from "@/components/bookmark/browser-bookmark-virtual-list";
import { BrowserBookmarkEmptyState } from "@/components/bookmark/browser-bookmark-empty-state";
import { TrashToolbar } from "@/components/trash/trash-toolbar";
import { CreateBookmarkDialog } from "@/components/bookmark/create-bookmark-dialog";
import { BatchImportDialog } from "@/components/bookmark/batch-import-dialog";
import { BatchMoveDialog } from "@/components/bookmark/batch-move-dialog";
import { ExportDialog } from "@/components/bookmark/export-dialog";
import { BrowserBookmarkImportDialog } from "@/components/browser-bookmark";
import { FolderRecommendationToast } from "@/components/bookmark/folder-recommendation-toast";
import { ReclassifyBanner } from "@/components/bookmark/reclassify-banner";
import { EmptyState } from "@/components/bookmark/empty-state";
import { useFolderRecommendation } from "@/hooks/use-folder-recommendation";
import { useDialogs } from "@/hooks/use-dialogs";
import { useSelectionMode } from "@/hooks/use-selection-mode";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/types/supabase";

interface HomePageClientProps {
  bookmarks: (Bookmark & {
    folders?: { name: string } | null;
  })[];
  error?: string;
}

// 平台配置（内容平台 + 浏览器书签统一入口）
const platforms = [
  { id: "all", name: "全部", value: "" },
  { id: "wechat", name: "微信", value: "WECHAT_OFFICIAL_ACCOUNT" },
  { id: "xiaohongshu", name: "小红书", value: "XIAOHONGSHU" },
  { id: "bilibili", name: "B站", value: "BILIBILI" },
  { id: "browser", name: "浏览器书签", value: "browser" }, // 统一浏览器平台入口
];

// 排序选项
const sortOptions = [
  { value: "created_desc", label: "最新收藏" },
  { value: "created_asc", label: "最早收藏" },
  { value: "title_asc", label: "标题 A-Z" },
  { value: "title_desc", label: "标题 Z-A" },
];

// 视图模式类型
type ViewMode = "card" | "list" | "compact";

// 布局模式类型（仅用于卡片视图）
type LayoutMode = "auto" | "row" | "column";

// 本地存储 key
const VIEW_MODE_STORAGE_KEY = "anykeep-view-mode";
const LAYOUT_MODE_STORAGE_KEY = "anykeep-layout-mode";

// 布局模式选项
const layoutOptions = [
  {
    value: "auto",
    label: "自动",
    icon: Sparkles,
    description: "根据设备自适应",
  },
  { value: "row", label: "横向优先", icon: Rows3, description: "按行排列" },
  { value: "column", label: "纵向优先", icon: Columns3, description: "瀑布流" },
] as const;

export function HomePageClient({
  bookmarks: initialBookmarks,
  error,
}: HomePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPlatform = searchParams.get("platform") || "";
  const currentSort = searchParams.get("sort") || "created_desc";
  const currentFolder = searchParams.get("folder") || "";

  // 检测是否为浏览器书签平台
  const isBrowserPlatform = currentPlatform === "browser";

  // 检测是否为虚拟文件夹
  const isTrashFolder = currentFolder === "trash";
  const _isInvalidFolder = currentFolder === "invalid";
  const _isHighValueFolder = currentFolder === "high-value";

  // 可取消请求 Hook
  const { fetchWithAbort } = useAbortableFetch();

  // 视图模式（从 localStorage 读取默认值）
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  // 布局模式（仅用于卡片视图）
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("auto");

  // 初始化视图模式和布局模式（从 localStorage 读取）
  useEffect(() => {
    const savedViewMode = localStorage.getItem(
      VIEW_MODE_STORAGE_KEY,
    ) as ViewMode | null;
    if (savedViewMode && ["card", "list", "compact"].includes(savedViewMode)) {
      setViewMode(savedViewMode);
    }

    const savedLayoutMode = localStorage.getItem(
      LAYOUT_MODE_STORAGE_KEY,
    ) as LayoutMode | null;
    if (
      savedLayoutMode &&
      ["auto", "row", "column"].includes(savedLayoutMode)
    ) {
      setLayoutMode(savedLayoutMode);
    }
  }, []);

  // 切换视图模式并保存到 localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  };

  // 切换布局模式并保存到 localStorage
  const handleLayoutModeChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
  };

  // 计算网格容器的 CSS 类名
  const gridClassName = cn(
    "masonry-grid",
    layoutMode === "row" && "layout-row",
    layoutMode === "column" && "layout-column",
  );
  const [bookmarks, setBookmarks] = useState(initialBookmarks);

  // 同步 props 和 state：当 initialBookmarks 更新时同步到 bookmarks state
  // 这是必需的，因为 router.refresh() 会更新 props，但 useState 不会自动同步
  useEffect(() => {
    setBookmarks(initialBookmarks);
    // 同时更新 hasMore 状态
    setHasMore(initialBookmarks.length === 50);
  }, [initialBookmarks]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialBookmarks.length === 50);
  const [_isPending, startTransition] = useTransition();

  // 对话框和下拉菜单状态管理
  const {
    showCreateDialog,
    showImportDialog,
    showBrowserImportDialog,
    showExportDialog,
    showMoveDialog,
    isDesktopImportMenuOpen,
    isMobileMoreMenuOpen,
    openCreateDialog,
    setShowCreateDialog,
    openImportDialog,
    setShowImportDialog,
    openBrowserImportDialog,
    setShowBrowserImportDialog,
    openExportDialog,
    setShowExportDialog,
    openMoveDialog,
    setShowMoveDialog,
    setIsDesktopImportMenuOpen,
    setIsMobileMoreMenuOpen,
  } = useDialogs();

  // 批量选择模式
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

  // AI 文件夹推荐
  const {
    recommendation,
    bookmarkId: recommendationBookmarkId,
    fetchRecommendation,
    applyRecommendation,
    dismissRecommendation,
  } = useFolderRecommendation();

  // 新建收藏成功后触发文件夹推荐
  const handleBookmarkCreated = (bookmark: {
    id: number;
    title: string;
    ai_summary?: string | null;
    ai_tags?: string[] | null;
  }) => {
    // 如果收藏没有指定文件夹，则获取 AI 推荐
    fetchRecommendation(
      bookmark.id,
      bookmark.title,
      bookmark.ai_summary || "",
      bookmark.ai_tags || [],
    );
  };

  // 打开移动对话框（用于自定义选择）
  const handleCustomizeFolder = () => {
    if (recommendationBookmarkId) {
      selectAll([recommendationBookmarkId]);
      openMoveDialog();
      dismissRecommendation();
    }
  };

  const handlePlatformChange = (platformValue: string) => {
    const params = new URLSearchParams(searchParams);
    if (platformValue) {
      params.set("platform", platformValue);
    } else {
      params.delete("platform");
    }
    router.push(`/home?${params.toString()}`);
  };

  const handleSortChange = (sortValue: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("sort", sortValue);
    router.push(`/home?${params.toString()}`);
  };

  const handleRetry = () => {
    router.refresh();
  };

  const handleEdit = (id: number) => {
    // 跳转到详情页进行编辑（未来计划：实现内联编辑对话框）
    router.push(`/bookmark/${id}`);
  };

  const handleDelete = async (id: number) => {
    // 保存当前快照用于回滚
    const snapshot = [...bookmarks];

    try {
      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => b.id !== id));

      // 调用删除 API（可取消）
      const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "删除失败");
      }

      toast.success("删除成功");

      // 刷新数据
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      // 失败时恢复到快照状态
      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  // 垃圾箱相关操作
  const handleRestore = async (id: number) => {
    const snapshot = [...bookmarks];

    try {
      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => b.id !== id));

      // 调用恢复 API
      const res = await fetchWithAbort(`/api/bookmarks/${id}/restore`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "恢复失败");
      }

      toast.success("已恢复收藏");

      // 刷新数据
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "恢复失败");
    }
  };

  const handlePermanentDelete = async (id: number) => {
    const snapshot = [...bookmarks];

    try {
      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => b.id !== id));

      // 调用永久删除 API
      const res = await fetchWithAbort(`/api/bookmarks/${id}/permanent`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "永久删除失败");
      }

      toast.success("已永久删除");

      // 刷新数据
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "永久删除失败");
    }
  };

  const handleBatchRestore = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      const res = await fetchWithAbort("/api/bookmarks/batch-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkIds: ids }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "批量恢复失败");
      }

      // 清除选择
      clearSelection();

      toast.success(`已恢复 ${ids.length} 个收藏`);

      // 刷新数据
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      toast.error(error instanceof Error ? error.message : "批量恢复失败");
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const res = await fetchWithAbort("/api/trash/empty", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "清空垃圾箱失败");
      }

      // 清除所有书签
      setBookmarks([]);

      toast.success("垃圾箱已清空");

      // 刷新数据
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      toast.error(error instanceof Error ? error.message : "清空垃圾箱失败");
    }
  };

  const handleToggleRead = async (id: number, isRead: boolean) => {
    // 保存当前快照用于回滚
    const snapshot = [...bookmarks];

    try {
      // 乐观更新 UI
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

      // 调用 PATCH API 更新已读状态
      const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isRead }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "更新失败");
      }

      toast.success(isRead ? "已标记为已读" : "已标记为未读");
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      // 失败时恢复到快照状态
      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "更新失败");
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const lastBookmark = bookmarks[bookmarks.length - 1];
      const params = new URLSearchParams({
        cursor: lastBookmark.id.toString(),
        limit: "50",
      });

      if (currentPlatform) {
        params.append("platform", currentPlatform);
      }

      const res = await fetchWithAbort(`/api/bookmarks?${params}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "加载失败");
      }

      const data = await res.json();
      const newBookmarks = data.data.bookmarks;

      setBookmarks((prev) => [...prev, ...newBookmarks]);
      setHasMore(data.data.pagination.hasMore);
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 选择模式操作函数已从 useSelectionMode Hook 中获取

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    if (
      !confirm(
        `确定要删除选中的 ${selectedIds.size} 条收藏吗？删除后无法恢复。`,
      )
    ) {
      return;
    }

    setIsBatchDeleting(true);
    try {
      // 使用批量删除 API（单次请求）
      const response = await fetchWithAbort("/api/bookmarks/batch-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error?.message || "批量删除失败");
        return;
      }

      const deletedCount = result.data?.deletedCount || 0;
      toast.success(`成功删除 ${deletedCount} 条收藏`);

      // 更新 UI（乐观更新）
      setBookmarks((prev) => prev.filter((b) => !selectedIds.has(b.id)));
      exitSelectionMode();

      // 刷新数据
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // 前端错误仅在开发环境使用 console
      if (process.env.NODE_ENV === "development") {
        console.error("Batch delete error:", error);
      }
      toast.error("批量删除失败");
    } finally {
      setIsBatchDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部区域 */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        {/* 标题和视图切换 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold">
              我的收藏
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              共 {bookmarks.length} 条收藏
            </p>
          </div>

          {/* 排序和视图切换 - 响应式设计 */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            {/* 移动端：更多操作菜单 */}
            <div className="flex md:hidden">
              <DropdownMenu
                open={isMobileMoreMenuOpen}
                onOpenChange={setIsMobileMoreMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-2">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => {
                      openImportDialog();
                      setIsMobileMoreMenuOpen(false);
                    }}
                  >
                    <Upload className="size-4 mr-2" />
                    批量导入
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      openBrowserImportDialog();
                      setIsMobileMoreMenuOpen(false);
                    }}
                  >
                    <Globe className="size-4 mr-2" />
                    从浏览器书签导入
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      openExportDialog();
                      setIsMobileMoreMenuOpen(false);
                    }}
                  >
                    <Download className="size-4 mr-2" />
                    导出
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      toggleSelectionMode();
                      setIsMobileMoreMenuOpen(false);
                    }}
                  >
                    <CheckSquare className="size-4 mr-2" />
                    {isSelectionMode ? "取消选择" : "批量选择"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 桌面端：完整按钮 */}
            <div className="hidden md:flex items-center gap-3">
              {/* 导入下拉菜单 */}
              <DropdownMenu
                open={isDesktopImportMenuOpen}
                onOpenChange={setIsDesktopImportMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="size-4 mr-1.5" />
                    导入
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      openImportDialog();
                      setIsDesktopImportMenuOpen(false);
                    }}
                  >
                    <Upload className="size-4 mr-2" />
                    批量导入 URL
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      openBrowserImportDialog();
                      setIsDesktopImportMenuOpen(false);
                    }}
                  >
                    <Globe className="size-4 mr-2" />
                    从浏览器书签导入
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 导出按钮 */}
              <Button variant="outline" size="sm" onClick={openExportDialog}>
                <Download className="size-4 mr-1.5" />
                导出
              </Button>

              {/* 批量选择按钮 */}
              <Button
                variant={isSelectionMode ? "default" : "outline"}
                size="sm"
                onClick={toggleSelectionMode}
                className={cn(
                  isSelectionMode &&
                    "bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700",
                )}
              >
                <CheckSquare className="size-4 mr-1.5" />
                {isSelectionMode ? "取消选择" : "批量选择"}
              </Button>
            </div>

            {/* 排序选择器 - 移动端紧凑 */}
            <Select value={currentSort} onValueChange={handleSortChange}>
              <SelectTrigger className="w-10 md:w-[140px] h-8">
                <ArrowUpDown className="size-4 md:mr-2" />
                <span className="hidden md:inline">
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 布局模式选择器（仅卡片视图显示） */}
            {viewMode === "card" && (
              <Select
                value={layoutMode}
                onValueChange={(v) => handleLayoutModeChange(v as LayoutMode)}
              >
                <SelectTrigger className="w-10 md:w-[130px] h-8">
                  {layoutMode === "auto" && (
                    <Sparkles className="size-4 md:mr-2" />
                  )}
                  {layoutMode === "row" && <Rows3 className="size-4 md:mr-2" />}
                  {layoutMode === "column" && (
                    <Columns3 className="size-4 md:mr-2" />
                  )}
                  <span className="hidden md:inline">
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {layoutOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="size-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {/* 视图切换按钮（浏览器平台隐藏，固定为列表视图） */}
            {!isBrowserPlatform && (
              <div className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 sm:p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewModeChange("card")}
                  title="瀑布流视图"
                  className={cn(
                    "h-7 w-7 sm:h-8 sm:w-8 p-0",
                    viewMode === "card" &&
                      "bg-white dark:bg-gray-600 shadow-sm",
                  )}
                >
                  <LayoutGrid className="size-3.5 sm:size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewModeChange("list")}
                  title="列表视图"
                  className={cn(
                    "h-7 w-7 sm:h-8 sm:w-8 p-0",
                    viewMode === "list" &&
                      "bg-white dark:bg-gray-600 shadow-sm",
                  )}
                >
                  <List className="size-3.5 sm:size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewModeChange("compact")}
                  title="紧凑视图"
                  className={cn(
                    "h-7 w-7 sm:h-8 sm:w-8 p-0",
                    viewMode === "compact" &&
                      "bg-white dark:bg-gray-600 shadow-sm",
                  )}
                >
                  <AlignJustify className="size-3.5 sm:size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 平台筛选标签 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {platforms.map((platform) => {
            const isActive = currentPlatform === platform.value;
            return (
              <button
                key={platform.id}
                onClick={() => handlePlatformChange(platform.value)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
                )}
              >
                {platform.name}
              </button>
            );
          })}
        </div>

        {/* 垃圾箱工具栏 */}
        {isTrashFolder && (
          <div className="mt-4">
            <TrashToolbar
              selectedCount={selectedIds.size}
              onBatchRestore={handleBatchRestore}
              onEmptyTrash={handleEmptyTrash}
              totalCount={bookmarks.length}
            />
          </div>
        )}

        {/* 批量操作工具栏 */}
        {isSelectionMode && selectedIds.size > 0 && !isTrashFolder && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                已选择 {selectedIds.size} 条
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectAll(bookmarks.map((b) => b.id))}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                全选
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                取消全选
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDelete}
                disabled={isBatchDeleting}
                className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                {isBatchDeleting ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4 mr-1.5" />
                    删除
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={openMoveDialog}>
                <FolderInput className="size-4 mr-1.5" />
                移动到文件夹
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-6">
        {/* V4.2 智能分类横幅 */}
        <ReclassifyBanner className="mb-4" />

        {error ? (
          <ErrorMessage message={error} retry={handleRetry} />
        ) : bookmarks && bookmarks.length > 0 ? (
          <>
            {/* 浏览器书签专用列表视图（虚拟滚动） */}
            {isBrowserPlatform ? (
              <BrowserBookmarkVirtualList
                bookmarks={bookmarks}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isSelectionMode={isSelectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            ) : isTrashFolder ? (
              <>
                {/* 垃圾箱卡片视图 */}
                <div className={gridClassName}>
                  {bookmarks.map((bookmark) => (
                    <div key={bookmark.id} className="masonry-item">
                      <TrashBookmarkCard
                        bookmark={bookmark}
                        onRestore={handleRestore}
                        onPermanentDelete={handlePermanentDelete}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.has(bookmark.id)}
                        onToggleSelect={toggleSelect}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* 卡片视图（支持行优先/列优先布局） */}
                {viewMode === "card" && (
                  <div className={gridClassName}>
                    {bookmarks.map((bookmark) => (
                      <div key={bookmark.id} className="masonry-item">
                        <BookmarkCard
                          bookmark={bookmark}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onToggleRead={handleToggleRead}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedIds.has(bookmark.id)}
                          onToggleSelect={toggleSelect}
                          variant="card"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* 列表视图（list） */}
                {viewMode === "list" && (
                  <div className="space-y-4">
                    {bookmarks.map((bookmark) => (
                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleRead={handleToggleRead}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.has(bookmark.id)}
                        onToggleSelect={toggleSelect}
                        variant="list"
                      />
                    ))}
                  </div>
                )}

                {/* 紧凑视图（compact） */}
                {viewMode === "compact" && (
                  <div className="space-y-2">
                    {bookmarks.map((bookmark) => (
                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleRead={handleToggleRead}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.has(bookmark.id)}
                        onToggleSelect={toggleSelect}
                        variant="compact"
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* 加载更多按钮 */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    "加载更多"
                  )}
                </Button>
              </div>
            )}
          </>
        ) : isBrowserPlatform ? (
          <BrowserBookmarkEmptyState onImport={openBrowserImportDialog} />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* 底部添加收藏按钮 */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <Button
          className="w-full bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          size="lg"
          onClick={openCreateDialog}
        >
          <Plus className="size-5 mr-2" />
          添加收藏
        </Button>
      </div>

      {/* 批量导入对话框（URL导入） */}
      <BatchImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />

      {/* 浏览器书签导入对话框 */}
      <BrowserBookmarkImportDialog
        open={showBrowserImportDialog}
        onOpenChange={setShowBrowserImportDialog}
        onSuccess={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* 导出对话框 */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        bookmarks={bookmarks}
        selectedIds={selectedIds}
      />

      {/* 批量移动对话框 */}
      <BatchMoveDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        selectedIds={selectedIds}
        onSuccess={exitSelectionMode}
      />

      {/* 创建收藏对话框 */}
      <CreateBookmarkDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleBookmarkCreated}
      />

      {/* AI 文件夹推荐 Toast */}
      <FolderRecommendationToast
        recommendation={recommendation}
        bookmarkId={recommendationBookmarkId || 0}
        onApply={applyRecommendation}
        onDismiss={dismissRecommendation}
        onCustomize={handleCustomizeFolder}
      />
    </div>
  );
}
