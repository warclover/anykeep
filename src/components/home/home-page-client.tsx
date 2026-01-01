/**
 * 首页客户端组件
 * 实现平台筛选、加载更多、编辑删除等交互功能
 *
 * 性能优化：
 * - 支持客户端数据获取模式（无服务端阻塞）
 * - 初始加载时显示 skeleton
 * - 平台数据缓存减少重复请求
 */

"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/core";
import { useInitData } from "@/hooks/data";
import { useBookmarksSWR, cachePerformanceTracker } from "@/lib/cache";
import { Button } from "@/components/ui/button";
import { BrowserBookmarkVirtualList } from "@/components/bookmark/browser-bookmark-virtual-list";
import { VirtualBookmarkList } from "@/components/bookmark/virtual-bookmark-list";
import { VirtualBookmarkGrid } from "@/components/bookmark/virtual-bookmark-grid";
import { VirtualTrashBookmarkGrid } from "@/components/bookmark/virtual-trash-bookmark-grid";
import { BrowserBookmarkEmptyState } from "@/components/bookmark/browser-bookmark-empty-state";
// V3.1: FolderRecommendationToast 已废弃，由 useClassificationPolling 的 toast 通知替代
import { EmptyState } from "@/components/bookmark/empty-state";
// Phase 3.4: 使用 HomePageContext 替代 Event 监听
import { useHomePageContext } from "@/contexts/home-page-context";
import { useSnapshotFeature } from "@/components/snapshot";
import { prefetchCustomUsageTags } from "@/hooks/data";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";

// 懒加载 ReclassifyBanner（非首屏关键组件）
const ReclassifyBanner = lazy(() =>
  import("@/components/bookmark/reclassify-banner").then((mod) => ({
    default: mod.ReclassifyBanner,
  })),
);

// 懒加载 InboxOrganizationBanner（V2 整理建议）
const InboxOrganizationBanner = lazy(() =>
  import("@/components/inbox/inbox-organization-banner").then((mod) => ({
    default: mod.InboxOrganizationBanner,
  })),
);

// 懒加载 PendingConfirmationsSection（V4.2 待确认消息 - 重构版）
const PendingConfirmationsSection = lazy(() =>
  import("@/components/classification/pending-confirmations").then((mod) => ({
    default: mod.PendingConfirmationsSection,
  })),
);

// 懒加载 ProactiveBriefingCard（AI Secretary Evolution Phase 0）
const ProactiveBriefingCard = lazy(() =>
  import("@/components/ai/briefing").then((mod) => ({
    default: mod.ProactiveBriefingCard,
  })),
);
// V3.1: 替换 V1 的 useFolderRecommendation 为 V3 的分类轮询
import { useClassificationPolling } from "@/hooks/ui";
import { useDialogs, useSelectionMode } from "@/hooks/core";
import { useProcessingPoller } from "@/hooks/ui";
import { ErrorMessage } from "@/components/ui/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { SilentErrorBoundary } from "@/components/ui/lazy-error-boundary";
import type { Bookmark } from "@/types/supabase";
import { DEFAULT_PAGE_SIZE, getPageSizeByView } from "./constants";
import { useHomeViewMode } from "./hooks/use-home-view-mode";
import { useHomeMutations } from "./hooks/use-home-mutations";
import { useHomeBatch } from "./hooks/use-home-batch";
import { HomeToolbar } from "./home-toolbar";
import { HomeDialogs } from "./home-dialogs";
import { SmartListView } from "@/components/smart-list";
import { BatchTagDialog } from "@/components/batch/batch-tag-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SynthesisRecommendBubble } from "@/components/synthesis/synthesis-recommend-bubble";
import { useSynthesisRecommend } from "@/hooks/synthesis/use-synthesis-recommend";

// 扩展的书签类型（包含文件夹信息）
type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface HomePageClientProps {
  // 服务端传递的初始数据（可选，用于 SSR 场景）
  initialBookmarks?: BookmarkWithFolder[];
  error?: string;
  // 客户端导航传入的参数（优先于 searchParams）
  urlFolder?: string;
  urlPlatform?: string;
  // 智能列表模式：传入 smartListId 时显示智能列表视图
  smartListId?: number | null;
}

