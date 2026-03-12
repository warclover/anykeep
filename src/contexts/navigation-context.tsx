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
 * Keep-Alive 管理的页面 ID 列表
 * 这些页面使用客户端导航和页面缓存
 * 注意：batch/export/analytics 不在此列，它们需要服务端导航获取实时数据
 */
export const PAGE_IDS: readonly PageId[] = [
  "home",
  "search",
  "folders",
  "messages",
  "settings",
] as const;

/**
 * 所有页面 ID（包括非 Keep-Alive 页面）
 * 用于初始化 pageStates，确保所有页面都有状态条目
 */
const ALL_PAGE_IDS: readonly PageId[] = [
  ...PAGE_IDS,
  "analytics",
  "batch",
  "export",
] as const;

/**
 * 检查是否是 Keep-Alive 管理的页面
 * @param pageId - 页面 ID
 * @returns true 如果是 Keep-Alive 页面
 */
export function isKeepAlivePage(pageId: PageId | null): boolean {
  if (!pageId) return false;
  return (PAGE_IDS as readonly string[]).includes(pageId);
}

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
 * batch 和 export 页面不参与 Keep-Alive，但仍需要类型和路由定义
 */
export type PageId =
  | "home"
  | "search"
  | "folders"
  | "messages"
  | "analytics"
  | "batch"
  | "export"
  | "rules"
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
  export: "/export",
  rules: "/rules",
  settings: "/settings",
};

/**
 * 路由到页面 ID 的反向映射
 */
const ROUTE_TO_PAGE: Record<string, PageId> = {
  "/home": "home",
  "/home-v2": "home",
  "/search": "search",
  "/folders": "folders",
  "/messages": "messages",
  "/analytics": "analytics",
  "/batch": "batch",
  "/export": "export",
  "/rules": "rules",
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
 * 默认页面缓存条目
 * 用于初始化和安全访问
 */
const DEFAULT_PAGE_CACHE_ENTRY: PageCacheEntry = {
  state: "idle",
  scrollPosition: { x: 0, y: 0 },
  lastVisited: 0,
};

/**
 * 安全获取页面状态，如果不存在则返回默认值
 */
function getPageEntry(
  states: Record<PageId, PageCacheEntry>,
  pageId: PageId,
): PageCacheEntry {
  return states[pageId] ?? DEFAULT_PAGE_CACHE_ENTRY;
}

/**
 * 初始化页面缓存状态
 * @param initialPage - 可选的初始页面（将被标记为 loading）
 * 注意：使用固定值初始化以避免 SSR/CSR hydration 不匹配
 */
function createInitialPageStates(
  initialPage?: PageId,
): Record<PageId, PageCacheEntry> {
  // 使用 ALL_PAGE_IDS 确保所有页面（包括 batch/export）都有状态条目
  return ALL_PAGE_IDS.reduce(
    (acc, pageId) => ({
      ...acc,
      [pageId]:
        pageId === initialPage
          ? {
              ...DEFAULT_PAGE_CACHE_ENTRY,
              state: "loading" as PageState,
              // 使用 0 而非 Date.now() 避免 hydration 错误
              lastVisited: 0,
            }
          : { ...DEFAULT_PAGE_CACHE_ENTRY },
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
   * Keep-Alive 页面使用客户端导航（pushState）
   * 非 Keep-Alive 页面（batch/export）使用服务端导航
   */
  const navigateTo = useCallback(
    (pageId: PageId, params?: Record<string, string>) => {
      // 构建 URL 参数
      const newParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value) newParams.set(key, value);
        });
      }

      const newUrl = newParams.toString()
        ? `${PAGE_ROUTES[pageId]}?${newParams.toString()}`
        : PAGE_ROUTES[pageId];

      // 非 Keep-Alive 页面使用服务端导航
      // 这确保 batch/export 页面获得正确的 SSR 内容
      if (!isKeepAlivePage(pageId)) {
        window.location.href = newUrl;
        return;
      }

      // === 以下为 Keep-Alive 页面的客户端导航逻辑 ===

      // 如果是同一页面且参数完全相同，不做操作
      const hasExistingParams = activeParams.toString().length > 0;
      const hasNewParams = params && Object.keys(params).length > 0;

      if (pageId === activePage && !hasNewParams && !hasExistingParams) {
        return;
      }

      // 保存当前页面滚动位置（仅当在 Keep-Alive 主页面时）
      if (activePage !== null && isKeepAlivePage(activePage)) {
        setPageStates((prev) => {
          const currentEntry = getPageEntry(prev, activePage);
          return {
            ...prev,
            [activePage]: {
              ...currentEntry,
              scrollPosition: { x: window.scrollX, y: window.scrollY },
              state:
                currentEntry.state === "ready" ? "cached" : currentEntry.state,
            },
          };
        });
      }

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
      setPageStates((prev) => {
        const targetEntry = getPageEntry(prev, pageId);
        return {
          ...prev,
          [pageId]: {
            ...targetEntry,
            lastVisited: Date.now(),
            state: targetEntry.state === "idle" ? "loading" : targetEntry.state,
          },
        };
      });
    },
    [activePage, activeParams],
  );

  /**
   * 设置页面状态
   */
  const setPageState = useCallback((pageId: PageId, state: PageState) => {
    setPageStates((prev) => {
      const entry = getPageEntry(prev, pageId);
      return {
        ...prev,
        [pageId]: {
          ...entry,
          state,
        },
      };
    });
  }, []);

  /**
   * 保存滚动位置
   */
  const saveScrollPosition = useCallback((pageId: PageId) => {
    setPageStates((prev) => {
      const entry = getPageEntry(prev, pageId);
      return {
        ...prev,
        [pageId]: {
          ...entry,
          scrollPosition: { x: window.scrollX, y: window.scrollY },
        },
      };
    });
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
          setPageStates((prev) => {
            const entry = getPageEntry(prev, currentPage);
            return {
              ...prev,
              [currentPage]: {
                ...entry,
                scrollPosition: { x: window.scrollX, y: window.scrollY },
              },
            };
          });
        }

        setActivePage(pageId);
        setActiveParams(newParams);
      } else {
        // 服务端导航历史，解析当前 URL
        const currentPath = window.location.pathname;
        const pageId = ROUTE_TO_PAGE[currentPath];

        // 保存当前页面滚动位置（仅当在主页面时）
        if (currentPage !== null) {
          setPageStates((prev) => {
            const entry = getPageEntry(prev, currentPage);
            return {
              ...prev,
              [currentPage]: {
                ...entry,
                scrollPosition: { x: window.scrollX, y: window.scrollY },
              },
            };
          });
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
  const entry = pageStates[pageId] ?? DEFAULT_PAGE_CACHE_ENTRY;

  return {
    isVisible: activePage === pageId,
    shouldRender: entry.state !== "idle",
    state: entry.state,
  };
}
