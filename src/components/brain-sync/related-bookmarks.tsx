/**
 * 延伸阅读组件
 *
 * 在复习时显示相关书签推荐，支持懒加载
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Tag,
  Folder,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RelatedBookmark } from "@/types/brain-sync";

// ============================================
// 类型定义
// ============================================

interface RelatedBookmarksProps {
  /** 当前书签 ID */
  bookmarkId: number;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 最大显示数量 */
  limit?: number;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 根据相关原因返回图标
 */
function getRelevanceIcon(reason: string) {
  if (reason.startsWith("共同标签")) {
    return <Tag className="h-3 w-3" />;
  }
  if (reason === "同一文件夹") {
    return <Folder className="h-3 w-3" />;
  }
  return <FileText className="h-3 w-3" />;
}

/**
 * 根据相似度返回颜色类
 */
function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.7) return "text-green-600";
  if (similarity >= 0.5) return "text-yellow-600";
  return "text-muted-foreground";
}

// ============================================
// 组件实现
// ============================================

export function RelatedBookmarks({
  bookmarkId,
  defaultExpanded = false,
  limit = 3,
  className,
}: RelatedBookmarksProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isLoading, setIsLoading] = useState(false);
  const [relatedBookmarks, setRelatedBookmarks] = useState<RelatedBookmark[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // 懒加载：展开时才获取数据
  useEffect(() => {
    if (isExpanded && !hasFetched) {
      fetchRelatedBookmarks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, hasFetched, bookmarkId]);

  const fetchRelatedBookmarks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/brain-sync/related?bookmarkId=${bookmarkId}&limit=${limit}`,
      );

      if (!response.ok) {
        throw new Error("获取相关书签失败");
      }

      const data = await response.json();

      if (data.success) {
        setRelatedBookmarks(data.relatedBookmarks || []);
      } else {
        throw new Error(data.error || "获取相关书签失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取相关书签失败");
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // 如果已加载且没有数据，不显示组件
  if (hasFetched && relatedBookmarks.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="pb-2">
        <Button
          variant="ghost"
          className="w-full justify-between p-0 h-auto hover:bg-transparent"
          onClick={toggleExpanded}
        >
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            延伸阅读
            {hasFetched && relatedBookmarks.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {relatedBookmarks.length}
              </Badge>
            )}
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {isLoading ? (
            // 加载骨架
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-4 w-4 rounded-full mt-1" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            // 错误状态
            <div className="text-sm text-muted-foreground text-center py-4">
              {error}
              <Button
                variant="link"
                size="sm"
                onClick={fetchRelatedBookmarks}
                className="ml-2"
              >
                重试
              </Button>
            </div>
          ) : (
            // 相关书签列表
            <div className="space-y-3">
              {relatedBookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="flex items-start gap-3 group hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <div className="mt-1 text-muted-foreground">
                    {getRelevanceIcon(bookmark.relevanceReason)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <a
                      href={`/bookmarks/${bookmark.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:text-primary hover:underline line-clamp-2 flex items-center gap-1"
                    >
                      {bookmark.title}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </a>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {bookmark.relevanceReason}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          getSimilarityColor(bookmark.similarity),
                        )}
                      >
                        {Math.round(bookmark.similarity * 100)}% 相关
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
