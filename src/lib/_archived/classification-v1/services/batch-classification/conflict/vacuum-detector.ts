/**
 * 空洞检测器
 *
 * 检测分类孤岛，避免污染用户已整理好的高纯度文件夹
 *
 * @module classification/batch-classification/conflict/vacuum-detector
 * @version 1.0.0
 * @since 2026-02-01
 */

import type {
  BatchCluster,
  FolderMatch,
  VacuumDetectionConfig,
} from "../types";

// ============================================
// 默认配置
// ============================================

export const DEFAULT_VACUUM_DETECTION_CONFIG: VacuumDetectionConfig = {
  ambiguityThreshold: 0.1, // 模棱两可阈值：最佳与次优差值
  minConfidenceThreshold: 0.5, // 最低置信度阈值
  minTargetCohesion: 0.4, // 目标文件夹纯度阈值
};

// ============================================
// 空洞检测结果
// ============================================

export interface VacuumDetectionResult {
  shouldCreate: boolean;
  reason?: VacuumReason;
  details?: string;
}

export type VacuumReason =
  | "no_match"
  | "low_confidence"
  | "ambiguous_match"
  | "target_folder_messy";

// ============================================
// 空洞检测器
// ============================================

/**
 * 空洞检测服务
 *
 * 功能：
 * 1. 检测模棱两可的匹配（最佳与次优差值过小）
 * 2. 检测目标文件夹过于混乱
 * 3. 检测置信度过低的匹配
 */
export class VacuumDetector {
  private config: VacuumDetectionConfig;

  constructor(config: VacuumDetectionConfig = DEFAULT_VACUUM_DETECTION_CONFIG) {
    this.config = config;
  }

  /**
   * 判断是否应该新建文件夹
   */
  shouldCreateNewFolder(
    cluster: BatchCluster,
    topMatches: FolderMatch[],
  ): VacuumDetectionResult {
    // 情况 1：没有任何匹配
    if (topMatches.length === 0) {
      return {
        shouldCreate: true,
        reason: "no_match",
        details: "未找到任何匹配的文件夹",
      };
    }

    const [best, second] = topMatches;

    // 情况 2：唯一匹配但置信度低
    if (topMatches.length === 1) {
      if (best.similarity < this.config.minConfidenceThreshold) {
        return {
          shouldCreate: true,
          reason: "low_confidence",
          details: `最佳匹配置信度 ${(best.similarity * 100).toFixed(1)}% 低于阈值 ${(this.config.minConfidenceThreshold * 100).toFixed(1)}%`,
        };
      }
      return { shouldCreate: false };
    }

    // 情况 3：模棱两可检测（差值 < 阈值）
    if (best.similarity - second.similarity < this.config.ambiguityThreshold) {
      return {
        shouldCreate: true,
        reason: "ambiguous_match",
        details: `最佳匹配 "${best.folderName}" (${(best.similarity * 100).toFixed(1)}%) 与次优 "${second.folderName}" (${(second.similarity * 100).toFixed(1)}%) 差距过小，宁可新建也不乱分`,
      };
    }

    // 情况 4：目标文件夹太乱
    if (best.cohesion < this.config.minTargetCohesion) {
      return {
        shouldCreate: true,
        reason: "target_folder_messy",
        details: `目标文件夹 "${best.folderName}" 内聚度 ${(best.cohesion * 100).toFixed(1)}% 过低，不往乱盒子里扔`,
      };
    }

    // 情况 5：置信度过低
    if (best.similarity < this.config.minConfidenceThreshold) {
      return {
        shouldCreate: true,
        reason: "low_confidence",
        details: `最佳匹配置信度 ${(best.similarity * 100).toFixed(1)}% 低于阈值`,
      };
    }

    // 可以合并到现有文件夹
    return { shouldCreate: false };
  }

  /**
   * 批量检测空洞
   */
  detectVacuums(
    clusters: BatchCluster[],
    matchesMap: Map<string, FolderMatch[]>,
  ): Map<string, VacuumDetectionResult> {
    const results = new Map<string, VacuumDetectionResult>();

    for (const cluster of clusters) {
      const matches = matchesMap.get(cluster.id) || [];
      const result = this.shouldCreateNewFolder(cluster, matches);
      results.set(cluster.id, result);
    }

    return results;
  }

  /**
   * 获取空洞统计
   */
  getVacuumStats(results: Map<string, VacuumDetectionResult>): {
    totalClusters: number;
    needNewFolder: number;
    canMerge: number;
    byReason: Record<VacuumReason, number>;
  } {
    const byReason: Record<VacuumReason, number> = {
      no_match: 0,
      low_confidence: 0,
      ambiguous_match: 0,
      target_folder_messy: 0,
    };

    let needNewFolder = 0;
    let canMerge = 0;

    for (const result of results.values()) {
      if (result.shouldCreate) {
        needNewFolder++;
        if (result.reason) {
          byReason[result.reason]++;
        }
      } else {
        canMerge++;
      }
    }

    return {
      totalClusters: results.size,
      needNewFolder,
      canMerge,
      byReason,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VacuumDetectionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// ============================================
// 导出单例
// ============================================

export const vacuumDetector = new VacuumDetector();
