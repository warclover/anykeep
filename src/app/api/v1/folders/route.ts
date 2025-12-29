/**
 * Folders API v1 - List & Create
 *
 * GET  /api/v1/folders - 获取文件夹列表/树
 * POST /api/v1/folders - 创建文件夹
 *
 * @module api/v1/folders
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FolderService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { CreateFolderSchema } from "@/contracts";
import { z } from "zod";

// 查询参数 Schema
const FolderQuerySchema = z.object({
  view: z.enum(["list", "tree"]).default("list"),
  includeArchived: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default(false),
  includeSystem: z
    .string()
    .optional()
    .transform((v) => v !== "false")
    .default(true),
});

/**
 * GET /api/v1/folders
 *
 * 获取文件夹列表或树结构
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const searchParams = request.nextUrl.searchParams;
  const query = FolderQuerySchema.parse({
    view: searchParams.get("view") || "list",
    includeArchived: searchParams.get("includeArchived") || "false",
    includeSystem: searchParams.get("includeSystem") || "true",
  });

  const supabase = await createClient();
  const service = new FolderService(supabase, userId);

  if (query.view === "tree") {
    const result = await service.getTree();
    return NextResponse.json({
      success: true,
      data: result,
    });
  }

  const result = await service.list({
    includeArchived: query.includeArchived,
    includeSystem: query.includeSystem,
  });

  return NextResponse.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/v1/folders
 *
 * 创建新文件夹
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await validateBody(request, CreateFolderSchema);

  const supabase = await createClient();
  const service = new FolderService(supabase, userId);
  const folder = await service.create(body);

  return NextResponse.json(
    {
      success: true,
      data: folder,
    },
    { status: 201 },
  );
});
