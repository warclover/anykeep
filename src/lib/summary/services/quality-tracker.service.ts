/**
 * Quality Tracker Service
 *
 * 质量追踪服务实现
 *
 * 功能：
 * - 自动质量评分算法
 * - 质量日志记录
 * - 质量统计分析
 * - 用户反馈处理
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import type {
  SummaryResult,
  SummaryInput,
  QualityLogEntry,
  QualityStats,
  UserFeedback,
  ProviderName,
} from "../summary.types";
import { isStructuredSummary } from "../summary.types";
import type {
  IQualityTrackerService,
  QualityLogInput,
  QualityStatsOutput,
} from "./summary.service.interface";
import type {
  TimeRange,
  ProviderUsageStats,
  QualityLogRepository,
} from "../repositories";
import { getQualityLogRepository } from "../repositories";
import { estimateCost } from "../summary.config";

// ============================================================================
// Quality Scoring Constants
// V4.2.5: 添加详细注释说明评分标准的选择依据
// ============================================================================

/**
 * 质量评分权重
 *
 * 权重分配基于以下考量（总和 = 1.0）：
 * - 用户最关注摘要内容质量，因此摘要长度权重最高
 * - 标签和结构化对搜索/分类有价值，权重次之
 * - 响应时间影响用户体验，但不是核心价值
 * - 完整性作为辅助指标，权重最低
 */
const QUALITY_WEIGHTS = {
  /** 摘要长度评分权重 (25%) - 核心内容质量指标 */
  summaryLength: 0.25,
  /** 标签数量评分权重 (20%) - 分类/搜索价值 */
  tagsCount: 0.2,
  /** 响应时间评分权重 (20%) - 用户体验指标 */
  latency: 0.2,
  /** 结构化程度评分权重 (20%) - JSON 解析成功率 */
  structured: 0.2,
  /** 内容完整性评分权重 (15%) - 是否有截断/错误 */
  completeness: 0.15,
};

/**
 * 质量评分阈值
 *
 * 阈值来源说明：
 * - summaryLength: 基于中文阅读习惯，50-150字为最佳阅读长度
 *   参考：Nielsen Norman Group 研究建议 ~150 字为最佳摘要长度
 * - tagsCount: 2-5 个标签可有效分类且不过度标注
 *   参考：信息架构最佳实践建议 3-7 个分类标签
 * - latency: 基于用户体验研究
 *   参考：Google RAIL 模型 - 响应时间 < 1s 为"即时"，< 3s 为"可接受"
 *   - excellent (< 1s): 用户感知为即时响应
 *   - good (1-3s): 用户感知流畅但有等待
 *   - acceptable (3-5s): 用户开始感到明显延迟
 *   - > 5s: 用户可能放弃等待
 */
const QUALITY_THRESHOLDS = {
  /** 理想摘要长度范围 (字符数) */
  summaryLength: { min: 50, ideal: 150, max: 500 },
  /** 理想标签数量范围 */
  tagsCount: { min: 2, ideal: 5, max: 10 },
  /** 理想响应时间 (ms) - 基于 Google RAIL 模型 */
  latency: { excellent: 1000, good: 3000, acceptable: 5000 },
};

// ============================================================================
// Quality Tracker Service
// ============================================================================

/**
 * 质量追踪服务
 *
 * @example
 * ```typescript
 * const tracker = new QualityTrackerService(supabase);
 *
 * // 计算并记录质量
 * await tracker.trackQuality({
 *   input: summaryInput,
 *   result: summaryResult,
 *   provider: 'deepseek',
 *   model: 'deepseek-chat',
 * });
 *
 * // 获取质量统计
 * const stats = await tracker.getQualityStats('user-uuid');
 * ```
 */
export class QualityTrackerService implements IQualityTrackerService {
  private repository: QualityLogRepository;

  constructor(supabase: SupabaseClient<Database>) {
    this.repository = getQualityLogRepository(supabase);
  }

  // ============================================================================
  // IQualityTrackerService 接口方法实现
  // ============================================================================

  /**
   * 记录质量日志（接口方法）
   */
  async track(log: QualityLogInput): Promise<void> {
    return this.trackQuality(log);
  }

  /**
   * 记录用户反馈（接口方法）
   */
  async recordFeedback(
    bookmarkId: number,
    userId: string,
    rating: number,
    feedback?: string,
  ): Promise<void> {
    return this.recordUserFeedback(bookmarkId, userId, rating, feedback);
  }

  /**
   * 获取质量统计（接口方法）
   */
  async getStats(
    userId: string,
    timeRange?: { start: Date; end: Date },
  ): Promise<QualityStatsOutput> {
    // TimeRange 使用 Date 类型
    return this.getQualityStats(userId, timeRange);
  }

  /**
   * 计算自动质量分（接口方法）
   */
  calculateAutoScore(result: SummaryResult, input: SummaryInput): number {
    // 构建 QualityLogInput 格式
    const logInput: QualityLogInput = {
      input,
      result,
      provider: result.providerUsed || "deepseek",
      model: result.modelUsed || "unknown",
    };
    return this.calculateQualityScore(logInput);
  }

