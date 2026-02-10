/**
 * 用户上下文 Provider (v3.2 ErrorBoundary 降级版)
 *
 * 优化点：
 * 1. 使用 getSession() 替代 getUser()，避免网络请求（~1ms vs ~1000ms）
 * 2. Profile 使用 TanStack Query 异步加载，不阻塞首屏渲染
 * 3. 添加安全保障：401 错误检测、定期 token 检查
 *
 * v3.2 改进：
 * - 使用 ErrorBoundary 替代 QueryClientContext 直接检测
 * - 修复 ESM/CJS 双实例化导致 QueryClientContext 检测失效的问题
 * - 当 QueryClientProvider 缺失时，useQuery 抛错被 ErrorBoundary 捕获，安全降级
 *
 * v3.1 已废弃：
 * - React.useContext(QueryClientContext) 检测方案存在缺陷：
 *   webpack 可能将 QueryClientProvider (ESM) 和 user-context (CJS) 解析为
 *   不同模块实例，导致两个 createContext() 创建不同的 Context 对象，
 *   检测永远返回 undefined，实际 useQuery 却正常工作
 *
 * @version 3.2.0
 * @see https://supabase.com/docs/reference/javascript/auth-getsession
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  Component,
  type ReactNode,
  type ErrorInfo,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/supabase";
import { clientLogger } from "@/lib/client-logger";
import { profileKeys } from "@/hooks/queries/keys";

// ============================================================================
// Types
// ============================================================================

interface UserContextValue {
  /** 当前用户（从 session 读取，无网络请求） */
  user: User | null;
  /** 用户 Profile（SWR 异步加载） */
  profile: Profile | null;
  /** Profile 是否正在加载 */
  isLoading: boolean;
  /** 用户认证是否已初始化（session 已读取） */
  isInitialized: boolean;
  /** 错误信息 */
  error: string | null;
  /** 手动刷新 Profile */
  refetch: () => Promise<void>;
}

interface UserProviderProps {
  children: ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

/** Token 检查间隔（10 分钟） */
const TOKEN_CHECK_INTERVAL = 10 * 60 * 1000;

/** 全局认证错误事件名 */
const AUTH_ERROR_EVENT = "anykeep:auth-error";

// ============================================================================
// Context
// ============================================================================

const UserContext = createContext<UserContextValue | null>(null);

// ============================================================================
// Utilities
// ============================================================================

/**
 * 判断是否为 AbortError（请求被取消）
 * V4.2.32: 静默处理 AbortError，这是正常的取消行为
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.name === "AbortError" ||
      err.message.includes("abort") ||
      err.message.includes("signal is aborted")
    );
  }
  return false;
}

// ============================================================================
// SWR Fetcher
// ============================================================================

/**
 * Profile SWR Fetcher
 * 仅在有 userId 时才执行
 * V4.2.32: 添加 AbortError 静默处理
 */
async function profileFetcher([, userId]: [
  string,
  string,
]): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    // V4.2.32: 静默处理 AbortError
    if (isAbortError(error)) {
      return null;
    }
    clientLogger.error({ error }, "[UserProvider] Failed to fetch profile");
    throw error;
  }

  return data;
}

// ============================================================================
// Provider
// ============================================================================

/**
 * UserProvider 降级版本
 *
 * 当 QueryClientProvider 缺失时（例如 hydration 失败后 NotFoundErrorBoundary
 * 重建组件树），提供安全的降级 Context 值，避免级联崩溃。
 */
