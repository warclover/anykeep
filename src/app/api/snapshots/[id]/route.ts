/**
 * GET /api/snapshots/:id - 获取快照详情
 * DELETE /api/snapshots/:id - 删除快照
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { snapshotService } from "@/lib/snapshot";
import type { SnapshotDetailResponse } from "@/lib/snapshot";

export const GET = withAuthMiddleware<{ id: string }>(
  async (_request: NextRequest, { userId, params }) => {
    // 解析快照 ID
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

    // 获取快照详情
    const snapshot = await snapshotService.getSnapshotById(userId, snapshotId);

    if (!snapshot) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "快照不存在" },
        },
        { status: 404 },
      );
    }

    // 检查是否过期
    if (snapshot.status === "expired") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "EXPIRED", message: "快照已过期" },
        },
        { status: 410 },
      );
    }

    // 构建响应
    const response: SnapshotDetailResponse = {
      success: true,
      data: {
        id: snapshot.id,
        bookmarkId: snapshot.bookmark_id,
        snapshotType: snapshot.snapshot_type,
        status: snapshot.status,
        readableTitle: snapshot.readable_title || undefined,
        readableExcerpt: snapshot.readable_excerpt || undefined,
        readableWordCount: snapshot.readable_word_count || undefined,
        readableByline: snapshot.readable_byline || undefined,
        fileSize: snapshot.file_size || undefined,
        capturedAt: snapshot.captured_at || undefined,
        errorMessage:
          snapshot.status === "failed"
            ? snapshot.error_message || undefined
            : undefined,
        retryCount:
          snapshot.status === "failed" ? snapshot.retry_count : undefined,
        createdAt: snapshot.created_at,
        updatedAt: snapshot.updated_at,
        expiresAt: snapshot.expires_at || undefined,
      },
    };

    return NextResponse.json(response);
  },
);

export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request: NextRequest, { userId, params }) => {
    // 解析快照 ID
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

    // 删除快照
    const deleted = await snapshotService.deleteSnapshot(userId, snapshotId);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "快照不存在或已删除" },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
