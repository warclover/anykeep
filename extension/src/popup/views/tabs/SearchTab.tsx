import React, { useState, useCallback } from "react";
import { Search, ExternalLink, Loader2, X } from "lucide-react";

// 本地 Favicon 首字母方案（避免 Google Favicon API 在国内不可用）
const FAVICON_COLORS = [
  { bg: "#FEE2E2", text: "#DC2626" },
  { bg: "#FFEDD5", text: "#EA580C" },
  { bg: "#FEF3C7", text: "#D97706" },
  { bg: "#D1FAE5", text: "#059669" },
  { bg: "#CCFBF1", text: "#0D9488" },
  { bg: "#CFFAFE", text: "#0891B2" },
  { bg: "#DBEAFE", text: "#2563EB" },
  { bg: "#E0E7FF", text: "#4F46E5" },
  { bg: "#EDE9FE", text: "#7C3AED" },
  { bg: "#FCE7F3", text: "#DB2777" },
];

function getFaviconInfo(url: string) {
  try {
    const { hostname } = new URL(url);
    const domain = hostname.replace(/^www\./, "");
    const letter = (domain[0] || "?").toUpperCase();
    const hash = Array.from(domain).reduce(
      (acc, c) => acc + c.charCodeAt(0),
      0,
    );
    const color = FAVICON_COLORS[hash % FAVICON_COLORS.length];
    return { letter, bg: color.bg, text: color.text };
  } catch {
    return {
      letter: "?",
      bg: FAVICON_COLORS[0].bg,
      text: FAVICON_COLORS[0].text,
    };
  }
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
  description?: string;
  tags?: string[];
}

export function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [total, setTotal] = useState(0);

  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    chrome.runtime.sendMessage(
      { type: "SEARCH", payload: { query: searchQuery.trim(), limit: 20 } },
      (response: {
        success?: boolean;
        data?: { bookmarks: Bookmark[]; total: number };
        error?: string;
      }) => {
        setLoading(false);
        if (response?.success && response?.data) {
          setResults(response.data.bookmarks);
          setTotal(response.data.total);
        } else {
          setResults([]);
          setTotal(0);
        }
      },
    );
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // 防抖搜索
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(query);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
  };

  const openBookmark = (url: string) => {
    chrome.tabs.create({ url });
  };

  return (
    <div className="flex flex-col h-full">
      {/* 搜索框 */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="搜索收藏..."
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoFocus
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 搜索结果 */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">未找到相关收藏</p>
            <p className="text-xs text-gray-400 mt-1">试试其他关键词</p>
          </div>
        )}

        {!loading && !hasSearched && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">输入关键词搜索收藏</p>
            <p className="text-xs text-gray-400 mt-1">
              支持标题、内容、标签搜索
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="p-2">
            {/* 结果统计 */}
            <p className="text-xs text-gray-400 px-2 mb-2">
              找到 {total} 个结果
            </p>

            {results.map((bookmark) => {
              const favicon = getFaviconInfo(bookmark.url);
              return (
                <button
                  key={bookmark.id}
                  onClick={() => openBookmark(bookmark.url)}
                  className="w-full flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors text-left group"
                >
                  <div
                    className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-xs font-medium"
                    style={{
                      backgroundColor: favicon.bg,
                      color: favicon.text,
                    }}
                  >
                    {favicon.letter}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate flex-1">
                        {bookmark.title}
                      </h4>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    </div>
                    {bookmark.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                        {bookmark.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {new URL(bookmark.url).hostname}
                    </p>
                    {bookmark.tags && bookmark.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {bookmark.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {bookmark.tags.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{bookmark.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
