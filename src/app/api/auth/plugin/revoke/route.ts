/**
 * 插件 OAuth 撤销端点
 *
 * POST /api/auth/plugin/revoke
 *
 * 撤销当前 Access Token 对应的授权
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifyPluginAuth,
  createUnauthorizedResponse,
} from "@/lib/auth/plugin-middleware";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  // 验证认证
  const authResult = await verifyPluginAuth(request);

  if (!authResult.success) {
    return createUnauthorizedResponse(authResult.error);
  }

  try {
    const serviceClient = await createServiceClient();

    // 撤销当前 Token 对应的授权
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (serviceClient as any)
      .from("plugin_authorizations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("access_token_jti", authResult.jti)
      .eq("user_id", authResult.userId);

    if (updateError) {
      logger.error(
        { error: updateError.message, userId: authResult.userId },
        "Plugin OAuth Revoke: Failed to revoke",
      );
      return NextResponse.json(
        { error: "server_error", message: "Failed to revoke token" },
        { status: 500 },
      );
    }

    logger.info(
      { userId: authResult.userId, jti: authResult.jti },
      "Plugin OAuth Revoke: Token revoked",
    );

    return NextResponse.json({
      success: true,
      message: "Token revoked successfully",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "Plugin OAuth Revoke: Error");

    return NextResponse.json(
      { error: "server_error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
