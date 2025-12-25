/**
 * 分层分类服务类型定义
 *
 * @module classification/advanced/types
 * @version 4.2.5
 * @since 2025-12-24
 */

import type {
  ClassificationResult,
  MatchResult,
  MatcherScoreDetail,
  DecisionReason,
} from "@/lib/classification/types";
import type { IMatcher } from "@/lib/classification/strategies/interfaces";

// ============================================================================
// 常量定义
// ============================================================================

/**
 * V4.2.5: 指标采样策略说明
 *
 * 设计原则：
 * - 平衡详细度与性能开销
 * - 防止内存无限增长
 * - 提供足够的统计样本量
 *
 * 采样策略：
 * 1. 内存指标（TieredMetrics）：
 *    - 每次分类都更新计数器（轻量级操作）
 *    - 每 100 次分类记录一次详细日志（采样率 1%）
 *    - 达到 10000 次后自动重置（防止内存溢出）
 *
 * 2. 日志采样（logMetrics）：
 *    - 采样率：1/100 = 1%
 *    - 原因：减少日志存储成本，同时保持统计有效性
 *    - 统计学依据：根据大数定律，1% 采样率在 10000 次操作中
 *      可提供约 100 个样本点，足以估计真实分布（误差 < 10%）
 *
 * 3. 持久化指标（ClassificationMetricsService）：
 *    - 所有分类都记录到数据库（完整记录）
 *    - 通过 RPC 函数批量写入优化性能
 *    - 每日聚合视图（classification_metrics_daily）减少查询开销
 *
 * 阈值来源：
 * - 10000 次重置阈值：假设单用户每天最多 1000 次分类，
 *   10000 次覆盖约 10 天数据，足够分析短期趋势
 * - 100 次日志间隔：平衡日志可读性与信息密度
 */
export const METRICS_AUTO_RESET_THRESHOLD = 10000;

/** V4.2.5: 日志采样间隔（每 N 次分类记录一次详细日志） */
export const METRICS_LOG_INTERVAL = 100;

// ============================================================================
// 配置类型
// ============================================================================

/**
 * 分层配置
 */
export interface TieredClassificationConfig {
  /** 高置信度阈值 - 达到则跳过 AI */
  highConfidenceThreshold: number;

  /** 中置信度阈值 - 达到则调用 AI 确认 */
  mediumConfidenceThreshold: number;

  /** 自动创建置信度阈值 */
  autoCreateConfidenceThreshold: number;

  /** 是否启用分层优化 */
  tieredOptimizationEnabled: boolean;

  /** 是否记录优化指标 */
  metricsEnabled: boolean;

  /** V4.0: 是否启用全链路追踪 */
  tracingEnabled: boolean;

  /** V4.0: 是否返回完整决策路径（用于调试模式） */
  includeDecisionPath: boolean;

  /** V4.0: 是否启用实时纠错缓存 (Tier 0) */
  correctionCacheEnabled: boolean;

  /** V4.0: 纠错缓存命中的最低置信度阈值 */
  correctionCacheMinConfidence: number;

  /** V4.0: 单个匹配器最大执行时间 (ms) */
  matcherTimeoutMs: number;
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: TieredClassificationConfig = {
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 50,
  autoCreateConfidenceThreshold: 75,
  tieredOptimizationEnabled: true,
  metricsEnabled: true,
  tracingEnabled: true, // V4.0: 默认启用追踪
  includeDecisionPath: false, // V4.0: 默认不返回完整路径（节省带宽）
  correctionCacheEnabled: true, // V4.0: 默认启用纠错缓存
  correctionCacheMinConfidence: 60, // V4.0: 相似匹配最低 60% 置信度
  matcherTimeoutMs: 500, // V4.0: 单个匹配器最大 500ms
};

// ============================================================================
// 匹配器分组
// ============================================================================

/**
 * 分层匹配器分组
 */
export interface MatcherGroups {
  /** 快速匹配器（无 AI 成本） */
  fast: IMatcher[];

