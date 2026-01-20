/**
 * 智能分类 v5.1 - Alpha 系数计算器
 *
 * 根据文件夹统计信息动态计算 α 系数（内容向量 vs 行为向量的权重）
 * v5.1 新增：动态弹性权重，解决大文件夹马太效应
 */

import type { LoggerService } from "../shared/logger";
import type { FolderStats } from "./types";

/**
 * Alpha 系数计算常量
 */
export const ALPHA_CONSTANTS = {
  /** 小文件夹阈值（书签数量） */
  SMALL_FOLDER_THRESHOLD: 10,
  /** 大文件夹阈值（书签数量） */
  LARGE_FOLDER_THRESHOLD: 100,
  /** 小文件夹 Alpha 系数（80% 名称权重） */
  SMALL_FOLDER_ALPHA: 0.8,
  /** 大文件夹 Alpha 系数（50% 名称权重） */
  LARGE_FOLDER_ALPHA: 0.5,
  /** Alpha 最小值 */
  ALPHA_MIN: 0.2,
  /** Alpha 最大值 */
  ALPHA_MAX: 0.8,
  /** 时间衰减半衰期（天） */
  TIME_DECAY_HALF_LIFE_DAYS: 14,
  /** 默认行为权重比例 */
  DEFAULT_BEHAVIOR_RATIO: 0.5,
} as const;

/**
 * Alpha 计算器类
 */
export class AlphaCalculator {
  private logger: LoggerService;
  /** v5.1: 是否启用弹性权重（解决马太效应） */
  private enableV51Features: boolean;

  constructor(
    logger: LoggerService,
    options?: { enableV51Features?: boolean },
  ) {
    this.logger = logger.child({ service: "AlphaCalculator" });
    this.enableV51Features =
      options?.enableV51Features ??
      process.env.CLASSIFICATION_V5_1_ENABLED !== "false";
  }

  /**
   * 计算动态 α 系数
   * v5.1: 优先使用弹性权重，解决大文件夹马太效应
   */
  calculate(stats: FolderStats): number {
    // v5.1: 如果启用弹性权重，优先使用
    if (this.enableV51Features) {
      const elasticAlpha = this.calculateElasticAlpha(stats.contentCount);
      this.logger.debug("使用弹性权重计算 Alpha", {
        folderId: stats.folderId,
        contentCount: stats.contentCount,
        elasticAlpha,
      });
      return elasticAlpha;
    }

    // v5.0 原有逻辑（向后兼容）
    const timeFactor = this.calculateTimeFactor(stats.lastUsed);
    const quantityFactor = this.calculateQuantityFactor(
      stats.behaviorCount,
      stats.contentCount,
    );
    const diversityFactor = stats.contentDiversity;
    const freshnessFactor = stats.recentActivity;

    // 加权平均
    const alpha =
      0.3 * timeFactor +
      0.3 * quantityFactor +
      0.2 * diversityFactor +
      0.2 * freshnessFactor;

    // 限制在 [ALPHA_MIN, ALPHA_MAX] 范围
    const clampedAlpha = Math.max(
      ALPHA_CONSTANTS.ALPHA_MIN,
      Math.min(ALPHA_CONSTANTS.ALPHA_MAX, alpha),
    );

    this.logger.debug("Alpha 系数计算完成（v5.0 模式）", {
      folderId: stats.folderId,
      timeFactor,
      quantityFactor,
      diversityFactor,
      freshnessFactor,
      rawAlpha: alpha,
      clampedAlpha,
    });

    return clampedAlpha;
  }

  /**
   * v5.1: 计算弹性权重 α 系数
   *
   * 根据文件夹内容量 N 动态调整名称/内容权重：
   * - N < 10: 80% 名称，20% 内容（冷启动/小文件夹）
   * - 10 ≤ N < 100: 线性递减，从 80% → 50%
   * - N ≥ 100: 50% 名称，50% 内容（防止大文件夹质心过度主导）
   *
   * 公式：α(N) = {
   *   0.8,                    N < 10
   *   0.8 - 0.3 * (N-10)/90,  10 ≤ N < 100
   *   0.5,                     N ≥ 100
   * }
   */
  calculateElasticAlpha(contentCount: number): number {
    if (contentCount < ALPHA_CONSTANTS.SMALL_FOLDER_THRESHOLD) {
      // 小文件夹：80% 名称，20% 内容
      return ALPHA_CONSTANTS.SMALL_FOLDER_ALPHA;
    }

    if (contentCount < ALPHA_CONSTANTS.LARGE_FOLDER_THRESHOLD) {
      // 成长期：线性递减，从 80% → 50%
      const ratio =
        (contentCount - ALPHA_CONSTANTS.SMALL_FOLDER_THRESHOLD) /
        (ALPHA_CONSTANTS.LARGE_FOLDER_THRESHOLD -
          ALPHA_CONSTANTS.SMALL_FOLDER_THRESHOLD);
      return (
        ALPHA_CONSTANTS.SMALL_FOLDER_ALPHA -
        (ALPHA_CONSTANTS.SMALL_FOLDER_ALPHA -
          ALPHA_CONSTANTS.LARGE_FOLDER_ALPHA) *
          ratio
      );
    }

    // 大文件夹：50% 名称，50% 内容（防止质心过度主导）
    return ALPHA_CONSTANTS.LARGE_FOLDER_ALPHA;
  }

  /**
   * 计算时间因素（指数衰减）
   * 7 天内 → 1.0, 30 天后 → ALPHA_MIN
   */
  private calculateTimeFactor(lastUsedAt: Date): number {
    const daysSinceLastUse =
      (Date.now() - lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);

    // 指数衰减：半衰期 TIME_DECAY_HALF_LIFE_DAYS 天
    return Math.max(
      ALPHA_CONSTANTS.ALPHA_MIN,
      Math.exp(-daysSinceLastUse / ALPHA_CONSTANTS.TIME_DECAY_HALF_LIFE_DAYS),
    );
  }

  /**
   * 计算数量因素（行为数据 vs 内容数据的比例）
   * 行为数据越多 → α 越高（更依赖行为向量）
   */
  private calculateQuantityFactor(
    behaviorCount: number,
    contentCount: number,
  ): number {
    if (behaviorCount === 0 && contentCount === 0) {
      return ALPHA_CONSTANTS.DEFAULT_BEHAVIOR_RATIO; // 默认 50/50
    }

    const totalCount = behaviorCount + contentCount;
    const behaviorRatio = behaviorCount / totalCount;

    // 行为数据占比越高，α 越高
    return behaviorRatio;
  }
}
