/**
 * 时间近邻权重
 *
 * 用户在短时间内连续收藏的页面，即便语义上稍有偏差，
 * 极大概率也属于同一个"研究课题"或"临时项目"
 *
 * @module classification/batch-classification/algorithms/temporal-bias
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { BookmarkWithEmbedding, TemporalBiasConfig } from "../types";

// ============================================
// 默认配置
// ============================================

export const DEFAULT_TEMPORAL_BIAS_CONFIG: TemporalBiasConfig = {
  windows: [
    { maxMinutes: 5, boost: 0.08 },    // 5分钟内：高度相关
    { maxMinutes: 30, boost: 0.05 },   // 30分钟内：中度相关
    { maxMinutes: 120, boost: 0.02 },  // 2小时内：轻微相关
  ],
  considerSequence: true,
};

// ============================================
// 时间近邻权重计算
// ============================================

/**
 * 计算时间近邻权重提升
 *
 * 返回相似度提升值（0-0.08）
 */
export function computeTemporalBoost(
  a: BookmarkWithEmbedding,
  b: BookmarkWithEmbedding,
  config: TemporalBiasConfig = DEFAULT_TEMPORAL_BIAS_CONFIG,
): number {
  const timeA = a.createdAt.getTime();
  const timeB = b.createdAt.getTime();
  const diffMinutes = Math.abs(timeA - timeB) / 60000;

  // 按时间窗口查找匹配的提升值
  for (const window of config.windows) {
    if (diffMinutes <= window.maxMinutes) {
      return window.boost;
    }
  }

  return 0;
}

/**
 * 计算考虑时间因素的调整后相似度
 */
export function computeTemporalAdjustedSimilarity(
  a: BookmarkWithEmbedding,
  b: BookmarkWithEmbedding,
  baseSimilarity: number,
  config: TemporalBiasConfig = DEFAULT_TEMPORAL_BIAS_CONFIG,
): number {
  const boost = computeTemporalBoost(a, b, config);
  return Math.min(1, baseSimilarity + boost);
}

/**
 * 计算考虑时间因素的调整后距离
 */
export function computeTemporalAdjustedDistance(
  a: BookmarkWithEmbedding,
  b: BookmarkWithEmbedding,
  baseDistance: number,
  config: TemporalBiasConfig = DEFAULT_TEMPORAL_BIAS_CONFIG,
): number {
  const boost = computeTemporalBoost(a, b, config);
  // 相似度提升等价于距离减少
  return Math.max(0, baseDistance - boost);
}

/**
 * 检测时间聚类
 *
 * 找出短时间内连续收藏的书签序列
 */
export function detectTemporalClusters(
  bookmarks: BookmarkWithEmbedding[],
  maxGapMinutes: number = 30,
): number[][] {
  if (bookmarks.length === 0) {
    return [];
  }

  // 按时间排序
  const sorted = [...bookmarks].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const clusters: number[][] = [];
  let currentCluster: number[] = [sorted[0].id];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gapMinutes =
      (curr.createdAt.getTime() - prev.createdAt.getTime()) / 60000;

    if (gapMinutes <= maxGapMinutes) {
      currentCluster.push(curr.id);
    } else {
      if (currentCluster.length >= 2) {
        clusters.push(currentCluster);
      }
      currentCluster = [curr.id];
    }
  }

  // 处理最后一个聚类
  if (currentCluster.length >= 2) {
    clusters.push(currentCluster);
  }

  return clusters;
}

/**
 * 获取时间聚类统计
 */
export function getTemporalClusterStats(
  bookmarks: BookmarkWithEmbedding[],
  maxGapMinutes: number = 30,
): {
  totalClusters: number;
  totalBookmarksInClusters: number;
  avgClusterSize: number;
  largestCluster: number;
  timeSpanHours: number;
} {
  const clusters = detectTemporalClusters(bookmarks, maxGapMinutes);

  if (clusters.length === 0) {
    return {
      totalClusters: 0,
      totalBookmarksInClusters: 0,
      avgClusterSize: 0,
      largestCluster: 0,
      timeSpanHours: 0,
    };
  }

  const totalBookmarksInClusters = clusters.reduce(
    (sum, c) => sum + c.length,
    0,
  );
  const largestCluster = Math.max(...clusters.map((c) => c.length));

  // 计算时间跨度
  const times = bookmarks.map((b) => b.createdAt.getTime());
  const timeSpanHours = (Math.max(...times) - Math.min(...times)) / 3600000;

  return {
    totalClusters: clusters.length,
    totalBookmarksInClusters,
    avgClusterSize: totalBookmarksInClusters / clusters.length,
    largestCluster,
    timeSpanHours,
  };
}

/**
 * 应用时间偏置到距离矩阵
 */
export function applyTemporalBiasToDistanceMatrix(
  bookmarks: BookmarkWithEmbedding[],
  distanceMatrix: number[][],
  config: TemporalBiasConfig = DEFAULT_TEMPORAL_BIAS_CONFIG,
): number[][] {
  const n = bookmarks.length;
  const adjustedMatrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const adjustedDistance = computeTemporalAdjustedDistance(
        bookmarks[i],
        bookmarks[j],
        distanceMatrix[i][j],
        config,
      );
      adjustedMatrix[i][j] = adjustedDistance;
      adjustedMatrix[j][i] = adjustedDistance;
    }
  }

  return adjustedMatrix;
}
