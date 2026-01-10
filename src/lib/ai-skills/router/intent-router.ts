/**
 * IntentRouter - 意图路由器
 *
 * 职责：
 * - 整合意图分类、复杂度评估、模式选择
 * - 作为统一入口接收用户请求
 * - 返回完整的路由决策结果
 * - 收集路由性能指标
 *
 * @version 2.0.0
 * @since 2025-12-24
 * @updated 2025-12-26 - 添加性能指标收集
 */

import { logger } from "@/lib/logger";
import type { IntentClassifier } from "./intent-classifier";
import { createIntentClassifier } from "./intent-classifier";
import { HybridIntentClassifier } from "./hybrid-intent-classifier";
import type { ComplexityEvaluator } from "./complexity-evaluator";
import { createComplexityEvaluator } from "./complexity-evaluator";
import type { ModeSelector } from "./mode-selector";
import { createModeSelector } from "./mode-selector";
import type { RouteMetricsAggregator } from "./metrics";
import {
  createRouteMetricsCollector,
  createRouteMetricsAggregator,
  type RouteMetrics,
  type RouteMetricsAggregation,
} from "./metrics";
import type {
  UserRequest,
  RouteResult,
  RouterConfig,
  IntentClassifierConfig,
  ComplexityEvaluatorConfig,
} from "./types";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import { DEFAULT_RULES } from "./intent-classifier";

/**
 * 完整路由器配置
 */
export interface IntentRouterConfig extends RouterConfig {
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
  private classifier: IntentClassifier | HybridIntentClassifier;
  private hybridClassifier: HybridIntentClassifier | null = null;
  private evaluator: ComplexityEvaluator;
  private selector: ModeSelector;
  private config: IntentRouterConfig;
  private metricsAggregator: RouteMetricsAggregator | null = null;
  private isHybridMode: boolean;

  constructor(config: IntentRouterConfig = {}) {
    this.config = {
      enableLLMClassification: false,
      ruleConfidenceThreshold: 0.8,
      debug: false,
      includeMetrics: false,
      enableMetricsAggregation: false,
      ...config,
    };

    // 根据 Feature Flag 选择分类器
    this.isHybridMode = FeatureFlags.ENABLE_HYBRID_INTENT_CLASSIFIER;

    if (this.isHybridMode) {
      // 使用混合分类器
      this.hybridClassifier = new HybridIntentClassifier({
        ...config.classifier,
        enableSemanticMatching: true,
        debug: this.config.debug,
      });
      this.classifier = this.hybridClassifier;
    } else {
      // 使用传统分类器
      this.classifier = createIntentClassifier(config.classifier);
    }

    this.evaluator = createComplexityEvaluator(config.evaluator);
    this.selector = createModeSelector(config.selector);

    // 初始化指标聚合器（如果启用）
    if (this.config.enableMetricsAggregation) {
      this.metricsAggregator = createRouteMetricsAggregator();
    }
  }

  /**
   * 初始化混合分类器（如果启用）
   * 应在应用启动时调用一次
   */
  async initializeHybridClassifier(): Promise<void> {
    if (this.isHybridMode && this.hybridClassifier) {
      await this.hybridClassifier.initialize(DEFAULT_RULES);
    }
  }