function UserProviderFallback({ children }: UserProviderProps) {
  const noopRefetch = useCallback(async () => {
    // noop: fallback mode 下不执行实际 refetch
  }, []);
  return (
    <UserContext.Provider
      value={{
        user: null,
        profile: null,
        isLoading: false,
        isInitialized: false,
        error: null,
        refetch: noopRefetch,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// ============================================================================
// ErrorBoundary（内部用，捕获 useQuery 因缺少 QueryClient 的抛错）
// ============================================================================

interface QuerySafeBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface QuerySafeBoundaryState {
  hasError: boolean;
}

/**
 * QueryClient 安全边界
 *
 * 专门捕获 UserProviderInner 因 QueryClientProvider 缺失而抛出的错误。
 *
 * 为什么不用 React.useContext(QueryClientContext) 检测：
 * webpack 在打包 ESM/CJS 混合模块时，可能为 @tanstack/react-query 创建
 * 两个独立的模块实例（ESM: QueryClientProvider.js / CJS: QueryClientProvider.cjs），
 * 各自调用 React.createContext() 生成不同的 Context 对象。
 * QueryClientProvider 写入实例 A，但 useContext 读取实例 B → 永远返回 undefined。
 *
 * ErrorBoundary 方案完全绕过了这个问题：让 useQuery 自然执行，
 * 如果 QueryClient 真的缺失就抛错，被 ErrorBoundary 捕获后降级。
 */
class QuerySafeBoundary extends Component<
  QuerySafeBoundaryProps,
  QuerySafeBoundaryState
> {
  constructor(props: QuerySafeBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): QuerySafeBoundaryState {
    // 仅捕获 QueryClient 相关错误
    if (
      error.message?.includes("QueryClient") ||
      error.message?.includes("QueryClientProvider")
    ) {
      return { hasError: true };
    }
    // 非 QueryClient 错误，继续向上传播
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    clientLogger.warn(
      { error: error.message, componentStack: errorInfo.componentStack },
      "[UserProvider] QueryClientProvider not found, using fallback mode",
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * 用户数据 Provider (v3.2 ErrorBoundary 降级版)
 *
 * 核心优化：
 * - getSession() 从本地存储读取，无网络请求（~1ms）
 * - Profile 使用 TanStack Query 异步加载，不阻塞首屏
 * - JWT 验证由 Middleware 在服务端完成
 *
 * v3.2 改进：
 * - 使用 ErrorBoundary 替代 QueryClientContext 直接检测
 * - 解决 ESM/CJS 双实例化导致检测失效的根本问题
 * - 当 QueryClientProvider 缺失时，useQuery 抛错被捕获，安���降级
 */
export function UserProvider({ children }: UserProviderProps) {
  return (
    <QuerySafeBoundary
      fallback={<UserProviderFallback>{children}</UserProviderFallback>}
    >
      <UserProviderInner>{children}</UserProviderInner>
    </QuerySafeBoundary>
  );
}

/**
 * UserProvider 内部实现（需要 QueryClientProvider 上下文）
 */
function UserProviderInner({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用于避免重复初始化
  const initRef = useRef(false);

  // -------------------------------------------------------------------------
  // 1. 同步读取 Session（无网络请求）
  // -------------------------------------------------------------------------
  useEffect(() => {
    // 防止 StrictMode 双重执行
    if (initRef.current) return;
    initRef.current = true;

    const supabase = createClient();

    // getSession() 从 localStorage/cookie 读取，不发送网络请求
    // JWT 的有效性由 Middleware 在服务端验证
    supabase.auth
      .getSession()
      .then(({ data: { session }, error: sessionError }) => {
        if (sessionError) {
          clientLogger.error(
            { error: sessionError },
            "[UserProvider] Failed to get session",
          );
          setError(sessionError.message);
        }
        setUser(session?.user ?? null);
        setIsInitialized(true);
      });

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      clientLogger.debug({ event }, "[UserProvider] Auth state changed");

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setUser(session?.user ?? null);
        setError(null);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setError(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 2. Profile 异步加载（TanStack Query，不阻塞渲染）
  // -------------------------------------------------------------------------
  const {
    data: profile,
    error: profileError,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: profileKeys.byUserId(user?.id ?? ""),
    queryFn: () => profileFetcher(["profile", user?.id ?? ""]),
    enabled: !!user, // 仅在 user 存在时请求
    staleTime: 60000, // 60秒内不重新请求
    gcTime: 300000, // 5分钟缓存
    refetchOnWindowFocus: false, // 切换标签页不重新请求
    refetchOnReconnect: false, // 网络恢复不重新请求
    retry: 2, // 错误重试次数
  });

  // -------------------------------------------------------------------------
  // 3. 安全保障：定期 Token 检查
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const supabase = createClient();

      // getSession 会触发 token 自动刷新（如果即将过期）
      const {
        data: { session },
        error: refreshError,
      } = await supabase.auth.getSession();

      if (refreshError || !session) {
        clientLogger.warn(
          { error: refreshError },
          "[UserProvider] Token refresh failed, signing out",
        );
        // Token 无效，触发登出
        await supabase.auth.signOut();
        setUser(null);
      }
    }, TOKEN_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [user]);

  // -------------------------------------------------------------------------
  // 4. 安全保障：API 401 错误监听
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleAuthError = async (event: Event) => {
      const customEvent = event as CustomEvent<{ status?: number }>;
      if (customEvent.detail?.status === 401) {
        clientLogger.warn(
          "[UserProvider] Received 401 error, verifying auth state",
        );

        const supabase = createClient();

        // 强制验证认证状态（此时才发网络请求）
        const {
          data: { user: currentUser },
          error: verifyError,
        } = await supabase.auth.getUser();

        if (verifyError || !currentUser) {
          clientLogger.warn(
            "[UserProvider] Auth verification failed, signing out",
          );
          setUser(null);
          // 可选：重定向到登录页
          // window.location.href = '/login';
        }
      }
    };

    window.addEventListener(AUTH_ERROR_EVENT, handleAuthError);
    return () => window.removeEventListener(AUTH_ERROR_EVENT, handleAuthError);
  }, []);

  // -------------------------------------------------------------------------
  // 5. 手动刷新 Profile
  // -------------------------------------------------------------------------
  const refetch = useCallback(async () => {
    await refetchProfile();
  }, [refetchProfile]);

  // -------------------------------------------------------------------------
  // 6. 计算最终错误状态（避免 effect 中同步 setState）
  // -------------------------------------------------------------------------
  const finalError =
    error ??
    (profileError
      ? profileError instanceof Error
        ? profileError.message
        : "获取用户资料失败"
      : null);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <UserContext.Provider
      value={{
        user,
        profile: profile ?? null,
        isLoading: profileLoading,
        isInitialized,
        error: finalError,
        refetch,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 获取用户数据的 Hook
 * @throws 如果在 UserProvider 外部使用
 */
export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }

  return context;
}

/**
 * 获取用户数据的 Hook（非必须，不抛错误）
 * 用于可选显示用户信息的组件
 */
export function useOptionalUser() {
  return useContext(UserContext);
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * 触发认证错误事件
 * 供 API 调用层在收到 401 时调用
 *
 * @example
 * ```typescript
 * if (response.status === 401) {
 *   dispatchAuthError(401);
 * }
 * ```
 */
export function dispatchAuthError(status: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(AUTH_ERROR_EVENT, { detail: { status } }),
    );
  }
}