  /** AI 匹配器 */
  ai: IMatcher | null;
}

// ============================================================================
// 指标类型
// ============================================================================

/**
 * 优化指标
 */
export interface TieredMetrics {
  /** 总分类次数 */
  totalClassifications: number;

  /** AI 调用次数 */
  aiCallCount: number;

  /** AI 跳过次数（通过 Tier 1 直接分类） */
  aiSkippedCount: number;

  /** AI 节省率 */
  aiSavingsRate: number;

  /** 各层分类次数 */
  tierCounts: {
    tier0: number; // V4.0: 纠错缓存命中
    tier1: number;
    tier2: number;
    tier3: number;
    inbox: number;
  };

  /** V4.0: 匹配器超时次数 */
  matcherTimeoutCount: number;

  /** V4.0: 匹配器错误次数 */
  matcherErrorCount: number;

  /** 指标开始时间 */
  startedAt: number;

  /** 上次重置时间 */
  lastResetAt: number;
}

// ============================================================================
// 结果类型
// ============================================================================

/**
 * 分层结果
 */
export interface TieredResult {
  /** 最终分类结果 */
  result: ClassificationResult;

  /** 使用的层级 (0 = inbox fallback) */
  tier: 1 | 2 | 3 | 0;

  /** 是否调用了 AI */
  aiCalled: boolean;

  /** V4.0: 是否命中纠错缓存 */
  cacheHit: boolean;

  /** 各层耗时 */
  timings: TieredTimings;

  /** V4.0 追踪信息 */
  traceId: string;
  matcherScores: MatcherScoreDetail[];
}

/**
 * 分层耗时
 */
export interface TieredTimings {
  tier0Ms?: number; // V4.0: 纠错缓存查询耗时
  tier1Ms?: number;
  tier2Ms?: number;
  tier3Ms?: number;
}

// ============================================================================
// 快速匹配得分
// ============================================================================

/**
 * 快速匹配综合得分
 */
export interface FastScore {
  folderId: number | null;
  folderName: string | null;
  score: number;
  scores: {
    vectorScore: number;
    historyScore: number;
    aiScore: number;
  };
}

// ============================================================================
// 乐观 UI 类型
// ============================================================================

/**
 * 快速分类结果（用于乐观 UI）
 */
export interface QuickClassificationResult {
  /** 分类结果 */
  result: ClassificationResult;
  /** 使用的层级 (0 = cache, 1 = fast matchers) */
  tier: 0 | 1;
  /** 是否需要深度验证 */
  needsDeepValidation: boolean;
  /** 追踪 ID（用于关联深度验证） */
  traceId: string;
  /** 耗时统计 */
  timings: {
    tier0Ms?: number;
    tier1Ms?: number;
  };
  /** 用户可读的决策理由 (V4.0) */
  decisionReason: DecisionReason;
}

/**
 * 深度验证结果
 */
export interface DeepClassificationResult {
  /** 最终分类结果 */
  result: ClassificationResult;
  /** 结果是否与快速分类不同 */
  changed: boolean;
  /** 使用的层级 */
  tier: 0 | 1 | 2 | 3;
  /** 是否调用了 AI */
  aiCalled: boolean;
  /** 追踪 ID */
  traceId: string;
  /** 耗时统计 */
  timings: TieredTimings;
  /** 错误信息（如果有） */
  error?: string;
  /** 用户可读的决策理由 (V4.0) */
  decisionReason: DecisionReason;
}

// ============================================================================
// 匹配器结果类型
// ============================================================================

/**
 * 匹配器执行结果
 */
export interface MatcherExecutionResult {
  name: string;
  results: MatchResult[];
  durationMs: number;
}

// ============================================================================
// 决策理由生成选项
// ============================================================================

/**
 * 决策理由生成选项
 */
export interface DecisionReasonOptions {
  cacheHit?: boolean;
  aiCalled?: boolean;
  changed?: boolean;
  matcherInfo?: string;
}
