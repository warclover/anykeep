/**
 * 收件箱 - 书签列表卡片组件
 */

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FolderInput, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkCard } from "@/components/bookmark/bookmark-card";
import type { BookmarkWithFolder } from "./inbox-constants";

interface BookmarkListCardProps {
  bookmarks: BookmarkWithFolder[];
  isLoading: boolean;
  isFetching?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  tabConfig: { title: string; description: string };
  onDelete: (id: number) => void;
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
}: BookmarkListCardProps) {
  const router = useRouter();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver：滚动到底部自动加载更多
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
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            这里暂时没有内容
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
            {tabConfig.description}
          </p>
          <Button onClick={() => router.push("/home")}>返回首页</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderInput className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">{tabConfig.title}</CardTitle>
          </div>
          <span className="text-sm text-muted-foreground">
            已加载 {bookmarks.length} 个
            {hasNextPage ? "，向下滚动加载更多" : ""}
          </span>
        </div>
        <CardDescription>{tabConfig.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onDelete={onDelete}
            />
          ))}
        </div>

        {/* 加载更多触发区域 */}
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

        {/* 已全部加载提示 */}
        {!hasNextPage && bookmarks.length > 0 && (
          <p className="text-center text-xs text-muted-foreground pt-4">
            已加载全部 {bookmarks.length} 个书签
          </p>
        )}
      </CardContent>
    </Card>
  );
}
