/**
 * Related Bookmarks API
 * GET /api/bookmarks/[id]/related - 获取与指定书签相关的其他书签
 *
 * Phase 2.1: 相关内容推荐功能
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * 相关书签结果类型
 */
interface RelatedBookmark {
  id: number;
  title: string;
  url: string;
  description: string | null;
  similarity: number;
  folderId: number | null;
  folderName: string | null;
  platform: string | null;
  createdAt: string;
}

/**
 * GET /api/bookmarks/[id]/related
 * 获取与指定书签相关的其他书签
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    // 2. 解析路由参数
    const { id } = await params;
    const bookmarkId = parseInt(id, 10);

    if (isNaN(bookmarkId) || bookmarkId <= 0) {
      return badRequestError("无效的书签 ID");
    }

    // 3. 解析查询参数
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10), 20); // 最大 20
    const minSimilarity = parseFloat(
      searchParams.get("minSimilarity") || "0.5",
    );
    const excludeSameFolder = searchParams.get("excludeSameFolder") === "true";

    // 4. 验证书签存在且属于当前用户
    const supabase = await createClient();
    // 类型断言: 手动维护类型文件时需要此断言
    const { data: bookmark, error: bookmarkError } = (await supabase
      .from("bookmarks")
      .select("id, title, embedding")
      .eq("id", bookmarkId)
      .eq("user_id", userId)
      .single()) as unknown as {
      data: {
        id: number;
        title: string | null;
        embedding: number[] | null;
      } | null;
      error: unknown;
    };

    if (bookmarkError || !bookmark) {
      return notFoundError("书签不存在");
    }

    if (!bookmark.embedding) {
      return successResponse({
        bookmarkId,
        related: [],
        message: "该书签尚未生成向量索引，无法查找相关内容",
      });
    }

    // 5. 调用 RPC 函数查询相关书签 (V4.2 RPC)
    // 类型断言: 手动维护类型文件时需要此断言
    type RelatedBookmarkRow = {
      id: number;
      title: string;
      url: string;
      description: string | null;
      similarity: number;
      folder_id: number | null;
      folder_name: string | null;
      platform: string | null;
      created_at: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: relatedData, error: rpcError } = (await (supabase.rpc as any)(
      "find_related_bookmarks",
      {
        p_bookmark_id: bookmarkId,
        p_user_id: userId,
        p_limit: limit,
        p_min_similarity: minSimilarity,
        p_exclude_same_folder: excludeSameFolder,
      },
    )) as {
      data: RelatedBookmarkRow[] | null;
      error: { message?: string; code?: string } | null;
    };

    if (rpcError) {
      logger.error(
        { error: rpcError, bookmarkId, userId },
        "Failed to find related bookmarks",
      );
      // 返回详细的 RPC 错误信息以便调试
      const errorMessage =
        process.env.NODE_ENV === "development"
          ? `查询相关书签失败: ${rpcError.message || rpcError.code || JSON.stringify(rpcError)}`
          : "查询相关书签失败";
      return internalError(errorMessage);
    }

    // 6. 格式化响应
    const related: RelatedBookmark[] = (relatedData || []).map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      description: item.description,
      similarity: Math.round(item.similarity * 100) / 100, // 保留 2 位小数
      folderId: item.folder_id,
      folderName: item.folder_name,
      platform: item.platform,
      createdAt: item.created_at,
    }));

    logger.debug(
      {
        userId,
        bookmarkId,
        foundCount: related.length,
        params: { limit, minSimilarity, excludeSameFolder },
      },
      "Related bookmarks fetched",
    );

    return successResponse({
      bookmarkId,
      sourceTitle: bookmark.title,
      related,
      params: {
        limit,
        minSimilarity,
        excludeSameFolder,
      },
    });
  },
);
