/**
 * 重复检测步骤
 *
 * 职责：
 * - 查找重复书签
 * - URL 规范化
 *
 * @module ai-skills/skills/batch-organize/steps/duplicate
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import { URL_VALIDATION_CONFIG } from "../../../config";
import type { DuplicateGroup } from "../types";
import type { BookmarkRow } from "./types";

// ============================================
// 重复检测
// ============================================

/**
 * 查找重复书签
 */
export function findDuplicates(bookmarks: BookmarkRow[]): DuplicateGroup[] {
  const urlMap = new Map<string, BookmarkRow[]>();

  // 按 URL 分组
  for (const bookmark of bookmarks) {
    const normalizedUrl = normalizeUrl(bookmark.url);
    const existing = urlMap.get(normalizedUrl) || [];
    existing.push(bookmark);
    urlMap.set(normalizedUrl, existing);
  }

  // 找出重复组
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [normalizedUrl, items] of urlMap) {
    if (items.length > 1) {
      // 按创建时间排序，推荐保留最早的
      items.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      duplicateGroups.push({
        normalizedUrl,
        bookmarks: items.map((b) => ({
          id: b.id,
          title: b.title,
          createdAt: b.created_at,
          folderId: b.folder_id,
        })),
        keepBookmarkId: items[0].id,
      });
    }
  }

  return duplicateGroups;
}

// ============================================
// URL 规范化
// ============================================

/**
 * 规范化 URL
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // 安全检查：仅允许 http/https 协议
    if (
      !URL_VALIDATION_CONFIG.ALLOWED_PROTOCOLS.includes(
        parsed.protocol as "http:" | "https:",
      )
    ) {
      logger.warn(
        { url, protocol: parsed.protocol },
        "Invalid protocol in URL",
      );
      return url.toLowerCase();
    }

    // 移除协议、www、尾部斜杠、hash
    return (
      parsed.host.replace(/^www\./, "") + parsed.pathname.replace(/\/$/, "")
    );
  } catch (error) {
    logger.debug(
      { url, error: error instanceof Error ? error.message : String(error) },
      "Failed to parse URL",
    );
    return url.toLowerCase();
  }
}
