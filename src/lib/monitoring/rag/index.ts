/**
 * RAG 监控与评估模块
 *
 * 提供 RAG 系统的质量评估和实时监控功能
 *
 * @module monitoring/rag
 * @version 1.0.0
 * @since 2025-12-28
 */

// 类型导出
export type {
  EvaluationTestCase,
  RAGResponse,
  EvaluationResult,
  EvaluationReport,
  RAGMetrics,
  RAGMetricThresholds,
  RAGAlert,
  DailyRAGStats,
} from "./types";

export { DEFAULT_RAG_THRESHOLDS } from "./types";

// 测试数据集
export {
  ALL_TEST_CASES,
  TECHNICAL_TEST_CASES,
  PRODUCT_TEST_CASES,
  FUZZY_TEST_CASES,
  INSIGHT_TEST_CASES,
  LONG_DOC_TEST_CASES,
  getTestCasesByDifficulty,
  getTestCasesByCategory,
  getQuickTestSet,
} from "./test-dataset";

// 评估指标计算器
export {
  RAGMetricsCalculator,
  getRAGMetricsCalculator,
  calculateStatistics,
  calculatePercentile,
} from "./metrics-calculator";

// 评估运行器
export {
  EvaluationRunner,
  getEvaluationRunner,
  formatReportAsText,
  type EvaluationRunConfig,
  type SearchFunction,
} from "./evaluation-runner";

// 指标收集器
export {
  RAGMetricsCollector,
  getRAGMetricsCollector,
  resetRAGMetricsCollector,
} from "./metrics-collector";
