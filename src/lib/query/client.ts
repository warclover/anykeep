/**
 * TanStack Query 客户端配置
 *
 * 统一配置 React Query 的默认行为
 *
 * @version 1.0.0
 * @since 2025-12-29
 * @phase North Star Phase 4 - 前端数据层升级
 */

import { QueryClient } from "@tanstack/react-query";

/**
 * Query 缓存时间常量
 */
export const QUERY_STALE_TIME = {
  /** 短缓存 - 1 分钟 (实时性要求高) */
  SHORT: 1 * 60 * 1000,
  /** 标准缓存 - 5 分钟 (默认) */
  STANDARD: 5 * 60 * 1000,
  /** 长缓存 - 30 分钟 (不常变化的数据) */
  LONG: 30 * 60 * 1000,
  /** 永久缓存 - 无过期 (静态数据) */
  INFINITE: Infinity,
} as const;

/**
 * GC 时间常量（缓存保留时间）
 */
export const QUERY_GC_TIME = {
  /** 短保留 - 5 分钟 */
  SHORT: 5 * 60 * 1000,
  /** 标准保留 - 30 分钟 */
  STANDARD: 30 * 60 * 1000,
  /** 长保留 - 1 小时 */
  LONG: 60 * 60 * 1000,
} as const;

/**
 * 创建 QueryClient 实例
 *
 * 配置说明：
 * - staleTime: 数据被视为陈旧的时间，之后才会重新获取
 * - gcTime: 非活跃缓存保留时间，之后被垃圾回收
 * - retry: 失败重试次数
 * - refetchOnWindowFocus: 窗口聚焦时是否重新获取
 * - refetchOnReconnect: 网络重连时是否重新获取
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 数据 5 分钟内视为新鲜，不触发后台刷新
        staleTime: QUERY_STALE_TIME.STANDARD,
        // 非活跃缓存保留 30 分钟
        gcTime: QUERY_GC_TIME.STANDARD,
        // 失败自动重试 3 次
        retry: 3,
        // 指数退避重试延迟
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // 禁用窗口聚焦刷新（避免频繁请求）
        refetchOnWindowFocus: false,
        // 网络重连时刷新
        refetchOnReconnect: true,
        // 组件卸载后继续保留缓存
        refetchOnMount: false,
      },
      mutations: {
        // 变更操作只重试 1 次
        retry: 1,
        // 变更重试延迟
        retryDelay: 1000,
      },
    },
  });
}

/**
 * 全局 QueryClient 单例
 *
 * 在客户端组件中使用，服务端渲染时通过 Provider 传入
 */
let queryClientSingleton: QueryClient | undefined;

/**
 * 获取 QueryClient 实例
 *
 * 在服务端每次请求创建新实例，在客户端复用单例
 */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // 服务端：每次请求创建新实例
    return createQueryClient();
  }

  // 客户端：复用单例
  if (!queryClientSingleton) {
    queryClientSingleton = createQueryClient();
  }

  return queryClientSingleton;
}
