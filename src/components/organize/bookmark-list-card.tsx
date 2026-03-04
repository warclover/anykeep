"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookmarkCard } from "@/components/bookmark/bookmark-card";
import type { Bookmark } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface BookmarkListCardProps {
  bookmarks: BookmarkWithFolder[];
  isLoading: boolean;
  isFetching?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  tabConfig: { title: string; description: string };
  onDelete: (id: number) => void;
  columns?: 2 | 3;
}

export function BookmarkListCard({
  bookmarks,
  isLoading,
  isFetching: _isFetching,
  isFetchingNextPage = false,
  hasNextPage = false,
  onLoadMore,
  tabConfig,
  onDelete,
  columns = 2,
}: BookmarkListCardProps) {
  const router = useRouter();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-8 w-8 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">这里暂时没有内容</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            {tabConfig.description}
          </p>
          <Button onClick={() => router.push("/home")}>返回首页</Button>
        </CardContent>
      </Card>
    );
  }

  const gridColsClass =
    columns === 3
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
      : "grid grid-cols-1 md:grid-cols-2 gap-4";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">{tabConfig.title}</h3>
          <span className="text-xs text-muted-foreground">
            {bookmarks.length} 个{hasNextPage ? " · 继续滚动加载" : ""}
          </span>
        </div>

        <div className={gridColsClass}>
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onDelete={onDelete}
            />
          ))}
        </div>

        {hasNextPage && (
          <div ref={loadMoreRef} className="flex justify-center py-6">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                加载中...
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadMore}
                className="text-muted-foreground"
              >
                加载更多
              </Button>
            )}
          </div>
        )}

        {!hasNextPage && bookmarks.length > 0 && (
          <p className="text-center text-xs text-muted-foreground pt-4">
            已加载全部 {bookmarks.length} 个书签
          </p>
        )}
      </CardContent>
    </Card>
  );
}
