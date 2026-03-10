/**
 * Matcher Agreement Module
 * V4.2 多匹配器一致性评估模块
 *
 * @description 评估多个匹配器结果的一致性，用于置信度校准
 * - 计算匹配器之间的一致性分数
 * - 识别高一致性和低一致性场景
 * - 基于一致性调整置信度
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 单个匹配器结果 */
export interface MatcherResult {
  /** 匹配器名称 */
  matcherName: string;
  /** 推荐的文件夹ID（null表示推荐放入收件箱） */
  folderId: number | null;
  /** 匹配器置信度 (0-1) */
  confidence: number;
  /** 匹配器权重（可选，用于加权计算） */
  weight?: number;
  /** 匹配特征（可选，用于深度分析） */
  features?: {
    matchType: "embedding" | "keyword" | "rule" | "hybrid";
    matchStrength: number;
    featureCount?: number;
  };
}

/** 一致性评估结果 */
export interface AgreementAssessment {
  /** 一致性分数 (0-1) */
  agreementScore: number;
  /** 一致性级别 */
  agreementLevel: "high" | "medium" | "low" | "conflict";
  /** 是否达成共识 */
  hasConsensus: boolean;
  /** 共识文件夹ID（如果有） */
  consensusFolderId: number | null;
  /** 参与评估的匹配器数量 */
  participatingMatchers: number;
  /** 同意共识的匹配器数量 */
  agreeingMatchers: number;
  /** 详细的匹配器分析 */
  matcherAnalysis: MatcherAnalysis[];
  /** 置信度调整因子 */
  confidenceAdjustment: number;
  /** 建议的最终置信度 */
  suggestedConfidence: number;
}

/** 单个匹配器分析 */
export interface MatcherAnalysis {
  matcherName: string;
  folderId: number | null;
  confidence: number;
  agreesWithConsensus: boolean;
  deviationFromConsensus: number;
  contribution: number;
}

/** 一致性配置 */
export interface AgreementConfig {
  /** 高一致性阈值 (默认 0.8) */
  highAgreementThreshold: number;
  /** 中等一致性阈值 (默认 0.6) */
  mediumAgreementThreshold: number;
  /** 共识所需最小匹配器数量 (默认 2) */
  minMatchersForConsensus: number;
  /** 共识所需同意比例 (默认 0.5) */
  consensusRatio: number;
  /** 是否使用加权计算 */
  useWeights: boolean;
  /** 默认匹配器权重 */
  defaultWeight: number;
  /** 高一致性置信度提升 */
  highAgreementBoost: number;
  /** 低一致性置信度惩罚 */
  lowAgreementPenalty: number;
  /** 冲突情况置信度惩罚 */
  conflictPenalty: number;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: AgreementConfig = {
  highAgreementThreshold: 0.8,
  mediumAgreementThreshold: 0.6,
  minMatchersForConsensus: 2,
  consensusRatio: 0.5,
  useWeights: true,
  defaultWeight: 1.0,
  highAgreementBoost: 0.1,
  lowAgreementPenalty: -0.15,
  conflictPenalty: -0.25,
};

// ============================================================================
// 主类实现
// ============================================================================

/**
 * 匹配器一致性评估器
 */
export class MatcherAgreementEvaluator {
  private config: AgreementConfig;

