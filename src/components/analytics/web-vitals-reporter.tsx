/**
 * Web Vitals 性能监控组件
 * V4.2.1: 收集 Core Web Vitals 指标并报告
 *
 * 核心指标：
 * - LCP (Largest Contentful Paint): 最大内容绘制，目标 < 2.5s
 * - FID (First Input Delay): 首次输入延迟，目标 < 100ms
 * - CLS (Cumulative Layout Shift): 累积布局偏移，目标 < 0.1
 * - FCP (First Contentful Paint): 首次内容绘制，目标 < 1.8s
 * - TTFB (Time to First Byte): 首字节时间，目标 < 800ms
 * - INP (Interaction to Next Paint): 交互到下一次绘制，目标 < 200ms
 */

"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useCallback, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

/**
 * Web Vitals 指标类型
 */
interface WebVitalMetric {
  id: string;
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  entries: PerformanceEntry[];
  navigationType: string;
}

/**
 * 指标阈值配置
 */
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
} as const;

/**
 * 获取指标评级
 */
function getRating(
  name: string,
  value: number,
): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return "good";

  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

/**
 * 格式化指标值
 */
function formatValue(name: string, value: number): string {
  if (name === "CLS") {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
}

/**
 * Web Vitals 报告组件
 *
 * @example
 * ```tsx
 * // 在根布局中使用
 * <WebVitalsReporter
 *   debug={process.env.NODE_ENV === 'development'}
 *   onReport={(metric) => analytics.track('web_vital', metric)}
 * />
 * ```
 */
export function WebVitalsReporter({
  debug = process.env.NODE_ENV === "development",
  onReport,
}: {
  /**
   * 是否在控制台输出调试信息
   */
  debug?: boolean;
  /**
   * 指标上报回调
   */
  onReport?: (metric: WebVitalMetric) => void;
}) {
  // 收集的指标缓存
  const metricsBuffer = useRef<Map<string, WebVitalMetric>>(new Map());
  const reportedIds = useRef<Set<string>>(new Set());

  // 批量上报定时器
  const flushTimer = useRef<NodeJS.Timeout | null>(null);

  /**
   * 批量上报指标
   */
  const flushMetrics = useCallback(() => {
    if (metricsBuffer.current.size === 0) return;

    const metrics = Array.from(metricsBuffer.current.values());

    // 计算综合得分
    const scores = {
      lcp: metrics.find((m) => m.name === "LCP")?.value,
      fid: metrics.find((m) => m.name === "FID")?.value,
      cls: metrics.find((m) => m.name === "CLS")?.value,
      fcp: metrics.find((m) => m.name === "FCP")?.value,
      ttfb: metrics.find((m) => m.name === "TTFB")?.value,
      inp: metrics.find((m) => m.name === "INP")?.value,
    };

    // 在开发环境输出综合报告
    if (debug) {
      // eslint-disable-next-line no-console -- 调试信息需要在控制台输出
      console.group("📊 Web Vitals Report");
      metrics.forEach((metric) => {
        const emoji =
          metric.rating === "good"
            ? "✅"
            : metric.rating === "needs-improvement"
              ? "⚠️"
              : "❌";
        // eslint-disable-next-line no-console -- 调试信息需要在控制台输出
        console.log(
          `${emoji} ${metric.name}: ${formatValue(metric.name, metric.value)} (${metric.rating})`,
        );
      });
      // eslint-disable-next-line no-console -- 调试信息需要在控制台输出
      console.groupEnd();
    }

    // 记录到日志系统
    logger.info(
      {
        type: "web_vitals",
        metrics: scores,
        pathname: window.location.pathname,
        userAgent: navigator.userAgent,
      },
      "Web Vitals collected",
    );

    // 清空缓存
    metricsBuffer.current.clear();
  }, [debug]);

  /**
   * 处理单个指标
   */
  const handleMetric = useCallback(
    (metric: WebVitalMetric) => {
      // 防止重复报告同一指标
      const metricKey = `${metric.name}-${metric.id}`;
      if (reportedIds.current.has(metricKey)) return;
      reportedIds.current.add(metricKey);

      // 添加评级
      const enrichedMetric = {
        ...metric,
        rating: getRating(metric.name, metric.value),
      };

      // 缓存指标
      metricsBuffer.current.set(metric.name, enrichedMetric);

      // 调用自定义上报回调
      onReport?.(enrichedMetric);

      // 重置批量上报定时器
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
      }
      flushTimer.current = setTimeout(flushMetrics, 1000);
    },
    [onReport, flushMetrics],
  );

  // 使用 Next.js 内置的 Web Vitals 报告
  useReportWebVitals(handleMetric);

  // 页面卸载时上报
  useEffect(() => {
    const handleUnload = () => {
      flushMetrics();
    };

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushMetrics();
      }
    });

    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
      }
      handleUnload();
    };
  }, [flushMetrics]);

  // 此组件不渲染任何内容
  return null;
}

/**
 * 自定义性能标记
 * 用于测量特定操作的性能
 *
 * @example
 * ```tsx
 * const timer = performanceMark('api-call');
 * await fetch('/api/data');
 * timer.end(); // 自动记录到控制台和日志
 * ```
 */
export function performanceMark(name: string) {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  const measureName = `${name}-duration`;

  performance.mark(startMark);

  return {
    end: () => {
      performance.mark(endMark);
      try {
        const measure = performance.measure(measureName, startMark, endMark);
        const duration = measure.duration;

        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console -- 性能调试信息
          console.log(`⏱️ ${name}: ${Math.round(duration)}ms`);
        }

        logger.debug(
          {
            type: "performance_mark",
            name,
            duration: Math.round(duration),
          },
          `Performance: ${name}`,
        );

        return duration;
      } catch {
        return 0;
      } finally {
        // 清理标记
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);
      }
    },
  };
}

export default WebVitalsReporter;
