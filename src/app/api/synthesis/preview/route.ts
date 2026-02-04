/**
 * 综述书签预览 API
 *
 * GET /api/synthesis/preview - 获取待综述的书签列表
 *
 * 查询参数:
 * - sourceType: 'folder' | 'tag' | 'selection'
 * - sourceId: 文件夹 ID 或标签名
 * - bookmarkIds: 逗号分隔的书签 ID 列表（selection 模式）
 * - page: 页码（默认 1）
 * - pageSize: 每页数量（默认 20，最大 50）
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { SynthesisSourceType } from "@/lib/synthesis";
import type { BookmarkRow as BaseBookmarkRow } from "@/types/domain";

interface PreviewBookmark {
  id: number;
  title: string;
  url: string;
  platform: string | null;
  ai_summary: string | null;
  created_at: string;
  folder_id: number | null;
  folder_name: string | null;
}

/**
 * 数据库返回的书签行类型（包含关联查询的 folders）
 */
type BookmarkRowWithFolder = Pick<
  BaseBookmarkRow,
  | "id"
  | "title"
  | "url"
  | "platform"
  | "ai_summary"
  | "created_at"
  | "folder_id"
> & {
  folders: { name: string } | null;
};

interface PreviewResponse {
  bookmarks: PreviewBookmark[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  contentStats: {
    totalCount: number;
    withSummary: number;
    avgSummaryLength: number;
    platforms: Record<string, number>;
  };
}

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

/**
 * GET /api/synthesis/preview - 获取待综述的书签列表
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const sourceType = searchParams.get("sourceType") as SynthesisSourceType;
    const sourceId = searchParams.get("sourceId");
    const bookmarkIdsParam = searchParams.get("bookmarkIds");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10),
    );

    if (!sourceType) {
      return NextResponse.json(
        { error: "sourceType is required" },
        { status: 400 },
      );
    }

    // 根据来源类型构建查询
    let query = supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        url,
        platform,
        ai_summary,
        created_at,
        folder_id,
        folders!bookmarks_folder_id_fkey(name)
      `,
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .is("deleted_at", null);

    // 根据来源类型添加过滤条件
    if (sourceType === "folder" && sourceId) {
      query = query.eq("folder_id", parseInt(sourceId, 10));
    } else if (sourceType === "tag" && sourceId) {
      // 标签查询需要关联 bookmark_tags 表
      // 类型断言: 手动维护类型文件时需要此断言
      type TaggedBookmarkRow = { bookmark_id: number };
      const { data: taggedBookmarkIds } = (await (
        supabase.from("bookmark_tags") as any
      ) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select("bookmark_id")
        .eq("user_id", user.id)
        .eq("tag_name", sourceId)) as { data: TaggedBookmarkRow[] | null };

      if (!taggedBookmarkIds || taggedBookmarkIds.length === 0) {
        return NextResponse.json({
          bookmarks: [],
          pagination: { page, pageSize, total: 0, hasMore: false },
          contentStats: {
            totalCount: 0,
            withSummary: 0,
            avgSummaryLength: 0,
            platforms: {},
          },
        });
      }

      query = query.in(
        "id",
        taggedBookmarkIds.map((t) => t.bookmark_id),
      );
    } else if (sourceType === "selection" && bookmarkIdsParam) {
      const bookmarkIds = bookmarkIdsParam
        .split(",")
        .map((id) => parseInt(id, 10));
      query = query.in("id", bookmarkIds);
    }

    // 排序和分页
    query = query
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error({ error }, "Failed to fetch preview bookmarks");
      return NextResponse.json(
        { error: "Failed to fetch bookmarks" },
        { status: 500 },
      );
    }

    // 转换数据格式
    const bookmarks: PreviewBookmark[] = (
      (data || []) as BookmarkRowWithFolder[]
    ).map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      platform: row.platform,
      ai_summary: row.ai_summary,
      created_at: row.created_at || new Date().toISOString(),
      folder_id: row.folder_id,
      folder_name: row.folders?.name || null,
    }));

    // 计算内容统计
    const withSummary = bookmarks.filter(
      (b) => b.ai_summary && b.ai_summary.length > 0,
    );
    const totalSummaryLength = withSummary.reduce(
      (sum, b) => sum + (b.ai_summary?.length || 0),
      0,
    );
    const platforms: Record<string, number> = {};
    bookmarks.forEach((b) => {
      const platform = b.platform || "unknown";
      platforms[platform] = (platforms[platform] || 0) + 1;
    });

    const response: PreviewResponse = {
      bookmarks,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        hasMore: (count || 0) > page * pageSize,
      },
      contentStats: {
        totalCount: count || 0,
        withSummary: withSummary.length,
        avgSummaryLength:
          withSummary.length > 0
            ? Math.round(totalSummaryLength / withSummary.length)
            : 0,
        platforms,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Synthesis preview API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
