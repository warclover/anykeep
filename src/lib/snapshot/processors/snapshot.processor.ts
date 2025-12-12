/**
 * Snapshot Job Processor (V4.2.1)
 * 快照任务处理器 - 负责实际的网页内容抓取和解析
 *
 * 处理流程：
 * 1. 获取网页内容
 * 2. 使用 JSDOM 解析 DOM
 * 3. 使用 Readability 提取正文
 * 4. 计算内容哈希
 * 5. 更新快照记录
 */

import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import { snapshotService } from "../snapshot.service";
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
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 最大 5MB

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
 * 处理快照任务（供 Cron 调用）
 */
export async function processSnapshotJob(job: {
  id: string;
  type: string;
  payload: SnapshotJobPayload;
  userId: string;
  attempts: number;
}): Promise<SnapshotProcessResult> {
  const { payload } = job;
  const {
    snapshot_id,
    url,
    bookmark_id: _bookmark_id,
    snapshot_type,
  } = payload;

  logger.info(
    { snapshotId: snapshot_id, url, type: snapshot_type },
    "[SnapshotProcessor] Starting snapshot job",
  );

  try {
    // 1. 更新状态为处理中
    await snapshotService.updateSnapshot(snapshot_id, {
      status: "processing",
    });

    // 2. 获取网页内容
    const { html, finalUrl } = await fetchWebpage(url);

    // 3. 解析并提取正文
    const readability = parseWithReadability(html, finalUrl);

    if (!readability) {
      throw new Error("Readability 无法提取正文内容");
    }

    // 4. 计算内容哈希
    const contentHash = calculateHash(readability.textContent);

    // 5. 计算文件大小（估算）
    const fileSize = Buffer.byteLength(readability.content, "utf8");

    // 6. 生成摘要（前300字）
    const excerpt = generateExcerpt(readability.textContent, 300);

    // 7. 更新快照记录
    const update: BookmarkSnapshotUpdate = {
      status: "completed",
      readable_title: readability.title || undefined,
      readable_content: readability.content,
      readable_text_content: readability.textContent,
      readable_excerpt: excerpt,
      readable_byline: readability.byline || undefined,
      readable_word_count: readability.length,
      content_hash: contentHash,
      file_size: fileSize,
      final_url: finalUrl !== url ? finalUrl : undefined,
      captured_at: new Date().toISOString(),
    };

    await snapshotService.updateSnapshot(snapshot_id, update);

    logger.info(
      {
        snapshotId: snapshot_id,
        wordCount: readability.length,
        fileSize,
      },
      "[SnapshotProcessor] Snapshot completed",
    );

    return {
      success: true,
      snapshotId: snapshot_id,
      readability,
      contentHash,
      fileSize,
      finalUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      { snapshotId: snapshot_id, error: errorMessage },
      "[SnapshotProcessor] Snapshot failed",
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
      finalUrl: response.url, // 处理重定向后的最终 URL
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
    // 创建 JSDOM 实例
    const dom = new JSDOM(html, {
      url,
      // 禁用脚本执行（安全）
      runScripts: "outside-only",
      // 设置虚拟控制台以抑制警告
      virtualConsole: createVirtualConsole(),
    });

    const document = dom.window.document;

    // 移除可能干扰的元素
    removeNoisyElements(document);

    // 使用 Readability 提取
    const reader = new Readability(document, {
      charThreshold: 50, // 最小字符阈值
      // keepClasses: false, // 移除 class 属性
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
      "[SnapshotProcessor] Readability parsing failed",
    );
    return null;
  }
}

/**
 * 创建虚拟控制台（抑制 JSDOM 警告）
 */
function createVirtualConsole() {
  const virtualConsole = new VirtualConsole();

  // 只记录错误
  virtualConsole.on("error", (error: unknown) => {
    logger.debug({ error }, "[JSDOM] Console error");
  });

  return virtualConsole;
}

/**
 * 移除可能干扰 Readability 的元素
 */
function removeNoisyElements(document: Document): void {
  // 移除脚本和样式
  const selectorsToRemove = [
    "script",
    "style",
    "noscript",
    "iframe",
    "nav",
    "footer",
    "aside",
    ".advertisement",
    ".ads",
    ".ad",
    "#comments",
    ".comments",
    ".social-share",
    ".related-posts",
  ];

  for (const selector of selectorsToRemove) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    } catch {
      // 忽略选择器错误
    }
  }
}

/**
 * 计算内容 SHA256 哈希
 */
function calculateHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * 生成摘要（取前 N 个字符）
 */
function generateExcerpt(text: string, maxLength: number): string {
  // 清理空白字符
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // 在词边界截断
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}

/**
 * 处理重试失败的快照
 */
export async function processRetrySnapshot(job: {
  id: string;
  type: string;
  payload: SnapshotJobPayload;
  userId: string;
  attempts: number;
}): Promise<SnapshotProcessResult> {
  // 重试逻辑与主处理相同
  return processSnapshotJob(job);
}

/**
 * 清理过期快照
 */
export async function processCleanupSnapshots(job: {
  id: string;
  type: string;
  payload: { days_old?: number; batch_size?: number };
  userId: string;
  attempts: number;
}): Promise<{ cleaned: number }> {
  const { batch_size = 100 } = job.payload;

  try {
    // 获取过期快照
    const expiredIds = await snapshotService.getExpiredSnapshots(batch_size);

    if (expiredIds.length === 0) {
      return { cleaned: 0 };
    }

    // 标记为过期
    const cleaned = await snapshotService.markAsExpired(expiredIds);

    logger.info(
      { cleaned, total: expiredIds.length },
      "[SnapshotProcessor] Expired snapshots cleaned",
    );

    return { cleaned };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[SnapshotProcessor] Cleanup failed",
    );
    return { cleaned: 0 };
  }
}
