/**
 * Next.js 中间件
 * 处理认证保护、会话刷新、请求追踪和速率限制
 *
 * @features
 * - Request ID 追踪 (x-request-id header)
 * - 认证保护
 * - 会话自动刷新
 * - V4.2.15: API 速率限制
 * - V4.2.24: 用户预验证注入（性能优化）
 */

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit } from "@/lib/utils/rate-limiter";

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
  const { pathname } = request.nextUrl;

  // 2. V4.2.15: API 速率限制（仅对 /api 路由生效）
  if (pathname.startsWith("/api")) {
    // 获取用户标识：尝试多个 header 来源获取真实 IP
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const cfConnectingIp = request.headers.get("cf-connecting-ip"); // Cloudflare
    const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for"); // Vercel

    // 优先级: cf-connecting-ip > x-vercel-forwarded-for > x-real-ip > x-forwarded-for
    let ip = "anonymous";
    if (cfConnectingIp) {
      ip = cfConnectingIp;
    } else if (vercelForwardedFor) {
      ip = vercelForwardedFor.split(",")[0].trim();
    } else if (realIp) {
      ip = realIp;
    } else if (forwarded) {
      ip = forwarded.split(",")[0].trim();
    }

    const identifier = ip;

    const rateLimitResult = checkRateLimit(identifier, pathname);

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          error: "Too Many Requests",
          message: "请求过于频繁，请稍后再试",
          retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
        },
        { status: 429 },
      );
      response.headers.set("x-request-id", requestId);
      response.headers.set(
        "Retry-After",
        String(Math.ceil(rateLimitResult.resetMs / 1000)),
      );
      response.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
      response.headers.set("X-RateLimit-Remaining", "0");
      return response;
    }
  }

  // 3. 更新会话
  const { supabaseResponse, user } = await updateSession(request);

  // 4. 将 Request ID 添加到响应头
  supabaseResponse.headers.set("x-request-id", requestId);

  // 5. V4.2.24 性能优化：注入预验证的用户信息到请求头
  // 这样 API 路由可以使用 header 模式跳过重复认证（节省 ~1000ms/请求）
  // 注意：这些 header 仅供内部 API 使用，不应被客户端信任
  if (user && pathname.startsWith("/api")) {
    // 注入到下一个请求的 headers（通过修改 request）
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-verified", "true");

    // 重新创建响应以包含修改后的请求
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // 复制原响应的 cookies 和 headers
    supabaseResponse.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });

    return response;
  }

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