export function HomePageClient({
  initialBookmarks,
  error,
  urlFolder: propFolder,
  urlPlatform: propPlatform,
  smartListId,
}: HomePageClientProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Phase 3.4: 使用 HomePageContext 获取筛选状态（替代 Event 监听）
  const homeContext = useHomePageContext();

  // Phase 3.4 修复：URL 参数作为数据获取的主要来源（避免双重获取）
  // Context 仅用于跨组件通信，不作为数据获取的依据
  const urlPlatform = propPlatform ?? searchParams?.get("platform") ?? "";
  const urlFolder = propFolder ?? searchParams?.get("folder") ?? "";
  const urlUsageTags = searchParams?.get("usageTags") || "";
  const urlSort = searchParams?.get("sort") || "created_desc";

  // 解析用途标签
  const parsedUsageTags = urlUsageTags
    ? urlUsageTags.split(",").filter(Boolean)
    : [];

  // Phase 3.4: 同步 URL 参数到 Context（仅首次挂载时）
  // 使用 ref 确保只同步一次，避免触发不必要的重渲染
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    // 仅当 URL 有值且与 Context 不同时才同步
    if (urlPlatform && urlPlatform !== homeContext.filter.platform) {
      homeContext.filter.setPlatform(urlPlatform);
    }
    if (urlFolder && urlFolder !== homeContext.filter.folder) {
      homeContext.filter.setFolder(urlFolder);
    }
    if (
      parsedUsageTags.length > 0 &&
      JSON.stringify(parsedUsageTags) !==
        JSON.stringify([...homeContext.filter.usageTags])
    ) {
      homeContext.filter.setUsageTags(parsedUsageTags);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次挂载
  }, []);

  // V10.1: 预加载自定义用途标签（详情页需要，提前加载消除延迟）
  useEffect(() => {
    prefetchCustomUsageTags();
  }, []);

  // V10.0: 智能列表 ID（客户端导航时从 URL 读取，SSR 时从 props 读取）
  const urlSmartListParam = searchParams?.get("smartList");
  const urlSmartListId = urlSmartListParam
    ? parseInt(urlSmartListParam, 10)
    : null;
  // 最终使用的智能列表 ID：URL 参数优先（支持客户端导航）
  const currentSmartListId =
    urlSmartListId && !isNaN(urlSmartListId) ? urlSmartListId : smartListId;

  // Phase 3.4 修复：数据获取的参数来源
  // - 首次加载：使用 URL 参数（避免双重获取）
  // - 后续交互：响应 Context 变化（跨组件通信）
  const [currentPlatform, setCurrentPlatform] = useState(urlPlatform);
  const [currentFolder, setCurrentFolder] = useState(urlFolder);
  const [localUsageTags, setLocalUsageTags] = useState(parsedUsageTags);
  const currentSort = urlSort;

  // V4.2.x: 滚动容器 ref（用于虚拟滚动的 customScrollParent）
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );

  // 在 DOM 挂载后获取滚动容器（使用 useLayoutEffect 避免二次渲染闪烁）
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      setScrollContainer(scrollContainerRef.current);
    }
  }, []);

  // 响应 Context 平台/文件夹变化（用户交互触发）
  // 使用 ref 跳过首次挂载，避免与初始 URL 同步冲突
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    // Context 变化时更新本地状态（触发数据重新获取）
    setCurrentPlatform(homeContext.filter.platform);
    setCurrentFolder(homeContext.filter.folder);
    setLocalUsageTags([...homeContext.filter.usageTags]);
  }, [
    homeContext.filter.platform,
    homeContext.filter.folder,
    homeContext.filter.usageTags,
  ]);

  // 检测是否为浏览器书签平台
  const isBrowserPlatform = currentPlatform === "browser";

  // 检测是否为虚拟文件夹
  const isTrashFolder = currentFolder === "trash";

  // 可取消请求 Hook
  const { fetchWithAbort } = useAbortableFetch();

  // V4.2.17: 使用提取的视图模式 Hook（包含 localStorage 持久化和事件监听）
  const {
    viewMode,
    setViewMode,
    layoutMode,
    setLayoutMode,
    enableFlipCard,
    setEnableFlipCard,
    effectiveViewMode: _effectiveViewMode,
  } = useHomeViewMode({ isBrowserPlatform });

  // V4.2.17: 视图模式切换（Hook 已内置 localStorage 持久化）
  // 直接使用 Hook 返回的 setViewMode、setLayoutMode
  const handleViewModeChange = setViewMode;
  const handleLayoutModeChange = setLayoutMode;

  // 切换翻转卡片模式并同步到其他组件
  const handleFlipCardToggle = () => {
    const newValue = !enableFlipCard;
    setEnableFlipCard(newValue);
    // 触发事件通知其他组件（如 PlatformFilter）
    uiEventBus.emit(UIEvents.FLIP_CARD_CHANGE, { enabled: newValue });
  };

  // ===== V4.2.24: 聚合数据获取（性能优化） =====
  // 当没有 SSR 初始数据时，使用聚合 API 一次获取所有数据
  // 好处：7+ 个请求合并为 1 个，单次认证替代多次重复认证
  const shouldUseInitData =
    !initialBookmarks?.length && // 没有 SSR 数据
    !currentPlatform && // 默认平台（全部）
    !currentFolder && // 没有文件夹筛选
    !localUsageTags.length; // 没有用途标签筛选

  const { bookmarks: initBookmarks, isLoading: isInitDataLoading } =
    useInitData({
      enabled: shouldUseInitData,
    });

  // ===== SWR 数据缓存（性能优化核心） =====
  // 使用 SWR 模式：有缓存先显示，后台自动刷新
  // V4.2.24: 优先使用聚合 API 数据作为初始值
  const effectiveInitialData = initialBookmarks?.length
    ? initialBookmarks
    : initBookmarks.length
      ? initBookmarks
      : undefined;

  const {
    data: bookmarks,
    hasMore,
    isLoading: isInitialLoading,
    isValidating: _isValidating,
    isStale: _isStale,
    error: _swrError,
    mutate: mutateBookmarks,
    setHasMore,
    refetch: _refetch,
    loadMore: _loadMore,
    updateCacheItem,
    removeCacheItem,
    appendToCache,
  } = useBookmarksSWR({
    platform: currentPlatform,
    sort: currentSort,
    folder: currentFolder,
    usageTags: localUsageTags, // V9.0新增：用途标签筛选
    initialData: effectiveInitialData,
    // V4.2.24: 当使用聚合 API 且正在加载时，暂时禁用独立获取
    enabled: !shouldUseInitData || !isInitDataLoading,
  });

  // 兼容层：setBookmarks 改为使用 mutate（支持数组和函数两种形式）
  const setBookmarks = mutateBookmarks;

  // V5.0.1: 追踪首次渲染性能（有缓存时标记首次渲染完成）
  const hasTrackedFirstRenderRef = useRef(false);
  useEffect(() => {
    // 只在有数据且未追踪过时标记首次渲染
    if (bookmarks.length > 0 && !hasTrackedFirstRenderRef.current) {
      hasTrackedFirstRenderRef.current = true;
      cachePerformanceTracker.markFirstRender("data-cache");
      // 延迟结束会话，确保所有指标被记录
      setTimeout(() => {
        cachePerformanceTracker.endSession("data-cache");
      }, 100);
    }
  }, [bookmarks]);

  // 监听新建收藏事件（乐观更新，将新书签插入列表头部）
  // 单独的 useEffect 以正确处理依赖项，避免闭包问题
  useEffect(() => {
    const unsubscribe = uiEventBus.on(UIEvents.BOOKMARK_CREATED, (payload) => {
      const newBookmark = payload.bookmark as BookmarkWithFolder;

      // 只在「全部」平台或新书签匹配当前平台时插入
      // 避免在筛选其他平台时显示不相关的新书签
      const shouldInsert =
        !currentPlatform || // 「全部」平台
        currentPlatform === newBookmark.platform || // 匹配当前平台
        (currentPlatform === "browser" &&
          newBookmark.platform?.startsWith("BROWSER_")); // 浏览器书签

      if (shouldInsert && !currentFolder) {
        // 仅在非虚拟文件夹（如垃圾箱）时插入
        setBookmarks((prev) => [newBookmark, ...prev]);
      }
    });

    return unsubscribe;
  }, [currentPlatform, currentFolder, setBookmarks]);

  // 智能轮询：自动更新 PROCESSING 状态的书签
  // 当后台完成标题获取或 AI 处理后，自动刷新卡片数据
  useProcessingPoller({
    bookmarks,
    onUpdate: useCallback(
      (updatedBookmark: BookmarkWithFolder) => {
        setBookmarks((prev) =>
          prev.map((b) => (b.id === updatedBookmark.id ? updatedBookmark : b)),
        );
      },
      [setBookmarks],
    ),
    enabled: !isInitialLoading, // 初始加载完成后才启用
  });

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 对话框和下拉菜单状态管理
  const {
    showCreateDialog,
    showImportDialog,
    showBrowserImportDialog,
    showExportDialog,
    showMoveDialog,
    isDesktopImportMenuOpen: _isDesktopImportMenuOpen,
    isMobileMoreMenuOpen,
    openCreateDialog,
    setShowCreateDialog,
    openImportDialog,
    setShowImportDialog,
    openBrowserImportDialog,
    setShowBrowserImportDialog,
    openExportDialog,
    setShowExportDialog,
    openMoveDialog,
    setShowMoveDialog,
    setIsDesktopImportMenuOpen: _setIsDesktopImportMenuOpen,
    setIsMobileMoreMenuOpen,
  } = useDialogs();

  // 批量标签对话框状态
  const [showBatchTagDialog, setShowBatchTagDialog] = useState(false);

  // 综述确认对话框状态
  const [showSynthesisDialog, setShowSynthesisDialog] = useState(false);
  const [isCreatingSynthesis, setIsCreatingSynthesis] = useState(false);

  // E8: 综述智能推荐 - 延迟加载优化 (FCP 性能修复)
  // 延迟 AI 功能加载，避免阻塞首屏渲染
  const [deferredAIReady, setDeferredAIReady] = useState(false);

  const {
    currentRecommend,
    shouldShowBubble,
    acceptRecommend,
    dismissRecommend,
    closeBubble,
    refresh: refreshSynthesisRecommend,
  } = useSynthesisRecommend({
    autoFetch: false, // 禁用自动获取，延迟到首屏渲染完成后
    autoShowBubble: true,
  });

  // 延迟触发 AI 功能（首屏渲染完成后）
  useEffect(() => {
    // 使用 requestIdleCallback 在浏览器空闲时加载
    // 如果不支持则使用 setTimeout 降级
    const scheduleAILoad = () => {
      if ("requestIdleCallback" in window) {
        (
          window as Window & {
            requestIdleCallback: (
              cb: () => void,
              opts?: { timeout: number },
            ) => number;
          }
        ).requestIdleCallback(
          () => {
            setDeferredAIReady(true);
            refreshSynthesisRecommend();
          },
          { timeout: 3000 }, // 最多延迟 3 秒
        );
      } else {
        // Safari 等不支持 requestIdleCallback 的浏览器
        setTimeout(() => {
          setDeferredAIReady(true);
          refreshSynthesisRecommend();
        }, 1500); // 延迟 1.5 秒
      }
    };

    // 确保首屏渲染完成后再触发
    if (typeof window !== "undefined") {
      scheduleAILoad();
    }
  }, [refreshSynthesisRecommend]);

  // 批量选择模式
  const {
    isSelectionMode,
    selectedIds,
    isBatchDeleting,
    toggleSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    setIsBatchDeleting: _setIsBatchDeleting,
    exitSelectionMode,
  } = useSelectionMode();

  // Phase 3.4: 使用 Context 状态响应对话框请求（替代 Event 监听）
  useEffect(() => {
    const dialogType = homeContext.dialog.openDialog;
    if (!dialogType) return;

    // 根据对话框类型打开对应对话框
    switch (dialogType) {
      case "create":
        openCreateDialog();
        break;
      case "batchImport":
        openImportDialog();
        break;
      case "browserImport":
        openBrowserImportDialog();
        break;
      case "export":
        openExportDialog();
        break;
      case "batchMove":
        openMoveDialog();
        break;
    }

    // 处理完成后关闭 Context 对话框状态
    homeContext.dialog.closeDialog();
  }, [
    homeContext.dialog,
    openCreateDialog,
    openImportDialog,
    openBrowserImportDialog,
    openExportDialog,
    openMoveDialog,
  ]);

  // Phase 3.4: 使用 Context 状态响应选择模式切换（替代 Event 监听）
  const prevSelectionModeRef = useRef(homeContext.selection.isSelectionMode);
  useEffect(() => {
    const contextSelectionMode = homeContext.selection.isSelectionMode;
    // 仅当 Context 状态变化且与当前状态不同时才切换
    if (
      contextSelectionMode !== prevSelectionModeRef.current &&
      contextSelectionMode !== isSelectionMode
    ) {
      toggleSelectionMode();
    }
    prevSelectionModeRef.current = contextSelectionMode;
  }, [
    homeContext.selection.isSelectionMode,
    isSelectionMode,
    toggleSelectionMode,
  ]);

  // V4.2.1: 快照功能开关
  const isSnapshotEnabled = useSnapshotFeature();

  // ===== Phase 2.3.4: 集成新 Hooks =====

  // CRUD 操作 Hook
  const {
    handleDelete,
    handleRestore,
    handlePermanentDelete,
    handleToggleRead,
    handleEdit,
  } = useHomeMutations({
    getBookmarks: () => bookmarks,
    setBookmarks,
    updateCacheItem,
    removeCacheItem,
  });

  // 批量操作 Hook
  const {
    isBatchDeleting: _isBatchDeletingFromHook,
    isBatchCreatingSnapshot,
    handleBatchDelete,
    handleBatchRestore,
    handleBatchCreateSnapshot,
  } = useHomeBatch({
    getBookmarks: () => bookmarks,
    setBookmarks,
    removeCacheItem,
    selectedIds,
    exitSelectionMode,
  });

  // 创建综述
  const handleCreateSynthesis = useCallback(async () => {
    if (selectedIds.size < 3) return;

    setIsCreatingSynthesis(true);
    try {
      const response = await fetch("/api/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "selection",
          bookmarkIds: Array.from(selectedIds),
          depthMode: "standard",
        }),
      });

      if (!response.ok) {
        throw new Error("创建失败");
      }

      const { data } = await response.json();
      // 跳转到生成页面
      router.push(`/synthesis/${data.id}?generate=true`);
    } catch (error) {
      console.error("Create synthesis error:", error);
      toast.error("创建综述失败");
    } finally {
      setIsCreatingSynthesis(false);
      setShowSynthesisDialog(false);
    }
  }, [selectedIds, router]);

  // ===== SSR 数据同步 =====
  // 当 initialBookmarks 更新时（URL 参数变化导致 SSR 重新获取），同步到 SWR state
  // V4.2.3: 修复竞态条件 - 仅在 initialBookmarks 真正变化且内容不同时才更新
  // 避免与 SWR 的后台刷新产生冲突
  const prevInitialBookmarksRef = useRef<BookmarkWithFolder[] | undefined>(
    initialBookmarks,
  );

  useEffect(() => {
    // 1. 无数据时跳过
    if (!initialBookmarks) return;

    // 2. 首次挂载时跳过（SWR 内部会处理 initialData）
    const prevData = prevInitialBookmarksRef.current;
    if (prevData === undefined) {
      prevInitialBookmarksRef.current = initialBookmarks;
      return;
    }

    // 3. 数据未变化时跳过（避免不必要的更新）
    if (prevData === initialBookmarks) return;

    // 4. 深度比较第一个和最后一个书签 ID（快速检测变化）
    const prevFirstId = prevData[0]?.id;
    const prevLastId = prevData[prevData.length - 1]?.id;
    const newFirstId = initialBookmarks[0]?.id;
    const newLastId = initialBookmarks[initialBookmarks.length - 1]?.id;

    const hasChanged =
      prevData.length !== initialBookmarks.length ||
      prevFirstId !== newFirstId ||
      prevLastId !== newLastId;

    if (hasChanged) {
      // 更新状态，使用回调形式避免覆盖正在进行的乐观更新
      setBookmarks(initialBookmarks);
      // SSR 使用 DEFAULT_PAGE_SIZE，判断是否有更多数据
      setHasMore(initialBookmarks.length === DEFAULT_PAGE_SIZE);
      prevInitialBookmarksRef.current = initialBookmarks;
    }
  }, [initialBookmarks, setBookmarks, setHasMore]);

  // V3.1: 使用统一的 V3 分类轮询替代 V1 的前端主动推荐
  const { trackBookmark } = useClassificationPolling();

  // 新建收藏成功后追踪分类状态
  const handleBookmarkCreated = (bookmark: {
    id: number;
    title: string;
    folder_id?: number | null;
    ai_summary?: string | null;
    ai_tags?: string[] | null;
  }) => {
    // V3.1: 如果书签没有指定文件夹，追踪其分类状态
    // 后端会自动执行 V3 分类，前端轮询获取结果
    if (!bookmark.folder_id) {
      trackBookmark(bookmark.id);
    }
  };

  /**
   * 平台切换（SWR 优化版）
   * 使用 router.replace 更新 URL，SWR hook 会自动响应参数变化
   * 有缓存时立即显示，后台自动刷新
   */
  const handlePlatformChange = useCallback(
    (platformValue: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (platformValue) {
        params.set("platform", platformValue);
      } else {
        params.delete("platform");
      }
      // 使用 router.replace 确保 searchParams 更新，触发 SWR hook 重新获取
      router.replace(`/home?${params.toString()}`);
    },
    [searchParams, router],
  );

  /**
   * 排序切换（SWR 优化版）
   */
  const handleSortChange = useCallback(
    (sortValue: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("sort", sortValue);
      router.replace(`/home?${params.toString()}`);
    },
    [searchParams, router],
  );

  const handleRetry = () => {
    router.refresh();
  };

  // CRUD handlers 已移至 useHomeMutations Hook (Phase 2.3.4)
  // 批量恢复已移至 useHomeBatch Hook

  const handleEmptyTrash = async () => {
    try {
      const res = await fetchWithAbort("/api/trash/empty", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "清空垃圾箱失败");
      }

      // 清除所有书签
      setBookmarks([]);

      toast.success("垃圾箱已清空");
      // setBookmarks([]) 已完成 UI 更新，无需 router.refresh()
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      toast.error(error instanceof Error ? error.message : "清空垃圾箱失败");
    }
  };

  // handleToggleRead 已移至 useHomeMutations Hook (Phase 2.3.4)

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const lastBookmark = bookmarks[bookmarks.length - 1];
      const params = new URLSearchParams({
        cursor: lastBookmark.id.toString(),
        limit: getPageSizeByView(viewMode).toString(),
      });

      if (currentPlatform) {
        params.append("platform", currentPlatform);
      }

      const res = await fetchWithAbort(`/api/bookmarks?${params}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "加载失败");
      }

      const data = await res.json();
      const newBookmarks = data.data.bookmarks;
      const newHasMore = data.data.pagination.hasMore;

      // 使用 SWR hook 的 appendToCache（自动更新数据和 hasMore 状态）
      appendToCache(newBookmarks, newHasMore);
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 批量操作函数已移至 useHomeBatch Hook (Phase 2.3.4)

  // 智能列表模式：显示专属视图（支持客户端导航）
  if (currentSmartListId) {
    return <SmartListView smartListId={currentSmartListId} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 顶部工具栏（移动端显示） - Phase 2.5.1 提取到独立组件 */}
      <HomeToolbar
        viewMode={viewMode}
        layoutMode={layoutMode}
        enableFlipCard={enableFlipCard}
        onViewModeChange={handleViewModeChange}
        onLayoutModeChange={handleLayoutModeChange}
        onFlipCardToggle={handleFlipCardToggle}
        currentPlatform={currentPlatform}
        currentSort={currentSort}
        onPlatformChange={handlePlatformChange}
        onSortChange={handleSortChange}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        totalCount={bookmarks.length}
        isBatchDeleting={isBatchDeleting}
        isBatchCreatingSnapshot={isBatchCreatingSnapshot}
        onToggleSelectionMode={toggleSelectionMode}
        onSelectAll={() => selectAll(bookmarks.map((b) => b.id))}
        onDeselectAll={deselectAll}
        onBatchDelete={handleBatchDelete}
        onOpenMoveDialog={openMoveDialog}
        onBatchCreateSnapshot={handleBatchCreateSnapshot}
        onBatchRestore={handleBatchRestore}
        onEmptyTrash={handleEmptyTrash}
        onOpenImportDialog={openImportDialog}
        onOpenBrowserImportDialog={openBrowserImportDialog}
        onOpenExportDialog={openExportDialog}
        onOpenTagDialog={() => setShowBatchTagDialog(true)}
        onOpenSynthesisDialog={() => setShowSynthesisDialog(true)}
        isBrowserPlatform={isBrowserPlatform}
        isTrashFolder={isTrashFolder}
        isSnapshotEnabled={isSnapshotEnabled}
        isMobileMoreMenuOpen={isMobileMoreMenuOpen}
        onMobileMoreMenuOpenChange={setIsMobileMoreMenuOpen}
      />

      {/* 内容区域 - V4.2.x: 添加 ref 用于虚拟滚动 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1 md:px-2 py-0.5 md:py-1"
      >
        <SilentErrorBoundary>
          <Suspense fallback={null}>
            <ReclassifyBanner className="mb-4" />
          </Suspense>
        </SilentErrorBoundary>

        {/* V2 整理建议横幅（懒加载） */}
        <SilentErrorBoundary>
          <Suspense fallback={null}>
            <InboxOrganizationBanner className="mb-4" />
          </Suspense>
        </SilentErrorBoundary>

        {/* V4.2 待确认消息区域（懒加载） */}
        <SilentErrorBoundary>
          <Suspense fallback={null}>
            <PendingConfirmationsSection className="mb-4" />
          </Suspense>
        </SilentErrorBoundary>

        {/* AI Secretary Evolution Phase 0: 主动简报卡片（懒加载 + 延迟渲染） */}
        {/* FCP 性能优化：仅在首屏渲染完成后才加载 AI 简报组件 */}
        {deferredAIReady && (
          <SilentErrorBoundary>
            <Suspense fallback={null}>
              <ProactiveBriefingCard className="mb-4" />
            </Suspense>
          </SilentErrorBoundary>
        )}

        {/* 初始加载骨架屏 */}
        {isInitialLoading ? (
          <div className="masonry-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="masonry-item">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <Skeleton className="w-full h-40" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorMessage message={error} retry={handleRetry} />
        ) : bookmarks && bookmarks.length > 0 ? (
          <>
            {/* 浏览器书签专用列表视图（虚拟滚动） */}
            {isBrowserPlatform ? (
              <BrowserBookmarkVirtualList
                bookmarks={bookmarks}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isSelectionMode={isSelectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            ) : isTrashFolder ? (
              <>
                {/* V4.2.3: 垃圾箱视图使用虚拟滚动网格 */}
                <VirtualTrashBookmarkGrid
                  bookmarks={bookmarks}
                  hasMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  onLoadMore={handleLoadMore}
                  onRestore={handleRestore}
                  onPermanentDelete={handlePermanentDelete}
                  isSelectionMode={isSelectionMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  customScrollParent={scrollContainer}
                />
              </>
            ) : (
              <>
                {/* V4.2.2: 卡片视图使用虚拟滚动网格 */}
                {viewMode === "card" && (
                  <VirtualBookmarkGrid
                    bookmarks={bookmarks}
                    enableFlipCard={enableFlipCard}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={handleLoadMore}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleRead={handleToggleRead}
                    isSelectionMode={isSelectionMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    layoutMode={layoutMode}
                    customScrollParent={scrollContainer}
                  />
                )}

                {/* V4.2.1: 列表/紧凑视图使用虚拟滚动 */}
                {(viewMode === "list" || viewMode === "compact") && (
                  <VirtualBookmarkList
                    bookmarks={bookmarks}
                    viewMode={viewMode}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={handleLoadMore}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleRead={handleToggleRead}
                    isSelectionMode={isSelectionMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    customScrollParent={scrollContainer}
                  />
                )}
              </>
            )}

            {/* 加载更多按钮 */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    "加载更多"
                  )}
                </Button>
              </div>
            )}
          </>
        ) : isBrowserPlatform ? (
          <BrowserBookmarkEmptyState onImport={openBrowserImportDialog} />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* 对话框组件 - Phase 2.5.2 提取到独立组件 */}
      <HomeDialogs
        showImportDialog={showImportDialog}
        showBrowserImportDialog={showBrowserImportDialog}
        showExportDialog={showExportDialog}
        showMoveDialog={showMoveDialog}
        showCreateDialog={showCreateDialog}
        setShowImportDialog={setShowImportDialog}
        setShowBrowserImportDialog={setShowBrowserImportDialog}
        setShowExportDialog={setShowExportDialog}
        setShowMoveDialog={setShowMoveDialog}
        setShowCreateDialog={setShowCreateDialog}
        bookmarks={bookmarks}
        selectedIds={selectedIds}
        onBookmarkCreated={handleBookmarkCreated}
        onMoveSuccess={exitSelectionMode}
      />

      {/* 批量标签对话框 */}
      <BatchTagDialog
        open={showBatchTagDialog}
        onOpenChange={setShowBatchTagDialog}
        selectedIds={Array.from(selectedIds)}
        selectedBookmarks={bookmarks.filter((b) => selectedIds.has(b.id))}
        onSuccess={(result) => {
          // 更新缓存
          result.affectedIds.forEach((id) => {
            updateCacheItem(id, (bookmark) => {
              if (result.action === "add") {
                const newTags = [
                  ...new Set([...(bookmark.user_tags || []), ...result.tags]),
                ];
                return { ...bookmark, user_tags: newTags };
              } else {
                const newTags = (bookmark.user_tags || []).filter(
                  (t) => !result.tags.includes(t),
                );
                return { ...bookmark, user_tags: newTags };
              }
            });
          });
        }}
      />

      {/* 综述确认对话框 */}
      <AlertDialog
        open={showSynthesisDialog}
        onOpenChange={setShowSynthesisDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>生成主题综述</AlertDialogTitle>
            <AlertDialogDescription>
              将为选中的 {selectedIds.size} 个书签生成 AI 综述报告。
              报告将包含概述、共识、分歧点和知识盲区分析。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCreatingSynthesis}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateSynthesis}
              disabled={isCreatingSynthesis}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isCreatingSynthesis ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                "开始生成"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* E8: 综述智能推荐气泡 */}
      <SynthesisRecommendBubble
        recommend={currentRecommend}
        visible={shouldShowBubble}
        onAccept={acceptRecommend}
        onDismiss={dismissRecommend}
        onClose={closeBubble}
      />
    </div>
  );
}
