/**
 * Negative Sample Matcher
 * V4.2 负样本匹配器
 *
 * @description 基于负样本（排除规则）对分类结果进行惩罚
 * - 检查标签排除规则
 * - 检查来源排除规则
 * - 应用惩罚分数
 * - 与其他匹配器协同工作
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { IMatcher, MatcherOptions } from "./interfaces";
import type { MatchResult, MatcherContext } from "@/lib/classification/types";
import {
  negativeSampleService,
  type NegativeSampleMatch,
} from "@/lib/classification-learning/negative-sample.service";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 负样本匹配器配置
 */
export interface NegativeSampleMatcherConfig {
  /** 标签排除惩罚系数 (0-1) */
  tagPenaltyFactor: number;
  /** 来源排除惩罚系数 (0-1) */
  sourcePenaltyFactor: number;
  /** 最大惩罚上限 (0-1) */
  maxPenalty: number;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 负样本匹配器上下文扩展
 */
export interface NegativeSampleMatcherContext extends MatcherContext {
  /** 内容来源 ID */
  sourceId?: string;
  /** 托管模式 */
  trustMode?: "full_auto" | "semi_auto" | "manual";
  /** 候选结果（来自其他匹配器） */
  candidates?: MatchResult[];
}

/**
 * 惩罚详情
 */
interface PenaltyDetail {
  folderId: number;
  totalPenalty: number;
  matches: NegativeSampleMatch[];
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: NegativeSampleMatcherConfig = {
  tagPenaltyFactor: 0.3, // 标签排除降低 30%
  sourcePenaltyFactor: 0.4, // 来源排除降低 40%
  maxPenalty: 0.6, // 最大惩罚 60%
  enabled: true,
};

// ============================================================================
// 匹配器实现
// ============================================================================

/**
 * 负样本匹配器
 *
 * @description 与其他匹配器不同，负样本匹配器不产生正向匹配分数，
 * 而是对已有的候选结果进行负向调整（惩罚）。
 *
 * 工作流程：
 * 1. 接收其他匹配器产生的候选结果
 * 2. 检查每个候选文件夹是否有对应的排除规则
 * 3. 根据排除规则的权重计算惩罚分数
 * 4. 返回调整后的结果（分数降低）
 */
export class NegativeSampleMatcher implements IMatcher {
  readonly name = "negative_sample";
  readonly weight = 0; // 不参与正向分数聚合
  private config: NegativeSampleMatcherConfig;

  constructor(options?: MatcherOptions & Partial<NegativeSampleMatcherConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...options,
    };
  }

  /**
   * 检查是否可用
   */
  async isAvailable(context: MatcherContext): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // 手动模式下不启用
    const extContext = context as NegativeSampleMatcherContext;
    if (extContext.trustMode === "manual") {
      return false;
    }

    return true;
  }

  /**
   * 执行匹配
   *
   * @description 负样本匹配器的特殊行为：
   * - 返回的 MatchResult 代表需要惩罚的文件夹
   * - score 字段表示惩罚值（负数或 0-1 之间的惩罚系数）
   * - 由 ScoreAggregator 在聚合时应用惩罚
   */
  async match(context: MatcherContext): Promise<MatchResult[]> {
    const extContext = context as NegativeSampleMatcherContext;
    const penalties: MatchResult[] = [];

    try {
      // 1. 收集所有负样本匹配
      const penaltyDetails = await this.collectPenalties(extContext);

      // 2. 转换为 MatchResult 格式
      for (const detail of penaltyDetails) {
        if (detail.totalPenalty > 0) {
          penalties.push({
            folderId: detail.folderId,
            folderName: "", // 由调用方填充
            score: -detail.totalPenalty * 100, // 负分表示惩罚
            confidence: Math.min(
              detail.totalPenalty / this.config.maxPenalty,
              1,
            ),
            reason: this.formatPenaltyReason(detail.matches),
            metadata: {
              matches: detail.matches,
              penaltyFactor: detail.totalPenalty,
            },
          });
        }
      }

      logger.debug(
        {
          userId: context.userId,
          penaltyCount: penalties.length,
        },
        "Negative sample matching completed",
      );

      return penalties;
    } catch (error) {
      logger.error(
        { error, userId: context.userId },
        "Negative sample matching failed",
      );
      return [];
    }
  }

