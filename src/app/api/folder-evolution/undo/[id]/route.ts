/**
 * POST /api/folder-evolution/undo/[id]
 * 执行撤销操作
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { operationLogService } from "@/lib/operation-log";

export const POST = withAuthMiddleware<{ id: string }>(
  async (_request: NextRequest, { userId, params }) => {
    const { id: snapshotId } = await params;

    if (!snapshotId) {
      return NextResponse.json({ error: "缺少操作 ID" }, { status: 400 });
    }

    // 执行撤销操作
    const result = await operationLogService.undoOperation(userId, snapshotId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: result.message,
        restoredFolders: result.restoredFolders,
        restoredBookmarks: result.restoredBookmarks,
      },
    });
  },
);
