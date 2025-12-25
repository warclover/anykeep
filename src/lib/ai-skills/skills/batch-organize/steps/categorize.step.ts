/**
 * 分类建议生成步骤
 *
 * 职责：
 * - 生成书签分类建议
 * - 推荐匹配的文件夹
 *
 * @module ai-skills/skills/batch-organize/steps/categorize
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { CategorizeSuggestion } from "../types";
import type { BookmarkRow, FolderRow, FolderSuggestionResult } from "./types";

// ============================================
// 平台-文件夹映射
// ============================================

const PLATFORM_FOLDER_MAP: Record<string, string[]> = {
  wechat: ["微信", "公众号", "阅读"],
  bilibili: ["视频", "B站", "娱乐"],
  zhihu: ["知乎", "问答", "学习"],
  github: ["开发", "技术", "代码"],
  twitter: ["社交", "资讯"],
  xiaohongshu: ["小红书", "生活"],
};

// ============================================
// 分类建议生成
// ============================================

/**
 * 生成分类建议
 */
export function generateCategorizeSuggestions(
  bookmarks: BookmarkRow[],
  folders: FolderRow[],
): CategorizeSuggestion[] {
  const suggestions: CategorizeSuggestion[] = [];

  // 只处理未分类的书签
  const uncategorized = bookmarks.filter((b) => !b.folder_id);

  for (const bookmark of uncategorized) {
    const suggestion = suggestFolder(bookmark, folders);
    if (suggestion) {
      suggestions.push({
        bookmarkId: bookmark.id,
        bookmarkTitle: bookmark.title,
        currentFolder: null,
        ...suggestion,
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * 推荐文件夹
 */
export function suggestFolder(
  bookmark: BookmarkRow,
  folders: FolderRow[],
): FolderSuggestionResult | null {
  if (folders.length === 0) {
    return null;
  }

  const platformKeywords = PLATFORM_FOLDER_MAP[bookmark.platform] || [];

  // 基于标签推荐
  const allTags = [...(bookmark.ai_tags || []), ...(bookmark.user_tags || [])];

  // 匹配文件夹
  let bestMatch: FolderRow | null = null;
  let bestScore = 0;

  for (const folder of folders) {
    let score = 0;
    const folderNameLower = folder.name.toLowerCase();

    // 平台关键词匹配
    for (const keyword of platformKeywords) {
      if (folderNameLower.includes(keyword.toLowerCase())) {
        score += 0.5;
      }
    }

    // 标签匹配
    for (const tag of allTags) {
      if (folderNameLower.includes(tag.toLowerCase())) {
        score += 0.3;
      }
    }

    // 标题关键词匹配
    const titleWords = bookmark.title.split(/\s+/);
    for (const word of titleWords) {
      if (word.length > 2 && folderNameLower.includes(word.toLowerCase())) {
        score += 0.2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = folder;
    }
  }

  if (bestMatch && bestScore > 0.2) {
    return {
      suggestedFolder: bestMatch.name,
      suggestedFolderId: bestMatch.id,
      confidence: Math.min(0.95, bestScore),
      reason: `基于平台(${bookmark.platform})和内容特征匹配`,
    };
  }

  return null;
}
