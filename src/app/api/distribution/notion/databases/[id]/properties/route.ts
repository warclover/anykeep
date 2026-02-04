/**
 * Notion Database 属性端点
 *
 * @description 获取指定 Database 的属性列表
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/distribution/utils/token-crypto";
import { logger } from "@/lib/logger";

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: databaseId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 获取加密的 Token
  // 类型断言: 手动维护类型文件时需要此断言
  type TokenRecordType = { access_token: string };
  const { data: tokenRecord, error: tokenError } = (await supabase
    .from("distribution_oauth_tokens")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("provider", "notion")
    .single()) as unknown as {
    data: TokenRecordType | null;
    error: { message: string } | null;
  };

  if (tokenError || !tokenRecord) {
    return NextResponse.json({ error: "Notion 未授权" }, { status: 401 });
  }

  try {
    // 解密 Token
    const accessToken = await decryptToken(tokenRecord.access_token);

    // 获取 Database 信息
    const response = await fetch(`${NOTION_API_URL}/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": NOTION_VERSION,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || "获取 Database 属性失败" },
        { status: response.status },
      );
    }

    const database = await response.json();

    // 格式化属性列表
    const rawProperties = database.properties as
      | Record<string, { id: string; type: string }>
      | undefined;
    const properties = Object.entries(rawProperties || {}).map(
      ([name, prop]) => ({
        id: prop.id,
        name,
        type: prop.type,
      }),
    );

    // Database 基本信息
    const info = {
      id: database.id,
      title: database.title?.[0]?.plain_text || "Untitled",
      icon: database.icon?.emoji || database.icon?.external?.url || null,
    };

    return NextResponse.json({ database: info, properties });
  } catch (error) {
    logger.error({ error }, "Failed to fetch database properties:");
    return NextResponse.json(
      { error: "获取 Database 属性失败" },
      { status: 500 },
    );
  }
}
