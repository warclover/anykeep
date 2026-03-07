/**
 * POST /api/bookmarks/fetch-content
 *
 * 附件内容抓取 API
 *
 * 当书签没有 ai_summary/description 时，实时抓取 URL 内容
 * 用于 AI 助手附件功能，确保附件内容可用
 *
 * 频率限制: 每用户 10 次/分钟
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { getContentFetcherService } from "@/lib/summary/services/content-fetcher.service";
import { extractKeyContent } from "@/lib/utils/content-extractor";
import { withAuthMiddleware } from "@/lib/api/middleware";

// =============================================================================
// Request Schema
// =============================================================================

const requestSchema = z.object({
  /** 书签 ID */
  bookmarkId: z.number().int().positive(),
  /** 书签 URL */
  url: z.string().url(),
});

// =============================================================================
// Constants
// =============================================================================

/** 最大内容长度（字符） */
const MAX_CONTENT_LENGTH = 8000;

/** 抓取超时时间（毫秒） */
const FETCH_TIMEOUT_MS = 10000;

/** 禁止访问的主机名模式 */
const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal", // GCP metadata
  "169.254.169.254", // AWS/Azure metadata
  "metadata.internal", // Alibaba Cloud
];

/** 检查是否为内网 IP */
function isPrivateIP(ip: string): boolean {
  // IPv4 内网地址段
  const privateIPv4Patterns = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^127\./, // 127.0.0.0/8 (loopback)
    /^0\./, // 0.0.0.0/8
    /^169\.254\./, // 169.254.0.0/16 (link-local)
  ];

  return privateIPv4Patterns.some((pattern) => pattern.test(ip));
}

/** 验证 URL 安全性（防 SSRF） */
function validateUrlSafety(urlString: string): {
  valid: boolean;
  error?: string;
} {
  try {
    const parsed = new URL(urlString);

    // 1. 只允许 HTTP/HTTPS 协议
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "仅支持 HTTP/HTTPS 协议" };
    }

    // 2. 禁止访问已知危险主机
    const hostname = parsed.hostname.toLowerCase();
    if (
      BLOCKED_HOSTNAMES.some(
        (blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`),
      )
    ) {
      return { valid: false, error: "禁止访问此地址" };
    }

    // 3. 禁止内网 IP
    if (isPrivateIP(hostname)) {
      return { valid: false, error: "禁止访问内网地址" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "无效的 URL 格式" };
  }
}

// =============================================================================
// API Handler
// =============================================================================

export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

  // 2. 频率限制检查
  const rateLimitResult = checkRateLimit(
    userId,
    "/api/bookmarks/fetch-content",
  );

  if (!rateLimitResult.allowed) {
    logger.warn(
      {
        userId: userId.slice(0, 8),
        remaining: rateLimitResult.remaining,
        resetMs: rateLimitResult.resetMs,
      },
      "fetch-content: Rate limit exceeded",
    );

    return NextResponse.json(
      {
        success: false,
        error: "请求过于频繁，请稍后再试",
        retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimitResult.resetMs / 1000)),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          "X-RateLimit-Limit": String(rateLimitResult.limit),
        },
      },
    );
  }

  // 3. 解析请求体
  const body = await request.json();
  const validation = requestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "参数无效",
        details: validation.error.issues,
      },
      { status: 400 },
    );
  }

  const { bookmarkId, url } = validation.data;

  // 4. 验证书签所有权
  const supabase = await createClient();
  const { data: bookmark, error: bookmarkError } = await supabase
    .from("bookmarks")
    .select("id, user_id, title, ai_summary, description")
    .eq("id", bookmarkId)
    .single();

  if (bookmarkError || !bookmark) {
    logger.warn(
      { bookmarkId, userId: userId.slice(0, 8), error: bookmarkError },
      "fetch-content: Bookmark not found",
    );

    return NextResponse.json(
      { success: false, error: "书签不存在" },
      { status: 404 },
    );
  }

  if (bookmark.user_id !== userId) {
    logger.warn(
      {
        bookmarkId,
        userId: userId.slice(0, 8),
        ownerId: bookmark.user_id.slice(0, 8),
      },
      "fetch-content: Unauthorized access attempt",
    );

    return NextResponse.json(
      { success: false, error: "无权访问此书签" },
      { status: 403 },
    );
  }

  // 5. 检查是否已有内容（避免重复抓取）
  if (bookmark.ai_summary && bookmark.ai_summary.trim()) {
    return NextResponse.json({
      success: true,
      content: bookmark.ai_summary,
      source: "ai_summary",
      cached: true,
    });
  }

  if (bookmark.description && bookmark.description.trim()) {
    return NextResponse.json({
      success: true,
      content: bookmark.description,
      source: "description",
      cached: true,
    });
  }

  // 6. URL 安全验证（防 SSRF）
  const urlValidation = validateUrlSafety(url);
  if (!urlValidation.valid) {
    logger.warn(
      {
        bookmarkId,
        url,
        error: urlValidation.error,
        userId: userId.slice(0, 8),
      },
      "fetch-content: URL validation failed (SSRF protection)",
    );

    return NextResponse.json(
      { success: false, error: urlValidation.error },
      { status: 400 },
    );
  }

  // 7. 实时抓取内容
  logger.info(
    { bookmarkId, url, userId: userId.slice(0, 8) },
    "fetch-content: Fetching URL content",
  );

  const fetcher = getContentFetcherService();

  const fetchResult = await fetcher.fetch(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    extractContent: true,
    maxContentLength: MAX_CONTENT_LENGTH * 2, // 抓取更多，后续截断
  });

  // 7. 处理抓取结果
  let content = fetchResult.content || fetchResult.description || "";

  if (!content) {
    logger.warn(
      { bookmarkId, url },
      "fetch-content: No content extracted from URL",
    );

    return NextResponse.json({
      success: true,
      content: null,
      source: "none",
      message: "无法提取页面内容",
    });
  }

  // 8. 提取关键内容（如果过长）
  if (content.length > MAX_CONTENT_LENGTH) {
    content = extractKeyContent(content, MAX_CONTENT_LENGTH);
  }

  // 9. 可选：更新书签的 ai_summary（异步，不阻塞响应）
  supabase
    .from("bookmarks")
    .update({ ai_summary: content })
    .eq("id", bookmarkId)
    .then(({ error }) => {
      if (error) {
        logger.warn(
          { bookmarkId, error },
          "fetch-content: Failed to update ai_summary",
        );
      } else {
        logger.debug({ bookmarkId }, "fetch-content: ai_summary updated");
      }
    });

  const elapsed = Date.now() - startTime;

  logger.info(
    {
      bookmarkId,
      contentLength: content.length,
      elapsed,
      userId: userId.slice(0, 8),
    },
    "fetch-content: Content fetched successfully",
  );

  return Response.json({
    success: true,
    content,
    source: "fetched",
    contentLength: content.length,
    fetchTimeMs: elapsed,
  });
});
