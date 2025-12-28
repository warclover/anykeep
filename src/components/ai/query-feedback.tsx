/**
 * 查询理解反馈组件
 *
 * 显示 AI 对用户查询的理解，包括：
 * - 提取的关键词
 * - 时间范围
 * - 平台过滤
 * - 搜索意图
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

"use client";

import { memo } from "react";
import {
  Search,
  Calendar,
  Globe,
  Target,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ParsedQuery,
  SearchIntentType,
} from "@/lib/ai-skills/search/types";

// ============================================
// 类型定义
// ============================================

export interface QueryFeedbackProps {
  /** 解析后的查询 */
  parsedQuery: ParsedQuery;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

export interface SearchSuggestionsProps {
  /** 建议列表 */
  suggestions: string[];
  /** 建议点击回调 */
  onSuggestionClick?: (suggestion: string) => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 常量
// ============================================

const INTENT_CONFIG: Record<
  SearchIntentType,
  { label: string; icon: React.ElementType }
> = {
  find_specific: { label: "找特定内容", icon: Target },
  browse: { label: "浏览", icon: Search },
  filter: { label: "筛选", icon: Globe },
  recall: { label: "回忆", icon: Lightbulb },
};

const PLATFORM_NAMES: Record<string, string> = {
  wechat: "微信公众号",
  bilibili: "B站",
  xiaohongshu: "小红书",
  zhihu: "知乎",
  juejin: "掘金",
  csdn: "CSDN",
  browser: "浏览器书签",
};

// ============================================
// 组件
// ============================================

/**
 * 查询理解反馈
 */
export const QueryFeedback = memo(function QueryFeedback({
  parsedQuery,
  showDetails = true,
  compact = false,
  className,
}: QueryFeedbackProps) {
  const hasFilters = parsedQuery.timeRange || parsedQuery.platform;
  const intentConfig = INTENT_CONFIG[parsedQuery.searchIntent];

  if (compact) {
    return (
      <QueryFeedbackCompact parsedQuery={parsedQuery} className={className} />
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 p-4",
        className,
      )}
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
        <Search className="size-4" />
        <span>AI 理解你的搜索</span>
      </div>

      {/* 关键词 */}
      {parsedQuery.keywords.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1.5">关键词</div>
          <div className="flex flex-wrap gap-1.5">
            {parsedQuery.keywords.map((keyword) => (
              <Badge
                key={`kw-${keyword}`}
                variant="secondary"
                className="bg-white border border-purple-200 text-purple-700"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 过滤条件 */}
      {hasFilters && showDetails && (
        <div className="mt-3 flex flex-wrap gap-2">
          {parsedQuery.timeRange && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs">
              <Calendar className="size-3" />
              <span>{parsedQuery.timeRange.original}</span>
            </div>
          )}
          {parsedQuery.platform && parsedQuery.platform !== "all" && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs">
              <Globe className="size-3" />
              <span>
                {PLATFORM_NAMES[parsedQuery.platform] || parsedQuery.platform}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 搜索意图 */}
      {showDetails && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <intentConfig.icon className="size-3" />
          <span>意图: {intentConfig.label}</span>
          {parsedQuery.hasReference && (
            <span className="text-amber-600">• 包含指代词</span>
          )}
        </div>
      )}

      {/* 置信度 */}
      {showDetails && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full transition-all"
                style={{ width: `${parsedQuery.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {Math.round(parsedQuery.confidence * 100)}% 置信度
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * 紧凑版查询反馈
 */
function QueryFeedbackCompact({
  parsedQuery,
  className,
}: {
  parsedQuery: ParsedQuery;
  className?: string;
}) {
  const parts: string[] = [];

  // 关键词
  if (parsedQuery.keywords.length > 0) {
    parts.push(`关键词: ${parsedQuery.keywords.slice(0, 3).join("、")}`);
  }

  // 时间范围
  if (parsedQuery.timeRange) {
    parts.push(parsedQuery.timeRange.original);
  }

  // 平台
  if (parsedQuery.platform && parsedQuery.platform !== "all") {
    parts.push(PLATFORM_NAMES[parsedQuery.platform] || parsedQuery.platform);
  }

  if (parts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 text-xs text-gray-500",
        className,
      )}
    >
      <Search className="size-3 text-purple-500" />
      {parts.map((part, index) => (
        <span
          key={`part-${part.slice(0, 15)}-${index}`}
          className="flex items-center gap-1"
        >
          {index > 0 && <ChevronRight className="size-3 text-gray-300" />}
          <span>{part}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * 空结果建议组件
 */
export const SearchSuggestions = memo(function SearchSuggestions({
  suggestions,
  onSuggestionClick,
  className,
}: SearchSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-100 bg-amber-50/50 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-3">
        <Lightbulb className="size-4" />
        <span>搜索建议</span>
      </div>
      <ul className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <li
            key={`sug-${suggestion.slice(0, 20)}-${index}`}
            className={cn(
              "flex items-start gap-2 text-sm text-gray-600",
              onSuggestionClick && "cursor-pointer hover:text-amber-700",
            )}
            onClick={() => onSuggestionClick?.(suggestion)}
          >
            <span className="text-amber-500">•</span>
            <span>{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default QueryFeedback;
