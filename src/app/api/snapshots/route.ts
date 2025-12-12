/**
 * POST /api/snapshots - 创建快照任务
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { snapshotService } from "@/lib/snapshot";
import type {
  CreateSnapshotRequest,
  CreateSnapshotResponse,
} from "@/lib/snapshot";

export async function POST(request: NextRequest) {
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

    // 2. 解析请求体
    const body: CreateSnapshotRequest = await request.json();
    const { bookmarkId, snapshotType, priority } = body;

    if (!bookmarkId || typeof bookmarkId !== "number") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_REQUEST", message: "缺少 bookmarkId" },
        },
        { status: 400 },
      );
    }

    // 3. 调用服务创建快照
    const result = await snapshotService.createSnapshot(user.id, bookmarkId, {
      snapshotType,
      priority,
    });

    const response: CreateSnapshotResponse = {
      success: true,
      data: result,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // 解析错误类型
    if (message.includes("BOOKMARK_NOT_FOUND")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BOOKMARK_NOT_FOUND", message: "书签不存在" },
        },
        { status: 404 },
      );
    }

    if (message.includes("ALREADY_EXISTS")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ALREADY_EXISTS", message: "该书签已有快照" },
        },
        { status: 409 },
      );
    }

    if (message.includes("QUOTA_EXCEEDED")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUOTA_EXCEEDED", message: "快照配额已满" },
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "创建快照失败" },
      },
      { status: 500 },
    );
  }
}
