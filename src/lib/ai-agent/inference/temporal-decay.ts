/**
 * 时序衰减模型
 *
 * 用于计算信号随时间衰减的权重因子
 * 使用指数衰减模型：D(t) = e^(-λt)
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// =============================================================================
// 配置类型
// =============================================================================

/**
 * 衰减配置
 */
export interface DecayConfig {
  /** 衰减常数 λ（默认 0.05，半衰期约 14 天） */
  lambda?: number;
  /** 最小衰减因子（默认 0.1，即最低保留 10%） */
  minDecay?: number;
  /** 半衰期（天数，优先级高于 lambda） */
  halfLifeDays?: number;
}

/**
 * 带权重的信号
 */
export interface WeightedSignal<T> {
  /** 原始信号 */
  signal: T;
  /** 衰减因子 (0-1) */
  decayFactor: number;
  /** 有效权重 = 原始权重 × 衰减因子 */
  effectiveWeight: number;
}

// =============================================================================
// 时序衰减计算器
// =============================================================================

/**
 * 时序衰减计算器
 *
 * 使用指数衰减模型计算信号权重的时间衰减
 *
 * 衰减曲线参考（λ = 0.05）：
 * - Day 0:  100%
 * - Day 7:  70%
 * - Day 14: 50%（半衰期）
 * - Day 30: 22%
 * - Day 60: 5%
 * - Day 90: 1%（接近 minDecay）
 */
export class TemporalDecayCalculator {
  private readonly decayConstant: number;
  private readonly minDecay: number;

  constructor(config: DecayConfig = {}) {
    // 如果指定了半衰期，则计算对应的衰减常数
    if (config.halfLifeDays !== undefined) {
      // 半衰期公式：t_1/2 = ln(2) / λ
      // 所以 λ = ln(2) / t_1/2
      this.decayConstant = Math.LN2 / config.halfLifeDays;
    } else {
      this.decayConstant = config.lambda ?? 0.05;
    }

    this.minDecay = config.minDecay ?? 0.1;
  }

  /**
   * 计算衰减因子
   *
   * @param timestamp 信号时间戳
   * @param referenceTime 参考时间（默认当前时间）
   * @returns 衰减因子 (minDecay ~ 1)
   */
  calculate(timestamp: Date, referenceTime: Date = new Date()): number {
    const daysDiff = this.getDaysDifference(timestamp, referenceTime);

    // 未来时间不衰减
    if (daysDiff < 0) {
      return 1;
    }

    // 指数衰减公式：D(t) = e^(-λt)
    const decay = Math.exp(-this.decayConstant * daysDiff);

    // 应用最小衰减限制
    return Math.max(decay, this.minDecay);
  }

  /**
   * 计算天数差
   */
  private getDaysDifference(timestamp: Date, referenceTime: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return (referenceTime.getTime() - timestamp.getTime()) / msPerDay;
  }

  /**
   * 批量计算信号的衰减权重
   *
   * @param signals 信号列表
   * @param getTimestamp 获取信号时间戳的函数
   * @param getWeight 获取信号原始权重的函数
   * @param referenceTime 参考时间
   * @returns 带权重的信号列表
   */
  applyToSignals<T>(
    signals: T[],
    getTimestamp: (signal: T) => Date,
    getWeight: (signal: T) => number,
    referenceTime: Date = new Date(),
  ): WeightedSignal<T>[] {
    return signals.map((signal) => {
      const decayFactor = this.calculate(getTimestamp(signal), referenceTime);
      const originalWeight = getWeight(signal);
      return {
        signal,
        decayFactor,
        effectiveWeight: originalWeight * decayFactor,
      };
    });
  }

  /**
   * 获取当前配置的半衰期（天数）
   */
  getHalfLifeDays(): number {
    return Math.LN2 / this.decayConstant;
  }

  /**
   * 获取当前配置的衰减常数
   */
  getDecayConstant(): number {
    return this.decayConstant;
  }

  /**
   * 获取最小衰减因子
   */
  getMinDecay(): number {
    return this.minDecay;
  }
}

// =============================================================================
// 预设配置
// =============================================================================

/**
 * 预设衰减配置
 */
export const DECAY_PRESETS = {
  /** 快速衰减（半衰期 7 天）- 适用于时效性强的内容 */
  fast: { halfLifeDays: 7, minDecay: 0.05 } as DecayConfig,

  /** 标准衰减（半衰期 14 天）- 默认配置 */
  standard: { halfLifeDays: 14, minDecay: 0.1 } as DecayConfig,

  /** 慢速衰减（半衰期 30 天）- 适用于长期价值内容 */
  slow: { halfLifeDays: 30, minDecay: 0.15 } as DecayConfig,

  /** 极慢衰减（半衰期 90 天）- 适用于基础知识 */
  verySlow: { halfLifeDays: 90, minDecay: 0.2 } as DecayConfig,

  /** 无衰减 - 保持恒定权重 */
  none: { lambda: 0, minDecay: 1 } as DecayConfig,
};

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建时序衰减计算器
 *
 * @param preset 预设名称或自定义配置
 * @returns 时序衰减计算器实例
 */
export function createDecayCalculator(
  preset: keyof typeof DECAY_PRESETS | DecayConfig = "standard",
): TemporalDecayCalculator {
  const config = typeof preset === "string" ? DECAY_PRESETS[preset] : preset;
  return new TemporalDecayCalculator(config);
}

/**
 * 计算加权平均（考虑时序衰减）
 *
 * @param values 值列表
 * @param weights 对应的权重列表
 * @param timestamps 对应的时间戳列表
 * @param config 衰减配置
 * @returns 加权平均值
 */
export function weightedAverageWithDecay(
  values: number[],
  weights: number[],
  timestamps: Date[],
  config: DecayConfig = DECAY_PRESETS.standard,
): number {
  if (values.length === 0) return 0;
  if (values.length !== weights.length || values.length !== timestamps.length) {
    throw new Error("values, weights, and timestamps must have same length");
  }

  const calculator = new TemporalDecayCalculator(config);
  const now = new Date();

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < values.length; i++) {
    const decayFactor = calculator.calculate(timestamps[i], now);
    const effectiveWeight = weights[i] * decayFactor;
    weightedSum += values[i] * effectiveWeight;
    totalWeight += effectiveWeight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * 单例实例（使用标准配置）
 */
export const standardDecayCalculator = new TemporalDecayCalculator(
  DECAY_PRESETS.standard,
);
