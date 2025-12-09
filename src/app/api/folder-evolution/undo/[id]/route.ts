/**
 * POST /api/folder-evolution/undo/[id]
 * 执行撤销操作
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operationLogService } from "@/lib/classification/services/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createServerSupabaseClient();
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
      return NextResponse.json({ error: "缺少操作 ID" }, { status: 400 });
    }

    // 执行撤销操作
    const result = await operationLogService.undoOperation(user.id, snapshotId);

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
  } catch (error) {
    console.error("[API] folder-evolution/undo error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "撤销操作失败",
      },
      { status: 500 },
    );
  }
}
