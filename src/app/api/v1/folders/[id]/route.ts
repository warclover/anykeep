/**
 * Folder Detail API v1
 *
 * GET    /api/v1/folders/:id - 获取文件夹详情
 * PATCH  /api/v1/folders/:id - 更新文件夹
 * DELETE /api/v1/folders/:id - 删除文件夹
 *
 * @module api/v1/folders/[id]
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FolderService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { UpdateFolderSchema } from "@/contracts";
import { z } from "zod";

interface RouteParams {
  id: string;
}

// 删除选项 Schema
const DeleteOptionsSchema = z.object({
  cascade: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default(false),
});

/**
 * GET /api/v1/folders/:id
 *
 * 获取文件夹详情
 */
export const GET = withAuthMiddleware<RouteParams>(
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

    const supabase = await createClient();
    const service = new FolderService(supabase, userId);
    const folder = await service.getById(folderId);

    return NextResponse.json({
      success: true,
      data: folder,
    });
  },
);

/**
 * PATCH /api/v1/folders/:id
 *
 * 更新文件夹
 */
export const PATCH = withAuthMiddleware<RouteParams>(
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

    const body = await validateBody(request, UpdateFolderSchema);

    const supabase = await createClient();
    const service = new FolderService(supabase, userId);
    const folder = await service.update(folderId, body);

    return NextResponse.json({
      success: true,
      data: folder,
    });
  },
);

/**
 * DELETE /api/v1/folders/:id
 *
 * 删除文件夹
 *
 * Query params:
 * - cascade: true 时级联删除子文件夹，移动书签到根目录
 */
export const DELETE = withAuthMiddleware<RouteParams>(
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

    const searchParams = request.nextUrl.searchParams;
    const options = DeleteOptionsSchema.parse({
      cascade: searchParams.get("cascade") || "false",
    });

    const supabase = await createClient();
    const service = new FolderService(supabase, userId);
    await service.delete(folderId, { cascade: options.cascade });

    return new NextResponse(null, { status: 204 });
  },
);
