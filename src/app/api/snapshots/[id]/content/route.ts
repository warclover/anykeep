/**
 * GET /api/snapshots/:id/content - 获取快照内容
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { snapshotService } from "@/lib/snapshot";
import type { SnapshotContentResponse } from "@/lib/snapshot";

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

    // 获取快照内容
    const content = await snapshotService.getSnapshotContent(
      userId,
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
  },
);
