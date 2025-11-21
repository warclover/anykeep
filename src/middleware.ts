/**
 * Next.js 中间件
 * 处理认证保护和会话刷新
 */

import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// 需要认证保护的路由
const protectedRoutes = ['/home', '/bookmark', '/search', '/folders', '/settings']

// 认证相关路由（已登录用户应跳过）
const authRoutes = ['/login', '/register']

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // 检查是否是受保护的路由
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // 检查是否是认证路由
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  // 未登录用户访问受保护路由 -> 重定向到登录页
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // 已登录用户访问认证路由 -> 重定向到首页
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (浏览器图标)
     * - 公开资源 (public 文件夹)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
