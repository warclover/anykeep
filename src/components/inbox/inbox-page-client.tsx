/**
 * 收件箱客户端组件
 * V4.2 托管模式感知
 *
 * @description 展示待整理书签和智能整理建议
 * - 根据托管模式显示不同的提示
 * - 全自动模式：显示 AI 自动处理状态
 * - 半自动模式：显示待确认分类提示
 * - 手动模式：显示传统整理建议
 *
 * @version 1.1.0
 * @since 2025-12-11
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
  Zap,
  Clock,
  Hand,
  Settings,
  Bell,
  Wand2,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkCard } from "@/components/bookmark/bookmark-card";
import { OrganizationSuggestionsPanel } from "./organization-suggestions-panel";
import { ClusterSuggestionsPanel } from "./cluster-suggestions-panel";
import { ClusterAnalysisBanner } from "./cluster-analysis-banner";
import { ErrorMessage } from "@/components/ui/error-message";
import { useTrustMode } from "@/hooks/use-trust-mode";
import { useConfirmations } from "@/hooks/use-confirmations";
import { cn } from "@/lib/utils";
import { dataCache } from "@/lib/cache";
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
  const [isOrganizing, setIsOrganizing] = useState(false);

  // V4.2: 托管模式感知
  const {
    mode,
    isFullAuto,
    isSemiAuto,
    isManual,
    isLoading: isTrustModeLoading,
  } = useTrustMode();
  const { pendingCount } = useConfirmations({
    pendingOnly: true,
    type: "classification",
  });

  // 刷新书签列表
  // V4.2.3: 添加缓存失效，确保数据一致性
  const refreshBookmarks = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 失效书签相关缓存，确保获取最新数据
      dataCache.invalidate(/^bookmarks:/);
      // 刷新页面数据
      router.refresh();
    } catch {
      toast.error("刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  }, [router]);

  // P1-3: 一键整理功能
  // 获取所有建议并自动应用
  const handleOneClickOrganize = useCallback(async () => {
    if (bookmarks.length === 0) {
      toast.info("没有需要整理的书签");
      return;
    }

    setIsOrganizing(true);
    const loadingToast = toast.loading("正在分析并整理书签...");

    try {
      // 1. 获取整理建议
      const analysisResponse = await fetch("/api/classification/inbox");
      if (!analysisResponse.ok) {
        throw new Error("获取整理建议失败");
      }

      const analysisData = await analysisResponse.json();
      const suggestions = analysisData.data?.suggestions || [];

      if (suggestions.length === 0) {
        toast.dismiss(loadingToast);
        toast.info("暂无可自动整理的建议，请手动整理或等待 AI 聚类分析");
        return;
      }

      // 2. 逐个应用建议
      let successCount = 0;
      let failCount = 0;

      for (const suggestion of suggestions) {
        try {
          const applyResponse = await fetch("/api/classification/inbox", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ suggestionId: suggestion.id }),
          });

          if (applyResponse.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      toast.dismiss(loadingToast);

      if (successCount > 0) {
        // 失效缓存并刷新
        dataCache.invalidate(/^bookmarks:/);
        router.refresh();

        if (failCount === 0) {
          toast.success(`成功整理 ${successCount} 组书签`);
        } else {
          toast.warning(`整理完成：${successCount} 成功，${failCount} 失败`);
        }
      } else {
        toast.error("整理失败，请稍后重试");
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err instanceof Error ? err.message : "整理失败");
    } finally {
      setIsOrganizing(false);
    }
  }, [bookmarks.length, router]);

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
      {/* V4.2: AI 聚类分析状态横幅 */}
      <ClusterAnalysisBanner className="mb-2" />

      {/* V4.2: 托管模式提示横幅 */}
      <TrustModeBanner
        mode={mode}
        isFullAuto={isFullAuto}
        isSemiAuto={isSemiAuto}
        isManual={isManual}
        isLoading={isTrustModeLoading}
        pendingCount={pendingCount}
        onGoToMessages={() => router.push("/messages")}
        onGoToSettings={() => router.push("/settings")}
      />

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
          {/* P1-3: 一键整理按钮 */}
          {bookmarks.length > 0 && (
            <Button
              size="sm"
              onClick={handleOneClickOrganize}
              disabled={isOrganizing || isRefreshing}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              <Wand2
                className={cn("w-4 h-4 mr-2", isOrganizing && "animate-pulse")}
              />
              {isOrganizing ? "整理中..." : "一键整理"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshBookmarks}
            disabled={isRefreshing || isOrganizing}
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
        <div className="lg:col-span-1 order-2 lg:order-1 space-y-6">
          {/* V4.2: 聚类建议面板 */}
          <ClusterSuggestionsPanel onRefreshBookmarks={refreshBookmarks} />

          {/* 原有整理建议面板 */}
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

// ============================================================================
// V4.2: 托管模式提示横幅
// ============================================================================

interface TrustModeBannerProps {
  mode: string;
  isFullAuto: boolean;
  isSemiAuto: boolean;
  isManual: boolean;
  isLoading: boolean;
  pendingCount: number;
  onGoToMessages: () => void;
  onGoToSettings: () => void;
}

function TrustModeBanner({
  mode: _mode,
  isFullAuto,
  isSemiAuto,
  isManual,
  isLoading,
  pendingCount,
  onGoToMessages,
  onGoToSettings,
}: TrustModeBannerProps) {
  // 加载中不显示
  if (isLoading) {
    return null;
  }

  // 全自动模式
  if (isFullAuto) {
    return (
      <Alert className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
        <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <AlertTitle className="text-emerald-800 dark:text-emerald-300">
          全自动模式
        </AlertTitle>
        <AlertDescription className="text-emerald-700 dark:text-emerald-400">
          <span>新书签会被 AI 自动分类到合适的文件夹。</span>
          <span className="ml-1">
            这里的书签正在等待 AI 处理或置信度较低待聚类分析。
          </span>
          <Button
            variant="link"
            size="sm"
            onClick={onGoToSettings}
            className="text-emerald-600 dark:text-emerald-400 p-0 h-auto ml-2"
          >
            <Settings className="w-3 h-3 mr-1" />
            调整设置
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // 半自动模式
  if (isSemiAuto) {
    return (
      <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-800 dark:text-blue-300 flex items-center gap-2">
          半自动模式
          {pendingCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
              {pendingCount} 个待确认
            </span>
          )}
        </AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-400">
          <span>AI 会为新书签建议分类，但需要您确认后才会执行。</span>
          {pendingCount > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={onGoToMessages}
              className="text-blue-600 dark:text-blue-400 p-0 h-auto ml-2"
            >
              <Bell className="w-3 h-3 mr-1" />
              查看待确认
            </Button>
          )}
          <Button
            variant="link"
            size="sm"
            onClick={onGoToSettings}
            className="text-blue-600 dark:text-blue-400 p-0 h-auto ml-2"
          >
            <Settings className="w-3 h-3 mr-1" />
            调整设置
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // 手动模式
  if (isManual) {
    return (
      <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
        <Hand className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">
          手动模式
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          <span>AI 分类已关闭，请手动将书签整理到文件夹。</span>
          <span className="ml-1">左侧面板提供智能建议供参考。</span>
          <Button
            variant="link"
            size="sm"
            onClick={onGoToSettings}
            className="text-amber-600 dark:text-amber-400 p-0 h-auto ml-2"
          >
            <Settings className="w-3 h-3 mr-1" />
            切换到自动模式
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
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
