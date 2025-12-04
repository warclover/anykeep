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

import { Suspense, lazy, useEffect, memo, type CSSProperties } from "react";
import {
  useNavigation,
  usePageVisibility,
  type PageId,
} from "@/contexts/navigation-context";
import { useUser } from "@/contexts/user-context";
import {
  useFoldersData,
  useAnalyticsData,
  useSettingsData,
} from "@/hooks/use-page-data";

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
 * 页面包装器
 * 控制页面的显示/隐藏和状态管理
 */
const PageWrapper = memo(function PageWrapper({
  pageId,
  children,
}: PageWrapperProps) {
  const { isVisible, shouldRender, state } = usePageVisibility(pageId);
  const { setPageState, restoreScrollPosition } = useNavigation();

  // 页面加载完成时更新状态
  useEffect(() => {
    if (shouldRender && state === "loading") {
      // 组件已挂载，标记为 ready
      setPageState(pageId, "ready");
    }
  }, [shouldRender, state, pageId, setPageState]);

  // 切换到可见时恢复滚动位置
  useEffect(() => {
    if (isVisible && (state === "ready" || state === "cached")) {
      restoreScrollPosition(pageId);
    }
  }, [isVisible, state, pageId, restoreScrollPosition]);

  // 不应该渲染时返回 null
  if (!shouldRender) {
    return null;
  }

  // 通过 CSS 控制显示/隐藏，保持 DOM 存在
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
 */
function SearchPageRenderer() {
  const { activeParams } = useNavigation();
  const initialQuery = activeParams.get("q") || "";

  return (
    <SearchPageClient
      initialQuery={initialQuery}
      initialAIMode={false}
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
          trendData: [],
          platformData: [],
          tagData: [],
          typeData: [],
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

  // 所有支持的页面
  const pages: PageId[] = [
    "home",
    "search",
    "folders",
    "analytics",
    "settings",
  ];

  // 客户端导航未启用时，显示服务端渲染的内容
  if (!isClientNavEnabled) {
    return <>{children}</>;
  }

  return (
    <div className="page-container">
      {pages.map((pageId) => {
        const pageState = pageStates[pageId];

        // 只渲染已访问过的页面
        if (pageState.state === "idle" && pageId !== activePage) {
          return null;
        }

        return (
          <PageWrapper key={pageId} pageId={pageId}>
            <Suspense fallback={<PageSkeleton />}>
              <PageRenderer pageId={pageId} />
            </Suspense>
          </PageWrapper>
        );
      })}
    </div>
  );
}

// ==================== 导出 ====================

export { PageSkeleton };
