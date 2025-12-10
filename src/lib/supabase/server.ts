/**
 * Supabase 服务端客户端
 * 用于 Server Components 和 API Routes
 */

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

/**
 * 创建服务端 Supabase 客户端
 * 每次请求都需要新建实例（因为需要访问 cookies）
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );
}

/**
 * 创建具有 Service Role 权限的客户端（绕过 RLS）
 * 警告：仅用于服务端，切勿暴露给客户端
 *
 * 注意：使用 @supabase/supabase-js 的 createClient 而非 createServerClient
 * 因为 createServerClient 会应用用户会话，即使使用 service role key 也可能触发 RLS
 */
export async function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

/**
 * 别名：createServerSupabaseClient
 * 兼容 V4.2 服务代码
 */
export const createServerSupabaseClient = createClient;
