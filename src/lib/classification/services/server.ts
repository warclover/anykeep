/**
 * Server-side service exports
 *
 * 这些服务依赖 next/headers，只能在服务器端使用
 * 请勿在客户端组件或 container.ts 中导入
 */

// V4.2 新增：AI 文件夹进化服务（服务器端）
export {
  OperationLogService,
  operationLogService,
} from "./operation-log.service";
export {
  JobQueueService,
  jobQueueService,
  enqueueJob,
} from "./job-queue.service";
export {
  SmartSortingService,
  smartSortingService,
} from "./smart-sorting.service";

// V4.2 Phase 4: 分拆与合并服务
export { SplitService, splitService } from "./split.service";
export { MergeService, mergeService } from "./merge.service";

// V4.2 Phase 5: 报告服务
export { ReportService, reportService } from "./report.service";

// V4.2 Phase 6: 成本监控服务
export { CostMonitorService, costMonitorService } from "./cost-monitor.service";

// V4.2 Phase 3: 事件驱动画像更新处理器
export {
  ProfileEventHandlerService,
  initProfileEventHandler,
  getProfileEventHandler,
  stopProfileEventHandler,
} from "./profile-event-handler.service";

// V4.1+ 新增：Embedding A/B 测试服务（服务器端）
export {
  EmbeddingABTestService,
  embeddingABTestService,
} from "./embedding-ab-test.service";

// V4.1+ 新增：分类指标服务
export {
  ClassificationMetricsService,
  classificationMetricsService,
} from "./classification-metrics.service";

// 类型导出（类型安全，不会引入运行时依赖）
export type {
  UndoResult,
  OperationHistoryOptions,
} from "./operation-log.service";

export type {
  ClaimedJob,
  JobStats,
  JobQueryOptions,
} from "./job-queue.service";

export type {
  ABTestOperationType,
  ABTestGroup,
  ClassificationResultData,
  RecordMetricsRequest,
  ABTestSummary,
} from "./embedding-ab-test.service";

export type { SplitSuggestion, SplitResult } from "./split.service";

export type {
  MergeCandidate,
  MergeSuggestion,
  MergeResult,
} from "./merge.service";

export type { MonthlyReport, ReportSuggestion } from "./report.service";

export type {
  LLMOperation,
  RecordUsageRequest,
  UsageSummary,
} from "./cost-monitor.service";

export type { ProfileEventHandlerConfig } from "./profile-event-handler.service";

export type {
  ClassificationAction,
  MatchType,
  UserFeedback,
  RecordClassificationMetricsRequest,
  ClassificationMetricsSummary,
} from "./classification-metrics.service";
