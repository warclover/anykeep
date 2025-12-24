/**
 * 弹性请求工具
 * V5.0: 提供降级、重试、超时处理能力
 *
 * 特点：
 * - 自动重试（指数退避）
 * - 超时控制
 * - 降级到缓存数据
 * - 详细错误分类
 */

import { dataCache } from "@/lib/cache/data-cache";
import { clientLogger } from "@/lib/client-logger";

/**
 * 错误类型分类
 */
export type FetchErrorType =
  | "network" // 网络错误（离线、DNS 失败等）
  | "timeout" // 请求超时
  | "server" // 服务器错误 (5xx)
  | "client" // 客户端错误 (4xx)
  | "parse" // 响应解析错误
  | "abort" // 请求被取消
  | "unknown"; // 未知错误

/**
 * 增强的错误类型
 */
export class FetchError extends Error {
  type: FetchErrorType;
  status?: number;
  retryCount: number;
  originalError?: Error;

  constructor(
    message: string,
    type: FetchErrorType,
    options?: {
      status?: number;
      retryCount?: number;
      originalError?: Error;
    },
  ) {
    super(message);
    this.name = "FetchError";
    this.type = type;
    this.status = options?.status;
    this.retryCount = options?.retryCount || 0;
    this.originalError = options?.originalError;
  }

  /**
   * 是否可重试
   */
  get isRetryable(): boolean {
    return (
      this.type === "network" ||
      this.type === "timeout" ||
      this.type === "server"
    );
  }
}

/**
 * 请求配置选项
 */
export interface ResilientFetchOptions extends RequestInit {
  /** 超时时间 (ms)，默认 10000 */
  timeout?: number;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 初始重试延迟 (ms)，默认 1000 */
  retryDelay?: number;
  /** 重试延迟倍数，默认 2 */
  retryMultiplier?: number;
  /** 最大重试延迟 (ms)，默认 10000 */
  maxRetryDelay?: number;
  /** 缓存键（用于降级）*/
  cacheKey?: string;
  /** 是否在失败时降级到缓存，默认 true */
  fallbackToCache?: boolean;
  /** 重试前回调 */
  onRetry?: (attempt: number, error: FetchError) => void;
  /** 降级到缓存时回调 */
  onFallback?: (cachedData: unknown) => void;
}

/**
 * 请求结果
 */
export interface ResilientFetchResult<T> {
  /** 响应数据 */
  data: T;
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 实际重试次数 */
  retryCount: number;
  /** 请求耗时 (ms) */
  duration: number;
}

/**
 * 判断错误类型
 */
