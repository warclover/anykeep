/**
 * GET /api/folder-evolution/snapshot/[id]
 * 获取操作快照详情
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { operationLogService } from "@/lib/classification/services/server";

export const GET = withAuthMiddleware<{ id: string }>(
  async (_request: NextRequest, { userId, params }) => {
    const { id: snapshotId } = await params;

    if (!snapshotId) {
      return NextResponse.json({ error: "缺少快照 ID" }, { status: 400 });
    }

    // 获取快照详情
    const snapshot = await operationLogService.getSnapshotById(
      userId,
      snapshotId,
    );

    if (!snapshot) {
      return NextResponse.json(
        {
          success: false,
          error: "操作记录不存在",
        },
        { status: 404 },
      );
    }

    // 计算是否可撤销 (expires_at 可能为 null)
    const expiresAtDate = snapshot.expires_at
      ? new Date(snapshot.expires_at)
      : new Date(0);
    const canUndo = !snapshot.is_undone && expiresAtDate > new Date();

    // 计算剩余时间
    const expiresAt = expiresAtDate;
    const now = new Date();
    const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor(
      (remainingMs % (1000 * 60 * 60)) / (1000 * 60),
    );

    return NextResponse.json({
      success: true,
      data: {
        ...snapshot,
        can_undo: canUndo,
        remaining_time: {
          hours: remainingHours,
          minutes: remainingMinutes,
          formatted:
            remainingHours > 0
              ? `${remainingHours}小时${remainingMinutes}分钟`
              : `${remainingMinutes}分钟`,
        },
      },
    });
  },
);
