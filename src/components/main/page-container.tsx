/**
 * 页面容器组件
 * 管理所有主页面的懒加载和缓存显示
 *
 * 核心特性：
 * - 懒加载：首次访问时才加载页面组件
 * - Keep-Alive：已加载的页面保持挂载，通过 CSS 切换显示
 * - 滚动恢复：切换回页面时恢复滚动位置
 * - 客户端数据获取：避免服务端重复请求
 */

"use client";

import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  memo,
  Component,
  type CSSProperties,
  type ReactNode,
  type ErrorInfo,
} from "react";
import {
  useNavigation,
  usePageVisibility,
  PAGE_IDS,
  type PageId,
} from "@/contexts/navigation-context";
import { useUser } from "@/contexts/user-context";
import {
  useFoldersData,
  useAnalyticsData,
  useSettingsData,
} from "@/hooks/use-page-data";

// ==================== 错误边界组件 ====================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 页面错误边界
 * 捕获懒加载组件的错误，防止整个应用崩溃
 */
class PageErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 可以在这里上报错误到监控服务
    console.error("PageErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
            <div className="text-red-500 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              页面加载失败
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {this.state.error?.message || "发生了未知错误"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              刷新页面
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// ==================== 懒加载页面组件 ====================

// 首页
const HomePageClient = lazy(() =>
  import("@/components/home/home-page-client").then((mod) => ({
    default: mod.HomePageClient,
  })),
);

// 搜索页
const SearchPageClient = lazy(() =>
  import("@/components/search/search-page-client").then((mod) => ({
    default: mod.SearchPageClient,
  })),
);

// 收藏夹页
const FoldersPageClient = lazy(() =>
  import("@/components/folders/folders-page-client").then((mod) => ({
    default: mod.FoldersPageClient,
  })),
);

// 数据统计页
const AnalyticsPageClient = lazy(() =>
  import("@/components/analytics/analytics-page-client").then((mod) => ({
    default: mod.AnalyticsPageClient,
  })),
);

// 设置页
const SettingsPageClient = lazy(() =>
  import("@/components/settings/settings-page-client").then((mod) => ({
    default: mod.SettingsPageClient,
  })),
);

// 消息页
const MessagesPageClient = lazy(() =>
  import("@/components/messages/messages-page-client").then((mod) => ({
    default: mod.MessagesPageClient,
  })),
);

// ==================== 页面加载骨架屏 ====================

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      {/* Header skeleton */}
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />

      {/* Content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl"
          />
        ))}
      </div>
    </div>
  );
}

// ==================== 单个页面包装器 ====================

interface PageWrapperProps {
  pageId: PageId;
  children: React.ReactNode;
}

/**
 * 页面名称映射（用于 ARIA label）
 */
const PAGE_LABELS: Record<PageId, string> = {
  home: "首页",
  search: "搜索",
  folders: "收藏夹",
  messages: "消息",
  analytics: "数据统计",
  batch: "批量操作",
  export: "数据导出",
  settings: "设置",
};

/**
 * 页面包装器
 * 控制页面的显示/隐藏和状态管理
 */
const PageWrapper = memo(function PageWrapper({
  pageId,
  children,
}: PageWrapperProps) {
  const { isVisible, shouldRender, state } = usePageVisibility(pageId);
  const { setPageState, restoreScrollPosition } = useNavigation();

  // 使用 ref 追踪是否已恢复滚动位置，避免重复触发
  const hasRestoredScrollRef = useRef(false);

  // 页面加载完成时更新状态
  useEffect(() => {
    if (shouldRender && state === "loading") {
      // 组件已挂载，标记为 ready
      setPageState(pageId, "ready");
    }
  }, [shouldRender, state, pageId, setPageState]);

  // 切换到可见时恢复滚动位置（仅触发一次）
  useEffect(() => {
    if (isVisible && (state === "ready" || state === "cached")) {
      if (!hasRestoredScrollRef.current) {
        restoreScrollPosition(pageId);
        hasRestoredScrollRef.current = true;
      }
    }

    // 切换到不可见时重置标记，下次切换回来时再恢复
    if (!isVisible) {
      hasRestoredScrollRef.current = false;
    }
  }, [isVisible, state, pageId, restoreScrollPosition]);

  // 不应该渲染时返回 null
  if (!shouldRender) {
    return null;
  }

  // 通过 CSS 控制显示/隐藏，保持 DOM 存在
  // - display: none：从布局中移除
  // - visibility: hidden：确保不可见
  // - position: absolute：避免影响布局
  // - pointerEvents: none：禁用交互
  const style: CSSProperties = isVisible
    ? { display: "block" }
    : {
        display: "none",
        visibility: "hidden",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        pointerEvents: "none",
      };

  return (
    <div
      data-page-id={pageId}
      data-page-visible={isVisible}
      data-page-state={state}
      style={style}
      role="region"
      aria-label={PAGE_LABELS[pageId]}
      aria-hidden={!isVisible}
    >
      {children}
    </div>
  );
});

// ==================== 页面渲染器（带数据获取） ====================

/**
 * 首页渲染器
 * 从 NavigationContext 读取参数并传递给 HomePageClient
 */
function HomePageRenderer() {
  const { activeParams } = useNavigation();
  const folder = activeParams.get("folder") || "";
  const platform = activeParams.get("platform") || "";

  return <HomePageClient urlFolder={folder} urlPlatform={platform} />;
}

/**
 * 搜索页渲染器
 * V4.2.17: 修复客户端导航时搜索结果丢失的问题
 * 从 URL 参数读取查询和 AI 模式
 *
 * 重要：只有当搜索页面是当前活动页面时才渲染 SearchPageClient
 * 这避免了隐藏的 PageContainer 触发不必要的 auto-fetch
 */
function SearchPageRenderer() {
  const { activeParams, activePage } = useNavigation();

  // V4.2.17: 只有当搜索页是当前活动页面时才渲染完整组件
  // 这避免了隐藏 PageContainer 中的实例触发不必要的 API 调用
  if (activePage !== "search") {
    // 返回一个占位符，保持组件树结构
    return <div data-placeholder="search-page" />;
  }

  const initialQuery = activeParams.get("q") || "";
  const initialAIMode = activeParams.get("ai") === "true";

  return (
    <SearchPageClient
      initialQuery={initialQuery}
      initialAIMode={initialAIMode}
      searchResults={[]}
    />
  );
}

/**
 * 收藏夹页渲染器（带数据获取）
 */
function FoldersPageRenderer() {
  const { data, isLoading, error } = useFoldersData();

  if (isLoading && !data) {
    return <PageSkeleton />;
  }

  return (
    <FoldersPageClient
      folders={data?.folders || []}
      recentBookmarks={data?.recentBookmarks || []}
      error={error || undefined}
    />
  );
}

/**
 * 数据统计页渲染器（带数据获取）
 */
function AnalyticsPageRenderer() {
  const { data, isLoading, error } = useAnalyticsData();

  if (isLoading && !data) {
    return <PageSkeleton />;
  }

  return (
    <AnalyticsPageClient
      data={
        data || {
          stats: {
            totalBookmarks: 0,
            contentBookmarks: 0,
            browserBookmarks: 0,
            todayCount: 0,
            weekCount: 0,
            last30DaysCount: 0,
            unclassifiedCount: 0,
            classificationRate: 0,
          },
          trendData: [],
          platformData: [],
          folderData: [],
          tagData: [],
          typeData: [],
          generatedAt: new Date().toISOString(),
        }
      }
      error={error || undefined}
    />
  );
}

/**
 * 设置页渲染器（带数据获取）
 */
function SettingsPageRenderer() {
  const { user } = useUser();
  const { data, isLoading, error } = useSettingsData();

  if (isLoading && !data) {
    return <PageSkeleton />;
  }

  // SettingsPageClient 需要 user 和 settings
  // 如果没有用户或数据，显示骨架屏
  if (!user || !data) {
    return <PageSkeleton />;
  }

  return (
    <SettingsPageClient
      user={user}
      settings={data}
      error={error || undefined}
    />
  );
}

/**
 * 消息页渲染器
 */
function MessagesPageRenderer() {
  return <MessagesPageClient />;
}

interface PageRendererProps {
  pageId: PageId;
}

/**
 * 页面渲染器
 * 根据页面 ID 渲染对应的客户端组件
 */
function PageRenderer({ pageId }: PageRendererProps) {
  switch (pageId) {
    case "home":
      return <HomePageRenderer />;
    case "search":
      return <SearchPageRenderer />;
    case "folders":
      return <FoldersPageRenderer />;
    case "analytics":
      return <AnalyticsPageRenderer />;
    case "settings":
      return <SettingsPageRenderer />;
    case "messages":
      return <MessagesPageRenderer />;
    default:
      return null;
  }
}

// ==================== 主容器组件 ====================

interface PageContainerProps {
  /** 服务端渲染的初始内容（兼容性保障） */
  children?: React.ReactNode;
}

/**
 * 页面容器
 * 管理所有主页面的渲染和切换
 */
export function PageContainer({ children }: PageContainerProps) {
  const { activePage, isClientNavEnabled, pageStates } = useNavigation();

  // 客户端导航未启用时，显示服务端渲染的内容
  if (!isClientNavEnabled) {
    return <>{children}</>;
  }

  return (
    <div className="page-container" role="main">
      {PAGE_IDS.map((pageId) => {
        const pageState = pageStates[pageId];

        // 只渲染已访问过的页面
        if (pageState.state === "idle" && pageId !== activePage) {
          return null;
        }

        return (
          <PageWrapper key={pageId} pageId={pageId}>
            <PageErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                <PageRenderer pageId={pageId} />
              </Suspense>
            </PageErrorBoundary>
          </PageWrapper>
        );
      })}
    </div>
  );
}

// ==================== 导出 ====================

export { PageSkeleton };
