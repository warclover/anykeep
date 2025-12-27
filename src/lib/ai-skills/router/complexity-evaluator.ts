/**
 * ComplexityEvaluator - 复杂度评估器
 *
 * 职责：
 * - 评估任务的复杂程度
 * - 考虑多种因素：意图类型、多步骤需求、交付物期望、数据规模等
 * - 返回复杂度级别和预估信息
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type {
  IntentType,
  IntentClassification,
  ComplexityLevel,
  ComplexityFactor,
  ComplexityEvaluation,
  ComplexityEvaluatorConfig,
  RequestContext,
} from "./types";

/**
 * 意图类型对应的基础复杂度分数
 */
const INTENT_COMPLEXITY_SCORES: Record<IntentType, number> = {
  chitchat: 10,
  query: 20,
  refine: 25, // 筛选类比查询稍复杂
  action: 30,
  create: 50,
  organize: 70,
  analyze: 75,
  learn: 80,
};

/**
 * 子类型复杂度调整
 */
const SUBTYPE_COMPLEXITY_ADJUSTMENTS: Record<string, number> = {
  // 查询类
  count: -5,
  search: 0,
  list: -5,
  explain: 10,

  // 整理类
  classify: 10,
  cleanup: 15,
  dedupe: 20,
  expire: 5,

  // 学习类
  review: 15,
  interview: 25,
  path: 20,

  // 分析类
  report: 20,
  insight: 15,

  // 创建类
  digest: 5,
  note: 0,
  share: 5,
};

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<ComplexityEvaluatorConfig> = {
  simpleThreshold: 35,
  complexThreshold: 60,
};

/**
 * 复杂度评估器
 */
export class ComplexityEvaluator {
  private config: Required<ComplexityEvaluatorConfig>;

