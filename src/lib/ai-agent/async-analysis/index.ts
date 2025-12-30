/**
 * 异步分析服务模块导出
 *
 * Phase 4: AsyncAnalysisService - 后台异步分析
 *
 * @module ai-agent/async-analysis
 * @version 1.0.0
 * @since 2025-12-30
 */

// 主服务
export {
  AsyncAnalysisService,
  createAsyncAnalysisService,
} from "./async-analysis-service";

// 集成模块
export {
  AsyncAnalysisBriefingIntegration,
  createAsyncAnalysisBriefingIntegration,
  type IntegrationConfig,
} from "./briefing-integration";

// 分析器
export {
  BaseAnalyzer,
  TopicClusteringAnalyzer,
  PatternDetectionAnalyzer,
  LinkHealthCheckAnalyzer,
} from "./analyzers";

// 调度器
export { LazyTrigger, createLazyTrigger } from "./scheduler";

// 常量
export {
  DEFAULT_ASYNC_ANALYSIS_CONFIG,
  DEFAULT_LAZY_TRIGGER_CONFIG,
  TASK_TYPE_PRIORITY,
  TRIGGER_DEFAULT_TASKS,
  TASK_TYPE_DESCRIPTION,
  TOPIC_CLUSTERING_THRESHOLDS,
  PATTERN_DETECTION_THRESHOLDS,
  LINK_HEALTH_THRESHOLDS,
} from "./constants";

// 类型
export type {
  AsyncAnalysisConfig,
  LazyTriggerConfig,
  AsyncAnalysisTask,
  AnalysisResult,
  AnalysisTaskType,
  TaskTrigger,
  TaskPriority,
  TaskStatus,
  IAnalyzer,
  AnalyzerOutput,
  ScheduleOptions,
  TaskQueueStats,
  TopicClusteringResult,
  TopicCluster,
  PatternDetectionResult,
  DetectedPattern,
  PatternType,
  LinkHealthCheckResult,
  LinkHealthIssue,
  LinkIssueType,
} from "./types";
