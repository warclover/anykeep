/**
 * 微信文章 API 路由
 *
 * GET  /api/wechat-article/[id] - 获取文章内容
 * POST /api/wechat-article/[id] - 抓取文章完整内容
 */

import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { wechatArticleService } from "@/lib/wechat-article";
import {
  successResponse,
  errorResponse,
  unauthorizedError,
} from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/wechat-article/[id]
 * 获取微信文章内容
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError();
    }

    const { id } = await params;
    const snapshotId = parseInt(id, 10);

    if (isNaN(snapshotId)) {
      return errorResponse("INVALID_ID", "无效的快照 ID", 400);
    }

    // 验证快照所有权
    const { data: snapshot, error: snapshotError } = await supabase
      .from("bookmark_snapshots")
      .select("id")
      .eq("id", snapshotId)
      .eq("user_id", user.id)
      .single();

    if (snapshotError || !snapshot) {
      return errorResponse("NOT_FOUND", "快照不存在或无权访问", 404);
    }

    const content = await wechatArticleService.getArticleContent(snapshotId);

    if (!content) {
      return errorResponse("NOT_FOUND", "文章内容不存在", 404);
    }

    return successResponse(content);
  } catch (error) {
    console.error("[API] GET /api/wechat-article/[id] error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "获取文章失败",
      500,
    );
  }
}

/**
 * POST /api/wechat-article/[id]
 * 抓取微信文章完整内容
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError();
    }

    const { id } = await params;
    const snapshotId = parseInt(id, 10);

    if (isNaN(snapshotId)) {
      return errorResponse("INVALID_ID", "无效的快照 ID", 400);
    }

    // 验证快照所有权和平台
    const { data: snapshot, error: snapshotError } = await supabase
      .from("bookmark_snapshots")
      .select(
        `
        id,
        bookmarks!inner(platform)
      `,
      )
      .eq("id", snapshotId)
      .eq("user_id", user.id)
      .single();

    if (snapshotError || !snapshot) {
      return errorResponse("NOT_FOUND", "快照不存在或无权访问", 404);
    }

    // 验证是微信平台
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bookmark relation type mismatch
    if ((snapshot.bookmarks as any).platform !== "WECHAT_OFFICIAL_ACCOUNT") {
      return errorResponse("NOT_WECHAT_ARTICLE", "仅支持微信公众号文章", 400);
    }

    // 抓取完整内容
    const content = await wechatArticleService.crawlFullContent(snapshotId);

    return successResponse({
      success: true,
      wordCount: content.wordCount,
      imagesCount: content.images.length,
      imagesSuccess: content.images.filter((i) => i.status === "success")
        .length,
    });
  } catch (error) {
    console.error("[API] POST /api/wechat-article/[id] error:", error);
    return errorResponse(
      "CRAWL_FAILED",
      error instanceof Error ? error.message : "抓取失败",
      500,
    );
  }
}
