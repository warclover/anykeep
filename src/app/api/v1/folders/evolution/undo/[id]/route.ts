/**
 * Folder Evolution Undo API v1
 *
 * POST /api/v1/folders/evolution/undo/[id] - 撤销文件夹操作
 *
 * @module api/v1/folders/evolution/undo/[id]
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { operationLogService } from "@/lib/classification/services/server";

interface RouteParams {
  id: string;
}

/**
 * POST /api/v1/folders/evolution/undo/:id
 * 撤销指定的文件夹操作
 */
export const POST = withAuthMiddleware<RouteParams>(
  async (_request: NextRequest, { userId, params }) => {
    const { id: snapshotId } = await params;

    if (!snapshotId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "缺少操作 ID" },
        },
        { status: 400 },
      );
    }

    try {
      // 执行撤销操作
      const result = await operationLogService.undoOperation(
        userId,
        snapshotId,
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "UNDO_FAILED", message: result.message },
          },
          { status: 400 },
        );
      }

      logger.info(
        {
          userId,
          snapshotId,
          restoredFolders: result.restoredFolders,
          restoredBookmarks: result.restoredBookmarks,
        },
        "[v1] Folder operation undone",
      );

      return NextResponse.json({
        success: true,
        data: {
          message: result.message,
          restoredFolders: result.restoredFolders,
          restoredBookmarks: result.restoredBookmarks,
        },
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          snapshotId,
        },
        "[v1] Folder undo failed",
      );

      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "撤销操作失败" },
        },
        { status: 500 },
      );
    }
  },
);
