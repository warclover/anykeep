/**
 * Observability 模块统一导出
 *
 * Phase 4: lib/ 模块整理
 * 整合 metrics 和 monitoring 模块
 *
 * 包含功能：
 * - 指标收集（Prometheus 格式）
 * - 性能监控和告警
 * - 日志记录
 */

// ============================================================================
// Metrics - 指标收集
// ============================================================================

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
} from "../metrics";

// Prometheus 导出
export {
  generatePrometheusMetrics,
  resetMetrics,
  getMetricsSnapshot,
} from "../metrics";

// ============================================================================
// Monitoring - 性能监控
// ============================================================================

// 类型
export type {
  MetricName,
  MetricRating,
  AlertLevel,
  MetricThreshold,
  AlertConfig,
  PerformanceAlert,
} from "../monitoring";

// 配置
export { METRIC_THRESHOLDS, ALERT_CONFIG } from "../monitoring";

// 函数
export {
  getMetricRating,
  checkAlert,
  handlePerformanceAlert,
  createPerformanceMonitor,
  performanceMonitor,
} from "../monitoring";

// ============================================================================
// Logging - 日志记录
// ============================================================================

// 服务端日志 (Pino)
export { logger } from "../logger";

// 客户端日志
export { clientLogger } from "../client-logger";
