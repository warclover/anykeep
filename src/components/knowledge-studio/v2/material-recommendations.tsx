/**
 * Material Recommendations - 素材推荐组件
 * @module knowledge-studio/v2
 * @description 基于已选素材，推荐相关素材（语义相似度）
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, Plus, Link2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================
// Types
// ============================================================

/**
 * 推荐素材项
 */
interface MaterialRecommendation {
  bookmarkId: string;
  title: string;
  url: string;
  platform: string | null;
  summary: string | null;
  similarity: number;
  reason: string;
}

/**
 * API 响应
 */
interface RecommendationsResponse {
  recommendations: MaterialRecommendation[];
  method: "semantic" | "recent";
}

interface MaterialRecommendationsProps {
  /** 已选择的素材 ID 列表 */
  selectedMaterialIds: string[];
  /** 添加素材到选择列表的回调 */
  onAddMaterial: (materialId: string) => void;
  /** 当前选择的最大数量 */
  maxSelection: number;
  /** 自定义样式类名 */
  className?: string;
}

// ============================================================
// Constants
// ============================================================

const MATERIAL_RECOMMENDATIONS_TEXT = {
  TITLE: "相关素材推荐",
  LOADING: "分析中...",
  NO_SELECTION: "选择素材后将显示相关推荐",
  NO_RECOMMENDATIONS: "暂无推荐",
  ADD_BUTTON: "添加",
  ALREADY_SELECTED: "已选择",
  MAX_REACHED: "已达上限",
  SIMILARITY_HIGH: "高度相关",
  SIMILARITY_MEDIUM: "主题相近",
  SIMILARITY_LOW: "可能相关",
  RECENT_FALLBACK: "最近收藏",
} as const;

// ============================================================
// Component
// ============================================================

export function MaterialRecommendations({
  selectedMaterialIds,
  onAddMaterial,
  maxSelection,
  className,
}: MaterialRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<
    MaterialRecommendation[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"semantic" | "recent" | null>(null);

  // Fetch recommendations when selection changes
  useEffect(() => {
    // 至少选择 1 个素材才请求推荐
    if (selectedMaterialIds.length === 0) {
      setRecommendations([]);
      setMethod(null);
      return;
    }

    // 防抖：选择变化后 500ms 再请求
    const timeoutId = setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          "/api/knowledge-studio/v2/recommendations/materials",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              selectedBookmarkIds: selectedMaterialIds.slice(0, 5), // API 限制最多 5 个
              limit: 5,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch recommendations");
        }

        const data: RecommendationsResponse = await response.json();
        setRecommendations(data.recommendations);
        setMethod(data.method);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [selectedMaterialIds]);

  const handleAddMaterial = useCallback(
    (materialId: string) => {
      onAddMaterial(materialId);
    },
    [onAddMaterial],
  );

  const isMaxReached = selectedMaterialIds.length >= maxSelection;

  // 无选择时显示提示
  if (selectedMaterialIds.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {MATERIAL_RECOMMENDATIONS_TEXT.TITLE}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {MATERIAL_RECOMMENDATIONS_TEXT.NO_SELECTION}
          </p>
        </CardContent>
      </Card>
    );
  }

  // 加载状态
  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {MATERIAL_RECOMMENDATIONS_TEXT.TITLE}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">
            {MATERIAL_RECOMMENDATIONS_TEXT.LOADING}
          </span>
        </CardContent>
      </Card>
    );
  }

  // 错误状态 - 静默隐藏
  if (error) {
    return null;
  }

  // 无推荐
  if (recommendations.length === 0) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {MATERIAL_RECOMMENDATIONS_TEXT.TITLE}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            {MATERIAL_RECOMMENDATIONS_TEXT.NO_RECOMMENDATIONS}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          {MATERIAL_RECOMMENDATIONS_TEXT.TITLE}
          {method === "semantic" && (
            <Badge variant="secondary" className="text-xs ml-auto">
              <Link2 className="h-3 w-3 mr-1" />
              语义匹配
            </Badge>
          )}
          {method === "recent" && (
            <Badge variant="outline" className="text-xs ml-auto">
              <BookOpen className="h-3 w-3 mr-1" />
              最近收藏
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recommendations.map((item) => {
          const isSelected = selectedMaterialIds.includes(item.bookmarkId);

          return (
            <div
              key={item.bookmarkId}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                isSelected && "bg-primary/5 border-primary/20",
                !isSelected && "hover:bg-muted/50",
              )}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm line-clamp-2">
                    {item.title}
                  </span>
                </div>

                {item.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.summary}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  {item.platform && (
                    <Badge variant="outline" className="text-xs">
                      {item.platform}
                    </Badge>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            item.similarity > 0.8 &&
                              "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                            item.similarity > 0.6 &&
                              item.similarity <= 0.8 &&
                              "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                            item.similarity <= 0.6 &&
                              "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
                          )}
                        >
                          {item.reason}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          相似度:{" "}
                          {item.similarity > 0
                            ? `${Math.round(item.similarity * 100)}%`
                            : "最近收藏"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div className="shrink-0">
                {isSelected ? (
                  <Badge variant="secondary" className="text-xs">
                    {MATERIAL_RECOMMENDATIONS_TEXT.ALREADY_SELECTED}
                  </Badge>
                ) : isMaxReached ? (
                  <Badge
                    variant="outline"
                    className="text-xs text-muted-foreground"
                  >
                    {MATERIAL_RECOMMENDATIONS_TEXT.MAX_REACHED}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => handleAddMaterial(item.bookmarkId)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {MATERIAL_RECOMMENDATIONS_TEXT.ADD_BUTTON}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
