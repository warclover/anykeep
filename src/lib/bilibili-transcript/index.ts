/**
 * B站视频字幕自动提取模块
 *
 * @module bilibili-transcript
 * @description 收藏B站视频时自动触发字幕提取
 *
 * Phase 5 升级：UX 优化 - B站字幕自动提取
 */

import { bilibiliTranscriptSkill } from "@/lib/ai-skills/skills/bilibili-transcript";
import { logger } from "@/lib/logger";

/**
 * 自动提取B站视频字幕
 *
 * 流程：
 * 1. 检查 URL 是否为 B站视频
 * 2. 调用 BilibiliTranscriptSkill 提取字幕
 * 3. 字幕自动保存到书签记录
 *
 * @param bookmarkId - 书签 ID
 * @param userId - 用户 ID
 * @param url - B站视频 URL
 */
export async function autoFetchBilibiliTranscript(
  bookmarkId: number,
  userId: string,
  url: string,
): Promise<void> {
  const logPrefix = "[BilibiliTranscript]";

  try {
    logger.info(
      { bookmarkId, url: url.substring(0, 80), action: "auto_fetch_start" },
      `${logPrefix} Starting auto-fetch for Bilibili video transcript`,
    );

    // 检查是否为有效的B站视频 URL
    if (!isBilibiliVideoUrl(url)) {
      logger.debug(
        { bookmarkId, url: url.substring(0, 80) },
        `${logPrefix} Not a valid Bilibili video URL, skipping`,
      );
      return;
    }

    // 调用 Skill 提取字幕
    const result = await bilibiliTranscriptSkill.execute(
      {
        url,
        bookmarkId,
        format: "text", // 默认使用纯文本格式
        saveToBookmark: true, // 保存到书签记录
      },
      {
        userId,
        conversationId: `auto-transcript-${bookmarkId}`,
      },
    );

    // 检查执行结果
    if (!result.success) {
      logger.warn(
        {
          bookmarkId,
          error: result.error,
          errorCode: result.errorCode,
          action: "auto_fetch_failed",
        },
        `${logPrefix} Skill execution failed: ${result.error}`,
      );
      return;
    }

    const data = result.data;

    if (data.transcriptStatus === "available") {
      logger.info(
        {
          bookmarkId,
          bvid: data.videoInfo.bvid,
          wordCount: data.transcript?.wordCount,
          action: "auto_fetch_success",
        },
        `${logPrefix} Transcript extracted successfully`,
      );
    } else if (data.transcriptStatus === "not_available") {
      logger.info(
        {
          bookmarkId,
          bvid: data.videoInfo.bvid,
          action: "auto_fetch_no_subtitle",
        },
        `${logPrefix} Video has no CC subtitle`,
      );
    } else {
      logger.warn(
        {
          bookmarkId,
          status: data.transcriptStatus,
          action: "auto_fetch_status",
        },
        `${logPrefix} Transcript fetch returned status: ${data.transcriptStatus}`,
      );
    }
  } catch (error) {
    // 自动提取失败不影响书签创建
    logger.error(
      {
        bookmarkId,
        url: url.substring(0, 80),
        error: error instanceof Error ? error.message : String(error),
        action: "auto_fetch_failed",
      },
      `${logPrefix} Auto-fetch failed (non-blocking)`,
    );
  }
}

/**
 * 检查是否为B站视频 URL
 */
export function isBilibiliVideoUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // 检查域名
    if (!hostname.includes("bilibili.com") && !hostname.includes("b23.tv")) {
      return false;
    }

    // 检查路径（需要包含 /video/）
    // 短链 b23.tv 不需要检查路径
    if (hostname.includes("b23.tv")) {
      return true;
    }

    return urlObj.pathname.includes("/video/");
  } catch {
    // URL 解析失败，尝试简单匹配
    return (
      url.toLowerCase().includes("bilibili.com/video/") ||
      url.toLowerCase().includes("b23.tv/")
    );
  }
}