  constructor(config: ComplexityEvaluatorConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * 评估任务复杂度
   *
   * @param intent - 意图分类结果
   * @param context - 请求上下文
   * @returns 复杂度评估结果
   */
  async evaluate(
    intent: IntentClassification,
    context: RequestContext,
  ): Promise<ComplexityEvaluation> {
    const startTime = performance.now();
    const factors: ComplexityFactor[] = [];

    // 因素 1: 意图本身的复杂度
    const intentScore = this.evaluateIntentComplexity(intent);
    factors.push(intentScore);

    // 因素 2: 是否需要多步骤
    const multiStepScore = this.evaluateMultiStep(intent);
    factors.push(multiStepScore);

    // 因素 3: 是否期望交付物
    const deliverableScore = this.evaluateDeliverable(intent);
    factors.push(deliverableScore);

    // 因素 4: 数据规模
    const dataScaleScore = await this.evaluateDataScale(intent, context);
    factors.push(dataScaleScore);

    // 因素 5: 是否需要用户确认
    const confirmationScore = this.evaluateConfirmation(intent);
    factors.push(confirmationScore);

    // 计算加权总分
    const totalScore = factors.reduce(
      (sum, factor) => sum + factor.weight * factor.value,
      0,
    );

    // 确定复杂度级别
    const level = this.determineLevel(totalScore);

    // 预估步骤数和时间
    const estimatedSteps = this.estimateSteps(level, intent);
    const estimatedDurationMs = this.estimateDuration(level, intent);

    const result: ComplexityEvaluation = {
      level,
      score: Math.round(totalScore),
      factors,
      estimatedSteps,
      estimatedDurationMs,
    };

    logger.debug(
      {
        intentType: intent.type,
        subType: intent.subType,
        score: result.score,
        level: result.level,
        durationMs: Math.round(performance.now() - startTime),
      },
      "ComplexityEvaluator: Evaluation completed",
    );

    return result;
  }

  /**
   * 评估意图复杂度
   */
  private evaluateIntentComplexity(
    intent: IntentClassification,
  ): ComplexityFactor {
    let baseScore = INTENT_COMPLEXITY_SCORES[intent.type] ?? 50;

    // 应用子类型调整
    if (intent.subType && SUBTYPE_COMPLEXITY_ADJUSTMENTS[intent.subType]) {
      baseScore += SUBTYPE_COMPLEXITY_ADJUSTMENTS[intent.subType];
    }

    // 确保分数在有效范围内
    baseScore = Math.max(0, Math.min(100, baseScore));

    return {
      name: "intent_complexity",
      weight: 0.3,
      value: baseScore,
      reason: `${intent.type}${intent.subType ? `:${intent.subType}` : ""} 类型任务`,
    };
  }

  /**
   * 评估多步骤需求
   */
  private evaluateMultiStep(intent: IntentClassification): ComplexityFactor {
    const value = intent.requiresMultiStep ? 80 : 20;

    return {
      name: "multi_step",
      weight: 0.25,
      value,
      reason: intent.requiresMultiStep ? "需要多步骤处理" : "单步即可完成",
    };
  }

  /**
   * 评估交付物期望
   */
  private evaluateDeliverable(intent: IntentClassification): ComplexityFactor {
    const value = intent.hasDeliverableExpectation ? 70 : 10;

    return {
      name: "deliverable_expectation",
      weight: 0.2,
      value,
      reason: intent.hasDeliverableExpectation
        ? "用户期望获得文档/报告"
        : "仅需数据返回",
    };
  }

  /**
   * 评估数据规模
   */
  private async evaluateDataScale(
    intent: IntentClassification,
    context: RequestContext,
  ): Promise<ComplexityFactor> {
    // 估算数据规模
    let estimatedScale = 0;

    // 优先使用上下文中的书签数量
    if (context.bookmarkIds && context.bookmarkIds.length > 0) {
      estimatedScale = context.bookmarkIds.length;
    } else if (context.totalBookmarks) {
      // 根据任务类型估算涉及的数据量
      switch (intent.type) {
        case "query":
          estimatedScale = Math.min(context.totalBookmarks, 20);
          break;
        case "action":
          estimatedScale = context.bookmarkIds?.length || 1;
          break;
        case "organize":
        case "analyze":
          estimatedScale = context.totalBookmarks;
          break;
        case "learn":
          estimatedScale = Math.min(context.totalBookmarks, 50);
          break;
        default:
          estimatedScale = 10;
      }
    } else {
      // 默认估算
      estimatedScale = 20;
    }

    // 从实体中提取数量限制
    const quantityEntity = intent.entities.find((e) => e.type === "quantity");
    if (quantityEntity) {
      const quantity = parseInt(quantityEntity.value, 10);
      if (!isNaN(quantity)) {
        estimatedScale = Math.min(estimatedScale, quantity);
      }
    }

    // 计算分数
    let value: number;
    if (estimatedScale > 100) {
      value = 80;
    } else if (estimatedScale > 50) {
      value = 60;
    } else if (estimatedScale > 20) {
      value = 40;
    } else {
      value = 20;
    }

    return {
      name: "data_scale",
      weight: 0.15,
      value,
      reason: `预计处理 ${estimatedScale} 条数据`,
    };
  }

  /**
   * 评估是否需要用户确认
   */
  private evaluateConfirmation(intent: IntentClassification): ComplexityFactor {
    // 这些操作通常需要用户确认
    const confirmationActions = ["delete", "move", "cleanup", "dedupe"];
    const needsConfirmation =
      intent.subType && confirmationActions.includes(intent.subType);

    return {
      name: "requires_confirmation",
      weight: 0.1,
      value: needsConfirmation ? 50 : 10,
      reason: needsConfirmation ? "需要用户确认" : "可自动完成",
    };
  }

  /**
   * 确定复杂度级别
   */
  private determineLevel(score: number): ComplexityLevel {
    if (score >= this.config.complexThreshold) {
      return "complex";
    }
    if (score >= this.config.simpleThreshold) {
      return "medium";
    }
    return "simple";
  }

  /**
   * 预估步骤数
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
    if (intent.type === "learn" && intent.subType === "interview") {
      steps += 2;
    }
    if (intent.type === "analyze" && intent.subType === "report") {
      steps += 1;
    }

    return steps;
  }

  /**
   * 预估执行时间（毫秒）
   */
  private estimateDuration(
    level: ComplexityLevel,
    intent: IntentClassification,
  ): number {
    const baseDuration: Record<ComplexityLevel, number> = {
      simple: 2000,
      medium: 5000,
      complex: 15000,
    };

    let duration = baseDuration[level];

    // 学习类任务通常需要更多时间
    if (intent.type === "learn") {
      duration *= 1.5;
    }

    // 分析类任务可能需要生成报告
    if (intent.type === "analyze" && intent.subType === "report") {
      duration *= 2;
    }

    return Math.round(duration);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ComplexityEvaluatorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * 创建复杂度评估器实例
 */
export function createComplexityEvaluator(
  config?: ComplexityEvaluatorConfig,
): ComplexityEvaluator {
  return new ComplexityEvaluator(config);
}

/**
 * 默认复杂度评估器实例
 */
export const complexityEvaluator = new ComplexityEvaluator();
