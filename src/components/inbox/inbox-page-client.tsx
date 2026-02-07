/**
 * 收件箱客户端组件
 * V5.0 统一收件箱 - 合并等待分类与智能列表
 *
 * @description 统一的待处理内容聚合中心
 * - Tab 切换：待分类、未读、高价值、已失效、最近
 * - 根据托管模式显示不同的提示
 * - 智能整理建议面板
 *
 * @version 5.0.0
 * @since 2026-01-31
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { InboxTabs } from "./inbox-tabs";
import { ErrorMessage } from "@/components/ui/error-message";
import { useTrustMode, useConfirmations } from "@/hooks/ui";
import { useInboxCounts } from "@/hooks/data/use-inbox-counts";
import {
  useInboxItems,
  useInvalidateInboxItems,
} from "@/hooks/data/use-inbox-items";
import { cn } from "@/lib/utils";
import { dataCache } from "@/lib/cache";
import {
  DEFAULT_TAB,
  isValidInboxTabId,
  type InboxTabId,
} from "@/lib/constants/inbox-tabs";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";
import type { Bookmark } from "@/types/supabase";

// ==================== 工具函数 ====================

/**
 * 带重试的 fetch 请求
 * @param url 请求 URL
 * @param options fetch 选项
 * @param maxRetries 最大重试次数
 */
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Network error");
    }
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
    }
  }
  throw lastError || new Error("Request failed after retries");
}

/**
 * 批量��理函数（控制并发）
 * @param items 待处理项
 * @param processor 处理函数
 * @param concurrency 并发数
 */
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 3,
): Promise<Array<{ success: boolean; result?: R; error?: Error }>> {
  const results: Array<{ success: boolean; result?: R; error?: Error }> = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push({ success: true, result: result.value });
      } else {
        results.push({
          success: false,
          error:
            result.reason instanceof Error
              ? result.reason
              : new Error(String(result.reason)),
        });
      }
    }
  }
  return results;
}

// ==================== 类型定义 ====================

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
  /** @deprecated 已弃用：客户端使用 useInboxItems hook 独立获取数据，不需要此参数 */
  inboxFolderId?: number | null;
  error?: string;
  initialTab?: InboxTabId;
}

// ==================== Tab 配置映射 ====================

const TAB_LABELS: Record<InboxTabId, { title: string; description: string }> = {
  uncategorized: {
    title: "待分类书签",
    description: "这些书签尚未分类到任何文件夹，请查看左侧的智能建议或手动整理",
  },
  unread: {
    title: "未读内容",
    description: "您尚未阅读过的书签，点击书签即可标记为已读",
  },
  "high-value": {
    title: "高价值书签",
    description: "AI 评估的高质量内容，值得深度阅读和学习",
  },
  broken: {
    title: "已失效链接",
    description: "这些链接已无法访问，建议删除或更新 URL",
  },
  recent: {
    title: "最近添加",
    description: "最近 7 天内添加的书签",
  },
};

// ==================== 主组件 ====================

