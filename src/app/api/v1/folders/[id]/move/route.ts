/**
 * Folder Move API v1
 *
 * POST /api/v1/folders/:id/move - 移动文件夹
 *
 * @module api/v1/folders/[id]/move
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FolderService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { MoveFolderSchema } from "@/contracts";

interface RouteParams {
  id: string;
}

/**
 * POST /api/v1/folders/:id/move
 *
 * 移动文件夹到新的父文件夹
 */
export const POST = withAuthMiddleware<RouteParams>(
  async (request, { userId, params }) => {
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

    const body = await validateBody(request, MoveFolderSchema);

    const supabase = await createClient();
    const service = new FolderService(supabase, userId);
    const folder = await service.move(folderId, body.targetParentId);

    return NextResponse.json({
      success: true,
      data: folder,
    });
  },
);
