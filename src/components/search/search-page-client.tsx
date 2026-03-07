/**
 * 搜索页面客户端组件
 * 优化：接收 hotTagsSlot 作为流式渲染的插槽
 * V4.2.17: 支持客户端导航时自动获取搜索结果
 * V4.3.0: 集成 AI 搜索组件（语义搜索开关、智能建议、搜索增强）
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchEmptyState } from "./search-empty-state";
import { SearchResultCard } from "@/components/search/search-result-card";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  InlineSearchModeToggle,
  AISearchSuggestions,
  AISearchEnhanced,
  type SearchMode,
} from "@/components/ai";
import {
  FilterExtractionDisplay,
  type FilterExtractionInfo,
} from "./filter-extraction-display";
import {
  SearchMetadataPanel,
  type QueryRewriteInfo,
  type ChunkSearchInfo,
  type RRFFusionInfo,
} from "./search-metadata-panel";
import { SearchFilterPanel, type SearchFilters } from "./search-filter-panel";
import {
  SearchResultGroupView,
  type GroupByOption,
  type ViewMode,
} from "./search-result-group-view";
import { SearchKeyboardHints } from "./search-keyboard-hints";
import { useSearchKeyboard } from "@/hooks/search/use-search-keyboard";
import type { Bookmark } from "@/types/supabase";
import { clientLogger } from "@/lib/client-logger";
import { createClient } from "@/lib/supabase/client";
import { ANALYTICS } from "@/lib/constants/app";

interface SearchPageClientProps {
  initialQuery: string;
  initialAIMode: boolean;
  searchResults: (Bookmark & { folders?: { name: string } | null })[];
  error?: string;
  userId: string;
}

export function SearchPageClient({
  initialQuery,
  initialAIMode,
  searchResults: ssrSearchResults,
  error: ssrError,
  userId,
}: SearchPageClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  // V4.4.0: 使用 SearchMode 类型，默认推荐 hybrid 模式
  const [searchMode, setSearchMode] = useState<SearchMode>(() => {
    if (initialAIMode) return "semantic";
    // 默认使用智能混合模式
    return "hybrid";
  });
  const aiMode = searchMode === "semantic" || searchMode === "hybrid";
  // 初始化为空数组，确保 SSR/CSR 一致，避免 hydration mismatch
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  // 热门标签 — 客户端加载，与搜索历史模式一致
  const [hotTags, setHotTags] = useState<string[]>([]);
  // V4.3.0: 控制 AI 搜索建议显示
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // V4.2.17: 客户端搜索状态（用于客户端导航时自动获取结果）
  const [clientSearchResults, setClientSearchResults] = useState<
    typeof ssrSearchResults | null
  >(null);
  const [isClientSearching, setIsClientSearching] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  // V4.3.1: 存储过滤器提取信息
  const [filterExtraction, setFilterExtraction] =
    useState<FilterExtractionInfo | null>(null);
  // V4.3.2: 存储增强搜索元数据
  const [queryRewrite, setQueryRewrite] = useState<QueryRewriteInfo | null>(
    null,
  );
  const [chunkSearch, setChunkSearch] = useState<ChunkSearchInfo | null>(null);
  const [rrfFusion, setRRFFusion] = useState<RRFFusionInfo | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  // V4.4.0: 手动过滤器状态
  const [manualFilters, setManualFilters] = useState<SearchFilters>({
    platform: "",
    timeRange: "all",
    contentType: "",
    readStatus: "all",
    starredOnly: false,
    sortBy: "relevance",
    sortOrder: "desc",
  });
  // V4.4.1: 分组视图状态
  const [groupBy, setGroupBy] = useState<GroupByOption>("none");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  // V4.4.2: 输入框聚焦状态
  const [isInputFocused, setIsInputFocused] = useState(false);

  // 客户端挂载后从服务端 API 加载搜索历史（按用户隔离）
  useEffect(() => {
    let cancelled = false;
    async function fetchHistory() {
      try {
        const response = await fetch(
          "/api/search/history?type=recent&limit=10",
        );
        if (!cancelled && response.ok) {
          const data = await response.json();
          if (data.success && data.data?.recentSearches) {
            setSearchHistory(
              data.data.recentSearches.map(
                (item: { query: string }) => item.query,
              ),
            );
          }
        }
      } catch {
        // ignore — 历史加载失败不影响核心功能
      }
    }
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  // 客户端挂载后从 Supabase RPC 加载热门标签（与搜索历史同模式，避免 Suspense hydration 问题）
  useEffect(() => {
    let cancelled = false;
    async function fetchHotTags() {
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = (await (supabase.rpc as any)("get_user_hot_tags", {
          p_user_id: (await supabase.auth.getUser()).data.user?.id,
          p_limit: ANALYTICS.TOP_TAGS_COUNT,
        })) as { data: { tag: string; count: number }[] | null };
        if (!cancelled && data) {
          setHotTags(data.map((item) => item.tag));
        }
      } catch {
        // ignore — 热门标签加载失败不影响核心功能
      }
    }
    fetchHotTags();
    return () => {
      cancelled = true;
    };
  }, []);

  // 合并 SSR 结果和客户端获取的结果
  const searchResults = clientSearchResults ?? ssrSearchResults;
  const error = clientError ?? ssrError;

  // V4.4.2: 键盘快捷键支持
  const {
    selectedIndex: _selectedIndex,
    setSelectedIndex: _setSelectedIndex,
    shortcuts,
  } = useSearchKeyboard({
    resultCount: searchResults.length,
    inputRef,
    isInputFocused,
    enabled: true,
    onOpenResult: (index) => {
      const bookmark = searchResults[index];
      if (bookmark) {
        router.push(`/bookmark/${bookmark.id}`);
      }
    },
    onClearSearch: () => {
      setQuery("");
    },
    onClosePopup: () => {
      setShowSuggestions(false);
    },
  });

  // V4.2.17: 客户端搜索函数
  // V4.3.1: 升级使用 enhanced 模式，支持智能过滤器提取
  const fetchSearchResults = useCallback(
    async (searchQuery: string, isAI: boolean) => {
      if (!searchQuery.trim()) return;

      setIsClientSearching(true);
      setClientError(null);
      setFilterExtraction(null);
      // V4.3.2: 重置增强搜索元数据
      setQueryRewrite(null);
      setChunkSearch(null);
      setRRFFusion(null);
      setExecutionTimeMs(null);

      try {
        // V4.4.0: 根据 searchMode 选择不同的 API 模式
        const apiMode = isAI
          ? searchMode === "hybrid"
            ? "hybrid"
            : "enhanced"
          : "keyword";

        const params = new URLSearchParams({
          q: searchQuery,
          mode: apiMode,
          limit: "50",
          // V4.3.2: 启用 debug 以获取 chunkSearch 和 rrfFusion 信息
          debug: isAI ? "true" : "false",
        });

        const response = await fetch(`/api/search?${params.toString()}`);
        const responseData = await response.json();

        // API 响应格式: { success: boolean, data?: { results: [...], filterExtraction?: {...} }, error?: { message: string } }
        if (!response.ok || !responseData.success) {
          throw new Error(responseData.error?.message || "搜索失败");
        }

        // 正确访问嵌套的 results 数组
        const results = responseData.data?.results || [];
        setClientSearchResults(results);

        // V4.3.1: 存储过滤器提取信息
        if (responseData.data?.filterExtraction) {
          setFilterExtraction(responseData.data.filterExtraction);
        }

        // V4.3.2: 存储增强搜索元数据
        if (responseData.data?.queryRewrite) {
          setQueryRewrite(responseData.data.queryRewrite);
        }
        if (responseData.data?.debug?.chunkSearch) {
          setChunkSearch(responseData.data.debug.chunkSearch);
        }
        if (responseData.data?.debug?.rrfFusion) {
          setRRFFusion(responseData.data.debug.rrfFusion);
        }
        if (typeof responseData.data?.executionTimeMs === "number") {
          setExecutionTimeMs(responseData.data.executionTimeMs);
        }
      } catch (err) {
        clientLogger.error({ err }, "[SearchPageClient] Client search error");
        setClientError(
          err instanceof Error ? err.message : "搜索时出错，请稍后重试",
        );
        setClientSearchResults([]);
        setFilterExtraction(null);
        // V4.3.2: 重置增强搜索元数据
        setQueryRewrite(null);
        setChunkSearch(null);
        setRRFFusion(null);
        setExecutionTimeMs(null);
      } finally {
        setIsClientSearching(false);
      }
    },
    [searchMode],
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

  // 清空搜索历史
  const clearHistory = async () => {
    setSearchHistory([]);
    try {
      await fetch("/api/search/history", { method: "DELETE" });
    } catch {
      // ignore — 清空 API 失败不影响本地状态已重置
    }
  };

  // 执行搜索（历史由 /api/search 服务端自动记录）
  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    // 乐观更新本地历史列表，避免需要重新 fetch
    setSearchHistory((prev) =>
      [searchQuery, ...prev.filter((item) => item !== searchQuery)].slice(
        0,
        10,
      ),
    );

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

  // 切换搜索模式
  // V4.4.0: 使用 SearchMode 三态类型
  const handleSearchModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    // 如果当前有搜索，立即重新搜索
    if (query.trim()) {
      const params = new URLSearchParams();
      params.set("q", query);
      // 将模式同步到 URL
      if (mode === "semantic") {
        params.set("ai", "true");
      } else if (mode === "hybrid") {
        params.set("mode", "hybrid");
      }
      // keyword 模式不需要额外参数
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
    <div className="h-full flex flex-col overflow-auto">
      {/* Content */}
      <div className="flex-1 px-4 md:px-8 py-6 md:py-8">
        {/* 搜索框区域 */}
        <div className="max-w-2xl mx-auto">
          {/* 空状态：标题 + 搜索历史 + 热门标签 */}
          {!hasQuery && (
            <SearchEmptyState
              searchHistory={searchHistory}
              hotTags={hotTags}
              onTagClick={handleTagClick}
              onClearHistory={clearHistory}
            />
          )}

          {/* 搜索框 + AI 切换一体化 */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setShowSuggestions(true);
                setIsInputFocused(true);
              }}
              onBlur={() => {
                // 延迟关闭，允许点击建议
                setTimeout(() => {
                  setShowSuggestions(false);
                  setIsInputFocused(false);
                }, 200);
              }}
              placeholder="搜索标题、作者、摘要..."
              className="pl-12 pr-[10.5rem] h-14 text-base"
            />
            {/* 右侧操作区：清除按钮 + AI 切换 */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuery("")}
                  className="h-8 w-8 p-0"
                >
                  <X className="size-4" />
                </Button>
              )}
              <InlineSearchModeToggle
                mode={searchMode}
                onModeChange={handleSearchModeChange}
              />
            </div>

            {/* V4.3.0: AI 搜��建议（下拉面板） */}
            <AISearchSuggestions
              query={query}
              onSuggestionSelect={handleSuggestionSelect}
              onClearHistory={clearHistory}
              visible={showSuggestions}
              userId={userId}
            />
          </div>

          {/* V4.4.2: 键盘快捷键提示 — 仅桌面端显示 */}
          <SearchKeyboardHints
            shortcuts={shortcuts}
            visible={!hasQuery}
            className="mb-6 hidden md:flex"
          />
        </div>

        {/* 搜索结果 */}
        {hasQuery && (
          <div className="max-w-4xl mx-auto mt-8">
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

                {/* V4.4.0: 手动过滤器面板 */}
                <SearchFilterPanel
                  filters={manualFilters}
                  onFiltersChange={setManualFilters}
                  className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                />

                {/* V4.3.1: 智能过滤器提取展示 */}
                {filterExtraction && filterExtraction.filters.length > 0 && (
                  <FilterExtractionDisplay
                    filterExtraction={filterExtraction}
                    originalQuery={initialQuery}
                    className="mb-4"
                  />
                )}

                {/* V4.3.2: 增强搜索元数据展示 */}
                {aiMode &&
                  (queryRewrite ||
                    chunkSearch ||
                    rrfFusion ||
                    executionTimeMs) && (
                    <SearchMetadataPanel
                      queryRewrite={queryRewrite ?? undefined}
                      chunkSearch={chunkSearch ?? undefined}
                      rrfFusion={rrfFusion ?? undefined}
                      executionTimeMs={executionTimeMs ?? undefined}
                      className="mb-4"
                    />
                  )}

                {/* 结果列表 */}
                {hasResults ? (
                  <SearchResultGroupView
                    results={searchResults}
                    groupBy={groupBy}
                    onGroupByChange={setGroupBy}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    renderItem={(bookmark) => (
                      <SearchResultCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        enablePreview={true}
                        previewPosition="auto"
                        onViewDetail={(b) => router.push(`/bookmark/${b.id}`)}
                      />
                    )}
                  />
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
      </div>
    </div>
  );
}
