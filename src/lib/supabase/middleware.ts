/**
 * Supabase 中间件客户端
 * @description 用于 Next.js Middleware 中的认证检查
 * @version V4.2.25 - 添加本地 JWT 验证优化
 *
 * 性能优化：
 * - 本地 JWT 验证：~1-5ms（新增）
 * - Supabase 网络验证：~1000-2000ms（仅在需要刷新时调用）
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";
import { supabaseEnv } from "@/lib/env";
import {
  verifyJwtLocally,
  extractAccessToken,
  type SupabaseJwtPayload,
} from "@/lib/auth/jwt-verifier";

/**
 * 更新会话响应类型
 */
interface UpdateSessionResult {
  supabaseResponse: NextResponse;
  user: { id: string; email?: string } | null;
  /** 认证方式：local（本地JWT）或 network（Supabase网络请求） */
  authMethod: "local" | "network" | "none";
  /** 认证耗时（毫秒） */
  authDuration: number;
  /** V5.2: JWT 验证诊断信息 */
  jwtDebug?: {
    hasToken: boolean;
    valid?: boolean;
    nearExpiry?: boolean;
    error?: string | null;
    verifyDuration?: number;
  };
}

/**
 * 更新会话并刷新 Token（优化版）
 *
 * 优化策略：
 * 1. 先尝试本地 JWT 验证（~1-5ms）
 * 2. 如果 Token 有效且未过期，直接返回用户信息
 * 3. 如果 Token 即将过期或无效，回退到 Supabase 网络验证
 *
 * @param request - Next.js 请求对象
 * @returns 响应和用户信息
 */
export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  const startTime = performance.now();

  let supabaseResponse = NextResponse.next({
    request,
  });

  // ============================================
  // Step 1: 尝试本地 JWT 验证（快速路径）
  // ============================================
  const accessToken = extractAccessToken(request.cookies);

  // V5.2 诊断：记录 token 提取和验证结果
  let jwtDebugInfo: {
    hasToken: boolean;
    valid?: boolean;
    nearExpiry?: boolean;
    error?: string | null;
    verifyDuration?: number;
  } = { hasToken: !!accessToken };

  if (accessToken) {
    const localResult = await verifyJwtLocally(accessToken);

    // 记录验证结果用于诊断
    jwtDebugInfo = {
      hasToken: true,
      valid: localResult.valid,
      nearExpiry: localResult.nearExpiry,
      error: localResult.error,
      verifyDuration: Math.round(localResult.duration),
    };

    // 本地验证成功且 Token 未即将过期
    if (localResult.valid && !localResult.nearExpiry && localResult.payload) {
      const authDuration = performance.now() - startTime;

      return {
        supabaseResponse,
        user: {
          id: localResult.payload.sub,
          email: localResult.payload.email,
        },
        authMethod: "local",
        authDuration,
        jwtDebug: jwtDebugInfo,
      };
    }

    // Token 即将过期时，会自动回退到 Supabase 网络验证进行刷新
  }

  // ============================================
  // Step 2: 回退到 Supabase 网络验证
  // ============================================
  const supabase = createServerClient<Database>(
    supabaseEnv.url,
    supabaseEnv.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 刷新会话（如果存在）
  // 重要：不要在 createServerClient 和 supabase.auth.getUser() 之间写任何逻辑
  // 一个简单的错误可能导致用户随机登出
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authDuration = performance.now() - startTime;

  return {
    supabaseResponse,
    user: user ? { id: user.id, email: user.email } : null,
    authMethod: user ? "network" : "none",
    authDuration,
    jwtDebug: jwtDebugInfo,
  };
}

/**
 * 仅进行本地 JWT 验证（不刷新 Token）
 * 适用于对性能要求极高的场景，如 API 路由
 *
 * @param request - Next.js 请求对象
 * @returns 用户信息（如果验证成功）
 */
export async function verifySessionLocally(
  request: NextRequest,
): Promise<{ userId: string; payload: SupabaseJwtPayload } | null> {
  const accessToken = extractAccessToken(request.cookies);

  if (!accessToken) {
    return null;
  }

  const result = await verifyJwtLocally(accessToken);

  if (result.valid && result.payload) {
    return {
      userId: result.payload.sub,
      payload: result.payload,
    };
  }

  return null;
}
