/**
 * 插件 OAuth Token 端点
 *
 * @description OAuth 2.0 Token 交换/刷新
 *
 * POST /api/auth/plugin/token
 *
 * Grant Type: authorization_code
 * - grant_type: "authorization_code" (必需)
 * - code: 授权码 (必需)
 * - code_verifier: PKCE verifier (必需)
 * - redirect_uri: 与授权请求相同 (必需)
 *
 * Grant Type: refresh_token
 * - grant_type: "refresh_token" (必需)
 * - refresh_token: 刷新令牌 (必需)
 */

import { NextResponse, type NextRequest } from "next/server";
import { SignJWT, type JWTPayload } from "jose";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifyCodeChallenge,
  generateRefreshToken,
  generateJti,
  hashToken,
  detectBrowser,
  createAccessTokenPayload,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  type BrowserType,
} from "@/lib/auth/plugin-oauth";
import { logger } from "@/lib/logger";

// JWT 签名密钥
const JWT_SECRET = new TextEncoder().encode(
  process.env.PLUGIN_JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    "fallback-secret-change-in-production",
);

// 授权码记录类型
interface OAuthAuthorizationCode {
  code: string;
  user_id: string;
  code_challenge: string;
  code_challenge_method: string;
  redirect_uri: string;
  scope: string | null;
  state: string;
  expires_at: string;
  used_at: string | null;
}

// 插件授权记录类型
interface PluginAuthorization {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  access_token_jti: string;
  browser: string;
  expires_at: string;
  revoked_at: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const grantType = body.grant_type;

    if (grantType === "authorization_code") {
      return handleAuthorizationCodeGrant(request, body);
    } else if (grantType === "refresh_token") {
      return handleRefreshTokenGrant(request, body);
    } else {
      return NextResponse.json(
        {
          error: "unsupported_grant_type",
          error_description:
            "Only authorization_code and refresh_token are supported",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "Plugin OAuth Token: Request error");

    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * 处理授权码交换
 */
async function handleAuthorizationCodeGrant(
  request: NextRequest,
  body: {
    code?: string;
    code_verifier?: string;
    redirect_uri?: string;
  },
): Promise<NextResponse> {
  const { code, code_verifier: codeVerifier, redirect_uri: redirectUri } = body;

  // 验证必需参数
  if (!code || !codeVerifier || !redirectUri) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "code, code_verifier, and redirect_uri are required",
      },
      { status: 400 },
    );
  }

  const serviceClient = await createServiceClient();

  // 查找授权码
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: authCode, error: fetchError } = (await (serviceClient as any)
    .from("oauth_authorization_codes")
    .select("*")
    .eq("code", code)
    .single()) as { data: OAuthAuthorizationCode | null; error: Error | null };

  if (fetchError || !authCode) {
    logger.warn(
      { code: code.substring(0, 10) + "..." },
      "Plugin OAuth Token: Invalid authorization code",
    );
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Invalid or expired authorization code",
      },
      { status: 400 },
    );
  }

  // 检查是否已使用
  if (authCode.used_at) {
    logger.warn(
      { codeId: authCode.code.substring(0, 10) },
      "Plugin OAuth Token: Authorization code already used",
    );
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Authorization code has already been used",
      },
      { status: 400 },
    );
  }

  // 检查是否过期
  if (new Date(authCode.expires_at) < new Date()) {
    logger.warn(
      { codeId: authCode.code.substring(0, 10) },
      "Plugin OAuth Token: Authorization code expired",
    );
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Authorization code has expired",
      },
      { status: 400 },
    );
  }

  // 验证 redirect_uri
  if (authCode.redirect_uri !== redirectUri) {
    logger.warn(
      { expected: authCode.redirect_uri, received: redirectUri },
      "Plugin OAuth Token: redirect_uri mismatch",
    );
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "redirect_uri does not match",
      },
      { status: 400 },
    );
  }

  // 验证 PKCE
  const method = authCode.code_challenge_method as "S256" | "plain";
  if (!verifyCodeChallenge(codeVerifier, authCode.code_challenge, method)) {
    logger.warn(
      { userId: authCode.user_id },
      "Plugin OAuth Token: PKCE verification failed",
    );
    return NextResponse.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400 },
    );
  }

  // 标记授权码为已使用
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient as any)
    .from("oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code);

  // 生成 Token
  const userAgent = request.headers.get("user-agent") || "";
  const browser = detectBrowser(userAgent);
  const scope = authCode.scope?.split(" ") || [
    "bookmarks:read",
    "bookmarks:write",
  ];

  const tokens = await generateTokenPair(
    serviceClient,
    authCode.user_id,
    browser,
    userAgent,
    scope,
    request.headers.get("x-extension-version") || undefined,
  );

  if (!tokens) {
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to generate tokens" },
      { status: 500 },
    );
  }

  // 获取用户信息
  const { data: user } = await serviceClient.auth.admin.getUserById(
    authCode.user_id,
  );

  logger.info(
    { userId: authCode.user_id, browser },
    "Plugin OAuth Token: Tokens issued via authorization_code",
  );

  return NextResponse.json({
    access_token: tokens.accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_EXPIRES_IN,
    refresh_token: tokens.refreshToken,
    scope: scope.join(" "),
    user: user?.user
      ? {
          id: user.user.id,
          email: user.user.email,
          nickname: user.user.user_metadata?.nickname,
        }
      : undefined,
  });
}

