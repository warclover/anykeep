/**
 * 迭代式 DBSCAN 聚类算法
 *
 * 作为分层采样 DBSCAN 的兜底方案
 * 通过迭代调整 eps 参数，达到目标聚类覆盖率
 *
 * @module classification/batch-classification/algorithms/iterative-dbscan
 * @version 1.0.0
 * @since 2026-02-01
 */

import type {
  BookmarkWithEmbedding,
  IterativeDbscanConfig,
  ClusteringResult,
  BatchCluster,
} from "../types";
import { cosineSimilarity } from "../../smart-sorting/clustering/similarity";

// ============================================
// 默认配置
// ============================================

export const DEFAULT_ITERATIVE_DBSCAN_CONFIG: IterativeDbscanConfig = {
  initialEps: 0.2, // 初始 eps（较小，更严格）
  epsStep: 0.05, // 每次迭代增加
  maxIterations: 5, // 最大迭代次数
  targetClusterRatio: 0.7, // 目标：70% 书签被成簇
};

// ============================================
// 迭代式 DBSCAN
// ============================================

/**
 * 迭代式 DBSCAN 聚类
 *
 * 功能：
 * 1. 从较小的 eps 开始
 * 2. 逐步增加 eps 直到达到目标聚类覆盖率
 * 3. 返回最佳结果
 */
export async function iterativeDbscanClustering(
  bookmarks: BookmarkWithEmbedding[],
  config: IterativeDbscanConfig = DEFAULT_ITERATIVE_DBSCAN_CONFIG,
): Promise<ClusteringResult> {
  const startTime = performance.now();
  const n = bookmarks.length;

  if (n === 0) {
    return createEmptyResult(0);
  }

  const embeddings = bookmarks.map((b) => b.embedding);
  let eps = config.initialEps;
  let bestLabels: number[] = [];
  let bestRatio = 0;

  // 迭代调整 eps
  for (let i = 0; i < config.maxIterations; i++) {
    const labels = dbscan(embeddings, eps, 3);
    const noiseCount = labels.filter((l) => l === -1).length;
    const ratio = 1 - noiseCount / n;

    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestLabels = labels;
    }

    if (ratio >= config.targetClusterRatio) {
      break;
    }

    eps += config.epsStep;
  }

  // 构建结果
  const clusterMap = new Map<number, number[]>();
  const noiseBookmarkIds: number[] = [];

  for (let i = 0; i < bestLabels.length; i++) {
    const label = bestLabels[i];
    if (label === -1) {
      noiseBookmarkIds.push(bookmarks[i].id);
    } else {
      if (!clusterMap.has(label)) {
        clusterMap.set(label, []);
      }
      clusterMap.get(label)?.push(bookmarks[i].id);
    }
  }

  const clusters: BatchCluster[] = [];
  const bookmarkMap = new Map(bookmarks.map((b) => [b.id, b]));
  let clusterIndex = 0;

  for (const [_, memberIds] of clusterMap) {
    if (memberIds.length < 3) {
      noiseBookmarkIds.push(...memberIds);
      continue;
    }

    const centroid = computeCentroid(memberIds, bookmarkMap);
    const cohesion = computeClusterCohesion(memberIds, centroid, bookmarkMap);
    const representatives = selectRepresentatives(
      memberIds,
      centroid,
      bookmarkMap,
    );

    clusters.push({
      id: crypto.randomUUID(),
      index: clusterIndex++,
      centroid,
      memberIds,
      cohesion,
      representatives,
    });
  }

  const executionTimeMs = performance.now() - startTime;
  const clusteredPoints = n - noiseBookmarkIds.length;

  return {
    clusters,
    noiseBookmarkIds,
    stats: {
      totalPoints: n,
      clusteredPoints,
      noisePoints: noiseBookmarkIds.length,
      clusterCount: clusters.length,
      avgClusterSize:
        clusters.length > 0 ? clusteredPoints / clusters.length : 0,
      executionTimeMs,
    },
  };
}

