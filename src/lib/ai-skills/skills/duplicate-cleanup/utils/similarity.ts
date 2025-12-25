/**
 * 相似度计算工具
 *
 * 提供标签相似度、标题相似度和组合相似度的计算方法
 *
 * @module duplicate-cleanup/utils/similarity
 * @version 1.0.0
 * @since 2025-12-25
 */

import { STOPWORDS } from "./stopwords";

// ============================================
// 类型定义
// ============================================

/**
 * 带规范化 URL 的书签数据
 */
export interface BookmarkWithNormalizedUrl {
  id: number;
  title: string;
  url: string;
  normalizedUrl: string;
  ai_tags?: string[] | null;
  user_tags?: string[] | null;
}

// ============================================
// 关键词提取
// ============================================

/**
 * 从文本中提取关键词
 */
export function extractKeywords(text: string): string[] {
  // 提取英文单词（至少2个字符）
  const englishWords =
    text
      .toLowerCase()
      .match(/[a-z]{2,}/g)
      ?.filter((w) => !STOPWORDS.has(w)) || [];

  // 提取中文词汇（至少2个字符）
  const chineseWords =
    text.match(/[\u4e00-\u9fa5]{2,}/g)?.filter((w) => !STOPWORDS.has(w)) || [];

  return [...englishWords, ...chineseWords];
}

// ============================================
// 相似度计算
// ============================================

/**
 * 计算标签的 Jaccard 相似度
 */
export function calculateTagSimilarity(
  tags1: string[],
  tags2: string[],
): number {
  if (!tags1.length || !tags2.length) return 0;

  const set1 = new Set(tags1.map((t) => t.toLowerCase()));
  const set2 = new Set(tags2.map((t) => t.toLowerCase()));

  // Jaccard 相似度
  const intersection = [...set1].filter((t) => set2.has(t)).length;
  const union = new Set([...set1, ...set2]).size;

  return union > 0 ? intersection / union : 0;
}

/**
 * 计算标题的关键词重叠相似度
 */
export function calculateTitleSimilarity(
  title1: string,
  title2: string,
): number {
  const words1 = extractKeywords(title1);
  const words2 = extractKeywords(title2);

  if (!words1.length || !words2.length) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = [...set1].filter((w) => set2.has(w)).length;
  const union = new Set([...set1, ...set2]).size;

  return union > 0 ? intersection / union : 0;
}

/**
 * 计算两个书签的组合相似度
 * 标签相似度 60% + 标题相似度 40%
 */
export function calculateCombinedSimilarity(
  a: BookmarkWithNormalizedUrl,
  b: BookmarkWithNormalizedUrl,
): number {
  // 首先检查 URL 是否相同（规范化后）
  if (a.normalizedUrl === b.normalizedUrl) {
    return 1.0; // 完全匹配
  }

  const tagSim = calculateTagSimilarity(
    [...(a.ai_tags || []), ...(a.user_tags || [])],
    [...(b.ai_tags || []), ...(b.user_tags || [])],
  );

  const titleSim = calculateTitleSimilarity(a.title, b.title);

  // 加权平均：标签 60%，标题 40%
  return tagSim * 0.6 + titleSim * 0.4;
}
