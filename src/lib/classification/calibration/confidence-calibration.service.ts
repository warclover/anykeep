/**
 * Confidence Calibration Service
 * V4.2 置信度校准服务
 *
 * @description 校准分类置信度，使预测置信度与实际准确率一致
 * - 基于历史数据校准置信度
 * - 多匹配器一致性评估
 * - 文件夹级别准确率追踪
 * - 贝叶斯平滑处理小样本
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/** 校准桶配置 */
export interface CalibrationBucket {
  /** 桶 ID (0-9，代表 0-10%, 10-20%, ... 90-100%) */
  bucketId: number;
  /** 置信度下限 (包含) */
  minConfidence: number;
  /** 置信度上限 (不包含) */
  maxConfidence: number;
  /** 预测数量 */
  totalPredictions: number;
  /** 正确数量 */
  correctPredictions: number;
  /** 实际准确率 */
  actualAccuracy: number;
  /** 校准后的置信度 */
  calibratedConfidence: number;
}

/** 文件夹级别校准数据 */
export interface FolderCalibrationData {
  folderId: number;
  folderName: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  /** 最近 30 天准确率 */
  recentAccuracy: number | null;
  /** 置信度偏差 (预测置信度 - 实际准确率) */
  confidenceBias: number;
}

/** 校准结果 */
export interface CalibrationResult {
  /** 原始置信度 */
  originalConfidence: number;
  /** 校准后置信度 */
  calibratedConfidence: number;
  /** 校准因子 */
  calibrationFactor: number;
  /** 校准来源 */
  source: "bucket" | "folder" | "matcher_agreement" | "none";
  /** 校准原因 */
  reason: string;
  /** 匹配器一致性评估（如果有多个匹配器） */
  matcherAgreement?: {
    agreementScore: number;
    agreementLevel: "high" | "medium" | "low" | "conflict";
    hasConsensus: boolean;
  };
}

/** 匹配器结果（用于一致性评估） */
export interface MatcherResult {
  matcherName: string;
  folderId: number | null;
  folderName?: string | null;
  confidence: number;
  weight?: number;
}

/** 一致性评估结果 */
export interface AgreementAssessment {
  /** 匹配器数量 */
  matcherCount: number;
  /** 一致同意的匹配器数量 */
  agreeingMatchers: number;
  /** 一致性分数 (0-1) */
  agreementScore: number;
  /** 是否达成共识 */
  hasConsensus: boolean;
  /** 共识文件夹 ID */
  consensusFolderId: number | null;
  /** 加权平均置信度 */
  weightedConfidence: number;
}

// ============================================================================
// 配置常量
// ============================================================================

/** 校准配置 */
export const CALIBRATION_CONFIG = {
  /** 最小样本数量（用于贝叶斯平滑） */
  MIN_SAMPLES_FOR_CALIBRATION: 10,
  /** 贝叶斯先验强度（伪样本数） */
  BAYESIAN_PRIOR_STRENGTH: 5,
  /** 贝叶斯先验准确率 */
  BAYESIAN_PRIOR_ACCURACY: 0.7,
  /** 达成共识的最小一致性分数 */
  CONSENSUS_THRESHOLD: 0.6,
  /** 高一致性分数阈值 */
  HIGH_AGREEMENT_THRESHOLD: 0.8,
  /** 低一致性惩罚因子 */
  LOW_AGREEMENT_PENALTY: 0.85,
  /** 高一致性奖励因子 */
  HIGH_AGREEMENT_BONUS: 1.1,
  /** 最大校准调整幅度 */
  MAX_CALIBRATION_ADJUSTMENT: 0.2,
  /** 置信度下限 */
  MIN_CONFIDENCE: 0.1,
  /** 置信度上限 */
  MAX_CONFIDENCE: 0.99,
};

// ============================================================================
// 服务实现
// ============================================================================

export class ConfidenceCalibrationService {
  private static instance: ConfidenceCalibrationService | null = null;

