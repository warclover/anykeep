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
import { Inbox, ArrowLeft, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrganizationSuggestionsPanel } from "./organization-suggestions-panel";
import { ClusterSuggestionsPanel } from "./cluster-suggestions-panel";
import { ClusterAnalysisBanner } from "./cluster-analysis-banner";
import { InboxTabs } from "./inbox-tabs";
import { InboxStatsCards } from "./inbox-stats-cards";
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
import {
  TAB_LABELS,
  fetchWithRetry,
  processBatch,
  type InboxPageClientProps,
} from "./inbox-constants";
import { BookmarkListCard } from "./inbox-bookmark-list-card";
import { TrustModeBanner } from "./inbox-trust-mode-banner";

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
  const {
    extendedStats,
    isLoading: isCountsLoading,
    refresh: refreshCounts,
  } = useInboxCounts();
  const invalidateInboxItems = useInvalidateInboxItems();
  const {
    items: cachedItems,
    isLoading: isItemsLoading,
    isFetching: isItemsFetching,
    isFetchingNextPage,
    hasNextPage,
    refresh: refreshItems,
    fetchNextPage,
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
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
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white"
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

        {/* 智能统计卡片（仅待分类 Tab 显示） */}
        {showOrganizePanels && (
          <InboxStatsCards
            stats={extendedStats}
            isLoading={isCountsLoading}
            className="mt-4"
          />
        )}
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
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              onLoadMore={fetchNextPage}
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
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          onLoadMore={fetchNextPage}
          tabConfig={currentTabConfig}
          onDelete={handleBookmarkDelete}
        />
      )}
    </div>
  );
}

// Re-export for barrel exports
export { InboxPageSkeleton } from "./inbox-page-skeleton";

export default InboxPageClient;
