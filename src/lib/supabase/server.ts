/**
 * Supabase 服务端客户端
 * 用于 Server Components 和 API Routes
 *
 * @version V4.2.24 - 性能优化：添加连接配置
 */

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";
import { supabaseEnv } from "@/lib/env";
import { createFetchWithAgent } from "./http-agent";

// ============================================
// 连接配置常量
// ============================================

/** 请求超时时间（毫秒）- 增加到 30 秒以应对网络波动 */
const REQUEST_TIMEOUT = 30_000;

/**
 * 创建服务端 Supabase 客户端
 * 每次请求都需要新建实例（因为需要访问 cookies）
 *
 * @features V4.2.24
 * - 请求超时控制（10秒）
 * - keepalive 连接复用
 * - 禁用 Realtime（服务端不需要）
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 在 Server Component 中调用时可能会抛出错误
          // 这是正常的，因为 Server Component 无法设置 cookies
        }
      },
    },
    // V4.2.24: 性能优化配置（使用优化的 HTTP Agent）
    global: {
      fetch: createFetchWithAgent(REQUEST_TIMEOUT),
    },
    auth: {
      // 服务端不需要自动刷新 token
      autoRefreshToken: false,
      // 服务端不持久化会话
      persistSession: false,
      // 不自动检测会话变化
      detectSessionInUrl: false,
    },
  });
}

/**
 * 创建具有 Service Role 权限的客户端（绕过 RLS）
 * 警告：仅用于服务端，切勿暴露给客户端
 *
 * 注意：使用 @supabase/supabase-js 的 createClient 而非 createServerClient
 * 因为 createServerClient 会应用用户会话，即使使用 service role key 也可能触发 RLS
 *
 * @features V4.2.24
 * - 请求超时控制（10秒）
 * - keepalive 连接复用
 */
export async function createServiceClient() {
  return createSupabaseClient<Database>(
    supabaseEnv.url,
    supabaseEnv.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // V4.2.24: 性能优化配置（使用优化的 HTTP Agent）
      global: {
        fetch: createFetchWithAgent(REQUEST_TIMEOUT),
      },
    },
  );
}

/**
 * 别名：createServerSupabaseClient
 * 兼容 V4.2 服务代码
 */
export const createServerSupabaseClient = createClient;