  /** 校准桶缓存 */
  private bucketCache: Map<string, CalibrationBucket[]> = new Map();
  /** 文件夹校准缓存 */
  private folderCache: Map<string, Map<number, FolderCalibrationData>> =
    new Map();
  /** 缓存过期时间 */
  private cacheExpiry: Map<string, number> = new Map();
  /** 缓存 TTL (毫秒) */
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 分钟

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ConfidenceCalibrationService {
    if (!ConfidenceCalibrationService.instance) {
      ConfidenceCalibrationService.instance =
        new ConfidenceCalibrationService();
    }
    return ConfidenceCalibrationService.instance;
  }

  /**
   * 校准置信度
   * 综合使用多种校准策略
   */
  async calibrateConfidence(
    userId: string,
    rawConfidence: number,
    folderId: number | null,
    matcherResults?: MatcherResult[]
  ): Promise<CalibrationResult> {
    let calibratedConfidence = rawConfidence;
    let calibrationFactor = 1.0;
    let source: CalibrationResult["source"] = "none";
    let reason = "No calibration applied";
    let matcherAgreement: CalibrationResult["matcherAgreement"] = undefined;

    try {
      // 1. 多匹配器一致性校准
      if (matcherResults && matcherResults.length >= 2) {
        const agreement = this.assessMatcherAgreement(matcherResults);

        // 记录匹配器一致性结果
        matcherAgreement = {
          agreementScore: agreement.agreementScore,
          agreementLevel: this.getAgreementLevel(agreement.agreementScore),
          hasConsensus: agreement.hasConsensus,
        };

        if (agreement.hasConsensus) {
          // 高一致性：提升置信度
          if (agreement.agreementScore >= CALIBRATION_CONFIG.HIGH_AGREEMENT_THRESHOLD) {
            calibrationFactor = Math.min(
              CALIBRATION_CONFIG.HIGH_AGREEMENT_BONUS,
              1 + (agreement.agreementScore - CALIBRATION_CONFIG.HIGH_AGREEMENT_THRESHOLD) * 0.5
            );
            reason = `High matcher agreement (${(agreement.agreementScore * 100).toFixed(0)}%)`;
          }
        } else {
          // 低一致性：降低置信度
          calibrationFactor = CALIBRATION_CONFIG.LOW_AGREEMENT_PENALTY;
          reason = `Low matcher agreement (${(agreement.agreementScore * 100).toFixed(0)}%)`;
        }

        calibratedConfidence = rawConfidence * calibrationFactor;
        source = "matcher_agreement";
      }

      // 2. 文件夹级别校准
      if (folderId) {
        const folderData = await this.getFolderCalibrationData(userId, folderId);

        if (folderData && folderData.totalPredictions >= CALIBRATION_CONFIG.MIN_SAMPLES_FOR_CALIBRATION) {
          const folderBias = folderData.confidenceBias;

          // 如果文件夹历史偏差较大，进行调整
          if (Math.abs(folderBias) > 0.1) {
            const adjustment = this.clampAdjustment(-folderBias * 0.5);
            calibratedConfidence += adjustment;
            source = "folder";
            reason = `Folder calibration (historical bias: ${(folderBias * 100).toFixed(1)}%)`;
          }
        }
      }

      // 3. 全局桶校准
      const buckets = await this.getCalibrationBuckets(userId);
      const bucket = this.findBucket(buckets, rawConfidence);

      if (bucket && bucket.totalPredictions >= CALIBRATION_CONFIG.MIN_SAMPLES_FOR_CALIBRATION) {
        // 只有当桶校准与其他校准差异较大时才使用
        const bucketCalibrated = bucket.calibratedConfidence;
        const currentCalibrated = calibratedConfidence;

        if (Math.abs(bucketCalibrated - currentCalibrated) > 0.15) {
          // 混合使用：70% 当前校准 + 30% 桶校准
          calibratedConfidence = currentCalibrated * 0.7 + bucketCalibrated * 0.3;
          if (source === "none") {
            source = "bucket";
            reason = `Bucket calibration (${bucket.bucketId * 10}-${(bucket.bucketId + 1) * 10}%)`;
          }
        }
      }

      // 4. 边界处理
      calibratedConfidence = this.clampConfidence(calibratedConfidence);
      calibrationFactor = calibratedConfidence / rawConfidence;
    } catch (error) {
      logger.error({ error, userId }, "Failed to calibrate confidence");
      // 失败时返回原始置信度
      calibratedConfidence = rawConfidence;
    }

    return {
      originalConfidence: rawConfidence,
      calibratedConfidence,
      calibrationFactor,
      source,
      reason,
      matcherAgreement,
    };
  }

