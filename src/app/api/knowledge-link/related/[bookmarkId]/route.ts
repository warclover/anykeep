/**
 * Knowledge Link - Related Bookmarks API
 *
 * GET /api/knowledge-link/related/[bookmarkId]
 * 获取书签的相关内容
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLinkService } from "@/lib/knowledge-link";
import type { LinkType } from "@/lib/knowledge-link";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

interface RouteParams {
  params: Promise<{
    bookmarkId: string;
  }>;
}

interface GetRelatedResponse {
  success: boolean;
  data?: {
    related: Array<{
      bookmark: {
        id: number;
        title: string;
        url: string;
        platform?: string;
      };
      link: {
        type: LinkType;
        strength: number;
        sharedItems: string[];
      };
    }>;
    totalCount: number;
  };
  error?: string;
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/knowledge-link/related/[bookmarkId]
 *
 * 获取书签的相关内容
 *
 * Query Parameters:
 * - limit: number (default: 10, max: 50)
 * - minStrength: number (default: 0.3, range: 0-1)
 * - types: string[] (comma-separated, e.g., "semantic,entity,tag")
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<GetRelatedResponse>> {
  try {
    // 1. 认证检查
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2. 解析路由参数
    const { bookmarkId: bookmarkIdStr } = await params;
    const bookmarkId = parseInt(bookmarkIdStr, 10);

    if (isNaN(bookmarkId)) {
      return NextResponse.json(
        { success: false, error: "Invalid bookmark ID" },
        { status: 400 },
      );
    }

    // 3. 验证书签所有权
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkOwnerRow = { id: number; user_id: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmark, error: bookmarkError } = await (supabase.from("bookmarks") as any)
      .select("id, user_id")
      .eq("id", bookmarkId)
      .single() as { data: BookmarkOwnerRow | null; error: { message: string } | null };

    if (bookmarkError || !bookmark) {
      return NextResponse.json(
        { success: false, error: "Bookmark not found" },
        { status: 404 },
      );
    }

    if (bookmark.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // 4. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
    const minStrength = Math.max(
      0,
      Math.min(1, parseFloat(searchParams.get("minStrength") || "0.3")),
    );
    const typesParam = searchParams.get("types");
    const types = typesParam
      ? (typesParam.split(",").filter(Boolean) as LinkType[])
      : undefined;

    // 5. 获取相关书签
    const linkService = getLinkService();
    const related = await linkService.getRelatedBookmarks(bookmarkId, user.id, {
      limit,
      minStrength,
      types,
    });

    return NextResponse.json({
      success: true,
      data: {
        related,
        totalCount: related.length,
      },
    });
  } catch (error) {
    logger.error({ error }, "[API] Failed to get related bookmarks");
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
