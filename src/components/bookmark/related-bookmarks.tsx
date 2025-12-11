/**
 * 相关书签组件
 * Phase 2.2: 在书签详情页展示语义相关的其他书签
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Folder, Sparkles, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface RelatedBookmark {
  id: number;
  title: string;
  url: string;
  description: string | null;
  similarity: number;
  folderId: number | null;
  folderName: string | null;
  platform: string | null;
  createdAt: string;
}

interface RelatedBookmarksProps {
  bookmarkId: number;
  className?: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 最大显示数量 */
  limit?: number;
}

export function RelatedBookmarks({
  bookmarkId,
  className,
  defaultExpanded = true,
  limit = 5,
}: RelatedBookmarksProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isLoading, setIsLoading] = useState(true);
  const [related, setRelated] = useState<RelatedBookmark[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRelated = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/bookmarks/${bookmarkId}/related?limit=${limit}&minSimilarity=0.5`,
        );

        const data = await response.json();

        if (!response.ok) {
          // 提取 API 返回的具体错误信息
          const errorMessage =
            data?.error?.message || data?.message || "获取相关书签失败";
          throw new Error(errorMessage);
        }

        if (data.success && data.data?.related) {
          setRelated(data.data.related);
        } else if (data.data?.message) {
          // 显示 API 返回的提示信息（如：书签尚未生成向量索引）
          setError(data.data.message);
          setRelated([]);
        } else {
          setRelated([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
        setRelated([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (isExpanded) {
      fetchRelated();
    }
  }, [bookmarkId, limit, isExpanded]);

  // 相似度标签颜色
  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8)
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    if (similarity >= 0.7)
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    if (similarity >= 0.6)
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  // 如果没有相关书签且未加载，不显示
  if (!isLoading && related.length === 0 && !error) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* 标题栏 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-purple-500" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            相关收藏
          </h3>
          {!isLoading && related.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {related.length}
            </Badge>
          )}
        </div>
        <ChevronRight
          className={cn(
            "size-4 text-gray-400 transition-transform duration-200",
            isExpanded && "rotate-90",
          )}
        />
      </button>

      {/* 内容区域 */}
      {isExpanded && (
        <div className="space-y-2">
          {isLoading ? (
            // 加载状态
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            // 错误状态
            <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
              {error}
            </div>
          ) : related.length === 0 ? (
            // 空状态
            <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
              暂无相关收藏
            </div>
          ) : (
            // 相关书签列表
            <div className="space-y-2">
              {related.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => router.push(`/bookmark/${item.id}`)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      {/* 左侧：标题和描述 */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.title}
                        </h4>
                        {item.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        )}
                        {/* 文件夹信息 */}
                        {item.folderName && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-blue-600 dark:text-blue-400">
                            <Folder className="size-3" />
                            <span>{item.folderName}</span>
                          </div>
                        )}
                      </div>

                      {/* 右侧：相似度和操作 */}
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          className={cn(
                            "text-xs font-medium",
                            getSimilarityColor(item.similarity),
                          )}
                        >
                          {Math.round(item.similarity * 100)}%
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              item.url,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                        >
                          <ExternalLink className="size-3 text-gray-400" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
