/**
 * Next.js 中间件
 * 处理认证保护、会话刷新、请求追踪和速率限制
 *
 * @features
 * - Request ID 追踪 (x-request-id header)
 * - 认证保护 (Supabase Auth)
 * - 会话自动刷新
 * - API 速率限制
 */

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/logger";

// 需要认证保护的路由
const protectedRoutes = [
  "/home",
  "/home-v2",
  "/bookmark",
  "/search",
  "/folders",
  "/settings",
  "/md-collections",
  "/analytics",
  "/messages",
  "/inbox",
];

// 认证相关路由（已登录用户应跳过）
const authRoutes = ["/login", "/register", "/auth"];

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

  // =====================================================
  // 2. API 路由处理
  // =====================================================
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

    // Rate Limit Check
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

    // API 路由 Auth 处理 + 用户信息注入（性能优化）
    const { supabaseResponse, user } = await updateSession(request);

    // 添加 Request ID
    supabaseResponse.headers.set("x-request-id", requestId);

    // V5.4: API 路由也注入用户 header，让 withAuth 走快速路径（~1ms vs 230ms）
    if (user) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", user.id);
      requestHeaders.set("x-user-verified", "true");

      const newResponse = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // 复制所有 headers 和 cookies
      supabaseResponse.headers.forEach((value, key) => {
        newResponse.headers.set(key, value);
      });
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        newResponse.cookies.set(cookie);
      });

      return newResponse;
    }

    return supabaseResponse;
  }

  // =====================================================
  // 3. 页面路由处理
  // =====================================================

  // 3.0 根路由快速重定向（避免 Server Component redirect 导致 RSC payload 错误）
  if (pathname === "/") {
    // 先检查认证状态，决定跳转到 /home 还是 /login
    const { supabaseResponse, user } = await updateSession(request);
    const target = user ? "/home" : "/login";
    const response = NextResponse.redirect(new URL(target, request.url));
    // 将 Supabase 会话刷新 cookie 复制到重定向响应，防止会话丢失
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  // 3.1 运行 Supabase Auth
  const { supabaseResponse, user, authMethod, authDuration, jwtDebug } =
    await updateSession(request);

  // 3.2 性能监控日志（开发和生产环境都记录慢请求）
  const authDurationRounded = Math.round(authDuration);

  if (process.env.NODE_ENV === "development") {
    // 🔒 安全修复：仅记录非敏感的调试信息，防止 JWT 内容泄露到日志系统
    const safeDebugInfo = jwtDebug
      ? {
          hasToken: jwtDebug.hasToken,
          tokenLength: undefined, // token 属性不存在于类型中
          isValid: jwtDebug.valid,
          // 不记录完整 token 和 payload
        }
      : undefined;

    logger.debug(
      {
        pathname,
        authMethod,
        authDuration: authDurationRounded,
        jwtDebug: safeDebugInfo,
      },
      `[Middleware] ${pathname} | Auth: ${authMethod} | ${authDurationRounded}ms`,
    );
  }

  // 生产环境：记录慢认证请求（>100ms 说明可能走了网络验证）
  // 🔧 修复 #8: 生产环境绝不记录 jwtDebug，确保无条件安全
  if (authDurationRounded > 100) {
    logger.warn(
      {
        pathname,
        authMethod,
        authDuration: authDurationRounded,
        isSlowAuth: true,
      },
      `[Middleware:SLOW] ${pathname} | Auth: ${authMethod} | ${authDurationRounded}ms - 认证耗时过长`,
    );
  }

  const finalResponse = supabaseResponse;

  // 添加 Request ID
  finalResponse.headers.set("x-request-id", requestId);

  // 3.3 权限控制
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname.startsWith(route) || pathname === route,
  );

  // 3.4 用户信息注入 (Performance Optimization)
  // V5.5: 使用 cookies 传递用户信息，避免 RSC payload 请求失败
  // 原方案创建新 NextResponse 并复制 headers 会破坏 RSC 请求链
  if (user && isProtectedRoute) {
    // 设置短期 cookie 传递用户信息（仅本次请求有效）
    // httpOnly: false 允许 Server Component 通过 cookies() 读取
    finalResponse.cookies.set("x-user-id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300, // 5分钟，覆盖 RSC payload 请求的生命周期
      path: "/",
    });
    finalResponse.cookies.set("x-user-verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });
  }

  // 3.5 路由跳转保护
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // 未登录 -> 登录页
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  // 已登录 -> 首页
  if (isAuthRoute && user) {
    const response = NextResponse.redirect(new URL("/home", request.url));
    response.headers.set("x-request-id", requestId);
    return response;
  }

  return finalResponse;
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (浏览器图标)
     * - 公开资源 (public 文件夹)
     * - 根目录下的静态文件 (如 robots.txt 等，如果有的话)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
