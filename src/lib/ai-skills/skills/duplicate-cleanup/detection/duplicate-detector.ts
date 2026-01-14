/**
 * 重复书签检测器
 *
 * 提供 URL 匹配和语义相似度两种重复检测方法
 *
 * @module duplicate-cleanup/detection/duplicate-detector
 * @version 1.0.0
 * @since 2025-12-25
 */

import type {
  DuplicateGroup,
  DuplicateBookmark,
  DuplicateStrategy,
} from "../types";
import { DUPLICATE_CLEANUP_CONFIG } from "../types";
import { calculateCombinedSimilarity } from "../utils/similarity";
import type { BookmarkRow as BookmarkRowBase } from "@/types/domain";

// ============================================
// 类型定义
// ============================================

/**
 * BookmarkRow 扩展（包含 folders 关联）
 */
export interface BookmarkRow extends Pick<
  BookmarkRowBase,
  "id" | "title" | "url" | "platform" | "ai_summary" | "ai_tags" | "user_tags" | "folder_id" | "created_at"
> {
  folders?: Array<{ name: string }> | { name: string } | null;
}

/**
 * 带规范化 URL 的书签行
 */
export type NormalizedBookmarkRow = BookmarkRow & { normalizedUrl: string };

// ============================================
// 辅助函数
// ============================================

/**
 * 转换为显示用的书签对象
 */
export function toDisplayBookmark(row: BookmarkRow): DuplicateBookmark {
  const folder = Array.isArray(row.folders) ? row.folders[0] : row.folders;

  return {
    id: row.id,
    title: row.title,
    url: row.url,
    createdAt: row.created_at || new Date().toISOString(),
    folderName: folder?.name,
    folderId: row.folder_id || undefined,
    completeness: 0, // 后续计算
    hasSummary: !!row.ai_summary,
    tagCount: (row.ai_tags?.length || 0) + (row.user_tags?.length || 0),
  };
}

// ============================================
// URL 匹配检测
// ============================================

/**
 * 基于 URL 检测重复书签（精确匹配或规范化匹配）
 */
export function detectUrlDuplicates(
  bookmarks: NormalizedBookmarkRow[],
  strategy: "exact" | "normalized",
): DuplicateGroup[] {
  const urlMap = new Map<string, NormalizedBookmarkRow[]>();

  // 根据策略分组
  for (const bookmark of bookmarks) {
    const key = strategy === "exact" ? bookmark.url : bookmark.normalizedUrl;

    const existing = urlMap.get(key) || [];
    existing.push(bookmark);
    urlMap.set(key, existing);
  }

  // 找出重复组
  const groups: DuplicateGroup[] = [];
  let groupIndex = 0;

  for (const [normalizedUrl, items] of urlMap) {
    if (items.length > 1) {
      groupIndex++;
      groups.push({
        id: `dup-${groupIndex}`,
        strategy,
        normalizedUrl,
        bookmarks: items.map((b) => toDisplayBookmark(b)),
        recommendedKeep: items[0].id, // 临时，后续分析会更新
        reason: "",
      });
    }
  }

  return groups;
}

// ============================================
// 语义相似度检测
// ============================================

/**
 * 语义相似度检测 - 基于标签和标题的组合相似度
 * 使用 Union-Find 算法进行聚类
 */
export function detectSemanticDuplicates(
  bookmarks: NormalizedBookmarkRow[],
  threshold: number = DUPLICATE_CLEANUP_CONFIG.DEFAULT_SEMANTIC_THRESHOLD,
): DuplicateGroup[] {
  const n = bookmarks.length;
  if (n < 2) return [];

  // Union-Find 数据结构
  const parent = new Array(n).fill(0).map((_, i) => i);
  const rank = new Array(n).fill(0);

  const find = (x: number): number => {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]); // 路径压缩
    }
    return parent[x];
  };

  const union = (x: number, y: number): void => {
    const px = find(x);
    const py = find(y);
    if (px === py) return;

    // 按秩合并
    if (rank[px] < rank[py]) {
      parent[px] = py;
    } else if (rank[px] > rank[py]) {
      parent[py] = px;
    } else {
      parent[py] = px;
      rank[px]++;
    }
  };

  // 记录每对书签的相似度（用于后续显示）
  const similarityMap = new Map<string, number>();

  // 计算所有书签对的相似度并合并相似组
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const similarity = calculateCombinedSimilarity(
        bookmarks[i],
        bookmarks[j],
      );

      if (similarity >= threshold) {
        union(i, j);
        // 记录相似度
        const key = `${Math.min(bookmarks[i].id, bookmarks[j].id)}-${Math.max(bookmarks[i].id, bookmarks[j].id)}`;
        similarityMap.set(key, similarity);
      }
    }
  }

  // 按根节点分组
  const groupMap = new Map<
    number,
    {
      bookmarks: NormalizedBookmarkRow[];
      maxSimilarity: number;
    }
  >();

  for (let i = 0; i < n; i++) {
    const root = find(i);
    let group = groupMap.get(root);
    if (!group) {
      group = { bookmarks: [], maxSimilarity: 0 };
      groupMap.set(root, group);
    }
    group.bookmarks.push(bookmarks[i]);
  }

  // 计算每组的最高相似度
  for (const [, group] of groupMap) {
    if (group.bookmarks.length > 1) {
      for (let i = 0; i < group.bookmarks.length; i++) {
        for (let j = i + 1; j < group.bookmarks.length; j++) {
          const key = `${Math.min(group.bookmarks[i].id, group.bookmarks[j].id)}-${Math.max(group.bookmarks[i].id, group.bookmarks[j].id)}`;
          const sim = similarityMap.get(key) ?? 0;
          if (sim > group.maxSimilarity) {
            group.maxSimilarity = sim;
          }
        }
      }
    }
  }

  // 转换为 DuplicateGroup 格式
  const groups: DuplicateGroup[] = [];
  let groupIndex = 0;

  for (const [, { bookmarks: items, maxSimilarity }] of groupMap) {
    if (items.length > 1) {
      groupIndex++;
      // 使用第一个书签的标题作为组标识
      const representativeTitle = items[0].title.slice(0, 50);

      groups.push({
        id: `sem-${groupIndex}`,
        strategy: "semantic",
        normalizedUrl: `[语义相似] ${representativeTitle}...`,
        similarity: Math.round(maxSimilarity * 100) / 100,
        bookmarks: items.map((b) => toDisplayBookmark(b)),
        recommendedKeep: items[0].id, // 临时，后续分析会更新
        reason: `相似度: ${Math.round(maxSimilarity * 100)}%`,
      });
    }
  }

  return groups;
}

// ============================================
// 统一检测入口
// ============================================

/**
 * 检测重复书签（统一入口）
 */
export function detectDuplicates(
  bookmarks: NormalizedBookmarkRow[],
  strategy: DuplicateStrategy,
  semanticThreshold?: number,
): DuplicateGroup[] {
  if (strategy === "semantic") {
    return detectSemanticDuplicates(
      bookmarks,
      semanticThreshold ?? DUPLICATE_CLEANUP_CONFIG.DEFAULT_SEMANTIC_THRESHOLD,
    );
  }

  return detectUrlDuplicates(bookmarks, strategy);
}
