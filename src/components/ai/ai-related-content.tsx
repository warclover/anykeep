/**
 * AI 相关内容推荐组件
 *
 * 基于当前书签推荐相似内容
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { aiRelatedContentKeys } from "@/hooks/queries/keys";
import {
  Compass,
  RefreshCw,
  Loader2,
  BookmarkIcon,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface AIRelatedContentProps {
  /** 当前书签 ID */
  bookmarkId: number;
  /** 当前书签标题 */
  bookmarkTitle?: string;
  /** 最大显示数量 */
  maxItems?: number;
  /** 自定义类名 */
  className?: string;
  /** 点击书签回调 */
  onBookmarkClick?: (bookmarkId: number) => void;
}

interface RelatedBookmark {
  id: number;
  title: string;
  url: string;
  description?: string;
  platform: string;
  similarity: number;
  tags?: string[];
  createdAt: string;
}

// ============================================
// 组件
// ============================================

async function fetchRelatedBookmarks(
  bookmarkId: number,
  maxItems: number,
): Promise<RelatedBookmark[]> {
  const params = new URLSearchParams({
    limit: maxItems.toString(),
    minSimilarity: "0.3",
  });
  const response = await fetch(
    `/api/bookmarks/${bookmarkId}/related?${params.toString()}`,
  );
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || "获取相关内容失败");
  }

  return (data.data?.related || []).map(
    (item: {
      id: number;
      title: string;
      url: string;
      description: string | null;
      similarity: number;
      platform: string | null;
      createdAt: string;
    }) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      description: item.description ?? undefined,
      platform: item.platform || "OTHER",
      similarity: item.similarity,
      tags: [],
      createdAt: item.createdAt,
    }),
  );
}

export function AIRelatedContent({
  bookmarkId,
  bookmarkTitle: _bookmarkTitle,
  maxItems = 5,
  className,
  onBookmarkClick,
}: AIRelatedContentProps) {
  const queryClient = useQueryClient();

  const {
    data: relatedItems = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: aiRelatedContentKeys.byBookmark(bookmarkId, maxItems),
    queryFn: () => fetchRelatedBookmarks(bookmarkId, maxItems),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const error = queryError instanceof Error ? queryError.message : null;

  const fetchRelatedContent = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: aiRelatedContentKeys.byBookmark(bookmarkId, maxItems),
    });
    void refetch();
  }, [queryClient, refetch, bookmarkId, maxItems]);

  /**
   * 格式化相似度
   */
  const formatSimilarity = (similarity: number): string => {
    return `${Math.round(similarity * 100)}%`;
  };

  /**
   * 格式化日期
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  /**
   * 获取平台图标颜色
   */
  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      wechat: "bg-green-500",
      weixin: "bg-green-500",
      zhihu: "bg-blue-500",
      bilibili: "bg-pink-500",
      xiaohongshu: "bg-red-500",
      juejin: "bg-blue-600",
      default: "bg-gray-500",
    };
    return colors[platform.toLowerCase()] || colors.default;
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Compass className="size-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">相关内容</CardTitle>
              <CardDescription className="text-xs">
                AI 推荐的相似收藏
              </CardDescription>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={fetchRelatedContent}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-10 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : relatedItems.length === 0 ? (
          <div className="text-center py-6">
            <Compass className="size-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">暂未找到相关内容</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              收藏更多内容后，AI 将为你推荐相似文章
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {relatedItems.map((item) => (
              <div
                key={item.id}
                className="group flex gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onBookmarkClick?.(item.id)}
              >
                {/* 平台指示器 */}
                <div
                  className={cn(
                    "flex-shrink-0 size-10 rounded flex items-center justify-center",
                    getPlatformColor(item.platform),
                  )}
                >
                  <BookmarkIcon className="size-5 text-white" />
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    <Badge
                      variant="secondary"
                      className="flex-shrink-0 text-xs"
                    >
                      {formatSimilarity(item.similarity)}
                    </Badge>
                  </div>

                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(item.createdAt)}
                    </span>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex gap-1">
                        {item.tags.slice(0, 2).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs px-1 py-0"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 箭头 */}
                <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
              </div>
            ))}

            {/* 查看更多 */}
            {relatedItems.length >= maxItems && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
              >
                查看更多相关内容
                <ChevronRight className="size-3 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIRelatedContent;
