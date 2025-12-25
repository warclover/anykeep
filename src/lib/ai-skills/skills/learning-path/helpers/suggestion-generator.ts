/**
 * 学习建议生成器
 *
 * @module learning-path/helpers/suggestion-generator
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { LearningSuggestion } from "../types";
import type { BookmarkRow } from "./bookmark-fetcher";

// ============================================
// 建议生成函数
// ============================================

/**
 * 根据书签生成学习建议
 */
export function generateSuggestions(
  bookmarks: BookmarkRow[],
): LearningSuggestion[] {
  const suggestions: LearningSuggestion[] = [];

  // 分析标签频率
  const topTags = analyzeTopTags(bookmarks);

  // 热门主题建议
  if (topTags.length > 0) {
    suggestions.push(createPathSuggestion(topTags[0][0]));
  }

  // 学习习惯建议
  if (bookmarks.length > 20) {
    suggestions.push(createHabitSuggestion());
  }

  // 复习建议
  const oldBookmarkCount = countOldBookmarks(bookmarks, 7);
  if (oldBookmarkCount > 5) {
    suggestions.push(createReviewSuggestion(oldBookmarkCount));
  }

  // 默认建议
  if (suggestions.length === 0) {
    suggestions.push(createDefaultSuggestion());
  }

  return suggestions;
}

/**
 * 分析热门标签
 */
function analyzeTopTags(bookmarks: BookmarkRow[]): Array<[string, number]> {
  const tagCounts = new Map<string, number>();

  for (const b of bookmarks) {
    for (const tag of b.ai_tags || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
}

/**
 * 统计超过指定天数的书签数量
 */
function countOldBookmarks(
  bookmarks: BookmarkRow[],
  daysThreshold: number,
): number {
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return bookmarks.filter((b) => {
    const age = now - new Date(b.created_at).getTime();
    return age > thresholdMs;
  }).length;
}

/**
 * 创建学习路径建议
 */
function createPathSuggestion(topic: string): LearningSuggestion {
  return {
    type: "path",
    title: "创建学习路径",
    description: `您收藏了很多关于「${topic}」的内容，建议创建一条专门的学习路径`,
    icon: "📚",
  };
}

/**
 * 创建学习习惯建议
 */
function createHabitSuggestion(): LearningSuggestion {
  return {
    type: "habit",
    title: "制定学习计划",
    description: "您的收藏数量较多，建议制定每日学习计划，避免内容积压",
    icon: "📅",
  };
}

/**
 * 创建复习建议
 */
function createReviewSuggestion(oldCount: number): LearningSuggestion {
  return {
    type: "review",
    title: "复习旧内容",
    description: `有 ${oldCount} 条收藏超过一周未复习，建议安排复习时间`,
    icon: "🔄",
  };
}

/**
 * 创建默认建议
 */
function createDefaultSuggestion(): LearningSuggestion {
  return {
    type: "habit",
    title: "开始学习",
    description: "选择一个感兴趣的主题，创建您的第一条学习路径吧！",
    icon: "🚀",
  };
}
