/**
 * Accuracy Tracker Service
 * V4.2 历史准确率统计服务
 *
 * @description 跟踪分类准确率统计，用于置信度校准
 * - 全局准确率跟踪
 * - 文件夹级别准确率
 * - 置信度区间准确率
 * - 时间衰减的准确率计算
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import { eventBus, ClassificationEvents } from "@/lib/shared/event-bus";
import type { ClassificationFeedbackEvent } from "@/lib/shared/event-bus";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/** 准确率记录 */
export interface AccuracyRecord {
  userId: string;
  /** 总预测数 */
  totalPredictions: number;
  /** 正确预测数 */
  correctPredictions: number;
  /** 准确率 */
  accuracy: number;
  /** 最后更新时间 */
  lastUpdated: string;
}

/** 文件夹准确率 */
export interface FolderAccuracy {
  folderId: number;
  folderName: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  /** 置信度分布 */
  confidenceDistribution: ConfidenceBucket[];
}

/** 置信度桶统计 */
export interface ConfidenceBucket {
  /** 桶范围开始 (0-100) */
  rangeStart: number;
  /** 桶范围结束 */
  rangeEnd: number;
  /** 该范围内的预测数 */
  count: number;
  /** 该范围内的正确数 */
  correct: number;
  /** 该范围的实际准确率 */
  actualAccuracy: number;
}

/** 分类结果记录 */
export interface ClassificationOutcome {
  userId: string;
  bookmarkId: number;
  folderId: number | null;
  predictedConfidence: number;
  isCorrect: boolean;
  timestamp: string;
}

/** 准确率统计配置 */
export interface AccuracyTrackerConfig {
  /** 置信度桶数量 (默认 10) */
  bucketCount: number;
  /** 时间衰减因子 (默认 0.95，每周) */
  decayFactor: number;
  /** 衰减周期（天） */
  decayPeriodDays: number;
  /** 最小样本数（用于可靠性判断） */
  minSampleSize: number;
  /** 缓存TTL（毫秒） */
  cacheTTL: number;
}

