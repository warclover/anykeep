/**
 * Clustering utilities for inbox organization
 */

import {
  cosineSimilarity,
  calculateCentroid,
  calculateInternalSimilarity,
} from "./similarity";
import type { BookmarkCluster } from "../types";

/**
 * Bookmark item for clustering
 */
interface ClusterItem {
  id: number;
  embedding: number[];
  title: string;
}

/**
 * V4.2.5: 层次聚类性能保护常量
 *
 * 时间复杂度分析：
 * - 层次聚类的时间复杂度为 O(n³)（n 个项目，每次迭代 O(n²) 比较，最多 n 次迭代）
 * - 当 n > 500 时，性能开始显著下降
 * - 当 n > 1000 时，可能导致 API 超时
 *
 * 解决方案：
 * - 限制最大处理项目数为 500
 * - 超过限制时降级为 K-means 聚类（O(nk)）
 */
const MAX_HIERARCHICAL_ITEMS = 500;
const MAX_ITERATIONS = 10000; // 防止无限循环

/**
 * Cluster bookmarks using hierarchical agglomerative clustering
 * @param items Bookmarks to cluster
 * @param similarityThreshold Minimum similarity to merge clusters (0-1)
 * @param minClusterSize Minimum cluster size to include in results
 *
 * V4.2.5: 添加性能保护，大数据集自动降级为 K-means
 */
export function clusterBookmarks(
  items: ClusterItem[],
  similarityThreshold: number,
  minClusterSize: number,
): BookmarkCluster[] {
  if (items.length === 0) {
    return [];
  }

  // V4.2.5: 大数据集性能保护 - 自动降级为 K-means
  if (items.length > MAX_HIERARCHICAL_ITEMS) {
    // 估算聚类数量：假设平均每个聚类 5 个项目
    const estimatedK = Math.ceil(items.length / 5);
    const k = Math.max(2, Math.min(estimatedK, 50)); // 限制在 2-50 之间
    return kMeansClustering(items, k);
  }

  // Initialize: each item is its own cluster
  let clusters: ClusterItem[][] = items.map((item) => [item]);

  // V4.2.5: 添加迭代计数器防止无限循环
  let iterations = 0;

  // Merge until no more merges possible
  let merged = true;
  while (merged && iterations < MAX_ITERATIONS) {
    merged = false;
    iterations++;

    // Find the two most similar clusters
    let bestI = -1;
    let bestJ = -1;
    let bestSimilarity = similarityThreshold;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const similarity = calculateClusterSimilarity(clusters[i], clusters[j]);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestI = i;
          bestJ = j;
        }
      }
    }

    // Merge the two most similar clusters
    if (bestI !== -1 && bestJ !== -1) {
      const mergedCluster = [...clusters[bestI], ...clusters[bestJ]];
      clusters = clusters.filter(
        (_, index) => index !== bestI && index !== bestJ,
      );
      clusters.push(mergedCluster);
      merged = true;
    }
  }

  // Filter clusters by minimum size and convert to result format
  return clusters
    .filter((cluster) => cluster.length >= minClusterSize)
    .map((cluster) => convertToBookmarkCluster(cluster));
}

/**
 * Calculate similarity between two clusters (average linkage)
 */
function calculateClusterSimilarity(
  cluster1: ClusterItem[],
  cluster2: ClusterItem[],
): number {
  let totalSimilarity = 0;
  let count = 0;

  for (const item1 of cluster1) {
    for (const item2 of cluster2) {
      totalSimilarity += cosineSimilarity(item1.embedding, item2.embedding);
      count++;
    }
  }

  return count > 0 ? totalSimilarity / count : 0;
}

/**
 * Convert cluster items to BookmarkCluster format
 *
 * V4.2.5: 添加空聚类防御性检查
 */
function convertToBookmarkCluster(items: ClusterItem[]): BookmarkCluster {
  // V4.2.5: 防御性检查 - 空聚类返回安全默认值
  if (!items || items.length === 0) {
    return {
      bookmarkIds: [],
      centroid: [],
      avgSimilarity: 0,
      sampleTitles: [],
    };
  }

  // V4.2.5: 过滤无效的 embedding
  const validItems = items.filter(
    (item) =>
      item.embedding &&
      Array.isArray(item.embedding) &&
      item.embedding.length > 0,
  );

  if (validItems.length === 0) {
    return {
      bookmarkIds: items.map((item) => item.id),
      centroid: [],
      avgSimilarity: 0,
      sampleTitles: items.slice(0, 5).map((item) => item.title),
    };
  }

  const embeddings = validItems.map((item) => item.embedding);
  const centroid = calculateCentroid(embeddings);
  const avgSimilarity = calculateInternalSimilarity(embeddings);

  return {
    bookmarkIds: items.map((item) => item.id),
    centroid,
    avgSimilarity,
    sampleTitles: items.slice(0, 5).map((item) => item.title),
  };
}

