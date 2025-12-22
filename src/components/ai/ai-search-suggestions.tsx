/**
 * AI 搜索建议组件
 *
 * 提供智能搜索建议，包括热门搜索、相关建议、历史记录
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Sparkles, Clock, TrendingUp, Tag, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface AISearchSuggestionsProps {
  /** 当前搜索词 */
  query: string;
  /** 选择建议回调 */
  onSuggestionSelect: (suggestion: string) => void;
  /** 清除历史回调 */
  onClearHistory?: () => void;
  /** 用户 ID（用于获取个性化建议） */
  userId?: string;
  /** 是否显示 */
  visible?: boolean;
  /** 自定义类名 */
  className?: string;
}

interface SearchSuggestion {
  id: string;
  text: string;
  type: "ai" | "history" | "trending" | "tag";
  score?: number;
}

// ============================================
// 常量配置
// ============================================

const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  ai: Sparkles,
  history: Clock,
  trending: TrendingUp,
  tag: Tag,
};

const SUGGESTION_COLORS: Record<string, string> = {
  ai: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
  history: "text-gray-600 bg-gray-100 dark:bg-gray-800",
  trending: "text-orange-600 bg-orange-100 dark:bg-orange-900/30",
  tag: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
};

// 模拟热门搜索
const MOCK_TRENDING = ["AI 技术", "产品设计", "前端开发", "创业", "效率工具"];

// ============================================
// 组件
// ============================================

export function AISearchSuggestions({
  query,
  onSuggestionSelect,
  onClearHistory,
  userId: _userId,
  visible = true,
  className,
}: AISearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [_loading, setLoading] = useState(false);

  // 加载搜索历史
  useEffect(() => {
    const history = localStorage.getItem("search_history");
    if (history) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Initializing state from localStorage on mount
        setSearchHistory(JSON.parse(history).slice(0, 5));
      } catch {
        setSearchHistory([]);
      }
    }
  }, []);

  // 根据输入生成建议
  useEffect(() => {
    if (!query.trim()) {
      // 无输入时显示历史和热门
      const historySuggestions: SearchSuggestion[] = searchHistory
        .slice(0, 3)
        .map((text, index) => ({
          id: `history-${index}`,
          text,
          type: "history",
        }));

      const trendingSuggestions: SearchSuggestion[] = MOCK_TRENDING.slice(
        0,
        3,
      ).map((text, index) => ({
        id: `trending-${index}`,
        text,
        type: "trending",
      }));

      // eslint-disable-next-line react-hooks/set-state-in-effect -- Initializing state based on search history
      setSuggestions([...historySuggestions, ...trendingSuggestions]);
      return;
    }

    // 有输入时生成 AI 建议
    const generateSuggestions = async () => {
      setLoading(true);

      // 模拟 AI 建议生成
      await new Promise((resolve) => setTimeout(resolve, 300));

      const aiSuggestions: SearchSuggestion[] = [
        {
          id: "ai-1",
          text: `${query} 相关文章`,
          type: "ai",
          score: 0.95,
        },
        {
          id: "ai-2",
          text: `${query} 教程`,
          type: "ai",
          score: 0.85,
        },
        {
          id: "ai-3",
          text: `${query} 最佳实践`,
          type: "ai",
          score: 0.75,
        },
      ];

      // 匹配的历史记录
      const matchingHistory = searchHistory
        .filter((h) => h.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 2)
        .map((text, index) => ({
          id: `history-match-${index}`,
          text,
          type: "history" as const,
        }));

      setSuggestions([...matchingHistory, ...aiSuggestions]);
      setLoading(false);
    };

    const debounce = setTimeout(generateSuggestions, 200);
    return () => clearTimeout(debounce);
  }, [query, searchHistory]);

  /**
   * 处理建议选择
   */
  const handleSelect = useCallback(
    (suggestion: SearchSuggestion) => {
      onSuggestionSelect(suggestion.text);

      // 更新搜索历史
      const newHistory = [
        suggestion.text,
        ...searchHistory.filter((h) => h !== suggestion.text),
      ].slice(0, 10);
      setSearchHistory(newHistory);
      localStorage.setItem("search_history", JSON.stringify(newHistory));
    },
    [onSuggestionSelect, searchHistory],
  );

  /**
   * 清除历史
   */
  const handleClearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem("search_history");
    onClearHistory?.();
  }, [onClearHistory]);

  /**
   * 删除单条历史
   */
  const handleRemoveHistory = useCallback(
    (text: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newHistory = searchHistory.filter((h) => h !== text);
      setSearchHistory(newHistory);
      localStorage.setItem("search_history", JSON.stringify(newHistory));
    },
    [searchHistory],
  );

  // 按类型分组 (必须在条件返回之前调用，以遵守 Hooks 规则)
  const groupedSuggestions = useMemo(() => {
    const groups: Record<string, SearchSuggestion[]> = {
      ai: [],
      history: [],
      trending: [],
      tag: [],
    };

    suggestions.forEach((s) => {
      groups[s.type].push(s);
    });

    return groups;
  }, [suggestions]);

  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden",
        className,
      )}
    >
      {/* AI 建议 */}
      {groupedSuggestions.ai.length > 0 && (
        <div className="p-2 border-b">
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-purple-500" />
            <span>AI 建议</span>
          </div>
          {groupedSuggestions.ai.map((suggestion) => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              onClick={() => handleSelect(suggestion)}
            />
          ))}
        </div>
      )}

      {/* 搜索历史 */}
      {groupedSuggestions.history.length > 0 && (
        <div className="p-2 border-b">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>最近搜索</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={handleClearHistory}
            >
              清除
            </Button>
          </div>
          {groupedSuggestions.history.map((suggestion) => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              onClick={() => handleSelect(suggestion)}
              onRemove={(e) => handleRemoveHistory(suggestion.text, e)}
              removable
            />
          ))}
        </div>
      )}

      {/* 热门搜索 */}
      {groupedSuggestions.trending.length > 0 && !query && (
        <div className="p-2">
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
            <TrendingUp className="size-3 text-orange-500" />
            <span>热门搜索</span>
          </div>
          <div className="flex flex-wrap gap-2 px-2 py-1">
            {groupedSuggestions.trending.map((suggestion) => (
              <Badge
                key={suggestion.id}
                variant="secondary"
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSelect(suggestion)}
              >
                {suggestion.text}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 建议项组件
 */
function SuggestionItem({
  suggestion,
  onClick,
  onRemove,
  removable = false,
}: {
  suggestion: SearchSuggestion;
  onClick: () => void;
  onRemove?: (e: React.MouseEvent) => void;
  removable?: boolean;
}) {
  const Icon = SUGGESTION_ICONS[suggestion.type];
  const colorClass = SUGGESTION_COLORS[suggestion.type];

  return (
    <button
      type="button"
      className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-accent transition-colors group"
      onClick={onClick}
    >
      <div
        className={cn(
          "flex items-center justify-center size-6 rounded",
          colorClass,
        )}
      >
        <Icon className="size-3" />
      </div>
      <span className="flex-1 text-sm text-left truncate">
        {suggestion.text}
      </span>

      {removable && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
        >
          <X className="size-3" />
        </Button>
      )}

      {suggestion.type === "ai" && (
        <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}

export default AISearchSuggestions;
