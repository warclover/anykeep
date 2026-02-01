/**
 * 统一入口
 *
 * AI 路由层的统一入口，整合预处理、缓存、分类、模式选择
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import { logger } from "@/lib/logger";
import type {
  UnifiedRequest,
  RouteResult,
  UnifiedEntryConfig,
  ClassificationContext,
  IntentClassification,
} from "../types";
import { InputPreprocessor } from "../preprocessing/input-preprocessor";
import { IntentCache } from "../cache/intent-cache";
import { ClassifierChain } from "../intent/classifier-chain";
import { ModeSelector } from "../routing/mode-selector";
import { ComplexityEvaluator } from "../routing/complexity-evaluator";
import {
  DebugTracer,
  generateRequestId,
  isDebugTraceEnabled,
} from "../debug/debug-trace";

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: Required<UnifiedEntryConfig> = {
  enablePreprocessing: true,
  enableCache: true,
  enableDebugTrace: isDebugTraceEnabled(),
  routerConfig: {
    debug: false,
  },
};

// ============================================
// UnifiedEntry 类
// ============================================

/**
 * 统一入口
 *
 * 整合 AI 路由的各个组件，提供统一的路由接口
 */
export class UnifiedEntry {
  private preprocessor: InputPreprocessor;
  private intentCache: IntentCache;
  private classifierChain: ClassifierChain;
  private modeSelector: ModeSelector;
  private complexityEvaluator: ComplexityEvaluator;
  private config: Required<UnifiedEntryConfig>;

  constructor(config?: UnifiedEntryConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.preprocessor = new InputPreprocessor();
    this.intentCache = new IntentCache();
    this.classifierChain = new ClassifierChain({
      debug: this.config.routerConfig?.debug,
    });
    this.modeSelector = new ModeSelector({
      debug: this.config.routerConfig?.debug,
    });
    this.complexityEvaluator = new ComplexityEvaluator({
      debug: this.config.routerConfig?.debug,
    });
  }