  constructor(config: Partial<AgreementConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // 核心评估方法
  // --------------------------------------------------------------------------

  /**
   * 评估多个匹配器结果的一致性
   */
  assessAgreement(results: MatcherResult[]): AgreementAssessment {
    // 过滤有效结果
    const validResults = results.filter(
      (r) => r.confidence > 0 || r.folderId !== null,
    );

    if (validResults.length === 0) {
      return this.createEmptyAssessment();
    }

    if (validResults.length === 1) {
      return this.createSingleMatcherAssessment(validResults[0]);
    }

    // 计算共识文件夹
    const consensus = this.calculateConsensus(validResults);

    // 计算一致性分数
    const agreementScore = this.calculateAgreementScore(
      validResults,
      consensus.folderId,
    );

    // 确定一致性级别
    const agreementLevel = this.determineAgreementLevel(agreementScore);

    // 计算置信度调整
    const confidenceAdjustment = this.calculateConfidenceAdjustment(
      agreementLevel,
      agreementScore,
    );

    // 计算建议置信度
    const avgConfidence = this.calculateWeightedAverageConfidence(validResults);
    const suggestedConfidence = Math.max(
      0,
      Math.min(1, avgConfidence + confidenceAdjustment),
    );

    // 生成匹配器分析
    const matcherAnalysis = this.analyzeMatchers(
      validResults,
      consensus.folderId,
      avgConfidence,
    );

    return {
      agreementScore,
      agreementLevel,
      hasConsensus: consensus.hasConsensus,
      consensusFolderId: consensus.folderId,
      participatingMatchers: validResults.length,
      agreeingMatchers: consensus.agreeingCount,
      matcherAnalysis,
      confidenceAdjustment,
      suggestedConfidence,
    };
  }

  /**
   * 快速检查是否存在冲突
   */
  hasConflict(results: MatcherResult[]): boolean {
    const validResults = results.filter(
      (r) => r.confidence > 0.3 && r.folderId !== null,
    );
    if (validResults.length < 2) return false;

    const uniqueFolders = new Set(validResults.map((r) => r.folderId));
    return uniqueFolders.size > 1;
  }

  /**
   * 获取最高置信度的结果
   */
  getTopResult(results: MatcherResult[]): MatcherResult | null {
    if (results.length === 0) return null;
    return results.reduce((best, current) =>
      current.confidence > best.confidence ? current : best,
    );
  }

  /**
   * 获取加权共识结果
   */
  getWeightedConsensus(
    results: MatcherResult[],
  ): { folderId: number | null; confidence: number } | null {
    const validResults = results.filter(
      (r) => r.confidence > 0 || r.folderId !== null,
    );
    if (validResults.length === 0) return null;

    const consensus = this.calculateConsensus(validResults);
    const agreeingResults = validResults.filter(
      (r) => r.folderId === consensus.folderId,
    );

    if (agreeingResults.length === 0) {
      return { folderId: null, confidence: 0 };
    }

    const avgConfidence =
      this.calculateWeightedAverageConfidence(agreeingResults);

    return {
      folderId: consensus.folderId,
      confidence: avgConfidence,
    };
  }

  // --------------------------------------------------------------------------
  // 私有方法
  // --------------------------------------------------------------------------

  /**
   * 计算共识
   */
  private calculateConsensus(results: MatcherResult[]): {
    folderId: number | null;
    hasConsensus: boolean;
    agreeingCount: number;
  } {
    // 按文件夹ID分组并计算加权分数
    const folderScores = new Map<
      number | null,
      { count: number; totalWeight: number; totalConfidence: number }
    >();

    for (const result of results) {
      const weight = this.config.useWeights
        ? (result.weight ?? this.config.defaultWeight)
        : 1;

      const existing = folderScores.get(result.folderId) || {
        count: 0,
        totalWeight: 0,
        totalConfidence: 0,
      };

      folderScores.set(result.folderId, {
        count: existing.count + 1,
        totalWeight: existing.totalWeight + weight,
        totalConfidence: existing.totalConfidence + result.confidence * weight,
      });
    }

    // 找出最高分的文件夹
    let bestFolder: number | null = null;
    let bestScore = -1;
    let bestCount = 0;

    for (const [folderId, scores] of folderScores) {
      const score = scores.totalConfidence;
      if (score > bestScore) {
        bestScore = score;
        bestFolder = folderId;
        bestCount = scores.count;
      }
    }

    // 判断是否达成共识
    const hasConsensus =
      results.length >= this.config.minMatchersForConsensus &&
      bestCount / results.length >= this.config.consensusRatio;

    return {
      folderId: bestFolder,
      hasConsensus,
      agreeingCount: bestCount,
    };
  }

  /**
   * 计算一致性分数
   */
  private calculateAgreementScore(
    results: MatcherResult[],
    consensusFolderId: number | null,
  ): number {
    if (results.length <= 1) return 1;

    let agreeingWeight = 0;
    let totalWeight = 0;

    for (const result of results) {
      const weight = this.config.useWeights
        ? (result.weight ?? this.config.defaultWeight)
        : 1;

      totalWeight += weight;

      if (result.folderId === consensusFolderId) {
        // 同意共识，加权置信度
        agreeingWeight += weight * result.confidence;
      } else {
        // 不同意，但如果置信度很低也算部分同意
        agreeingWeight += weight * (1 - result.confidence) * 0.5;
      }
    }

    return totalWeight > 0 ? agreeingWeight / totalWeight : 0;
  }

  /**
   * 确定一致性级别
   */
  private determineAgreementLevel(
    score: number,
  ): "high" | "medium" | "low" | "conflict" {
    if (score >= this.config.highAgreementThreshold) return "high";
    if (score >= this.config.mediumAgreementThreshold) return "medium";
    if (score >= 0.3) return "low";
    return "conflict";
  }

  /**
   * 计算置信度调整因子
   */
  private calculateConfidenceAdjustment(
    level: "high" | "medium" | "low" | "conflict",
    score: number,
  ): number {
    switch (level) {
      case "high":
        // 高一致性，提升置信度
        return (
          this.config.highAgreementBoost *
          (score - this.config.highAgreementThreshold) *
          5
        );
      case "medium":
        // 中等一致性，小幅调整
        return 0;
      case "low":
        // 低一致性，降低置信度
        return this.config.lowAgreementPenalty * (1 - score);
      case "conflict":
        // 冲突，大幅降低置信度
        return this.config.conflictPenalty;
    }
  }

  /**
   * 计算加权平均置信度
   */
  private calculateWeightedAverageConfidence(results: MatcherResult[]): number {
    if (results.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const result of results) {
      const weight = this.config.useWeights
        ? (result.weight ?? this.config.defaultWeight)
        : 1;

      totalWeight += weight;
      weightedSum += result.confidence * weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * 分析各匹配器
   */
  private analyzeMatchers(
    results: MatcherResult[],
    consensusFolderId: number | null,
    avgConfidence: number,
  ): MatcherAnalysis[] {
    const totalWeight = results.reduce(
      (sum, r) =>
        sum +
        (this.config.useWeights ? (r.weight ?? this.config.defaultWeight) : 1),
      0,
    );

    return results.map((result) => {
      const weight = this.config.useWeights
        ? (result.weight ?? this.config.defaultWeight)
        : 1;

      return {
        matcherName: result.matcherName,
        folderId: result.folderId,
        confidence: result.confidence,
        agreesWithConsensus: result.folderId === consensusFolderId,
        deviationFromConsensus: Math.abs(result.confidence - avgConfidence),
        contribution: totalWeight > 0 ? weight / totalWeight : 0,
      };
    });
  }

  /**
   * 创建空评估结果
   */
  private createEmptyAssessment(): AgreementAssessment {
    return {
      agreementScore: 0,
      agreementLevel: "conflict",
      hasConsensus: false,
      consensusFolderId: null,
      participatingMatchers: 0,
      agreeingMatchers: 0,
      matcherAnalysis: [],
      confidenceAdjustment: 0,
      suggestedConfidence: 0,
    };
  }

  /**
   * 创建单匹配器评估结果
   */
  private createSingleMatcherAssessment(
    result: MatcherResult,
  ): AgreementAssessment {
    return {
      agreementScore: 1,
      agreementLevel: "high",
      hasConsensus: true,
      consensusFolderId: result.folderId,
      participatingMatchers: 1,
      agreeingMatchers: 1,
      matcherAnalysis: [
        {
          matcherName: result.matcherName,
          folderId: result.folderId,
          confidence: result.confidence,
          agreesWithConsensus: true,
          deviationFromConsensus: 0,
          contribution: 1,
        },
      ],
      confidenceAdjustment: 0,
      suggestedConfidence: result.confidence,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建匹配器一致性评估器实例
 */
export function createMatcherAgreementEvaluator(
  config?: Partial<AgreementConfig>,
): MatcherAgreementEvaluator {
  return new MatcherAgreementEvaluator(config);
}

// ============================================================================
// 便捷函数
// ============================================================================

/** 默认评估器实例 */
let defaultEvaluator: MatcherAgreementEvaluator | null = null;

/**
 * 获取默认评估器
 */
function getDefaultEvaluator(): MatcherAgreementEvaluator {
  if (!defaultEvaluator) {
    defaultEvaluator = new MatcherAgreementEvaluator();
  }
  return defaultEvaluator;
}

/**
 * 评估匹配器一致性（使用默认配置）
 */
export function assessMatcherAgreement(
  results: MatcherResult[],
): AgreementAssessment {
  return getDefaultEvaluator().assessAgreement(results);
}

/**
 * 检查是否存在冲突（使用默认配置）
 */
export function checkMatcherConflict(results: MatcherResult[]): boolean {
  return getDefaultEvaluator().hasConflict(results);
}

/**
 * 获取共识结果（使用默认配置）
 */
export function getConsensusResult(
  results: MatcherResult[],
): { folderId: number | null; confidence: number } | null {
  return getDefaultEvaluator().getWeightedConsensus(results);
}

// ============================================================================
// 导出
// ============================================================================

export default MatcherAgreementEvaluator;
