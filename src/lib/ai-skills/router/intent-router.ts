/**
 * IntentRouter - 意图路由器
 *
 * 职责：
 * - 整合意图分类、复杂度评估、模式选择
 * - 作为统一入口接收用户请求
 * - 返回完整的路由决策结果
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type { IntentClassifier } from "./intent-classifier";
import { createIntentClassifier } from "./intent-classifier";
import type { ComplexityEvaluator } from "./complexity-evaluator";
import { createComplexityEvaluator } from "./complexity-evaluator";
import type { ModeSelector } from "./mode-selector";
import { createModeSelector } from "./mode-selector";
import type {
  UserRequest,
  RouteResult,
  RouterConfig,
  IntentClassifierConfig,
  ComplexityEvaluatorConfig,
} from "./types";

/**
 * 完整路由器配置
 */
interface IntentRouterConfig extends RouterConfig {
  /** 意图分类器配置 */
  classifier?: IntentClassifierConfig;
  /** 复杂度评估器配置 */
  evaluator?: ComplexityEvaluatorConfig;
  /** 模式选择器配置 */
  selector?: {
    forceAtomicMode?: boolean;
  };
}

/**
 * 意图路由器
 *
 * @example
 * ```typescript
 * const router = new IntentRouter();
 *
 * const result = await router.route({
 *   message: "帮我整理一下收藏，清理重复的",
 *   context: { userId: "user-123" }
 * });
 *
 * if (result.mode === 'orchestration') {
 *   // 使用编排引擎执行
 *   await orchestrationEngine.execute(result.suggestedSkill, input, context);
 * } else {
 *   // 使用原子引擎（KnowledgeAgent）执行
 *   await knowledgeAgent.execute(input, context);
 * }
 * ```
 */
export class IntentRouter {
  private classifier: IntentClassifier;
  private evaluator: ComplexityEvaluator;
  private selector: ModeSelector;
  private config: IntentRouterConfig;

  constructor(config: IntentRouterConfig = {}) {
    this.config = {
      enableLLMClassification: false,
      ruleConfidenceThreshold: 0.8,
      debug: false,
      ...config,
    };

    this.classifier = createIntentClassifier(config.classifier);
    this.evaluator = createComplexityEvaluator(config.evaluator);
    this.selector = createModeSelector(config.selector);
  }

  /**
   * 路由用户请求
   *
   * @param request - 用户请求
   * @returns 路由决策结果
   */
  async route(request: UserRequest): Promise<RouteResult> {
    const startTime = performance.now();

    try {
      // Step 1: 意图分类
      const intent = await this.classifier.classify(request.message);

      // Step 2: 复杂度评估
      const complexity = await this.evaluator.evaluate(intent, request.context);

      // Step 3: 模式选择
      const modeSelection = this.selector.select(intent, complexity);

      // Step 4: 获取建议的 Skill
      const suggestedSkill =
        modeSelection.mode === "orchestration"
          ? this.selector.getSuggestedSkill(intent, complexity)
          : null;

      const routingDurationMs = Math.round(performance.now() - startTime);

      const result: RouteResult = {
        intent,
        complexity,
        mode: modeSelection.mode,
        suggestedSkill,
        reason: modeSelection.reason,
        routingDurationMs,
      };

      // 记录路由日志
      if (this.config.debug) {
        logger.debug(
          {
            message: request.message.substring(0, 50),
            intentType: intent.type,
            intentSubType: intent.subType,
            intentConfidence: intent.confidence,
            complexityLevel: complexity.level,
            complexityScore: complexity.score,
            mode: modeSelection.mode,
            suggestedSkill,
            reason: modeSelection.reason,
            durationMs: routingDurationMs,
          },
          "IntentRouter: Route completed",
        );
      } else {
        logger.info(
          {
            intentType: intent.type,
            mode: modeSelection.mode,
            skill: suggestedSkill,
            durationMs: routingDurationMs,
          },
          "IntentRouter: Route completed",
        );
      }

      return result;
    } catch (error) {
      const routingDurationMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          message: request.message.substring(0, 50),
          durationMs: routingDurationMs,
        },
        "IntentRouter: Route failed, falling back to atomic mode",
      );

      // 路由失败时，返回默认原子模式
      return this.createFallbackResult(request, routingDurationMs, error);
    }
  }

  /**
   * 快速路由（仅返回模式，不返回详细信息）
   */
  async routeQuick(
    message: string,
    context: UserRequest["context"],
  ): Promise<{
    mode: "atomic" | "orchestration";
    skill: string | null;
  }> {
    const result = await this.route({ message, context });
    return {
      mode: result.mode,
      skill: result.suggestedSkill,
    };
  }

  /**
   * 创建失败时的回退结果
   */
  private createFallbackResult(
    request: UserRequest,
    durationMs: number,
    error: unknown,
  ): RouteResult {
    return {
      intent: {
        type: "chitchat",
        subType: "fallback",
        confidence: 0.3,
        entities: [],
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      },
      complexity: {
        level: "simple",
        score: 10,
        factors: [],
        estimatedSteps: 1,
        estimatedDurationMs: 2000,
      },
      mode: "atomic",
      suggestedSkill: null,
      reason: `路由失败，回退到原子模式: ${error instanceof Error ? error.message : "Unknown error"}`,
      routingDurationMs: durationMs,
    };
  }

  /**
   * 获取意图分类器（用于高级定制）
   */
  getClassifier(): IntentClassifier {
    return this.classifier;
  }

  /**
   * 获取复杂度评估器（用于高级定制）
   */
  getEvaluator(): ComplexityEvaluator {
    return this.evaluator;
  }

  /**
   * 获取模式选择器（用于高级定制）
   */
  getSelector(): ModeSelector {
    return this.selector;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IntentRouterConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * 创建意图路由器实例
 */
export function createIntentRouter(config?: IntentRouterConfig): IntentRouter {
  return new IntentRouter(config);
}

/**
 * 默认意图路由器实例
 */
export const intentRouter = new IntentRouter();
