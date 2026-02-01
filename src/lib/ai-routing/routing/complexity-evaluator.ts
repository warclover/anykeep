/**
 * 复杂度评估器
 *
 * 评估用户请求的复杂度，用于模式选择决策
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import type {
  IntentType,
  IntentClassification,
  ComplexityLevel,
  ComplexityFactor,
  ComplexityEvaluation,
  RequestContext,
} from "../types";

// ============================================
// 配置常量
// ============================================

/**
 * 复杂度阈值
 */
export const COMPLEXITY_THRESHOLDS = {
  /** 简单任务分数上限 */
  SIMPLE: 35,
  /** 复杂任务分数下限 */
  COMPLEX: 60,
} as const;

/**
 * 数据规模阈值
 */
export const DATA_SCALE_THRESHOLDS = {
  LARGE: 100,
  MEDIUM: 50,
  SMALL: 20,
  DEFAULT: 20,
  SINGLE: 1,
  FALLBACK: 10,
} as const;

/**
 * 复杂度因子权重
 */
export const FACTOR_WEIGHTS = {
  INTENT_COMPLEXITY: 0.3,
  MULTI_STEP: 0.25,
  DELIVERABLE: 0.2,
  DATA_SCALE: 0.15,
  CONFIRMATION: 0.1,
} as const;

/**
 * 复杂度因子分值
 */
export const FACTOR_VALUES = {
  MULTI_STEP_HIGH: 80,
  MULTI_STEP_LOW: 20,
  DELIVERABLE_HIGH: 70,
  DELIVERABLE_LOW: 10,
  SCALE_LARGE: 80,
  SCALE_MEDIUM: 60,
  SCALE_SMALL: 40,
  SCALE_DEFAULT: 20,
  CONFIRMATION_HIGH: 50,
  CONFIRMATION_LOW: 10,
  MIN_SCORE: 0,
  MAX_SCORE: 100,
} as const;

/**
 * 意图类型复杂度基准分
 */
const INTENT_COMPLEXITY_SCORES: Record<IntentType, number> = {
  chitchat: 10,
  query: 20,
  refine: 25,
  action: 30,
  create: 50,
  organize: 70,
  analyze: 75,
  learn: 80,
};

/**
 * 子类型分数调整
 */
const SUBTYPE_ADJUSTMENTS: Record<string, number> = {
  count: -5,
  search: 0,
  list: -5,
  explain: 10,
  classify: 10,
  cleanup: 15,
  dedupe: 20,
  expire: 5,
  review: 15,
  interview: 25,
  path: 20,
  report: 20,
  insight: 15,
  digest: 5,
  note: 0,
  share: 5,
};

// ============================================
// ComplexityEvaluator 类
// ============================================

/**
 * 复杂度评估器配置
 */
export interface ComplexityEvaluatorConfig {
  /** 简单任务阈值 */
  simpleThreshold?: number;
  /** 复杂任务阈值 */
  complexThreshold?: number;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 复杂度评估器
 */
export class ComplexityEvaluator {
  private config: Required<ComplexityEvaluatorConfig>;

  constructor(config: ComplexityEvaluatorConfig = {}) {
    this.config = {
      simpleThreshold: config.simpleThreshold ?? COMPLEXITY_THRESHOLDS.SIMPLE,
      complexThreshold:
        config.complexThreshold ?? COMPLEXITY_THRESHOLDS.COMPLEX,
      debug: config.debug ?? false,
    };
  }

