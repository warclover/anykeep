/**
 * OAuth 回调路由
 * 处理第三方登录（微信、Google 等）和邮箱验证的回调
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/home";
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // 处理 OAuth 错误
  if (error) {
    logger.error({ error, errorDescription }, "OAuth error");
    const errorUrl = new URL("/login", requestUrl.origin);
    errorUrl.searchParams.set("error", error);
    if (errorDescription) {
      errorUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(errorUrl);
  }

  // 如果有授权码，交换 session
  if (code) {
    try {
      const supabase = await createClient();
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        logger.error({ error: exchangeError }, "Code exchange error");
        const errorUrl = new URL("/login", requestUrl.origin);
        errorUrl.searchParams.set("error", "auth_error");
        errorUrl.searchParams.set("error_description", exchangeError.message);
        return NextResponse.redirect(errorUrl);
      }

      // 成功，重定向到目标页面
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    } catch (err) {
      logger.error({ error: err }, "Callback error");
      const errorUrl = new URL("/login", requestUrl.origin);
      errorUrl.searchParams.set("error", "unknown_error");
      return NextResponse.redirect(errorUrl);
    }
  }

  // 没有 code 参数，重定向到登录页
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
