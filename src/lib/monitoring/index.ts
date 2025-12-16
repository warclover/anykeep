/**
 * 性能监控模块
 * @version V4.2.24
 *
 * 提供性能指标收集、告警和分析功能
 */

export {
  // 类型
  type MetricName,
  type MetricRating,
  type AlertLevel,
  type MetricThreshold,
  type AlertConfig,
  type PerformanceAlert,
  // 配置
  METRIC_THRESHOLDS,
  ALERT_CONFIG,
  // 函数
  getMetricRating,
  checkAlert,
  handlePerformanceAlert,
  createPerformanceMonitor,
  performanceMonitor,
} from "./performance-alerts";
