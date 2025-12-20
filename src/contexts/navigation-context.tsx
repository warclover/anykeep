/**
 * 导航状态管理 Context
 * 实现客户端页面切换，避免服务端重复渲染
 *
 * 核心功能：
 * - 管理当前激活的页面
 * - 支持 URL 同步（不触发服务端导航）
 * - 支持浏览器前进/后退
 * - 兼容直接 URL 访问
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

// ==================== 常量定义 ====================

/**
 * SSR 渲染完成后启用客户端导航的延迟（毫秒）
 * 确保首次服务端渲染完成后再启用客户端导航
 */
const CLIENT_NAV_ENABLE_DELAY_MS = 100;

/**
 * 所有支持的页面 ID 列表
 * 作为单一数据源，避免在多处重复定义
 * 注意：仅包含 Keep-Alive 管理的主页面，开发者工具页面不在此列
 */
export const PAGE_IDS: readonly PageId[] = [
  "home",
  "search",
  "folders",
  "messages",
  "analytics",
  "settings",
] as const;

// ==================== 类型定义 ====================

/**
 * History API 状态类型
 * 用于 pushState/replaceState 和 popstate 事件
 */
interface ClientNavHistoryState {
  pageId: PageId;
  params: string;
  clientNav: true;
}

/**
 * 类型守卫：检查是否为客户端导航的 history state
 */
function isClientNavState(state: unknown): state is ClientNavHistoryState {
  return (
    typeof state === "object" &&
    state !== null &&
    "clientNav" in state &&
    (state as ClientNavHistoryState).clientNav === true &&
    "pageId" in state &&
    typeof (state as ClientNavHistoryState).pageId === "string"
  );
}

/**
 * 支持的页面类型
 * 注意：Keep-Alive 仅管理 PAGE_IDS 中的页面
 * batch 页面不参与 Keep-Alive，但仍需要类型和路由定义
 */
export type PageId =
  | "home"
  | "search"
  | "folders"
  | "messages"
  | "analytics"
  | "batch"
  | "settings";

/**
 * 页面路由映射
 */
export const PAGE_ROUTES: Record<PageId, string> = {
  home: "/home",
  search: "/search",
  folders: "/folders",
  messages: "/messages",
  analytics: "/analytics",
  batch: "/batch",
  settings: "/settings",
};

/**
 * 路由到页面 ID 的反向映射
 */
const ROUTE_TO_PAGE: Record<string, PageId> = {
  "/home": "home",
  "/search": "search",
  "/folders": "folders",
  "/messages": "messages",
  "/analytics": "analytics",
  "/batch": "batch",
  "/settings": "settings",
};

/**
 * 检查路径是否是主页面（Keep-Alive 管理的页面）
 */
export function isMainPagePath(pathname: string): boolean {
  return pathname in ROUTE_TO_PAGE;
}

/**
 * 页面状态
 */
export type PageState = "idle" | "loading" | "ready" | "cached";

/**
 * 页面缓存信息
 */
interface PageCacheEntry {
  state: PageState;
  scrollPosition: { x: number; y: number };
  lastVisited: number;
}

/**
 * Context 值类型
 */
interface NavigationContextValue {
  // 当前状态
  // activePage 为 null 表示当前不在主页面（如详情页）
  activePage: PageId | null;
  activeParams: URLSearchParams;

  // 页面缓存状态
  pageStates: Record<PageId, PageCacheEntry>;

  // 导航操作
  navigateTo: (pageId: PageId, params?: Record<string, string>) => void;

  // 页面状态操作
  setPageState: (pageId: PageId, state: PageState) => void;
  saveScrollPosition: (pageId: PageId) => void;
  restoreScrollPosition: (pageId: PageId) => void;

  // 是否启用客户端导航模式
  isClientNavEnabled: boolean;

  // 是否在主页面（Keep-Alive 管理的页面）
  isOnMainPage: boolean;
}

export const NavigationContext = createContext<NavigationContextValue | null>(
  null,
);

/**
 * 初始化页面缓存状态
 * @param initialPage - 可选的初始页面（将被标记为 loading）
 */