export function InboxPageClient({
  initialBookmarks,
  availableFolders,
  // inboxFolderId 已弃用：客户端使用 useInboxItems hook 独立获取数据
  inboxFolderId: _inboxFolderId,
  error,
  initialTab,
}: InboxPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 从 URL 读取初始 Tab
  const urlTab = searchParams?.get("tab") ?? null;
  const defaultTab =
    initialTab || (urlTab && isValidInboxTabId(urlTab) ? urlTab : DEFAULT_TAB);

  const [activeTab, setActiveTab] = useState<InboxTabId>(defaultTab);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);

  // Hooks
  const { refresh: refreshCounts } = useInboxCounts();
  const invalidateInboxItems = useInvalidateInboxItems();
  const {
    items: cachedItems,
    isLoading: isItemsLoading,
    isFetching: isItemsFetching,
    refresh: refreshItems,
  } = useInboxItems(activeTab);
  const {
    // mode 已移除：TrustModeBanner 现在只使用布尔值
    isFullAuto,
    isSemiAuto,
    isManual,
    isLoading: isTrustModeLoading,
  } = useTrustMode();
  const { pendingCount } = useConfirmations({
    pendingOnly: true,
    type: "classification",
  });

  // 使用缓存数据，首次加载使用服务端数据
  const displayBookmarks =
    cachedItems.length > 0 ? cachedItems : initialBookmarks;
  const isLoadingTab = isItemsLoading && cachedItems.length === 0;

  // 当前 Tab 配置
  const currentTabConfig = useMemo(() => TAB_LABELS[activeTab], [activeTab]);

  // 是否显示整理建议面板（仅待分类 Tab）
  const showOrganizePanels = activeTab === "uncategorized";

  // ==================== Tab 切换 ====================

  const handleTabChange = useCallback(
    (tab: InboxTabId) => {
      if (tab === activeTab) return;

      setActiveTab(tab);

      // 更新 URL（不刷新页面）
      const newUrl = tab === DEFAULT_TAB ? "/inbox" : `/inbox?tab=${tab}`;
      window.history.replaceState(null, "", newUrl);

      // TanStack Query 会自动根据 activeTab 变化获取数据
    },
    [activeTab],
  );

  // ==================== 刷新书签 ====================

  const refreshBookmarks = useCallback(async () => {
    setIsRefreshing(true);
    try {
      dataCache.invalidate(/^bookmarks:/);
      invalidateInboxItems();
      await refreshItems();
      refreshCounts();
    } catch {
      toast.error("刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  }, [invalidateInboxItems, refreshItems, refreshCounts]);

  // ==================== 一键整理 ====================

  const handleOneClickOrganize = useCallback(async () => {
    if (displayBookmarks.length === 0) {
      toast.info("没有需要整理的书签");
      return;
    }

    setIsOrganizing(true);
    const loadingToast = toast.loading("正在分析并整理书签...");

    try {
      const analysisResponse = await fetchWithRetry(API_CLASSIFICATION.inbox);
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

      const results = await processBatch(
        suggestions,
        async (suggestion: { id: number }) => {
          const response = await fetchWithRetry(
            API_CLASSIFICATION.inbox,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ suggestionId: suggestion.id }),
            },
            3,
          );
          if (!response.ok) {
            throw new Error(`Apply failed: ${response.status}`);
          }
          return response;
        },
        3,
      );

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      toast.dismiss(loadingToast);

      if (successCount > 0) {
        dataCache.invalidate(/^bookmarks:/);
        await refreshBookmarks();
        refreshCounts();

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
  }, [displayBookmarks.length, refreshBookmarks, refreshCounts]);

  // ==================== 回调函数 ====================

  const handleSuggestionApplied = useCallback(() => {
    refreshBookmarks();
    toast.success("整理建议已应用");
  }, [refreshBookmarks]);

  const handleBookmarkDelete = useCallback(
    (_id: number) => {
      // 乐观更新由 TanStack Query 处理，这里只刷新缓存
      invalidateInboxItems();
      refreshCounts();
      toast.success("书签已删除");
    },
    [invalidateInboxItems, refreshCounts],
  );

  // ==================== 初始化加载 ====================

  useEffect(() => {
    // 如果 URL 有 tab 参数且与默认不同，加载对应数据
    if (urlTab && isValidInboxTabId(urlTab) && urlTab !== "uncategorized") {
      handleTabChange(urlTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== 错误状态 ====================

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

  // ==================== 渲染 ====================

  return (
    <div className="space-y-6">
      {/* V4.2: AI 聚类分析状态横幅 */}
      {showOrganizePanels && <ClusterAnalysisBanner className="mb-2" />}

      {/* V4.2: 托管模式提示横幅 */}
      {showOrganizePanels && (
        <TrustModeBanner
          isFullAuto={isFullAuto}
          isSemiAuto={isSemiAuto}
          isManual={isManual}
          isLoading={isTrustModeLoading}
          pendingCount={pendingCount}
          onGoToMessages={() => router.push("/messages")}
          onGoToSettings={() => router.push("/settings")}
        />
      )}

      {/* 页面标题 + Tab 切换 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-white">
                收件箱
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                待处理内容聚合中心
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 一键整理按钮（仅待分类 Tab） */}
            {showOrganizePanels && displayBookmarks.length > 0 && (
              <Button
                size="sm"
                onClick={handleOneClickOrganize}
                disabled={isOrganizing || isRefreshing}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                <Wand2
                  className={cn(
                    "w-4 h-4 mr-2",
                    isOrganizing && "animate-pulse",
                  )}
                />
                {isOrganizing ? "整理中..." : "一键整理"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshBookmarks}
              disabled={isRefreshing || isOrganizing || isLoadingTab}
            >
              <RefreshCw
                className={cn(
                  "w-4 h-4 mr-2",
                  (isRefreshing || isLoadingTab) && "animate-spin",
                )}
              />
              刷新
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/home")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </div>
        </div>

        {/* Tab 切换器 */}
        <InboxTabs activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* 内容区域 */}
      {showOrganizePanels ? (
        // 待分类 Tab：两栏布局（左侧建议 + 右侧书签）
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：智能整理建议 */}
          <div className="lg:col-span-1 order-2 lg:order-1 space-y-6">
            <ClusterSuggestionsPanel onRefreshBookmarks={refreshBookmarks} />
            <OrganizationSuggestionsPanel
              availableFolders={availableFolders}
              onSuggestionApplied={handleSuggestionApplied}
            />
          </div>

          {/* 右侧：书签列表 */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <BookmarkListCard
              bookmarks={displayBookmarks}
              isLoading={isLoadingTab}
              isFetching={isItemsFetching}
              tabConfig={currentTabConfig}
              onDelete={handleBookmarkDelete}
            />
          </div>
        </div>
      ) : (
        // 其他 Tab：单栏布局
        <BookmarkListCard
          bookmarks={displayBookmarks}
          isLoading={isLoadingTab}
          isFetching={isItemsFetching}
          tabConfig={currentTabConfig}
          onDelete={handleBookmarkDelete}
        />
      )}
    </div>
  );
}

// ==================== 书签列表卡片 ====================

interface BookmarkListCardProps {
  bookmarks: BookmarkWithFolder[];
  isLoading: boolean;
  isFetching?: boolean;
  tabConfig: { title: string; description: string };
  onDelete: (id: number) => void;
}

function BookmarkListCard({
  bookmarks,
  isLoading,
  isFetching: _isFetching,
  tabConfig,
  onDelete,
}: BookmarkListCardProps) {
  const router = useRouter();

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
            共 {bookmarks.length} 个
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
      </CardContent>
    </Card>
  );
}

// ==================== 托管模式横幅 ====================

interface TrustModeBannerProps {
  isFullAuto: boolean;
  isSemiAuto: boolean;
  isManual: boolean;
  isLoading: boolean;
  pendingCount: number;
  onGoToMessages: () => void;
  onGoToSettings: () => void;
}

function TrustModeBanner({
  isFullAuto,
  isSemiAuto,
  isManual,
  isLoading,
  pendingCount,
  onGoToMessages,
  onGoToSettings,
}: TrustModeBannerProps) {
  if (isLoading) {
    return null;
  }

  if (isFullAuto) {
    return (
      <Alert className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
        <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <AlertTitle className="text-xs text-emerald-800 dark:text-emerald-300">
          全自动模式
        </AlertTitle>
        <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-400">
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

  if (isSemiAuto) {
    return (
      <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
          半自动模式
          {pendingCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
              {pendingCount} 个待确认
            </span>
          )}
        </AlertTitle>
        <AlertDescription className="text-xs text-blue-700 dark:text-blue-400">
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

  if (isManual) {
    return (
      <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
        <Hand className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-xs text-amber-800 dark:text-amber-300">
          手动模式
        </AlertTitle>
        <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
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

// ==================== 骨架屏 ====================

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

      {/* Tab 骨架 */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
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
