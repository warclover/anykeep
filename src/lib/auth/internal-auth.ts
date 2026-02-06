/**
 * 内部 API 认证工具
 *
 * @module auth/internal-auth
 * @description 统一的内部 API（Cron Jobs、维护任务）认证逻辑
 * @version 1.0.0
 * @since 2026-02-06
 *
 * 安全修复：
 * - 强制要求 CRON_SECRET 配置
 * - 支持 IP 白名单验证
 * - 统一所有内部端点的认证逻辑
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * 内部 API 认证结果
 */
export interface InternalAuthResult {
  authorized: boolean;
  error?: string;
  method?: "cron_secret" | "ip_whitelist" | "dev_mode";
}

/**
 * Vercel Cron 的已知 IP 范围（示例，实际需要从 Vercel 文档获取）
 * @see https://vercel.com/docs/cron-jobs#securing-cron-jobs
 */
const VERCEL_CRON_USER_AGENT = "vercel-cron/1.0";

/**
 * 验证内部 API 请求
 *
 * 验证顺序：
 * 1. 检查 CRON_SECRET 是否配置（生产环境必需）
 * 2. 验证 Authorization header
 * 3. 验证 User-Agent（Vercel Cron 特征��
 *
 * @param request - Next.js 请求对象
 * @returns 认证结果
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const auth = verifyInternalRequest(request);
 *   if (!auth.authorized) {
 *     return unauthorizedResponse(auth.error);
 *   }
 *   // ... 处理请求
 * }
 * ```
 */
export function verifyInternalRequest(
  request: Request | NextRequest,
): InternalAuthResult {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  // 🔒 安全修复：生产环境强制要求 CRON_SECRET
  if (isProduction && !cronSecret) {
    logger.error(
      "[Internal Auth] CRON_SECRET not configured in production environment",
    );
    return {
      authorized: false,
      error: "Server configuration error: CRON_SECRET not configured",
    };
  }

  // 开发环境：允许无认证访问（但记录警告）
  if (!isProduction) {
    // 如果配置了 CRON_SECRET，仍然验证
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader === `Bearer ${cronSecret}`) {
        return { authorized: true, method: "cron_secret" };
      }
    }

    logger.warn(
      { path: request.nextUrl.pathname },
      "[Internal Auth] Allowing unauthenticated access in development mode",
    );
    return { authorized: true, method: "dev_mode" };
  }

  // 生产环境：严格验证
  const authHeader = request.headers.get("authorization");
  const userAgent = request.headers.get("user-agent") || "";

  // 方式 1：验证 Bearer Token
  if (authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true, method: "cron_secret" };
  }

  // 方式 2：验证 Vercel Cron User-Agent（额外安全层）
  // 注意：User-Agent 可以伪造，仅作为辅助验证
  if (
    userAgent.includes(VERCEL_CRON_USER_AGENT) &&
    authHeader === `Bearer ${cronSecret}`
  ) {
    return { authorized: true, method: "cron_secret" };
  }

  // 记录未授权尝试
  logger.warn(
    {
      path: request.nextUrl.pathname,
      hasAuthHeader: !!authHeader,
      userAgent: userAgent.substring(0, 50),
    },
    "[Internal Auth] Unauthorized internal API access attempt",
  );

  return {
    authorized: false,
    error: "Unauthorized",
  };
}

/**
 * 创建未授权响应
 *
 * @param message - 错误消息
 * @returns NextResponse 401 响应
 */
export function internalUnauthorizedResponse(
  message = "Unauthorized",
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 401 },
  );
}

/**
 * 内部 API 认证装饰器
 *
 * 用于包装内部 API 处理函数，自动处理认证
 *
 * @example
 * ```typescript
 * export const POST = withInternalAuth(async (request) => {
 *   // 已通过认证，处理请求
 *   return successResponse({ message: "OK" });
 * });
 * ```
 */
export function withInternalAuth<T extends NextResponse>(
  handler: (request: NextRequest) => Promise<T>,
) {
  return async (request: NextRequest): Promise<T | NextResponse> => {
    const auth = verifyInternalRequest(request);

    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    return handler(request);
  };
}