  /**
   * 评估复杂度
   */
  evaluate(
    intent: IntentClassification,
    context: Partial<RequestContext> = {},
  ): ComplexityEvaluation {
    const factors: ComplexityFactor[] = [];

    // 因素 1: 意图复杂度
    let intentScore = INTENT_COMPLEXITY_SCORES[intent.type] ?? 50;
    if (intent.subType && SUBTYPE_ADJUSTMENTS[intent.subType] !== undefined) {
      intentScore += SUBTYPE_ADJUSTMENTS[intent.subType];
    }
    intentScore = Math.max(
      FACTOR_VALUES.MIN_SCORE,
      Math.min(FACTOR_VALUES.MAX_SCORE, intentScore),
    );
    factors.push({
      name: "intent_complexity",
      weight: FACTOR_WEIGHTS.INTENT_COMPLEXITY,
      value: intentScore,
      reason: `${intent.type}${intent.subType ? `:${intent.subType}` : ""} 类型`,
    });

    // 因素 2: 多步骤需求
    factors.push({
      name: "multi_step",
      weight: FACTOR_WEIGHTS.MULTI_STEP,
      value: intent.requiresMultiStep
        ? FACTOR_VALUES.MULTI_STEP_HIGH
        : FACTOR_VALUES.MULTI_STEP_LOW,
      reason: intent.requiresMultiStep ? "需要多步骤" : "单步完成",
    });

    // 因素 3: 交付物期���
    factors.push({
      name: "deliverable",
      weight: FACTOR_WEIGHTS.DELIVERABLE,
      value: intent.hasDeliverableExpectation
        ? FACTOR_VALUES.DELIVERABLE_HIGH
        : FACTOR_VALUES.DELIVERABLE_LOW,
      reason: intent.hasDeliverableExpectation ? "期望交付物" : "仅数据",
    });

    // 因素 4: 数据规模
    const dataScale = this.estimateDataScale(intent, context);
    let scaleScore: number = FACTOR_VALUES.SCALE_DEFAULT;
    if (dataScale > DATA_SCALE_THRESHOLDS.LARGE) {
      scaleScore = FACTOR_VALUES.SCALE_LARGE;
    } else if (dataScale > DATA_SCALE_THRESHOLDS.MEDIUM) {
      scaleScore = FACTOR_VALUES.SCALE_MEDIUM;
    } else if (dataScale > DATA_SCALE_THRESHOLDS.SMALL) {
      scaleScore = FACTOR_VALUES.SCALE_SMALL;
    }
    factors.push({
      name: "data_scale",
      weight: FACTOR_WEIGHTS.DATA_SCALE,
      value: scaleScore,
      reason: `约 ${dataScale} 条数据`,
    });

    // 因素 5: 确认需求
    const needsConfirm =
      intent.subType &&
      ["delete", "move", "cleanup", "dedupe"].includes(intent.subType);
    factors.push({
      name: "confirmation",
      weight: FACTOR_WEIGHTS.CONFIRMATION,
      value: needsConfirm
        ? FACTOR_VALUES.CONFIRMATION_HIGH
        : FACTOR_VALUES.CONFIRMATION_LOW,
      reason: needsConfirm ? "需确认" : "自动完成",
    });

    // 计算总分
    const score = Math.round(
      factors.reduce((sum, f) => sum + f.weight * f.value, 0),
    );

    // 确定级别
    let level: ComplexityLevel = "simple";
    if (score >= this.config.complexThreshold) {
      level = "complex";
    } else if (score >= this.config.simpleThreshold) {
      level = "medium";
    }

    return {
      level,
      score,
      factors,
      estimatedSteps: this.estimateSteps(level, intent),
      estimatedDurationMs: this.estimateDuration(level),
    };
  }

  /**
   * 估算数据规模
   *
   * 优先级规则（从高到低）：
   * 1. selectedBookmarks - 用户明确选中的书签
   * 2. bookmarkIds - 明确指定的书签 ID 列表
   * 3. totalBookmarks - 基于意图类型的估算
   *
   * 注意：selectedBookmarks 和 bookmarkIds 不应同时存在，
   * 如果同时存在，优先使用 selectedBookmarks
   */
  private estimateDataScale(
    intent: IntentClassification,
    context: Partial<RequestContext>,
  ): number {
    // 优先级 1: 用户明确选中的书签（最高优先级）
    if (context.selectedBookmarks?.length) {
      return context.selectedBookmarks.length;
    }

    // 优先级 2: 明确指定的书签 ID 列表
    if (context.bookmarkIds?.length) {
      // 一致性校验：如果同时存在 selectedBookmarks（空数组）和 bookmarkIds
      // 这可能表示数据不一致，记录警告
      if (
        context.selectedBookmarks !== undefined &&
        context.selectedBookmarks.length === 0 &&
        context.bookmarkIds.length > 0
      ) {
        // 数据可能不一致，但仍使用 bookmarkIds
        // 在生产环境中可以添加日志
      }
      return context.bookmarkIds.length;
    }

    // 优先级 3: 基于总数和意图类型的估算
    if (context.totalBookmarks) {
      switch (intent.type) {
        case "query":
          return Math.min(context.totalBookmarks, DATA_SCALE_THRESHOLDS.SMALL);
        case "action":
          return DATA_SCALE_THRESHOLDS.SINGLE;
        case "organize":
        case "analyze":
          return context.totalBookmarks;
        case "learn":
          return Math.min(context.totalBookmarks, DATA_SCALE_THRESHOLDS.MEDIUM);
        default:
          return DATA_SCALE_THRESHOLDS.FALLBACK;
      }
    }

    return DATA_SCALE_THRESHOLDS.DEFAULT;
  }

  /**
   * 估算步骤数
   */
  private estimateSteps(
    level: ComplexityLevel,
    intent: IntentClassification,
  ): number {
    const baseSteps: Record<ComplexityLevel, number> = {
      simple: 1,
      medium: 3,
      complex: 5,
    };

    let steps = baseSteps[level];

    // 根据意图类型调整
    if (intent.type === "organize" || intent.type === "analyze") {
      steps += 2;
    }
    if (intent.type === "learn") {
      steps += 3;
    }

    return steps;
  }

  /**
   * 估算执行时间
   */
  private estimateDuration(level: ComplexityLevel): number {
    const baseDuration: Record<ComplexityLevel, number> = {
      simple: 1000,
      medium: 5000,
      complex: 15000,
    };
    return baseDuration[level];
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建复杂度评估器实例
 */
export function createComplexityEvaluator(
  config?: ComplexityEvaluatorConfig,
): ComplexityEvaluator {
  return new ComplexityEvaluator(config);
}