  /**
   * 应用惩罚到候选结果
   *
   * @description 这是一个便捷方法，可以直接调用来调整候选结果
   * 而不需要通过 ScoreAggregator
   */
  async applyPenalties(
    context: NegativeSampleMatcherContext,
    candidates: MatchResult[],
  ): Promise<MatchResult[]> {
    if (!(await this.isAvailable(context))) {
      return candidates;
    }

    const penalties = await this.match(context);
    const penaltyMap = new Map<number, number>();

    // 构建惩罚映射
    for (const penalty of penalties) {
      penaltyMap.set(penalty.folderId, Math.abs(penalty.score) / 100);
    }

    // 应用惩罚到候选结果
    return candidates.map((candidate) => {
      const penalty = penaltyMap.get(candidate.folderId) || 0;
      if (penalty === 0) {
        return candidate;
      }

      const adjustedScore = candidate.score * (1 - penalty);
      return {
        ...candidate,
        score: adjustedScore,
        confidence: candidate.confidence * (1 - penalty * 0.5), // 置信度也降低
        reason: `${candidate.reason} (负样本惩罚: -${Math.round(penalty * 100)}%)`,
        metadata: {
          ...candidate.metadata,
          negativeSamplePenalty: penalty,
        },
      };
    });
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 收集所有惩罚
   */
  private async collectPenalties(
    context: NegativeSampleMatcherContext,
  ): Promise<PenaltyDetail[]> {
    const penaltyMap = new Map<number, PenaltyDetail>();

    // 1. 检查标签排除
    if (context.tags && context.tags.length > 0) {
      const tagExclusions = await negativeSampleService.getTagExclusions(
        context.userId,
        context.tags,
      );

      for (const [folderId, matches] of tagExclusions) {
        const existing = penaltyMap.get(folderId) || {
          folderId,
          totalPenalty: 0,
          matches: [],
        };

        for (const match of matches) {
          existing.totalPenalty += match.weight * this.config.tagPenaltyFactor;
          existing.matches.push(match);
        }

        penaltyMap.set(folderId, existing);
      }
    }

    // 2. 检查来源排除
    if (context.sourceId) {
      const sourceExclusions = await negativeSampleService.getSourceExclusions(
        context.userId,
        context.sourceId,
      );

      for (const [folderId, matches] of sourceExclusions) {
        const existing = penaltyMap.get(folderId) || {
          folderId,
          totalPenalty: 0,
          matches: [],
        };

        for (const match of matches) {
          existing.totalPenalty +=
            match.weight * this.config.sourcePenaltyFactor;
          existing.matches.push(match);
        }

        penaltyMap.set(folderId, existing);
      }
    }

    // 3. 应用最大惩罚上限
    for (const detail of penaltyMap.values()) {
      detail.totalPenalty = Math.min(
        detail.totalPenalty,
        this.config.maxPenalty,
      );
    }

    return Array.from(penaltyMap.values());
  }

  /**
   * 格式化惩罚原因
   */
  private formatPenaltyReason(matches: NegativeSampleMatch[]): string {
    const reasons: string[] = [];

    const tagMatches = matches.filter((m) => m.matchType === "tag");
    const sourceMatches = matches.filter((m) => m.matchType === "source");

    if (tagMatches.length > 0) {
      const tags = tagMatches.map((m) => m.matchedValue).join(", ");
      reasons.push(`标签排除: ${tags}`);
    }

    if (sourceMatches.length > 0) {
      reasons.push(`来源排除`);
    }

    return reasons.join("; ");
  }

  // ============================================================================
  // 配置管理
  // ============================================================================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NegativeSampleMatcherConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): NegativeSampleMatcherConfig {
    return { ...this.config };
  }

  /**
   * 启用/禁用
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const negativeSampleMatcher = new NegativeSampleMatcher();
