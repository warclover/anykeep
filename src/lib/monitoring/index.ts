/**
 * 监控模块
 * @version V4.2.25
 *
 * 提供性能指标收集、告警和分析功能
 * - 性能监控 (Web Vitals)
 * - RAG 质量评估与监控
 */

// 性能监控
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

// RAG 监控与评估
export {
  // 类型
  type EvaluationTestCase,
  type RAGResponse,
  type EvaluationResult,
  type EvaluationReport,
  type RAGMetrics,
  type RAGMetricThresholds,
  type RAGAlert,
  type DailyRAGStats,
  type EvaluationRunConfig,
  type SearchFunction,
  // 常量
  DEFAULT_RAG_THRESHOLDS,
  ALL_TEST_CASES,
  // 评估
  RAGMetricsCalculator,
  getRAGMetricsCalculator,
  EvaluationRunner,
  getEvaluationRunner,
  formatReportAsText,
  // 监控
  RAGMetricsCollector,
  getRAGMetricsCollector,
  resetRAGMetricsCollector,
} from "./rag";
