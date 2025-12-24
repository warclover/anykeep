/**
 * 搜索页面客户端组件
 * 优化：接收 hotTagsSlot 作为流式渲染的插槽
 * V4.2.17: 支持客户端导航时自动获取搜索结果
 * V4.3.0: 集成 AI 搜索组件（语义搜索开关、智能建议、搜索增强）
 */

"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Clock, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkCard } from "@/components/bookmark/bookmark-card";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  SemanticSearchToggle,
  AISearchSuggestions,
  AISearchEnhanced,
  type SearchMode,
} from "@/components/ai";
import type { Bookmark } from "@/types/supabase";
import { clientLogger } from "@/lib/client-logger";

interface SearchPageClientProps {
  initialQuery: string;
  initialAIMode: boolean;
  searchResults: (Bookmark & { folders?: { name: string } | null })[];
  /** 热门标签插槽 - 支持 Suspense 流式渲染 */
  hotTagsSlot?: ReactNode;
  error?: string;
}

const SEARCH_HISTORY_KEY = "anykeep_search_history";
const MAX_HISTORY = 10;

export function SearchPageClient({
  initialQuery,
  initialAIMode,
  searchResults: ssrSearchResults,
  hotTagsSlot,
  error: ssrError,
}: SearchPageClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  // V4.3.0: 使用 SearchMode 类型替代 boolean
  const [searchMode, setSearchMode] = useState<SearchMode>(
    initialAIMode ? "semantic" : "keyword",
  );
  const aiMode = searchMode === "semantic";
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [showHistory, setShowHistory] = useState(false);
  // V4.3.0: 控制 AI 搜索建议显示
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // V4.2.17: 客户端搜索状态（用于客户端导航时自动获取结果）
  const [clientSearchResults, setClientSearchResults] = useState<
    typeof ssrSearchResults | null
  >(null);
  const [isClientSearching, setIsClientSearching] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // 合并 SSR 结果和客户端获取的结果
  const searchResults = clientSearchResults ?? ssrSearchResults;
  const error = clientError ?? ssrError;

  // V4.2.17: 客户端搜索函数
  const fetchSearchResults = useCallback(
    async (searchQuery: string, isAI: boolean) => {
      if (!searchQuery.trim()) return;

      setIsClientSearching(true);
      setClientError(null);

      try {
        const params = new URLSearchParams({
          q: searchQuery,
          mode: isAI ? "hybrid" : "keyword",
          limit: "50",
        });

        const response = await fetch(`/api/search?${params.toString()}`);
        const responseData = await response.json();

        // API 响应格式: { success: boolean, data?: { results: [...] }, error?: { message: string } }
        if (!response.ok || !responseData.success) {
          throw new Error(responseData.error?.message || "搜索失败");
        }

        // 正确访问嵌套的 results 数组
        const results = responseData.data?.results || [];
        setClientSearchResults(results);
      } catch (err) {
        clientLogger.error({ err }, "[SearchPageClient] Client search error");
        setClientError(
          err instanceof Error ? err.message : "搜索时出错，请稍后重试",
        );
        setClientSearchResults([]);
      } finally {
        setIsClientSearching(false);
      }
    },
    [],
  );

  // V4.2.17: 使用 ref 追踪上一次的查询，用于检测查询变化
  const prevQueryRef = useRef<string>("");
  const prevAIModeRef = useRef<boolean>(false);

  // V4.2.17: 合并的 effect - 处理查询变化和自动获取
  // 解决了分离 effects 的竞态条件问题
  useEffect(() => {
    const queryChanged = prevQueryRef.current !== initialQuery;
    const aiModeChanged = prevAIModeRef.current !== initialAIMode;
    const isFirstRender = prevQueryRef.current === "" && initialQuery !== "";

    // 更新 refs
    prevQueryRef.current = initialQuery;
    prevAIModeRef.current = initialAIMode;

    // 如果查询变化了（非首次渲染），重置状态并触发新搜索
    if ((queryChanged || aiModeChanged) && !isFirstRender) {
      setClientSearchResults(null);
      setClientError(null);

      // 直接触发搜索，避免依赖另一个 effect
      if (initialQuery.trim().length > 0 && ssrSearchResults.length === 0) {
        fetchSearchResults(initialQuery, initialAIMode);
      }
      return;
    }

    // 首次渲染或初始加载：当有查询但没有 SSR 结果时，自动进行客户端搜索
    const needsClientSearch =
      initialQuery.trim().length > 0 &&
      ssrSearchResults.length === 0 &&
      clientSearchResults === null &&
      !ssrError;

    if (needsClientSearch) {
      fetchSearchResults(initialQuery, initialAIMode);
    }
  }, [
    initialQuery,
    initialAIMode,
    ssrSearchResults,
    clientSearchResults,
    ssrError,
    fetchSearchResults,
  ]);

  const handleRetry = () => {
    // V4.2.17: 如果是客户端搜索模式，重新获取结果
    if (clientSearchResults !== null || clientError) {
      setClientSearchResults(null);
      setClientError(null);
      fetchSearchResults(initialQuery, aiMode);
    } else {
      router.refresh();
    }
  };

  // 保存搜索历史
  const saveToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const newHistory = [
      searchQuery,
      ...searchHistory.filter((item) => item !== searchQuery),
    ].slice(0, MAX_HISTORY);

    setSearchHistory(newHistory);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
  };

  // 清空搜索历史
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  // 执行搜索
  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    saveToHistory(searchQuery);
    setShowHistory(false);

    // 更新 URL
    const params = new URLSearchParams();
    params.set("q", searchQuery);
    if (aiMode) {
      params.set("ai", "true");
    }
    router.push(`/search?${params.toString()}`);
  };

  // 处理输入框回车
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(query);
    }
  };

  // 点击热门标签或历史记录
  const handleTagClick = (tag: string) => {
    setQuery(tag);
    handleSearch(tag);
  };

  // 切换 AI 模式
  // V4.3.0: 使用 SearchMode 类型
  const handleSearchModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    const isAI = mode === "semantic";
    // 如果当前有搜索，立即重新搜索
    if (query.trim()) {
      const params = new URLSearchParams();
      params.set("q", query);
      if (isAI) {
        params.set("ai", "true");
      }
      router.push(`/search?${params.toString()}`);
    }
  };

  // V4.3.0: 处理 AI 建议选择
  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    handleSearch(suggestion);
  };

  const hasResults = searchResults.length > 0;
  const hasQuery = initialQuery.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 md:py-6">
        <h2 className="text-gray-900 dark:text-white text-xl md:text-2xl font-semibold mb-2">
          搜索
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          在你的收藏中搜索内容，支持 AI 语义搜索
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-6 md:py-8">
        {/* 搜索框区域 */}
        <div className="max-w-3xl mx-auto">
          {/* 大搜索框 */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setShowHistory(true);
                setShowSuggestions(true);
              }}
              onBlur={() => {
                // 延迟关闭，允许点击建议
                setTimeout(() => {
                  setShowSuggestions(false);
                  setShowHistory(false);
                }, 200);
              }}
              placeholder="搜索标题、作者、摘要..."
              className="pl-12 pr-4 h-14 text-base"
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="size-4" />
              </Button>
            )}

            {/* V4.3.0: AI 搜索建议（下拉面板） */}
            <AISearchSuggestions
              query={query}
              onSuggestionSelect={handleSuggestionSelect}
              onClearHistory={clearHistory}
              visible={showSuggestions}
            />
          </div>

          {/* V4.3.0: AI 语义搜索开关（使用 SemanticSearchToggle 组件） */}
          <SemanticSearchToggle
            mode={searchMode}
            onModeChange={handleSearchModeChange}
            className="mb-8"
          />

          {/* 搜索历史（仅在聚焦且有历史时显示） */}
          {showHistory && searchHistory.length > 0 && !hasQuery && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Clock className="size-4" />
                  搜索历史
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  清空
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((item, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleTagClick(item)}
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 热门搜索（仅在无搜索结果时显示）- 使用 Suspense 流式渲染 */}
          {!hasQuery && hotTagsSlot}
        </div>

        {/* 搜索结果 */}
        {hasQuery && (
          <div className="max-w-7xl mx-auto mt-8">
            {isClientSearching ? (
              // V4.2.17: 客户端搜索加载状态
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="size-8 text-purple-600 animate-spin mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  正在搜索...
                </p>
              </div>
            ) : error ? (
              <ErrorMessage
                title="搜索失败"
                message={error}
                retry={handleRetry}
              />
            ) : (
              <>
                {/* 结果统计 */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    找到{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {searchResults.length}
                    </span>{" "}
                    个结果
                    {aiMode && (
                      <Badge
                        variant="outline"
                        className="ml-2 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300"
                      >
                        <Sparkles className="size-3 mr-1" />
                        AI 搜索
                      </Badge>
                    )}
                  </p>
                </div>

                {/* 结果列表 */}
                {hasResults ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.map((bookmark) => (
                      <BookmarkCard key={bookmark.id} bookmark={bookmark} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <Search className="size-8 text-gray-400" />
                    </div>
                    <h3 className="text-gray-900 dark:text-white text-lg font-medium mb-2">
                      未找到相关内容
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      尝试使用其他关键词，或开启 AI 语义搜索
                    </p>
                  </div>
                )}

                {/* V4.3.0: AI 搜索增强洞察（仅在有结果时显示） */}
                {hasResults && aiMode && (
                  <div className="mt-8">
                    <AISearchEnhanced
                      query={initialQuery}
                      resultCount={searchResults.length}
                      searchMode={aiMode ? "semantic" : "keyword"}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 空状态（无搜索） */}
        {!hasQuery && (
          <div className="max-w-3xl mx-auto mt-12">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <Search className="size-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white text-xl font-semibold mb-2">
                开始搜索你的收藏
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-md">
                输入关键词搜索标题、作者或摘要，或点击下方热门标签快速开始
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
