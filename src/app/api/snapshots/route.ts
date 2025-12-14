/**
 * Snapshots API
 * GET  /api/snapshots?bookmarkId=xxx - 获取书签的快照
 * POST /api/snapshots - 创建快照任务
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import { snapshotService } from "@/lib/snapshot";
import type {
  CreateSnapshotRequest,
  CreateSnapshotResponse,
} from "@/lib/snapshot";

/**
 * GET /api/snapshots?bookmarkId=xxx
 * 获取指定书签的活跃快照
 */
export async function GET(request: NextRequest) {
  try {
    // 使用缓存认证，避免重复验证
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "请先登录" },
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const bookmarkIdStr = searchParams.get("bookmarkId");

    if (!bookmarkIdStr) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_REQUEST", message: "缺少 bookmarkId" },
        },
        { status: 400 },
      );
    }

    const bookmarkId = parseInt(bookmarkIdStr, 10);
    if (isNaN(bookmarkId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_REQUEST", message: "无效的 bookmarkId" },
        },
        { status: 400 },
      );
    }

    // 获取该书签的活跃快照
    const snapshot = await snapshotService.getActiveSnapshot(
      user.id,
      bookmarkId,
    );

    if (!snapshot) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: snapshot.id,
        status: snapshot.status,
        snapshotType: snapshot.snapshot_type,
        capturedAt: snapshot.captured_at,
        errorMessage: snapshot.error_message,
        readableTitle: snapshot.readable_title,
        readableWordCount: snapshot.readable_word_count,
      },
    });
  } catch (error) {
    console.error("[GET /api/snapshots] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "获取快照失败" },
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户认证（使用缓存认证，避免重复验证）
    const { user, error: authError } = await getCachedUser();

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
    console.error("[POST /api/snapshots] Error:", error);

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

    if (message.includes("INVALID_TYPE")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TYPE",
            message: message.split(": ")[1] || "快照类型不支持",
          },
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
