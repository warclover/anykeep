/**
 * 相关书签组件 V2 - 知识关联版
 *
 * 使用知识关联 API 展示相关书签
 * 支持多种关联类型：语义相似、实体匹配、标签匹配
 *
 * @version 2.1.0 - 迁移至 TanStack Query
 * @since 2025-12-15
 */

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
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
import { PlatformBadge } from "@/components/ui/platform-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { knowledgeLinkKeys } from "@/hooks/queries/keys";
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
// Fetcher
// ============================================================================

/** 旧版相关书签 API 返回项（向量相似度） */
interface LegacyRelatedItem {
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

const fetchRelatedBookmarks = async (
  bookmarkId: number,
  limit: number,
  minStrength: number,
  types?: LinkType[],
): Promise<ApiResponse> => {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("minStrength", String(minStrength));
  if (types && types.length > 0) {
    params.set("types", types.join(","));
  }

  // 并行发起知识关联和向量相似度两个请求，消除串行等待（~470ms）
  // 优先使用知识关联结果，为空时回退到向量相似度
  const [knowledgeResult, legacyResult] = await Promise.allSettled([
    fetch(`/api/knowledge-link/related/${bookmarkId}?${params.toString()}`, {
      credentials: "include",
    }).then(async (res) => {
      const data: ApiResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "获取相关书签失败");
      return data;
    }),
    fetch(
      `/api/bookmarks/${bookmarkId}/related?limit=${limit}&minSimilarity=${minStrength}`,
      { credentials: "include" },
    ).then(async (res) => {
      if (!res.ok) return [] as LegacyRelatedItem[];
      const json = await res.json();
      return (json?.data?.related ??
        json?.related ??
        []) as LegacyRelatedItem[];
    }),
  ]);

  // 优先使用知识关联结果
  if (knowledgeResult.status === "fulfilled") {
    const related = knowledgeResult.value.data?.related ?? [];
    if (related.length > 0) {
      return knowledgeResult.value;
    }
  }

  // 知识关联为空或失败时，回退到向量相似度结果
  if (legacyResult.status === "fulfilled") {
    const legacyList = legacyResult.value;
    if (Array.isArray(legacyList) && legacyList.length > 0) {
      const mapped: RelatedBookmark[] = legacyList.map(
        (item: LegacyRelatedItem) => ({
          bookmark: {
            id: item.id,
            title: item.title,
            url: item.url,
            platform: item.platform ?? undefined,
          },
          link: {
            type: "semantic" as LinkType,
            strength:
              typeof item.similarity === "number" ? item.similarity : 0.5,
            sharedItems: [],
          },
        }),
      );
      return {
        success: true,
        data: { related: mapped, totalCount: mapped.length },
      };
    }
  }

  // 两个请求都失败时，抛出知识关联的错误
  if (knowledgeResult.status === "rejected") {
    throw knowledgeResult.reason;
  }

  // 两个请求都无数据，返回知识关联的空结果
  return knowledgeResult.status === "fulfilled"
    ? knowledgeResult.value
    : { success: true, data: { related: [], totalCount: 0 } };
};

// ============================================================================
// Component
// ============================================================================

export function RelatedBookmarksV2({
  bookmarkId,
  className,
  defaultExpanded = true,
  limit = 5,
  minStrength = 0.5,
  types,
}: RelatedBookmarksV2Props) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 构建查询参数（用于缓存 key）
  const queryParams = useMemo(
    () => ({
      limit,
      minStrength,
      types,
    }),
    [limit, minStrength, types],
  );

  // 使用 TanStack Query
  const {
    data,
    error: queryError,
    isLoading,
  } = useQuery({
    queryKey: knowledgeLinkKeys.related(bookmarkId, queryParams),
    queryFn: () => fetchRelatedBookmarks(bookmarkId, limit, minStrength, types),
    enabled: isExpanded, // 仅在展开时请求
    staleTime: 60 * 1000, // 60秒内认为数据新鲜
    gcTime: 5 * 60 * 1000, // 5分钟后垃圾回收
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
  });

  // 提取数据和错误
  const related = data?.success ? data.data?.related || [] : [];
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "未知错误"
    : null;

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

  // 不再在「无数据且无错误」时 return null，否则整块消失且无法看到「暂无知识关联」空状态
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
            <div className="text-center py-4 text-sm text-gray-400 dark:text-gray-500">
              没有关联知识
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
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors py-2 gap-1"
                    onClick={() => router.push(`/bookmark/${item.bookmark.id}`)}
                    onMouseEnter={() =>
                      router.prefetch(`/bookmark/${item.bookmark.id}`)
                    }
                  >
                    <CardContent className="py-1 px-3">
                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.bookmark.title}
                        </h4>

                        {/* 一行：语义相似等徽章 | 平台、强度、操作 */}
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          {/* 左侧：关联类型徽章 + 共享项目预览 */}
                          <div className="flex items-center gap-2 min-w-0">
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs font-normal gap-1 shrink-0",
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
                            {item.link.sharedItems.length > 0 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {item.link.sharedItems.slice(0, 2).join("、")}
                                {item.link.sharedItems.length > 2 && "..."}
                              </span>
                            )}
                          </div>

                          {/* 右侧：平台徽章、强度、打开链接 */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.bookmark.platform && (
                              <PlatformBadge
                                platform={item.bookmark.platform}
                                size="sm"
                              />
                            )}
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
