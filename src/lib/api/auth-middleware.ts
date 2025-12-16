/**
 * API 认证中间件
 * @description 服务端认证工具，支持 Token 验证和请求头验证
 * @version 1.0.0
 *
 * 性能优化：
 * - 支持从 Authorization header 验证 token（~50ms）
 * - 支持从 Middleware 注入的 x-user-id header 快速验证
 * - 回退到完整认证流程（兼容现有代码）
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { User } from "@supabase/supabase-js";

/**
 * 认证结果类型
 */
export interface AuthResult {
  user: User | null;
  userId: string | null;
  error: Error | null;
  /** 认证方式 */
  method: "token" | "header" | "cookie" | "none";
  /** 认证耗时（毫秒） */
  duration: number;
}

/**
 * 从请求中获取已验证的用户
 *
 * 验证顺序：
 * 1. 检查 x-user-id header（Middleware 预验证）
 * 2. 检查 Authorization header（Token 验证）
 * 3. 回退到 Cookie 验证（完整认证）
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const { user, error } = await withAuth(request);
 *   if (error || !user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // ... handle request
 * }
 */
export async function withAuth(request: NextRequest): Promise<AuthResult> {
  const startTime = performance.now();

  // 方式 1: 检查 Middleware 预验证的 header
  const headerUserId = request.headers.get("x-user-id");
  const isVerified = request.headers.get("x-user-verified") === "true";

  if (isVerified && headerUserId) {
    const duration = performance.now() - startTime;
    // 快速路径：直接使用 Middleware 验证的结果
    return {
      user: null, // Middleware 模式下不返回完整 user 对象
      userId: headerUserId,
      error: null,
      method: "header",
      duration,
    };
  }

  // 方式 2: 检查 Authorization header（Token 验证）
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      const duration = performance.now() - startTime;

      if (error) {
        logger.warn(
          { error: error.message },
          "[Auth] Token verification failed",
        );
        return {
          user: null,
          userId: null,
          error: new Error(error.message),
          method: "token",
          duration,
        };
      }

      if (duration > 500) {
        logger.warn(
          { duration: duration.toFixed(2) },
          "[Auth] Slow token verification",
        );
      }

      return {
        user,
        userId: user?.id ?? null,
        error: null,
        method: "token",
        duration,
      };
    } catch (err) {
      const duration = performance.now() - startTime;
      return {
        user: null,
        userId: null,
        error: err instanceof Error ? err : new Error(String(err)),
        method: "token",
        duration,
      };
    }
  }

  // 方式 3: 回退到 Cookie 验证（完整认证）
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const duration = performance.now() - startTime;

    if (duration > 500) {
      logger.warn({ duration: duration.toFixed(2) }, "[Auth] Slow cookie auth");
    }

    if (error) {
      return {
        user: null,
        userId: null,
        error: new Error(error.message),
        method: "cookie",
        duration,
      };
    }

    return {
      user,
      userId: user?.id ?? null,
      error: null,
      method: "cookie",
      duration,
    };
  } catch (err) {
    const duration = performance.now() - startTime;
    return {
      user: null,
      userId: null,
      error: err instanceof Error ? err : new Error(String(err)),
      method: "none",
      duration,
    };
  }
}

/**
 * 创建未授权响应
 */
export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { message },
    },
    { status: 401 },
  );
}

/**
 * 快速获取 userId（优先使用快速路径）
 *
 * @example
 * const userId = await getUserId(request);
 * if (!userId) return unauthorizedResponse();
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  const { userId, error } = await withAuth(request);
  if (error) return null;
  return userId;
}

/**
 * 认证装饰器（用于包装 API 处理函数）
 *
 * @example
 * export const GET = withAuthHandler(async (request, { user, userId }) => {
 *   const bookmarks = await getBookmarks(userId);
 *   return NextResponse.json({ data: bookmarks });
 * });
 */
export function withAuthHandler<T extends NextResponse>(
  handler: (
    request: NextRequest,
    auth: { user: User | null; userId: string },
  ) => Promise<T>,
) {
  return async (request: NextRequest): Promise<T | NextResponse> => {
    const { user, userId, error } = await withAuth(request);

    if (error || !userId) {
      return unauthorizedResponse() as T;
    }

    return handler(request, { user, userId });
  };
}

export default withAuth;
