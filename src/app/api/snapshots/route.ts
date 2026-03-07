/**
 * Snapshots API
 * GET  /api/snapshots?bookmarkId=xxx - 获取书签的快照
 * POST /api/snapshots - 创建快照任务
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { snapshotService } from "@/lib/snapshot";
import type {
  CreateSnapshotRequest,
  CreateSnapshotResponse,
} from "@/lib/snapshot";

/**
 * GET /api/snapshots?bookmarkId=xxx
 * 获取指定书签的活跃快照
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
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
      userId,
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
  },
);

export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 解析请求体
    const body: CreateSnapshotRequest = await request.json();
    const { bookmarkId, snapshotType, priority, source, triggerTag } = body;

    if (!bookmarkId || typeof bookmarkId !== "number") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_REQUEST", message: "缺少 bookmarkId" },
        },
        { status: 400 },
      );
    }

    // 调用服务创建快照 (P2-010: 支持 source/triggerTag)
    const result = await snapshotService.createSnapshot(userId, bookmarkId, {
      snapshotType,
      priority,
      source: source || "manual",
      triggerTag: source === "auto-tag" ? triggerTag : undefined,
    });

    const response: CreateSnapshotResponse = {
      success: true,
      data: result,
    };

    return NextResponse.json(response, { status: 201 });
  },
);
