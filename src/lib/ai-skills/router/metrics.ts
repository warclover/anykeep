/**
 * RouteMetrics - 路由性能指标模块
 *
 * 职责：
 * - 收集路由各阶段耗时
 * - 追踪分类来源和消歧使用情况
 * - 提供缓存命中统计
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

// ============================================
// 类型定义
// ============================================

/**
 * 路由性能指标
 */
export interface RouteMetrics {
  // ============================================
  // 时间指标
  // ============================================

  /** 意图分类耗时（毫秒） */
  classificationDurationMs: number;
  /** 复杂度评估耗时（毫秒） */
  complexityDurationMs: number;
  /** 模式选择耗时（毫秒） */
  modeSelectorDurationMs: number;
  /** 总路由耗时（毫秒） */
  totalDurationMs: number;

  // ============================================
  // 分类指标
  // ============================================

  /** 匹配的规则数量 */
  ruleMatchCount: number;
  /** 是否触发了消歧 */
  disambiguationUsed: boolean;
  /** 是否使用了 LLM 兜底 */
  llmFallbackUsed: boolean;
  /** 分类来源 */
  classificationSource:
    | "rule"
    | "llm"
    | "semantic"
    | "hybrid"
    | "default"
    | "cache_l1"
    | "cache_l2";

  // ============================================
  // 缓存指标
  // ============================================

  /** LLM 缓存是否命中 */
  llmCacheHit: boolean;
}

/**
 * 阶段计时器
 */
interface StageTimer {
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

// ============================================
// RouteMetricsCollector 类
// ============================================

/**
 * 路由指标收集器
 *
 * 用于在路由过程中收集各阶段的性能指标
 *
 * @example
 * ```typescript
 * const collector = new RouteMetricsCollector();
 * collector.start();
 *
 * collector.startStage("classification");
 * // ... 分类逻辑
 * collector.endStage("classification");
 *
 * collector.startStage("complexity");
 * // ... 复杂度评估
 * collector.endStage("complexity");
 *
 * const metrics = collector.finalize();
 * ```
 */
export class RouteMetricsCollector {
  private startTime: number = 0;
  private stages: Map<string, StageTimer> = new Map();
  private metrics: Partial<RouteMetrics> = {};

  /**
   * 开始收集指标
   */
  start(): void {
    this.startTime = performance.now();
    this.stages.clear();
    this.metrics = {
      ruleMatchCount: 0,
      disambiguationUsed: false,
      llmFallbackUsed: false,
      classificationSource: "rule",
      llmCacheHit: false,
    };
  }

  /**
   * 开始某个阶段的计时
   */
  startStage(name: string): void {
    this.stages.set(name, {
      name,
      startTime: performance.now(),
    });
  }

  /**
   * 结束某个阶段的计时
   */
  endStage(name: string): number {
    const stage = this.stages.get(name);
    if (!stage) {
      return 0;
    }

    stage.endTime = performance.now();
    stage.durationMs = Math.round(stage.endTime - stage.startTime);
    return stage.durationMs;
  }

  /**
   * 获取阶段耗时
   */
  getStageDuration(name: string): number {
    const stage = this.stages.get(name);
    return stage?.durationMs ?? 0;
  }

  /**
   * 记录规则匹配数量
   */
  recordRuleMatchCount(count: number): void {
    this.metrics.ruleMatchCount = count;
  }

  /**
   * 记录是否使用消歧
   */
  recordDisambiguation(used: boolean): void {
    this.metrics.disambiguationUsed = used;
  }

  /**
   * 记录是否使用 LLM 兜底
   */
  recordLLMFallback(used: boolean): void {
    this.metrics.llmFallbackUsed = used;
  }

  /**
   * 记录分类来源
   */
  recordClassificationSource(
    source:
      | "rule"
      | "llm"
      | "semantic"
      | "hybrid"
      | "default"
      | "cache_l1"
      | "cache_l2",
  ): void {
    this.metrics.classificationSource = source;
  }

  /**
   * 记录 LLM 缓存命中
   */
  recordLLMCacheHit(hit: boolean): void {
    this.metrics.llmCacheHit = hit;
  }

  /**
   * 完成指标收集并返回最终结果
   */
  finalize(): RouteMetrics {
    const totalDurationMs = Math.round(performance.now() - this.startTime);

    return {
      classificationDurationMs: this.getStageDuration("classification"),
      complexityDurationMs: this.getStageDuration("complexity"),
      modeSelectorDurationMs: this.getStageDuration("modeSelector"),
      totalDurationMs,
      ruleMatchCount: this.metrics.ruleMatchCount ?? 0,
      disambiguationUsed: this.metrics.disambiguationUsed ?? false,
      llmFallbackUsed: this.metrics.llmFallbackUsed ?? false,
      classificationSource: this.metrics.classificationSource ?? "rule",
      llmCacheHit: this.metrics.llmCacheHit ?? false,
    };
  }

