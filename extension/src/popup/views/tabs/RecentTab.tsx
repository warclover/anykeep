import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

interface Bookmark {
  id: string;
  title: string;
  url: string;
  created_at: string;
  tags?: string[];
}

export function RecentTab() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const loadRecentBookmarks = useCallback(() => {
    setLoading(true);
    setError("");

    chrome.runtime.sendMessage(
      { type: "GET_RECENT", payload: { limit: 10 } },
      (response: {
        success?: boolean;
        data?: Bookmark[];
        error?: string;
      }) => {
        setLoading(false);
        if (response?.success && response?.data) {
          setBookmarks(response.data);
        } else if (response?.error) {
          setError(response.error);
        }
      },
    );
  }, []);

  useEffect(() => {
    // 使用微任务延迟执行，避免 ESLint 同步 setState 警告
    const timer = setTimeout(loadRecentBookmarks, 0);
    return () => clearTimeout(timer);
  }, [loadRecentBookmarks]);

  const openBookmark = (url: string) => {
    chrome.tabs.create({ url });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;

    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-sm text-gray-500 mb-3">{error}</p>
        <button
          onClick={loadRecentBookmarks}
          className="flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-600"
        >
          <RefreshCw className="w-4 h-4" />
          重试
        </button>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <span className="text-2xl">📚</span>
        </div>
        <p className="text-sm text-gray-500">还没有收藏</p>
        <p className="text-xs text-gray-400 mt-1">保存第一个网页开始吧</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-2">
        {bookmarks.map((bookmark) => (
          <button
            key={bookmark.id}
            onClick={() => openBookmark(bookmark.url)}
            className="w-full flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors text-left group"
          >
            <div className="w-8 h-8 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`}
                alt=""
                className="w-4 h-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <h4 className="text-sm font-medium text-gray-900 truncate flex-1">
                  {bookmark.title}
                </h4>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {new URL(bookmark.url).hostname}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">
                  {formatDate(bookmark.created_at)}
                </span>
                {bookmark.tags && bookmark.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    {bookmark.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {bookmark.tags.length > 2 && (
                      <span className="text-xs text-gray-400">
                        +{bookmark.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
