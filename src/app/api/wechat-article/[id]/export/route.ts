/**
 * 微信文章导出 API
 *
 * GET /api/wechat-article/[id]/export?format=markdown|pdf
 *
 * Phase 6 升级：导出功能
 */

import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { wechatArticleService } from "@/lib/wechat-article";
import {
  exportToMarkdown,
  exportToPdf,
  isPuppeteerAvailable,
  type ArticleMetadata,
} from "@/lib/wechat-article/export";
import { errorResponse, unauthorizedError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// =============================================================================
// GET: 导出文章
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const snapshotId = parseInt(id, 10);

    if (isNaN(snapshotId)) {
      return errorResponse("INVALID_ID", "无效的快照 ID", 400);
    }

    // 获取导出格式
    const format = request.nextUrl.searchParams.get("format") || "markdown";

    if (!["markdown", "pdf"].includes(format)) {
      return errorResponse("INVALID_FORMAT", "格式必须是 markdown 或 pdf", 400);
    }

    // 获取 Supabase 客户端
    const supabase = await createServerSupabaseClient();

    // 检查用户认证
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError();
    }

    // 验证快照所有权并获取基本信息
    interface SnapshotWithBookmark {
      id: number;
      readable_title: string | null;
      original_url: string | null;
      captured_at: string | null;
      bookmarks: {
        title: string | null;
        url: string;
        user_id: string;
      };
    }

    const { data: snapshot, error: snapshotError } = (await supabase
      .from("bookmark_snapshots")
      .select(
        `
        id,
        readable_title,
        original_url,
        captured_at,
        bookmarks!inner(
          title,
          url,
          user_id
        )
      `,
      )
      .eq("id", snapshotId)
      .eq("user_id", user.id)
      .single()) as { data: SnapshotWithBookmark | null; error: unknown };

    if (snapshotError || !snapshot) {
      return errorResponse("NOT_FOUND", "快照不存在或无权访问", 404);
    }

    // 获取文章内容
    const content = await wechatArticleService.getArticleContent(snapshotId);

    if (!content || !content.html) {
      return errorResponse(
        "NO_CONTENT",
        "文章内容不可用，请先抓取完整内容",
        400,
      );
    }

    // 构建元数据（优先使用快照标题，否则使用书签标题）
    const metadata: ArticleMetadata = {
      title:
        snapshot.readable_title || snapshot.bookmarks?.title || "未命名文章",
      originalUrl: snapshot.original_url || snapshot.bookmarks?.url || "",
      publishTime: snapshot.captured_at || undefined,
      savedAt: new Date().toISOString(),
    };

    // 根据格式导出
    if (format === "pdf") {
      // 检查 Puppeteer 是否可用
      const puppeteerAvailable = await isPuppeteerAvailable();

      if (!puppeteerAvailable) {
        return errorResponse(
          "PDF_NOT_AVAILABLE",
          "PDF 导出功能不可用（需要安装 puppeteer）",
          503,
        );
      }

      const { buffer, filename } = await exportToPdf(content, metadata);

      // 转换 Buffer 为 Uint8Array 以兼容 Response
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
          "Content-Length": buffer.length.toString(),
        },
      });
    }

    // 默认 Markdown
    const { content: markdownContent, filename } = exportToMarkdown(
      content,
      metadata,
    );

    return new Response(markdownContent, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    logger.error({ error }, "[ExportAPI] Export failed");

    return errorResponse(
      "EXPORT_FAILED",
      error instanceof Error ? error.message : "导出失败",
      500,
    );
  }
}
