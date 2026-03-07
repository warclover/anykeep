/**
 * Supabase Admin Client 工具
 *
 * 用于需要绕过 RLS (Row Level Security) 的场景，如：
 * - Cron Jobs
 * - 后台任务处理
 * - 系统级操作
 *
 * @module @/lib/supabase/admin-client
 * @version 1.0.0
 * @since 2026-01-14
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { supabaseEnv } from "@/lib/env";

// 单例模式：全局共享一个 Admin 客户端实例
let supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

/**
 * 初始化 Supabase Admin 客户端
 *
 * 使用 Service Role Key 创建客户端，可以绕过 RLS 策略
 *
 * @throws {Error} 如果环境变量缺失
 * @returns Supabase Admin 客户端实例
 *
 * @example
 * ```typescript
 * const admin = initSupabaseAdmin();
 * const { data } = await admin.from('bookmarks').select('*');
 * ```
 */
export function initSupabaseAdmin(): ReturnType<typeof createClient<Database>> {
  const url = supabaseEnv.url;
  const serviceKey = supabaseEnv.serviceRoleKey;

  // 如果已经初始化，直接返回
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  supabaseAdmin = createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}

/**
 * 获取已初始化的 Supabase Admin 客户端
 *
 * 如果客户端未初始化，会先尝试初始化
 *
 * @throws {Error} 如果环境变量缺失或初始化失败
 * @returns Supabase Admin 客户端实例
 *
 * @example
 * ```typescript
 * const admin = getSupabaseAdmin();
 * const { data } = await admin.from('bookmarks').select('*');
 * ```
 */
export function getSupabaseAdmin(): ReturnType<typeof createClient<Database>> {
  if (!supabaseAdmin) {
    return initSupabaseAdmin();
  }
  return supabaseAdmin;
}

/**
 * 重置 Admin 客户端（主要用于测试）
 *
 * 在生产环境中不应调用此函数
 */
export function resetSupabaseAdmin(): void {
  supabaseAdmin = null;
}
