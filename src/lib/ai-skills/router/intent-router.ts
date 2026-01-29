/**
 * IntentRouter - 意图路由器
 *
 * 职责：
 * - 整合意图分类、复杂度评估、模式选择
 * - 作为统一入口接收用户请求
 * - 返回完整的路由决策结果
 * - 收集路由性能指标
 *
 * Code Review P1-3: 使用工厂 + 懒加载单例模式
 * - 避免模块加载时立即创建实例
 * - 支持测试时重置单例
 * - 支持配置延迟初始化
 *
 * @version 2.1.0
 * @since 2025-12-24
 * @updated 2025-12-26 - 添加性能指标收集
 * @updated 2026-01-10 - 重构为懒加载单例模式 (Code Review P1-3)
 */

import { logger } from "@/lib/logger";
import type { IntentClassifier } from "./intent-classifier";
import { createIntentClassifier } from "./intent-classifier";
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
import {
  getIntentCache,
  type IntentCache,
  type IntentCacheStats,
} from "./intent-cache";
import {
  getSemanticCache,
  type SemanticCache,
  type SemanticCacheStats,
} from "./semantic-cache";
import {
  getConfidenceCalibrator,
  type ConfidenceCalibrator,
  type CalibrationFeatures,
} from "./confidence-calibrator";
import { getFeedbackService, type FeedbackService } from "./feedback-service";
import { l0Router, toL0RouteResult } from "@/lib/ai-agent/l0-rules";
import { recordL0RouteResult } from "../observability/metrics";
import { aiMetrics } from "@/lib/ai-agent/metrics";
// NOTE: Workflow intent matcher removed - migrated to workflow-lite
// import { getWorkflowIntentMatcher } from "@/lib/workflow/integration/workflow-intent-matcher";
// import { isWorkflowConversationTriggerEnabled } from "@/lib/ai-agent/config/feature-flags";

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
  private classifier: IntentClassifier;
  private evaluator: ComplexityEvaluator;
  private selector: ModeSelector;
  private config: IntentRouterConfig;
  private metricsAggregator: RouteMetricsAggregator | null = null;
  private intentCache: IntentCache;
  private semanticCache: SemanticCache;
  // Phase 3: 置信度校准与反馈收集
  private confidenceCalibrator: ConfidenceCalibrator;
  private feedbackService: FeedbackService;

  constructor(config: IntentRouterConfig = {}) {
    this.config = {
      enableLLMClassification: false,
      ruleConfidenceThreshold: 0.8,
      debug: false,
      includeMetrics: false,
      enableMetricsAggregation: false,
      ...config,
    };

    // 初始化意图缓存
    this.intentCache = getIntentCache();
    this.semanticCache = getSemanticCache();

    // 使用标准分类器
    this.classifier = createIntentClassifier(config.classifier);

    this.evaluator = createComplexityEvaluator(config.evaluator);
    this.selector = createModeSelector(config.selector);

    // Phase 3: 初始化置信度校准器和反馈服务
    this.confidenceCalibrator = getConfidenceCalibrator();
    this.feedbackService = getFeedbackService();

    // 初始化指标聚合器（如果启用）
    if (this.config.enableMetricsAggregation) {
      this.metricsAggregator = createRouteMetricsAggregator();
    }
  }

  /**
   * 初始化混合分类器（已废弃）
   * @deprecated 混合分类器已被移除
   */
  async initializeHybridClassifier(): Promise<void> {
    // No-op
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
      // ========================================
      // Gate -1: Workflow 意图检测 - DISABLED
      // NOTE: Workflow conversation triggers temporarily disabled
      // pending migration to workflow-lite system
      // ========================================
      // if (isWorkflowConversationTriggerEnabled() && request.context.userId) {
      //   try {
      //     const workflowMatcher = getWorkflowIntentMatcher();
      //     const workflowMatch = await workflowMatcher.matchWorkflow(
      //       request.message,
      //       request.context.userId,
      //     );
      //     ... (workflow matching logic disabled)
      //   } catch (err) {
      //     logger.warn({ error: err }, "Workflow matching failed");
      //   }
      // }

      // ========================================
      // Gate 0: L0 规则直通车（最快路径）
      // ========================================
      if (FeatureFlags.ENABLE_INTENT_DRIVEN_TOOLS) {
        const l0Result = l0Router.tryMatch(request.message);

        if (l0Result.matched && l0Result.rule) {
          const l0Route = toL0RouteResult(l0Result);

          if (l0Route) {
            const metrics = collector.finalize();

            // 记录 L0 命中指标
            recordL0RouteResult(true, metrics.totalDurationMs, {
              ruleId: l0Route.ruleId,
              intentType: l0Route.intentType,
            });
            aiMetrics.recordL0Hit();

            logger.info(
              {
                ruleId: l0Route.ruleId,
                intentType: l0Route.intentType,
                toolId: l0Route.toolId,
                confidence: l0Route.confidence,
                durationMs: metrics.totalDurationMs,
              },
              "IntentRouter: L0 rule hit",
            );

            // 构建简化的意图对象
            const intent = {
              type: l0Route.intentType,
              subType: undefined,
              confidence: l0Route.confidence,
              entities: [],
              requiresMultiStep: false,
              hasDeliverableExpectation: false,
              source: "l0_rule" as const,
              matchedRules: [l0Route.ruleId],
            };

            // L0 路由直接使用 atomic 模式
            const result: RouteResult = {
              intent,
              complexity: {
                level: "simple" as const,
                score: 0.1,
                factors: [
                  {
                    name: "l0_rule_match",
                    weight: 1.0,
                    value: 0,
                    reason: "L0 规则直接匹配，无需复杂度评估",
                  },
                ],
                estimatedSteps: 1,
                estimatedDurationMs: 100,
              },
              mode: "atomic",
              suggestedSkill: null,
              reason: `L0 rule matched: ${l0Route.ruleId}`,
              routingDurationMs: metrics.totalDurationMs,
              l0Route, // 包含直接调用的工具信息
            };

            if (this.config.debug || this.config.includeMetrics) {
              result.metrics = {
                classificationDurationMs: 0,
                complexityDurationMs: 0,
                modeSelectorDurationMs: 0,
                ruleMatchCount: 1,
                disambiguationUsed: false,
                llmFallbackUsed: false,
                classificationSource: "l0_rule",
                llmCacheHit: false,
              };
            }

            return result;
          }
        }

        // L0 未命中：Feature Flag 启用但规则未匹配
        aiMetrics.recordL0Miss();
      }

      // ========================================
      // Gate 1: L1 缓存检查（精确匹配）
      // ========================================
      if (FeatureFlags.ENABLE_INTENT_CACHE_L1) {
        const cachedIntent = this.intentCache.get(request.message);
        if (cachedIntent) {
          // 记录意图缓存命中
          aiMetrics.recordIntentCacheHit();

          // 缓存命中，快速评估复杂度和模式
          collector.startStage("complexity");
          const complexity = await this.evaluator.evaluate(
            cachedIntent,
            request.context,
          );
          collector.endStage("complexity");

          collector.startStage("modeSelector");
          const modeSelection = this.selector.select(cachedIntent, complexity);
          collector.endStage("modeSelector");

          const suggestedSkill =
            modeSelection.mode === "orchestration"
              ? this.selector.getSuggestedSkill(cachedIntent, complexity)
              : null;

          const metrics = collector.finalize();

          logger.info(
            {
              intentType: cachedIntent.type,
              mode: modeSelection.mode,
              skill: suggestedSkill,
              durationMs: metrics.totalDurationMs,
              cacheHit: true,
            },
            "IntentRouter: L1 cache hit",
          );

          const result: RouteResult = {
            intent: cachedIntent,
            complexity,
            mode: modeSelection.mode,
            suggestedSkill,
            reason: `${modeSelection.reason} (cached)`,
            routingDurationMs: metrics.totalDurationMs,
          };

          if (this.config.debug || this.config.includeMetrics) {
            result.metrics = {
              classificationDurationMs: 0,
              complexityDurationMs: metrics.complexityDurationMs,
              modeSelectorDurationMs: metrics.modeSelectorDurationMs,
              ruleMatchCount: 0,
              disambiguationUsed: false,
              llmFallbackUsed: false,
              classificationSource: "cache_l1",
              llmCacheHit: false,
            };
          }

          return result;
        }
      }

      // ========================================
      // Gate 2: L2 语义缓存检查（Phase 2）
      // ========================================
      if (FeatureFlags.ENABLE_SEMANTIC_CACHE) {
        try {
          const semanticCached = await this.semanticCache.get(request.message);
          if (semanticCached) {
            // 记录查询缓存命中（语义缓存视为查询缓存的一种）
            aiMetrics.recordQueryCacheHit();

            // 回填 L1 缓存（加速后续精确匹配）
            if (FeatureFlags.ENABLE_INTENT_CACHE_L1) {
              this.intentCache.set(request.message, semanticCached);
            }

            // 语义缓存命中，快速评估复杂度和模式
            collector.startStage("complexity");
            const complexity = await this.evaluator.evaluate(
              semanticCached,
              request.context,
            );
            collector.endStage("complexity");

            collector.startStage("modeSelector");
            const modeSelection = this.selector.select(
              semanticCached,
              complexity,
            );
            collector.endStage("modeSelector");

            const suggestedSkill =
              modeSelection.mode === "orchestration"
                ? this.selector.getSuggestedSkill(semanticCached, complexity)
                : null;

            const metrics = collector.finalize();

            logger.info(
              {
                intentType: semanticCached.type,
                mode: modeSelection.mode,
                skill: suggestedSkill,
                durationMs: metrics.totalDurationMs,
                cacheHit: "l2_semantic",
              },
              "IntentRouter: L2 semantic cache hit",
            );

            const result: RouteResult = {
              intent: semanticCached,
              complexity,
              mode: modeSelection.mode,
              suggestedSkill,
              reason: `${modeSelection.reason} (semantic cached)`,
              routingDurationMs: metrics.totalDurationMs,
            };

            if (this.config.debug || this.config.includeMetrics) {
              result.metrics = {
                classificationDurationMs: 0,
                complexityDurationMs: metrics.complexityDurationMs,
                modeSelectorDurationMs: metrics.modeSelectorDurationMs,
                ruleMatchCount: 0,
                disambiguationUsed: false,
                llmFallbackUsed: false,
                classificationSource: "cache_l2",
                llmCacheHit: false,
              };
            }

            return result;
          }
        } catch (err) {
          // 语义缓存失败，继续走规则引擎
          logger.warn(
            { error: err instanceof Error ? err.message : String(err) },
            "IntentRouter: Semantic cache query failed, falling back to classification",
          );
        }
      }

      // ========================================
      // Gate 3: 意图分类
      // ========================================
      // 走到这里说明缓存都未命中，记录未命中指标
      aiMetrics.recordIntentCacheMiss();
      aiMetrics.recordQueryCacheMiss();

      // Step 1: 意图分类
      collector.startStage("classification");
      let intent = await this.classifier.classify(request.message);
      collector.endStage("classification");

      // 记录分类相关指标
      collector.recordClassificationSource(intent.source);
      collector.recordLLMFallback(intent.source === "llm");

      // ========================================
      // Phase 3: 置信度校准
      // ========================================
      if (FeatureFlags.ENABLE_CONFIDENCE_CALIBRATION) {
        const calibrationFeatures: CalibrationFeatures = {
          messageLength: request.message.length,
          ruleWeight: 80, // 默认权重，可从匹配规则获取
          matchCount: 1, // 简化：假设匹配到 1 条规则
          hasEntities: intent.entities.length > 0,
          disambiguationUsed: false, // 可从分类器获取
          source: intent.source as CalibrationFeatures["source"],
        };
        const calibratedConfidence = this.confidenceCalibrator.calibrate(
          intent.confidence,
          calibrationFeatures,
        );
        // 更新置信度（保留原始值用于调试）
        intent = {
          ...intent,
          confidence: calibratedConfidence,
          originalConfidence: intent.confidence,
        };
      }

      // ========================================
      // 写入 L1 缓存
      // ========================================
      if (FeatureFlags.ENABLE_INTENT_CACHE_L1) {
        this.intentCache.set(request.message, intent);
      }

      // ========================================
      // 写入 L2 语义缓存（异步，不阻塞主流程）
      // ========================================
      if (FeatureFlags.ENABLE_SEMANTIC_CACHE) {
        this.semanticCache.set(request.message, intent).catch((err) => {
          logger.warn(
            { error: err instanceof Error ? err.message : String(err) },
            "IntentRouter: Failed to write semantic cache",
          );
        });
      }

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
        // P2-9 新增：ReAct 决策可见化
        useReact: modeSelection.useReact,
        reactReason: modeSelection.reactReason,
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

      // ========================================
      // Phase 3: 记录隐式反馈（异步，不阻塞）
      // ========================================
      if (FeatureFlags.ENABLE_FEEDBACK_COLLECTION && request.context.userId) {
        this.feedbackService
          .recordAccepted({
            userId: request.context.userId,
            sessionId: request.context.sessionId || "unknown",
            turnId: request.context.turnId || `turn-${Date.now()}`,
            originalInput: request.message,
            predictedType: intent.type,
            predictedSubtype: intent.subType,
            predictedConfidence: intent.confidence,
          })
          .catch((err) => {
            logger.warn(
              { error: err instanceof Error ? err.message : String(err) },
              "IntentRouter: Failed to record feedback",
            );
          });
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
   * [P1-8 扩展支持 workflow 模式]
   */
  async routeQuick(
    message: string,
    context: UserRequest["context"],
  ): Promise<{
    mode: "atomic" | "orchestration" | "workflow";
    skill: string | null;
    workflowId?: string;
  }> {
    const result = await this.route({ message, context });
    return {
      mode: result.mode,
      skill: result.suggestedSkill,
      workflowId: result.workflowId,
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
   * 获取指标聚合统计
   */
  getMetricsAggregation(): RouteMetricsAggregation | null {
    return this.metricsAggregator?.getAggregation() ?? null;
  }

  /**
   * 获取意图缓存统计
   */
  getCacheStats(): IntentCacheStats {
    return this.intentCache.getStats();
  }

  /**
   * 获取语义缓存统计
   */
  getSemanticCacheStats(): SemanticCacheStats {
    return this.semanticCache.getStats();
  }

  /**
   * 获取置信度校准器统计
   * @since Phase 3
   */
  getCalibrationStats(): ReturnType<ConfidenceCalibrator["getStats"]> {
    return this.confidenceCalibrator.getStats();
  }

  /**
   * 获取反馈服务
   * @since Phase 3
   */
  getFeedbackService(): FeedbackService {
    return this.feedbackService;
  }

  /**
   * 记录用户纠正反馈
   * @since Phase 3
   */
  async recordCorrection(params: {
    userId: string;
    sessionId: string;
    turnId: string;
    originalInput: string;
    predictedType: string;
    predictedSubtype?: string;
    predictedConfidence: number;
    correctedType: string;
    correctedSubtype?: string;
  }): Promise<boolean> {
    if (!FeatureFlags.ENABLE_FEEDBACK_COLLECTION) {
      return false;
    }
    return this.feedbackService.recordCorrected(params);
  }

  /**
   * 获取所有缓存统计（L1 + L2）
   */
  getAllCacheStats(): {
    l1: IntentCacheStats;
    l2: SemanticCacheStats;
  } {
    return {
      l1: this.intentCache.getStats(),
      l2: this.semanticCache.getStats(),
    };
  }

  /**
   * 预热语义缓存
   * @param count 预热条目数量
   */
  async warmupSemanticCache(count?: number): Promise<number> {
    if (!FeatureFlags.ENABLE_SEMANTIC_CACHE) {
      logger.debug("IntentRouter: Semantic cache disabled, skipping warmup");
      return 0;
    }
    return this.semanticCache.warmup(count);
  }

  /**
   * 清空意图缓存
   */
  clearCache(): void {
    this.intentCache.clear();
  }

  /**
   * 清空所有缓存（L1 + L2 统计，不清空数据库）
   */
  clearAllCacheStats(): void {
    this.intentCache.resetStats();
    this.semanticCache.resetStats();
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

// ============================================
// 懒加载单例模式 (Code Review P1-3)
// ============================================

/**
 * 单例实例（懒加载）
 */
let intentRouterInstance: IntentRouter | null = null;

/**
 * 单例配置（用于延迟初始化）
 */
let singletonConfig: IntentRouterConfig | undefined = undefined;

/**
 * 获取意图路由器单例
 *
 * Code Review P1-3: 懒加载单例，首次访问时创建
 *
 * @param config - 可选配置（仅首次调用生效）
 * @returns IntentRouter 实例
 */
export function getIntentRouter(config?: IntentRouterConfig): IntentRouter {
  if (!intentRouterInstance) {
    const finalConfig = config || singletonConfig;
    intentRouterInstance = new IntentRouter(finalConfig);
    logger.debug(
      { config: !!finalConfig },
      "IntentRouter: Lazy singleton created",
    );
  }
  return intentRouterInstance;
}

/**
 * 配置单例（在首次获取前调用）
 *
 * Code Review P1-3: 支持延迟配置
 *
 * @param config - 单例配置
 */
export function configureIntentRouter(config: IntentRouterConfig): void {
  if (intentRouterInstance) {
    logger.warn(
      "IntentRouter: configureIntentRouter called after instance created, updating existing instance",
    );
    intentRouterInstance.updateConfig(config);
  } else {
    singletonConfig = config;
  }
}

/**
 * 重置意图路由器单例
 *
 * Code Review P1-3: 支持测试时重置
 *
 * @internal 仅用于测试
 */
export function resetIntentRouter(): void {
  intentRouterInstance = null;
  singletonConfig = undefined;
  logger.debug("IntentRouter: Singleton reset");
}

/**
 * 检查单例是否已创建
 *
 * @internal 仅用于调试
 */
export function isIntentRouterInitialized(): boolean {
  return intentRouterInstance !== null;
}

/**
 * 默认意图路由器实例
 *
 * @deprecated 请使用 getIntentRouter() 替代，以支持懒加载和测试隔离
 *
 * 保留此导出以保持向后兼容，但底层使用懒加载实现
 */
export const intentRouter = new Proxy({} as IntentRouter, {
  get(_, prop) {
    const instance = getIntentRouter();
    const value = (instance as unknown as Record<string | symbol, unknown>)[
      prop
    ];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
