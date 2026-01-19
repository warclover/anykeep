/**
 * HTTP 连接配置
 * 优化 Supabase 连接管理，解决 ECONNRESET 错误
 *
 * @version 1.1.0
 * @date 2026-01-19
 */

/**
 * 创建带重试机制的 fetch 函数
 *
 * 解决 ECONNRESET 错误的策略：
 * 1. 增加超时时间到 30 秒
 * 2. 添加自动重试机制（最多 3 次）
 * 3. 指数退避延迟
 */
export function createFetchWithAgent(timeout: number = 30000) {
  return async (url: RequestInfo | URL, options?: RequestInit) => {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error as Error;

        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries - 1) {
          throw error;
        }

        // 检查是否是可重试的错误
        const isRetryable =
          error instanceof Error &&
          (error.message.includes("ECONNRESET") ||
            error.message.includes("ETIMEDOUT") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("fetch failed"));

        if (!isRetryable) {
          throw error;
        }

        // 指数退避：100ms, 200ms, 400ms
        const delay = 100 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  };
}
