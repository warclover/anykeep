/**
 * 智能分类 v5.0 - 阈值自适应器
 *
 * 根据用户分类历史动态调整置信度阈值
 */

import type { LoggerService } from '../shared/logger';
import type { ThresholdConfig, ThresholdAdjustment } from './types';

/**
 * 分类统计数据
 */
export interface ClassificationStats {
  /** 总分类次数 */
  totalClassifications: number;
  /** 正确分类次数 */
  correctClassifications: number;
  /** T1 纠正次数 */
  t1Corrections: number;
  /** 用户手动纠正次数 */
  userCorrections: number;
  /** 平均置信度 */
  averageConfidence: number;
}

/**
 * 阈值自适应器
 */
export class ThresholdAdapter {
  private logger: LoggerService;
  private config: ThresholdConfig;

  constructor(logger: LoggerService, config: ThresholdConfig) {
    this.logger = logger.child({ service: 'ThresholdAdapter' });
    this.config = config;
  }

  /**
   * 分析统计数据并建议阈值调整
   */
  analyze(stats: ClassificationStats): ThresholdAdjustment | null {
    this.logger.debug('分析分类统计数据', { stats });

    // 数据量不足，不建议调整
    if (stats.totalClassifications < 50) {
      this.logger.debug('数据量不足，不建议调整阈值', {
        totalClassifications: stats.totalClassifications,
      });
      return null;
    }

    // 计算关键指标
    const accuracy = stats.correctClassifications / stats.totalClassifications;
    const t1Rate = stats.t1Corrections / stats.totalClassifications;
    const userCorrectionRate = stats.userCorrections / stats.totalClassifications;

    this.logger.debug('计算关键指标', {
      accuracy,
      t1Rate,
      userCorrectionRate,
    });

    // 判断是否需要调整
    const adjustment = this.determineAdjustment(
      accuracy,
      t1Rate,
      userCorrectionRate,
      stats
    );

    if (adjustment) {
      this.logger.info('建议调整阈值', {
        currentThreshold: adjustment.currentThreshold,
        suggestedThreshold: adjustment.suggestedThreshold,
        reason: adjustment.reason,
      });
    }

    return adjustment;
  }

  /**
   * 判断阈值调整方向和幅度
   */
  private determineAdjustment(
    accuracy: number,
    t1Rate: number,
    userCorrectionRate: number,
    stats: ClassificationStats
  ): ThresholdAdjustment | null {
    const currentThreshold = this.config.t0ConfidenceThreshold;

    // 场景 1: 准确率高 + T1 纠正率低 → 可以降低阈值（更激进）
    if (accuracy > 0.9 && t1Rate < 0.1) {
      const suggestedThreshold = Math.max(
        this.config.minThreshold,
        currentThreshold - 0.05
      );

      if (suggestedThreshold < currentThreshold) {
        return {
          currentThreshold,
          suggestedThreshold,
          reason: '准确率高且 T1 纠正率低，可以降低阈值以提升效率',
          confidence: 0.85,
          supportingData: {
            totalClassifications: stats.totalClassifications,
            averageAccuracy: accuracy,
            t1CorrectionRate: t1Rate,
            userCorrectionRate,
          },
        };
      }
    }

    // 场景 2: 准确率低 + 用户纠正率高 → 需要提高阈值（更保守）
    if (accuracy < 0.75 || userCorrectionRate > 0.2) {
      const suggestedThreshold = Math.min(
        this.config.maxThreshold,
        currentThreshold + 0.05
      );

      if (suggestedThreshold > currentThreshold) {
        return {
          currentThreshold,
          suggestedThreshold,
          reason: '准确率低或用户纠正率高，需要提高阈值以提升准确性',
          confidence: 0.9,
          supportingData: {
            totalClassifications: stats.totalClassifications,
            averageAccuracy: accuracy,
            t1CorrectionRate: t1Rate,
            userCorrectionRate,
          },
        };
      }
    }

    // 场景 3: T1 纠正率过高 → 阈值可能过低
    if (t1Rate > 0.3) {
      const suggestedThreshold = Math.min(
        this.config.maxThreshold,
        currentThreshold + 0.03
      );

      if (suggestedThreshold > currentThreshold) {
        return {
          currentThreshold,
          suggestedThreshold,
          reason: 'T1 纠正率过高，阈值可能过低',
          confidence: 0.8,
          supportingData: {
            totalClassifications: stats.totalClassifications,
            averageAccuracy: accuracy,
            t1CorrectionRate: t1Rate,
            userCorrectionRate,
          },
        };
      }
    }

    // 场景 4: 平均置信度远高于阈值 → 可以适当降低阈值
    if (stats.averageConfidence > currentThreshold + 0.15) {
      const suggestedThreshold = Math.max(
        this.config.minThreshold,
        currentThreshold - 0.03
      );

      if (suggestedThreshold < currentThreshold) {
        return {
          currentThreshold,
          suggestedThreshold,
          reason: '平均置信度远高于阈值，可以适当降低阈值',
          confidence: 0.75,
          supportingData: {
            totalClassifications: stats.totalClassifications,
            averageAccuracy: accuracy,
            t1CorrectionRate: t1Rate,
            userCorrectionRate,
          },
        };
      }
    }

    // 无需调整
    return null;
  }

  /**
   * 应用阈值调整
   */
  applyAdjustment(adjustment: ThresholdAdjustment): void {
    this.logger.info('应用阈值调整', {
      from: adjustment.currentThreshold,
      to: adjustment.suggestedThreshold,
      reason: adjustment.reason,
    });

    this.config.t0ConfidenceThreshold = adjustment.suggestedThreshold;
  }

  /**
   * 获取当前阈值配置
   */
  getConfig(): ThresholdConfig {
    return { ...this.config };
  }
}