function createInitialPageStates(
  initialPage?: PageId,
): Record<PageId, PageCacheEntry> {
  const defaultEntry: PageCacheEntry = {
    state: "idle",
    scrollPosition: { x: 0, y: 0 },
    lastVisited: 0,
  };

  return PAGE_IDS.reduce(
    (acc, pageId) => ({
      ...acc,
      [pageId]:
        pageId === initialPage
          ? {
              ...defaultEntry,
              state: "loading" as PageState,
              lastVisited: Date.now(),
            }
          : defaultEntry,
    }),
    {} as Record<PageId, PageCacheEntry>,
  );
}

interface NavigationProviderProps {
  children: ReactNode;
}

/**
 * 导航状态 Provider
 */
export function NavigationProvider({ children }: NavigationProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 从 URL 解析初始页面（只在首次渲染时使用）
  // 如果不是主页面（如详情页），则为 null
  const [initialPage] = useState<PageId | null>(
    () => (pathname ? ROUTE_TO_PAGE[pathname] : null) || null,
  );

  // 当前激活的页面（null 表示不在主页面）
  const [activePage, setActivePage] = useState<PageId | null>(initialPage);

  // 使用 ref 跟踪当前页面，避免 popstate 事件处理器中的闭包陷阱
  const activePageRef = useRef<PageId | null>(initialPage);

  // 保持 ref 与 state 同步（使用 useEffect 避免渲染期间更新 ref）
  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  // 当前页面参数
  const [activeParams, setActiveParams] = useState<URLSearchParams>(
    () => new URLSearchParams(searchParams?.toString() ?? ""),
  );

  // 页面缓存状态（初始时将当前页面标记为 loading，如果有的话）
  const [pageStates, setPageStates] = useState<Record<PageId, PageCacheEntry>>(
    () => createInitialPageStates(initialPage ?? undefined),
  );

  // 是否启用客户端导航（首次加载后启用）
  const [isClientNavEnabled, setIsClientNavEnabled] = useState(false);

  // 是否在主页面
  const isOnMainPage = activePage !== null;

  /**
   * 导航到指定页面
   */
  const navigateTo = useCallback(
    (pageId: PageId, params?: Record<string, string>) => {
      // 如果是同一页面且参数完全相同，不做操作
      const hasExistingParams = activeParams.toString().length > 0;
      const hasNewParams = params && Object.keys(params).length > 0;

      if (pageId === activePage && !hasNewParams && !hasExistingParams) {
        return;
      }

      // 保存当前页面滚动位置（仅当在主页面时）
      if (activePage !== null) {
        setPageStates((prev) => ({
          ...prev,
          [activePage]: {
            ...prev[activePage],
            scrollPosition: { x: window.scrollX, y: window.scrollY },
            state:
              prev[activePage].state === "ready"
                ? "cached"
                : prev[activePage].state,
          },
        }));
      }

      // 构建新 URL
      const newParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value) newParams.set(key, value);
        });
      }

      const newUrl = newParams.toString()
        ? `${PAGE_ROUTES[pageId]}?${newParams.toString()}`
        : PAGE_ROUTES[pageId];

      // 更新 URL（不触发服务端导航）
      const historyState: ClientNavHistoryState = {
        pageId,
        params: newParams.toString(),
        clientNav: true,
      };
      window.history.pushState(historyState, "", newUrl);

      // 更新状态
      setActivePage(pageId);
      setActiveParams(newParams);

      // 标记页面状态
      setPageStates((prev) => ({
        ...prev,
        [pageId]: {
          ...prev[pageId],
          lastVisited: Date.now(),
          state: prev[pageId].state === "idle" ? "loading" : prev[pageId].state,
        },
      }));
    },
    [activePage, activeParams],
  );

  /**
   * 设置页面状态
   */
  const setPageState = useCallback((pageId: PageId, state: PageState) => {
    setPageStates((prev) => ({
      ...prev,
      [pageId]: {
        ...prev[pageId],
        state,
      },
    }));
  }, []);

  /**
   * 保存滚动位置
   */
  const saveScrollPosition = useCallback((pageId: PageId) => {
    setPageStates((prev) => ({
      ...prev,
      [pageId]: {
        ...prev[pageId],
        scrollPosition: { x: window.scrollX, y: window.scrollY },
      },
    }));
  }, []);

  /**
   * 恢复滚动位置
   */
  const restoreScrollPosition = useCallback(
    (pageId: PageId) => {
      const entry = pageStates[pageId];
      if (entry && entry.scrollPosition) {
        requestAnimationFrame(() => {
          window.scrollTo(entry.scrollPosition.x, entry.scrollPosition.y);
        });
      }
    },
    [pageStates],
  );

  /**
   * 监听浏览器前进/后退
   * 使用 ref 获取当前页面，避免闭包陷阱
   * 依赖数组为空，只在挂载时注册一次事件
   */
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // 使用 ref 获取最新的 activePage，避免闭包陷阱
      const currentPage = activePageRef.current;

      if (isClientNavState(event.state)) {
        // 客户端导航历史（类型安全）
        const { pageId, params } = event.state;
        const newParams = new URLSearchParams(params || "");

        // 保存当前页面滚动位置（仅当在主页面时）
        if (currentPage !== null) {
          setPageStates((prev) => ({
            ...prev,
            [currentPage]: {
              ...prev[currentPage],
              scrollPosition: { x: window.scrollX, y: window.scrollY },
            },
          }));
        }

        setActivePage(pageId);
        setActiveParams(newParams);
      } else {
        // 服务端导航历史，解析当前 URL
        const currentPath = window.location.pathname;
        const pageId = ROUTE_TO_PAGE[currentPath];

        // 保存当前页面滚动位置（仅当在主页面时）
        if (currentPage !== null) {
          setPageStates((prev) => ({
            ...prev,
            [currentPage]: {
              ...prev[currentPage],
              scrollPosition: { x: window.scrollX, y: window.scrollY },
            },
          }));
        }

        // 如果是主页面，更新 activePage；否则设为 null
        setActivePage(pageId || null);
        setActiveParams(new URLSearchParams(window.location.search));
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []); // 空依赖数组，只在挂载时注册一次

  /**
   * 首次加载完成后启用客户端导航
   * 注意：页面初始状态已在 useState 中设置
   */
  useEffect(() => {
    // 延迟启用客户端导航，确保首次 SSR 渲染完成
    const timer = setTimeout(() => {
      setIsClientNavEnabled(true);
    }, CLIENT_NAV_ENABLE_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  // 用于追踪上一次的 searchParams，避免 useEffect 无限循环
  const prevSearchParamsRef = useRef<string>("");

  /**
   * URL 变化时同步状态（处理直接 URL 访问和同页面参数变化）
   * V4.2.17: 修复同一页面参数变化时 activeParams 不更新的问题
   */
  useEffect(() => {
    const pageId = (pathname ? ROUTE_TO_PAGE[pathname] : null) || null;
    const newParamsString = searchParams?.toString() ?? "";
    const paramsChanged = prevSearchParamsRef.current !== newParamsString;

    // 更新 ref
    prevSearchParamsRef.current = newParamsString;

    // 当 pageId 变化时更新
    if (pageId !== activePage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 响应外部 URL 变化
      setActivePage(pageId);
      setActiveParams(new URLSearchParams(newParamsString));
    } else if (paramsChanged) {
      // V4.2.17: 同一页面但参数变化（如搜索关键词变化）

      setActiveParams(new URLSearchParams(newParamsString));
    }
  }, [pathname, searchParams, activePage]);

  const value = useMemo<NavigationContextValue>(
    () => ({
      activePage,
      activeParams,
      pageStates,
      navigateTo,
      setPageState,
      saveScrollPosition,
      restoreScrollPosition,
      isClientNavEnabled,
      isOnMainPage,
    }),
    [
      activePage,
      activeParams,
      pageStates,
      navigateTo,
      setPageState,
      saveScrollPosition,
      restoreScrollPosition,
      isClientNavEnabled,
      isOnMainPage,
    ],
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * 使用导航 Context 的 Hook
 * @throws 如果在 NavigationProvider 外部使用
 */
export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}

/**
 * 安全获取导航上下文（不抛出错误）
 * 适用于可能在 NavigationProvider 外部渲染的组件
 * @returns NavigationContextValue 或 null
 */
export function useSafeNavigation(): NavigationContextValue | null {
  return useContext(NavigationContext);
}

/**
 * 检查页面是否应该渲染
 */
export function usePageVisibility(pageId: PageId): {
  isVisible: boolean;
  shouldRender: boolean;
  state: PageState;
} {
  const { activePage, pageStates } = useNavigation();
  const entry = pageStates[pageId];

  return {
    isVisible: activePage === pageId,
    shouldRender: entry.state !== "idle",
    state: entry.state,
  };
}
