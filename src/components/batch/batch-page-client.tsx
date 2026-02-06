/**
 * 批量操作页面客户端组件
 * 提供批量标签管理、删除、移动等操作
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckSquare, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BatchToolbar } from "./batch-toolbar";
import { BatchBookmarkList } from "./batch-bookmark-list";
import { BatchTagDialog } from "./batch-tag-dialog";
import { ExportDialogV2 } from "@/components/export";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSelectionMode } from "@/hooks/core/use-selection-mode";
import { useBookmarksSWR } from "@/lib/cache/hooks/use-bookmarks-swr";
import { BATCH_TEXT } from "./constants";
import type { BatchTagsResult } from "@/lib/batch/validation";
import type { BookmarkWithFolder } from "@/lib/export/types";
import { clientLogger } from "@/lib/client-logger";
// 国际化
import { useUiText } from "@/lib/i18n";

/**
 * 平台选项（不包含标签，标签由 i18n 提供）
 */
const PLATFORM_OPTIONS = [
  { value: "all", i18nKey: "all" },
  { value: "WECHAT_OFFICIAL_ACCOUNT", i18nKey: "wechat" },
  { value: "BILIBILI", i18nKey: "bilibili" },
  { value: "XIAOHONGSHU", i18nKey: "xiaohongshu" },
  { value: "browser", i18nKey: "browser" },
] as const;

/**
 * 排序选项（不包含标签，标签由 i18n 提供）
 */
const SORT_OPTIONS = [
  { value: "created_desc", i18nKey: "newest" },
  { value: "created_asc", i18nKey: "oldest" },
  { value: "title_asc", i18nKey: "titleAZ" },
  { value: "title_desc", i18nKey: "titleZA" },
] as const;

/**
 * 批量操作页面客户端组件
 */
