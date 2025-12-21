/**
 * 微信文章自动抓取
 *
 * @module wechat-article
 * @description 收藏微信文章时自动触发快照和完整内容抓取
 *
 * Phase 4 升级：UX 优化 - 自动抓取
 */

import { snapshotService } from "@/lib/snapshot/snapshot.service";
import { wechatArticleService } from "./wechat-article.service";
import { logger } from "@/lib/logger";

/**
 * 自动抓取微信文章内容
 *
 * 流程：
 * 1. 检查是否已有快照
 * 2. 如果没有，创建快照任务
 * 3. 等待快照完成后，触发完整内容抓取
 *
 * @param bookmarkId - 书签 ID
 * @param userId - 用户 ID
 * @param url - 原始 URL（用于日志）
 */
export async function autoFetchWechatArticle(
  bookmarkId: number,
  userId: string,
  url: string,
): Promise<void> {
  const logPrefix = "[WechatAutoCrawl]";

  try {
    logger.info(
      { bookmarkId, url: url.substring(0, 80), action: "auto_crawl_start" },
      `${logPrefix} Starting auto-crawl for WeChat article`,
    );

    // 1. 检查是否已有活跃快照
    const existingSnapshot = await snapshotService.getActiveSnapshot(
      userId,
      bookmarkId,
    );

    let snapshotId: number;

    if (existingSnapshot) {
      // 已有快照
      snapshotId = existingSnapshot.id;

      logger.info(
        { bookmarkId, snapshotId, status: existingSnapshot.status },
        `${logPrefix} Found existing snapshot`,
      );

      // 如果快照已完成，直接触发完整抓取
      if (existingSnapshot.status === "completed") {
        await triggerFullContentCrawl(snapshotId, bookmarkId);
      }
      // 如果还在处理中，等待后再触发（简单实现：延迟重试）
      else if (
        existingSnapshot.status === "pending" ||
        existingSnapshot.status === "processing"
      ) {
        // 延迟 10 秒后再次检查并触发
        setTimeout(async () => {
          try {
            const updatedSnapshot = await snapshotService.getActiveSnapshot(
              userId,
              bookmarkId,
            );
            if (updatedSnapshot?.status === "completed") {
              await triggerFullContentCrawl(updatedSnapshot.id, bookmarkId);
            }
          } catch (err) {
            logger.warn(
              { bookmarkId, error: err },
              `${logPrefix} Delayed full crawl failed`,
            );
          }
        }, 10000);
      }
    } else {
      // 2. 创建新快照
      logger.info(
        { bookmarkId },
        `${logPrefix} No existing snapshot, creating new one`,
      );

      const result = await snapshotService.createSnapshot(userId, bookmarkId, {
        snapshotType: "basic",
        source: "auto-tag",
        triggerTag: "wechat-auto",
        priority: "normal",
      });

      snapshotId = result.snapshotId;

      logger.info(
        { bookmarkId, snapshotId, jobId: result.jobId },
        `${logPrefix} Snapshot task created`,
      );

      // 3. 等待快照完成后触发完整抓取
      // 使用轮询方式等待（最多等待 30 秒）
      pollForSnapshotCompletion(userId, bookmarkId, snapshotId, 30000);
    }
  } catch (error) {
    // 自动抓取失败不影响书签创建
    logger.error(
      {
        bookmarkId,
        url: url.substring(0, 80),
        error: error instanceof Error ? error.message : String(error),
        action: "auto_crawl_failed",
      },
      `${logPrefix} Auto-crawl failed (non-blocking)`,
    );
  }
}

/**
 * 触发完整内容抓取
 */
async function triggerFullContentCrawl(
  snapshotId: number,
  bookmarkId: number,
): Promise<void> {
  const logPrefix = "[WechatAutoCrawl]";

  try {
    logger.info(
      { snapshotId, bookmarkId },
      `${logPrefix} Triggering full content crawl`,
    );

    await wechatArticleService.crawlFullContent(snapshotId);

    logger.info(
      { snapshotId, bookmarkId, action: "auto_crawl_success" },
      `${logPrefix} Full content crawl completed`,
    );
  } catch (error) {
    logger.warn(
      {
        snapshotId,
        bookmarkId,
        error: error instanceof Error ? error.message : String(error),
      },
      `${logPrefix} Full content crawl failed`,
    );
  }
}

/**
 * 轮询等待快照完成
 */
function pollForSnapshotCompletion(
  userId: string,
  bookmarkId: number,
  snapshotId: number,
  maxWaitMs: number,
): void {
  const logPrefix = "[WechatAutoCrawl]";
  const pollInterval = 3000; // 3 秒检查一次
  let elapsedMs = 0;

  const poll = async () => {
    if (elapsedMs >= maxWaitMs) {
      logger.warn(
        { snapshotId, bookmarkId, elapsedMs },
        `${logPrefix} Polling timeout, giving up`,
      );
      return;
    }

    try {
      const snapshot = await snapshotService.getSnapshotById(
        userId,
        snapshotId,
      );

      if (!snapshot) {
        logger.warn(
          { snapshotId },
          `${logPrefix} Snapshot not found during polling`,
        );
        return;
      }

      if (snapshot.status === "completed") {
        await triggerFullContentCrawl(snapshotId, bookmarkId);
        return;
      }

      if (snapshot.status === "failed") {
        logger.warn(
          { snapshotId, error: snapshot.error_message },
          `${logPrefix} Snapshot failed, skipping full crawl`,
        );
        return;
      }

      // 继续轮询
      elapsedMs += pollInterval;
      setTimeout(poll, pollInterval);
    } catch (error) {
      logger.warn(
        { snapshotId, error },
        `${logPrefix} Polling error, will retry`,
      );
      elapsedMs += pollInterval;
      setTimeout(poll, pollInterval);
    }
  };

  // 启动轮询
  setTimeout(poll, pollInterval);
}

/**
 * 检查是否为微信文章 URL
 */
export function isWechatArticleUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    return (
      hostname === "mp.weixin.qq.com" ||
      hostname === "weixin.qq.com" ||
      hostname.endsWith(".weixin.qq.com")
    );
  } catch {
    return url.toLowerCase().includes("weixin.qq.com");
  }
}
