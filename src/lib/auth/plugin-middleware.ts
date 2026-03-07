/**
 * 插件认证中间件
 *
 * @description 验证插件 JWT Token 并注入用户信息
 */

import { jwtVerify, type JWTPayload } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { supabaseEnv } from "@/lib/env";

// JWT 签名密钥（通过 env.ts 统一管理，pluginJwtSecret 会自动 fallback 到 jwtSecret）
const JWT_SECRET = new TextEncoder().encode(supabaseEnv.pluginJwtSecret);

/**
 * 扩展的 JWT Payload 类型
 */
export interface PluginJwtPayload extends JWTPayload {
  sub: string; // user_id
  jti: string; // JWT ID
  scope: string[]; // 权限范围
  browser?: string; // 浏览器类型
}

/**
 * 认证结果类型
 */
export interface PluginAuthResult {
  success: true;
  userId: string;
  jti: string;
  scope: string[];
  browser?: string;
}

export interface PluginAuthError {
  success: false;
  error: string;
  status: number;
}

export type PluginAuthResponse = PluginAuthResult | PluginAuthError;

/**
 * 验证插件 Bearer Token
 */
export async function verifyPluginAuth(
  request: NextRequest,
): Promise<PluginAuthResponse> {
  // 获取 Authorization header
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return {
      success: false,
      error: "Missing Authorization header",
      status: 401,
    };
  }

  // 验证 Bearer 格式
  if (!authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      error: "Invalid Authorization header format",
      status: 401,
    };
  }

  const token = authHeader.slice(7);

  try {
    // 验证 JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const pluginPayload = payload as PluginJwtPayload;

    // 验证必需字段
    if (!pluginPayload.sub || !pluginPayload.jti) {
      return {
        success: false,
        error: "Invalid token payload",
        status: 401,
      };
    }

    // 验证 JTI 是否有效（未被撤销）
    const serviceClient = await createServiceClient();
    const { data: authorization, error: fetchError } =
      (await // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 类型推断限制
      (serviceClient as any)
        .from("plugin_authorizations")
        .select("id, revoked_at")
        .eq("access_token_jti", pluginPayload.jti)
        .eq("user_id", pluginPayload.sub)
        .single()) as {
        data: { id: string; revoked_at: string | null } | null;
        error: Error | null;
      };

    if (fetchError || !authorization) {
      logger.warn(
        { jti: pluginPayload.jti },
        "Plugin Auth: Token not found in database",
      );
      return {
        success: false,
        error: "Token not found or has been revoked",
        status: 401,
      };
    }

    if (authorization.revoked_at) {
      logger.warn(
        { jti: pluginPayload.jti },
        "Plugin Auth: Token has been revoked",
      );
      return {
        success: false,
        error: "Token has been revoked",
        status: 401,
      };
    }

    return {
      success: true,
      userId: pluginPayload.sub,
      jti: pluginPayload.jti,
      scope: pluginPayload.scope || [],
      browser: pluginPayload.browser,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // JWT 验证错误
    if (errorMessage.includes("expired")) {
      return {
        success: false,
        error: "Token has expired",
        status: 401,
      };
    }

    logger.warn(
      { error: errorMessage },
      "Plugin Auth: Token verification failed",
    );
    return {
      success: false,
      error: "Invalid token",
      status: 401,
    };
  }
}

/**
 * 创建未授权响应
 */
export function createUnauthorizedResponse(error: string): NextResponse {
  return NextResponse.json(
    { error: "unauthorized", message: error },
    { status: 401 },
  );
}

/**
 * 检查 scope 权限
 */
export function hasScope(
  authResult: PluginAuthResult,
  requiredScope: string,
): boolean {
  return authResult.scope.includes(requiredScope);
}
