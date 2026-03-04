/**
 * Bookmarks API v1 - List & Create
 *
 * GET  /api/v1/bookmarks - 获取书签列表
 * POST /api/v1/bookmarks - 创建书签
 *
 * @module api/v1/bookmarks
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BookmarkService, IngestionService } from "@/services";
import {
  withAuthMiddleware,
  validateQuery,
  validateBody,
} from "@/lib/api/middleware";
import { BookmarkQuerySchema, CreateBookmarkSchema } from "@/contracts";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:v1:bookmarks");

/**
 * GET /api/v1/bookmarks
 *
 * 获取书签列表（分页、过滤、排序）
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const handlerStart = performance.now();
  const query = validateQuery(request, BookmarkQuerySchema);

  const supabase = await createClient();
  const service = new BookmarkService(supabase, userId);
  const result = await service.list(query);
  const handlerMs = Math.round(performance.now() - handlerStart);
  if (handlerMs > 1000) {
    logger.warn(
      { route: "GET /api/v1/bookmarks", handlerMs },
      "Slow bookmarks handler",
    );
  }
  return NextResponse.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/v1/bookmarks
 *
 * 创建新书签（通过 IngestionService 统一处理）
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await validateBody(request, CreateBookmarkSchema);

  const supabase = await createClient();
  const ingestionService = new IngestionService(supabase, userId);

  const result = await ingestionService.ingest({
    url: body.url,
    title: body.title,
    description: body.description,
    folderId: body.folderId,
    tags: body.tags,
    notes: body.notes,
    source: "api",
  });

  // 根据结果返回不同状态码
  const status = result.status === "duplicate" ? 409 : 201;

  return NextResponse.json(
    {
      success: result.status !== "duplicate",
      data: result,
    },
    { status },
  );
});
