/**
 * Score Aggregator
 * Aggregates results from multiple matchers into a final classification decision
 *
 * V3.0 更新：支持 5 层匹配策略的聚合
 */

import type { IScoreAggregator, IMatcher } from "./interfaces";
import type { MatchResult, ClassificationResult } from "../types";
import { CLASSIFICATION_THRESHOLDS } from "../constants";
import { V3_CONFIG } from "../v3/config";
import { logger } from "@/lib/logger";

/**
 * 文件夹聚合分数
 */
interface FolderAggregateScore {
  folderName: string;
  /** 各匹配器分数 */
  matcherScores: Map<string, number>;
  /** 推荐原因 */
  reasons: string[];
  /** 是否跳过 AI */
  skipAI: boolean;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Weighted score aggregator
 * Combines scores from multiple matchers using their configured weights
 *
 * V3.0: 支持任意数量的匹配器
 */
export class WeightedScoreAggregator implements IScoreAggregator {
  private lowConfidenceThreshold: number;

  constructor(options?: { lowConfidenceThreshold?: number }) {
    this.lowConfidenceThreshold =
      options?.lowConfidenceThreshold ??
      CLASSIFICATION_THRESHOLDS.LOW_CONFIDENCE;
  }

  /**
   * Aggregate results from all matchers
   * V3.0: 动态处理所有匹配器结果
   */
  aggregate(
    results: Map<string, MatchResult[]>,
    matchers: IMatcher[],
  ): ClassificationResult {
    // Build weight map
    const weights = new Map<string, number>();
    for (const matcher of matchers) {
      weights.set(matcher.name, matcher.weight);
    }

    // ═══════════════════════════════════════════════════════════════
    // 第 1 步：检查 k-NN 直接锁定
    // ═══════════════════════════════════════════════════════════════
    const knnDirectResults = results.get("knn-direct") || [];
    // 从配置读取阈值（V3_CONFIG 存储的是 0.85，转换为 85 分）
    const knnDirectLockThreshold = V3_CONFIG.knnDirectThreshold * 100;
    const knnDirectMatch = knnDirectResults.find(
      (r) =>
        r.metadata?.skipAI === true &&
        r.score >= knnDirectLockThreshold &&
        !this.isSystemFolder(r), // 防御性检查：排除系统文件夹
    );

    if (knnDirectMatch) {
      logger.info(
        {
          folderId: knnDirectMatch.folderId,
          folderName: knnDirectMatch.folderName,
          score: knnDirectMatch.score,
          action: "knn_direct_lock",
        },
        "Score Aggregator: k-NN direct lock activated",
      );

      return {
        folderId: knnDirectMatch.folderId,
        folderName: knnDirectMatch.folderName,
        confidence: knnDirectMatch.score,
        reason: knnDirectMatch.reason,
        action: "classify",
        scores: {
          vectorScore: knnDirectMatch.score,
          historyScore: 0,
          aiScore: 0,
        },
        matchDetails: [
          {
            folderId: knnDirectMatch.folderId,
            folderName: knnDirectMatch.folderName,
            score: knnDirectMatch.score,
            confidence: knnDirectMatch.score,
            reason: knnDirectMatch.reason,
          },
        ],
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // 第 2 步：收集所有文件夹的匹配分数
    // ═══════════════════════════════════════════════════════════════
    const folderScores = new Map<number, FolderAggregateScore>();

    // 遍历所有匹配器结果
    for (const [matcherName, matchResults] of results) {
      for (const result of matchResults) {
        // 跳过特殊文件夹 ID（如建议创建新文件夹）
        if (result.folderId < 0) continue;

        if (!folderScores.has(result.folderId)) {
          folderScores.set(result.folderId, {
            folderName: result.folderName,
            matcherScores: new Map(),
            reasons: [],
            skipAI: false,
          });
        }

        const entry = folderScores.get(result.folderId)!;
        entry.matcherScores.set(matcherName, result.score);

        // 生成可读的原因
        const matcherLabel = this.getMatcherLabel(matcherName);
        entry.reasons.push(`${matcherLabel}: ${result.score}%`);

        // 检查是否有跳过 AI 的标记
        if (result.metadata?.skipAI) {
          entry.skipAI = true;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 第 3 步：计算加权分数
    // ═══════════════════════════════════════════════════════════════
    const scoredFolders = Array.from(folderScores.entries()).map(
      ([folderId, data]) => {
        let totalWeight = 0;
        let weightedSum = 0;

        // 核心匹配器分数（用于兼容性）
        const vectorScore = data.matcherScores.get("vector") || 0;
        const historyScore = data.matcherScores.get("history") || 0;
        const aiScore = data.matcherScores.get("ai") || 0;

        // 计算所有匹配器的加权分数
        for (const [matcherName, score] of data.matcherScores) {
          const weight = weights.get(matcherName) || 0;
          weightedSum += score * weight;
          totalWeight += weight;
        }

        const weightedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

        // V4.2.5: 钳位置信度到 [0, 100] 范围，防止边界异常
        const clampedScore = Math.max(
          0,
          Math.min(100, Math.round(weightedScore)),
        );

        return {
          folderId,
          folderName: data.folderName,
          score: clampedScore,
          vectorScore,
          historyScore,
          aiScore,
          reasons: data.reasons,
          skipAI: data.skipAI,
        };
      },
    );

    // Sort by weighted score
    scoredFolders.sort((a, b) => b.score - a.score);

    // Get best match
    const bestMatch = scoredFolders[0];

    // Log aggregation result
    logger.debug(
      {
        matchersUsed: Array.from(results.keys()),
        candidateFolders: scoredFolders.length,
        bestMatch: bestMatch
          ? {
              folderId: bestMatch.folderId,
              folderName: bestMatch.folderName,
              score: bestMatch.score,
            }
          : null,
      },
      "Score Aggregator: Aggregation complete",
    );

    // ═══════════════════════════════════════════════════════════════
    // 第 4 步：决定最终动作
    // ═══════════════════════════════════════════════════════════════
    if (!bestMatch || bestMatch.score < this.lowConfidenceThreshold) {
      // Low confidence - go to inbox
      return {
        folderId: null,
        folderName: "待整理",
        confidence: bestMatch?.score ?? 0,
        reason: bestMatch
          ? `置信度 ${bestMatch.score}% 低于阈值 ${this.lowConfidenceThreshold}%`
          : "未找到匹配的文件夹",
        action: "inbox",
        scores: {
          vectorScore: bestMatch?.vectorScore ?? 0,
          historyScore: bestMatch?.historyScore ?? 0,
          aiScore: bestMatch?.aiScore ?? 0,
        },
        matchDetails: scoredFolders.slice(0, 5).map((f) => ({
          folderId: f.folderId,
          folderName: f.folderName,
          score: f.score,
          confidence: f.score,
          reason: f.reasons.join(", "),
        })),
      };
    }

    // High enough confidence - classify
    return {
      folderId: bestMatch.folderId,
      folderName: bestMatch.folderName,
      confidence: bestMatch.score,
      reason: bestMatch.reasons.join(", "),
      action: "classify",
      scores: {
        vectorScore: bestMatch.vectorScore,
        historyScore: bestMatch.historyScore,
        aiScore: bestMatch.aiScore,
      },
      matchDetails: scoredFolders.slice(0, 5).map((f) => ({
        folderId: f.folderId,
        folderName: f.folderName,
        score: f.score,
        confidence: f.score,
        reason: f.reasons.join(", "),
      })),
    };
  }

  /**
   * 获取匹配器的可读标签
   */
  private getMatcherLabel(matcherName: string): string {
    const labels: Record<string, string> = {
      "knn-direct": "k-NN直接锁定",
      fingerprint: "指纹匹配",
      tag: "标签匹配",
      vector: "向量相似度",
      universal: "通用分类",
      history: "历史记录",
      ai: "AI推荐",
    };
    return labels[matcherName] || matcherName;
  }

  /**
   * 检查是否是系统文件夹（防御性检查）
   * 系统文件夹如"待整理"不应作为分类目标
   */
  private isSystemFolder(result: MatchResult): boolean {
    // 通过 metadata 或文件夹名称判断
    return (
      result.metadata?.isSystemFolder === true || result.folderName === "待整理"
    );
  }
}