/**
 * Alternative: K-means clustering
 * Use when you know the expected number of clusters
 */
export function kMeansClustering(
  items: ClusterItem[],
  k: number,
  maxIterations: number = 100,
): BookmarkCluster[] {
  if (items.length === 0 || k <= 0) {
    return [];
  }

  const actualK = Math.min(k, items.length);

  // Initialize centroids randomly (using first k items)
  const centroids = items.slice(0, actualK).map((item) => [...item.embedding]);

  // Assignments: which cluster each item belongs to
  let assignments = new Array(items.length).fill(0);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Assign each item to nearest centroid
    const newAssignments = items.map((item, _index) => {
      let bestCluster = 0;
      let bestSimilarity = -1;

      for (let c = 0; c < centroids.length; c++) {
        const similarity = cosineSimilarity(item.embedding, centroids[c]);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = c;
        }
      }

      return bestCluster;
    });

    // Check for convergence
    const converged = assignments.every((a, i) => a === newAssignments[i]);
    assignments = newAssignments;

    if (converged) {
      break;
    }

    // Update centroids
    for (let c = 0; c < actualK; c++) {
      const clusterItems = items.filter((_, i) => assignments[i] === c);
      if (clusterItems.length > 0) {
        centroids[c] = calculateCentroid(
          clusterItems.map((item) => item.embedding),
        );
      }
    }
  }

  // Convert to BookmarkCluster format
  const clusters: ClusterItem[][] = Array.from({ length: actualK }, () => []);
  items.forEach((item, i) => {
    clusters[assignments[i]].push(item);
  });

  return clusters
    .filter((cluster) => cluster.length > 0)
    .map((cluster) => convertToBookmarkCluster(cluster));
}

/**
 * DBSCAN-like clustering
 * Good for discovering clusters of varying shapes
 */
export function densityClustering(
  items: ClusterItem[],
  similarityThreshold: number,
  minPoints: number,
): BookmarkCluster[] {
  const n = items.length;
  const visited = new Array(n).fill(false);
  const clusterAssignments = new Array(n).fill(-1); // -1 = noise

  let clusterId = 0;

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = true;

    // Find neighbors
    const neighbors = findNeighbors(items, i, similarityThreshold);

    if (neighbors.length < minPoints) {
      // Mark as noise (for now)
      continue;
    }

    // Start new cluster
    clusterAssignments[i] = clusterId;

    // Expand cluster
    const seedSet = [...neighbors];
    while (seedSet.length > 0) {
      const j = seedSet.pop();
      if (j === undefined) break;
      if (!visited[j]) {
        visited[j] = true;
        const jNeighbors = findNeighbors(items, j, similarityThreshold);
        if (jNeighbors.length >= minPoints) {
          seedSet.push(...jNeighbors.filter((k) => !visited[k]));
        }
      }
      if (clusterAssignments[j] === -1) {
        clusterAssignments[j] = clusterId;
      }
    }

    clusterId++;
  }

  // Group items by cluster
  const clusters: ClusterItem[][] = [];
  for (let c = 0; c < clusterId; c++) {
    const clusterItems = items.filter((_, i) => clusterAssignments[i] === c);
    if (clusterItems.length > 0) {
      clusters.push(clusterItems);
    }
  }

  return clusters.map((cluster) => convertToBookmarkCluster(cluster));
}

/**
 * Find neighbors within similarity threshold
 */
function findNeighbors(
  items: ClusterItem[],
  index: number,
  threshold: number,
): number[] {
  const neighbors: number[] = [];
  const target = items[index];

  for (let i = 0; i < items.length; i++) {
    if (i !== index) {
      const similarity = cosineSimilarity(target.embedding, items[i].embedding);
      if (similarity >= threshold) {
        neighbors.push(i);
      }
    }
  }

  return neighbors;
}