  /**
   * 获取一致性级别
   */
  private getAgreementLevel(score: number): "high" | "medium" | "low" | "conflict" {
    if (score >= CALIBRATION_CONFIG.HIGH_AGREEMENT_THRESHOLD) return "high";
    if (score >= CALIBRATION_CONFIG.CONSENSUS_THRESHOLD) return "medium";
    if (score >= 0.3) return "low";
    return "conflict";
  }

  /**
   * 评估多匹配器一致性
   */
  assessMatcherAgreement(results: MatcherResult[]): AgreementAssessment {
    if (results.length === 0) {
      return {
        matcherCount: 0,
        agreeingMatchers: 0,
        agreementScore: 0,
        hasConsensus: false,
        consensusFolderId: null,
        weightedConfidence: 0,
      };
    }

    // 按文件夹 ID 分组，统计加权投票
    const folderVotes = new Map<number | null, {
      weight: number;
      confidence: number;
      count: number;
    }>();

    let totalWeight = 0;

    for (const result of results) {
      const weight = result.weight ?? 1.0;
      totalWeight += weight;
      const existing = folderVotes.get(result.folderId);

      if (existing) {
        existing.weight += weight;
        existing.confidence += result.confidence * weight;
        existing.count += 1;
      } else {
        folderVotes.set(result.folderId, {
          weight: weight,
          confidence: result.confidence * weight,
          count: 1,
        });
      }
    }

    // 找到获得最多票数的文件夹
    let maxWeight = 0;
    let consensusFolderId: number | null = null;
    let agreeingCount = 0;

    for (const [folderId, data] of folderVotes.entries()) {
      if (data.weight > maxWeight) {
        maxWeight = data.weight;
        consensusFolderId = folderId;
        agreeingCount = data.count;
      }
    }

    // 计算一致性分数和加权置信度
    const agreementScore = totalWeight > 0 ? maxWeight / totalWeight : 0;
    const consensusData = folderVotes.get(consensusFolderId);
    const weightedConfidence = consensusData
      ? consensusData.confidence / consensusData.weight
      : 0;

    return {
      matcherCount: results.length,
      agreeingMatchers: agreeingCount,
      agreementScore,
      hasConsensus: agreementScore >= CALIBRATION_CONFIG.CONSENSUS_THRESHOLD,
      consensusFolderId,
      weightedConfidence,
    };
  }

