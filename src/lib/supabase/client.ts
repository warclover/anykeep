/**
 * Supabase 浏览器客户端
 * 用于客户端组件中的数据操作
 *
 * @version V4.2.24 - 性能优化：添加连接配置
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

// ============================================
// 连接配置常量
// ============================================

/** 请求超时时间（毫秒） */
const REQUEST_TIMEOUT = 15_000;

/**
 * 创建带超时的 fetch 函数（浏览器端）
 */
function createFetchWithTimeout(timeout: number) {
  return async (url: RequestInfo | URL, options?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

/**
 * 创建浏览器端 Supabase 客户端
 * 使用单例模式避免重复创建
 *
 * @features V4.2.24
 * - 请求超时控制（15秒）
 * - 禁用自动 Realtime 连接（按需启用）
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // V4.2.24: 性能优化配置
      global: {
        fetch: createFetchWithTimeout(REQUEST_TIMEOUT),
      },
      realtime: {
        // 禁用心跳以减少不必要的连接
        // 如需实时功能，可手动调用 channel.subscribe()
        heartbeatIntervalMs: 30_000,
      },
    },
  );
}

// 导出默认客户端实例（用于简单场景）
export const supabase = createClient();