/**
 * 处理刷新令牌
 */
async function handleRefreshTokenGrant(
  request: NextRequest,
  body: { refresh_token?: string },
): Promise<NextResponse> {
  const { refresh_token: refreshToken } = body;

  if (!refreshToken) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "refresh_token is required",
      },
      { status: 400 },
    );
  }

  const serviceClient = await createServiceClient();
  const tokenHash = hashToken(refreshToken);

  // 查找并验证 refresh token
  const { data: authorization, error: fetchError } =
    (await // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 类型推断限制
    (serviceClient as any)
      .from("plugin_authorizations")
      .select("*")
      .eq("refresh_token_hash", tokenHash)
      .is("revoked_at", null)
      .single()) as { data: PluginAuthorization | null; error: Error | null };

  if (fetchError || !authorization) {
    logger.warn(
      { tokenHash: tokenHash.substring(0, 16) + "..." },
      "Plugin OAuth Token: Invalid refresh token",
    );
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Invalid or revoked refresh token",
      },
      { status: 400 },
    );
  }

  // 检查是否过期
  if (new Date(authorization.expires_at) < new Date()) {
    logger.warn(
      { authId: authorization.id },
      "Plugin OAuth Token: Refresh token expired",
    );
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Refresh token has expired",
      },
      { status: 400 },
    );
  }

  // 生成新的 Access Token
  const jti = generateJti();
  const userAgent = request.headers.get("user-agent") || "";
  const browser =
    (authorization.browser as BrowserType) || detectBrowser(userAgent);
  const scope = ["bookmarks:read", "bookmarks:write"]; // 默认 scope

  const payload = createAccessTokenPayload(
    authorization.user_id,
    jti,
    scope,
    browser,
  );

  const accessToken = await new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_EXPIRES_IN}s`)
    .sign(JWT_SECRET);

  // 更新授权记录
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient as any)
    .from("plugin_authorizations")
    .update({
      access_token_jti: jti,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", authorization.id);

  logger.info(
    { userId: authorization.user_id, authId: authorization.id },
    "Plugin OAuth Token: Access token refreshed",
  );

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_EXPIRES_IN,
    scope: scope.join(" "),
  });
}

/**
 * 生成 Token 对（Access Token + Refresh Token）
 */
async function generateTokenPair(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  browser: BrowserType,
  userAgent: string,
  scope: string[],
  extensionVersion?: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const jti = generateJti();
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);

    // 创建 Access Token
    const payload = createAccessTokenPayload(userId, jti, scope, browser);

    const accessToken = await new SignJWT(payload as JWTPayload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_EXPIRES_IN}s`)
      .sign(JWT_SECRET);

    // 计算 Refresh Token 过期时间
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000);

    // 存储授权记录
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (serviceClient as any)
      .from("plugin_authorizations")
      .insert({
        user_id: userId,
        refresh_token_hash: refreshTokenHash,
        access_token_jti: jti,
        browser,
        extension_version: extensionVersion,
        user_agent: userAgent.substring(0, 500), // 限制长度
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      logger.error(
        { error: insertError.message, userId },
        "Plugin OAuth Token: Failed to store authorization",
      );
      return null;
    }

    return { accessToken, refreshToken };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage, userId },
      "Plugin OAuth Token: Token generation failed",
    );
    return null;
  }
}
