/**
 * 带认证的统一请求封装
 * @description 客户端统一请求工具，自动携带 Session Token
 * @version 1.0.0
 *
 * 性能优化：
 * - 客户端只需获取一次 session
 * - API 路由直接验证 token（~50ms vs 1000ms）
 * - 减少 Supabase Auth 服务压力
 */

import { createClient } from "@/lib/supabase/client";

/**
 * 获取当前 session 的 access token
 * 使用缓存避免重复获取
 */
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string | null> {
  // 检查缓存的 token 是否有效（提前 60 秒刷新）
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  const supabase = createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    cachedToken = null;
    tokenExpiry = 0;
    return null;
  }

  // 缓存 token 和过期时间
  cachedToken = session.access_token;
  tokenExpiry = session.expires_at
    ? session.expires_at * 1000
    : Date.now() + 3600000;

  return cachedToken;
}

/**
 * 清除 token 缓存（登出时调用）
 */
export function clearAuthCache(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

/**
 * 带认证的 fetch 请求
 *
 * @example
 * // GET 请求
 * const response = await fetchWithAuth('/api/bookmarks');
 *
 * @example
 * // POST 请求
 * const response = await fetchWithAuth('/api/bookmarks', {
 *   method: 'POST',
 *   body: JSON.stringify({ title: 'New Bookmark' }),
 * });
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();

  const headers = new Headers(options.headers);

  // 设置 Content-Type（如果未设置且有 body）
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // 添加 Authorization header
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * 带认证的 JSON 请求（自动解析响应）
 *
 * @example
 * const { data, error } = await fetchJsonWithAuth('/api/bookmarks');
 */
export async function fetchJsonWithAuth<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: Error | null; response: Response }> {
  try {
    const response = await fetchWithAuth(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.error || errorText;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }

      return {
        data: null,
        error: new Error(errorMessage),
        response,
      };
    }

    const data = await response.json();
    return { data, error: null, response };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
      response: new Response(null, { status: 0 }),
    };
  }
}

/**
 * SWR 兼容的 fetcher 函数
 *
 * @example
 * const { data } = useSWR('/api/bookmarks', authFetcher);
 */
export async function authFetcher<T = unknown>(url: string): Promise<T> {
  const response = await fetchWithAuth(url);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.error || errorText;
    } catch {
      errorMessage = errorText || `HTTP ${response.status}`;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export default fetchWithAuth;
