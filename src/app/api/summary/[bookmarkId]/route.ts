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
  forbiddenError,
  notFoundError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  parseStructuredSummary,
  getDisplaySummary,
  CONTENT_TYPE_LABELS,
  type ContentType,
} from "@/lib/summary";

/**
 * GET /api/summary/[bookmarkId]
 * 获取书签摘要详情
 */
export const GET = withAuthMiddleware<{ bookmarkId: string }>(
  async (_request: NextRequest, { userId, params }) => {
    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 解析参数
    const { bookmarkId: bookmarkIdStr } = await params;
    const bookmarkId = parseInt(bookmarkIdStr, 10);

    if (isNaN(bookmarkId) || bookmarkId <= 0) {
      return notFoundError("无效的书签 ID");
    }

    // 获取书签信息
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
    const { data: bookmark, error: bookmarkError } = (await supabase
      .from("bookmarks")
      .select(
        "id, user_id, title, url, ai_summary, ai_tags, content_type, created_at, updated_at",
      )
      .eq("id", bookmarkId)
      .single()) as {
      data: BookmarkSummaryRow | null;
      error: { message: string } | null;
    };

    if (bookmarkError || !bookmark) {
      return notFoundError("书签不存在");
    }

    if (bookmark.user_id !== userId) {
      return forbiddenError("无权访问此书签");
    }

    // 检查是否有摘要
    if (!bookmark.ai_summary) {
      return successResponse({
        bookmarkId,
        hasSummary: false,
        summary: null,
        tags: [],
        message: "此书签尚未生成摘要",
      });
    }

    // 解析摘要（支持 V1 纯文本和 V2 JSON 格式）
    const structuredSummary = parseStructuredSummary(bookmark.ai_summary);
    const displaySummary = getDisplaySummary(bookmark.ai_summary);

    // 获取内容类型标签
    const contentType = bookmark.content_type as ContentType | null;
    const contentTypeLabel = contentType
      ? CONTENT_TYPE_LABELS[contentType]
      : undefined;

    // 返回结果
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
  },
);
