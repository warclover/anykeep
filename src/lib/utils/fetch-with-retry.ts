/**
 * Fetch with Retry Utility
 * V4.2.1: 带自动重试的 fetch 工具
 *
 * 用于处理偶发的 401 认证失败问题
 * 当遇到 401 错误时，会自动重试一次
 */

import { logger } from "@/lib/logger";

/**
 * 重试配置
 */
interface RetryConfig {
  /**
   * 最大重试次数（不包括首次请求）
   * @default 1
   */
  maxRetries?: number;
  /**
   * 重试延迟（毫秒）
   * @default 500
   */
  retryDelay?: number;
  /**
   * 需要重试的状态码
   * @default [401, 503]
   */
  retryStatusCodes?: number[];
  /**
   * 请求标识（用于日志）
   */
  requestId?: string;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 1,
  retryDelay: 500,
  retryStatusCodes: [401, 503],
  requestId: "anonymous",
};

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试机制的 fetch
 *
 * @example
 * ```tsx
 * // 基本用法
 * const res = await fetchWithRetry('/api/confirmations');
 *
 * // 自定义配置
 * const res = await fetchWithRetry('/api/confirmations', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * }, {
 *   maxRetries: 2,
 *   retryDelay: 1000,
 *   requestId: 'confirmations-fetch',
 * });
 * ```
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  config?: RetryConfig,
): Promise<Response> {
  const { maxRetries, retryDelay, retryStatusCodes, requestId } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 如果是重试，先等待
      if (attempt > 0) {
        logger.debug(
          {
            requestId,
            url,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            delayMs: retryDelay,
          },
          `Retrying request after ${retryDelay}ms delay`,
        );
        await delay(retryDelay);
      }

      const response = await fetch(url, options);

      // 如果响应成功或不在重试状态码列表中，直接返回
      if (response.ok || !retryStatusCodes.includes(response.status)) {
        // 如果是重试后成功，记录日志
        if (attempt > 0) {
          logger.info(
            {
              requestId,
              url,
              attempt: attempt + 1,
              status: response.status,
            },
            "Request succeeded after retry",
          );
        }
        return response;
      }

      // 记录需要重试的错误
      lastResponse = response;
      logger.warn(
        {
          requestId,
          url,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          status: response.status,
          statusText: response.statusText,
        },
        "Request failed with retryable status",
      );

      // 如果是最后一次尝试，返回最后的响应
      if (attempt === maxRetries) {
        logger.error(
          {
            requestId,
            url,
            totalAttempts: maxRetries + 1,
            finalStatus: response.status,
          },
          "Request failed after all retries",
        );
        return response;
      }
    } catch (error) {
      // 网络错误等
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          requestId,
          url,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          error: lastError.message,
        },
        "Request threw an error",
      );

      // 如果是最后一次尝试，抛出错误
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  // 如果所有重试都失败，返回最后的响应或抛出错误
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError || new Error("Request failed after all retries");
}

/**
 * 创建带重试的 fetch 函数工厂
 * 用于预配置重试参数
 *
 * @example
 * ```tsx
 * const apiClient = createRetryableFetch({
 *   maxRetries: 2,
 *   retryDelay: 1000,
 * });
 *
 * const res = await apiClient('/api/data');
 * ```
 */
export function createRetryableFetch(defaultConfig: RetryConfig) {
  return (url: string, options?: RequestInit, config?: RetryConfig) =>
    fetchWithRetry(url, options, { ...defaultConfig, ...config });
}

export default fetchWithRetry;
