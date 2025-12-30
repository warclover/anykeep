/**
 * 异步分析服务常量定义
 *
 * @module ai-agent/async-analysis
 * @version 1.0.0
 * @since 2025-12-30
 */

import type {
  AsyncAnalysisConfig,
  LazyTriggerConfig,
  AnalysisTaskType,
  TaskTrigger,
} from "./types";

// =============================================================================
// 默认配置
// =============================================================================

/**
 * 默认异步分析配置
 */
export const DEFAULT_ASYNC_ANALYSIS_CONFIG: AsyncAnalysisConfig = {
  enabled: true,
  maxConcurrentTasks: 3,
  taskTimeoutMs: 60_000, // 1 分钟
  defaultMaxRetries: 2,
  retryDelayMs: 5_000, // 5 秒
  linkCheckConcurrency: 5,
  linkCheckTimeoutMs: 10_000, // 10 秒
  enableTopicClustering: true,
  enablePatternDetection: true,
  enableLinkHealthCheck: true,
};

/**
 * 默认延迟触发配置
 */
export const DEFAULT_LAZY_TRIGGER_CONFIG: LazyTriggerConfig = {
  enabled: true,
  minOfflineDurationMs: 4 * 60 * 60 * 1000, // 4 小时
  triggerDelayMs: 3_000, // 3 秒
  maxTasksPerTrigger: 5,
};

// =============================================================================
// 任务类型优先级映射
// =============================================================================

/**
 * 任务类型的默认优先级
 */
export const TASK_TYPE_PRIORITY: Record<AnalysisTaskType, number> = {
  link_health_check: 1, // 最高优先级
  global_insight_update: 2,
  duplicate_detection: 3,
  topic_clustering: 4,
  pattern_detection: 5,
  content_enrichment: 6, // 最低优先级
};

// =============================================================================
// 触发条件 → 任务类型映射
// =============================================================================

/**
 * 不同触发条件默认执行的任务类型
 */
export const TRIGGER_DEFAULT_TASKS: Record<TaskTrigger, AnalysisTaskType[]> = {
  post_collection: ["content_enrichment", "duplicate_detection"],
  post_interaction: ["global_insight_update"],
  on_visit: [
    "topic_clustering",
    "pattern_detection",
    "link_health_check",
    "global_insight_update",
  ],
  scheduled: [
    "topic_clustering",
    "pattern_detection",
    "link_health_check",
    "global_insight_update",
  ],
  manual: [], // 手动触发需要明确指定
};

// =============================================================================
// 任务类型描述
// =============================================================================

/**
 * 任务类型的中文描述
 */
export const TASK_TYPE_DESCRIPTION: Record<AnalysisTaskType, string> = {
  topic_clustering: "主题聚类分析",
  pattern_detection: "行为模式检测",
  link_health_check: "链接健康检查",
  global_insight_update: "全局洞察更新",
  duplicate_detection: "重复内容检测",
  content_enrichment: "内容增强处理",
};

// =============================================================================
// 阈值常量
// =============================================================================

/**
 * 主题聚类阈值
 */
export const TOPIC_CLUSTERING_THRESHOLDS = {
  /** 最小聚类大小 */
  MIN_CLUSTER_SIZE: 3,
  /** 相似度阈值 */
  SIMILARITY_THRESHOLD: 0.7,
  /** 新兴主题阈值（最近 N 天内新增占比） */
  EMERGING_TOPIC_THRESHOLD: 0.6,
  /** 最近天数 */
  EMERGING_TOPIC_DAYS: 7,
};

/**
 * 模式检测阈值
 */
export const PATTERN_DETECTION_THRESHOLDS = {
  /** 最小模式出现次数 */
  MIN_PATTERN_OCCURRENCES: 3,
  /** 时间模式窗口（天） */
  TIME_PATTERN_WINDOW_DAYS: 30,
  /** 收藏高峰阈值（相对平均的倍数） */
  SPIKE_THRESHOLD_MULTIPLIER: 2.0,
  /** 沉寂主题阈值（天） */
  DORMANT_TOPIC_DAYS: 30,
};

/**
 * 链接健康检查阈值
 */
export const LINK_HEALTH_THRESHOLDS = {
  /** 重试间隔（毫秒） */
  RETRY_INTERVAL_MS: 1000,
  /** 最大重试次数 */
  MAX_RETRIES: 2,
  /** 批量检查大小 */
  BATCH_SIZE: 10,
  /** 检查间隔（毫秒） */
  CHECK_INTERVAL_MS: 500,
};