  /**
   * 路由请求
   */
  async route(request: UnifiedRequest): Promise<RouteResult> {
    const startTime = performance.now();
    const requestId = generateRequestId();

    // 创建追踪器
    const tracer = new DebugTracer(requestId, {
      userId: request.userId,
      sessionId: request.sessionId,
      originalMessage: request.message,
    });

    try {
      // 1. 预处理
      const preprocessed = await tracer.traceStage(
        "preprocessing",
        { message: request.message },
        () => this.preprocessor.process(request),
        (r) => (r.modified ? "消息已预处理" : "消息无需处理"),
      );

      // 2. 缓存查询
      let cacheHit: "L1" | "none" = "none";
      let cachedResult = null;

      if (this.config.enableCache) {
        tracer.startStage("cache_lookup");
        cachedResult = this.intentCache.get(
          preprocessed.message,
          request.userId,
        );
        if (cachedResult) {
          cacheHit = "L1";
        }
        tracer.endStage(
          "cache_lookup",
          { message: preprocessed.message },
          { hit: cacheHit },
          cacheHit === "L1" ? "L1 缓存命中" : "缓存未命中",
        );
      }

      // 3. 意图分类（如果缓存未命中）
      let classificationResult;
      if (cachedResult) {
        classificationResult = cachedResult;
      } else {
        const context: ClassificationContext = {
          userId: request.userId,
          sessionId: request.sessionId,
          selectedBookmarks: preprocessed.selectedBookmarks,
          folderId: preprocessed.folderId,
          recentMessages: preprocessed.recentMessages,
        };

        classificationResult = await tracer.traceStage(
          "intent",
          { message: preprocessed.message },
          () => this.classifierChain.classify(preprocessed.message, context),
          (r) =>
            `意图: ${r.intent}${r.subType ? `:${r.subType}` : ""}, 置信度: ${(r.confidence * 100).toFixed(0)}%`,
        );

        // 写入缓存
        if (this.config.enableCache) {
          this.intentCache.set(
            preprocessed.message,
            request.userId,
            classificationResult,
          );
        }
      }

      // 4. 转换为 IntentClassification
      const intent: IntentClassification = {
        type: classificationResult.intent,
        subType: classificationResult.subType,
        confidence: classificationResult.confidence,
        entities: classificationResult.entities,
        requiresMultiStep: this.isMultiStepType(classificationResult.intent),
        hasDeliverableExpectation: this.expectsDeliverable(
          classificationResult.intent,
          classificationResult.subType,
        ),
        source: cacheHit === "L1" ? "cache_l1" : "rule",
        reasoning: classificationResult.reasoning,
      };

      // 5. 复杂度评估
      const complexity = await tracer.traceStage(
        "complexity",
        { intent },
        async () =>
          this.complexityEvaluator.evaluate(intent, request.context ?? {}),
        (r) => `复杂度: ${r.level} (${r.score}分)`,
      );

      // 6. 模式选择
      const modeSelection = await tracer.traceStage(
        "routing",
        { intent, complexity },
        async () => this.modeSelector.select(intent, complexity),
        (r) => `模式: ${r.mode}, 原因: ${r.reason}`,
      );

      // 构建结果
      const routingDurationMs = Math.round(performance.now() - startTime);

      const result: RouteResult = {
        intent,
        complexity,
        mode: modeSelection.mode,
        suggestedSkill: null, // TODO: 从 modeSelection 获取
        reason: modeSelection.reason,
        routingDurationMs,
        cacheHit,
        preprocessedMessage: preprocessed.message,
        useReact: modeSelection.useReact,
        reactReason: modeSelection.reactReason,
      };

      // 设置追踪摘要
      tracer.setSummary({
        intent: intent.type,
        subType: intent.subType,
        confidence: intent.confidence,
        mode: modeSelection.mode,
        cacheHit,
        success: true,
      });

      // 输出追踪日志
      tracer.log();

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      tracer.setSummary({
        intent: "unknown",
        confidence: 0,
        mode: "atomic",
        cacheHit: "none",
        success: false,
        errorMessage,
      });

      tracer.log();

      logger.error(
        { error: errorMessage, requestId },
        "UnifiedEntry: Route failed",
      );

      // 返回降级结果
      return {
        intent: {
          type: "chitchat",
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
        },
        mode: "atomic",
        suggestedSkill: null,
        reason: "路由失败，使用降级策略",
        routingDurationMs: Math.round(performance.now() - startTime),
        cacheHit: "none",
      };
    }
  }

  /**
   * 判断是否需要多步骤
   */
  private isMultiStepType(type: string): boolean {
    return ["organize", "analyze", "learn"].includes(type);
  }

  /**
   * 判断是否期望交付物
   */
  private expectsDeliverable(type: string, subType?: string): boolean {
    if (["analyze", "create", "learn"].includes(type)) {
      return true;
    }
    const deliverableSubTypes = ["report", "digest", "path", "share", "review"];
    return subType ? deliverableSubTypes.includes(subType) : false;
  }

  /**
   * 获取分类器链（用于注册自定义分类器）
   */
  getClassifierChain(): ClassifierChain {
    return this.classifierChain;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.intentCache.getStats();
  }

  /**
   * 清理缓存
   */
  cleanupCache(): number {
    return this.intentCache.cleanup();
  }
}

// ============================================
// 单例和工厂函数
// ============================================

let entryInstance: UnifiedEntry | null = null;

/**
 * 获取统一入口单例
 */
export function getUnifiedEntry(config?: UnifiedEntryConfig): UnifiedEntry {
  if (!entryInstance) {
    entryInstance = new UnifiedEntry(config);
  }
  return entryInstance;
}

/**
 * 创建统一入口实例（非单例）
 */
export function createUnifiedEntry(config?: UnifiedEntryConfig): UnifiedEntry {
  return new UnifiedEntry(config);
}

/**
 * 重置单例（用于测试）
 */
export function resetUnifiedEntry(): void {
  entryInstance = null;
}
