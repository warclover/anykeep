/**
 * GET /api/folder-evolution/snapshot/[id]
 * 获取操作快照详情
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { operationLogService } from "@/lib/classification/services/server";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id: snapshotId } = await params;

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    if (!snapshotId) {
      return NextResponse.json({ error: "缺少快照 ID" }, { status: 400 });
    }

    // 获取快照详情
    const snapshot = await operationLogService.getSnapshotById(
      user.id,
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
  } catch (error) {
    logger.error({ error }, "[API] folder-evolution/snapshot error");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取快照详情失败",
      },
      { status: 500 },
    );
  }
}
