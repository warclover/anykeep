/**
 * 认证缓存优化模块
 * 解决 API 路由中重复调用 getUser() 导致的性能问题
 *
 * 优化策略：
 * 1. 使用 React cache() 实现请求级别缓存
 * 2. 同一请求内多次调用只执行一次实际验证
 *
 * 性能提升：避免 ~200ms 的重复认证延迟
 */

import { cache } from "react";
import { createClient } from "./server";
import type { User } from "@supabase/supabase-js";

/**
 * 认证结果类型
 */
interface AuthResult {
  user: User | null;
  error: Error | null;
}

/**
 * 缓存的认证函数（请求级别）
 *
 * 使用 React 的 cache() 函数确保在同一请求生命周期内
 * 多次调用只会执行一次实际的 getUser() 验证
 *
 * @example
 * // 在 API route 中使用
 * const { user, error } = await getCachedUser();
 * if (error || !user) {
 *   return unauthorizedError();
 * }
 */
export const getCachedUser = cache(async (): Promise<AuthResult> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return {
      user,
      error: error ? new Error(error.message) : null,
    };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err : new Error(String(err)),
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
