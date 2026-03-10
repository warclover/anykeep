/**
 * AI 搜索建议组件
 *
 * 提供智能搜索建议，包括热门搜索、相关建议、历史记录
 * v2.0: 集成服务端搜索历史 API
 *
 * @version 2.0.0
 * @since 2025-12-22
 * @updated 2026-01-07 集成服务端搜索历史
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Sparkles, Clock, TrendingUp, Tag, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { API_SEARCH } from "@/lib/constants/api-paths";

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

interface RecentSearchFromAPI {
  id: string;
  query: string;
  resultCount: number;
  createdAt: string;
}

interface HotKeywordFromAPI {
  keyword: string;
  count: number;
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

// 默认热门搜索（API 失败时的回退）
const DEFAULT_TRENDING = [
  "AI 技术",
  "产品设计",
  "前端开发",
  "创业",
  "效率工具",
];

// ============================================
// 组件
// ============================================

export function AISearchSuggestions({
  query,
  onSuggestionSelect,
  onClearHistory,
  userId,
  visible = true,
  className,
}: AISearchSuggestionsProps) {
  const [aiSuggestions, setAiSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<RecentSearchFromAPI[]>([]);
  const [hotKeywords, setHotKeywords] = useState<HotKeywordFromAPI[]>([]);
  const [_loading, setLoading] = useState(false);

  // 从 API 加载搜索历史和热门关键词（仅当有 userId 时，确保用户隔离）
  useEffect(() => {
    if (!userId) return;

    const loadHistory = async () => {
      try {
        const response = await fetch(`${API_SEARCH.history}?type=all&limit=10`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSearchHistory(data.data.recentSearches || []);
            setHotKeywords(data.data.hotKeywords || []);
          }
        }
      } catch {
        // ignore — 加载失败不影响核心搜索功能
      }
    };

    loadHistory();
  }, [userId]);

  // 计算无查询时的默认建议（历史 + 热门）
  const defaultSuggestions = useMemo(() => {
    const historySuggestions: SearchSuggestion[] = searchHistory
      .slice(0, 5)
      .map((item) => ({
        id: `history-${item.id}`,
        text: item.query,
        type: "history",
      }));

    // 使用 API 返回的热门关键词，或使用默认值
    const trendingData =
      hotKeywords.length > 0
        ? hotKeywords.slice(0, 5).map((k) => k.keyword)
        : DEFAULT_TRENDING.slice(0, 3);

    const trendingSuggestions: SearchSuggestion[] = trendingData.map(
      (text, index) => ({
        id: `trending-${index}`,
        text,
        type: "trending",
      }),
    );

    return [...historySuggestions, ...trendingSuggestions];
  }, [searchHistory, hotKeywords]);

  // 根据输入生成 AI 建议
  useEffect(() => {
    // 无输入时不生成 AI 建议，displaySuggestions 会使用 defaultSuggestions
    if (!query.trim()) {
      return;
    }

    // 标记需要清空之前的 AI 建议
    let isCancelled = false;

    // 有输入时生成 AI 建议
    const generateSuggestions = async () => {
      setLoading(true);

      // TODO(@backlog): 接入真实 AI 建议 API，替换 mock 数据
      if (isCancelled) return;

      const newAiSuggestions: SearchSuggestion[] = [
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
        .filter((h) => h.query.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 2)
        .map((item) => ({
          id: `history-match-${item.id}`,
          text: item.query,
          type: "history" as const,
        }));

      setAiSuggestions([...matchingHistory, ...newAiSuggestions]);
      setLoading(false);
    };

    const debounce = setTimeout(generateSuggestions, 200);
    return () => {
      isCancelled = true;
      clearTimeout(debounce);
    };
  }, [query, searchHistory, hotKeywords]);

  // 计算最终显示的建议：无查询时用默认建议，有查询时用 AI 建议
  const displaySuggestions = useMemo(() => {
    return query.trim() ? aiSuggestions : defaultSuggestions;
  }, [query, aiSuggestions, defaultSuggestions]);

  /**
   * 处理建议选择
   */
  const handleSelect = useCallback(
    (suggestion: SearchSuggestion) => {
      onSuggestionSelect(suggestion.text);
    },
    [onSuggestionSelect],
  );

  /**
   * 清除历史（委托给父组件处理 API 调用）
   */
  const handleClearHistory = useCallback(async () => {
    setSearchHistory([]);
    onClearHistory?.();
  }, [onClearHistory]);

  /**
   * 删除单条历史
   */
  const handleRemoveHistory = useCallback(
    async (item: RecentSearchFromAPI, e: React.MouseEvent) => {
      e.stopPropagation();

      // 乐观更新本地状态
      setSearchHistory((prev) => prev.filter((h) => h.id !== item.id));

      try {
        await fetch(`${API_SEARCH.history}?id=${item.id}`, {
          method: "DELETE",
        });
      } catch {
        // ignore — 乐观更新已生效，API 失败不影响 UI
      }
    },
    [],
  );

  // 按类型分组 (必须在条件返回之前调用，以遵守 Hooks 规则)
  const groupedSuggestions = useMemo(() => {
    const groups: Record<string, SearchSuggestion[]> = {
      ai: [],
      history: [],
      trending: [],
      tag: [],
    };

    displaySuggestions.forEach((s) => {
      groups[s.type].push(s);
    });

    return groups;
  }, [displaySuggestions]);

  if (!visible || displaySuggestions.length === 0) {
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
          {groupedSuggestions.history.map((suggestion) => {
            // 找到对应的历史记录
            const historyItem = searchHistory.find(
              (h) => h.query === suggestion.text,
            );
            return (
              <SuggestionItem
                key={suggestion.id}
                suggestion={suggestion}
                onClick={() => handleSelect(suggestion)}
                onRemove={
                  historyItem
                    ? (e) => handleRemoveHistory(historyItem, e)
                    : undefined
                }
                removable={!!historyItem}
              />
            );
          })}
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
    <div
      role="button"
      tabIndex={0}
      className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-accent transition-colors group cursor-pointer"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
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
    </div>
  );
}

export default AISearchSuggestions;
