/**
 * 多信号融合器
 *
 * 融合多个推断信号，计算画像置信度，生成推断结果
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  PersonaType,
  InferenceSignal,
  PersonaInferenceResult,
} from "./types";
import { PERSONA_GROUP_MAP, PHASE3_ENABLED_PERSONAS } from "../personas/types";
import { SIGNAL_TYPE_WEIGHTS } from "./types";
import { PLATFORM_PERSONA_RULES } from "./platform-matcher";
import { TAG_PERSONA_RULES } from "./tag-matcher";

// =============================================================================
// 多信号融合器
// =============================================================================

/**
 * 多信号融合器
 */
export class SignalFusion {
  /**
   * 融合多个信号，计算每个画像的得分
   */
  fuse(signals: InferenceSignal[]): Map<PersonaType, number> {
    const scores = new Map<PersonaType, number>();

    for (const signal of signals) {
      const typeWeight = SIGNAL_TYPE_WEIGHTS[signal.type] || 0.1;

      // 获取该信号对应的画像权重
      const personaWeights = this.getPersonaWeightsFromSignal(signal);

      for (const [persona, weight] of personaWeights) {
        // 跳过 Phase 3 未启用的画像
        if (!PHASE3_ENABLED_PERSONAS.includes(persona)) continue;

        const currentScore = scores.get(persona) || 0;
        // 综合权重 = 信号类型权重 × 信号占比权重 × 画像规则权重 × log(计数+1)
        const signalScore =
          typeWeight * signal.weight * weight * Math.log10(signal.count + 1);
        scores.set(persona, currentScore + signalScore);
      }
    }

    return scores;
  }

  /**
   * 从信号中获取画像权重
   */
  private getPersonaWeightsFromSignal(
    signal: InferenceSignal,
  ): Map<PersonaType, number> {
    const weights = new Map<PersonaType, number>();

    if (signal.type === "platform") {
      // 从平台规则获取权重
      const rules = PLATFORM_PERSONA_RULES[signal.source];
      if (rules) {
        for (const rule of rules) {
          weights.set(rule.persona, rule.weight);
        }
      }
    } else if (signal.type === "tag") {
      // 从标签规则获取权重
      for (const rule of TAG_PERSONA_RULES) {
        if (rule.pattern.test(signal.source)) {
          for (const p of rule.personas) {
            weights.set(p.persona, p.weight);
          }
          break;
        }
      }
    } else {
      // 其他信号类型：使用默认权重 0.5
      for (const persona of signal.personas) {
        weights.set(persona, 0.5);
      }
    }

    return weights;
  }

  /**
   * 归一化得分为置信度
   */
  normalizeToConfidence(
    scores: Map<PersonaType, number>,
  ): Map<PersonaType, number> {
    const totalScore = Array.from(scores.values()).reduce((a, b) => a + b, 0);

    if (totalScore === 0) {
      return new Map([["general" as PersonaType, 100]]);
    }

    const confidence = new Map<PersonaType, number>();

    // 找出最高分
    let maxScore = 0;
    for (const score of scores.values()) {
      if (score > maxScore) maxScore = score;
    }

    for (const [persona, score] of scores) {
      // 置信度 = 相对于最高分的比例 × 100
      // 同时考虑绝对占比
      const relativeScore = maxScore > 0 ? (score / maxScore) * 100 : 0;
      const absoluteRatio = (score / totalScore) * 100;
      // 加权平均：60% 相对分 + 40% 绝对占比
      const finalConfidence = relativeScore * 0.6 + absoluteRatio * 0.4;
      confidence.set(persona, Math.min(finalConfidence, 100));
    }

    return confidence;
  }

  /**
   * 生成推断结果
   */
  generateResult(
    signals: InferenceSignal[],
    sampleSize: number,
  ): PersonaInferenceResult {
    // 处理空信号情况
    if (signals.length === 0) {
      return this.getDefaultResult(sampleSize, signals);
    }

    const scores = this.fuse(signals);
    const confidence = this.normalizeToConfidence(scores);

    // 按置信度排序
    const sorted = Array.from(confidence.entries()).sort((a, b) => b[1] - a[1]);

    // 没有有效结果，返回 general
    if (sorted.length === 0) {
      return this.getDefaultResult(sampleSize, signals);
    }

    // 主画像
    const [primaryPersona, primaryConfidence] = sorted[0];

    // 备选画像（排除主画像，取前 3 个）
    const alternatives = sorted.slice(1, 4).map(([persona, conf]) => ({
      persona,
      confidence: Math.round(conf),
    }));

    return {
      primaryPersona,
      group: PERSONA_GROUP_MAP[primaryPersona],
      confidence: Math.round(primaryConfidence),
      alternatives,
      signals,
      inferredAt: new Date().toISOString(),
      sampleSize,
    };
  }

  /**
   * 获取默认结果（general 画像）
   */
  private getDefaultResult(
    sampleSize: number,
    signals: InferenceSignal[],
  ): PersonaInferenceResult {
    return {
      primaryPersona: "general",
      group: "general",
      confidence: 0,
      alternatives: [],
      signals,
      inferredAt: new Date().toISOString(),
      sampleSize,
    };
  }
}

/**
 * 单例实例
 */
export const signalFusion = new SignalFusion();

// =============================================================================
// 置信度计算辅助函数
// =============================================================================

/**
 * 计算信号覆盖率
 *
 * 评估信号覆盖的数据量占比
 */
export function calculateSignalCoverage(
  signals: InferenceSignal[],
  totalBookmarks: number,
): number {
  if (totalBookmarks === 0) return 0;

  const coveredCount = signals.reduce((sum, s) => sum + s.count, 0);
  // 去重后的覆盖率（因为一个书签可能匹配多个信号）
  return Math.min(coveredCount / totalBookmarks, 1);
}

/**
 * 计算信号多样性
 *
 * 评估信号来源的多样性
 */
export function calculateSignalDiversity(signals: InferenceSignal[]): number {
  const signalTypes = new Set(signals.map((s) => s.type));
  const sources = new Set(signals.map((s) => s.source));

  // 信号类型多样性（最多 4 种类型）
  const typeDiversity = signalTypes.size / 4;
  // 来源多样性（使用对数刻度）
  const sourceDiversity = Math.min(Math.log10(sources.size + 1) / 2, 1);

  return (typeDiversity + sourceDiversity) / 2;
}

/**
 * 计算结果稳定性
 *
 * 评估主画像与备选画像的置信度差距
 */
export function calculateResultStability(
  result: PersonaInferenceResult,
): number {
  if (result.alternatives.length === 0) {
    // 没有备选，完全稳定
    return 1;
  }

  const topAlternativeConfidence = result.alternatives[0].confidence;
  const confidenceGap = result.confidence - topAlternativeConfidence;

  // 差距越大越稳定
  return Math.min(confidenceGap / 50, 1);
}
