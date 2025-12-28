/**
 * 性能指标收集器
 *
 * 轻量级指标收集实现，支持：
 * - Counter（计数器）
 * - Histogram（直方图）
 * - Gauge（仪表盘）
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import type {
  Counter,
  Histogram,
  Gauge,
  MetricLabels,
  MetricDataPoint,
  MetricsConfig,
} from "./metrics-types";
import { DEFAULT_METRICS_CONFIG, LATENCY_BUCKETS } from "./metrics-types";

const log = logger.child({ namespace: "metrics" });

// ============================================
// 内部数据结构
// ============================================

interface InternalCounter {
  type: "counter";
  name: string;
  description: string;
  values: Map<string, number>;
}

interface InternalHistogram {
  type: "histogram";
  name: string;
  description: string;
  unit: string;
  buckets: number[];
  observations: Map<
    string,
    { sum: number; count: number; bucketCounts: number[] }
  >;
}

interface InternalGauge {
  type: "gauge";
  name: string;
  description: string;
  values: Map<string, number>;
}

type InternalMetric = InternalCounter | InternalHistogram | InternalGauge;

// ============================================
// 指标收集器
// ============================================

/**
 * 指标收集器
 */
class MetricsCollector {
  private config: MetricsConfig = DEFAULT_METRICS_CONFIG;
  private metrics = new Map<string, InternalMetric>();
  private collectIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * 初始化指标收集器
   */
  init(config?: Partial<MetricsConfig>): void {
    this.config = { ...DEFAULT_METRICS_CONFIG, ...config };

    if (!this.config.enabled) {
      log.info("Metrics collection disabled");
      return;
    }

    log.info(
      { serviceName: this.config.serviceName },
      "Metrics collector initialized",
    );

    // 启动定期收集
    if (this.config.collectInterval > 0) {
      this.startCollection();
    }
  }

  /**
   * 创建计数器
   */
  createCounter(name: string, description: string): Counter {
    const metric: InternalCounter = {
      type: "counter",
      name,
      description,
      values: new Map(),
    };
    this.metrics.set(name, metric);

    return {
      add: (value: number, labels?: MetricLabels) => {
        if (!this.config.enabled) return;
        const key = this.labelsToKey(labels);
        const current = metric.values.get(key) ?? 0;
        metric.values.set(key, current + value);
      },
      inc: (labels?: MetricLabels) => {
        if (!this.config.enabled) return;
        const key = this.labelsToKey(labels);
        const current = metric.values.get(key) ?? 0;
        metric.values.set(key, current + 1);
      },
    };
  }

  /**
   * 创建直方图
   */
  createHistogram(
    name: string,
    description: string,
    options?: { unit?: string; buckets?: number[] },
  ): Histogram {
    const buckets = options?.buckets ?? LATENCY_BUCKETS;
    const metric: InternalHistogram = {
      type: "histogram",
      name,
      description,
      unit: options?.unit ?? "ms",
      buckets,
      observations: new Map(),
    };
    this.metrics.set(name, metric);

    return {
      record: (value: number, labels?: MetricLabels) => {
        if (!this.config.enabled) return;
        const key = this.labelsToKey(labels);
        let obs = metric.observations.get(key);
        if (!obs) {
          obs = {
            sum: 0,
            count: 0,
            bucketCounts: new Array(buckets.length).fill(0),
          };
          metric.observations.set(key, obs);
        }
        obs.sum += value;
        obs.count += 1;
        // 更新桶计数
        for (let i = 0; i < buckets.length; i++) {
          if (value <= buckets[i]) {
            obs.bucketCounts[i]++;
          }
        }
      },
      startTimer: (labels?: MetricLabels) => {
        const start = performance.now();
        return () => {
          const duration = performance.now() - start;
          this.getHistogram(name)?.record(duration, labels);
          return duration;
        };
      },
    };
  }

