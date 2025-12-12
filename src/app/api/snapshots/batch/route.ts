/**
 * POST /api/snapshots/batch - 批量创建快照任务
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { snapshotService } from "@/lib/snapshot";
import type {
  BatchCreateSnapshotRequest,
  BatchCreateSnapshotResponse,
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
    const body: BatchCreateSnapshotRequest = await request.json();
    const { bookmarkIds, snapshotType } = body;

    if (
      !bookmarkIds ||
      !Array.isArray(bookmarkIds) ||
      bookmarkIds.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_REQUEST", message: "缺少 bookmarkIds 数组" },
        },
        { status: 400 },
      );
    }

    // 限制单次批量数量
    if (bookmarkIds.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_REQUEST", message: "单次最多创建 50 个快照" },
        },
        { status: 400 },
      );
    }

    // 3. 批量创建快照
    const result = await snapshotService.batchCreateSnapshots(
      user.id,
      bookmarkIds,
      { snapshotType },
    );

    const response: BatchCreateSnapshotResponse = {
      success: true,
      data: result,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

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
        error: { code: "INTERNAL_ERROR", message: "批量创建失败" },
      },
      { status: 500 },
    );
  }
}
