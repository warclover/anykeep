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
import {
  validateId,
  safeParseBody,
  crawlArticleSchema,
} from "@/lib/wechat-article/validation";
import type { Platform } from "@/types/supabase";

// Supabase join 查询结果类型
interface SnapshotWithBookmark {
  id: number;
  bookmarks: { platform: Platform };
}

export const dynamic = "force-dynamic";

/**
 * 为 HTML 中所有 img 标签添加 referrerpolicy="no-referrer"
 * 解决微信图片防盗链问题
 */
function addReferrerPolicy(html: string): string {
  if (!html) return html;
  return html.replace(/<img([^>]*)>/gi, (match, attrs) => {
    // 如果已有 referrerpolicy 属性，跳过
    if (/referrerpolicy/i.test(attrs)) {
      return match;
    }
    return `<img${attrs} referrerpolicy="no-referrer">`;
  });
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 将 HTML 中的微信原始图片 URL 替换为持久化的 Supabase URL
 * 优先使用已持久化的图片，确保图片能正常显示
 */
function replaceWithPersistedUrls(
  html: string,
  images: Array<{
    originalUrl: string;
    persistedUrl?: string | null;
    status: string;
  }>,
): string {
  if (!html || !images || images.length === 0) return html;

  let result = html;
  for (const img of images) {
    // 只替换成功持久化的图片 URL
    if (img.persistedUrl && img.status === "success") {
      result = result.replace(
        new RegExp(`(src|data-src)="${escapeRegExp(img.originalUrl)}"`, "g"),
        `$1="${img.persistedUrl}"`,
      );
    }
  }
  return result;
}

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

    const content = await wechatArticleService.getArticleContent(snapshotId);

    if (!content) {
      return errorResponse("NOT_FOUND", "文章内容不存在", 404);
    }

    // 处理 HTML：
    // 1. 将微信原始 URL 替换为已持久化的 Supabase URL
    // 2. 为未持久化的图片添加 referrerpolicy 属性解决防盗链
    let processedHtml = replaceWithPersistedUrls(content.html, content.images);
    processedHtml = addReferrerPolicy(processedHtml);

    const processedContent = {
      ...content,
      html: processedHtml,
    };

    return successResponse(processedContent);
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
 *
 * 样式选项升级：支持 styleLevel 参数
 * @body {styleLevel?: 'text-only' | 'full-snapshot'} - 样式保留级别
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

    // 使用 Zod 验证请求体
    const bodyResult = await safeParseBody(request, crawlArticleSchema);
    const styleLevel = bodyResult.success
      ? bodyResult.data.styleLevel
      : undefined;

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
    const typedSnapshot = snapshot as unknown as SnapshotWithBookmark;
    if (typedSnapshot.bookmarks.platform !== "WECHAT_OFFICIAL_ACCOUNT") {
      return errorResponse("NOT_WECHAT_ARTICLE", "仅支持微信公众号文章", 400);
    }

    // 抓取完整内容（传递 styleLevel）
    const content = await wechatArticleService.crawlFullContent(snapshotId, {
      styleLevel,
    });

    return successResponse({
      success: true,
      wordCount: content.wordCount,
      imagesCount: content.images.length,
      imagesSuccess: content.images.filter((i) => i.status === "success")
        .length,
      styleLevel: content.styleLevel,
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
