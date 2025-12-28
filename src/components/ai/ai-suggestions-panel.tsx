/**
 * AI 建议面板组件
 *
 * 用于显示 AI 提供的后续操作建议
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

"use client";

import { memo } from "react";
import { Lightbulb, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SuggestionItem } from "./types";

interface AISuggestionsPanelProps {
  /** 建议列表 */
  suggestions: SuggestionItem[];
  /** 点击建议时的回调 */
  onSuggestionClick?: (suggestion: SuggestionItem) => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * AI 建议面板
 *
 * 显示 AI 提供的后续操作建议，包括：
 * - 建议标题和描述
 * - 操作类型标签
 * - 可点击执行
 */
export const AISuggestionsPanel = memo(function AISuggestionsPanel({
  suggestions,
  onSuggestionClick,
  className,
}: AISuggestionsPanelProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-4",
        className,
      )}
    >
      {/* 头部 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center size-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-400 shadow-sm">
          <Lightbulb className="size-3.5 text-white" />
        </div>
        <h4 className="text-sm font-medium text-gray-800">下一步建议</h4>
      </div>

      {/* 建议列表 */}
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={`${suggestion.text}-${suggestion.action || ""}-${index}`}
            suggestion={suggestion}
            onClick={() => onSuggestionClick?.(suggestion)}
          />
        ))}
      </div>
    </div>
  );
});

/**
 * 单个建议卡片
 */
const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  onClick,
}: {
  suggestion: SuggestionItem;
  onClick?: () => void;
}) {
  const { text, action, actionLabel } = suggestion;

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-white border border-amber-100/50 shadow-sm",
        onClick &&
          "cursor-pointer hover:border-amber-200 hover:shadow-md transition-all",
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <Sparkles className="size-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 leading-snug">{text}</p>
          {action && (
            <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
              {action}
            </span>
          )}
        </div>
      </div>

      {onClick && (
        <Button
          variant="ghost"
          size="sm"
          className="flex-shrink-0 h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-100 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span className="text-xs">{actionLabel || "执行"}</span>
          <ArrowRight className="size-3 ml-1" />
        </Button>
      )}
    </div>
  );
});

/**
 * 简化版建议显示（内联）
 */
export const AISuggestionsInline = memo(function AISuggestionsInline({
  suggestions,
  onSuggestionClick,
}: {
  suggestions: SuggestionItem[];
  onSuggestionClick?: (suggestion: SuggestionItem) => void;
}) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions
        .filter((s) => s?.text)
        .slice(0, 3)
        .map((suggestion, index) => (
          <Button
            key={`inline-${suggestion.text}-${suggestion.action || ""}-${index}`}
            variant="outline"
            size="sm"
            className="h-7 px-3 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300"
            onClick={() => onSuggestionClick?.(suggestion)}
          >
            <Lightbulb className="size-3 mr-1" />
            {suggestion.text.length > 20
              ? suggestion.text.slice(0, 20) + "..."
              : suggestion.text}
          </Button>
        ))}
      {suggestions.length > 3 && (
        <span className="text-xs text-gray-400 self-center">
          +{suggestions.length - 3} 更多
        </span>
      )}
    </div>
  );
});

/**
 * 快速操作按钮组
 */
export const AIQuickSuggestions = memo(function AIQuickSuggestions({
  suggestions,
  onSuggestionClick,
  className,
}: {
  suggestions: SuggestionItem[];
  onSuggestionClick?: (suggestion: SuggestionItem) => void;
  className?: string;
}) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const validSuggestions = suggestions.filter((s) => s?.text);

  if (validSuggestions.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {validSuggestions.map((suggestion, index) => (
        <button
          key={`quick-${suggestion.text}-${suggestion.action || ""}-${index}`}
          onClick={() => onSuggestionClick?.(suggestion)}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium",
            "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200",
            "hover:from-amber-200 hover:to-orange-200 hover:shadow-sm transition-all",
          )}
        >
          <Lightbulb className="size-3" />
          <span>
            {suggestion.text.length > 15
              ? suggestion.text.slice(0, 15) + "..."
              : suggestion.text}
          </span>
        </button>
      ))}
    </div>
  );
});
