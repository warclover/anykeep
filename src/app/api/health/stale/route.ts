/**
 * 过期内容 API
 *
 * GET /api/health/stale - 获取过期内容列表
 * POST /api/health/stale - 批量处理过期内容
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { staleContentDetector } from "@/lib/ai-skills/skills/health-check/detectors/stale-detector";
import { HEALTH_CHECK_CONFIG } from "@/lib/ai-skills/skills/health-check/types";

// ============================================
// GET - 获取过期内容列表
// ============================================

export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const days = parseInt(
      searchParams.get("days") ||
        String(HEALTH_CHECK_CONFIG.STALE_THRESHOLDS.EXPIRED),
    );
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    // 使用检测器获取过期内容
    const allStaleContent = await staleContentDetector.detect(userId, {
      thresholdDays: days,
      limit: 500,
    });

    // 分页
    const total = allStaleContent.length;
    const items = allStaleContent.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        thresholds: HEALTH_CHECK_CONFIG.STALE_THRESHOLDS,
      },
    });
  },
);

// ============================================
// POST - 批量处理过期内容
// ============================================

export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    const body = await request.json();
    const { action, bookmarkIds } = body;

    if (!action || !bookmarkIds?.length) {
      return NextResponse.json(
        { success: false, error: "参数不完整" },
        { status: 400 },
      );
    }

    const result = { processed: 0, errors: [] as string[] };

    switch (action) {
      case "archive": {
        const { data: archiveFolder } = await supabase
          .from("folders")
          .select("id")
          .eq("user_id", userId)
          .eq("is_system", true)
          .eq("system_type", "archive")
          .single();

        if (archiveFolder) {
          const { error: archiveError } = await supabase
            .from("bookmarks")
            .update({
              folder_id: archiveFolder.id,
              is_archived: true,
            })
            .in("id", bookmarkIds)
            .eq("user_id", userId);

          if (archiveError) {
            result.errors.push(archiveError.message);
          } else {
            result.processed = bookmarkIds.length;
          }
        } else {
          const serviceClient = await createServiceClient();
          const { error: archiveError } = await serviceClient
            .from("bookmarks")
            .update({
              is_in_trash: true,
              trashed_at: new Date().toISOString(),
            })
            .in("id", bookmarkIds)
            .eq("user_id", userId);

          if (archiveError) {
            result.errors.push(archiveError.message);
          } else {
            result.processed = bookmarkIds.length;
          }
        }

        await supabase
          .from("health_check_cache")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolution_action: "archived",
          })
          .eq("user_id", userId)
          .eq("check_type", "stale")
          .in("bookmark_id", bookmarkIds);

        break;
      }

      case "delete": {
        const serviceClient = await createServiceClient();
        const { error: deleteError } = await serviceClient
          .from("bookmarks")
          .update({
            is_in_trash: true,
            trashed_at: new Date().toISOString(),
          })
          .in("id", bookmarkIds)
          .eq("user_id", userId);

        if (deleteError) {
          result.errors.push(deleteError.message);
        } else {
          result.processed = bookmarkIds.length;
        }

        await supabase
          .from("health_check_cache")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolution_action: "deleted",
          })
          .eq("user_id", userId)
          .eq("check_type", "stale")
          .in("bookmark_id", bookmarkIds);

        break;
      }

      case "mark_important": {
        const { error: updateError } = await supabase
          .from("bookmarks")
          .update({
            last_accessed_at: new Date().toISOString(),
            is_starred: true,
          })
          .in("id", bookmarkIds)
          .eq("user_id", userId);

        if (updateError) {
          result.errors.push(updateError.message);
        } else {
          result.processed = bookmarkIds.length;
        }

        await supabase
          .from("health_check_cache")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolution_action: "marked_important",
          })
          .eq("user_id", userId)
          .eq("check_type", "stale")
          .in("bookmark_id", bookmarkIds);

        break;
      }

      case "ignore": {
        const { error: ignoreError } = await supabase
          .from("health_check_cache")
          .update({
            status: "ignored",
            ignored_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("check_type", "stale")
          .in("bookmark_id", bookmarkIds);

        if (ignoreError) {
          result.errors.push(ignoreError.message);
        } else {
          result.processed = bookmarkIds.length;
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
  },
);
