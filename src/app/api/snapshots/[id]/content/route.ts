/**
 * GET /api/snapshots/:id/content - 获取快照内容
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { snapshotService } from "@/lib/snapshot";
import type { SnapshotContentResponse } from "@/lib/snapshot";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. 验证用户认证
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "请先登录" },
        },
        { status: 401 },
      );
    }

    // 2. 解析快照 ID
    const { id } = await params;
    const snapshotId = parseInt(id, 10);

    if (isNaN(snapshotId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_ID", message: "无效的快照 ID" },
        },
        { status: 400 },
      );
    }

    // 3. 获取快照内容
    const content = await snapshotService.getSnapshotContent(
      user.id,
      snapshotId,
    );

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "快照不存在" },
        },
        { status: 404 },
      );
    }

    const response: SnapshotContentResponse = {
      success: true,
      data: content,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("NOT_COMPLETED")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_COMPLETED", message: "快照尚未完成" },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "获取内容失败" },
      },
      { status: 500 },
    );
  }
}
