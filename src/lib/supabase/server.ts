/**
 * Supabase 服务端客户端
 * 用于 Server Components 和 API Routes
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

/**
 * 创建服务端 Supabase 客户端
 * 每次请求都需要新建实例（因为需要访问 cookies）
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 在 Server Component 中调用时可能会抛出错误
            // 这是正常的，因为 Server Component 无法设置 cookies
          }
        },
      },
    }
  )
}

/**
 * 创建具有 Service Role 权限的客户端
 * 警告：仅用于服务端，切勿暴露给客户端
 */
export async function createServiceClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 无法设置 cookies
          }
        },
      },
    }
  )
}