  /**
   * 重置收集器状态
   */
  reset(): void {
    this.startTime = 0;
    this.stages.clear();
    this.metrics = {};
  }

  /**
   * 获取当前已收集的部分指标（用于调试）
   */
  getPartialMetrics(): Partial<RouteMetrics> {
    return {
      ...this.metrics,
      classificationDurationMs: this.getStageDuration("classification"),
      complexityDurationMs: this.getStageDuration("complexity"),
      modeSelectorDurationMs: this.getStageDuration("modeSelector"),
      totalDurationMs: Math.round(performance.now() - this.startTime),
    };
  }
}

// ============================================
// 聚合统计
// ============================================

/**
 * 路由性能聚合统计
 */
export interface RouteMetricsAggregation {
  /** 样本数量 */
  sampleCount: number;
  /** 平均总耗时 */
  avgTotalDurationMs: number;
  /** P95 总耗时 */
  p95TotalDurationMs: number;
  /** P99 总耗时 */
  p99TotalDurationMs: number;
  /** 最大总耗时 */
  maxTotalDurationMs: number;
  /** 平均分类耗时 */
  avgClassificationDurationMs: number;
  /** LLM 使用率 */
  llmFallbackRate: number;
  /** 消歧使用率 */
  disambiguationRate: number;
  /** LLM 缓存命中率 */
  llmCacheHitRate: number;
}

/**
 * 路由性能统计聚合器
 *
 * 用于收集多次路由的性能数据并生成统计报告
 */
export class RouteMetricsAggregator {
  private samples: RouteMetrics[] = [];
  private maxSamples: number;

  constructor(maxSamples: number = 1000) {
    this.maxSamples = maxSamples;
  }

  /**
   * 添加一个指标样本
   */
  addSample(metrics: RouteMetrics): void {
    this.samples.push(metrics);

    // 保持样本数量在限制内（滑动窗口）
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  /**
   * 获取聚合统计
   */
  getAggregation(): RouteMetricsAggregation {
    if (this.samples.length === 0) {
      return {
        sampleCount: 0,
        avgTotalDurationMs: 0,
        p95TotalDurationMs: 0,
        p99TotalDurationMs: 0,
        maxTotalDurationMs: 0,
        avgClassificationDurationMs: 0,
        llmFallbackRate: 0,
        disambiguationRate: 0,
        llmCacheHitRate: 0,
      };
    }

    const totalDurations = this.samples
      .map((s) => s.totalDurationMs)
      .sort((a, b) => a - b);
    const classificationDurations = this.samples.map(
      (s) => s.classificationDurationMs,
    );

    const llmFallbackCount = this.samples.filter(
      (s) => s.llmFallbackUsed,
    ).length;
    const disambiguationCount = this.samples.filter(
      (s) => s.disambiguationUsed,
    ).length;
    const llmCacheHitCount = this.samples.filter((s) => s.llmCacheHit).length;
    const llmUsedCount = this.samples.filter((s) => s.llmFallbackUsed).length;

    return {
      sampleCount: this.samples.length,
      avgTotalDurationMs: this.calculateAverage(totalDurations),
      p95TotalDurationMs: this.calculatePercentile(totalDurations, 95),
      p99TotalDurationMs: this.calculatePercentile(totalDurations, 99),
      maxTotalDurationMs: Math.max(...totalDurations),
      avgClassificationDurationMs: this.calculateAverage(
        classificationDurations,
      ),
      llmFallbackRate: llmFallbackCount / this.samples.length,
      disambiguationRate: disambiguationCount / this.samples.length,
      llmCacheHitRate: llmUsedCount > 0 ? llmCacheHitCount / llmUsedCount : 0,
    };
  }

  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round(sum / values.length);
  }

  /**
   * 计算百分位数
   */
  private calculatePercentile(
    sortedValues: number[],
    percentile: number,
  ): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * 获取样本数量
   */
  getSampleCount(): number {
    return this.samples.length;
  }

  /**
   * 清空样本
   */
  clear(): void {
    this.samples = [];
  }

  /**
   * 获取最近 N 个样本
   */
  getRecentSamples(count: number): RouteMetrics[] {
    return this.samples.slice(-count);
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建指标收集器
 */
export function createRouteMetricsCollector(): RouteMetricsCollector {
  return new RouteMetricsCollector();
}

/**
 * 创建指标聚合器
 */
export function createRouteMetricsAggregator(
  maxSamples?: number,
): RouteMetricsAggregator {
  return new RouteMetricsAggregator(maxSamples);
}

/**
 * 默认指标聚合器（全局单例）
 */
let defaultAggregator: RouteMetricsAggregator | null = null;

export function getDefaultMetricsAggregator(): RouteMetricsAggregator {
  if (!defaultAggregator) {
    defaultAggregator = createRouteMetricsAggregator();
  }
  return defaultAggregator;
}
