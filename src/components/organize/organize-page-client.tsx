/**
 * 整理中心页面客户端组件
 *
 * V3.0 统一整理入口 - 整合收件箱功能
 *
 * 功能：
 * - 6 个 Tab：待处理、未读、高价值、已失效、最近、健康诊断
 * - 待处理 Tab：聚类建议 + 整理建议 + 书签列表
 * - 其他书签 Tab：书签列表（无限滚动）
 * - 健康诊断 Tab：文件夹健康 + 内容健康
 * - 快速操作和整理进度
 *
 * @version 3.0.0 - 整合收件箱功能
 * @since 2026-01-10
 * @updated 2026-02-13
 */

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  CheckCircle,
  RefreshCw,
  ArrowLeft,
  Wand2,
  Zap,
  Clock,
  Hand,
  Settings,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkCard } from "@/components/bookmark/bookmark-card";
import { OrganizeTabs } from "./organize-tabs";
import { QuickActionGrid } from "./quick-action-grid";
import { OrganizeProgress } from "./organize-progress";
import { OrganizeComparison } from "./organize-comparison";
import { HealthDiagnosisPanel } from "./health-diagnosis-panel";
import { IssueDetailDrawer } from "./issue-detail-drawer";
import { ClusterSuggestionsPanel } from "@/components/inbox/cluster-suggestions-panel";
import { OrganizationSuggestionsPanel } from "@/components/inbox/organization-suggestions-panel";
import { ClusterAnalysisBanner } from "@/components/inbox/cluster-analysis-banner";
import { InboxStatsCards } from "@/components/inbox/inbox-stats-cards";
import { useTrustMode, useConfirmations } from "@/hooks/ui";
import { useOrganizeCounts } from "@/hooks/data/use-organize-counts";
import {
  useOrganizeItems,
  useInvalidateOrganizeItems,
} from "@/hooks/data/use-organize-items";
import { useOrganizeComparison } from "@/hooks/domain/organize/use-organize-comparison";
import { useLibrarianAnalysis } from "@/hooks/domain/folder/use-librarian-analysis";
import { useHealthActions } from "@/hooks/domain/organize/use-health-actions";
import { useAIChat } from "@/hooks/domain/ai";
import { clientLogger } from "@/lib/client-logger";
import { dataCache } from "@/lib/cache";
import {
  DEFAULT_ORGANIZE_TAB,
  isValidOrganizeTabId,
  isBookmarkTab,
  type OrganizeTabId,
} from "@/lib/constants/organize-tabs";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";
import type { Bookmark } from "@/types/supabase";
import type { OrganizePageState, QuickActionType } from "@/lib/organize/types";
import type { IssueType, ActionType } from "./issue-summary-list";

// ==================== Tab 标题配置 ====================

const TAB_TITLES: Record<
  OrganizeTabId,
  { title: string; description: string }
