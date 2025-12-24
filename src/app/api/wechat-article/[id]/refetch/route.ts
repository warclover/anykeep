/**
 * 微信文章重新获取 API 路由
 *
 * POST /api/wechat-article/[id]/refetch - 重新获取文章内容
 */

import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { wechatArticleService } from "@/lib/wechat-article";
import {
  successResponse,
  errorResponse,
  unauthorizedError,
} from "@/lib/utils/api-response";
import {
  validateId,
  safeParseBody,
  refetchArticleSchema,
} from "@/lib/wechat-article/validation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/wechat-article/[id]/refetch
 * 重新获取文章内容
 *
 * 样式选项升级：支持 styleLevel 参数
 *
 * Body:
 * - forceUpdate?: boolean - 强制更新
 * - redownloadImages?: boolean - 重新下载图片
 * - imagesOnly?: boolean - 仅更新图片
 * - styleLevel?: 'text-only' | 'full-snapshot' - 样式保留级别
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
    const snapshotId = validateId(id);

    if (!snapshotId) {
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

    // 使用 Zod 验证请求体
    const bodyResult = await safeParseBody(request, refetchArticleSchema);
    if (!bodyResult.success) {
      return errorResponse("INVALID_REQUEST", bodyResult.error, 400);
    }

    const { forceUpdate, redownloadImages, imagesOnly, styleLevel } =
      bodyResult.data;

    // 执行重新获取（传递 styleLevel）
    const result = await wechatArticleService.refetch(snapshotId, {
      forceUpdate,
      redownloadImages,
      imagesOnly,
      styleLevel,
    });

    return successResponse(result);
  } catch (error) {
    logger.error(
      { error },
      "[API] POST /api/wechat-article/[id]/refetch error",
    );
    return errorResponse(
      "REFETCH_FAILED",
      error instanceof Error ? error.message : "重新获取失败",
      500,
    );
  }
}
