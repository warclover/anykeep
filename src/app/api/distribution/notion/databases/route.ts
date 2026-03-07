/**
 * Notion Databases 列表端点
 *
 * @description 获取用户 Notion 工作空间中的 Database 列表
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/distribution/utils/token-crypto";
import { withAuthMiddleware } from "@/lib/api/middleware";

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 获取加密的 Token
    // 类型断言: 手动维护类型文件时需要此断言
    type TokenRecordType = { access_token: string };
    const { data: tokenRecord, error: tokenError } = (await supabase
      .from("distribution_oauth_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .eq("provider", "notion")
      .single()) as unknown as {
      data: TokenRecordType | null;
      error: { message: string } | null;
    };

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ error: "Notion 未授权" }, { status: 401 });
    }

    // 解密 Token
    const accessToken = await decryptToken(tokenRecord.access_token);

    // 搜索用户可访问的 Databases
    const response = await fetch(`${NOTION_API_URL}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "object",
          value: "database",
        },
        page_size: 100,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || "获取 Database 列表失败" },
        { status: response.status },
      );
    }

    const data = await response.json();

    // 格式化返回数据
    const databases = data.results.map(
      (db: {
        id: string;
        title: { plain_text: string }[];
        icon: { emoji?: string; external?: { url: string } } | null;
        description: { plain_text: string }[];
      }) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || "Untitled",
        icon: db.icon?.emoji || db.icon?.external?.url || null,
        description: db.description?.[0]?.plain_text || "",
      }),
    );

    return NextResponse.json({ databases });
  },
);
