/**
 * GET /api/folder-evolution/history
 * 获取用户的 AI 文件夹操作历史
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { operationLogService } from "@/lib/classification/services/server";
import type { OperationSnapshotAction } from "@/types/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const includeUndone = searchParams.get("includeUndone") === "true";
    const includeExpired = searchParams.get("includeExpired") === "true";
    const actionFilterParam = searchParams.get("action");

    // 解析操作类型过滤
    let actionFilter: OperationSnapshotAction[] | undefined;
    if (actionFilterParam) {
      actionFilter = actionFilterParam.split(",") as OperationSnapshotAction[];
    }

    // 获取操作历史
    const operations = await operationLogService.getOperationHistory(user.id, {
      limit: Math.min(limit, 100), // 最大 100 条
      includeUndone,
      includeExpired,
      actionFilter,
    });

    // 获取可撤销操作数量
    const undoableCount = await operationLogService.getUndoableCount(user.id);

    return NextResponse.json({
      success: true,
      data: {
        operations,
        undoableCount,
        total: operations.length,
      },
    });
  } catch (error) {
    console.error("[API] folder-evolution/history error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取操作历史失败",
      },
      { status: 500 },
    );
  }
}
