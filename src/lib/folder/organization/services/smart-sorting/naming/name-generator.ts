/**
 * 文件夹名称生成模块
 *
 * @module folder/organization/services/smart-sorting/naming/name-generator
 * @version 1.0.0
 * @since 2026-03-11 - Migrated from classification-v1
 */

import { generateFolderNameFromBookmarks } from "@/lib/ai-generator";
import type { Cluster } from "../types";

// ============================================
// AI 名称生成
// ============================================

/**
 * 为聚类生成文件夹名称
 */
export async function generateClusterName(
  cluster: Cluster,
): Promise<{ name: string; reason: string }> {
  // 收集聚类信息
  const titles = cluster.bookmarks.map((b) => b.title);
  const tags = cluster.bookmarks
    .flatMap((b) => b.ai_tags || [])
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
    .slice(0, 10);
  const summaries = cluster.bookmarks
    .map((b) => b.ai_summary)
    .filter(Boolean)
    .slice(0, 3);

  // 调用 AI 生成名称
  const result = await generateFolderNameFromBookmarks({
    titles,
    tags,
    summaries: summaries as string[],
    count: cluster.bookmarks.length,
  });

  return {
    name: result.name,
    reason: result.reason || "基于内容相似性自动分析",
  };
}

// ============================================
// 备用名称生成
// ============================================

/**
 * 生成备用名称（当 AI 生成失败时）
 */
export function generateFallbackName(cluster: Cluster): string {
  // 使用最常见的标签
  const tagCounts = new Map<string, number>();
  for (const bookmark of cluster.bookmarks) {
    for (const tag of bookmark.ai_tags || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const sortedTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([tag]) => tag);

  if (sortedTags.length > 0) {
    return sortedTags.join(" & ");
  }

  // 使用第一个书签标题的关键词
  const firstTitle = cluster.bookmarks[0]?.title || "新文件夹";
  return firstTitle.length > 20
    ? firstTitle.substring(0, 20) + "..."
    : firstTitle;
}
