/**
 * 亮点筛选模块
 *
 * @module ai-skills/periodic-report/analyzers/highlight-selector
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { HighlightBookmark } from "../types";
import type { BookmarkRow } from "../collectors/types";

// ============================================
// 亮点筛选
// ============================================

/**
 * 从书签中筛选亮点内容
 */
export function selectHighlights(
  bookmarks: BookmarkRow[],
): HighlightBookmark[] {
  const highlights: HighlightBookmark[] = [];

  // 高评分书签
  const ratedBookmarks = bookmarks
    .filter((b) => b.rating !== null && b.rating >= 4)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

  for (const b of ratedBookmarks.slice(0, 3)) {
    highlights.push({
      id: b.id,
      title: b.title,
      url: b.url,
      platform: b.platform,
      summary: b.ai_summary || undefined,
      reason: `⭐ 高评分收藏 (${b.rating} 分)`,
      createdAt: b.created_at,
    });
  }

  // 有 AI 摘要的书签
  const summarizedBookmarks = bookmarks
    .filter((b) => b.ai_summary && !ratedBookmarks.includes(b))
    .slice(0, 2);

  for (const b of summarizedBookmarks) {
    highlights.push({
      id: b.id,
      title: b.title,
      url: b.url,
      platform: b.platform,
      summary: b.ai_summary || undefined,
      reason: "📝 AI 已生成摘要，值得回顾",
      createdAt: b.created_at,
    });
  }

  // 最新收藏
  if (highlights.length < 5 && bookmarks.length > 0) {
    const latest = bookmarks.find(
      (b) => !highlights.some((h) => h.id === b.id),
    );
    if (latest) {
      highlights.push({
        id: latest.id,
        title: latest.title,
        url: latest.url,
        platform: latest.platform,
        summary: latest.ai_summary || undefined,
        reason: "🆕 最新收藏",
        createdAt: latest.created_at,
      });
    }
  }

  return highlights;
}
