/**
 * Bookmark Detail API v1
 *
 * GET    /api/v1/bookmarks/:id - 获取书签详情
 * PATCH  /api/v1/bookmarks/:id - 更新书签
 * DELETE /api/v1/bookmarks/:id - 删除书签
 *
 * @module api/v1/bookmarks/[id]
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BookmarkService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { UpdateBookmarkSchema } from "@/contracts";

interface RouteParams {
  id: string;
}

/**
 * GET /api/v1/bookmarks/:id
 *
 * 获取书签详情
 */
export const GET = withAuthMiddleware<RouteParams>(
  async (request, { userId, params }) => {
    const { id } = await params;
    const bookmarkId = parseInt(id, 10);

    if (isNaN(bookmarkId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION", message: "Invalid bookmark ID" },
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const service = new BookmarkService(supabase, userId);
    const bookmark = await service.getById(bookmarkId);

    return NextResponse.json(
      {
        success: true,
        data: bookmark,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    );
  },
);

/**
 * PATCH /api/v1/bookmarks/:id
 *
 * 更新书签
 */
export const PATCH = withAuthMiddleware<RouteParams>(
  async (request, { userId, params }) => {
    const { id } = await params;
    const bookmarkId = parseInt(id, 10);

    if (isNaN(bookmarkId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION", message: "Invalid bookmark ID" },
        },
        { status: 400 },
      );
    }

    const body = await validateBody(request, UpdateBookmarkSchema);

    const supabase = await createClient();
    const service = new BookmarkService(supabase, userId);
    const bookmark = await service.update(bookmarkId, body);

    return NextResponse.json({
      success: true,
      data: bookmark,
    });
  },
);

/**
 * DELETE /api/v1/bookmarks/:id
 *
 * 删除书签（软删除，移到回收站）
 */
export const DELETE = withAuthMiddleware<RouteParams>(
  async (request, { userId, params }) => {
    const { id } = await params;
    const bookmarkId = parseInt(id, 10);

    if (isNaN(bookmarkId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION", message: "Invalid bookmark ID" },
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const service = new BookmarkService(supabase, userId);
    await service.delete(bookmarkId);

    return new NextResponse(null, { status: 204 });
  },
);
