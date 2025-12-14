/**
 * Metrics Module
 * 应用监控指标系统
 *
 * @description
 * - 提供分类系统、托管模式、AI 调用等指标收集
 * - 支持 Prometheus 格式导出
 * - 包含计时装饰器和便捷方法
 *
 * @example
 * ```typescript
 * import { classificationMetrics, generatePrometheusMetrics } from "@/lib/metrics";
 *
 * // 记录分类请求
 * const timing = classificationMetrics.recordClassificationRequest(userId, { trustMode: "full_auto" });
 *
 * // 分类完成后记录成功
 * classificationMetrics.recordClassificationSuccess(userId, 0.85, timing);
 *
 * // 导出 Prometheus 格式指标
 * const metrics = generatePrometheusMetrics();
 * ```
 *
 * @version 1.0.0
 * @since 2025-12-14
 */

// 指标收集器
export {
  classificationMetrics,
  withTiming,
  CLASSIFICATION_METRICS,
  TRUST_MODE_METRICS,
  FOLDER_METRICS,
  SYSTEM_METRICS,
  type MetricType,
  type MetricLabels,
  type MetricEvent,
  type TimingContext,
} from "./classification-metrics";

// Prometheus 导出
export {
  generatePrometheusMetrics,
  resetMetrics,
  getMetricsSnapshot,
} from "./prometheus-exporter";
