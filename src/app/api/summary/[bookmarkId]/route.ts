/**
 * Summary Detail API
 *
 * GET /api/summary/[bookmarkId] - 获取书签摘要详情
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  parseStructuredSummary,
  getDisplaySummary,
  CONTENT_TYPE_LABELS,
  type ContentType,
} from "@/lib/summary";

interface RouteParams {
  params: Promise<{
    bookmarkId: string;
  }>;
}

/**
 * GET /api/summary/[bookmarkId]
 * 获取书签摘要详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析参数
    const { bookmarkId: bookmarkIdStr } = await params;
    const bookmarkId = parseInt(bookmarkIdStr, 10);

    if (isNaN(bookmarkId) || bookmarkId <= 0) {
      return notFoundError("无效的书签 ID");
    }

    // 3. 获取书签信息
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkSummaryRow = {
      id: number;
      user_id: string;
      title: string;
      url: string;
      ai_summary: string | null;
      ai_tags: string[] | null;
      content_type: string | null;
      created_at: string;
      updated_at: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmark, error: bookmarkError } = await (supabase.from("bookmarks") as any)
      .select(
        "id, user_id, title, url, ai_summary, ai_tags, content_type, created_at, updated_at",
      )
      .eq("id", bookmarkId)
      .single() as { data: BookmarkSummaryRow | null; error: { message: string } | null };

    if (bookmarkError || !bookmark) {
      return notFoundError("书签不存在");
    }

    if (bookmark.user_id !== user.id) {
      return forbiddenError("无权访问此书签");
    }

    // 4. 检查是否有摘要
    if (!bookmark.ai_summary) {
      return successResponse({
        bookmarkId,
        hasSummary: false,
        summary: null,
        tags: [],
        message: "此书签尚未生成摘要",
      });
    }

    // 5. 解析摘要（支持 V1 纯文本和 V2 JSON 格式）
    const structuredSummary = parseStructuredSummary(bookmark.ai_summary);
    const displaySummary = getDisplaySummary(bookmark.ai_summary);

    // 6. 获取内容类型标签
    const contentType = bookmark.content_type as ContentType | null;
    const contentTypeLabel = contentType
      ? CONTENT_TYPE_LABELS[contentType]
      : undefined;

    // 7. 返回结果
    return successResponse({
      bookmarkId,
      hasSummary: true,
      title: bookmark.title,
      url: bookmark.url,
      // 摘要内容
      summary: {
        raw: bookmark.ai_summary,
        display: displaySummary,
        structured: structuredSummary,
        version: structuredSummary ? 2 : 1,
      },
      // 标签
      tags: bookmark.ai_tags || [],
      // 内容类型
      contentType: contentType
        ? {
            type: contentType,
            label: contentTypeLabel,
          }
        : null,
      // 时间戳
      createdAt: bookmark.created_at,
      updatedAt: bookmark.updated_at,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/summary/[bookmarkId] error",
    );
    return internalError("获取摘要详情失败");
  }
}
