/**
 * Notion OAuth 授权发起端点
 *
 * @description 重定向用户到 Notion OAuth 授权页面
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID || "";
const NOTION_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/distribution/notion/callback`;

export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    // 检查环境变量
    if (!NOTION_CLIENT_ID) {
      return NextResponse.json(
        { error: "Notion Integration 未配置" },
        { status: 500 },
      );
    }

    const supabase = await createClient();

    // 生成 state 用于 CSRF 防护
    const state = crypto.randomUUID();

    // 存储 state 到数据库（5 分钟有效）
    const { error: stateError } = (await (
      supabase.from(
        "oauth_states",
      ) /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any
    ).insert({
      state,
      user_id: userId,
      provider: "notion",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })) as { error: { message: string } | null };

    if (stateError) {
      logger.error({ stateError }, "Failed to save OAuth state:");
      return NextResponse.json({ error: "授权初始化失败" }, { status: 500 });
    }

    // 构建 Notion OAuth URL
    const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    authUrl.searchParams.set("client_id", NOTION_CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("owner", "user");
    authUrl.searchParams.set("redirect_uri", NOTION_REDIRECT_URI);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  },
);
