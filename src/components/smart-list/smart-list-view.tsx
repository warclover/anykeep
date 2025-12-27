/**
 * 智能列表视图组件
 * @description 显示智能列表的书签内容
 * @version 10.0.0
 */

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Star,
  BookOpen,
  Award,
  Eye,
  RefreshCcw,
  Filter,
  ArrowLeft,
  Loader2,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkCard } from "@/components/bookmark/bookmark-card";
import { SMART_LIST_COLORS } from "@/lib/smart-list/presets";
import { useSmartListBookmarks } from "@/hooks/data";
import { useSmartLists } from "@/hooks/data";
import { SmartListEditorDialog } from "./smart-list-editor-dialog";
import type {
  SmartListColor,
  UpdateSmartListRequest,
} from "@/types/smart-list";

// ============================================
// 图标映射
// ============================================

const ICON_MAP: Record<string, typeof Calendar> = {
  calendar: Calendar,
  star: Star,
  "book-open": BookOpen,
  award: Award,
  eye: Eye,
  "refresh-ccw": RefreshCcw,
  filter: Filter,
};

export interface SmartListViewProps {
  /** 智能列表 ID */
  smartListId: number;
  /** 视图模式 */
  viewMode?: "card" | "list";
  /** 选择模式相关 */
  isSelectionMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
}

// ============================================
// 组件实现
// ============================================

export function SmartListView({
  smartListId,
  viewMode: _viewMode = "card",
  isSelectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}: SmartListViewProps) {
  const router = useRouter();

  // 获取智能列表数据和书签
  const {
    smartList,
    bookmarks,
    hasMore,
    total,
    isLoading,
    error,
    refresh,
    loadMore,
  } = useSmartListBookmarks({
    smartListId,
    enabled: true,
  });

  // 获取智能列表操作方法
  const { update, preview } = useSmartLists();

  // 编辑对话框状态
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 获取图标组件
  const IconComponent = smartList ? ICON_MAP[smartList.icon] || Filter : Filter;

  // 获取颜色配置
  const colorConfig = smartList
    ? SMART_LIST_COLORS[smartList.color as SmartListColor] ||
      SMART_LIST_COLORS.default
    : SMART_LIST_COLORS.default;

  // 返回首页
  const handleBack = useCallback(() => {
    router.push("/home");
  }, [router]);

  // 编辑书签
  const handleEdit = useCallback(
    (id: number) => {
      router.push(`/bookmark/${id}`);
    },
    [router],
  );

  // 删除书签（乐观更新）
  const handleDelete = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/bookmarks/${id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "删除失败");
        }

        toast.success("删除成功");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "删除失败");
      }
    },
    [refresh],
  );

  // 切换阅读状态
  const handleToggleRead = useCallback(
    async (id: number, isRead: boolean) => {
      try {
        const res = await fetch(`/api/bookmarks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "更新失败");
        }

        toast.success(isRead ? "已标记为已读" : "已标记为未读");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "更新失败");
      }
    },
    [refresh],
  );

  // 加载更多
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      await loadMore();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, loadMore]);

  // 保存编辑
  const handleSave = useCallback(
    async (data: UpdateSmartListRequest) => {
      if (!smartList) return;
      await update(smartList.id, data);
      refresh();
    },
    [smartList, update, refresh],
  );

  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {/* 头部骨架 */}
        <div className="px-4 md:px-8 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>

        {/* 内容骨架 */}
        <div className="flex-1 overflow-auto px-4 md:px-8 py-4">
          <div className="masonry-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="masonry-item">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <Skeleton className="w-full h-40" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !smartList) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {error?.message || "智能列表不存在"}
        </p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="size-4 mr-2" />
          返回首页
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 智能列表头部：移动端紧凑布局 */}
      <header className="px-3 md:px-8 py-3 md:py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 md:gap-4">
          {/* 返回按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="shrink-0 size-9 md:size-10"
            aria-label="返回首页"
          >
            <ArrowLeft className="size-5" />
          </Button>

          {/* 图标：移动端稍小 */}
          <div
            className={cn(
              "size-10 md:size-12 rounded-lg flex items-center justify-center shrink-0",
              colorConfig.bg,
            )}
          >
            <IconComponent
              className={cn("size-5 md:size-6", colorConfig.text)}
            />
          </div>

          {/* 标题和描述 */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate">
              {smartList.name}
            </h1>
            {smartList.description && (
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate hidden sm:block">
                {smartList.description}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 md:mt-1">
              共 {total} 条收藏
            </p>
          </div>

          {/* 操作按钮：移动端仅图标 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 编辑按钮（仅非预设列表可编辑筛选条件） */}
            {!smartList.isPreset && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsEditorOpen(true)}
                className="size-9 md:size-auto md:px-3 md:py-1.5"
                aria-label="编辑智能列表"
              >
                <Edit className="size-4" />
                <span className="hidden md:inline ml-1.5">编辑</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 书签列表内容 */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-4">
        {bookmarks.length > 0 ? (
          <>
            {/* 卡片视图 */}
            <div className="masonry-grid">
              {bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="masonry-item">
                  <BookmarkCard
                    bookmark={bookmark}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleRead={handleToggleRead}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(bookmark.id)}
                    onToggleSelect={onToggleSelect}
                    variant="card"
                  />
                </div>
              ))}
            </div>

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
        ) : (
          // 空状态
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className={cn(
                "size-16 rounded-full flex items-center justify-center mb-4",
                colorConfig.bg,
              )}
            >
              <IconComponent className={cn("size-8", colorConfig.text)} />
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              暂无符合条件的收藏
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              当有新内容符合筛选条件时会自动显示在这里
            </p>
          </div>
        )}
      </div>

      {/* 编辑对话框 */}
      {!smartList.isPreset && (
        <SmartListEditorDialog
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          smartList={smartList}
          onSave={handleSave}
          onPreview={preview}
        />
      )}
    </div>
  );
}

export default SmartListView;
