/**
 * V4.2 文件夹重命名 API
 * GET /api/folder-evolution/rename - 获取重命名建议
 * POST /api/folder-evolution/rename - 执行重命名
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renameService } from "@/lib/classification/services/rename.service";

/**
 * GET - 获取文件夹重命名建议
 */
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

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    if (folderId) {
      // 分析单个文件夹
      const suggestion = await renameService.analyzeFolder(
        user.id,
        parseInt(folderId, 10),
      );

      return NextResponse.json({
        success: true,
        data: suggestion ? [suggestion] : [],
      });
    }

    // 分析所有文件夹
    const suggestions = await renameService.analyzeAllFolders(user.id, {
      limit,
      minBookmarks: 5,
    });

    return NextResponse.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error("[API] folder-evolution/rename GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取重命名建议失败",
      },
      { status: 500 },
    );
  }
}

/**
 * POST - 执行文件夹重命名
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { folderId, newName } = body;

    if (!folderId || !newName) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 },
      );
    }

    // 执行重命名
    const result = await renameService.executeRename(
      user.id,
      parseInt(folderId, 10),
      newName.trim(),
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: result.message,
        oldName: result.oldName,
        newName: result.newName,
        snapshotId: result.snapshotId,
      },
    });
  } catch (error) {
    console.error("[API] folder-evolution/rename POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "重命名失败",
      },
      { status: 500 },
    );
  }
}