  /**
   * 路由用户请求
   *
   * @param request - 用户请求
   * @returns 路由决策结果
   */
  async route(request: UserRequest): Promise<RouteResult> {
    const collector = createRouteMetricsCollector();
    collector.start();

    try {
      // Step 1: 意图分类
      collector.startStage("classification");
      let intent;
      if (this.isHybridMode && this.hybridClassifier) {
        // 混合分类器需要上下文
        intent = await this.hybridClassifier.classify(request.message, {
          input: request.message,
          messageHistory: request.context.messageHistory,
          selectedBookmarks: request.context.bookmarkIds,
          currentFolder: request.context.folderId,
        });
      } else {
        // 传统分类器
        intent = await this.classifier.classify(request.message);
      }
      collector.endStage("classification");

      // 记录分类相关指标
      collector.recordClassificationSource(intent.source);
      collector.recordLLMFallback(intent.source === "llm");

      // Step 2: 复杂度评估
      collector.startStage("complexity");
      const complexity = await this.evaluator.evaluate(intent, request.context);
      collector.endStage("complexity");

      // Step 3: 模式选择
      collector.startStage("modeSelector");
      const modeSelection = this.selector.select(intent, complexity);
      collector.endStage("modeSelector");

      // Step 4: 获取建议的 Skill
      const suggestedSkill =
        modeSelection.mode === "orchestration"
          ? this.selector.getSuggestedSkill(intent, complexity)
          : null;

      // 完成指标收集
      const metrics = collector.finalize();

      // 添加到聚合器
      if (this.metricsAggregator) {
        this.metricsAggregator.addSample(metrics);
      }

      const result: RouteResult = {
        intent,
        complexity,
        mode: modeSelection.mode,
        suggestedSkill,
        reason: modeSelection.reason,
        routingDurationMs: metrics.totalDurationMs,
      };

      // 在 debug 模式或明确请求时包含详细指标
      if (this.config.debug || this.config.includeMetrics) {
        result.metrics = {
          classificationDurationMs: metrics.classificationDurationMs,
          complexityDurationMs: metrics.complexityDurationMs,
          modeSelectorDurationMs: metrics.modeSelectorDurationMs,
          ruleMatchCount: metrics.ruleMatchCount,
          disambiguationUsed: metrics.disambiguationUsed,
          llmFallbackUsed: metrics.llmFallbackUsed,
          classificationSource: metrics.classificationSource,
          llmCacheHit: metrics.llmCacheHit,
        };
      }

      // 记录路由日志
      if (this.config.debug) {
        logger.debug(
          {
            message: request.message.substring(0, 50),
            intentType: intent.type,
            intentSubType: intent.subType,
            intentConfidence: intent.confidence,
            classificationSource: intent.source,
            complexityLevel: complexity.level,
            complexityScore: complexity.score,
            mode: modeSelection.mode,
            suggestedSkill,
            reason: modeSelection.reason,
            metrics: {
              total: metrics.totalDurationMs,
              classification: metrics.classificationDurationMs,
              complexity: metrics.complexityDurationMs,
              modeSelector: metrics.modeSelectorDurationMs,
            },
          },
          "IntentRouter: Route completed",
        );
      } else {
        logger.info(
          {
            intentType: intent.type,
            mode: modeSelection.mode,
            skill: suggestedSkill,
            durationMs: metrics.totalDurationMs,
          },
          "IntentRouter: Route completed",
        );
      }

      return result;
    } catch (error) {
      const metrics = collector.finalize();

      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          message: request.message.substring(0, 50),
          durationMs: metrics.totalDurationMs,
        },
        "IntentRouter: Route failed, falling back to atomic mode",
      );

      // 路由失败时，返回默认原子模式
      return this.createFallbackResult(request, metrics.totalDurationMs, error);
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
  getClassifier(): IntentClassifier | HybridIntentClassifier {
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
   * 获取指标聚合统计
   */
  getMetricsAggregation(): RouteMetricsAggregation | null {
    return this.metricsAggregator?.getAggregation() ?? null;
  }

  /**
   * 获取最近的路由指标样本
   */
  getRecentMetrics(count: number = 10): RouteMetrics[] {
    return this.metricsAggregator?.getRecentSamples(count) ?? [];
  }

  /**
   * 清空指标聚合器
   */
  clearMetrics(): void {
    this.metricsAggregator?.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IntentRouterConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    // 如果启用/禁用指标聚合，更新聚合器
    if (config.enableMetricsAggregation !== undefined) {
      if (config.enableMetricsAggregation && !this.metricsAggregator) {
        this.metricsAggregator = createRouteMetricsAggregator();
      } else if (!config.enableMetricsAggregation && this.metricsAggregator) {
        this.metricsAggregator = null;
      }
    }
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
