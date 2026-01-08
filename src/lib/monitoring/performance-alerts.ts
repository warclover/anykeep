/**
 * 性能监控告警配置
 * @version V4.2.24 - 性能优化：告警阈值与通知机制
 *
 * 基于 Google Core Web Vitals 标准设置告警阈值：
 * - Good (绿色): 用户体验良好
 * - Needs Improvement (黄色): 需要关注
 * - Poor (红色): 需要立即处理
 */

import { logger } from "@/lib/logger";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

/**
 * 性能指标名称
 */
export type MetricName = "TTFB" | "FCP" | "LCP" | "FID" | "CLS" | "INP";

/**
 * 指标评级
 */
export type MetricRating = "good" | "needs-improvement" | "poor";

/**
 * 告警级别
 */
export type AlertLevel = "info" | "warning" | "critical";

/**
 * 性能指标阈值配置
 */
export interface MetricThreshold {
  /** 指标名称 */
  name: MetricName;
  /** 良好阈值（小于等于此值为 Good） */
  good: number;
  /** 差阈值（大于此值为 Poor） */
  poor: number;
  /** 单位 */
  unit: "ms" | "score";
  /** 描述 */
  description: string;
}

/**
 * 告警配置
 */
export interface AlertConfig {
  /** 告警级别阈值 */
  thresholds: {
    warning: number;
    critical: number;
  };
  /** 是否启用 */
  enabled: boolean;
  /** 连续超标次数触发告警 */
  consecutiveCount: number;
}

/**
 * 性能告警事件
 */
export interface PerformanceAlert {
  /** 告警时间 */
  timestamp: Date;
  /** 指标名称 */
  metric: MetricName;
  /** 指标值 */
  value: number;
  /** 告警级别 */
  level: AlertLevel;
  /** 阈值 */
  threshold: number;
  /** 页面路径 */
  pathname: string;
  /** 用户代理 */
  userAgent?: string;
}

// ============================================
// 阈值配置（基于 Google Web Vitals 标准）
// ============================================

/**
 * Core Web Vitals 阈值配置
 */
export const METRIC_THRESHOLDS: Record<MetricName, MetricThreshold> = {
  TTFB: {
    name: "TTFB",
    good: 800,
    poor: 1800,
    unit: "ms",
    description: "首字节时间 (Time to First Byte)",
  },
  FCP: {
    name: "FCP",
    good: 1800,
    poor: 3000,
    unit: "ms",
    description: "首次内容绘制 (First Contentful Paint)",
  },
  LCP: {
    name: "LCP",
    good: 2500,
    poor: 4000,
    unit: "ms",
    description: "最大内容绘制 (Largest Contentful Paint)",
  },
  FID: {
    name: "FID",
    good: 100,
    poor: 300,
    unit: "ms",
    description: "首次输入延迟 (First Input Delay)",
  },
  CLS: {
    name: "CLS",
    good: 0.1,
    poor: 0.25,
    unit: "score",
    description: "累积布局偏移 (Cumulative Layout Shift)",
  },
  INP: {
    name: "INP",
    good: 200,
    poor: 500,
    unit: "ms",
    description: "交互到下次绘制 (Interaction to Next Paint)",
  },
};

/**
 * 告警配置
 */
export const ALERT_CONFIG: Record<MetricName, AlertConfig> = {
  TTFB: {
    thresholds: { warning: 1000, critical: 2000 },
    enabled: true,
    consecutiveCount: 3,
  },
  FCP: {
    thresholds: { warning: 2500, critical: 4000 },
    enabled: true,
    consecutiveCount: 3,
  },
  LCP: {
    thresholds: { warning: 4000, critical: 6000 },
    enabled: true,
    consecutiveCount: 3,
  },
  FID: {
    thresholds: { warning: 100, critical: 300 },
    enabled: true,
    consecutiveCount: 5,
  },
  CLS: {
    thresholds: { warning: 0.1, critical: 0.25 },
    enabled: true,
    consecutiveCount: 3,
  },
  INP: {
    thresholds: { warning: 200, critical: 500 },
    enabled: true,
    consecutiveCount: 5,
  },
};

// ============================================
// 告警处理函数
// ============================================

/**
 * 指标历史记录（用于连续超标检测）
 */
const metricHistory: Map<MetricName, number[]> = new Map();

