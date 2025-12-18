/**
 * 认证缓存优化模块
 * @version V4.2.8 - 集成本地 JWT 验证优化
 *
 * 优化策略：
 * 1. 使用 React cache() 实现请求级别缓存
 * 2. 优先使用本地 JWT 验证（~1-5ms）
 * 3. 仅在必要时回退到 Supabase 网络验证（~1000-2000ms）
 *
 * 性能提升：
 * - 优化前：每次 ~1000-2000ms（网络请求）
 * - 优化后：大多数请求 ~1-5ms（本地验证）
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "./server";
import type { User } from "@supabase/supabase-js";
import { verifyJwtLocally, extractAccessToken } from "@/lib/auth/jwt-verifier";

/**
 * 认证结果类型
 */
interface AuthResult {
  user: User | null;
  error: Error | null;
  /** 认证方式：local（本地JWT）或 network（Supabase网络请求） */
  authMethod?: "local" | "network";
  /** 认证耗时（毫秒） */
  authDuration?: number;
}

/**
 * 缓存的认证函数（请求级别）
 *
 * 优化策略：
 * 1. 先尝试本地 JWT 验证（~1-5ms）
 * 2. 如果 Token 有效且未即将过期，直接返回用户信息
 * 3. 如果 Token 即将过期或本地验证失败，回退到 Supabase 网络验证
 *
 * @example
 * // 在 API route 中使用
 * const { user, error } = await getCachedUser();
 * if (error || !user) {
 *   return unauthorizedError();
 * }
 */
export const getCachedUser = cache(async (): Promise<AuthResult> => {
  const startTime = performance.now();

  try {
    // ============================================
    // Step 1: 尝试本地 JWT 验证（快速路径）
    // ============================================
    const cookieStore = await cookies();
    const accessToken = extractAccessToken(cookieStore);

    if (accessToken) {
      const localResult = await verifyJwtLocally(accessToken);

      // 本地验证成功且 Token 未即将过期
      if (localResult.valid && !localResult.nearExpiry && localResult.payload) {
        const authDuration = performance.now() - startTime;

        // 构造一个简化的 User 对象（本地验证无法获取完整 User）
        const localUser: User = {
          id: localResult.payload.sub,
          email: localResult.payload.email,
          app_metadata: localResult.payload.app_metadata || {},
          user_metadata: localResult.payload.user_metadata || {},
          aud: "authenticated",
          created_at: "",
        } as User;

        return {
          user: localUser,
          error: null,
          authMethod: "local",
          authDuration,
        };
      }

      // Token 即将过期或验证失败，回退到网络验证
    }

    // ============================================
    // Step 2: 回退到 Supabase 网络验证
    // ============================================
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const authDuration = performance.now() - startTime;

    return {
      user,
      error: error ? new Error(error.message) : null,
      authMethod: "network",
      authDuration,
    };
  } catch (err) {
    const authDuration = performance.now() - startTime;

    return {
      user: null,
      error: err instanceof Error ? err : new Error(String(err)),
      authMethod: "network",
      authDuration,
    };
  }
});

/**
 * 获取已验证的用户（带缓存）
 *
 * 这是 getCachedUser 的便捷包装，直接返回 user 或 null
 * 适用于只需要 user 对象的场景
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const { user } = await getCachedUser();
  return user;
}

/**
 * 验证用户是否已认证（带缓存）
 *
 * 快速检查用户是否已登录，适用于简单的认证检查
 */
export async function isAuthenticated(): Promise<boolean> {
  const { user, error } = await getCachedUser();
  return !error && user !== null;
}

/**
 * 获取用户 ID（带缓存）
 *
 * 常用场景：数据库查询中需要 user_id
 */
export async function getUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser();
  return user?.id ?? null;
}
