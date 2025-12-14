/**
 * Next.js 中间件
 * 处理认证保护、会话刷新和请求追踪
 *
 * @features
 * - Request ID 追踪 (x-request-id header)
 * - 认证保护
 * - 会话自动刷新
 */

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// 需要认证保护的路由
const protectedRoutes = [
  "/home",
  "/bookmark",
  "/search",
  "/folders",
  "/settings",
];

// 认证相关路由（已登录用户应跳过）
const authRoutes = ["/login", "/register"];

/**
 * 生成请求追踪 ID
 * 格式: req_${timestamp}_${random}
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

export async function middleware(request: NextRequest) {
  // 1. 获取或生成 Request ID
  const requestId = request.headers.get("x-request-id") || generateRequestId();

  // 2. 更新会话
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // 3. 将 Request ID 添加到响应头
  supabaseResponse.headers.set("x-request-id", requestId);

  // 检查是否是受保护的路由
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  // 检查是否是认证路由
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // 未登录用户访问受保护路由 -> 重定向到登录页
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  // 已登录用户访问认证路由 -> 重定向到首页
  if (isAuthRoute && user) {
    const response = NextResponse.redirect(new URL("/home", request.url));
    response.headers.set("x-request-id", requestId);
    return response;
  }

  return supabaseResponse;
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