/**
 * 获取指标评级
 */
export function getMetricRating(
  metric: MetricName,
  value: number,
): MetricRating {
  const threshold = METRIC_THRESHOLDS[metric];
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

/**
 * 检查指标是否触发告警
 */
export function checkAlert(
  metric: MetricName,
  value: number,
): AlertLevel | null {
  const config = ALERT_CONFIG[metric];
  if (!config.enabled) return null;

  // 更新历史记录
  const history = metricHistory.get(metric) || [];
  history.push(value);
  if (history.length > config.consecutiveCount) {
    history.shift();
  }
  metricHistory.set(metric, history);

  // 检查是否连续超标
  if (history.length < config.consecutiveCount) {
    return null; // 数据不足，不触发告警
  }

  const allExceedCritical = history.every(
    (v) => v > config.thresholds.critical,
  );
  const allExceedWarning = history.every((v) => v > config.thresholds.warning);

  if (allExceedCritical) return "critical";
  if (allExceedWarning) return "warning";
  return null;
}

/**
 * 处理性能告警
 */
export function handlePerformanceAlert(alert: PerformanceAlert): void {
  const threshold = METRIC_THRESHOLDS[alert.metric];
  const formattedValue =
    threshold.unit === "ms"
      ? `${Math.round(alert.value)}ms`
      : alert.value.toFixed(3);

  const message = `[Performance Alert] ${alert.level.toUpperCase()}: ${threshold.description} = ${formattedValue} (阈值: ${alert.threshold}${threshold.unit === "ms" ? "ms" : ""})`;

  // 根据告警级别记录日志
  if (alert.level === "critical") {
    logger.error(
      {
        type: "performance_alert",
        ...alert,
        threshold: METRIC_THRESHOLDS[alert.metric],
      },
      message,
    );
  } else if (alert.level === "warning") {
    logger.warn(
      {
        type: "performance_alert",
        ...alert,
        threshold: METRIC_THRESHOLDS[alert.metric],
      },
      message,
    );
  } else {
    logger.info(
      {
        type: "performance_alert",
        ...alert,
        threshold: METRIC_THRESHOLDS[alert.metric],
      },
      message,
    );
  }

  // 开发环境控制台输出
  if (process.env.NODE_ENV === "development") {
    const emoji =
      alert.level === "critical"
        ? "🚨"
        : alert.level === "warning"
          ? "⚠️"
          : "ℹ️";
    clientLogger.info(`${emoji} ${message}`);
  }

  // P3: 可选 - 发送到外部监控服务
  // - Sentry
  // - DataDog
  // - New Relic
  // - 自建告警系统
}

/**
 * 创建监控报告器
 */
export function createPerformanceMonitor() {
  return {
    /**
     * 报告单个指标
     */
    report(
      metric: MetricName,
      value: number,
      pathname: string = typeof window !== "undefined"
        ? window.location.pathname
        : "/",
    ): void {
      const alertLevel = checkAlert(metric, value);

      if (alertLevel) {
        handlePerformanceAlert({
          timestamp: new Date(),
          metric,
          value,
          level: alertLevel,
          threshold:
            alertLevel === "critical"
              ? ALERT_CONFIG[metric].thresholds.critical
              : ALERT_CONFIG[metric].thresholds.warning,
          pathname,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        });
      }
    },

    /**
     * 批量报告指标
     */
    reportBatch(
      metrics: Partial<Record<MetricName, number>>,
      pathname?: string,
    ): void {
      Object.entries(metrics).forEach(([name, value]) => {
        if (value !== undefined) {
          this.report(name as MetricName, value, pathname);
        }
      });
    },

    /**
     * 获取指标摘要
     */
    getSummary(): Record<MetricName, { latest: number; rating: MetricRating }> {
      const summary = {} as Record<
        MetricName,
        { latest: number; rating: MetricRating }
      >;

      metricHistory.forEach((history, metric) => {
        const latest = history[history.length - 1] || 0;
        summary[metric] = {
          latest,
          rating: getMetricRating(metric, latest),
        };
      });

      return summary;
    },

    /**
     * 清除历史记录
     */
    clear(): void {
      metricHistory.clear();
    },
  };
}

// 导出单例监控器
export const performanceMonitor = createPerformanceMonitor();
