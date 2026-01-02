/**
 * 智能过滤器提取展示组件
 *
 * 展示从自然语言查询中提取的结构化过滤条件
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

"use client";

import { Sparkles, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ExtractedFilterBadge,
  type SerializedFilter,
} from "./extracted-filter-badge";

/**
 * 过滤器提取信息（从 API 返回）
 */
export interface FilterExtractionInfo {
  enabled: boolean;
  filters: SerializedFilter[];
  cleanedQuery: string;
  confidence: number;
  latencyMs: number;
}

interface FilterExtractionDisplayProps {
  filterExtraction: FilterExtractionInfo;
  originalQuery: string;
  className?: string;
}

export function FilterExtractionDisplay({
  filterExtraction,
  originalQuery,
  className,
}: FilterExtractionDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  // 如果没有提取到过滤器，不显示
  if (!filterExtraction.enabled || filterExtraction.filters.length === 0) {
    return null;
  }

  const { filters, cleanedQuery, confidence } = filterExtraction;
  const hasCleanedQuery =
    cleanedQuery.trim() !== "" && cleanedQuery !== originalQuery;

  return (
    <div
      className={cn(
        "rounded-lg border bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-900/10 dark:to-blue-900/10",
        "border-purple-100 dark:border-purple-800/50",
        "p-3",
        className,
      )}
    >
      {/* 标题行 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <Sparkles className="size-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              智能筛选
            </span>
          </div>

          {/* 过滤器徽章 */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {filters.slice(0, expanded ? undefined : 3).map((filter, index) => (
              <ExtractedFilterBadge
                key={`${filter.type}-${index}`}
                filter={filter}
              />
            ))}
            {!expanded && filters.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{filters.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* 展开/收起按钮 */}
        {(filters.length > 3 || hasCleanedQuery) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 h-7 px-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {expanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        )}
      </div>

      {/* 展开后的详细信息 */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-purple-100 dark:border-purple-800/50 space-y-2">
          {/* 清理后的查询词 */}
          {hasCleanedQuery && (
            <div className="flex items-center gap-2 text-sm">
              <Search className="size-3.5 text-gray-400" />
              <span className="text-gray-500 dark:text-gray-400">
                实际搜索：
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-200">
                &ldquo;{cleanedQuery}&rdquo;
              </span>
            </div>
          )}

          {/* 置信度指示器 */}
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>置信度：</span>
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    confidence >= 0.9
                      ? "bg-green-500"
                      : confidence >= 0.7
                        ? "bg-yellow-500"
                        : "bg-orange-500",
                  )}
                  style={{ width: `${Math.round(confidence * 100)}%` }}
                />
              </div>
              <span>{Math.round(confidence * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
