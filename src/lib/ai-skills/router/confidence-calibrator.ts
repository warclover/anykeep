/**
 * ConfidenceCalibrator - 置信度校准器
 *
 * 使用 Platt Scaling (逻辑回归) 校准原始置信度分数
 * 通过多因素综合评估，将模型输出的"概率"转换为更准确的置信度
 *
 * 校准特征:
 * - rawConfidence: 原始置信度分数
 * - messageLength: 消息长度（规范化）
 * - ruleWeight: 匹配规则的权重
 * - matchCount: 匹配的规则数量
 * - hasEntities: 是否提取到实体
 * - disambiguationUsed: 是否使用了消歧引擎
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 校准特征
 */
export interface CalibrationFeatures {
  /** 消息长度（字符数） */
  messageLength: number;
  /** 匹配规则的权重 */
  ruleWeight: number;
  /** 匹配的规则数量 */
  matchCount: number;
  /** 是否提取到实体 */
  hasEntities: boolean;
  /** 是否使用了消歧引擎 */
  disambiguationUsed: boolean;
  /** 来源类型 */
  source: "rule" | "llm" | "semantic" | "hybrid";
}

/**
 * 校准参数（逻辑回归权重）
 */
export interface CalibrationParams {
  /** 特征权重 */
  weights: number[];
  /** 偏置项 */
  bias: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 训练样本数 */
  sampleCount: number;
}

/**
 * 校准配置
 */
export interface CalibratorConfig {
  /** 是否启用校准 */
  enabled: boolean;
  /** 最小置信度（校准后） */
  minConfidence: number;
  /** 最大置信度（校准后） */
  maxConfidence: number;
  /** 参数刷新间隔（毫秒） */
  paramRefreshIntervalMs: number;
}

/**
 * 校准统计
 */
export interface CalibrationStats {
  /** 校准次数 */
  calibrations: number;
  /** 平均调整幅度 */
  avgAdjustment: number;
  /** 上调次数 */
  upAdjustments: number;
  /** 下调次数 */
  downAdjustments: number;
}

// ============================================
// 默认配置
// ============================================

/**
 * 默认校准参数（基于经验值，实际应从数据训练）
 */
export const DEFAULT_CALIBRATION_PARAMS: CalibrationParams = {
  // 6 个特征的权重
  weights: [
    0.6, // rawConfidence - 原始置信度权重最高
    0.1, // messageLength - 消息长度影响
    0.15, // ruleWeight - 规则权重影响
    0.05, // matchCount - 匹配数量影响
    0.05, // hasEntities - 实体提取影响
    0.05, // disambiguationUsed - 消歧使用影响
  ],
  bias: -0.3, // 偏置项，用于调整整体校准水平
  updatedAt: Date.now(),
  sampleCount: 0,
};

export const DEFAULT_CALIBRATOR_CONFIG: CalibratorConfig = {
  enabled: true,
  minConfidence: 0.1,
  maxConfidence: 0.99,
  paramRefreshIntervalMs: 60 * 60 * 1000, // 1 小时
};

// ============================================
// ConfidenceCalibrator 类
// ============================================

/**
 * 置信度校准器
 *
 * @example
 * ```typescript
 * const calibrator = new ConfidenceCalibrator();
 *
 * const calibratedConfidence = calibrator.calibrate(0.75, {
 *   messageLength: 20,
 *   ruleWeight: 80,
 *   matchCount: 3,
 *   hasEntities: true,
 *   disambiguationUsed: false,
 *   source: 'rule',
 * });
 *
 * console.log(calibratedConfidence); // 例如: 0.82
 * ```
 */
export class ConfidenceCalibrator {
  private params: CalibrationParams;
  private config: CalibratorConfig;
  private stats: CalibrationStats;
  private lastParamRefresh: number;

  constructor(config?: Partial<CalibratorConfig>) {
    this.config = { ...DEFAULT_CALIBRATOR_CONFIG, ...config };
    this.params = { ...DEFAULT_CALIBRATION_PARAMS };
    this.stats = {
      calibrations: 0,
      avgAdjustment: 0,
      upAdjustments: 0,
      downAdjustments: 0,
    };
    this.lastParamRefresh = 0;

    logger.debug({ config: this.config }, "ConfidenceCalibrator: Initialized");
  }

  /**
   * 校准置信度
   *
   * @param rawConfidence - 原始置信度 (0-1)
   * @param features - 校准特征
   * @returns 校准后的置信度 (0-1)
   */
  calibrate(rawConfidence: number, features: CalibrationFeatures): number {
    if (!this.config.enabled) {
      return rawConfidence;
    }

    // 构建特征向量
    const featureVector = this.buildFeatureVector(rawConfidence, features);

    // 计算逻辑回归输出
    const logit = this.computeLogit(featureVector);

    // 应用 sigmoid 函数
    let calibrated = this.sigmoid(logit);

    // 应用来源因子（不同来源有不同的基准可信度）
    calibrated = this.applySourceFactor(calibrated, features.source);

    // 限制在配置的范围内
    calibrated = Math.max(
      this.config.minConfidence,
      Math.min(this.config.maxConfidence, calibrated),
    );

    // 更新统计
    this.updateStats(rawConfidence, calibrated);

    logger.debug(
      {
        raw: rawConfidence.toFixed(4),
        calibrated: calibrated.toFixed(4),
        adjustment: (calibrated - rawConfidence).toFixed(4),
        source: features.source,
      },
      "ConfidenceCalibrator: Calibrated",
    );

    return calibrated;
  }

