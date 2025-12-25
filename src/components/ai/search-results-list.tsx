/**
 * 搜索结果列表组件
 *
 * 展示完整的搜索响应，包括：
 * - 查询理解反馈
 * - 搜索结果卡片列表
 * - 空结果建议
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

"use client";

import { memo, useState } from "react";
import { Search, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SearchResultCard } from "./search-result-card";
import { QueryFeedback, SearchSuggestions } from "./query-feedback";
import type {
  FormattedSearchResponse,
  SearchResultItem,
  ParsedQuery,
} from "@/lib/ai-skills/search/types";

// ============================================
// 类型定义
// ============================================

export interface SearchResultsListProps {
  /** 格式化的搜索响应 */
  response: FormattedSearchResponse;
  /** 解析后的查询（可选，用于显示查询理解） */
  parsedQuery?: ParsedQuery;
  /** 结果点击回调 */
  onResultClick?: (result: SearchResultItem) => void;
  /** 建议点击回调 */
  onSuggestionClick?: (suggestion: string) => void;
  /** 是否显示查询理解 */
  showQueryFeedback?: boolean;
  /** 初始显示数量 */
  initialShowCount?: number;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 组件
// ============================================

/**
 * 搜索结果列表
 */
export const SearchResultsList = memo(function SearchResultsList({
  response,
  parsedQuery,
  onResultClick,
  onSuggestionClick,
  showQueryFeedback = true,
  initialShowCount = 5,
  className,
}: SearchResultsListProps) {
  const [showAll, setShowAll] = useState(false);
  const [queryFeedbackOpen, setQueryFeedbackOpen] = useState(true);

  const { results, meta, suggestions } = response;
  const hasResults = results.length > 0;
  const hasMore = results.length > initialShowCount;
  const displayedResults = showAll
    ? results
    : results.slice(0, initialShowCount);

  // 统计各相关度级别的数量
  const highCount = results.filter((r) => r.relevance === "high").length;
  const _mediumCount = results.filter((r) => r.relevance === "medium").length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* 查询理解反馈 */}
      {showQueryFeedback && parsedQuery && (
        <Collapsible
          open={queryFeedbackOpen}
          onOpenChange={setQueryFeedbackOpen}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between h-8 text-xs text-gray-500 hover:text-purple-600"
            >
              <span className="flex items-center gap-1">
                <Search className="size-3" />
                查询理解
              </span>
              {queryFeedbackOpen ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <QueryFeedback parsedQuery={parsedQuery} className="mt-2" />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 结果统计 */}
      {hasResults && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3 text-gray-600">
            <span>
              找到{" "}
              <strong className="text-purple-600">{meta.totalCount}</strong>{" "}
              条结果
            </span>
            {highCount > 0 && (
              <span className="text-emerald-600">{highCount} 条高度相关</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="size-3" />
            <span>{meta.queryTimeMs}ms</span>
          </div>
        </div>
      )}

      {/* 结果列表 */}
      {hasResults ? (
        <div className="space-y-3">
          {displayedResults.map((result) => (
            <SearchResultCard
              key={result.id}
              result={result}
              onClick={onResultClick}
            />
          ))}

          {/* 展开/收起更多 */}
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? (
                <>
                  <ChevronUp className="size-4 mr-1" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="size-4 mr-1" />
                  显示更多 ({results.length - initialShowCount} 条)
                </>
              )}
            </Button>
          )}

          {/* 还有更多结果提示 */}
          {meta.hasMore && (
            <div className="text-center text-sm text-gray-500 py-2">
              还有更多结果，可以尝试更精确的搜索词
            </div>
          )}
        </div>
      ) : (
        /* 空结果 */
        <div className="text-center py-8">
          <Search className="size-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-2">没有找到相关结果</p>
          <p className="text-sm text-gray-400">
            {parsedQuery?.keywords.length
              ? `尝试调整搜索词: ${parsedQuery.keywords.join("、")}`
              : "请尝试不同的搜索词"}
          </p>
        </div>
      )}

      {/* 搜索建议 */}
      {suggestions && suggestions.length > 0 && (
        <SearchSuggestions
          suggestions={suggestions}
          onSuggestionClick={onSuggestionClick}
        />
      )}
    </div>
  );
});

/**
 * 搜索结果摘要组件（用于消息内联显示）
 */
export const SearchResultsSummary = memo(function SearchResultsSummary({
  response,
  maxDisplay = 3,
  onViewAll,
  className,
}: {
  response: FormattedSearchResponse;
  maxDisplay?: number;
  onViewAll?: () => void;
  className?: string;
}) {
  const { results, meta } = response;

  if (results.length === 0) {
    return (
      <div className={cn("text-sm text-gray-500", className)}>
        没有找到相关结果
      </div>
    );
  }

  const displayResults = results.slice(0, maxDisplay);
  const remaining = results.length - maxDisplay;

  return (
    <div className={cn("space-y-2", className)}>
      {/* 简要统计 */}
      <div className="text-xs text-gray-500">
        找到 {meta.totalCount} 条结果，显示前 {displayResults.length} 条
      </div>

      {/* 简化的结果列表 */}
      <div className="space-y-1.5">
        {displayResults.map((result) => (
          <div
            key={result.id}
            className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={() => window.open(result.url, "_blank")}
          >
            <div
              className={cn(
                "size-2 rounded-full",
                result.relevance === "high" && "bg-emerald-500",
                result.relevance === "medium" && "bg-amber-500",
                result.relevance === "low" && "bg-gray-400",
              )}
            />
            <span className="flex-1 text-sm truncate">{result.title}</span>
            <span className="text-xs text-gray-400">{result.platform}</span>
          </div>
        ))}
      </div>

      {/* 查看更多 */}
      {remaining > 0 && onViewAll && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-purple-600"
          onClick={onViewAll}
        >
          查看全部 {results.length} 条结果 →
        </Button>
      )}
    </div>
  );
});

export default SearchResultsList;
