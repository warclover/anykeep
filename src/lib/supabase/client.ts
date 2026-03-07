/**
 * Supabase 浏览器客户端
 * 用于客户端组件中的数据操作
 *
 * @version V4.2.33 - 修复 SDK 初始化阶段 Failed to fetch 报错
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import { supabaseEnv } from "@/lib/env";

// ============================================
// 连接配置常量
// ============================================

/** 请求超时时间（毫秒） */
const REQUEST_TIMEOUT = 15_000;

/** 网络错误重试次数 */
const MAX_RETRIES = 1;

/** 重试延迟（毫秒） */
const RETRY_DELAY = 500;

/**
 * 判断是否为可重试的网络错误（非业务错误）
 */
function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    err.name === "TypeError"
  );
}

/**
 * 创建带超时和重试的 fetch 函数（浏览器端）
 *
 * V4.2.33: 修复 Supabase SDK 初始化阶段 _recoverAndRefresh → _getUser
 * 因网络瞬时不可达导致的 "Failed to fetch" 控制台报错。
 * - 保留调用方传入的 AbortSignal（不覆盖）
 * - 对��络层错误（非 AbortError）进行一次自动重试
 */
function createFetchWithTimeout(timeout: number) {
  return async (url: RequestInfo | URL, options?: RequestInit) => {
    const execute = async (): Promise<Response> => {
      // 仅在调用方未提供 signal 时才添加超时控制
      const needsTimeout = !options?.signal;
      const controller = needsTimeout ? new AbortController() : null;
      const timeoutId = needsTimeout
        ? setTimeout(() => controller?.abort(), timeout)
        : null;

      try {
        const response = await fetch(url, {
          ...options,
          // 优先使用调用方的 signal，其次使用超时 signal
          signal: options?.signal ?? controller?.signal,
        });
        return response;
      } finally {
        if (timeoutId !== null) clearTimeout(timeoutId);
      }
    };

    // 首次执行
    try {
      return await execute();
    } catch (err) {
      // AbortError 不重试（调用方主动取消或超时）
      if (err instanceof Error && err.name === "AbortError") {
        throw err;
      }

      // 可重试的网络错误：延迟后重试一次
      if (isRetryableNetworkError(err) && MAX_RETRIES > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
        return await execute();
      }

      throw err;
    }
  };
}

/**
 * 创建浏览器端 Supabase 客户端
 * 使用单例模式避免重复创建（@supabase/ssr 内部 cachedBrowserClient）
 *
 * @features V4.2.33
 * - 请求超时控制（15秒）
 * - 网络错误自动重试（1次，500ms 延迟）
 * - 保留 SDK 内部 AbortSignal，避免 signal 冲突
 * - 禁用自动 Realtime 连接（按需启用）
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
    // V4.2.24: 性能优化配置
    global: {
      fetch: createFetchWithTimeout(REQUEST_TIMEOUT),
    },
    realtime: {
      // 禁用心跳以减少不必要的连接
      // 如需实时功能，可手动调用 channel.subscribe()
      heartbeatIntervalMs: 30_000,
    },
  });
}
