/**
 * 相似度计算模块
 *
 * @module classification/smart-sorting/clustering/similarity
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { PendingBookmark } from "../types";

// ============================================
// 相似度矩阵计算
// ============================================

/**
 * 计算相似度矩阵
 */
export function computeSimilarityMatrix(
  bookmarks: PendingBookmark[],
): number[][] {
  const n = bookmarks.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const similarity = cosineSimilarity(
        bookmarks[i].embedding,
        bookmarks[j].embedding,
      );
      matrix[i][j] = similarity;
      matrix[j][i] = similarity;
    }
    matrix[i][i] = 1;
  }

  return matrix;
}

/**
 * 余弦相似度计算
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ============================================
// 聚类质心计算
// ============================================

/**
 * 计算聚类质心
 */
export function computeCentroid(bookmarks: PendingBookmark[]): number[] {
  if (bookmarks.length === 0) return [];

  const dim = bookmarks[0].embedding.length;
  const centroid = new Array(dim).fill(0);

  for (const bookmark of bookmarks) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += bookmark.embedding[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= bookmarks.length;
  }

  return centroid;
}

/**
 * 计算聚类平均相似度
 */
export function computeAverageSimilarity(
  indices: number[],
  matrix: number[][],
): number {
  if (indices.length <= 1) return 1;

  let sum = 0;
  let count = 0;

  for (let i = 0; i < indices.length; i++) {
    for (let j = i + 1; j < indices.length; j++) {
      sum += matrix[indices[i]][indices[j]];
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}
