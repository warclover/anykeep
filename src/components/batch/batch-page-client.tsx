/**
 * 批量操作页面客户端组件
 * 提供批量标签管理、删除、移动等操作
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckSquare, Filter } from "lucide-react";
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
import { useSelectionMode } from "@/hooks/core/use-selection-mode";
import { useBookmarksSWR } from "@/lib/cache/hooks/use-bookmarks-swr";
import { BATCH_TEXT } from "./constants";
import type { BatchTagsResult } from "@/lib/batch/validation";
import type { BookmarkWithFolder } from "@/lib/export/types";

/**
 * 平台选项
 */
const PLATFORM_OPTIONS = [
  { value: "", label: "全部平台" },
  { value: "WECHAT", label: "微信" },
  { value: "BILIBILI", label: "B站" },
  { value: "XIAOHONGSHU", label: "小红书" },
  { value: "ZHIHU", label: "知乎" },
  { value: "WEIBO", label: "微博" },
  { value: "DOUYIN", label: "抖音" },
  { value: "browser", label: "浏览器书签" },
  { value: "OTHER", label: "其他" },
] as const;

/**
 * 排序选项
 */
const SORT_OPTIONS = [
  { value: "created_desc", label: "最新添加" },
  { value: "created_asc", label: "最早添加" },
  { value: "title_asc", label: "标题 A-Z" },
  { value: "title_desc", label: "标题 Z-A" },
] as const;

/**
 * 批量操作页面客户端组件
 */
export function BatchPageClient() {
  const router = useRouter();

  // 筛选状态
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState("created_desc");

  // 批量标签对话框
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);

  // 导出对话框
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // 书签数据
  const {
    data: bookmarks,
    isLoading,
    updateCacheItem,
    createSnapshot: _createSnapshot,
    rollback: _rollback,
  } = useBookmarksSWR({
    platform,
    sort,
    folder: "",
    pageSize: 200, // 批量页面加载更多数据
    enabled: true,
  });

  // 所有书签 ID（用于 Shift 选择）
  const allBookmarkIds = useMemo(() => bookmarks.map((b) => b.id), [bookmarks]);

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
              (t) => !result.tags.includes(t),
            );
            return { ...bookmark, user_tags: newTags };
          }
        });
      });
    },
    [updateCacheItem],
  );

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
    <div className="flex flex-col h-full">
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
              <SelectValue placeholder="全部平台" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 排序 */}
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
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
          <span>{BATCH_TEXT.TOTAL_COUNT(bookmarks.length)}</span>
          <div className="flex items-center gap-4">
            <span>
              <kbd className="mx-1 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                Shift
              </kbd>
              +点击 范围选择
            </span>
            <span>
              <kbd className="mx-1 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                Esc
              </kbd>
              清空选择
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
    </div>
  );
}
