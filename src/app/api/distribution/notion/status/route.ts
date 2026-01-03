/**
 * Notion 连接状态检查端点
 *
 * @description 检查当前用户的 Notion 连接状态
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { connected: false, error: "未登录" },
      { status: 401 },
    );
  }

  // 查询 Notion Token
  // 类型断言: 手动维护类型文件时需要此断言
  type TokenRecordType = {
    workspace_id: string;
    workspace_name: string;
    workspace_icon: string | null;
    updated_at: string;
  };
  const { data: tokenRecord, error: tokenError } = await supabase
    .from("distribution_oauth_tokens")
    .select("workspace_id, workspace_name, workspace_icon, updated_at")
    .eq("user_id", user.id)
    .eq("provider", "notion")
    .single() as unknown as {
    data: TokenRecordType | null;
    error: { message: string } | null;
  };

  if (tokenError || !tokenRecord) {
    return NextResponse.json({
      connected: false,
    });
  }

  return NextResponse.json({
    connected: true,
    workspace: {
      id: tokenRecord.workspace_id,
      name: tokenRecord.workspace_name,
      icon: tokenRecord.workspace_icon,
    },
    connectedAt: tokenRecord.updated_at,
  });
}

/**
 * 断开 Notion 连接
 */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 删除 Token
  const { error: deleteError } = await supabase
    .from("distribution_oauth_tokens")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "notion");

  if (deleteError) {
    console.error("Failed to delete Notion token:", deleteError);
    return NextResponse.json({ error: "断开连接失败" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