  /**
   * 创建仪表盘
   */
  createGauge(name: string, description: string): Gauge {
    const metric: InternalGauge = {
      type: "gauge",
      name,
      description,
      values: new Map(),
    };
    this.metrics.set(name, metric);

    return {
      set: (value: number, labels?: MetricLabels) => {
        if (!this.config.enabled) return;
        const key = this.labelsToKey(labels);
        metric.values.set(key, value);
      },
      inc: (value = 1, labels?: MetricLabels) => {
        if (!this.config.enabled) return;
        const key = this.labelsToKey(labels);
        const current = metric.values.get(key) ?? 0;
        metric.values.set(key, current + value);
      },
      dec: (value = 1, labels?: MetricLabels) => {
        if (!this.config.enabled) return;
        const key = this.labelsToKey(labels);
        const current = metric.values.get(key) ?? 0;
        metric.values.set(key, current - value);
      },
    };
  }

  /**
   * 获取已创建的直方图
   */
  getHistogram(name: string): Histogram | null {
    const metric = this.metrics.get(name);
    if (metric?.type !== "histogram") return null;
    return this.createHistogram(name, metric.description, {
      unit: metric.unit,
      buckets: metric.buckets,
    });
  }

  /**
   * 收集所有指标数据
   */
  collect(): MetricDataPoint[] {
    const dataPoints: MetricDataPoint[] = [];
    const timestamp = Date.now();

    for (const metric of this.metrics.values()) {
      switch (metric.type) {
        case "counter": {
          for (const [key, value] of metric.values) {
            dataPoints.push({
              name: metric.name,
              type: "counter",
              value,
              labels: this.keyToLabels(key),
              timestamp,
            });
          }
          break;
        }
        case "histogram": {
          for (const [key, obs] of metric.observations) {
            dataPoints.push({
              name: metric.name,
              type: "histogram",
              value: obs.count > 0 ? obs.sum / obs.count : 0, // 平均值
              labels: this.keyToLabels(key),
              timestamp,
              buckets: metric.buckets.map((bound, i) => ({
                bound,
                count: obs.bucketCounts[i],
              })),
            });
          }
          break;
        }
        case "gauge": {
          for (const [key, value] of metric.values) {
            dataPoints.push({
              name: metric.name,
              type: "gauge",
              value,
              labels: this.keyToLabels(key),
              timestamp,
            });
          }
          break;
        }
      }
    }

    return dataPoints;
  }

  /**
   * 获取指标统计
   */
  getStats(): {
    totalMetrics: number;
    counters: number;
    histograms: number;
    gauges: number;
  } {
    let counters = 0;
    let histograms = 0;
    let gauges = 0;

    for (const metric of this.metrics.values()) {
      switch (metric.type) {
        case "counter":
          counters++;
          break;
        case "histogram":
          histograms++;
          break;
        case "gauge":
          gauges++;
          break;
      }
    }

    return {
      totalMetrics: this.metrics.size,
      counters,
      histograms,
      gauges,
    };
  }

  /**
   * 重置所有指标
   */
  reset(): void {
    for (const metric of this.metrics.values()) {
      switch (metric.type) {
        case "counter":
          metric.values.clear();
          break;
        case "histogram":
          metric.observations.clear();
          break;
        case "gauge":
          metric.values.clear();
          break;
      }
    }
    log.debug("All metrics reset");
  }

  /**
   * 关闭收集器
   */
  shutdown(): void {
    if (this.collectIntervalId) {
      clearInterval(this.collectIntervalId);
      this.collectIntervalId = null;
    }
    log.info("Metrics collector shutdown");
  }

  // ============================================
  // 私有方法
  // ============================================

  private startCollection(): void {
    this.collectIntervalId = setInterval(() => {
      if (this.config.consoleExport) {
        const dataPoints = this.collect();
        if (dataPoints.length > 0) {
          log.debug({ count: dataPoints.length }, "Metrics collected");
        }
      }
    }, this.config.collectInterval);
  }

  private labelsToKey(labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) {
      return "";
    }
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
  }

  private keyToLabels(key: string): MetricLabels {
    if (!key) return {};
    const labels: MetricLabels = {};
    for (const pair of key.split(",")) {
      const [k, v] = pair.split("=");
      if (k && v) {
        labels[k] = v;
      }
    }
    return labels;
  }
}

// ============================================
// 单例导出
// ============================================

/**
 * 全局指标收集器实例
 */
export const metricsCollector = new MetricsCollector();

/**
 * 初始化指标收集
 */
export function initMetrics(config?: Partial<MetricsConfig>): void {
  metricsCollector.init(config);
}