// ============================================
// 辅助函数
// ============================================

/**
 * 基础 DBSCAN 实现
 */
function dbscan(embeddings: number[][], eps: number, minPts: number): number[] {
  const n = embeddings.length;
  const labels = new Array(n).fill(-1);
  const visited = new Set<number>();
  let clusterId = 0;

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const neighbors = findNeighbors(i, embeddings, eps);

    if (neighbors.length >= minPts - 1) {
      expandCluster(
        i,
        neighbors,
        clusterId,
        labels,
        visited,
        embeddings,
        eps,
        minPts,
      );
      clusterId++;
    }
  }

  return labels;
}

/**
 * 找到邻居点
 */
function findNeighbors(
  pointIdx: number,
  embeddings: number[][],
  eps: number,
): number[] {
  const neighbors: number[] = [];
  const point = embeddings[pointIdx];

  for (let i = 0; i < embeddings.length; i++) {
    if (i !== pointIdx) {
      const distance = 1 - cosineSimilarity(point, embeddings[i]);
      if (distance <= eps) {
        neighbors.push(i);
      }
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
  clusterId: number,
  labels: number[],
  visited: Set<number>,
  embeddings: number[][],
  eps: number,
  minPts: number,
): void {
  labels[pointIdx] = clusterId;

  const queue = [...neighbors];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    if (!visited.has(current)) {
      visited.add(current);
      const currentNeighbors = findNeighbors(current, embeddings, eps);

      if (currentNeighbors.length >= minPts - 1) {
        queue.push(...currentNeighbors);
      }
    }

    if (labels[current] === -1) {
      labels[current] = clusterId;
    }
  }
}

/**
 * 计算质心
 */
function computeCentroid(
  memberIds: number[],
  bookmarkMap: Map<number, BookmarkWithEmbedding>,
): number[] {
  const members = memberIds
    .map((id) => bookmarkMap.get(id))
    .filter((b): b is BookmarkWithEmbedding => b !== undefined);

  if (members.length === 0) return [];

  const dim = members[0].embedding.length;
  const centroid = new Array(dim).fill(0);

  for (const member of members) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += member.embedding[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= members.length;
  }

  return centroid;
}

/**
 * 计算簇内聚度
 */
function computeClusterCohesion(
  memberIds: number[],
  centroid: number[],
  bookmarkMap: Map<number, BookmarkWithEmbedding>,
): number {
  const members = memberIds
    .map((id) => bookmarkMap.get(id))
    .filter((b): b is BookmarkWithEmbedding => b !== undefined);

  if (members.length === 0) return 0;

  let totalSimilarity = 0;
  for (const member of members) {
    totalSimilarity += cosineSimilarity(member.embedding, centroid);
  }

  return totalSimilarity / members.length;
}

/**
 * 选择代表性样本
 */
function selectRepresentatives(
  memberIds: number[],
  centroid: number[],
  bookmarkMap: Map<number, BookmarkWithEmbedding>,
): { core: number[]; edge: number[] } {
  const members = memberIds
    .map((id) => bookmarkMap.get(id))
    .filter((b): b is BookmarkWithEmbedding => b !== undefined);

  if (members.length === 0) {
    return { core: [], edge: [] };
  }

  const sorted = members.sort((a, b) => {
    const distA = 1 - cosineSimilarity(a.embedding, centroid);
    const distB = 1 - cosineSimilarity(b.embedding, centroid);
    return distA - distB;
  });

  const core = sorted.slice(0, 3).map((b) => b.id);
  const edge = sorted.slice(-2).map((b) => b.id);

  return { core, edge };
}

/**
 * 创建空结果
 */
function createEmptyResult(executionTimeMs: number): ClusteringResult {
  return {
    clusters: [],
    noiseBookmarkIds: [],
    stats: {
      totalPoints: 0,
      clusteredPoints: 0,
      noisePoints: 0,
      clusterCount: 0,
      avgClusterSize: 0,
      executionTimeMs,
    },
  };
}