  /**
   * 从数据库加载训练好的参数
   */
  async loadParams(): Promise<boolean> {
    // 检查是否需要刷新
    const now = Date.now();
    if (now - this.lastParamRefresh < this.config.paramRefreshIntervalMs) {
      return true;
    }

    try {
      const supabase = await createServiceClient();

      // 尝试从配置表加载参数
      const { data, error } = await supabase
        .from("ai_system_config")
        .select("value")
        .eq("key", "confidence_calibration_params")
        .single();

      if (error) {
        // 配置表可能不存在，使用默认参数
        if (error.code === "PGRST116") {
          logger.debug(
            "ConfidenceCalibrator: No custom params found, using defaults",
          );
          return true;
        }
        throw error;
      }

      if (data?.value) {
        const loadedParams = data.value as unknown as CalibrationParams;
        this.params = {
          ...DEFAULT_CALIBRATION_PARAMS,
          ...loadedParams,
        };
        this.lastParamRefresh = now;

        logger.info(
          {
            sampleCount: this.params.sampleCount,
            updatedAt: new Date(this.params.updatedAt).toISOString(),
          },
          "ConfidenceCalibrator: Params loaded from database",
        );
      }

      return true;
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "ConfidenceCalibrator: Failed to load params",
      );
      return false;
    }
  }

  /**
   * 保存参数到数据库
   */
  async saveParams(): Promise<boolean> {
    try {
      const supabase = await createServiceClient();

      const { error } = await supabase.from("ai_system_config").upsert({
        key: "confidence_calibration_params",
        value: JSON.parse(JSON.stringify(this.params)),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      logger.info(
        { sampleCount: this.params.sampleCount },
        "ConfidenceCalibrator: Params saved to database",
      );

      return true;
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "ConfidenceCalibrator: Failed to save params",
      );
      return false;
    }
  }

  /**
   * 获取当前参数
   */
  getParams(): CalibrationParams {
    return { ...this.params };
  }

  /**
   * 获取校准统计
   */
  getStats(): CalibrationStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      calibrations: 0,
      avgAdjustment: 0,
      upAdjustments: 0,
      downAdjustments: 0,
    };
  }

  /**
   * 手动更新参数（用于离线训练后更新）
   */
  updateParams(params: Partial<CalibrationParams>): void {
    this.params = {
      ...this.params,
      ...params,
      updatedAt: Date.now(),
    };

    logger.info(
      { sampleCount: this.params.sampleCount },
      "ConfidenceCalibrator: Params updated",
    );
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 构建特征向量
   */
  private buildFeatureVector(
    rawConfidence: number,
    features: CalibrationFeatures,
  ): number[] {
    return [
      rawConfidence,
      Math.min(features.messageLength / 100, 1), // 规范化到 0-1
      Math.min(features.ruleWeight / 100, 1), // 规范化到 0-1
      Math.min(features.matchCount / 10, 1), // 规范化到 0-1
      features.hasEntities ? 1 : 0,
      features.disambiguationUsed ? 1 : 0,
    ];
  }

  /**
   * 计算逻辑回归 logit
   */
  private computeLogit(featureVector: number[]): number {
    let logit = this.params.bias;

    for (
      let i = 0;
      i < featureVector.length && i < this.params.weights.length;
      i++
    ) {
      logit += this.params.weights[i] * featureVector[i];
    }

    return logit;
  }

  /**
   * Sigmoid 激活函数
   */
  private sigmoid(x: number): number {
    // 防止溢出
    if (x > 20) return 1;
    if (x < -20) return 0;
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * 应用来源因子
   * 不同来源的分类结果有不同的基准可信度
   */
  private applySourceFactor(
    calibrated: number,
    source: CalibrationFeatures["source"],
  ): number {
    const sourceFactors: Record<CalibrationFeatures["source"], number> = {
      rule: 1.0, // 规则匹配：完全信任校准结果
      hybrid: 0.95, // 混合模式：略微保守
      llm: 0.9, // LLM 兜底：更保守
      semantic: 0.85, // 语义匹配：最保守
    };

    const factor = sourceFactors[source] ?? 1.0;

    // 应用因子：当 factor < 1 时，将置信度向 0.5 收缩
    if (factor < 1) {
      return 0.5 + (calibrated - 0.5) * factor;
    }

    return calibrated;
  }

  /**
   * 更新校准统计
   */
  private updateStats(raw: number, calibrated: number): void {
    const adjustment = calibrated - raw;

    this.stats.calibrations++;

    // 增量平均
    this.stats.avgAdjustment =
      this.stats.avgAdjustment +
      (Math.abs(adjustment) - this.stats.avgAdjustment) /
        this.stats.calibrations;

    if (adjustment > 0.001) {
      this.stats.upAdjustments++;
    } else if (adjustment < -0.001) {
      this.stats.downAdjustments++;
    }
  }
}

// ============================================
// 单例管理
// ============================================

let calibratorInstance: ConfidenceCalibrator | null = null;

/**
 * 获取 ConfidenceCalibrator 单例
 */
export function getConfidenceCalibrator(
  config?: Partial<CalibratorConfig>,
): ConfidenceCalibrator {
  if (!calibratorInstance) {
    calibratorInstance = new ConfidenceCalibrator(config);
    logger.debug("ConfidenceCalibrator: Singleton created");
  }
  return calibratorInstance;
}

/**
 * 重置 ConfidenceCalibrator 单例
 * @internal 仅用于测试
 */
export function resetConfidenceCalibrator(): void {
  calibratorInstance = null;
  logger.debug("ConfidenceCalibrator: Singleton reset");
}

// ============================================
// 工具函数
// ============================================

/**
 * 快速校准（使用单例）
 */
export function calibrateConfidence(
  rawConfidence: number,
  features: CalibrationFeatures,
): number {
  return getConfidenceCalibrator().calibrate(rawConfidence, features);
}
