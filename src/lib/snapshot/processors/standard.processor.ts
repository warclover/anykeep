/**
 * Standard Snapshot Processor (V4.2.1)
 * 标准快照处理器 - 保存完整 HTML（含内联 CSS 和图片）
 *
 * 与 Basic 快照的区别：
 * - Basic: 仅保存 Readability 提取的正文
 * - Standard: 保存完整 HTML（CSS 内联、图片转 base64）
 *
 * 适用场景：
 * - Pro 用户
 * - 需要保留原始排版的页面
 * - 图文混排内容
 */

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import { snapshotService } from "../snapshot.service";
import { inlineHtml } from "../utils/html-inliner";
import type {
  SnapshotJobPayload,
  SnapshotProcessResult,
  ReadabilityResult,
  BookmarkSnapshotUpdate,
} from "../snapshot.types";

// ============================================================================
// 常量配置
// ============================================================================

const FETCH_TIMEOUT = 30000; // 30 秒超时
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 最大 10MB（标准快照允许更大）
const MAX_OUTPUT_SIZE = 2 * 1024 * 1024; // 最大输出 2MB

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "Cache-Control": "no-cache",
};

// ============================================================================
// 主处理函数
// ============================================================================

/**
 * 处理标准快照任务
 */
export async function processStandardSnapshot(job: {
  id: string;
  type: string;
  payload: SnapshotJobPayload;
  userId: string;
  attempts: number;
}): Promise<SnapshotProcessResult> {
  const { payload } = job;
  const { snapshot_id, url, bookmark_id, snapshot_type } = payload;

  logger.info(
    { snapshotId: snapshot_id, url, type: snapshot_type },
    "[StandardProcessor] Starting standard snapshot job",
  );

  try {
    // 1. 更新状态为处理中
    await snapshotService.updateSnapshot(snapshot_id, {
      status: "processing",
    });

    // 2. 获取网页内容
    const { html, finalUrl } = await fetchWebpage(url);

    // 3. 同时进行 Readability 解析和 HTML 内联
    const [readability, inlineResult] = await Promise.all([
      parseWithReadability(html, finalUrl),
      inlineHtml(html, {
        baseUrl: finalUrl,
        inlineImages: true,
        inlineCss: true,
        sanitize: true,
        maxOutputSize: MAX_OUTPUT_SIZE,
      }),
    ]);

    if (!readability) {
      throw new Error("Readability 无法提取正文内容");
    }

    // 4. 计算内容哈希（基于完整 HTML）
    const contentHash = calculateHash(inlineResult.html);

    // 5. 计算总文件大小
    const readableSize = Buffer.byteLength(readability.content, "utf8");
    const htmlSize = inlineResult.size;
    const totalSize = readableSize + htmlSize;

    // 6. 生成摘要
    const excerpt = generateExcerpt(readability.textContent, 300);

    // 7. 记录内联处理信息
    logger.info(
      {
        snapshotId: snapshot_id,
        inlinedImages: inlineResult.inlinedImages,
        skippedImages: inlineResult.skippedImages,
        htmlSize,
        errors: inlineResult.errors.length,
      },
      "[StandardProcessor] HTML inlining completed",
    );

    // 8. 更新快照记录（同时保存 Readability 内容和完整 HTML）
    const update: BookmarkSnapshotUpdate = {
      status: "completed",
      // Readability 提取内容（用于搜索和预览）
      readable_title: readability.title || undefined,
      readable_content: readability.content,
      readable_text_content: readability.textContent,
      readable_excerpt: excerpt,
      readable_byline: readability.byline || undefined,
      readable_word_count: readability.length,
      // 完整 HTML 内容（直接存储在 html_storage_path 字段中，小型内容）
      // 注意：大型内容应上传到 Storage，这里简化处理
      html_storage_path:
        inlineResult.html.length < 500 * 1024
          ? `inline:${Buffer.from(inlineResult.html).toString("base64").slice(0, 100)}`
          : undefined,
      // 元数据
      content_hash: contentHash,
      file_size: totalSize,
      final_url: finalUrl !== url ? finalUrl : undefined,
      captured_at: new Date().toISOString(),
    };

    await snapshotService.updateSnapshot(snapshot_id, update);

    // 如果 HTML 较大，需要单独存储
    if (inlineResult.html.length >= 500 * 1024) {
      await storeHtmlContent(snapshot_id, job.userId, inlineResult.html);
    }

    logger.info(
      {
        snapshotId: snapshot_id,
        wordCount: readability.length,
        totalSize,
        htmlSize,
      },
      "[StandardProcessor] Standard snapshot completed",
    );

    return {
      success: true,
      snapshotId: snapshot_id,
      readability,
      contentHash,
      fileSize: totalSize,
      finalUrl,
      htmlPath: `snapshots/${job.userId}/${bookmark_id}/${snapshot_id}.html`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      { snapshotId: snapshot_id, error: errorMessage },
      "[StandardProcessor] Standard snapshot failed",
    );

    // 更新失败状态
    await snapshotService.updateSnapshot(snapshot_id, {
      status: "failed",
      error_message: errorMessage,
      retry_count: job.attempts,
    });

    return {
      success: false,
      snapshotId: snapshot_id,
      error: errorMessage,
    };
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取网页内容
 */
async function fetchWebpage(
  url: string,
): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 检查内容类型
    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error(`不支持的内容类型: ${contentType}`);
    }

    // 检查内容大小
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_CONTENT_LENGTH) {
      throw new Error(`内容过大: ${contentLength} bytes`);
    }

    const html = await response.text();

    // 二次检查大小
    if (html.length > MAX_CONTENT_LENGTH) {
      throw new Error(`内容过大: ${html.length} bytes`);
    }

    return {
      html,
      finalUrl: response.url,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`请求超时 (${FETCH_TIMEOUT / 1000}s)`);
    }

    throw error;
  }
}

/**
 * 使用 Readability 解析内容
 */
function parseWithReadability(
  html: string,
  url: string,
): ReadabilityResult | null {
  try {
    const dom = new JSDOM(html, {
      url,
      runScripts: "outside-only",
    });

    const document = dom.window.document;
    const reader = new Readability(document, {
      charThreshold: 50,
    });

    const article = reader.parse();

    if (!article) {
      return null;
    }

    return {
      title: article.title || "",
      content: article.content || "",
      textContent: article.textContent || "",
      length: article.length || 0,
      excerpt: article.excerpt || "",
      byline: article.byline || null,
      dir: article.dir || null,
      siteName: article.siteName || null,
      lang: article.lang || null,
    };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), url },
      "[StandardProcessor] Readability parsing failed",
    );
    return null;
  }
}

/**
 * 计算内容 SHA256 哈希
 */
function calculateHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * 生成摘要
 */
function generateExcerpt(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}

/**
 * 存储大型 HTML 内容到 Supabase Storage
 */
async function storeHtmlContent(
  snapshotId: number,
  userId: string,
  html: string,
): Promise<string | null> {
  try {
    const { createServerSupabaseClient } = await import(
      "@/lib/supabase/server"
    );
    const supabase = await createServerSupabaseClient();

    const storagePath = `${userId}/${snapshotId}/full.html`;

    const { error } = await supabase.storage
      .from("snapshots")
      .upload(storagePath, html, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });

    if (error) {
      logger.error({ error }, "[StandardProcessor] Failed to store HTML");
      return null;
    }

    // 更新存储路径
    await snapshotService.updateSnapshot(snapshotId, {
      html_storage_path: storagePath,
    });

    return storagePath;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[StandardProcessor] Storage upload failed",
    );
    return null;
  }
}
