/**
 * Full Snapshot Processor (V4.2.1)
 * 完整快照处理器 - 使用 Browserless 生成截图和完整 HTML
 *
 * 与其他快照的区别：
 * - Basic: 仅保存 Readability 提取的正文
 * - Standard: 保存完整 HTML（CSS 内联、图片转 base64）
 * - Full: 完整 HTML + 页面截图（使用无头浏览器渲染）
 *
 * 适用场景：
 * - Pro+ 用户
 * - 动态渲染页面（SPA/CSR）
 * - 需要视觉存档的页面
 * - JavaScript 渲染内容
 */

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import { snapshotService } from "../snapshot.service";
import {
  getBrowserlessService,
  isBrowserlessConfigured,
} from "../services/browserless.service";
import type {
  SnapshotJobPayload,
  SnapshotProcessResult,
  ReadabilityResult,
  BookmarkSnapshotUpdate,
} from "../snapshot.types";

// ============================================================================
// 常量配置
// ============================================================================

const _MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB
const _MAX_HTML_SIZE = 20 * 1024 * 1024; // 20MB

// ============================================================================
// 主处理函数
// ============================================================================

/**
 * 处理完整快照任务（含截图）
 */
export async function processFullSnapshot(job: {
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
    "[FullProcessor] Starting full snapshot job",
  );

  // 检查 Browserless 是否配置
  if (!isBrowserlessConfigured()) {
    logger.error(
      { snapshotId: snapshot_id },
      "[FullProcessor] Browserless not configured",
    );

    await snapshotService.updateSnapshot(snapshot_id, {
      status: "failed",
      error_message: "完整快照服务未配置，请联系管理员",
    });

    return {
      success: false,
      snapshotId: snapshot_id,
      error: "Browserless not configured",
    };
  }

  try {
    // 1. 更新状态为处理中
    await snapshotService.updateSnapshot(snapshot_id, {
      status: "processing",
    });

    // 2. 使用 Browserless 获取截图和 HTML
    const browserless = getBrowserlessService();
    const captureResult = await browserless.captureFullSnapshot(url, {
      fullPage: true,
      type: "png",
      device: "desktop",
    });

    if (!captureResult.success || !captureResult.data) {
      throw new Error(captureResult.error || "Browserless capture failed");
    }

    const { screenshot, html, htmlSize } = captureResult.data;

    // 3. 从渲染后的 HTML 提取 Readability 内容
    const readability = parseWithReadability(html, url);

    // 4. 计算内容哈希
    const contentHash = calculateHash(html);

    // 5. 上传截图到 Storage
    const screenshotPath = await uploadScreenshot(
      snapshot_id,
      job.userId,
      bookmark_id,
      screenshot.buffer,
    );

    // 6. 上传 HTML 到 Storage（如果较大）
    let htmlStoragePath: string | undefined;
    if (htmlSize > 500 * 1024) {
      htmlStoragePath = await uploadHtml(
        snapshot_id,
        job.userId,
        bookmark_id,
        html,
      );
    }

    // 7. 计算总文件大小
    const readableSize = readability
      ? Buffer.byteLength(readability.content, "utf8")
      : 0;
    const totalSize = readableSize + htmlSize + screenshot.size;

    // 8. 生成摘要
    const excerpt = readability
      ? generateExcerpt(readability.textContent, 300)
      : "";

    // 9. 更新快照记录
    const update: BookmarkSnapshotUpdate = {
      status: "completed",
      // Readability 提取内容（如果成功）
      ...(readability && {
        readable_title: readability.title || undefined,
        readable_content: readability.content,
        readable_text_content: readability.textContent,
        readable_excerpt: excerpt,
        readable_byline: readability.byline || undefined,
        readable_word_count: readability.length,
      }),
      // 存储路径
      screenshot_storage_path: screenshotPath,
      html_storage_path: htmlStoragePath,
      // 元数据
      content_hash: contentHash,
      file_size: totalSize,
      captured_at: new Date().toISOString(),
    };

    await snapshotService.updateSnapshot(snapshot_id, update);

    logger.info(
      {
        snapshotId: snapshot_id,
        screenshotSize: screenshot.size,
        htmlSize,
        totalSize,
        hasReadability: !!readability,
      },
      "[FullProcessor] Full snapshot completed",
    );

    return {
      success: true,
      snapshotId: snapshot_id,
      readability: readability || undefined,
      contentHash,
      fileSize: totalSize,
      screenshotPath,
      htmlPath: htmlStoragePath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      { snapshotId: snapshot_id, error: errorMessage },
      "[FullProcessor] Full snapshot failed",
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
      logger.warn({ url }, "[FullProcessor] Readability could not parse page");
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
      "[FullProcessor] Readability parsing failed",
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
 * 上传截图到 Supabase Storage
 */
async function uploadScreenshot(
  snapshotId: number,
  userId: string,
  bookmarkId: number,
  buffer: Buffer,
): Promise<string> {
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();

  const storagePath = `${userId}/${bookmarkId}/${snapshotId}/screenshot.png`;

  const { error } = await supabase.storage
    .from("snapshots")
    .upload(storagePath, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    logger.error({ error }, "[FullProcessor] Failed to upload screenshot");
    throw new Error(`Screenshot upload failed: ${error.message}`);
  }

  logger.info(
    { storagePath, size: buffer.length },
    "[FullProcessor] Screenshot uploaded",
  );

  return storagePath;
}

/**
 * 上传 HTML 到 Supabase Storage
 */
async function uploadHtml(
  snapshotId: number,
  userId: string,
  bookmarkId: number,
  html: string,
): Promise<string> {
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();

  const storagePath = `${userId}/${bookmarkId}/${snapshotId}/full.html`;

  const { error } = await supabase.storage
    .from("snapshots")
    .upload(storagePath, html, {
      contentType: "text/html; charset=utf-8",
      upsert: true,
    });

  if (error) {
    logger.error({ error }, "[FullProcessor] Failed to upload HTML");
    throw new Error(`HTML upload failed: ${error.message}`);
  }

  logger.info(
    { storagePath, size: html.length },
    "[FullProcessor] HTML uploaded",
  );

  return storagePath;
}