function classifyError(error: unknown, status?: number): FetchErrorType {
  if (error instanceof Error) {
    // 请求取消
    if (error.name === "AbortError") {
      return "abort";
    }

    // 网络错误
    if (
      error.message.includes("network") ||
      error.message.includes("fetch") ||
      error.message.includes("Failed to fetch") ||
      error.message.includes("Network request failed")
    ) {
      return "network";
    }

    // 超时
    if (
      error.message.includes("timeout") ||
      error.message.includes("Timeout")
    ) {
      return "timeout";
    }
  }

  // HTTP 状态码分类
  if (status !== undefined) {
    if (status >= 500) return "server";
    if (status >= 400) return "client";
  }

  return "unknown";
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 计算重试延迟（指数退避 + 随机抖动）
 */
function calculateRetryDelay(
  attempt: number,
  baseDelay: number,
  multiplier: number,
  maxDelay: number,
): number {
  const exponentialDelay = baseDelay * Math.pow(multiplier, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% 抖动
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout: number },
): Promise<Response> {
  const { timeout, signal: existingSignal, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // 合并外部 signal
  if (existingSignal) {
    existingSignal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // 区分超时和取消
    if ((error as Error).name === "AbortError") {
      // 检查是否是超时导致的 abort
      if (!existingSignal?.aborted) {
        throw new Error("Request timeout");
      }
    }
    throw error;
  }
}

/**
 * 弹性请求函数
 *
 * @example
 * // 基本用法
 * const result = await resilientFetch<BookmarksResponse>('/api/bookmarks');
 *
 * @example
 * // 带降级的用法
 * const result = await resilientFetch<BookmarksResponse>('/api/bookmarks', {
 *   cacheKey: 'bookmarks:all',
 *   fallbackToCache: true,
 *   onFallback: (data) => console.log('Using cached data:', data),
 * });
 */
export async function resilientFetch<T>(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<ResilientFetchResult<T>> {
  const {
    timeout = 10000,
    maxRetries = 3,
    retryDelay = 1000,
    retryMultiplier = 2,
    maxRetryDelay = 10000,
    cacheKey,
    fallbackToCache = true,
    onRetry,
    onFallback,
    ...fetchOptions
  } = options;

  const startTime = Date.now();
  let lastError: FetchError | null = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetchWithTimeout(url, {
        ...fetchOptions,
        timeout,
      });

      // 处理非成功响应
      if (!response.ok) {
        const errorType = classifyError(null, response.status);
        throw new FetchError(
          `HTTP ${response.status}: ${response.statusText}`,
          errorType,
          { status: response.status, retryCount: attempt },
        );
      }

      // 解析响应
      let data: T;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new FetchError("Failed to parse response", "parse", {
          retryCount: attempt,
          originalError: parseError as Error,
        });
      }

      // 成功：更新缓存
      if (cacheKey) {
        dataCache.setCache(cacheKey, data);
      }

      return {
        data,
        fromCache: false,
        retryCount: attempt,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      // 转换为 FetchError
      const fetchError =
        error instanceof FetchError
          ? error
          : new FetchError(
              (error as Error).message || "Unknown error",
              classifyError(error),
              {
                retryCount: attempt,
                originalError: error as Error,
              },
            );

      lastError = fetchError;

      // 不可重试的错误直接失败
      if (!fetchError.isRetryable || fetchError.type === "abort") {
        break;
      }

      // 达到最大重试次数
      if (attempt >= maxRetries) {
        break;
      }

      // 重试
      attempt++;
      const delayMs = calculateRetryDelay(
        attempt - 1,
        retryDelay,
        retryMultiplier,
        maxRetryDelay,
      );

      onRetry?.(attempt, fetchError);

      if (process.env.NODE_ENV === "development") {
        clientLogger.warn(
          { attempt, maxRetries, url, delayMs, error: fetchError.message },
          "[resilientFetch] Retry",
        );
      }

      await delay(delayMs);
    }
  }

  // 所有重试失败，尝试降级到缓存
  if (fallbackToCache && cacheKey) {
    const cached = dataCache.getSync<T>(cacheKey);
    if (cached.data) {
      onFallback?.(cached.data);

      if (process.env.NODE_ENV === "development") {
        clientLogger.warn(
          { url },
          "[resilientFetch] Falling back to cached data",
        );
      }

      return {
        data: cached.data,
        fromCache: true,
        retryCount: attempt,
        duration: Date.now() - startTime,
      };
    }
  }

  // 无法恢复，抛出最后的错误
  throw lastError || new FetchError("Request failed", "unknown");
}

/**
 * 创建带默认配置的请求函数
 */
export function createResilientFetcher(
  defaultOptions: Partial<ResilientFetchOptions> = {},
) {
  return async function <T>(
    url: string,
    options: ResilientFetchOptions = {},
  ): Promise<ResilientFetchResult<T>> {
    return resilientFetch<T>(url, {
      ...defaultOptions,
      ...options,
    });
  };
}

/**
 * API 请求的预配置 fetcher
 * - 自动添加 credentials
 * - 更短的超时时间
 */
export const apiFetch = createResilientFetcher({
  credentials: "include",
  timeout: 8000,
  maxRetries: 2,
});
