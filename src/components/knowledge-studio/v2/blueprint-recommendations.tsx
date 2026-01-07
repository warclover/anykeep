/**
 * Blueprint Recommendations - 蓝图推荐组件
 * @module knowledge-studio/v2
 * @description 显示个性化蓝图推荐（最近使用 + 热门 + 基于素材智能推荐）
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  TrendingUp,
  Sparkles,
  Loader2,
  Brain,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MaterialInput } from "@/lib/knowledge-studio/blueprint/types";

// ============================================================
// Types
// ============================================================

/**
 * 推荐项
 */
interface BlueprintRecommendation {
  blueprintId: string;
  displayName: string;
  icon: string;
  description: string;
  recommendationType: "recent" | "popular" | "new" | "material";
  score: number;
  useCount?: number;
  lastUsedAt?: string;
  /** P1-3: 推荐原因 */
  reasons?: string[];
  /** P1-3: 匹配的标签 */
  matchedTags?: string[];
}

/**
 * API 响应 - 历史/热门推荐
 */
interface HistoryRecommendationsResponse {
  recentlyUsed: BlueprintRecommendation[];
  popular: BlueprintRecommendation[];
  suggested: BlueprintRecommendation[];
}

/**
 * API 响应 - 素材智能推荐
 */
interface MaterialRecommendationsResponse {
  analysis: {
    topics: string[];
    contentType: string;
    language: string;
    platforms: string[];
    technicalLevel: string;
    lengthLevel: string;
  };
  recommendations: BlueprintRecommendation[];
}

interface BlueprintRecommendationsProps {
  /** 选中蓝图后的回调 */
  onSelect: (blueprintId: string) => void;
  /** 当前选中的蓝图 ID */
  selectedBlueprintId?: string;
  /** P1-3: 素材列表（提供后启用智能推荐） */
  materials?: MaterialInput[];
  /** 自定义样式类名 */
  className?: string;
}

// ============================================================
// Component
// ============================================================

export function BlueprintRecommendations({
  onSelect,
  selectedBlueprintId,
  materials,
  className,
}: BlueprintRecommendationsProps) {
  const [historyRecommendations, setHistoryRecommendations] =
    useState<HistoryRecommendationsResponse | null>(null);
  const [materialRecommendations, setMaterialRecommendations] =
    useState<MaterialRecommendationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // P1-3: 是否有素材（决定使用哪种推荐模式）
  const hasMaterials = materials && materials.length > 0;

  // Fetch recommendations based on mode
  useEffect(() => {
    async function fetchRecommendations() {
      try {
        setIsLoading(true);
        setError(null);

        if (hasMaterials) {
          // P1-3: 基于素材的智能推荐
          const response = await fetch(
            "/api/knowledge-studio/v2/recommendations/blueprints",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ materials, limit: 5 }),
            },
          );

          if (!response.ok) {
            throw new Error("Failed to fetch material recommendations");
          }

          const data = await response.json();
          setMaterialRecommendations(data);
          setHistoryRecommendations(null);
        } else {
          // 历史/热门推荐
          const response = await fetch(
            "/api/knowledge-studio/v2/recommendations/blueprints",
          );

          if (!response.ok) {
            throw new Error("Failed to fetch recommendations");
          }

          const data = await response.json();
          setHistoryRecommendations(data);
          setMaterialRecommendations(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecommendations();
  }, [hasMaterials, materials]);

  const handleSelect = useCallback(
    (blueprintId: string) => {
      onSelect(blueprintId);
    },
    [onSelect],
  );

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            {hasMaterials ? "智能分析素材中..." : "加载推荐..."}
          </span>
        </CardContent>
      </Card>
    );
  }

  // Error state - silently hide
  if (error) {
    return null;
  }

  // P1-3: 素材智能推荐模式
  if (hasMaterials && materialRecommendations) {
    const { analysis, recommendations } = materialRecommendations;

    if (recommendations.length === 0) {
      return null;
    }

    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            智能推荐
            <Badge variant="secondary" className="text-xs">
              基于素材分析
            </Badge>
          </CardTitle>
          {analysis.topics.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              检测到主题: {analysis.topics.slice(0, 3).join(", ")}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {recommendations.map((item, index) => (
            <button
              key={item.blueprintId}
              onClick={() => handleSelect(item.blueprintId)}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-lg text-left",
                "hover:bg-muted transition-colors",
                selectedBlueprintId === item.blueprintId &&
                  "bg-primary/10 border border-primary/20",
              )}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {item.displayName}
                  </span>
                  {index === 0 && (
                    <Badge
                      variant="default"
                      className="text-[10px] px-1.5 py-0"
                    >
                      最佳匹配
                    </Badge>
                  )}
                </div>
                {item.reasons && item.reasons.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {item.reasons.slice(0, 2).map((reason, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                        <span className="truncate">{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex-shrink-0">
                {item.score}%
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    );
  }

  // 历史/热门推荐模式
  if (!historyRecommendations) {
    return null;
  }

  const hasRecentlyUsed = historyRecommendations.recentlyUsed.length > 0;
  const hasPopular = historyRecommendations.popular.length > 0;
  const hasSuggested = historyRecommendations.suggested.length > 0;

  // No recommendations - hide
  if (!hasRecentlyUsed && !hasPopular && !hasSuggested) {
    return null;
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          为你推荐
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recently Used */}
        {hasRecentlyUsed && (
          <RecommendationSection
            icon={<Clock className="h-4 w-4" />}
            title="最近使用"
            items={historyRecommendations.recentlyUsed}
            onSelect={handleSelect}
            selectedId={selectedBlueprintId}
          />
        )}

        {/* Popular */}
        {hasPopular && (
          <RecommendationSection
            icon={<TrendingUp className="h-4 w-4" />}
            title="热门蓝图"
            items={historyRecommendations.popular}
            onSelect={handleSelect}
            selectedId={selectedBlueprintId}
          />
        )}

        {/* Suggested */}
        {hasSuggested && (
          <RecommendationSection
            icon={<Sparkles className="h-4 w-4" />}
            title="推荐尝试"
            items={historyRecommendations.suggested}
            onSelect={handleSelect}
            selectedId={selectedBlueprintId}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Sub-components
// ============================================================

interface RecommendationSectionProps {
  icon: React.ReactNode;
  title: string;
  items: BlueprintRecommendation[];
  onSelect: (blueprintId: string) => void;
  selectedId?: string;
}

function RecommendationSection({
  icon,
  title,
  items,
  onSelect,
  selectedId,
}: RecommendationSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.blueprintId}
            onClick={() => onSelect(item.blueprintId)}
            className={cn(
              "w-full flex items-center gap-3 p-2 rounded-lg text-left",
              "hover:bg-muted transition-colors",
              selectedId === item.blueprintId &&
                "bg-primary/10 border border-primary/20",
            )}
          >
            <span className="text-xl">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {item.displayName}
              </div>
              {item.useCount !== undefined && item.useCount > 0 && (
                <div className="text-xs text-muted-foreground">
                  已使用 {item.useCount} 次
                </div>
              )}
            </div>
            {item.recommendationType === "popular" && (
              <Badge variant="secondary" className="text-xs">
                热门
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
