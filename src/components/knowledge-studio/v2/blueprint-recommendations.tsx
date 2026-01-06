/**
 * Blueprint Recommendations - 蓝图推荐组件
 * @module knowledge-studio/v2
 * @description 显示个性化蓝图推荐（最近使用 + 热门）
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, TrendingUp, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  recommendationType: "recent" | "popular" | "new";
  score: number;
  useCount?: number;
  lastUsedAt?: string;
}

/**
 * API 响应
 */
interface RecommendationsResponse {
  recentlyUsed: BlueprintRecommendation[];
  popular: BlueprintRecommendation[];
  suggested: BlueprintRecommendation[];
}

interface BlueprintRecommendationsProps {
  /** 选中蓝图后的回调 */
  onSelect: (blueprintId: string) => void;
  /** 当前选中的蓝图 ID */
  selectedBlueprintId?: string;
  /** 自定义样式类名 */
  className?: string;
}

// ============================================================
// Component
// ============================================================

export function BlueprintRecommendations({
  onSelect,
  selectedBlueprintId,
  className,
}: BlueprintRecommendationsProps) {
  const [recommendations, setRecommendations] =
    useState<RecommendationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch recommendations
  useEffect(() => {
    async function fetchRecommendations() {
      try {
        setIsLoading(true);
        const response = await fetch(
          "/api/knowledge-studio/v2/recommendations/blueprints",
        );

        if (!response.ok) {
          throw new Error("Failed to fetch recommendations");
        }

        const data = await response.json();
        setRecommendations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecommendations();
  }, []);

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
        </CardContent>
      </Card>
    );
  }

  // Error state - silently hide
  if (error || !recommendations) {
    return null;
  }

  const hasRecentlyUsed = recommendations.recentlyUsed.length > 0;
  const hasPopular = recommendations.popular.length > 0;
  const hasSuggested = recommendations.suggested.length > 0;

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
            items={recommendations.recentlyUsed}
            onSelect={handleSelect}
            selectedId={selectedBlueprintId}
          />
        )}

        {/* Popular */}
        {hasPopular && (
          <RecommendationSection
            icon={<TrendingUp className="h-4 w-4" />}
            title="热门蓝图"
            items={recommendations.popular}
            onSelect={handleSelect}
            selectedId={selectedBlueprintId}
          />
        )}

        {/* Suggested */}
        {hasSuggested && (
          <RecommendationSection
            icon={<Sparkles className="h-4 w-4" />}
            title="推荐尝试"
            items={recommendations.suggested}
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
