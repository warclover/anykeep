/**
 * 异步分析服务类型定义
 *
 * Phase 4: AsyncAnalysisService - 后台异步分析任务
 *
 * @module ai-agent/async-analysis
 * @version 1.0.0
 * @since 2025-12-30
 */

import type { ProactiveInsight, SuggestedAction } from "../proactive-briefing";

// =============================================================================
// 分析任务类型
// =============================================================================

/**
 * 分析任务类型枚举
 */
export type AnalysisTaskType =
  | "topic_clustering" // 主题聚类
  | "pattern_detection" // 模式检测
  | "global_insight_update" // 全局洞察更新
  | "duplicate_detection" // 重复检测
  | "content_enrichment"; // 内容增强

/**
 * 任务触发条件
 */
export type TaskTrigger =
  | "post_interaction" // 用户交互后
  | "post_collection" // 收藏后
  | "scheduled" // 定时触发
  | "manual" // 手动触发
  | "on_visit"; // 用户上线时

/**
 * 任务优先级
 */
export type TaskPriority = "low" | "medium" | "high";

/**
 * 任务状态
 */
export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

// =============================================================================
// 异步分析任务
// =============================================================================

/**
 * 异步分析任务
 */
export interface AsyncAnalysisTask {
  /** 任务 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 任务类型 */
  type: AnalysisTaskType;
  /** 优先级 */
  priority: TaskPriority;
  /** 状态 */
  status: TaskStatus;
  /** 触发条件 */
  trigger: TaskTrigger;
  /** 输入数据 */
  input?: Record<string, unknown>;
  /** 输出结果 */
  output?: Record<string, unknown>;
  /** 创建时间 */
  createdAt: string;
  /** 开始时间 */
  startedAt?: string;
  /** 完成时间 */
  completedAt?: string;
  /** 错误信息 */
  error?: string;
  /** 重试次数 */
  retryCount?: number;
  /** 最大重试次数 */
  maxRetries?: number;
}

// =============================================================================
// 分析结果
// =============================================================================

/**
 * 分析结果
 */
export interface AnalysisResult {
  /** 任务 ID */
  taskId: string;
  /** 结果类型 */
  type: AnalysisTaskType;
  /** 结果数据 */
  data: unknown;
  /** 生成的洞察 */
  insights: ProactiveInsight[];
  /** 建议的操作 */
  suggestedActions: SuggestedAction[];
  /** 完成时间 */
  completedAt: string;
  /** 执行耗时（毫秒） */
  durationMs: number;
}

// =============================================================================
// 分析器接口
// =============================================================================

/**
 * 分析器接口
 *
 * 所有分析器必须实现此接口
 */
export interface IAnalyzer {
  /** 分析器类型 */
  readonly type: AnalysisTaskType;

  /**
   * 执行分析
   *
   * @param task - 分析任务
   * @returns 分析结果
   */
  analyze(task: AsyncAnalysisTask): Promise<AnalyzerOutput>;

  /**
   * 检查是否可以执行
   *
   * @param task - 分析任务
   * @returns 是否可以执行
   */
  canExecute(task: AsyncAnalysisTask): Promise<boolean>;
}

/**
 * 分析器输出
 */
export interface AnalyzerOutput {
  /** 结果数据 */
  data: unknown;
  /** 生成的洞察 */
  insights: ProactiveInsight[];
  /** 建议的操作 */
  suggestedActions: SuggestedAction[];
}

// =============================================================================
// 主题聚类相关类型
// =============================================================================

/**
 * 主题聚类结果
 */
export interface TopicClusteringResult {
  /** 聚类列表 */
  clusters: TopicCluster[];
  /** 未分类的书签 ID */
  uncategorized: number[];
  /** 聚类时间戳 */
  clusteredAt: string;
}

/**
 * 主题聚类
 */
export interface TopicCluster {
  /** 聚类 ID */
  id: string;
  /** 主题名称 */
  topic: string;
  /** 主题关键词 */
  keywords: string[];
  /** 书签 ID 列表 */
  bookmarkIds: number[];
  /** 聚类置信度 */
  confidence: number;
  /** 是否为新兴主题 */
  isEmerging: boolean;
}

// =============================================================================
// 模式检测相关类型
// =============================================================================

/**
 * 模式检测结果
 */
export interface PatternDetectionResult {
  /** 检测到的模式列表 */
  patterns: DetectedPattern[];
  /** 检测时间戳 */
  detectedAt: string;
}

/**
 * 检测到的模式
 */
export interface DetectedPattern {
  /** 模式 ID */
  id: string;
  /** 模式类型 */
  type: PatternType;
  /** 模式描述 */
  description: string;
  /** 相关书签 ID */
  bookmarkIds: number[];
  /** 置信度 */
  confidence: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 模式类型
 */
export type PatternType =
  | "time_based" // 时间模式（如每周五收藏技术文章）
  | "topic_shift" // 主题变化（关注点转移）
  | "collection_spike" // 收藏高峰
  | "dormant_topic" // 沉寂主题
  | "conflicting_views" // 冲突观点
  | "complementary"; // 互补内容

// =============================================================================
// 服务配置
// =============================================================================

/**
 * 异步分析服务配置
 */
export interface AsyncAnalysisConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 最大并发任务数 */
  maxConcurrentTasks: number;
  /** 任务超时时间（毫秒） */
  taskTimeoutMs: number;
  /** 默认最大重试次数 */
  defaultMaxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelayMs: number;
  /** 是否启用主题聚类 */
  enableTopicClustering: boolean;
  /** 是否启用模式检测 */
  enablePatternDetection: boolean;
}

/**
 * 延迟触发配置
 */
export interface LazyTriggerConfig {
  /** 是否启用延迟触发 */
  enabled: boolean;
  /** 最小离线时长（毫秒），低于此值不触发 */
  minOfflineDurationMs: number;
  /** 触发延迟（毫秒），用户上线后延迟执行 */
  triggerDelayMs: number;
  /** 每次触发的最大任务数 */
  maxTasksPerTrigger: number;
}

// =============================================================================
// 调度相关类型
// =============================================================================

/**
 * 调度选项
 */
export interface ScheduleOptions {
  /** 触发条件 */
  trigger: TaskTrigger;
  /** 优先级 */
  priority: TaskPriority;
  /** 要执行的任务类型 */
  types?: AnalysisTaskType[];
  /** 输入数据 */
  input?: Record<string, unknown>;
  /** 延迟执行（毫秒） */
  delayMs?: number;
}

/**
 * 任务队列统计
 */
export interface TaskQueueStats {
  /** 待处理任务数 */
  pending: number;
  /** 运行中任务数 */
  running: number;
  /** 已完成任务数 */
  completed: number;
  /** 失败任务数 */
  failed: number;
  /** 按类型统计 */
  byType: Record<AnalysisTaskType, number>;
}

// =============================================================================
// 日志模块标识
// =============================================================================

export const LOG_MODULE = "AsyncAnalysis";