/** 用户准确率汇总 */
export interface UserAccuracySummary {
  userId: string;
  /** 全局准确率 */
  globalAccuracy: number;
  /** 加权准确率（考虑时间衰减） */
  weightedAccuracy: number;
  /** 总预测数 */
  totalPredictions: number;
  /** 各文件夹准确率 */
  folderAccuracies: FolderAccuracy[];
  /** 置信度校准曲线 */
  calibrationCurve: ConfidenceBucket[];
  /** 数据可靠性 */
  reliability: "high" | "medium" | "low";
  /** 统计时间范围 */
  timeRange: {
    start: string;
    end: string;
  };
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: AccuracyTrackerConfig = {
  bucketCount: 10,
  decayFactor: 0.95,
  decayPeriodDays: 7,
  minSampleSize: 20,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 准确率跟踪服务
 */
export class AccuracyTrackerService {
  private config: AccuracyTrackerConfig;
  private cache: Map<string, { data: UserAccuracySummary; timestamp: number }> =
    new Map();
  private isListening = false;

  constructor(config: Partial<AccuracyTrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // 公共 API
  // --------------------------------------------------------------------------

  /**
   * 获取用户准确率汇总
   */
  async getUserAccuracySummary(userId: string): Promise<UserAccuracySummary> {
    // 检查缓存
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
      return cached.data;
    }

    const supabase = await createClient();

    // 从 classification_metrics 获取数据
    let outcomes: Array<{
      is_correct: boolean;
      created_at: string;
      folder_id: number | null;
      predicted_confidence: number;
    }> = [];

    const { data: metrics } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("classification_metrics" as any)
      .select("folder_id, confidence, user_feedback, created_at")
      .eq("user_id", userId)
      .not("user_feedback", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (metrics) {
      outcomes = metrics.map((m) => ({
        is_correct: m.user_feedback === "accept",
        created_at: m.created_at,
        folder_id: m.folder_id,
        predicted_confidence: m.confidence,
      }));
    }

    if (outcomes.length === 0) {
      return this.createEmptySummary(userId);
    }

    // 计算全局准确率
    const globalStats = this.calculateGlobalAccuracy(outcomes);

    // 计算加权准确率（时间衰减）
    const weightedStats = this.calculateWeightedAccuracy(outcomes);

    // 计算文件夹级别准确率
    const folderAccuracies = await this.calculateFolderAccuracies(
      userId,
      outcomes,
    );

    // 生成校准曲线
    const calibrationCurve = this.generateCalibrationCurve(outcomes);

    // 判断数据可靠性
    const reliability = this.assessReliability(outcomes.length);

    const summary: UserAccuracySummary = {
      userId,
      globalAccuracy: globalStats.accuracy,
      weightedAccuracy: weightedStats.accuracy,
      totalPredictions: outcomes.length,
      folderAccuracies,
      calibrationCurve,
      reliability,
      timeRange: {
        start:
          outcomes[outcomes.length - 1]?.created_at || new Date().toISOString(),
        end: outcomes[0]?.created_at || new Date().toISOString(),
      },
    };

    // 更新缓存
    this.cache.set(userId, { data: summary, timestamp: Date.now() });

    return summary;
  }

  /**
   * 记录分类结果
   * 使用 classification_metrics 表的 user_feedback 字段
   */
  async recordOutcome(outcome: ClassificationOutcome): Promise<void> {
    try {
      const supabase = await createClient();

      // 使用 classification_metrics 表记录
      // 首先查找该书签的最近一条记录
      const { data: existingRecord } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("classification_metrics" as any)
        .select("id")
        .eq("user_id", outcome.userId)
        .eq("bookmark_id", outcome.bookmarkId)
        .is("user_feedback", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingRecord) {
        // 更新现有记录
        await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("classification_metrics" as any)
          .update({
            user_feedback: outcome.isCorrect ? "accept" : "reject",
            feedback_at: outcome.timestamp,
          })
          .eq("id", existingRecord.id);
      }

      // 清除缓存
      this.cache.delete(outcome.userId);
    } catch (error) {
      logger.warn(
        {
          userId: outcome.userId,
          bookmarkId: outcome.bookmarkId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "AccuracyTracker: Failed to record outcome",
      );
    }
  }

  /**
   * 根据反馈更新结果
   */
  async updateOutcomeFromFeedback(
    userId: string,
    bookmarkId: number,
    isCorrect: boolean,
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // 更新 classification_metrics 表
      await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("classification_metrics" as any)
        .update({
          user_feedback: isCorrect ? "accept" : "reject",
          feedback_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("bookmark_id", bookmarkId)
        .is("user_feedback", null)
        .order("created_at", { ascending: false })
        .limit(1);

      // 清除缓存
      this.cache.delete(userId);
    } catch (error) {
      logger.warn(
        {
          userId,
          bookmarkId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "AccuracyTracker: Failed to update outcome from feedback",
      );
    }
  }

  /**
   * 获取文件夹准确率
   */
  async getFolderAccuracy(
    userId: string,
    folderId: number,
  ): Promise<FolderAccuracy | null> {
    const summary = await this.getUserAccuracySummary(userId);
    return (
      summary.folderAccuracies.find((f) => f.folderId === folderId) || null
    );
  }

  /**
   * 获取置信度区间的实际准确率
   */
  async getActualAccuracyForConfidence(
    userId: string,
    confidence: number,
  ): Promise<number> {
    const summary = await this.getUserAccuracySummary(userId);

    // 找到对应的置信度桶
    const bucket = summary.calibrationCurve.find(
      (b) => confidence * 100 >= b.rangeStart && confidence * 100 < b.rangeEnd,
    );

    if (bucket && bucket.count >= this.config.minSampleSize / 2) {
      return bucket.actualAccuracy;
    }

    // 样本不足，返回加权准确率
    return summary.weightedAccuracy;
  }

  /**
   * 启动事件监听
   */
  startListening(): void {
    if (this.isListening) return;

    eventBus.on(
      ClassificationEvents.FEEDBACK_RECEIVED,
      this.handleFeedback.bind(this),
    );

    this.isListening = true;
  }

  /**
   * 停止事件监听
   */
  stopListening(): void {
    if (!this.isListening) return;

    eventBus.off(
      ClassificationEvents.FEEDBACK_RECEIVED,
      this.handleFeedback.bind(this),
    );

    this.isListening = false;
  }

  /**
   * 清除缓存
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }

  // --------------------------------------------------------------------------
  // 私有方法
  // --------------------------------------------------------------------------

  /**
   * 处理分类反馈事件
   */
  private async handleFeedback(
    event: ClassificationFeedbackEvent,
  ): Promise<void> {
    const isCorrect =
      event.feedbackType === "confirmed" || event.feedbackType === "correct";

    await this.updateOutcomeFromFeedback(
      event.userId,
      event.bookmarkId,
      isCorrect,
    );
  }

  /**
   * 计算全局准确率
   */
  private calculateGlobalAccuracy(outcomes: Array<{ is_correct: boolean }>): {
    accuracy: number;
    total: number;
    correct: number;
  } {
    const total = outcomes.length;
    const correct = outcomes.filter((o) => o.is_correct).length;
    return {
      accuracy: total > 0 ? correct / total : 0,
      total,
      correct,
    };
  }

  /**
   * 计算加权准确率（时间衰减）
   */
  private calculateWeightedAccuracy(
    outcomes: Array<{ is_correct: boolean; created_at: string }>,
  ): { accuracy: number } {
    if (outcomes.length === 0) {
      return { accuracy: 0 };
    }

    const now = new Date();
    let weightedCorrect = 0;
    let totalWeight = 0;

    for (const outcome of outcomes) {
      const outcomeDate = new Date(outcome.created_at);
      const daysDiff =
        (now.getTime() - outcomeDate.getTime()) / (1000 * 60 * 60 * 24);
      const periods = daysDiff / this.config.decayPeriodDays;
      const weight = Math.pow(this.config.decayFactor, periods);

      totalWeight += weight;
      if (outcome.is_correct) {
        weightedCorrect += weight;
      }
    }

    return {
      accuracy: totalWeight > 0 ? weightedCorrect / totalWeight : 0,
    };
  }

  /**
   * 计算文件夹级别准确率
   */
  private async calculateFolderAccuracies(
    userId: string,
    outcomes: Array<{
      folder_id: number | null;
      is_correct: boolean;
      predicted_confidence: number;
    }>,
  ): Promise<FolderAccuracy[]> {
    // 按文件夹分组
    const folderGroups = new Map<
      number,
      Array<{ is_correct: boolean; predicted_confidence: number }>
    >();

    for (const outcome of outcomes) {
      if (outcome.folder_id === null) continue;

      const group = folderGroups.get(outcome.folder_id) || [];
      group.push({
        is_correct: outcome.is_correct,
        predicted_confidence: outcome.predicted_confidence,
      });
      folderGroups.set(outcome.folder_id, group);
    }

    // 获取文件夹名称
    const supabase = await createClient();
    const folderIds = Array.from(folderGroups.keys());

    const { data: folders } = await supabase
      .from("folders")
      .select("id, name")
      .in("id", folderIds);

    const folderNameMap = new Map(folders?.map((f) => [f.id, f.name]) || []);

    // 计算各文件夹准确率
    const folderAccuracies: FolderAccuracy[] = [];

    for (const [folderId, group] of folderGroups) {
      const total = group.length;
      const correct = group.filter((o) => o.is_correct).length;
      const confidenceDistribution = this.generateCalibrationCurve(
        group.map((o) => ({
          predicted_confidence: o.predicted_confidence,
          is_correct: o.is_correct,
        })),
      );

      folderAccuracies.push({
        folderId,
        folderName: folderNameMap.get(folderId) || `文件夹 ${folderId}`,
        totalPredictions: total,
        correctPredictions: correct,
        accuracy: total > 0 ? correct / total : 0,
        confidenceDistribution,
      });
    }

    return folderAccuracies.sort(
      (a, b) => b.totalPredictions - a.totalPredictions,
    );
  }

  /**
   * 生成校准曲线
   */
  private generateCalibrationCurve(
    outcomes: Array<{ predicted_confidence: number; is_correct: boolean }>,
  ): ConfidenceBucket[] {
    const bucketSize = 100 / this.config.bucketCount;
    const buckets: ConfidenceBucket[] = [];

    for (let i = 0; i < this.config.bucketCount; i++) {
      const rangeStart = i * bucketSize;
      const rangeEnd = (i + 1) * bucketSize;

      const bucketOutcomes = outcomes.filter(
        (o) =>
          o.predicted_confidence >= rangeStart &&
          o.predicted_confidence < rangeEnd,
      );

      const count = bucketOutcomes.length;
      const correct = bucketOutcomes.filter((o) => o.is_correct).length;

      buckets.push({
        rangeStart,
        rangeEnd,
        count,
        correct,
        actualAccuracy: count > 0 ? correct / count : 0,
      });
    }

    return buckets;
  }

  /**
   * 评估数据可靠性
   */
  private assessReliability(sampleSize: number): "high" | "medium" | "low" {
    if (sampleSize >= this.config.minSampleSize * 5) return "high";
    if (sampleSize >= this.config.minSampleSize) return "medium";
    return "low";
  }

  /**
   * 创建空汇总
   */
  private createEmptySummary(userId: string): UserAccuracySummary {
    const now = new Date().toISOString();
    return {
      userId,
      globalAccuracy: 0,
      weightedAccuracy: 0,
      totalPredictions: 0,
      folderAccuracies: [],
      calibrationCurve: this.generateCalibrationCurve([]),
      reliability: "low",
      timeRange: {
        start: now,
        end: now,
      },
    };
  }
}

// ============================================================================
// 单例和工厂
// ============================================================================

let accuracyTrackerInstance: AccuracyTrackerService | null = null;

/**
 * 获取准确率跟踪服务实例
 */
export function getAccuracyTracker(): AccuracyTrackerService {
  if (!accuracyTrackerInstance) {
    accuracyTrackerInstance = new AccuracyTrackerService();
  }
  return accuracyTrackerInstance;
}

/**
 * 创建准确率跟踪服务
 */
export function createAccuracyTracker(
  config?: Partial<AccuracyTrackerConfig>,
): AccuracyTrackerService {
  return new AccuracyTrackerService(config);
}

export default AccuracyTrackerService;
