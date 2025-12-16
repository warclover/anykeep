/**
 * 登录 API 路由
 * 带速率限制的邮箱密码登录
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  getRateLimitKey,
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  getClientIP,
} from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    // 获取客户端 IP
    const clientIP = getClientIP(request);

    // 解析请求体
    const body = await request.json();
    const { email, password } = body;

    // 验证必要字段
    if (!email || !password) {
      return NextResponse.json(
        { error: "邮箱和密码不能为空" },
        { status: 400 },
      );
    }

    // 生成速率限制键（IP + 邮箱）
    const rateLimitKey = getRateLimitKey(clientIP, email);

    // 检查速率限制
    const rateLimitCheck = checkRateLimit(rateLimitKey);
    if (!rateLimitCheck.allowed) {
      logger.warn(
        { ip: clientIP, email, retryAfter: rateLimitCheck.retryAfter },
        "Login rate limited",
      );

      return NextResponse.json(
        {
          error: rateLimitCheck.message,
          retryAfter: rateLimitCheck.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitCheck.retryAfter),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    // 创建 Supabase 客户端
    const supabase = await createClient();

    // 尝试登录
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 记录失败尝试
      const rateLimitResult = recordFailedAttempt(rateLimitKey);

      logger.warn(
        {
          ip: clientIP,
          email,
          error: error.message,
          remaining: rateLimitResult.remaining,
        },
        "Login failed",
      );

      // 返回错误，但不泄露具体原因
      return NextResponse.json(
        {
          error: "邮箱或密码错误",
          remaining: rateLimitResult.remaining,
          message:
            rateLimitResult.remaining > 0
              ? `还可尝试 ${rateLimitResult.remaining} 次`
              : rateLimitResult.message,
        },
        {
          status: 401,
          headers: {
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          },
        },
      );
    }

    // 登录成功，清除速率限制记录
    clearRateLimit(rateLimitKey);

    logger.info({ userId: data.user?.id, email }, "Login successful");

    return NextResponse.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "Login API error");

    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 },
    );
  }
}
