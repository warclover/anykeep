/**
 * 重复内容 API
 *
 * GET /api/health/duplicates - 获取重复内容分组
 * POST /api/health/duplicates - 批量处理重复内容
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// GET - 获取重复内容分组
// ============================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    // 获取重复内容记录（指定字段避免 select *，限制最大记录数防止内存溢出）
    const DUPLICATE_FETCH_LIMIT = 2000;
    const { data, error } = await supabase
      .from("health_check_cache")
      .select("id, bookmark_id, details, detected_at")
      .eq("user_id", user.id)
      .eq("check_type", "duplicate")
      .eq("status", "issue")
      .order("detected_at", { ascending: false })
      .limit(DUPLICATE_FETCH_LIMIT);

    if (error) {
      logger.error(
        { error: error.message, userId: user.id },
        "Duplicates API: Failed to fetch",
      );
      return NextResponse.json(
        { success: false, error: "获取重复内容失败" },
        { status: 500 },
      );
    }

    // 按 groupId 分组
    const groupMap = new Map<
      string,
      {
        id: string;
        similarity: number;
        matchType: string;
        items: Array<{
          bookmarkId: number | null;
          isRecommendedKeep: boolean;
        }>;
        recommendedKeepId: number | null;
        reason: string;
      }
    >();

    for (const row of data || []) {
      const details = row.details as Record<string, unknown>;
      const groupId = (details?.groupId as string) || row.id;

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          id: groupId,
          similarity: (details?.similarity as number) || 1,
          matchType: (details?.matchType as string) || "exact_url",
          items: [],
          recommendedKeepId: (details?.recommendedKeepId as number) || null,
          reason: (details?.reason as string) || "",
        });
      }

      const group = groupMap.get(groupId)!;
      group.items.push({
        bookmarkId: row.bookmark_id,
        isRecommendedKeep: row.bookmark_id === group.recommendedKeepId,
      });
    }

    // 获取书签详情
    const allBookmarkIds = Array.from(groupMap.values())
      .flatMap((g) => g.items.map((i) => i.bookmarkId))
      .filter((id): id is number => id !== null);

    const { data: bookmarks } = await supabase
      .from("bookmarks")
      .select("id, title, url, created_at, folder_id, folders!folder_id(name)")
      .in("id", allBookmarkIds);

    const bookmarkMap = new Map((bookmarks || []).map((b) => [b.id, b]));

    // 构建响应
    const groups = Array.from(groupMap.values())
      .slice((page - 1) * pageSize, page * pageSize)
      .map((group) => ({
        ...group,
        items: group.items.map((item) => {
          const bookmark =
            item.bookmarkId !== null
              ? bookmarkMap.get(item.bookmarkId)
              : undefined;
          const folder = bookmark?.folders as unknown as {
            name: string;
          } | null;
          return {
            bookmarkId: item.bookmarkId,
            title: bookmark?.title || "",
            url: bookmark?.url || "",
            createdAt: bookmark?.created_at || "",
            folderName: folder?.name,
            isRecommendedKeep: item.isRecommendedKeep,
          };
        }),
      }));

    return NextResponse.json({
      success: true,
      data: {
        groups,
        totalGroups: groupMap.size,
        totalDuplicates: allBookmarkIds.length,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Duplicates API: Unexpected error",
    );
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 },
    );
  }
}

// ============================================
// POST - 批量处理重复内容
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { action, groupId, keepBookmarkId, deleteBookmarkIds } = body;

    logger.info(
      { action, groupId, keepBookmarkId, deleteBookmarkIds, userId: user.id },
      "Duplicates API: Processing request",
    );

    if (!action) {
      return NextResponse.json(
        { success: false, error: "参数不完整" },
        { status: 400 },
      );
    }

    const result = { processed: 0, errors: [] as string[] };

    switch (action) {
      case "keep_one": {
        if (!keepBookmarkId || !deleteBookmarkIds?.length) {
          return NextResponse.json(
            { success: false, error: "参数不完整" },
            { status: 400 },
          );
        }

        // 移入回收站（使用 serviceClient 绕过 RLS）
        const serviceClient = await createServiceClient();
        const { error: deleteError } = await serviceClient
          .from("bookmarks")
          .update({
            is_in_trash: true,
            trashed_at: new Date().toISOString(),
          })
          .in("id", deleteBookmarkIds)
          .eq("user_id", user.id);

        if (deleteError) {
          result.errors.push(deleteError.message);
        } else {
          // 更新问题状态：整个组的所有书签（含被保留的）都标记为 resolved
          const allBookmarkIds = [keepBookmarkId, ...deleteBookmarkIds];
          await supabase
            .from("health_check_cache")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
              resolution_action: "merged",
            })
            .eq("user_id", user.id)
            .eq("check_type", "duplicate")
            .in("bookmark_id", allBookmarkIds);

          result.processed = deleteBookmarkIds.length;
        }
        break;
      }

      case "ignore_group": {
        if (!groupId) {
          return NextResponse.json(
            { success: false, error: "参数不完整" },
            { status: 400 },
          );
        }

        const { error: ignoreError } = await supabase
          .from("health_check_cache")
          .update({
            status: "ignored",
            ignored_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("check_type", "duplicate")
          .filter("details->groupId", "eq", groupId);

        if (ignoreError) {
          result.errors.push(ignoreError.message);
        } else {
          result.processed = 1;
        }
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: "不支持的操作" },
          { status: 400 },
        );
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      data: result,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Duplicates API: Unexpected error in POST",
    );
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 },
    );
  }
}
