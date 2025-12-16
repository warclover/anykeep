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
  useTransition,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  List,
  Plus,
  Loader2,
  ArrowUpDown,
  CheckSquare,
  Trash2,
  FolderInput,
  Upload,
  Download,
  AlignJustify,
  MoreHorizontal,
  Rows3,
  Columns3,
  Sparkles,
  Globe,
  RotateCcw,
  Search,
  Check,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";
import { useBookmarksSWR, cachePerformanceTracker } from "@/lib/cache";
import { Button } from "@/components/ui/button";
import { BookmarkCard } from "@/components/bookmark/bookmark-card";
import { FlipBookmarkCard } from "@/components/bookmark/bookmark-card-flip";
import { TrashBookmarkCard } from "@/components/bookmark/trash-bookmark-card";
import { BrowserBookmarkVirtualList } from "@/components/bookmark/browser-bookmark-virtual-list";
import { VirtualBookmarkList } from "@/components/bookmark/virtual-bookmark-list";
import { BrowserBookmarkEmptyState } from "@/components/bookmark/browser-bookmark-empty-state";
import { TrashToolbar } from "@/components/trash/trash-toolbar";
// 懒加载 Dialog/Drawer 组件（按需显示，非首屏必需）
const CreateBookmarkDrawer = lazy(() =>
  import("@/components/bookmark/create-bookmark-drawer").then((mod) => ({
    default: mod.CreateBookmarkDrawer,
  })),
);
const BatchImportDialog = lazy(() =>
  import("@/components/bookmark/batch-import-dialog").then((mod) => ({
    default: mod.BatchImportDialog,
  })),
);
const BatchMoveDialog = lazy(() =>
  import("@/components/bookmark/batch-move-dialog").then((mod) => ({
    default: mod.BatchMoveDialog,
  })),
);
const ExportDialog = lazy(() =>
  import("@/components/bookmark/export-dialog").then((mod) => ({
    default: mod.ExportDialog,
  })),
);
const BrowserBookmarkImportDialog = lazy(() =>
  import("@/components/browser-bookmark").then((mod) => ({
    default: mod.BrowserBookmarkImportDialog,
  })),
);
// V3.1: FolderRecommendationToast 已废弃，由 useClassificationPolling 的 toast 通知替代
import { EmptyState } from "@/components/bookmark/empty-state";
import { UsageTagFilterSheet } from "@/components/layout/usage-tag-filter-sheet";
import { useSnapshotFeature } from "@/components/snapshot";
import { QuickAddBookmark } from "@/components/quick-add";
import { prefetchCustomUsageTags } from "@/hooks/use-custom-usage-tags";

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
// V3.1: 替换 V1 的 useFolderRecommendation 为 V3 的分类轮询
import { useClassificationPolling } from "@/hooks/use-classification-polling";
import { useDialogs } from "@/hooks/use-dialogs";
import { useSelectionMode } from "@/hooks/use-selection-mode";
import { usePlatformCache } from "@/hooks/use-platform-cache";
import { useProcessingPoller } from "@/hooks/use-processing-poller";
import { ErrorMessage } from "@/components/ui/error-message";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Bookmark } from "@/types/supabase";
import {
  HOME_PLATFORMS,
  SORT_OPTIONS,
  VIEW_MODE_STORAGE_KEY,
  LAYOUT_MODE_STORAGE_KEY,
  FLIP_CARD_STORAGE_KEY,
  DEFAULT_PAGE_SIZE,
  getPageSizeByView,
} from "./constants";
import type { ViewMode, LayoutMode } from "./constants";
import { SmartListView } from "@/components/smart-list";

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

// 使用提取的常量（保持向后兼容的别名）
const platforms = HOME_PLATFORMS;
const sortOptions = SORT_OPTIONS;

