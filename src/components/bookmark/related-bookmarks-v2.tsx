/**
 * 相关书签组件 V2 - 知识关联版
 *
 * 使用知识关联 API 展示相关书签
 * 支持多种关联类型：语义相似、实体匹配、标签匹配
 *
 * @version 2.0.0
 * @since 2025-12-15
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Folder,
  Sparkles,
  ChevronRight,
  Brain,
  Users,
  Tag,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LinkType, RelatedBookmark } from "@/lib/knowledge-link";

// ============================================================================
// Types
// ============================================================================

interface RelatedBookmarksV2Props {
  bookmarkId: number;
  className?: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 最大显示数量 */
  limit?: number;
  /** 最小关联强度 */
  minStrength?: number;
  /** 关联类型过滤 */
  types?: LinkType[];
}

interface ApiResponse {
  success: boolean;
  data?: {
    related: RelatedBookmark[];
    totalCount: number;
  };
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const LINK_TYPE_CONFIG: Record<
  LinkType,
  { label: string; icon: typeof Brain; color: string }
> = {
  semantic: {
    label: "语义相似",
    icon: Brain,
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  entity: {
    label: "共享实体",
    icon: Users,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  tag: {
    label: "共享标签",
    icon: Tag,
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  topic: {
    label: "同主题",
    icon: Layers,
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
};

// ============================================================================
// Component
// ============================================================================

export function RelatedBookmarksV2({
  bookmarkId,
  className,
  defaultExpanded = true,
  limit = 5,
  minStrength = 0.3,
  types,
}: RelatedBookmarksV2Props) {
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
        // 构建查询参数
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("minStrength", String(minStrength));
        if (types && types.length > 0) {
          params.set("types", types.join(","));
        }

        const response = await fetch(
          `/api/knowledge-link/related/${bookmarkId}?${params.toString()}`,
        );

        const data: ApiResponse = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "获取相关书签失败");
        }

        if (data.success && data.data?.related) {
          setRelated(data.data.related);
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
  }, [bookmarkId, limit, minStrength, types, isExpanded]);

  // 强度标签颜色
  const getStrengthColor = (strength: number) => {
    if (strength >= 0.8)
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    if (strength >= 0.6)
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    if (strength >= 0.4)
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
            知识关联
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
              暂无知识关联
            </div>
          ) : (
            // 相关书签列表
            <div className="space-y-2">
              {related.map((item) => {
                const typeConfig = LINK_TYPE_CONFIG[item.link.type];
                const TypeIcon = typeConfig.icon;

                return (
                  <Card
                    key={item.bookmark.id}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    onClick={() => router.push(`/bookmark/${item.bookmark.id}`)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        {/* 左侧：标题和关联信息 */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {item.bookmark.title}
                          </h4>

                          {/* 关联类型徽章 */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs font-normal gap-1",
                                    typeConfig.color,
                                  )}
                                >
                                  <TypeIcon className="size-3" />
                                  {typeConfig.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {item.link.type === "entity" &&
                                  item.link.sharedItems.length > 0 && (
                                    <span>
                                      共享实体:{" "}
                                      {item.link.sharedItems.join(", ")}
                                    </span>
                                  )}
                                {item.link.type === "tag" &&
                                  item.link.sharedItems.length > 0 && (
                                    <span>
                                      共享标签:{" "}
                                      {item.link.sharedItems.join(", ")}
                                    </span>
                                  )}
                                {item.link.type === "semantic" && (
                                  <span>基于向量语义相似度</span>
                                )}
                                {item.link.type === "topic" && (
                                  <span>属于同一主题聚类</span>
                                )}
                              </TooltipContent>
                            </Tooltip>

                            {/* 共享项目预览 */}
                            {item.link.sharedItems.length > 0 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {item.link.sharedItems.slice(0, 2).join("、")}
                                {item.link.sharedItems.length > 2 && "..."}
                              </span>
                            )}
                          </div>

                          {/* 平台信息 */}
                          {item.bookmark.platform && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                              <Folder className="size-3" />
                              <span>{item.bookmark.platform}</span>
                            </div>
                          )}
                        </div>

                        {/* 右侧：强度和操作 */}
                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            className={cn(
                              "text-xs font-medium",
                              getStrengthColor(item.link.strength),
                            )}
                          >
                            {Math.round(item.link.strength * 100)}%
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                item.bookmark.url,
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
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
