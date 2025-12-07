/**
 * 收件箱客户端组件
 * 展示待整理书签和智能整理建议
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  FolderInput,
  Sparkles,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
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
import { OrganizationSuggestionsPanel } from "./organization-suggestions-panel";
import { ErrorMessage } from "@/components/ui/error-message";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/types/supabase";

// 扩展的书签类型
type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface FolderOption {
  id: number;
  name: string;
}

interface InboxPageClientProps {
  initialBookmarks: BookmarkWithFolder[];
  availableFolders: FolderOption[];
  inboxFolderId: number | null;
  error?: string;
}

export function InboxPageClient({
  initialBookmarks,
  availableFolders,
  inboxFolderId: _inboxFolderId,
  error,
}: InboxPageClientProps) {
  const router = useRouter();
  const [bookmarks, setBookmarks] =
    useState<BookmarkWithFolder[]>(initialBookmarks);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 刷新书签列表
  const refreshBookmarks = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 简单刷新 - 重新加载页面数据
      router.refresh();
    } catch {
      toast.error("刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  }, [router]);

  // 建议应用后的回调
  const handleSuggestionApplied = useCallback(() => {
    // 刷新书签列表
    refreshBookmarks();
    toast.success("整理建议已应用");
  }, [refreshBookmarks]);

  // 删除书签后的回调
  const handleBookmarkDelete = useCallback((id: number) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    toast.success("书签已删除");
  }, []);

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ErrorMessage message={error} />
        <Button
          variant="outline"
          onClick={() => router.push("/home")}
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回首页
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Inbox className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              待整理
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {bookmarks.length > 0
                ? `${bookmarks.length} 个书签等待整理`
                : "暂无待整理的书签"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshBookmarks}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")}
            />
            刷新
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/home")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首页
          </Button>
        </div>
      </div>

      {/* 内容区域 - 两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：智能整理建议 */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <OrganizationSuggestionsPanel
            availableFolders={availableFolders}
            onSuggestionApplied={handleSuggestionApplied}
          />
        </div>

        {/* 右侧：书签列表 */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          {bookmarks.length === 0 ? (
            <InboxEmptyState />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderInput className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">待整理书签</CardTitle>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    共 {bookmarks.length} 个
                  </span>
                </div>
                <CardDescription>
                  这些书签尚未分类到任何文件夹，请查看左侧的智能建议或手动整理
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bookmarks.map((bookmark) => (
                    <BookmarkCard
                      key={bookmark.id}
                      bookmark={bookmark}
                      onDelete={handleBookmarkDelete}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 空状态组件
 */
function InboxEmptyState() {
  const router = useRouter();

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          太棒了！全部整理完毕
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
          所有书签都已归类到相应的文件夹中。添加新书签时，AI
          会自动建议合适的分类位置。
        </p>
        <Button onClick={() => router.push("/home")}>返回首页</Button>
      </CardContent>
    </Card>
  );
}

/**
 * 加载状态骨架屏
 */
export function InboxPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* 标题骨架 */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div>
          <Skeleton className="h-7 w-24 mb-1" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* 内容骨架 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
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
        </div>
      </div>
    </div>
  );
}

export default InboxPageClient;
