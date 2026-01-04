"use client";

/**
 * Material Selector - 素材选择器
 * @module components/knowledge-studio
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, X, Info } from "lucide-react";
import {
  QUALITY_DISPLAY,
  getQualityLevel,
} from "@/lib/knowledge-studio/client";
import type { MaterialHealthScore } from "@/hooks/domain/knowledge-studio/use-material-health";

interface MaterialItem {
  id: string;
  title: string;
  url: string;
  platform?: string;
  summary?: string;
  createdAt: Date;
}

interface MaterialSelectorProps {
  materials: MaterialItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelection?: number;
  className?: string;
  scores?: Map<string, MaterialHealthScore>;
  isLoadingScores?: boolean;
}

export function MaterialSelector({
  materials,
  selected,
  onChange,
  maxSelection = 10,
  className,
  scores,
  isLoadingScores = false,
}: MaterialSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMaterials = materials.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.summary?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleToggle = useCallback(
    (id: string) => {
      if (selected.includes(id)) {
        onChange(selected.filter((s) => s !== id));
      } else if (selected.length < maxSelection) {
        onChange([...selected, id]);
      }
    },
    [selected, onChange, maxSelection],
  );

  const handleSelectAll = useCallback(() => {
    const newSelection = filteredMaterials
      .slice(0, maxSelection)
      .map((m) => m.id);
    onChange(newSelection);
  }, [filteredMaterials, maxSelection, onChange]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">选择素材</span>
          <Badge variant="secondary">
            {selected.length} / {maxSelection}
          </Badge>
          {scores && scores.size > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1">
                    <Info className="h-3 w-3" />
                    已评分
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>素材质量评分已加载，建议优先选择评分 ≥60 分的素材</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
            全选
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            清空
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative my-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索素材..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Material List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {filteredMaterials.map((material) => {
            const isSelected = selected.includes(material.id);
            const isDisabled = !isSelected && selected.length >= maxSelection;
            const score = scores?.get(material.id);
            const quality = score
              ? score.quality
              : isLoadingScores
                ? undefined
                : getQualityLevel(0);

            return (
              <label
                key={material.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  isSelected && "border-primary bg-accent",
                  isDisabled && "cursor-not-allowed opacity-50",
                  !isSelected && !isDisabled && "hover:bg-accent/50",
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(material.id)}
                  disabled={isDisabled}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium leading-tight line-clamp-2">
                      {material.title}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {score && quality && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1",
                                  quality === "excellent" &&
                                    "border-green-500 text-green-700 dark:text-green-400",
                                  quality === "good" &&
                                    "border-blue-500 text-blue-700 dark:text-blue-400",
                                  quality === "fair" &&
                                    "border-yellow-500 text-yellow-700 dark:text-yellow-400",
                                  quality === "poor" &&
                                    "border-red-500 text-red-700 dark:text-red-400",
                                )}
                              >
                                <span>{QUALITY_DISPLAY[quality].icon}</span>
                                <span>{score.totalScore}</span>
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-2">
                                <div>
                                  <p className="font-medium">
                                    {QUALITY_DISPLAY[quality].label} (
                                    {score.totalScore} 分)
                                  </p>
                                </div>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span>相关度:</span>
                                    <span>{score.dimensions.relevance}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>深度:</span>
                                    <span>{score.dimensions.depth}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>新鲜度:</span>
                                    <span>{score.dimensions.freshness}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>可信度:</span>
                                    <span>{score.dimensions.credibility}</span>
                                  </div>
                                </div>
                                {score.suggestions &&
                                  score.suggestions.length > 0 && (
                                    <div className="pt-2 border-t">
                                      <p className="text-xs font-medium mb-1">
                                        建议:
                                      </p>
                                      <ul className="text-xs space-y-0.5">
                                        {score.suggestions
                                          .slice(0, 2)
                                          .map((rec, i) => (
                                            <li key={i}>• {rec}</li>
                                          ))}
                                      </ul>
                                    </div>
                                  )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {material.platform && (
                        <Badge variant="outline" className="shrink-0">
                          {material.platform}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {material.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {material.summary}
                    </p>
                  )}
                  {score && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">评分维度:</span>
                        <div className="flex gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[10px]">🔗</span>
                                  <span>{score.dimensions.relevance}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>相关度: {score.dimensions.relevance} 分</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[10px]">📖</span>
                                  <span>{score.dimensions.depth}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>深度: {score.dimensions.depth} 分</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[10px]">⏰</span>
                                  <span>{score.dimensions.freshness}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>新鲜度: {score.dimensions.freshness} 分</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5">
                                  <span className="text-[10px]">🏛️</span>
                                  <span>{score.dimensions.credibility}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>可信度: {score.dimensions.credibility} 分</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      <Progress value={score.totalScore} className="h-1" />
                    </div>
                  )}
                </div>
              </label>
            );
          })}

          {filteredMaterials.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              {searchQuery ? "没有找到匹配的素材" : "暂无可用素材"}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Selected Summary */}
      {selected.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            {selected.map((id) => {
              const material = materials.find((m) => m.id === id);
              if (!material) return null;

              return (
                <Badge
                  key={id}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  <span className="max-w-[150px] truncate">
                    {material.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggle(id)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