  // ============================================================================
  // 内部实现方法
  // ============================================================================

  /**
   * 追踪摘要质量（内部方法）
   */
  async trackQuality(input: QualityLogInput): Promise<void> {
    try {
      // 计算自动质量评分
      const qualityScore = this.calculateQualityScore(input);

      // 估算成本
      const cost = estimateCost(
        input.provider as ProviderName,
        input.model,
        input.result.usage.inputTokens,
        input.result.usage.outputTokens,
      );

      // 构建日志条目
      const logEntry: QualityLogEntry = {
        bookmarkId: input.input.bookmarkId,
        userId: input.input.userId,
        contentLength:
          (input.input.content?.length || 0) +
          (input.input.title?.length || 0) +
          (input.input.description?.length || 0),
        contentType: input.input.contentType || "unknown",
        providerUsed: input.provider as ProviderName,
        modelUsed: input.model,
        promptVersion: input.promptVersion || "v2",
        summaryLength: input.result.summary?.length || 0,
        tagsCount: input.result.tags?.length || 0,
        latencyMs: input.result.latencyMs,
        tokensInput: input.result.usage.inputTokens,
        tokensOutput: input.result.usage.outputTokens,
        autoQualityScore: qualityScore,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        fallbackUsed: input.fallbackUsed || false,
        estimatedCost: cost,
      };

      // 记录到数据库
      await this.repository.logQuality(logEntry);

      logger.debug(
        {
          bookmarkId: input.input.bookmarkId,
          qualityScore,
          provider: input.provider,
          latencyMs: input.result.latencyMs,
        },
        "QualityTrackerService: Quality tracked",
      );
    } catch (error) {
      // 质量追踪失败不应影响主流程
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "QualityTrackerService: Failed to track quality",
      );
    }
  }

  /**
   * 计算自动质量评分
   *
   * 评分范围：0.00 - 1.00
   */
  calculateQualityScore(input: QualityLogInput): number {
    const scores: Record<string, number> = {};

    // 1. 摘要长度评分
    scores.summaryLength = this.scoreSummaryLength(
      input.result.summary?.length || 0,
    );

    // 2. 标签数量评分
    scores.tagsCount = this.scoreTagsCount(input.result.tags?.length || 0);

    // 3. 响应时间评分
    scores.latency = this.scoreLatency(input.result.latencyMs);

    // 4. 结构化程度评分
    scores.structured = this.scoreStructured(input.result);

    // 5. 内容完整性评分
    scores.completeness = this.scoreCompleteness(input.result);

    // 加权平均
    const weightedScore =
      scores.summaryLength * QUALITY_WEIGHTS.summaryLength +
      scores.tagsCount * QUALITY_WEIGHTS.tagsCount +
      scores.latency * QUALITY_WEIGHTS.latency +
      scores.structured * QUALITY_WEIGHTS.structured +
      scores.completeness * QUALITY_WEIGHTS.completeness;

    // 如果有错误，降低评分
    if (input.errorCode) {
      return Math.max(0, weightedScore * 0.5);
    }

    // 如果使用了 fallback，轻微降低评分
    if (input.fallbackUsed) {
      return Math.max(0, weightedScore * 0.9);
    }

    return Number(weightedScore.toFixed(3));
  }

  /**
   * 摘要长度评分
   */
  private scoreSummaryLength(length: number): number {
    const { min, ideal, max } = QUALITY_THRESHOLDS.summaryLength;

    if (length < min) {
      return length / min; // 0 - 1
    }
    if (length <= ideal) {
      return 1.0; // 理想范围
    }
    if (length <= max) {
      // 超过理想但在可接受范围
      return 1 - ((length - ideal) / (max - ideal)) * 0.3;
    }
    // 过长
    return Math.max(0.5, 1 - (length - max) / max);
  }

  /**
   * 标签数量评分
   */
  private scoreTagsCount(count: number): number {
    const { min, ideal, max } = QUALITY_THRESHOLDS.tagsCount;

    if (count < min) {
      return count / min;
    }
    if (count <= ideal) {
      return 1.0;
    }
    if (count <= max) {
      return 1 - ((count - ideal) / (max - ideal)) * 0.2;
    }
    return 0.7; // 标签过多
  }

  /**
   * 响应时间评分
   */
  private scoreLatency(latencyMs: number): number {
    const { excellent, good, acceptable } = QUALITY_THRESHOLDS.latency;

    if (latencyMs <= excellent) {
      return 1.0;
    }
    if (latencyMs <= good) {
      return 0.9 - ((latencyMs - excellent) / (good - excellent)) * 0.2;
    }
    if (latencyMs <= acceptable) {
      return 0.7 - ((latencyMs - good) / (acceptable - good)) * 0.3;
    }
    // 响应时间过长
    return Math.max(0.2, 0.4 - ((latencyMs - acceptable) / acceptable) * 0.2);
  }

  /**
   * 结构化程度评分
   */
  private scoreStructured(result: SummaryResult): number {
    // V2 版本的结构化摘要得分更高
    if (result.version === 2 && result.structured) {
      const structured = result.structured;
      let score = 0.8; // 基础分

      // 有 TLDR
      if (structured.tldr && structured.tldr.length > 10) {
        score += 0.05;
      }

      // 有关键点
      if (structured.key_points && structured.key_points.length >= 2) {
        score += 0.05;
      }

      // 有情感分析
      if (structured.sentiment) {
        score += 0.05;
      }

      // 有阅读时间
      if (structured.reading_time && structured.reading_time > 0) {
        score += 0.05;
      }

      return Math.min(1.0, score);
    }

    // V1 或非结构化
    if (result.version === 1) {
      return 0.6; // V1 基础分
    }

    // 尝试解析 JSON
    if (isStructuredSummary(result.summary)) {
      return 0.75;
    }

    return 0.5;
  }

  /**
   * 内容完整性评分
   */
  private scoreCompleteness(result: SummaryResult): number {
    let score = 0.5; // 基础分

    // 有摘要内容
    if (result.summary && result.summary.length > 20) {
      score += 0.2;
    }

    // 有标签
    if (result.tags && result.tags.length > 0) {
      score += 0.15;
    }

    // 有 Token 使用统计
    if (result.usage && result.usage.outputTokens > 0) {
      score += 0.1;
    }

    // 有延迟信息
    if (result.latencyMs > 0) {
      score += 0.05;
    }

    return Math.min(1.0, score);
  }

  /**
   * 获取质量统计
   */
  async getQualityStats(
    userId: string,
    timeRange?: TimeRange,
  ): Promise<QualityStatsOutput> {
    try {
      const stats = await this.repository.getQualityStats(userId, timeRange);

      return {
        ...stats,
        qualityTrend: this.calculateQualityTrend(stats),
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "QualityTrackerService: Failed to get quality stats",
      );
      throw error;
    }
  }

  /**
   * 计算质量趋势
   */
  private calculateQualityTrend(
    stats: QualityStats,
  ): "improving" | "stable" | "declining" {
    // 基于成功率和平均质量评分判断趋势
    const successRate =
      stats.totalCount > 0 ? stats.successCount / stats.totalCount : 0;

    if (successRate >= 0.95 && stats.averageQualityScore >= 0.8) {
      return "improving";
    }
    if (successRate >= 0.85 && stats.averageQualityScore >= 0.6) {
      return "stable";
    }
    return "declining";
  }

  /**
   * 记录用户反馈
   */
  async recordUserFeedback(
    bookmarkId: number,
    userId: string,
    rating: number,
    feedback?: string,
  ): Promise<void> {
    try {
      await this.repository.recordUserFeedback(
        bookmarkId,
        userId,
        rating,
        feedback,
      );

      logger.info(
        { bookmarkId, userId, rating },
        "QualityTrackerService: User feedback recorded",
      );
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "QualityTrackerService: Failed to record user feedback",
      );
      throw error;
    }
  }

  /**
   * 获取用户反馈列表
   */
  async getUserFeedbacks(
    userId: string,
    limit?: number,
  ): Promise<UserFeedback[]> {
    return this.repository.getUserFeedbacks(userId, limit);
  }

  /**
   * 获取 Provider 使用统计
   */
  async getProviderUsageStats(
    userId: string,
    timeRange?: TimeRange,
  ): Promise<ProviderUsageStats> {
    return this.repository.getProviderUsageStats(userId, timeRange);
  }

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(daysOld: number = 90): Promise<number> {
    return this.repository.cleanupOldLogs(daysOld);
  }

  /**
   * 获取质量评分详情（调试用）
   */
  getScoreBreakdown(input: QualityLogInput): Record<string, number> {
    return {
      summaryLength: this.scoreSummaryLength(input.result.summary?.length || 0),
      tagsCount: this.scoreTagsCount(input.result.tags?.length || 0),
      latency: this.scoreLatency(input.result.latencyMs),
      structured: this.scoreStructured(input.result),
      completeness: this.scoreCompleteness(input.result),
      weighted: this.calculateQualityScore(input),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let serviceInstance: QualityTrackerService | null = null;
let serviceSupabase: SupabaseClient<Database> | null = null;

/**
 * 获取 QualityTrackerService 实例
 */
export function getQualityTrackerService(
  supabase: SupabaseClient<Database>,
): QualityTrackerService {
  if (!serviceInstance || serviceSupabase !== supabase) {
    serviceInstance = new QualityTrackerService(supabase);
    serviceSupabase = supabase;
  }
  return serviceInstance;
}

/**
 * 重置 QualityTrackerService 实例（主要用于测试）
 */
export function resetQualityTrackerService(): void {
  serviceInstance = null;
  serviceSupabase = null;
}
