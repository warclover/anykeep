/**
 * DBSCAN 聚类算法实现
 *
 * 基于余弦相似度的密度聚类
 *
 * @module folder/organization/services/smart-sorting/clustering/dbscan
 * @version 1.0.0
 * @since 2026-03-11 - Migrated from classification-v1
 */

import type { PendingBookmark, Cluster } from "../types";
import { CLUSTERING_CONFIG } from "../types";
import {
  computeSimilarityMatrix,
  computeCentroid,
  computeAverageSimilarity,
} from "./similarity";

// ============================================
// DBSCAN 聚类
// ============================================

/**
 * DBSCAN 聚类算法
 * 基于余弦相似度进行密度聚类
 */
export function performClustering(bookmarks: PendingBookmark[]): Cluster[] {
  if (bookmarks.length < CLUSTERING_CONFIG.MIN_CLUSTER_SIZE) {
    return [];
  }

  const clusters: Cluster[] = [];
  const visited = new Set<number>();
  const clustered = new Set<number>();

  // 预计算相似度矩阵
  const similarityMatrix = computeSimilarityMatrix(bookmarks);

  for (let i = 0; i < bookmarks.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    // 找到邻居
    const neighbors = findNeighbors(i, similarityMatrix);

    if (neighbors.length >= CLUSTERING_CONFIG.MIN_CLUSTER_SIZE - 1) {
      // 扩展聚类
      const clusterIndices = expandCluster(
        i,
        neighbors,
        visited,
        clustered,
        similarityMatrix,
      );

      if (
        clusterIndices.length >= CLUSTERING_CONFIG.MIN_CLUSTER_SIZE &&
        clusterIndices.length <= CLUSTERING_CONFIG.MAX_CLUSTER_SIZE
      ) {
        const clusterBookmarks = clusterIndices.map((idx) => bookmarks[idx]);
        const centroid = computeCentroid(clusterBookmarks);
        const avgSimilarity = computeAverageSimilarity(
          clusterIndices,
          similarityMatrix,
        );

        clusters.push({
          id: crypto.randomUUID(),
          bookmarks: clusterBookmarks,
          centroid,
          avgSimilarity,
          suggestedName: null,
          suggestedNameReason: null,
        });
      }
    }
  }

  // 按聚类大小排序（大的优先）
  return clusters.sort((a, b) => b.bookmarks.length - a.bookmarks.length);
}

// ============================================
// 辅助函数
// ============================================

/**
 * 找到邻居点
 */
function findNeighbors(
  pointIdx: number,
  similarityMatrix: number[][],
): number[] {
  const neighbors: number[] = [];
  const row = similarityMatrix[pointIdx];

  for (let i = 0; i < row.length; i++) {
    if (i !== pointIdx && row[i] >= CLUSTERING_CONFIG.MIN_SIMILARITY) {
      neighbors.push(i);
    }
  }

  return neighbors;
}

/**
 * 扩展聚类
 */
function expandCluster(
  pointIdx: number,
  neighbors: number[],
  visited: Set<number>,
  clustered: Set<number>,
  similarityMatrix: number[][],
): number[] {
  const cluster = [pointIdx];
  clustered.add(pointIdx);

  const queue = [...neighbors];

  while (
    queue.length > 0 &&
    cluster.length < CLUSTERING_CONFIG.MAX_CLUSTER_SIZE
  ) {
    const current = queue.shift();
    if (current === undefined) break;

    if (!visited.has(current)) {
      visited.add(current);
      const currentNeighbors = findNeighbors(current, similarityMatrix);

      if (currentNeighbors.length >= CLUSTERING_CONFIG.MIN_CLUSTER_SIZE - 1) {
        for (const neighbor of currentNeighbors) {
          if (!clustered.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
    }

    if (!clustered.has(current)) {
      cluster.push(current);
      clustered.add(current);
    }
  }

  return cluster;
}
