/**
 * Supabase 中间件客户端
 * 用于 Next.js Middleware 中的认证检查
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

/**
 * 更新会话并刷新 Token
 * 在中间件中调用以保持用户登录状态
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 刷新会话（如果存在）
  // 重要：不要在 createServerClient 和 supabase.auth.getUser() 之间写任何逻辑
  // 一个简单的错误可能导致用户随机登出
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