> = {
  pending: {
    title: "待处理书签",
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
  health: {
    title: "健康诊断",
    description: "分析文件夹结构和内容健康度",
  },
};

// ==================== 工具函数 ====================

/**
 * 带重试的 fetch 请求
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

// ==================== 进度配置 ====================

const ACTION_MESSAGES: Record<QuickActionType, string> = {
  "one-click": "帮我一键整理收藏",
  "clean-duplicates": "清理重复的收藏",
  "smart-categorize": "智能分类未分类的收藏",
  "auto-tag": "为没有标签的收藏自动打标签",
  "archive-stale": "归档长期未读的内容",
};

const PROGRESS_STEP_THRESHOLDS = [
  { maxPercent: 15, step: 0 },
  { maxPercent: 30, step: 1 },
  { maxPercent: 50, step: 2 },
  { maxPercent: 70, step: 3 },
  { maxPercent: 90, step: 4 },
] as const;

function calculateStep(percent: number): number {
  for (const { maxPercent, step } of PROGRESS_STEP_THRESHOLDS) {
    if (percent < maxPercent) return step;
  }
  return PROGRESS_STEP_THRESHOLDS.length - 1;
}

interface ProgressState {
  message: string;
  percent: number;
  step: number;
}

// ==================== 主组件 ====================

interface OrganizePageClientProps {
  availableFolders?: { id: number; name: string }[];
}

export function OrganizePageClient({
  availableFolders = [],
}: OrganizePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 从 URL 读取初始 Tab
  const urlTab = searchParams?.get("tab") ?? null;
  const defaultTab =
    urlTab && isValidOrganizeTabId(urlTab) ? urlTab : DEFAULT_ORGANIZE_TAB;

  const [activeTab, setActiveTab] = useState<OrganizeTabId>(defaultTab);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [state, setState] = useState<OrganizePageState>("idle");
  const [progress, setProgress] = useState<ProgressState>({
    message: "",
    percent: 0,
    step: 0,
  });
  const [organizeError, setOrganizeError] = useState<string | null>(null);
  const [showIssueDrawer, setShowIssueDrawer] = useState(false);

  // Hooks
  const {
    extendedStats,
    isLoading: isCountsLoading,
    refresh: refreshCounts,
  } = useOrganizeCounts();
  const invalidateOrganizeItems = useInvalidateOrganizeItems();
  const {
    items: displayBookmarks,
    isLoading: isItemsLoading,
    isFetching: isItemsFetching,
    isFetchingNextPage,
    hasNextPage,
    refresh: refreshItems,
    fetchNextPage,
  } = useOrganizeItems(activeTab);
  const {
    isFullAuto,
    isSemiAuto,
    isManual,
    isLoading: isTrustModeLoading,
  } = useTrustMode();
  const { pendingCount } = useConfirmations({
    pendingOnly: true,
    type: "classification",
  });

  const {
    beforeSnapshot,
    afterSnapshot,
    captureBeforeSnapshot,
    captureAfterSnapshot,
    reset: resetSnapshots,
    hasComparison,
    error: snapshotError,
  } = useOrganizeComparison();

  const { analysis, refresh: refreshAnalysis } = useLibrarianAnalysis();

  const { mergeFolders, deleteFolder, renameFolder, createFolder } =
    useHealthActions({
      onSuccess: () => {
        refreshAnalysis();
      },
    });

  const { sendMessage, cancel } = useAIChat({
    onStream: (chunk) => {
      if ("type" in chunk && chunk.type === "progress") {
        const data = chunk.data as {
          step?: string;
          percent?: number;
          message?: string;
        };
        setProgress((prev) => {
          const newPercent =
            typeof data.percent === "number" ? data.percent : prev.percent;
          return {
            message: data.step ?? prev.message,
            percent: newPercent,
            step: calculateStep(newPercent),
          };
        });
      }
    },
    onComplete: async () => {
      try {
        await captureAfterSnapshot();
        await refreshAnalysis();
        setState("complete");
      } catch (error) {
        clientLogger.error({ error }, "Failed to capture after snapshot");
        setState("complete");
        setOrganizeError("获取整理后统计数据失败，但整理已完成");
      }
    },
    onError: (error) => {
      clientLogger.error({ error }, "Organize error");
      setOrganizeError(error.message || "整理过程中发生错误");
      setState("idle");
    },
  });

  // 当前 Tab 配置
  const currentTabConfig = useMemo(() => TAB_TITLES[activeTab], [activeTab]);

  // 是否显示整理建议面板（仅待处理 Tab）
  const showOrganizePanels = activeTab === "pending";

  // 是否为书签列表 Tab
  const isBookmarkListTab = isBookmarkTab(activeTab);

  const isLoadingTab = isItemsLoading && displayBookmarks.length === 0;

  // ==================== Tab 切换 ====================

  const handleTabChange = useCallback(
    (tab: OrganizeTabId) => {
      if (tab === activeTab) return;

      setActiveTab(tab);

      // 更新 URL（不刷新页面）
      const newUrl =
        tab === DEFAULT_ORGANIZE_TAB ? "/organize" : `/organize?tab=${tab}`;
      window.history.replaceState(null, "", newUrl);
    },
    [activeTab],
  );

  // ==================== 刷新 ====================

  const refreshBookmarks = useCallback(async () => {
    setIsRefreshing(true);
    try {
      dataCache.invalidate(/^bookmarks:/);
      invalidateOrganizeItems();
      await refreshItems();
      refreshCounts();
    } catch {
      toast.error("刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  }, [invalidateOrganizeItems, refreshItems, refreshCounts]);

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

      const results = await Promise.allSettled(
        suggestions.map(async (suggestion: { id: number }) => {
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
        }),
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failCount = results.filter((r) => r.status === "rejected").length;

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

  // ==================== AI 整理操作 ====================

  const handleOrganizeAction = useCallback(
    async (actionType: QuickActionType) => {
      setState("analyzing");
      setProgress({ message: "正在分析您的收藏...", percent: 0, step: 0 });
      setOrganizeError(null);

      try {
        await captureBeforeSnapshot();
        setState("executing");
        await sendMessage(ACTION_MESSAGES[actionType], {
          useUnifiedEngine: true,
        });
      } catch (error) {
        clientLogger.error({ error }, "Organize action failed");
        setOrganizeError(
          error instanceof Error ? error.message : "整理操作失败",
        );
        setState("idle");
      }
    },
    [captureBeforeSnapshot, sendMessage],
  );

  const handleReset = useCallback(() => {
    setState("idle");
    setProgress({ message: "", percent: 0, step: 0 });
    setOrganizeError(null);
    resetSnapshots();
  }, [resetSnapshots]);

  const handleCancel = useCallback(() => {
    cancel();
    setState("idle");
    setProgress({ message: "", percent: 0, step: 0 });
    setOrganizeError(null);
  }, [cancel]);

  // ==================== 回调函数 ====================

  const handleSuggestionApplied = useCallback(() => {
    refreshBookmarks();
    toast.success("整理建议已应用");
  }, [refreshBookmarks]);

  const handleBookmarkDelete = useCallback(
    (_id: number) => {
      invalidateOrganizeItems();
      refreshCounts();
      toast.success("书签已删除");
    },
    [invalidateOrganizeItems, refreshCounts],
  );

  const handleIssueAction = useCallback(
    async (type: IssueType, itemId: number, action: ActionType) => {
      if (!analysis) return;

      switch (action) {
        case "merge": {
          const group = analysis.duplicateFolders[itemId];
          if (group && group.folders.length >= 2) {
            const suggestedTarget = group.folders.find((f) =>
              group.suggestedMerge?.includes(f.name),
            );
            const target = suggestedTarget || group.folders[0];
            const source = group.folders.find((f) => f.id !== target.id);
            if (source) {
              await mergeFolders(source.id, target.id);
            }
          }
          break;
        }
        case "delete": {
          await deleteFolder(itemId);
          break;
        }
        case "rename": {
          const namingItem = analysis.poorlyNamedFolders.find(
            (item) => item.folder.id === itemId,
          );
          if (namingItem) {
            await renameFolder(itemId, namingItem.suggestedName);
          }
          break;
        }
        case "create": {
          const missingItem = analysis.missingCategories[itemId];
          if (missingItem) {
            await createFolder(missingItem.category);
          }
          break;
        }
        case "split": {
          toast.info("拆分功能开发中，敬请期待");
          break;
        }
      }
    },
    [analysis, mergeFolders, deleteFolder, renameFolder, createFolder],
  );

  // ==================== 初始化 ====================

  useEffect(() => {
    if (
      urlTab &&
      isValidOrganizeTabId(urlTab) &&
      urlTab !== DEFAULT_ORGANIZE_TAB
    ) {
      handleTabChange(urlTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isExecuting = state === "analyzing" || state === "executing";

  // ==================== 渲染 ====================

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              整理
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AI 智能整理，保持知识库整洁有序
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 一键整理按钮（仅待处理 Tab） */}
          {showOrganizePanels && displayBookmarks.length > 0 && (
            <Button
              size="sm"
              onClick={handleOneClickOrganize}
              disabled={isOrganizing || isRefreshing}
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white"
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

      {/* V4.2: AI 聚类分析状态横幅（仅待处理 Tab） */}
      {showOrganizePanels && <ClusterAnalysisBanner className="mb-2" />}

      {/* 托管模式提示横幅（仅待处理 Tab） */}
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

      {/* Tab 切换器 */}
      <OrganizeTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* 智能统计卡片（仅待处理 Tab 显示） */}
      {showOrganizePanels && (
        <InboxStatsCards stats={extendedStats} isLoading={isCountsLoading} />
      )}

      {/* 错误提示 */}
      {organizeError && state === "idle" && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              ⚠️ {organizeError}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 主内容区域 */}
      {activeTab === "health" ? (
        // 健康诊断 Tab
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 左侧：快速操作 / 进度 / 结果 */}
          <div className="lg:col-span-3 space-y-6">
            {state === "idle" && (
              <QuickActionGrid
                onAction={handleOrganizeAction}
                disabled={isExecuting}
              />
            )}

            {isExecuting && (
              <OrganizeProgress
                status={state}
                message={progress.message}
                progress={progress.percent}
                currentStep={progress.step}
                onCancel={handleCancel}
              />
            )}

            {state === "complete" &&
              hasComparison &&
              beforeSnapshot &&
              afterSnapshot && (
                <OrganizeComparison
                  before={beforeSnapshot}
                  after={afterSnapshot}
                  onReset={handleReset}
                />
              )}

            {state === "complete" && !hasComparison && (
              <Card>
                <CardContent className="p-6 text-center space-y-4">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold">整理完成！</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      {snapshotError || organizeError || "整理操作已完成"}
                    </p>
                  </div>
                  <Button onClick={handleReset}>继续整理</Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧：健康诊断面板 */}
          <div className="lg:col-span-2">
            <HealthDiagnosisPanel
              onViewAllIssues={() => setShowIssueDrawer(true)}
              onIssueAction={handleIssueAction}
              disabled={isExecuting}
            />
          </div>
        </div>
      ) : showOrganizePanels ? (
        // 待处理 Tab：两栏布局（左侧建议 + 右侧书签）
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
      ) : isBookmarkListTab ? (
        // 其他书签 Tab：单栏布局
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
      ) : null}

      {/* 问题详情抽屉 */}
      {analysis && (
        <IssueDetailDrawer
          open={showIssueDrawer}
          onOpenChange={setShowIssueDrawer}
          duplicateFolders={analysis.duplicateFolders}
          emptyFolders={analysis.emptyFolders}
          oversizedFolders={analysis.oversizedFolders}
          poorlyNamedFolders={analysis.poorlyNamedFolders}
          missingCategories={analysis.missingCategories}
          onMerge={(groupIndex) => {
            const group = analysis.duplicateFolders[groupIndex];
            if (group && group.folders.length >= 2) {
              const [source, target] = group.folders;
              mergeFolders(source.id, target.id);
            }
          }}
          onDelete={(folderId) => deleteFolder(folderId)}
          onSplit={() => toast.info("拆分功能开发中，敬请期待")}
          onRename={(folderId, newName) => renameFolder(folderId, newName)}
          onCreate={(categoryIndex) => {
            const item = analysis.missingCategories[categoryIndex];
            if (item) {
              createFolder(item.category);
            }
          }}
        />
      )}
    </div>
  );
}

// ==================== 书签列表卡片 ====================

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
}

function BookmarkListCard({
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

  // IntersectionObserver
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

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{tabConfig.title}</h3>
          <span className="text-sm text-muted-foreground">
            已加载 {bookmarks.length} 个
            {hasNextPage ? "，向下滚动加载更多" : ""}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {tabConfig.description}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onDelete={onDelete}
            />
          ))}
        </div>

        {/* 加载更多 */}
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
  if (isLoading) return null;

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

export function OrganizePageSkeleton() {
  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* 标题骨架 */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div>
          <Skeleton className="h-7 w-24 mb-1" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Tab 骨架 */}
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-md" />
        ))}
      </div>

      {/* 内容骨架 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
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

export default OrganizePageClient;
