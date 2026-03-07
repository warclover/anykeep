/**
 * V4.2 文件夹重命名 API
 * GET /api/folder-evolution/rename - 获取重命名建议
 * POST /api/folder-evolution/rename - 执行重命名
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { renameService } from "@/lib/classification/services/rename.service";
import { safeParseJson, safeParseInt } from "@/lib/utils/api-response";

/**
 * GET - 获取文件夹重命名建议
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const folderIdParam = searchParams.get("folderId");
    const limit = safeParseInt(searchParams.get("limit"), 5) || 5;

    if (folderIdParam) {
      const folderId = safeParseInt(folderIdParam);
      if (folderId === null) {
        return NextResponse.json({ error: "无效的文件夹 ID" }, { status: 400 });
      }
      // 分析单个文件夹
      const suggestion = await renameService.analyzeFolder(userId, folderId);

      return NextResponse.json({
        success: true,
        data: suggestion ? [suggestion] : [],
      });
    }

    // 分析所有文件夹
    const suggestions = await renameService.analyzeAllFolders(userId, {
      limit,
      minBookmarks: 5,
    });

    return NextResponse.json({
      success: true,
      data: suggestions,
    });
  },
);

/**
 * POST - 执行文件夹重命名
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const { data: body, error: parseError } = await safeParseJson(request);
    if (parseError || !body) {
      return NextResponse.json(
        { error: parseError || "请求体格式错误" },
        { status: 400 },
      );
    }
    const { folderId: folderIdRaw, newName } = body as {
      folderId?: string | number;
      newName?: string;
    };

    if (folderIdRaw === undefined || !newName) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 解析 folderId
    const folderId =
      typeof folderIdRaw === "number"
        ? folderIdRaw
        : safeParseInt(String(folderIdRaw));

    if (folderId === null) {
      return NextResponse.json({ error: "无效的文件夹 ID" }, { status: 400 });
    }

    // 执行重命名
    const result = await renameService.executeRename(
      userId,
      folderId,
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
  },
);
