/**
 * 智能分类 v5.0 - Alpha 系数计算器
 *
 * 根据文件夹统计信息动态计算 α 系数（内容向量 vs 行为向量的权重）
 */

import type { LoggerService } from '../shared/logger';
import type { FolderStats } from './types';

/**
 * Alpha 计算器类
 */
export class AlphaCalculator {
  private logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger.child({ service: 'AlphaCalculator' });
  }

  /**
   * 计算动态 α 系数
   * α = 0.3 * timeFactor + 0.3 * quantityFactor + 0.2 * diversityFactor + 0.2 * freshnessFactor
   * 限制在 [0.2, 0.8] 范围
   */
  calculate(stats: FolderStats): number {
    const timeFactor = this.calculateTimeFactor(stats.lastUsed);
    const quantityFactor = this.calculateQuantityFactor(
      stats.behaviorCount,
      stats.contentCount
    );
    const diversityFactor = stats.contentDiversity;
    const freshnessFactor = stats.recentActivity;

    // 加权平均
    const alpha =
      0.3 * timeFactor +
      0.3 * quantityFactor +
      0.2 * diversityFactor +
      0.2 * freshnessFactor;

    // 限制在 [0.2, 0.8] 范围
    const clampedAlpha = Math.max(0.2, Math.min(0.8, alpha));

    this.logger.debug('Alpha 系数计算完成', {
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
   * 计算时间因素（指数衰减）
   * 7 天内 → 1.0, 30 天后 → 0.2
   */
  private calculateTimeFactor(lastUsedAt: Date): number {
    const daysSinceLastUse =
      (Date.now() - lastUsedAt.getTime()) / (1000 * 60 * 60 * 24);

    // 指数衰减：半衰期 14 天
    return Math.max(0.2, Math.exp(-daysSinceLastUse / 14));
  }

  /**
   * 计算数量因素（行为数据 vs 内容数据的比例）
   * 行为数据越多 → α 越高（更依赖行为向量）
   */
  private calculateQuantityFactor(
    behaviorCount: number,
    contentCount: number
  ): number {
    if (behaviorCount === 0 && contentCount === 0) {
      return 0.5; // 默认 50/50
    }

    const totalCount = behaviorCount + contentCount;
    const behaviorRatio = behaviorCount / totalCount;

    // 行为数据占比越高，α 越高
    return behaviorRatio;
  }
}