export function HomePageClient({
  initialBookmarks,
  error,
  urlFolder: propFolder,
  urlPlatform: propPlatform,
  smartListId,
}: HomePageClientProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // V10.1: 预加载自定义用途标签（详情页需要，提前加载消除延迟）
  useEffect(() => {
    prefetchCustomUsageTags();
  }, []);

  // 本地状态管理（用于客户端平台切换，避免 SSR）
  // 客户端导航时使用 props，SSR 时使用 searchParams
  const urlPlatform = propPlatform ?? searchParams?.get("platform") ?? "";
  const urlSort = searchParams?.get("sort") || "created_desc";
  const urlFolder = propFolder ?? searchParams?.get("folder") ?? "";
  const urlUsageTags = searchParams?.get("usageTags") || "";

  // V10.0: 智能列表 ID（客户端导航时从 URL 读取，SSR 时从 props 读取）
  const urlSmartListParam = searchParams?.get("smartList");
  const urlSmartListId = urlSmartListParam
    ? parseInt(urlSmartListParam, 10)
    : null;
  // 最终使用的智能列表 ID：URL 参数优先（支持客户端导航）
  const currentSmartListId =
    urlSmartListId && !isNaN(urlSmartListId) ? urlSmartListId : smartListId;

  // 使用本地状态跟踪当前平台（支持客户端切换）
  const [localPlatform, setLocalPlatform] = useState(urlPlatform);
  const [localFolder, setLocalFolder] = useState(urlFolder);
  // V9.0新增：用途标签筛选状态
  const [localUsageTags, setLocalUsageTags] = useState<string[]>(
    urlUsageTags ? urlUsageTags.split(",").filter(Boolean) : [],
  );

  // 同步客户端导航参数变化到本地状态
  useEffect(() => {
    if (urlFolder !== localFolder) {
      setLocalFolder(urlFolder);
    }
    if (urlPlatform !== localPlatform) {
      setLocalPlatform(urlPlatform);
    }
    // V9.0新增：同步用途标签筛选
    const newUsageTags = urlUsageTags
      ? urlUsageTags.split(",").filter(Boolean)
      : [];
    if (JSON.stringify(newUsageTags) !== JSON.stringify(localUsageTags)) {
      setLocalUsageTags(newUsageTags);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只响应 URL 参数变化
  }, [urlFolder, urlPlatform, urlUsageTags]);

  // 当前使用的参数（优先使用本地状态，支持客户端即时切换）
  const currentPlatform = localPlatform;
  const currentSort = urlSort; // 排序暂不做客户端优化
  const currentFolder = localFolder;

  // 检测是否为浏览器书签平台
  const isBrowserPlatform = currentPlatform === "browser";

  // 检测是否为虚拟文件夹
  const isTrashFolder = currentFolder === "trash";
  const _isInvalidFolder = currentFolder === "invalid";
  const _isHighValueFolder = currentFolder === "high-value";

  // 可取消请求 Hook
  const { fetchWithAbort } = useAbortableFetch();

  // 视图模式（从 localStorage 读取默认值）
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  // 布局模式（仅用于卡片视图）
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("auto");

  // 翻转卡片模式（Demo 测试）
  const [enableFlipCard, setEnableFlipCard] = useState(false);

  // 初始化视图模式、布局模式和翻转状态（从 localStorage 读取）
  useEffect(() => {
    const savedViewMode = localStorage.getItem(
      VIEW_MODE_STORAGE_KEY,
    ) as ViewMode | null;
    if (savedViewMode && ["card", "list", "compact"].includes(savedViewMode)) {
      setViewMode(savedViewMode);
    }

    const savedLayoutMode = localStorage.getItem(
      LAYOUT_MODE_STORAGE_KEY,
    ) as LayoutMode | null;
    if (
      savedLayoutMode &&
      ["auto", "row", "column"].includes(savedLayoutMode)
    ) {
      setLayoutMode(savedLayoutMode);
    }

    // 初始化翻转状态
    const savedFlipCard = localStorage.getItem(FLIP_CARD_STORAGE_KEY);
    if (savedFlipCard) {
      setEnableFlipCard(savedFlipCard === "true");
    }

    // 监听来自 PlatformFilter 的翻转状态变化
    const handleFlipCardChange = (event: CustomEvent<boolean>) => {
      setEnableFlipCard(event.detail);
    };

    // 监听来自 HeaderMenu 的视图模式变化
    const handleViewModeChangeEvent = (
      event: CustomEvent<"card" | "list" | "compact">,
    ) => {
      setViewMode(event.detail);
    };

    // 监听来自 HeaderMenu 的布局模式变化
    const handleLayoutModeChangeEvent = (
      event: CustomEvent<"auto" | "row" | "column">,
    ) => {
      setLayoutMode(event.detail);
    };

    // 监听来自 HeaderMenu 的对话框事件
    const handleOpenDialog = (event: CustomEvent<string>) => {
      switch (event.detail) {
        case "create":
          openCreateDialog();
          break;
        case "import":
          openImportDialog();
          break;
        case "browserImport":
          openBrowserImportDialog();
          break;
        case "export":
          openExportDialog();
          break;
      }
    };

    // 监听来自 HeaderMenu 的批量选择模式切换
    const handleToggleSelectionMode = () => {
      toggleSelectionMode();
    };

    // 监听来自 PlatformFilter 的平台切换事件（客户端优化，避免 SSR）
    const handlePlatformChange = (
      event: CustomEvent<{ platform: string; folder: string }>,
    ) => {
      setLocalPlatform(event.detail.platform);
      setLocalFolder(event.detail.folder);
    };

    // V9.0新增：监听来自 UsageTagFilter 的用途标签筛选事件
    const handleUsageTagFilterChange = (
      event: CustomEvent<{ usageTags: string[] }>,
    ) => {
      setLocalUsageTags(event.detail.usageTags);
    };

    window.addEventListener(
      "flipCardChange",
      handleFlipCardChange as EventListener,
    );
    window.addEventListener(
      "platformChange",
      handlePlatformChange as EventListener,
    );
    window.addEventListener(
      "viewModeChange",
      handleViewModeChangeEvent as EventListener,
    );
    window.addEventListener(
      "layoutModeChange",
      handleLayoutModeChangeEvent as EventListener,
    );
    window.addEventListener("openDialog", handleOpenDialog as EventListener);
    window.addEventListener("toggleSelectionMode", handleToggleSelectionMode);
    window.addEventListener(
      "usageTagFilterChange",
      handleUsageTagFilterChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        "flipCardChange",
        handleFlipCardChange as EventListener,
      );
      window.removeEventListener(
        "platformChange",
        handlePlatformChange as EventListener,
      );
      window.removeEventListener(
        "viewModeChange",
        handleViewModeChangeEvent as EventListener,
      );
      window.removeEventListener(
        "layoutModeChange",
        handleLayoutModeChangeEvent as EventListener,
      );
      window.removeEventListener(
        "openDialog",
        handleOpenDialog as EventListener,
      );
      window.removeEventListener(
        "toggleSelectionMode",
        handleToggleSelectionMode,
      );
      window.removeEventListener(
        "usageTagFilterChange",
        handleUsageTagFilterChange as EventListener,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换视图模式并保存到 localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  };

  // 切换布局模式并保存到 localStorage
  const handleLayoutModeChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
  };

  // 切换翻转卡片模式并同步
  const handleFlipCardToggle = () => {
    const newValue = !enableFlipCard;
    setEnableFlipCard(newValue);
    localStorage.setItem(FLIP_CARD_STORAGE_KEY, String(newValue));
    // 触发自定义事件通知其他组件（如 PlatformFilter）
    window.dispatchEvent(
      new CustomEvent("flipCardChange", { detail: newValue }),
    );
  };

  // 计算网格容器的 CSS 类名
  const gridClassName = cn(
    "masonry-grid",
    layoutMode === "row" && "layout-row",
    layoutMode === "column" && "layout-column",
  );

  // ===== SWR 数据缓存（性能优化核心） =====
  // 使用 SWR 模式：有缓存先显示，后台自动刷新
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
    initialData: initialBookmarks,
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
    const handleBookmarkCreated = (event: Event) => {
      const customEvent = event as CustomEvent<BookmarkWithFolder>;
      const newBookmark = customEvent.detail;

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
    };

    window.addEventListener("bookmarkCreated", handleBookmarkCreated);

    return () => {
      window.removeEventListener("bookmarkCreated", handleBookmarkCreated);
    };
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
  const [_isPending, startTransition] = useTransition();

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

  // 批量选择模式
  const {
    isSelectionMode,
    selectedIds,
    isBatchDeleting,
    toggleSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    setIsBatchDeleting,
    exitSelectionMode,
  } = useSelectionMode();

  // V4.2.1: 快照功能开关
  const isSnapshotEnabled = useSnapshotFeature();

  // 批量创建快照状态
  const [isBatchCreatingSnapshot, setIsBatchCreatingSnapshot] = useState(false);

  // 旧缓存系统已弃用，保留 hook 引用但不再使用其方法
  // SWR 系统 (useBookmarksSWR) 已完整实现缓存功能
  const {
    getCache: _getCacheOld,
    setCache: _setCacheOld,
    updateCacheItem: _updateCacheItemOld,
    removeCacheItem: _removeCacheItemOld,
    appendToCache: _appendToCacheOld,
  } = usePlatformCache();

  /**
   * 获取书签数据（客户端）- 保留供未来重构使用
   */
  const _fetchBookmarks = useCallback(
    async (platform: string, sort: string, folder: string) => {
      try {
        const apiParams = new URLSearchParams();
        if (platform === "browser") {
          apiParams.set("platform", "browser");
        } else if (platform) {
          apiParams.set("platform", platform);
        } else {
          // "全部" 时排除浏览器平台
          apiParams.set("excludeBrowser", "true");
        }
        apiParams.set("sort", sort);
        apiParams.set("limit", getPageSizeByView(viewMode).toString());
        if (folder) {
          apiParams.set("folder", folder);
        }

        const res = await fetchWithAbort(
          `/api/bookmarks?${apiParams.toString()}`,
          {
            credentials: "include", // 确保发送认证 cookie
          },
        );
        if (!res.ok) {
          throw new Error("加载失败");
        }

        const data = await res.json();
        return {
          bookmarks: data.data.bookmarks as BookmarkWithFolder[],
          hasMore: data.data.pagination.hasMore as boolean,
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return null; // 请求被取消
        }
        throw error;
      }
    },
    [fetchWithAbort, viewMode],
  );

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

  // 保留旧的实现作为备用（已弃用，使用旧缓存系统）
  const _handlePlatformChangeOld = useCallback(
    async (platformValue: string) => {
      // 1. 优先使用缓存数据，提供即时反馈
      const cached = _getCacheOld({
        platform: platformValue,
        sort: currentSort,
        folder: currentFolder,
      });

      if (cached) {
        setBookmarks((_prev) => cached.data);
      }

      // 2. 更新 URL（不触发导航）
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (platformValue) {
        params.set("platform", platformValue);
      } else {
        params.delete("platform");
      }
      const newUrl = `/home?${params.toString()}`;
      window.history.replaceState(
        { ...window.history.state, as: newUrl, url: newUrl },
        "",
        newUrl,
      );

      // 3. 调用 API 获取最新数据（后台更新）
      try {
        const apiParams = new URLSearchParams();
        if (platformValue === "browser") {
          apiParams.set("platform", "browser");
        } else if (platformValue) {
          apiParams.set("platform", platformValue);
        } else {
          // "全部" 时排除浏览器平台
          apiParams.set("excludeBrowser", "true");
        }
        apiParams.set("sort", currentSort);
        apiParams.set("limit", getPageSizeByView(viewMode).toString());
        if (currentFolder) {
          apiParams.set("folder", currentFolder);
        }

        const res = await fetchWithAbort(
          `/api/bookmarks?${apiParams.toString()}`,
          {
            credentials: "include", // 确保发送认证 cookie
          },
        );
        if (!res.ok) {
          throw new Error("加载失败");
        }

        const data = await res.json();
        const newBookmarks = data.data.bookmarks;
        const newHasMore = data.data.pagination.hasMore;

        // 更新状态和缓存
        setBookmarks((_prev) => newBookmarks);
        _setCacheOld(
          { platform: platformValue, sort: currentSort, folder: currentFolder },
          newBookmarks,
          newHasMore,
        );
      } catch (error) {
        // 如果是取消错误，静默处理（用户快速切换时会取消之前的请求）
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        // 如果缓存命中，API 失败不影响用户体验
        if (!cached) {
          toast.error("加载失败，请重试");
        }
      }
    },
    [
      currentSort,
      currentFolder,
      searchParams,
      _getCacheOld,
      _setCacheOld,
      fetchWithAbort,
      setBookmarks,
      viewMode,
    ],
  );

  // 保留旧的排序实现作为备用（已弃用）
  const _handleSortChangeOld = async (sortValue: string) => {
    // 1. 优先使用缓存数据
    const cached = _getCacheOld({
      platform: currentPlatform,
      sort: sortValue,
      folder: currentFolder,
    });

    if (cached) {
      setBookmarks((_prev) => cached.data);
    }

    // 2. 更新 URL（不触发导航）
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sort", sortValue);
    const newUrl = `/home?${params.toString()}`;
    window.history.replaceState(
      { ...window.history.state, as: newUrl, url: newUrl },
      "",
      newUrl,
    );

    // 3. 调用 API 获取最新数据
    try {
      const apiParams = new URLSearchParams();
      if (currentPlatform === "browser") {
        apiParams.set("platform", "browser");
      } else if (currentPlatform) {
        apiParams.set("platform", currentPlatform);
      } else {
        apiParams.set("excludeBrowser", "true");
      }
      apiParams.set("sort", sortValue);
      apiParams.set("limit", getPageSizeByView(viewMode).toString());
      if (currentFolder) {
        apiParams.set("folder", currentFolder);
      }

      const res = await fetchWithAbort(
        `/api/bookmarks?${apiParams.toString()}`,
        {
          credentials: "include", // 确保发送认证 cookie
        },
      );
      if (!res.ok) {
        throw new Error("加载失败");
      }

      const data = await res.json();
      const newBookmarks = data.data.bookmarks;
      const newHasMore = data.data.pagination.hasMore;

      setBookmarks((_prev) => newBookmarks);
      _setCacheOld(
        { platform: currentPlatform, sort: sortValue, folder: currentFolder },
        newBookmarks,
        newHasMore,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      if (!cached) {
        toast.error("加载失败，请重试");
      }
    }
  };

  const handleRetry = () => {
    router.refresh();
  };

  const handleEdit = (id: number) => {
    // 跳转到详情页进行编辑（未来计划：实现内联编辑对话框）
    router.push(`/bookmark/${id}`);
  };

  const handleDelete = async (id: number) => {
    // 保存当前快照用于回滚
    const snapshot = [...bookmarks];

    try {
      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      // 同步更新缓存
      removeCacheItem(id);

      // 调用删除 API（可取消）
      const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "删除失败");
      }

      toast.success("删除成功");
      // 乐观更新已完成，无需 router.refresh()
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      // 失败时恢复到快照状态
      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  // 垃圾箱相关操作
  const handleRestore = async (id: number) => {
    const snapshot = [...bookmarks];

    try {
      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => b.id !== id));

      // 调用恢复 API
      const res = await fetchWithAbort(`/api/bookmarks/${id}/restore`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "恢复失败");
      }

      toast.success("已恢复收藏");
      // 乐观更新已完成，无需 router.refresh()
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "恢复失败");
    }
  };

  const handlePermanentDelete = async (id: number) => {
    const snapshot = [...bookmarks];

    try {
      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => b.id !== id));

      // 调用永久删除 API
      const res = await fetchWithAbort(`/api/bookmarks/${id}/permanent`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "永久删除失败");
      }

      toast.success("已永久删除");
      // 乐观更新已完成，无需 router.refresh()
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "永久删除失败");
    }
  };

  const handleBatchRestore = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // 保存快照用于回滚
    const snapshot = [...bookmarks];

    try {
      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => !ids.includes(b.id)));

      const res = await fetchWithAbort("/api/bookmarks/batch-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkIds: ids }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "批量恢复失败");
      }

      // 清除选择
      deselectAll();

      toast.success(`已恢复 ${ids.length} 个收藏`);
      // 乐观更新已完成，无需 router.refresh()
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      // 失败时回滚
      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "批量恢复失败");
    }
  };

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

  const handleToggleRead = async (id: number, isRead: boolean) => {
    // 保存当前快照用于回滚
    const snapshot = [...bookmarks];

    try {
      // 乐观更新 UI
      setBookmarks((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                is_read: isRead,
                read_at: isRead ? new Date().toISOString() : null,
              }
            : b,
        ),
      );
      // 同步更新缓存
      updateCacheItem(id, (b) => ({
        ...b,
        is_read: isRead,
        read_at: isRead ? new Date().toISOString() : null,
      }));

      // 调用 PATCH API 更新已读状态
      const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isRead }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "更新失败");
      }

      toast.success(isRead ? "已标记为已读" : "已标记为未读");
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      // 失败时恢复到快照状态
      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "更新失败");
    }
  };

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

  // 选择模式操作函数已从 useSelectionMode Hook 中获取

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    if (
      !confirm(
        `确定要删除选中的 ${selectedIds.size} 条收藏吗？删除后无法恢复。`,
      )
    ) {
      return;
    }

    setIsBatchDeleting(true);
    try {
      // 使用批量删除 API（单次请求）
      const response = await fetchWithAbort("/api/bookmarks/batch-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error?.message || "批量删除失败");
        return;
      }

      const deletedCount = result.data?.deletedCount || 0;
      toast.success(`成功删除 ${deletedCount} 条收藏`);

      // 更新 UI（乐观更新）
      setBookmarks((prev) => prev.filter((b) => !selectedIds.has(b.id)));
      // 同步更新缓存
      selectedIds.forEach((id) => removeCacheItem(id));
      exitSelectionMode();
      // 乐观更新已完成，无需 router.refresh()
    } catch (error) {
      // 如果是取消错误，不显示错误提示
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // 前端错误仅在开发环境使用 console
      if (process.env.NODE_ENV === "development") {
        console.error("Batch delete error:", error);
      }
      toast.error("批量删除失败");
    } finally {
      setIsBatchDeleting(false);
    }
  };

  /**
   * V4.2.1: 批量创建快照
   */
  const handleBatchCreateSnapshot = async () => {
    if (selectedIds.size === 0) return;

    // 获取选中的书签
    const selectedBookmarks = bookmarks.filter((b) => selectedIds.has(b.id));
    const validBookmarks = selectedBookmarks.filter((b) => b.url);

    if (validBookmarks.length === 0) {
      toast.error("选中的书签没有有效的 URL");
      return;
    }

    if (validBookmarks.length > 10) {
      if (
        !confirm(
          `将为 ${validBookmarks.length} 个书签创建快照，这可能需要较长时间。确定继续吗？`,
        )
      ) {
        return;
      }
    }

    setIsBatchCreatingSnapshot(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // 批量创建快照（逐个创建，避免服务器压力过大）
      for (const bookmark of validBookmarks) {
        try {
          const response = await fetchWithAbort("/api/snapshots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookmarkId: bookmark.id,
              snapshotType: "standard",
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            const result = await response.json();
            // SNAPSHOT_EXISTS 和 QUOTA_EXCEEDED 不算失败
            if (
              result.error?.code === "SNAPSHOT_EXISTS" ||
              result.error?.code === "QUOTA_EXCEEDED"
            ) {
              // 配额超限时停止创建更多快照
              if (result.error?.code === "QUOTA_EXCEEDED") {
                toast.error("快照配额已满", {
                  description: "请删除一些旧快照后重试",
                });
                break;
              }
            } else {
              failCount++;
            }
          }
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`已为 ${successCount} 个书签创建快照任务`, {
          description: "后台正在处理，稍后可查看",
        });
      }

      if (failCount > 0) {
        toast.error(`${failCount} 个书签快照创建失败`);
      }

      exitSelectionMode();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      if (process.env.NODE_ENV === "development") {
        console.error("Batch snapshot error:", error);
      }
      toast.error("批量创建快照失败");
    } finally {
      setIsBatchCreatingSnapshot(false);
    }
  };

  // 智能列表模式：显示专属视图（支持客户端导航）
  if (currentSmartListId) {
    return <SmartListView smartListId={currentSmartListId} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部工具栏（移动端显示） */}
      <header className="sm:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 overflow-hidden">
        <div className="flex items-center gap-2 max-w-full">
          {/* 移动端平台筛选 */}
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5">
              {platforms.map((platform) => {
                const isActive = currentPlatform === platform.value;
                return (
                  <button
                    key={platform.id}
                    onClick={() => handlePlatformChange(platform.value)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap flex-shrink-0",
                      isActive
                        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700",
                    )}
                  >
                    {platform.name}
                  </button>
                );
              })}

              {/* 翻转卡片按钮（移动端） */}
              {!isBrowserPlatform && viewMode === "card" && (
                <Button
                  variant={enableFlipCard ? "default" : "outline"}
                  size="sm"
                  onClick={handleFlipCardToggle}
                  title="翻转卡片"
                  className={cn(
                    "px-2.5 py-1 h-auto text-xs font-medium rounded-full whitespace-nowrap flex-shrink-0",
                    enableFlipCard
                      ? "bg-purple-500 hover:bg-purple-600 text-white dark:bg-purple-600 dark:hover:bg-purple-700"
                      : "border-gray-200 dark:border-gray-700",
                  )}
                >
                  <RotateCcw className="size-3 mr-1" />
                  翻转
                </Button>
              )}
            </div>
          </div>

          {/* 右侧操作按钮 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* 搜索按钮 */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => router.push("/search")}
            >
              <Search className="size-4" />
            </Button>

            {/* 统一菜单 */}
            <DropdownMenu
              open={isMobileMoreMenuOpen}
              onOpenChange={setIsMobileMoreMenuOpen}
            >
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* 视图模式 */}
                {!isBrowserPlatform && (
                  <>
                    <DropdownMenuLabel className="text-xs">
                      视图模式
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => handleViewModeChange("card")}
                    >
                      <LayoutGrid className="size-4 mr-2" />
                      <span className="flex-1">瀑布流</span>
                      {viewMode === "card" && <Check className="size-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleViewModeChange("list")}
                    >
                      <List className="size-4 mr-2" />
                      <span className="flex-1">列表</span>
                      {viewMode === "list" && <Check className="size-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleViewModeChange("compact")}
                    >
                      <AlignJustify className="size-4 mr-2" />
                      <span className="flex-1">紧凑</span>
                      {viewMode === "compact" && <Check className="size-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* 布局模式（仅卡片视图） */}
                {viewMode === "card" && (
                  <>
                    <DropdownMenuLabel className="text-xs">
                      布局模式
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => handleLayoutModeChange("auto")}
                    >
                      <Sparkles className="size-4 mr-2" />
                      <span className="flex-1">自动</span>
                      {layoutMode === "auto" && <Check className="size-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleLayoutModeChange("row")}
                    >
                      <Rows3 className="size-4 mr-2" />
                      <span className="flex-1">行优先</span>
                      {layoutMode === "row" && <Check className="size-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleLayoutModeChange("column")}
                    >
                      <Columns3 className="size-4 mr-2" />
                      <span className="flex-1">列优先</span>
                      {layoutMode === "column" && <Check className="size-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* 排序 */}
                <DropdownMenuLabel className="text-xs">排序</DropdownMenuLabel>
                {sortOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleSortChange(option.value)}
                  >
                    <ArrowUpDown className="size-4 mr-2" />
                    <span className="flex-1">{option.label}</span>
                    {currentSort === option.value && (
                      <Check className="size-4" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />

                {/* 导入/导出 */}
                <DropdownMenuItem
                  onClick={() => {
                    openImportDialog();
                    setIsMobileMoreMenuOpen(false);
                  }}
                >
                  <Upload className="size-4 mr-2" />
                  批量导入
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    openBrowserImportDialog();
                    setIsMobileMoreMenuOpen(false);
                  }}
                >
                  <Globe className="size-4 mr-2" />
                  导入浏览器书签
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    openExportDialog();
                    setIsMobileMoreMenuOpen(false);
                  }}
                >
                  <Download className="size-4 mr-2" />
                  导出
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* 批量选择 */}
                <DropdownMenuItem
                  onClick={() => {
                    toggleSelectionMode();
                    setIsMobileMoreMenuOpen(false);
                  }}
                >
                  <CheckSquare className="size-4 mr-2" />
                  {isSelectionMode ? "取消批量选择" : "批量选择"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 垃圾箱工具栏 */}
        {isTrashFolder && (
          <div className="mt-4">
            <TrashToolbar
              selectedCount={selectedIds.size}
              onBatchRestore={handleBatchRestore}
              onEmptyTrash={handleEmptyTrash}
              totalCount={bookmarks.length}
            />
          </div>
        )}

        {/* 批量操作工具栏 */}
        {isSelectionMode && selectedIds.size > 0 && !isTrashFolder && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                已选择 {selectedIds.size} 条
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectAll(bookmarks.map((b) => b.id))}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                全选
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                取消全选
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDelete}
                disabled={isBatchDeleting}
                className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                {isBatchDeleting ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4 mr-1.5" />
                    删除
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={openMoveDialog}>
                <FolderInput className="size-4 mr-1.5" />
                移动到文件夹
              </Button>
              {/* V4.2.1: 批量创建快照按钮（功能开关控制） */}
              {isSnapshotEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchCreateSnapshot}
                  disabled={isBatchCreatingSnapshot}
                  className="text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/20"
                >
                  {isBatchCreatingSnapshot ? (
                    <>
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Camera className="size-4 mr-1.5" />
                      创建快照
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-8 py-0.5 md:py-1">
        {/* 快速添加收藏组件（仅在非垃圾箱页面显示） */}
        {!isTrashFolder && (
          <div className="mb-6 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <QuickAddBookmark
                onBookmarkCreated={() => {
                  // 刷新列表
                  if (_refetch) {
                    _refetch();
                  }
                }}
              />
            </div>
            {/* 创建自定义收藏按钮 */}
            <Button
              className="shrink-0 h-12 px-4 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
              onClick={openCreateDialog}
            >
              <Plus className="size-4 mr-1.5" />
              手动创建
            </Button>
            {/* V10.2: 用途筛选按钮（Sheet 形式） */}
            {!isBrowserPlatform && !currentFolder && <UsageTagFilterSheet />}
          </div>
        )}

        {/* V4.2 智能分类横幅（懒加载） */}
        <Suspense fallback={null}>
          <ReclassifyBanner className="mb-4" />
        </Suspense>

        {/* V2 整理建议横幅（懒加载） */}
        <Suspense fallback={null}>
          <InboxOrganizationBanner className="mb-4" />
        </Suspense>

        {/* V4.2 待确认消息区域（懒加载） */}
        <Suspense fallback={null}>
          <PendingConfirmationsSection className="mb-4" />
        </Suspense>

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
                {/* 垃圾箱卡片视图 */}
                <div className={gridClassName}>
                  {bookmarks.map((bookmark) => (
                    <div key={bookmark.id} className="masonry-item">
                      <TrashBookmarkCard
                        bookmark={bookmark}
                        onRestore={handleRestore}
                        onPermanentDelete={handlePermanentDelete}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.has(bookmark.id)}
                        onToggleSelect={toggleSelect}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* 卡片视图（支持行优先/列优先布局） */}
                {viewMode === "card" && (
                  <div className={gridClassName}>
                    {bookmarks.map((bookmark) => (
                      <div key={bookmark.id} className="masonry-item">
                        {enableFlipCard ? (
                          <FlipBookmarkCard
                            bookmark={bookmark}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onToggleRead={handleToggleRead}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedIds.has(bookmark.id)}
                            onToggleSelect={toggleSelect}
                            enableFlip={true}
                          />
                        ) : (
                          <BookmarkCard
                            bookmark={bookmark}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onToggleRead={handleToggleRead}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedIds.has(bookmark.id)}
                            onToggleSelect={toggleSelect}
                            variant="card"
                          />
                        )}
                      </div>
                    ))}
                  </div>
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

      {/* 懒加载的 Dialog 组件 - 使用 Suspense 包裹 */}
      <Suspense fallback={null}>
        {/* 批量导入对话框（URL导入） */}
        {showImportDialog && (
          <BatchImportDialog
            open={showImportDialog}
            onOpenChange={setShowImportDialog}
          />
        )}

        {/* 浏览器书签导入对话框 */}
        {showBrowserImportDialog && (
          <BrowserBookmarkImportDialog
            open={showBrowserImportDialog}
            onOpenChange={setShowBrowserImportDialog}
            onSuccess={() => {
              startTransition(() => {
                router.refresh();
              });
            }}
          />
        )}

        {/* 导出对话框 */}
        {showExportDialog && (
          <ExportDialog
            open={showExportDialog}
            onOpenChange={setShowExportDialog}
            bookmarks={bookmarks}
            selectedIds={selectedIds}
          />
        )}

        {/* 批量移动对话框 */}
        {showMoveDialog && (
          <BatchMoveDialog
            open={showMoveDialog}
            onOpenChange={setShowMoveDialog}
            selectedIds={selectedIds}
            onSuccess={exitSelectionMode}
          />
        )}

        {/* 创建收藏抽屉 */}
        {showCreateDialog && (
          <CreateBookmarkDrawer
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onSuccess={handleBookmarkCreated}
          />
        )}
      </Suspense>

      {/* V3.1: FolderRecommendationToast 已移除，分类结果通过 useClassificationPolling 的 toast 显示 */}
    </div>
  );
}
