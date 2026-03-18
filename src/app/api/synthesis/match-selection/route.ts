/**
 * GET /api/synthesis/match-selection
 * 按书签集合匹配已完成的「快速对比」综述（selection + quick + comparison）
 *
 * @version 1.0.0
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";

function sortedBookmarkKey(ids: number[]): string {
  return [...new Set(ids)]
    .map((n) => Math.floor(Number(n)))
    .filter((n) => n > 0 && Number.isFinite(n))
    .sort((a, b) => a - b)
    .join(",");
}

export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const raw = request.nextUrl.searchParams.get("bookmarkIds") || "";
    const parts = raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    const unique = [...new Set(parts)];

    if (unique.length !== 3) {
      return NextResponse.json(
        {
          success: false,
          error: "bookmarkIds 需为 3 个不同的收藏 ID（逗号分隔）",
        },
        { status: 400 },
      );
    }

    const targetKey = sortedBookmarkKey(unique);
    const supabase = await createClient();

    const { data: owned, error: ownErr } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", userId)
      .in("id", unique);

    if (ownErr || !owned || owned.length !== 3) {
      return NextResponse.json(
        { success: false, error: "无权访问或未找到对应收藏" },
        { status: 403 },
      );
    }

    const { data: rows, error } = await supabase
      .from("synthesis_reports")
      .select(
        "id, title, overview, divergence, consensus, source_bookmark_ids, completed_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("source_type", "selection")
      .eq("depth_mode", "quick")
      .eq("output_style", "comparison")
      .eq("status", "completed")
      .not("source_bookmark_ids", "is", null)
      .order("completed_at", { ascending: false })
      .limit(100);

    if (error) {
      logger.error({ error }, "[match-selection] query failed");
      return NextResponse.json(
        { success: false, error: "查询失败" },
        { status: 500 },
      );
    }

    for (const row of rows || []) {
      const sb = (row.source_bookmark_ids as number[] | null) || [];
      if (sortedBookmarkKey(sb) !== targetKey) continue;
      if (!row.overview?.trim()) continue;

      return NextResponse.json({
        success: true,
        data: {
          id: row.id,
          title: row.title,
          overview: row.overview,
          divergence: row.divergence ?? [],
          consensus: row.consensus ?? [],
          completedAt: row.completed_at ?? row.updated_at,
        },
      });
    }

    return NextResponse.json({ success: true, data: null });
  },
);