export function BatchPageClient() {
  const router = useRouter();
  // 国际化
  const t = useUiText();

  // 客户端挂载状态（防止 Hydration 错误）
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 筛选状态
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState("created_desc");

  // 批量标签对话框
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);

  // 导出对话框
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // 综述确认对话框
  const [isSynthesisDialogOpen, setIsSynthesisDialogOpen] = useState(false);
  const [isCreatingSynthesis, setIsCreatingSynthesis] = useState(false);

  // 书签数据
  const {
    data: bookmarks,
    isLoading,
    updateCacheItem,
    createSnapshot: _createSnapshot,
    rollback: _rollback,
  } = useBookmarksSWR({
    platform: platform === "all" ? "" : platform,
    sort,
    folder: "",
    pageSize: 200, // 批量页面加载更多数据
    enabled: true,
  });

  // 所有书签 ID（用于 Shift 选择）
  const allBookmarkIds = useMemo(() => bookmarks.map((b) => b.id), [bookmarks]);

  // 平台选项（带 i18n 标签）
  const platformOptions = useMemo(
    () =>
      PLATFORM_OPTIONS.map((option) => ({
        ...option,
        label:
          t.batch.platform[option.i18nKey as keyof typeof t.batch.platform],
      })),
    [t],
  );

  // 排序选项（带 i18n 标签）
  const sortOptions = useMemo(
    () =>
      SORT_OPTIONS.map((option) => ({
        ...option,
        label: t.batch.sort[option.i18nKey as keyof typeof t.batch.sort],
      })),
    [t],
  );

  // 选择模式（批量页面始终启用）
  const {
    selectedIds,
    toggleSelect: _toggleSelect,
    selectAll,
    deselectAll,
    handleItemClick,
  } = useSelectionMode();

  // 获取选中的书签
  const selectedBookmarks = useMemo(
    () => bookmarks.filter((b) => selectedIds.has(b.id)),
    [bookmarks, selectedIds],
  );

  // 全选
  const handleSelectAll = useCallback(() => {
    selectAll(allBookmarkIds);
  }, [selectAll, allBookmarkIds]);

  // 批量标签操作成功回调
  const handleBatchTagsSuccess = useCallback(
    (result: BatchTagsResult) => {
      // 更新缓存
      result.affectedIds.forEach((id) => {
        updateCacheItem(id, (bookmark) => {
          if (result.action === "add") {
            const newTags = [
              ...new Set([...(bookmark.user_tags || []), ...result.tags]),
            ];
            return { ...bookmark, user_tags: newTags };
          } else {
            const newTags = (bookmark.user_tags || []).filter(
              (t: string) => !result.tags.includes(t),
            );
            return { ...bookmark, user_tags: newTags };
          }
        });
      });
    },
    [updateCacheItem],
  );

  // 创建综述
  /* eslint-disable react-hooks/exhaustive-deps -- t 是稳定的 hook 返回值，不需要作为依赖 */
  const handleCreateSynthesis = useCallback(async () => {
    if (selectedIds.size < 3) return;

    setIsCreatingSynthesis(true);
    try {
      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "selection",
          bookmarkIds: Array.from(selectedIds),
          depthMode: "standard",
        }),
      });

      if (!response.ok) {
        throw new Error(t.batch.synthesis.createFailed);
      }

      const { data } = await response.json();
      // 跳转到生成页面
      router.push(`/synthesis/${data.id}?generate=true`);
    } catch (error) {
      clientLogger.error({ error }, "Create synthesis error:");
      // 使用 toastService 显示错误提示
      const { toastService } = await import(
        "@/lib/notifications/toast/toast.service"
      );
      toastService.error(
        t.batch.synthesis.createFailed,
        error instanceof Error ? error.message : t.batch.synthesis.createError,
      );
    } finally {
      setIsCreatingSynthesis(false);
      setIsSynthesisDialogOpen(false);
    }
  }, [selectedIds, router]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // 监听 Esc 键清空选择
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        deselectAll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deselectAll]);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* 页面头部 */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-gray-950">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-6 w-6 text-purple-500" />
          <h1 className="text-xl font-semibold">{BATCH_TEXT.PAGE_TITLE}</h1>
        </div>
        <Button variant="outline" onClick={() => router.push("/home")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {BATCH_TEXT.BACK_TO_HOME}
        </Button>
      </header>

      {/* 筛选栏 */}
      <div className="px-6 py-3 border-b bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-4">
          <Filter className="h-4 w-4 text-gray-500" />

          {/* 平台筛选 */}
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t.batch.filter.allPlatforms} />
            </SelectTrigger>
            <SelectContent>
              {platformOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 排序 */}
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t.batch.filter.sort} />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 批量工具栏 */}
      {selectedIds.size > 0 && (
        <BatchToolbar
          selectedCount={selectedIds.size}
          totalCount={bookmarks.length}
          onSelectAll={handleSelectAll}
          onClearSelection={deselectAll}
          onOpenTagDialog={() => setIsTagDialogOpen(true)}
          onOpenExportDialog={() => setIsExportDialogOpen(true)}
          onOpenSynthesisDialog={() => setIsSynthesisDialogOpen(true)}
        />
      )}

      {/* 书签列表 */}
      <div className="flex-1 overflow-hidden">
        <BatchBookmarkList
          bookmarks={bookmarks}
          selectedIds={selectedIds}
          isLoading={isLoading}
          allIds={allBookmarkIds}
          onItemClick={handleItemClick}
        />
      </div>

      {/* 底部状态栏 */}
      <footer className="px-6 py-2 border-t bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center justify-between">
          <span>
            {isMounted
              ? BATCH_TEXT.TOTAL_COUNT(bookmarks.length)
              : t.batch.loading}
          </span>
          <div className="flex items-center gap-4">
            <span>
              <kbd className="mx-1 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                Shift
              </kbd>
              {t.batch.shortcuts.rangeSelect}
            </span>
            <span>
              <kbd className="mx-1 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                Esc
              </kbd>
              {t.batch.shortcuts.clearSelection}
            </span>
          </div>
        </div>
      </footer>

      {/* 批量标签对话框 */}
      <BatchTagDialog
        open={isTagDialogOpen}
        onOpenChange={setIsTagDialogOpen}
        selectedIds={Array.from(selectedIds)}
        selectedBookmarks={selectedBookmarks}
        onSuccess={handleBatchTagsSuccess}
      />

      {/* 导出对话框 */}
      <ExportDialogV2
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        mode="selected"
        bookmarks={selectedBookmarks as BookmarkWithFolder[]}
        onSuccess={() => setIsExportDialogOpen(false)}
      />

      {/* 综述确认对话框 */}
      <AlertDialog
        open={isSynthesisDialogOpen}
        onOpenChange={setIsSynthesisDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.batch.synthesis.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.batch.synthesis.description.replace(
                "{count}",
                String(selectedIds.size),
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCreatingSynthesis}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateSynthesis}
              disabled={isCreatingSynthesis}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isCreatingSynthesis ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.batch.synthesis.creating}
                </>
              ) : (
                t.batch.synthesis.start
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
