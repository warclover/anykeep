/**
 * 标签建议生成步骤
 *
 * 职责：
 * - 生成书签标签建议
 *
 * @module ai-skills/skills/batch-organize/steps/tag
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { TagSuggestion } from "../types";
import type { BookmarkRow } from "./types";

// ============================================
// 标签建议生成
// ============================================

/**
 * 生成标签建议
 */
export function generateTagSuggestions(
  bookmarks: BookmarkRow[],
): TagSuggestion[] {
  const suggestions: TagSuggestion[] = [];

  // 只处理标签较少的书签
  const needTags = bookmarks.filter(
    (b) => (b.user_tags?.length || 0) < 2 && (b.ai_tags?.length || 0) > 0,
  );

  for (const bookmark of needTags) {
    const aiTags = bookmark.ai_tags || [];
    const userTags = bookmark.user_tags || [];

    // 推荐未添加的 AI 标签
    const suggestedTags = aiTags
      .filter((t) => !userTags.includes(t))
      .slice(0, 3);

    if (suggestedTags.length > 0) {
      suggestions.push({
        bookmarkId: bookmark.id,
        bookmarkTitle: bookmark.title,
        currentTags: userTags,
        suggestedTags,
        confidence: 0.8,
      });
    }
  }

  return suggestions;
}
