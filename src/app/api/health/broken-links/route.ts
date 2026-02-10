/**
 * 失效链接 API
 *
 * GET /api/health/broken-links - 获取失效链接列表
 * POST /api/health/broken-links - 触发链接检测
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { BrokenLinkIssue } from "@/lib/ai-skills/skills/health-check/types";

// ============================================
// GET - 获取失效链接列表
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
    const offset = (page - 1) * pageSize;

    // 获取失效链接
    const { data, error, count } = await supabase
      .from("health_check_cache")
      .select("*, bookmarks!inner(title, url)", { count: "exact" })
      .eq("user_id", user.id)
      .eq("check_type", "broken_link")
      .eq("status", "issue")
      .order("detected_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      logger.error(
        { error: error.message, userId: user.id },
        "BrokenLinks API: Failed to fetch",
      );
      return NextResponse.json(
        { success: false, error: "获取失效链接失败" },
        { status: 500 },
      );
    }

    const items: BrokenLinkIssue[] = (data || []).map((row) => {
      const details = row.details as Record<string, unknown>;
      const bookmark = row.bookmarks as { title: string; url: string };

      return {
        id: row.id,
        bookmarkId: row.bookmark_id,
        title: bookmark?.title || (details?.title as string) || "",
        url: bookmark?.url || (details?.url as string) || "",
        httpStatus: (details?.httpStatus as number) || null,
        errorType:
          (details?.errorType as BrokenLinkIssue["errorType"]) || "unknown",
        errorMessage: details?.errorMessage as string | undefined,
        waybackUrl: details?.waybackUrl as string | undefined,
        lastCheckedAt: row.last_checked_at,
        detectedAt: row.detected_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        total: count || 0,
        page,
        pageSize,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "BrokenLinks API: Unexpected error",
    );
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 },
    );
  }
}

// ============================================
// POST - 批量操作失效链接
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
    const { action, issueIds } = body;

    if (!action || !issueIds?.length) {
      return NextResponse.json(
        { success: false, error: "参数不完整" },
        { status: 400 },
      );
    }

    const result = { processed: 0, errors: [] as string[] };

    switch (action) {
      case "delete": {
        // 获取关联的书签 ID
        const { data: issues } = await supabase
          .from("health_check_cache")
          .select("bookmark_id")
          .in("id", issueIds)
          .eq("user_id", user.id);

        const bookmarkIds = (issues?.map((i) => i.bookmark_id) || []).filter(
          (id): id is number => id !== null,
        );

        if (bookmarkIds.length === 0) {
          result.errors.push("没有找到关联的书签");
          break;
        }

        // 移入回收站（使用 serviceClient 绕过 RLS）
        const serviceClient = await createServiceClient();
        const { error: deleteError } = await serviceClient
          .from("bookmarks")
          .update({
            is_in_trash: true,
            trashed_at: new Date().toISOString(),
          })
          .in("id", bookmarkIds)
          .eq("user_id", user.id);

        if (deleteError) {
          result.errors.push(deleteError.message);
        } else {
          // 更新问题状态
          await supabase
            .from("health_check_cache")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
              resolution_action: "deleted",
            })
            .in("id", issueIds);

          result.processed = bookmarkIds.length;
        }
        break;
      }

      case "ignore": {
        const { error: ignoreError } = await supabase
          .from("health_check_cache")
          .update({
            status: "ignored",
            ignored_at: new Date().toISOString(),
          })
          .in("id", issueIds)
          .eq("user_id", user.id);

        if (ignoreError) {
          result.errors.push(ignoreError.message);
        } else {
          result.processed = issueIds.length;
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
      "BrokenLinks API: Unexpected error in POST",
    );
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 },
    );
  }
}
