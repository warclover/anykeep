/**
 * 插件 OAuth 授权端点
 *
 * @description OAuth 2.0 授权码流程 - 第一步
 * 插件通过此端点获取授权码
 *
 * GET /api/auth/plugin/authorize
 * 参数：
 * - response_type: "code" (必需)
 * - client_id: "anykeep-extension" (必需)
 * - redirect_uri: 扩展回调 URL (必需)
 * - code_challenge: PKCE 挑战码 (必需)
 * - code_challenge_method: "S256" (必需)
 * - state: 防 CSRF 状态值 (必需)
 * - scope: 权限范围 (可选)
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  generateAuthorizationCode,
  isValidClientId,
  isValidExtensionRedirectUri,
  parseAndValidateScope,
  AUTH_CODE_EXPIRES_IN,
} from "@/lib/auth/plugin-oauth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // 解析参数
  const responseType = searchParams.get("response_type");
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");
  const state = searchParams.get("state");
  const scope = searchParams.get("scope") || "bookmarks:read bookmarks:write";

  // ============================================
  // 参数验证
  // ============================================

  // 验证 response_type
  if (responseType !== "code") {
    return createErrorRedirect(
      redirectUri,
      state,
      "unsupported_response_type",
      "Only 'code' response type is supported",
    );
  }

  // 验证 client_id
  if (!clientId || !isValidClientId(clientId)) {
    return createErrorRedirect(
      redirectUri,
      state,
      "invalid_client",
      "Invalid client_id",
    );
  }

  // 验证 redirect_uri
  if (!redirectUri || !isValidExtensionRedirectUri(redirectUri)) {
    // 如果 redirect_uri 无效，返回 JSON 错误（无法重定向）
    return NextResponse.json(
      { error: "invalid_request", error_description: "Invalid redirect_uri" },
      { status: 400 },
    );
  }

  // 验证 PKCE
  if (!codeChallenge || !codeChallengeMethod) {
    return createErrorRedirect(
      redirectUri,
      state,
      "invalid_request",
      "PKCE code_challenge and code_challenge_method are required",
    );
  }

  if (codeChallengeMethod !== "S256" && codeChallengeMethod !== "plain") {
    return createErrorRedirect(
      redirectUri,
      state,
      "invalid_request",
      "Only S256 and plain code_challenge_method are supported",
    );
  }

  // 验证 state
  if (!state) {
    return createErrorRedirect(
      redirectUri,
      state,
      "invalid_request",
      "state parameter is required",
    );
  }

  // ============================================
  // 检查用户认证状态
  // ============================================

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // 用户未登录，重定向到登录页面
      // 登录后会回到此授权流程
      const loginUrl = new URL("/login", request.nextUrl.origin);
      loginUrl.searchParams.set("next", request.nextUrl.toString());

      logger.info(
        { redirectUri, state },
        "Plugin OAuth: User not authenticated, redirecting to login",
      );

      return NextResponse.redirect(loginUrl);
    }

    // ============================================
    // 生成授权码
    // ============================================

    const authCode = generateAuthorizationCode();
    const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRES_IN);
    const validScopes = parseAndValidateScope(scope);

    // 存储授权码
    const serviceClient = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (serviceClient as any)
      .from("oauth_authorization_codes")
      .insert({
        code: authCode,
        user_id: user.id,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        redirect_uri: redirectUri,
        scope: validScopes.join(" "),
        state,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      logger.error(
        { error: insertError.message, userId: user.id },
        "Plugin OAuth: Failed to store authorization code",
      );
      return createErrorRedirect(
        redirectUri,
        state,
        "server_error",
        "Failed to generate authorization code",
      );
    }

    logger.info(
      { userId: user.id, redirectUri, scope: validScopes.join(" ") },
      "Plugin OAuth: Authorization code generated",
    );

    // ============================================
    // 重定向回扩展
    // ============================================

    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", authCode);
    callbackUrl.searchParams.set("state", state);

    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "Plugin OAuth: Authorization error");

    return createErrorRedirect(
      redirectUri,
      state,
      "server_error",
      "Internal server error",
    );
  }
}

/**
 * 创建错误重定向响应
 */
function createErrorRedirect(
  redirectUri: string | null,
  state: string | null,
  error: string,
  errorDescription: string,
): NextResponse {
  // 如果没有有效的 redirect_uri，返回 JSON
  if (!redirectUri) {
    return NextResponse.json(
      { error, error_description: errorDescription },
      { status: 400 },
    );
  }

  try {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    url.searchParams.set("error_description", errorDescription);
    if (state) {
      url.searchParams.set("state", state);
    }
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json(
      { error, error_description: errorDescription },
      { status: 400 },
    );
  }
}
