/**
 * 书签预览列表组件
 *
 * 显示待综述的书签列表，支持排除特定书签
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { SynthesisSourceType } from "@/lib/synthesis";

interface PreviewBookmark {
  id: number;
  title: string;
  url: string;
  platform: string | null;
  ai_summary: string | null;
  created_at: string;
  folder_id: number | null;
  folder_name: string | null;
}

interface ContentStats {
  totalCount: number;
  withSummary: number;
  avgSummaryLength: number;
  platforms: Record<string, number>;
}

interface BookmarkPreviewListProps {
  sourceType: SynthesisSourceType;
  sourceId: string | null;
  bookmarkIds?: number[];
  excludedIds: number[];
  onExcludedChange: (excludedIds: number[]) => void;
  onStatsChange?: (stats: ContentStats) => void;
  maxHeight?: number;
}

/**
 * 书签预览列表
 */
export function BookmarkPreviewList({
  sourceType,
  sourceId,
  bookmarkIds,
  excludedIds,
  onExcludedChange,
  onStatsChange,
  maxHeight = 300,
}: BookmarkPreviewListProps) {
  const [bookmarks, setBookmarks] = useState<PreviewBookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [stats, setStats] = useState<ContentStats | null>(null);

  // 加载书签预览
  useEffect(() => {
    async function loadPreview() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          sourceType,
          pageSize: "100",
        });

        if (sourceId) {
          params.append("sourceId", sourceId);
        }

        if (bookmarkIds && bookmarkIds.length > 0) {
          params.append("bookmarkIds", bookmarkIds.join(","));
        }

        const response = await fetch(`/api/synthesis/preview?${params}`);

        if (!response.ok) {
          throw new Error("加载失败");
        }

        const result = await response.json();
        setBookmarks(result.bookmarks || []);
        setStats(result.contentStats);
        onStatsChange?.(result.contentStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setIsLoading(false);
      }
    }

    loadPreview();
  }, [sourceType, sourceId, bookmarkIds, onStatsChange]);

  // 过滤后的书签（排除已排除的）
  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((b) => !excludedIds.includes(b.id));
  }, [bookmarks, excludedIds]);

  // 排除书签
  const handleExclude = useCallback(
    (bookmarkId: number) => {
      onExcludedChange([...excludedIds, bookmarkId]);
    },
    [excludedIds, onExcludedChange],
  );

  // 恢复书签
  const handleRestore = useCallback(
    (bookmarkId: number) => {
      onExcludedChange(excludedIds.filter((id) => id !== bookmarkId));
    },
    [excludedIds, onExcludedChange],
  );

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
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">加载预览...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-6 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  const excludedBookmarks = bookmarks.filter((b) => excludedIds.includes(b.id));

  return (
    <div className="space-y-3">
      {/* 统计信息 */}
      {stats && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {filteredBookmarks.length} 篇书签
            {excludedIds.length > 0 && (
              <span className="text-amber-600 ml-1">
                （已排除 {excludedIds.length} 篇）
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              有摘要: {stats.withSummary}
            </Badge>
          </div>
        </div>
      )}

      {/* 警告提示 */}
      {filteredBookmarks.length < 3 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 p-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              书签数量不足，建议至少 3 篇以获得更好的综述效果
            </span>
          </div>
        </div>
      )}

      {/* 书签列表 */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between px-3"
          >
            <span className="text-sm font-medium">书签列表</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ScrollArea
            className="border rounded-lg mt-2"
            style={{ maxHeight: `${maxHeight}px` }}
          >
            <div className="divide-y">
              {filteredBookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {bookmark.title}
                      </span>
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getPlatformLabel(bookmark.platform)}
                      </Badge>
                      {!bookmark.ai_summary && (
                        <span className="text-xs text-amber-600">无摘要</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleExclude(bookmark.id)}
                    title="排除此书签"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      {/* 已排除书签 */}
      {excludedBookmarks.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start px-3 text-muted-foreground"
            >
              <span className="text-sm">
                已排除 ({excludedBookmarks.length})
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-1">
              {excludedBookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md",
                    "bg-muted/30 text-muted-foreground",
                  )}
                >
                  <span className="text-sm truncate">{bookmark.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(bookmark.id)}
                  >
                    恢复
                  </Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
