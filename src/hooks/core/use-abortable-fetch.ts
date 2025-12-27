"use client";

/**
 * 可取消请求的 Hook
 *
 * 使用 AbortController 实现请求取消功能，防止内存泄漏和竞态条件
 *
 * @example
 * ```typescript
 * const { fetchWithAbort, abortAll } = useAbortableFetch()
 *
 * // 发起请求
 * const response = await fetchWithAbort('/api/bookmarks')
 *
 * // 组件卸载时会自动取消所有请求
 * ```
 */

import { useRef, useEffect, useCallback } from "react";
import { clientLogger } from "@/lib/client-logger";

/**
 * 可取消请求的 Hook
 *
 * 功能：
 * - 自动管理 AbortController
 * - 组件卸载时自动取消所有进行中的请求
 * - 防止内存泄漏
 * - 防止竞态条件
 */
export function useAbortableFetch() {
  // 存储当前所有的 AbortController
  const abortControllersRef = useRef<Set<AbortController>>(new Set());

  /**
   * 组件卸载时取消所有请求
   */
  useEffect(() => {
    // 复制 ref 到本地变量，避免 cleanup 时 ref 已变化
    const controllers = abortControllersRef.current;
    return () => {
      controllers.forEach((controller) => {
        controller.abort();
      });
      controllers.clear();
    };
  }, []);

  /**
   * 发起可取消的 fetch 请求
   *
   * @param input - 请求 URL 或 Request 对象
   * @param init - fetch 配置选项
   * @returns Promise<Response>
   */
  const fetchWithAbort = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // 创建新的 AbortController
      const controller = new AbortController();
      abortControllersRef.current.add(controller);

      try {
        // 合并 signal 到请求配置
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });

        // 请求完成，移除 controller
        abortControllersRef.current.delete(controller);

        return response;
      } catch (error) {
        // 请求失败或被取消，移除 controller
        abortControllersRef.current.delete(controller);

        // 如果是取消错误，不抛出（这是预期行为）
        if (error instanceof Error && error.name === "AbortError") {
          // 开发环境下记录取消日志
          if (process.env.NODE_ENV === "development") {
            clientLogger.info(
              { request: input },
              "[AbortableFetch] Request cancelled",
            );
          }
          // 抛出取消错误，让调用者决定如何处理
          throw error;
        }

        // 其他错误正常抛出
        throw error;
      }
    },
    [],
  );

  /**
   * 取消所有进行中的请求
   */
  const abortAll = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    abortControllersRef.current.clear();
  }, []);

  /**
   * 获取当前进行中的请求数量
   */
  const getPendingCount = useCallback(() => {
    return abortControllersRef.current.size;
  }, []);

  return {
    fetchWithAbort,
    abortAll,
    getPendingCount,
  };
}

/**
 * 带防抖的可取消请求 Hook
 *
 * 适用于搜索等需要防抖的场景
 *
 * @example
 * ```typescript
 * const { debouncedFetch } = useDebouncedAbortableFetch(300)
 *
 * // 快速输入时，只会发送最后一次请求
 * const handleSearch = async (query: string) => {
 *   const response = await debouncedFetch(`/api/search?q=${query}`)
 * }
 * ```
 */
export function useDebouncedAbortableFetch(delay: number = 300) {
  const { fetchWithAbort, abortAll } = useAbortableFetch();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  /**
   * 防抖 fetch
   */
  const debouncedFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // 取消之前的所有请求
      abortAll();

      // 清除之前的定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // 返回一个 Promise
      return new Promise((resolve, reject) => {
        timeoutRef.current = setTimeout(async () => {
          try {
            const response = await fetchWithAbort(input, init);
            resolve(response);
          } catch (error) {
            reject(error);
          }
        }, delay);
      });
    },
    [fetchWithAbort, abortAll, delay],
  );

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    debouncedFetch,
    fetchWithAbort,
    abortAll,
  };
}

/**
 * 默认导出（推荐使用具名导出）
 */
export default useAbortableFetch;
