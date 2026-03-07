/**
 * POST /api/snapshots/batch - 批量创建快照任务
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { snapshotService } from "@/lib/snapshot";
import type {
  BatchCreateSnapshotRequest,
  BatchCreateSnapshotResponse,
} from "@/lib/snapshot";

export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 解析请求体
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

    // 批量创建快照
    const result = await snapshotService.batchCreateSnapshots(
      userId,
      bookmarkIds,
      { snapshotType },
    );

    const response: BatchCreateSnapshotResponse = {
      success: true,
      data: result,
    };

    return NextResponse.json(response, { status: 201 });
  },
);
