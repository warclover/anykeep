/**
 * 归档候选检测步骤
 *
 * 职责：
 * - 查找可归档的书签
 *
 * @module ai-skills/skills/batch-organize/steps/archive
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { ArchiveCandidate } from "../types";
import type { BookmarkRow } from "./types";

// ============================================
// 归档候选检测
// ============================================

/**
 * 查找归档候选
 */
export function findArchiveCandidates(
  bookmarks: BookmarkRow[],
  olderThanDays: number,
): ArchiveCandidate[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const threshold = now - olderThanDays * dayMs;

  const candidates: ArchiveCandidate[] = [];

  for (const bookmark of bookmarks) {
    if (!bookmark.created_at) continue;
    const createdAt = new Date(bookmark.created_at).getTime();
    const daysSinceCreated = Math.floor((now - createdAt) / dayMs);

    if (createdAt < threshold) {
      candidates.push({
        bookmarkId: bookmark.id,
        bookmarkTitle: bookmark.title,
        daysSinceCreated,
        neverAccessed: true, // 假设未被访问
        reason: `创建于 ${daysSinceCreated} 天前，超过 ${olderThanDays} 天阈值`,
      });
    }
  }

  return candidates.sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);
}