  /**
   * 获取校准桶数据
   */
  async getCalibrationBuckets(userId: string): Promise<CalibrationBucket[]> {
    const cacheKey = `buckets:${userId}`;
    const now = Date.now();

    // 检查缓存
    if (
      this.bucketCache.has(cacheKey) &&
      (this.cacheExpiry.get(cacheKey) || 0) > now
    ) {
      return this.bucketCache.get(cacheKey)!;
    }

    try {
      const supabase = await createClient();

      // 从 classification_metrics 表获取历史数据
      const { data: metrics, error } = await supabase
        .from("classification_metrics")
        .select("confidence, user_feedback, folder_id")
        .eq("user_id", userId)
        .not("user_feedback", "is", null)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        logger.error({ error, userId }, "Failed to fetch calibration data");
        return this.getDefaultBuckets();
      }

      // 构建校准桶 - 转换 user_feedback 为 boolean
      const convertedMetrics = (metrics || []).map(m => ({
        confidence: m.confidence,
        user_accepted: m.user_feedback === "accept",
        folder_id: m.folder_id,
      }));
      const buckets = this.buildCalibrationBuckets(convertedMetrics);

      // 更新缓存
      this.bucketCache.set(cacheKey, buckets);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

      return buckets;
    } catch (error) {
      logger.error({ error, userId }, "Failed to get calibration buckets");
      return this.getDefaultBuckets();
    }
  }

  /**
   * 获取文件夹校准数据
   */
  async getFolderCalibrationData(
    userId: string,
    folderId: number
  ): Promise<FolderCalibrationData | null> {
    const cacheKey = `folders:${userId}`;
    const now = Date.now();

    // 检查缓存
    if (
      this.folderCache.has(cacheKey) &&
      (this.cacheExpiry.get(cacheKey) || 0) > now
    ) {
      const cache = this.folderCache.get(cacheKey)!;
      return cache.get(folderId) || null;
    }

    try {
      const supabase = await createClient();

      // 获取所有文件夹的校准数据
      const { data: metrics, error } = await supabase
        .from("classification_metrics")
        .select("folder_id, confidence, user_feedback, created_at")
        .eq("user_id", userId)
        .not("folder_id", "is", null)
        .not("user_feedback", "is", null)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) {
        logger.error({ error, userId }, "Failed to fetch folder calibration data");
        return null;
      }

      // 按文件夹分组计算
      const folderMap = new Map<number, FolderCalibrationData>();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const metric of metrics || []) {
        if (!metric.folder_id) continue;

        const existing = folderMap.get(metric.folder_id);
        const isRecent = new Date(metric.created_at) > thirtyDaysAgo;
        const isCorrect = metric.user_feedback === "accept";

        if (existing) {
          existing.totalPredictions++;
          if (isCorrect) existing.correctPredictions++;
        } else {
          folderMap.set(metric.folder_id, {
            folderId: metric.folder_id,
            folderName: "",
            totalPredictions: 1,
            correctPredictions: isCorrect ? 1 : 0,
            accuracy: 0,
            recentAccuracy: null,
            confidenceBias: 0,
          });
        }
      }

      // 计算准确率和偏差
      for (const [id, data] of folderMap.entries()) {
        data.accuracy = this.calculateBayesianAccuracy(
          data.correctPredictions,
          data.totalPredictions
        );
        // 简化：假设平均预测置信度为 0.7
        data.confidenceBias = 0.7 - data.accuracy;
      }

      // 更新缓存
      this.folderCache.set(cacheKey, folderMap);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

      return folderMap.get(folderId) || null;
    } catch (error) {
      logger.error({ error, userId, folderId }, "Failed to get folder calibration data");
      return null;
    }
  }

  /**
   * 记录分类反馈用于校准
   * 当用户确认或拒绝分类时调用
   */
  async recordClassificationFeedback(
    userId: string,
    bookmarkId: number,
    feedback: "accept" | "reject" | "modify",
    feedbackFolderId?: number | null
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // 更新最近一条该书签的分类指标记录
      await supabase
        .from("classification_metrics")
        .update({
          user_feedback: feedback,
          feedback_folder_id: feedbackFolderId ?? null,
          feedback_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("bookmark_id", bookmarkId)
        .is("user_feedback", null)
        .order("created_at", { ascending: false })
        .limit(1);

      // 清除缓存以便下次获取最新数据
      this.clearUserCache(userId);
    } catch (error) {
      logger.error(
        { error, userId, bookmarkId },
        "Failed to record classification feedback"
      );
    }
  }

  /**
   * 清除用户缓存
   */
  clearUserCache(userId: string): void {
    this.bucketCache.delete(`buckets:${userId}`);
    this.folderCache.delete(`folders:${userId}`);
    this.cacheExpiry.delete(`buckets:${userId}`);
    this.cacheExpiry.delete(`folders:${userId}`);
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  /**
   * 构建校准桶
   */
  private buildCalibrationBuckets(
    metrics: Array<{
      confidence: number;
      user_accepted: boolean | null;
      folder_id: number | null;
    }>
  ): CalibrationBucket[] {
    // 初始化 10 个桶
    const buckets: CalibrationBucket[] = [];
    for (let i = 0; i < 10; i++) {
      buckets.push({
        bucketId: i,
        minConfidence: i / 10,
        maxConfidence: (i + 1) / 10,
        totalPredictions: 0,
        correctPredictions: 0,
        actualAccuracy: 0,
        calibratedConfidence: (i + 0.5) / 10, // 默认为桶中心
      });
    }

    // 统计每个桶的数据
    for (const metric of metrics) {
      if (metric.user_accepted === null) continue;

      const bucketId = Math.min(Math.floor(metric.confidence * 10), 9);
      buckets[bucketId].totalPredictions++;
      if (metric.user_accepted) {
        buckets[bucketId].correctPredictions++;
      }
    }

    // 计算校准置信度
    for (const bucket of buckets) {
      bucket.actualAccuracy = this.calculateBayesianAccuracy(
        bucket.correctPredictions,
        bucket.totalPredictions
      );
      bucket.calibratedConfidence = bucket.actualAccuracy;
    }

    return buckets;
  }

  /**
   * 获取默认校准桶（无历史数据时）
   */
  private getDefaultBuckets(): CalibrationBucket[] {
    const buckets: CalibrationBucket[] = [];
    for (let i = 0; i < 10; i++) {
      buckets.push({
        bucketId: i,
        minConfidence: i / 10,
        maxConfidence: (i + 1) / 10,
        totalPredictions: 0,
        correctPredictions: 0,
        actualAccuracy: (i + 0.5) / 10,
        calibratedConfidence: (i + 0.5) / 10,
      });
    }
    return buckets;
  }

  /**
   * 查找置信度对应的桶
   */
  private findBucket(
    buckets: CalibrationBucket[],
    confidence: number
  ): CalibrationBucket | null {
    const bucketId = Math.min(Math.floor(confidence * 10), 9);
    return buckets[bucketId] || null;
  }

  /**
   * 贝叶斯平滑计算准确率
   * 处理小样本问题
   */
  private calculateBayesianAccuracy(correct: number, total: number): number {
    const priorStrength = CALIBRATION_CONFIG.BAYESIAN_PRIOR_STRENGTH;
    const priorAccuracy = CALIBRATION_CONFIG.BAYESIAN_PRIOR_ACCURACY;

    // 贝叶斯平滑：(实际正确 + 先验正确) / (实际总数 + 先验总数)
    return (
      (correct + priorStrength * priorAccuracy) / (total + priorStrength)
    );
  }

  /**
   * 限制置信度调整幅度
   */
  private clampAdjustment(adjustment: number): number {
    const max = CALIBRATION_CONFIG.MAX_CALIBRATION_ADJUSTMENT;
    return Math.max(-max, Math.min(max, adjustment));
  }

  /**
   * 限制置信度范围
   */
  private clampConfidence(confidence: number): number {
    return Math.max(
      CALIBRATION_CONFIG.MIN_CONFIDENCE,
      Math.min(CALIBRATION_CONFIG.MAX_CONFIDENCE, confidence)
    );
  }
}

// ============================================================================
// 导出
// ============================================================================

/** 导出配置类型 */
export type CalibrationConfig = typeof CALIBRATION_CONFIG;

/** 全局实例 */
export const confidenceCalibrationService =
  ConfidenceCalibrationService.getInstance();

/**
 * 获取置信度校准服务实例
 */
export function getConfidenceCalibrationService(): ConfidenceCalibrationService {
  return ConfidenceCalibrationService.getInstance();
}

/**
 * 创建新的置信度校准服务实例
 */
export function createConfidenceCalibrationService(): ConfidenceCalibrationService {
  return new (ConfidenceCalibrationService as any)();
}

export default ConfidenceCalibrationService;
