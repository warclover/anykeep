/**
 * Brain-Sync 相关书签推荐 API
 * GET /api/brain-sync/related - 获取复习时的相关书签推荐
 *
 * @module api/brain-sync/related
 * @version 1.0.0
 * @since 2026-01-01
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  handleValidationError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { RelatedBookmark } from "@/types/brain-sync";

/**
 * 查询参数验证 Schema
 */
const relatedBookmarksSchema = z.object({
  bookmarkId: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(10).default(3),
});

/**
 * GET /api/brain-sync/related
 * 获取复习时的相关书签推荐
 *
 * @query bookmarkId - 当前复习卡片对应的书签 ID
 * @query limit - 返回数量限制（默认 3，最大 10）
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析并验证查询参数
    const searchParams = request.nextUrl.searchParams;
    const validation = relatedBookmarksSchema.safeParse({
      bookmarkId: searchParams.get("bookmarkId"),
      limit: searchParams.get("limit") ?? 3,
    });

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { bookmarkId, limit } = validation.data;

    const supabase = await createClient();

    // 3. 调用 RPC 获取相关书签
    const { data: relatedBookmarks, error: rpcError } =
      (await // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase 类型推断限制
      (supabase as any).rpc("get_review_related_bookmarks", {
        p_bookmark_id: bookmarkId,
        p_user_id: user.id,
        p_limit: limit,
      })) as {
        data: Array<{
          id: number;
          title: string;
          relevance_reason: string;
          similarity: number;
        }> | null;
        error: { message: string; code?: string } | null;
      };

    if (rpcError) {
      // 如果是未找到书签的错误，返回空数组
      if (rpcError.code === "P0001") {
        logger.warn(
          { bookmarkId, userId: user.id, error: rpcError.message },
          "Brain-Sync: Bookmark not found for related search",
        );
        return successResponse({
          success: true,
          bookmarkId,
          relatedBookmarks: [],
          message: "未找到相关书签",
        });
      }

      logger.error(
        { bookmarkId, userId: user.id, error: rpcError.message },
        "Brain-Sync: Failed to fetch related bookmarks",
      );
      return internalError("获取相关书签失败");
    }

    // 4. 格式化响应
    const formattedBookmarks: RelatedBookmark[] = (relatedBookmarks || []).map(
      (b) => ({
        id: b.id,
        title: b.title,
        relevanceReason: b.relevance_reason,
        similarity: b.similarity,
      }),
    );

    logger.info(
      {
        bookmarkId,
        userId: user.id,
        count: formattedBookmarks.length,
      },
      "Brain-Sync: Related bookmarks fetched",
    );

    return successResponse({
      success: true,
      bookmarkId,
      relatedBookmarks: formattedBookmarks,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Related bookmarks API error",
    );
    return internalError("获取相关书签失败");
  }
}
