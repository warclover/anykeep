/**
 * API 认证中间件
 * @description 服务端认证工具，支持 Token 验证和请求头验证
 * @version 1.1.0
 *
 * 性能优化：
 * - 优先使用本地 JWT 验证（~1-5ms）
 * - 支持从 Middleware 注入的 x-user-id header 快速验证
 * - 回退到 Supabase 网络验证（兼容现有代码）
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { User } from "@supabase/supabase-js";
import { verifyJwtLocally, extractAccessToken } from "@/lib/auth/jwt-verifier";

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

    // 优先使用本地 JWT 验证（~1-5ms）
    const localResult = await verifyJwtLocally(token);

    if (localResult.valid && !localResult.nearExpiry) {
      // 快速路径：本地验证成功且 Token 未即将过期
      const duration = performance.now() - startTime;
      // 构造简化 User 对象（与 getCachedUser 对齐，提供 email 等字段）
      if (!localResult.userId) {
        return {
          user: null,
          userId: null,
          error: new Error("JWT missing userId"),
          method: "token",
          duration: performance.now() - startTime,
        };
      }
      const localUser: User = {
        id: localResult.userId,
        email: localResult.payload?.email,
        app_metadata: localResult.payload?.app_metadata || {},
        user_metadata: localResult.payload?.user_metadata || {},
        aud: "authenticated",
        created_at: "",
      } as User;
      return {
        user: localUser,
        userId: localResult.userId,
        error: null,
        method: "token",
        duration,
      };
    }

    // 回退到 Supabase 网络验证（Token 即将过期或本地验证失败）
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
          {
            duration: duration.toFixed(2),
            reason: localResult.nearExpiry
              ? "token-near-expiry"
              : "local-verify-failed",
          },
          "[Auth] Slow token verification (fallback to network)",
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

    // 优先尝试从 Cookie 中提取 Token 并本地验证
    const cookieToken = extractAccessToken(request.cookies);
    if (cookieToken) {
      const localResult = await verifyJwtLocally(cookieToken);

      if (localResult.valid && !localResult.nearExpiry) {
        // 快速路径：本地验证成功且 Token 未即将过期
        const duration = performance.now() - startTime;
        if (!localResult.userId) {
          return {
            user: null,
            userId: null,
            error: new Error("JWT missing userId"),
            method: "cookie",
            duration: performance.now() - startTime,
          };
        }
        // 构造简化 User 对象（与 getCachedUser 对齐，提供 email 等字段）
        const localUser: User = {
          id: localResult.userId,
          email: localResult.payload?.email,
          app_metadata: localResult.payload?.app_metadata || {},
          user_metadata: localResult.payload?.user_metadata || {},
          aud: "authenticated",
          created_at: "",
        } as User;
        return {
          user: localUser,
          userId: localResult.userId,
          error: null,
          method: "cookie",
          duration,
        };
      }
    }

    // 回退到 Supabase 网络验证
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const duration = performance.now() - startTime;

    if (duration > 500) {
      logger.warn(
        {
          duration: duration.toFixed(2),
          reason: cookieToken ? "token-near-expiry" : "no-cookie-token",
        },
        "[Auth] Slow cookie auth (fallback to network)",
      );
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

export default withAuth;
