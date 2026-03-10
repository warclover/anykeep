/**
 * 域名协同权重
 *
 * 同一域名的书签在聚类时距离减少，提高聚类效果
 *
 * @module classification/batch-classification/algorithms/domain-weighting
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { BookmarkWithEmbedding, DomainWeightConfig } from "../types";
import {
  DEFAULT_DOMAIN_WEIGHT_CONFIG,
  getDomainCategory,
  getDomainDistanceModifier,
} from "../config/domain-whitelist";
import { cosineSimilarity } from "../utils/similarity";

// ============================================
// 域名权重调整
// ============================================

/**
 * 计算调整后的距离
 *
 * 同一专业站点的书签，距离减少 15%
 * 同一内容平台的书签，距离减少 5%
 */
export function computeAdjustedDistance(
  a: BookmarkWithEmbedding,
  b: BookmarkWithEmbedding,
  rawDistance: number,
  config: DomainWeightConfig = DEFAULT_DOMAIN_WEIGHT_CONFIG,
): number {
  let adjustedDistance = rawDistance;

  // 1. 域名权重调整
  if (a.domain === b.domain) {
    const modifier = getDomainDistanceModifier(a.domain, config);
    adjustedDistance += modifier;
  } else if (a.meaningfulDomain === b.meaningfulDomain) {
    // 同一组织下的不同项目（如 github.com/facebook/react 和 github.com/facebook/jest）
    const modifier = getDomainDistanceModifier(a.domain, config) * 0.5;
    adjustedDistance += modifier;
  }

  // 2. 原始路径先验权重（如果有）
  if (a.originalPath && b.originalPath) {
    const pathSimilarity = computePathSimilarity(
      a.originalPath,
      b.originalPath,
    );
    if (pathSimilarity > 0.8) {
      // 同一原始文件夹，距离减少 10%
      adjustedDistance *= 0.9;
    } else if (pathSimilarity > 0.5) {
      // 相邻文件夹，距离减少 5%
      adjustedDistance *= 0.95;
    }
  }

  return Math.max(0, adjustedDistance);
}

/**
 * 计算调整后的相似度
 */
export function computeAdjustedSimilarity(
  a: BookmarkWithEmbedding,
  b: BookmarkWithEmbedding,
  config: DomainWeightConfig = DEFAULT_DOMAIN_WEIGHT_CONFIG,
): number {
  const rawSimilarity = cosineSimilarity(a.embedding, b.embedding);
  const rawDistance = 1 - rawSimilarity;
  const adjustedDistance = computeAdjustedDistance(a, b, rawDistance, config);
  return 1 - adjustedDistance;
}

/**
 * 计算路径相似度
 */
export function computePathSimilarity(pathA: string, pathB: string): number {
  const partsA = pathA.split("/").filter(Boolean);
  const partsB = pathB.split("/").filter(Boolean);

  if (partsA.length === 0 || partsB.length === 0) {
    return 0;
  }

  let commonParts = 0;
  for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
    if (partsA[i] === partsB[i]) {
      commonParts++;
    } else {
      break;
    }
  }

  return commonParts / Math.max(partsA.length, partsB.length);
}

/**
 * 批量计算调整后的距离矩阵
 */
export function computeAdjustedDistanceMatrix(
  bookmarks: BookmarkWithEmbedding[],
  config: DomainWeightConfig = DEFAULT_DOMAIN_WEIGHT_CONFIG,
): number[][] {
  const n = bookmarks.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const rawSimilarity = cosineSimilarity(
        bookmarks[i].embedding,
        bookmarks[j].embedding,
      );
      const rawDistance = 1 - rawSimilarity;
      const adjustedDistance = computeAdjustedDistance(
        bookmarks[i],
        bookmarks[j],
        rawDistance,
        config,
      );

      matrix[i][j] = adjustedDistance;
      matrix[j][i] = adjustedDistance;
    }
  }

  return matrix;
}

/**
 * 获取域名权重信息
 */
export function getDomainWeightInfo(
  domain: string,
  config: DomainWeightConfig = DEFAULT_DOMAIN_WEIGHT_CONFIG,
): {
  category:
    | "professional"
    | "contentPlatform"
    | "portal"
    | "shortener"
    | "other";
  modifier: number;
  description: string;
} {
  const category = getDomainCategory(domain, config);
  const modifier = getDomainDistanceModifier(domain, config);

  const descriptions: Record<string, string> = {
    professional: "专业站点：距离减少 15%",
    contentPlatform: "内容平台：距离减少 5%",
    portal: "门户站点：不调整",
    shortener: "短链服务：忽略",
    other: "其他：不调整",
  };

  return {
    category,
    modifier,
    description: descriptions[category],
  };
}
