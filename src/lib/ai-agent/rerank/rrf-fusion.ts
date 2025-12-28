/**
 * RRF Fusion 融合算法
 *
 * Reciprocal Rank Fusion (RRF) 用于合并多个排名列表
 * 公式: score = Σ (weight_i / (k + rank_i))
 *
 * @module ai-agent/rerank/rrf-fusion
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import type { RankItem, RRFResult, RRFConfig, RRFStats } from "./rrf-types";
import { DEFAULT_RRF_CONFIG } from "./rrf-types";

/**
 * RRF Fusion 融合器
 *
 * 特性：
 * - 支持多来源排名融合
 * - 可配置来源权重
 * - 可配置 k 参数
 * - 返回详细的来源追踪信息
 */
export class RRFFusion {
  private config: RRFConfig;

  constructor(config?: Partial<RRFConfig>) {
    this.config = { ...DEFAULT_RRF_CONFIG, ...config };
  }

  /**
   * 融合多个排名列表
   *
   * @param rankLists - 多个排名列表，每个列表是一个来源的结果
   * @returns RRF 融合后的结果列表（按分数降序）
   */
  fuse(rankLists: RankItem[][]): RRFResult[] {
    if (rankLists.length === 0) {
      return [];
    }

    // 收集所有唯一项
    const itemMap = new Map<string | number, RRFResult>();

    for (const rankList of rankLists) {
      if (!rankList || rankList.length === 0) {
        continue;
      }

      const source = rankList[0]?.source || "unknown";
      const weight = this.config.sourceWeights[source] ?? 1.0;

      for (const item of rankList) {
        const id = item.id;
        const rrfContribution = weight / (this.config.k + item.rank);

        if (itemMap.has(id)) {
          // 已存在，累加 RRF 分数
          const existing = itemMap.get(id)!;
          existing.rrfScore += rrfContribution;
          existing.sources.push(item.source);
          existing.sourceRanks[item.source] = item.rank;
          existing.sourceScores[item.source] = item.score;

          // 合并 payload
          if (item.payload) {
            existing.payload = { ...existing.payload, ...item.payload };
          }
        } else {
          // 新项目
          itemMap.set(id, {
            id,
            rrfScore: rrfContribution,
            sources: [item.source],
            sourceRanks: { [item.source]: item.rank },
            sourceScores: { [item.source]: item.score },
            payload: item.payload ? { ...item.payload } : undefined,
          });
        }
      }
    }

    // 转换为数组并排序
    let results = Array.from(itemMap.values()).sort(
      (a, b) => b.rrfScore - a.rrfScore,
    );

    // 应用 topK 限制
    if (this.config.topK && this.config.topK > 0) {
      results = results.slice(0, this.config.topK);
    }

    logger.debug(
      {
        sourceCount: rankLists.length,
        uniqueItems: results.length,
        topScore: results[0]?.rrfScore,
      },
      "RRFFusion: Fusion completed",
    );

    return results;
  }

  /**
   * 便捷方法：融合两个排名列表
   *
   * @param list1 - 第一个排名列表
   * @param list2 - 第二个排名列表
   * @returns RRF 融合后的结果列表
   */
  fuseTwoLists(list1: RankItem[], list2: RankItem[]): RRFResult[] {
    return this.fuse([list1, list2]);
  }

  /**
   * 从搜索结果创建排名列表
   *
   * @param items - 搜索结果数组
   * @param source - 来源标识
   * @param idExtractor - ID 提取函数
   * @param scoreExtractor - 分数提取函数（可选）
   * @returns 排名列表
   */
  static createRankList<T>(
    items: T[],
    source: string,
    idExtractor: (item: T) => string | number,
    scoreExtractor?: (item: T) => number | undefined,
    payloadExtractor?: (item: T) => Record<string, unknown> | undefined,
  ): RankItem[] {
    return items.map((item, index) => ({
      id: idExtractor(item),
      score: scoreExtractor?.(item),
      rank: index + 1, // 1-based ranking
      source,
      payload: payloadExtractor?.(item),
    }));
  }

  /**
   * 获取融合统计信息
   *
   * @param results - RRF 融合结果
   * @param rankLists - 原始排名列表
   * @returns 统计信息
   */
  getStats(results: RRFResult[], rankLists: RankItem[][]): RRFStats {
    const itemsPerSource: Record<string, number> = {};

    for (const rankList of rankLists) {
      if (rankList.length > 0) {
        const source = rankList[0].source;
        itemsPerSource[source] =
          (itemsPerSource[source] || 0) + rankList.length;
      }
    }

    const totalAppearances = results.reduce(
      (sum, r) => sum + r.sources.length,
      0,
    );
    const singleSourceItems = results.filter(
      (r) => r.sources.length === 1,
    ).length;

    return {
      sourceCount: Object.keys(itemsPerSource).length,
      itemsPerSource,
      uniqueItems: results.length,
      avgAppearances:
        results.length > 0 ? totalAppearances / results.length : 0,
      singleSourceItems,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RRFConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): RRFConfig {
    return { ...this.config };
  }
}

// 单例实例
let rrfFusionInstance: RRFFusion | null = null;

/**
 * 获取 RRFFusion 单例
 */
export function getRRFFusion(config?: Partial<RRFConfig>): RRFFusion {
  if (!rrfFusionInstance) {
    rrfFusionInstance = new RRFFusion(config);
  }
  return rrfFusionInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetRRFFusion(): void {
  rrfFusionInstance = null;
}
