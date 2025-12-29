/**
 * Folder Path API v1
 *
 * GET /api/v1/folders/:id/path - 获取文件夹路径（面包屑）
 *
 * @module api/v1/folders/[id]/path
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FolderService } from "@/services";
import { withAuthMiddleware } from "@/lib/api/middleware";

interface RouteParams {
  id: string;
}

/**
 * GET /api/v1/folders/:id/path
 *
 * 获取从根到当前文件夹的路径
 */
export const GET = withAuthMiddleware<RouteParams>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const folderId = parseInt(id, 10);

    if (isNaN(folderId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION", message: "Invalid folder ID" },
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const service = new FolderService(supabase, userId);
    const result = await service.getPath(folderId);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    );
  },
);
