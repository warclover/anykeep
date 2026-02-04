/**
 * 手动书签选择器组件
 *
 * 用于在综述创建时手动选择书签
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Loader2,
  CheckSquare,
  Square,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ManualSelectorProps,
  SourceSelection,
  PreviewBookmark,
} from "./types";
import { clientLogger } from "@/lib/client-logger";

/**
 * 手动书签选择器
 */
export function ManualSelector({
  onSelect,
  onCancel,
  disabled,
  initialBookmarkIds,
}: ManualSelectorProps) {
  const [bookmarks, setBookmarks] = useState<PreviewBookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(initialBookmarkIds || []),
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 加载书签列表
  const loadBookmarks = useCallback(
    async (pageNum: number, append = false) => {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          pageSize: "20",
        });

        if (searchQuery) {
          params.append("search", searchQuery);
        }

        const response = await fetch(`/api/bookmarks?${params}`);
        if (response.ok) {
          const result = await response.json();
          const newBookmarks = result.data || [];

          if (append) {
            setBookmarks((prev) => [...prev, ...newBookmarks]);
          } else {
            setBookmarks(newBookmarks);
          }

          setHasMore(result.pagination?.hasMore ?? false);
        }
      } catch (error) {
        clientLogger.error({ error }, "Failed to load bookmarks:");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [searchQuery],
  );

  // 初始加载
  useEffect(() => {
    loadBookmarks(1);
  }, [loadBookmarks]);

  // 搜索时重置
  useEffect(() => {
    setPage(1);
    loadBookmarks(1);
  }, [searchQuery, loadBookmarks]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadBookmarks(nextPage, true);
  }, [page, loadBookmarks]);

  // 切换选择
  const toggleSelection = useCallback((bookmarkId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookmarkId)) {
        next.delete(bookmarkId);
      } else {
        next.add(bookmarkId);
      }
      return next;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === bookmarks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookmarks.map((b) => b.id)));
    }
  }, [selectedIds.size, bookmarks]);

  // 计算统计信息
  const stats = useMemo(() => {
    const selected = bookmarks.filter((b) => selectedIds.has(b.id));
    const withSummary = selected.filter(
      (b) => b.ai_summary && b.ai_summary.length > 0,
    );
    const platforms: Record<string, number> = {};
    selected.forEach((b) => {
      const platform = b.platform || "unknown";
      platforms[platform] = (platforms[platform] || 0) + 1;
    });

    return {
      totalCount: selectedIds.size,
      withSummary: withSummary.length,
      avgSummaryLength:
        withSummary.length > 0
          ? Math.round(
              withSummary.reduce(
                (sum, b) => sum + (b.ai_summary?.length || 0),
                0,
              ) / withSummary.length,
            )
          : 0,
      platforms,
    };
  }, [bookmarks, selectedIds]);

  // 确认选择
  const handleConfirm = useCallback(() => {
    if (selectedIds.size === 0) return;

    const selection: SourceSelection = {
      sourceType: "selection",
      sourceId: null,
      sourceName: `${selectedIds.size} 篇书签`,
      bookmarkIds: Array.from(selectedIds),
      excludedIds: [],
      contentStats: stats,
    };

    onSelect(selection);
  }, [selectedIds, stats, onSelect]);

  // 获取平台显示名称
  const getPlatformLabel = (platform: string | null): string => {
    const platformMap: Record<string, string> = {
      wechat: "微信",
      bilibili: "B站",
      zhihu: "知乎",
      weibo: "微博",
      xiaohongshu: "小红书",
      twitter: "Twitter",
      youtube: "YouTube",
      unknown: "其他",
    };
    return platformMap[platform || "unknown"] || platform || "其他";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">选择书签</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSelectAll}
          disabled={disabled || bookmarks.length === 0}
        >
          {selectedIds.size === bookmarks.length ? "取消全选" : "全选当前页"}
        </Button>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索书签..."
          className="pl-9"
          disabled={disabled}
        />
      </div>

      {/* 书签列表 */}
      <ScrollArea className="h-[280px] border rounded-lg">
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckSquare className="h-8 w-8 mb-2" />
            <p className="text-sm">
              {searchQuery ? "未找到匹配的书签" : "暂无书签"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {bookmarks.map((bookmark) => {
              const isSelected = selectedIds.has(bookmark.id);
              return (
                <button
                  key={bookmark.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleSelection(bookmark.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 text-left transition-colors",
                    "hover:bg-muted/50",
                    isSelected && "bg-primary/5",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {bookmark.title}
                      </span>
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-primary shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getPlatformLabel(bookmark.platform)}
                      </Badge>
                      {bookmark.folder_name && (
                        <span className="text-xs text-muted-foreground truncate">
                          {bookmark.folder_name}
                        </span>
                      )}
                    </div>
                    {bookmark.ai_summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {bookmark.ai_summary}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
            {hasMore && (
              <div className="p-3 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    "加载更多"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* 已选统计 */}
      {selectedIds.size > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">已选书签</span>
              <span className="font-medium">{stats.totalCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">有摘要</span>
              <span className="font-medium">
                {stats.withSummary} / {stats.totalCount}
              </span>
            </div>
            {stats.totalCount < 3 && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ 建议至少选择 3 篇书签以获得更好的综述效果
              </p>
            )}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={disabled}>
          取消
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={disabled || selectedIds.size < 3}
        >
          确认选择 ({selectedIds.size})
        </Button>
      </div>
    </div>
  );
}
