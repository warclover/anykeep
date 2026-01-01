/**
 * Notion OAuth 回调端点
 *
 * @description 处理 Notion OAuth 回调，交换 Token 并存储
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  encryptToken,
  isEncryptionConfigured,
} from "@/lib/distribution/utils/token-crypto";

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID || "";
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET || "";
const NOTION_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/distribution/notion/callback`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_icon: string | null;
  owner: {
    type: string;
    user: {
      id: string;
      name: string;
      avatar_url: string | null;
    };
  };
  duplicated_template_id: string | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // 处理用户拒绝授权
  if (error) {
    return NextResponse.redirect(
      `${APP_URL}/distribution?error=${encodeURIComponent("Notion 授权被拒绝")}`,
    );
  }

  // 验证必要参数
  if (!code || !state) {
    return NextResponse.redirect(
      `${APP_URL}/distribution?error=${encodeURIComponent("授权参数无效")}`,
    );
  }

  // 检查环境变量
  if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET) {
    return NextResponse.redirect(
      `${APP_URL}/distribution?error=${encodeURIComponent("Notion Integration 未配置")}`,
    );
  }

  if (!isEncryptionConfigured()) {
    console.error("TOKEN_ENCRYPTION_KEY not configured");
    return NextResponse.redirect(
      `${APP_URL}/distribution?error=${encodeURIComponent("服务器配置错误")}`,
    );
  }

  const supabase = await createClient();

  // 验证 state（防止 CSRF）
  const { data: stateRecord, error: stateError } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state", state)
    .eq("provider", "notion")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (stateError || !stateRecord) {
    return NextResponse.redirect(
      `${APP_URL}/distribution?error=${encodeURIComponent("授权已过期，请重试")}`,
    );
  }

  // 交换 Token
  const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(
        `${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`,
      ).toString("base64")}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: NOTION_REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    console.error("Notion token exchange failed:", errorData);
    return NextResponse.redirect(
      `${APP_URL}/distribution?error=${encodeURIComponent("获取 Token 失败")}`,
    );
  }

  const tokenData: NotionTokenResponse = await tokenResponse.json();

  // 加密存储 Token
  const encryptedToken = await encryptToken(tokenData.access_token);

  // 存储/更新 Token
  const { error: upsertError } = await supabase
    .from("distribution_oauth_tokens")
    .upsert(
      {
        user_id: stateRecord.user_id,
        provider: "notion",
        access_token: encryptedToken,
        workspace_id: tokenData.workspace_id,
        workspace_name: tokenData.workspace_name,
        workspace_icon: tokenData.workspace_icon,
        bot_id: tokenData.bot_id,
        expires_at: null, // Notion Token 不过期
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider",
      },
    );

  if (upsertError) {
    console.error("Failed to save Notion token:", upsertError);
    return NextResponse.redirect(
      `${APP_URL}/distribution?error=${encodeURIComponent("保存 Token 失败")}`,
    );
  }

  // 清理 state
  await supabase.from("oauth_states").delete().eq("state", state);

  // 成功，重定向回分发页面
  return NextResponse.redirect(
    `${APP_URL}/distribution?success=notion&workspace=${encodeURIComponent(tokenData.workspace_name)}`,
  );
}
