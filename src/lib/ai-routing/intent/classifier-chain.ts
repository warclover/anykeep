/**
 * 分类器链实现
 *
 * 管理多个分类器，按优先级顺序执行，直到获得满意的结果
 *
 * 优先级顺序：规则 → 语义 → LLM
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import { logger } from "@/lib/logger";
import type {
  ClassificationContext,
  ClassifierResult,
  IntentType,
} from "../types";
import type {
  IntentClassifier,
  ClassifierChainConfig,
  ClassifierMetadata,
} from "./classifier-interface";
import { CONFIDENCE_THRESHOLDS } from "./classifier-interface";

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: Required<ClassifierChainConfig> = {
  minConfidenceThreshold: CONFIDENCE_THRESHOLDS.LOW,
  enableParallel: false,
  enableCache: true,
  debug: false,
};

// ============================================
// 并发控制配置
// ============================================

/**
 * 并发控制配置
 */
interface ParallelConfig {
  /** 最大并发数 */
  maxConcurrency: number;
  /** 单个分类器超时时间（毫秒） */
  timeoutMs: number;
}

const PARALLEL_CONFIG: ParallelConfig = {
  maxConcurrency: 3,
  timeoutMs: 5000,
};

/**
 * 带超时的 Promise 包装器
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
    ),
  ]);
}

// ============================================
// ClassifierChain 类
// ============================================

/**
 * 分类器链
 *
 * 按优先级顺序执行多个分类器，返回第一个置信度满足阈值的结果
 *
 * @example
 * ```typescript
 * const chain = new ClassifierChain();
 *
 * // 注册分类器（按优先级）
 * chain.register(new RuleBasedClassifier());     // priority: 10
 * chain.register(new SemanticClassifier());      // priority: 50
 * chain.register(new LLMClassifier());           // priority: 100
 *
 * // 执行分类
 * const result = await chain.classify(message, context);
 * ```
 */
export class ClassifierChain {
  private classifiers: IntentClassifier[] = [];
  private config: Required<ClassifierChainConfig>;

  constructor(config?: ClassifierChainConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 注册分类器
   *
   * 分类器按 priority 升序排列（数字越小优先级越高）
   */
  register(classifier: IntentClassifier): void {
    this.classifiers.push(classifier);
    this.classifiers.sort((a, b) => a.priority - b.priority);

    if (this.config.debug) {
      logger.debug(
        {
          classifier: classifier.name,
          priority: classifier.priority,
          totalClassifiers: this.classifiers.length,
        },
        "ClassifierChain: Classifier registered",
      );
    }
  }

  /**
   * 注销分类器
   */
  unregister(name: string): boolean {
    const index = this.classifiers.findIndex((c) => c.name === name);
    if (index !== -1) {
      this.classifiers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 执行分类
   *
   * 按优先级顺序尝试每个分类器，直到获得满意的结果
   */
  async classify(
    message: string,
    context: ClassificationContext,
  ): Promise<ClassifierResult> {
    const startTime = performance.now();

    for (const classifier of this.classifiers) {
      // 预检：判断分类器是否能处理
      if (!classifier.canHandle(message, context)) {
        if (this.config.debug) {
          logger.debug(
            { classifier: classifier.name },
            "ClassifierChain: Classifier skipped (canHandle=false)",
          );
        }
        continue;
      }

      try {
        // 执行分类
        const result = await classifier.classify(message, context);

        // 检查置信度是否满足阈值
        if (result.confidence >= this.config.minConfidenceThreshold) {
          // 应用校准（如果有）
          const calibrated = classifier.calibrate?.(result) ?? result;

          // 添加分类器信息到结果
          const finalResult: ClassifierResult = {
            ...calibrated,
            reasoning:
              `[${classifier.name}] ${calibrated.reasoning ?? ""}`.trim(),
          };

          if (this.config.debug) {
            logger.debug(
              {
                classifier: classifier.name,
                intent: finalResult.intent,
                subType: finalResult.subType,
                confidence: finalResult.confidence,
                durationMs: Math.round(performance.now() - startTime),
              },
              "ClassifierChain: Classification succeeded",
            );
          }

          return finalResult;
        }

        // 置信度不足，继续尝试下一个分类器
        if (this.config.debug) {
          logger.debug(
            {
              classifier: classifier.name,
              confidence: result.confidence,
              threshold: this.config.minConfidenceThreshold,
            },
            "ClassifierChain: Confidence below threshold, trying next",
          );
        }
      } catch (error) {
        // 分类器执行失败，记录日志并继续
        logger.warn(
          {
            classifier: classifier.name,
            error: error instanceof Error ? error.message : String(error),
          },
          "ClassifierChain: Classifier failed, trying next",
        );
      }
    }

    // 所有分类器都未能提供满意结果，返回降级结果
    if (this.config.debug) {
      logger.debug(
        {
          classifierCount: this.classifiers.length,
          durationMs: Math.round(performance.now() - startTime),
        },
        "ClassifierChain: All classifiers failed, using fallback",
      );
    }

    return this.fallbackResult(message);
  }

  /**
   * 并行分类（可选）
   *
   * 同时执行所有分类器，选择置信度最高的结果
   * 包含并发控制和超时机制
   */
  async classifyParallel(
    message: string,
    context: ClassificationContext,
  ): Promise<ClassifierResult> {
    const startTime = performance.now();

    // 过滤出能处理的分类器
    const eligibleClassifiers = this.classifiers.filter((c) =>
      c.canHandle(message, context),
    );

    if (eligibleClassifiers.length === 0) {
      return this.fallbackResult(message);
    }

    // 并发控制：分批执行
    const batchSize = PARALLEL_CONFIG.maxConcurrency;
    const allResults: Array<{
      classifier: IntentClassifier;
      result: ClassifierResult;
    }> = [];

    for (let i = 0; i < eligibleClassifiers.length; i += batchSize) {
      const batch = eligibleClassifiers.slice(i, i + batchSize);

      // 带超时的并行执行
      const batchResults = await Promise.allSettled(
        batch.map((c) =>
          withTimeout(
            c.classify(message, context),
            PARALLEL_CONFIG.timeoutMs,
            `Classifier ${c.name} timed out after ${PARALLEL_CONFIG.timeoutMs}ms`,
          ),
        ),
      );

      // 收集成功的结果
      batchResults.forEach((r, index) => {
        if (r.status === "fulfilled") {
          allResults.push({
            classifier: batch[index],
            result: r.value,
          });
        } else if (this.config.debug) {
          logger.debug(
            {
              classifier: batch[index].name,
              error:
                r.reason instanceof Error ? r.reason.message : String(r.reason),
            },
            "ClassifierChain: Parallel classifier failed or timed out",
          );
        }
      });
    }

    if (allResults.length === 0) {
      return this.fallbackResult(message);
    }

    // 按置信度排序，选择最高的
    allResults.sort((a, b) => b.result.confidence - a.result.confidence);
    const best = allResults[0];

    // 应用校准
    const calibrated = best.classifier.calibrate?.(best.result) ?? best.result;

    if (this.config.debug) {
      logger.debug(
        {
          classifier: best.classifier.name,
          intent: calibrated.intent,
          confidence: calibrated.confidence,
          candidateCount: allResults.length,
          durationMs: Math.round(performance.now() - startTime),
        },
        "ClassifierChain: Parallel classification completed",
      );
    }

    return {
      ...calibrated,
      reasoning:
        `[${best.classifier.name}] ${calibrated.reasoning ?? ""}`.trim(),
    };
  }

  /**
   * 降级结果
   */
  private fallbackResult(message: string): ClassifierResult {
    // 简单启发式：如果包含问号，倾向于 query
    const hasQuestion = message.includes("?") || message.includes("？");

    // 使用类型安全的方式定义 intent
    const fallbackIntent: IntentType = hasQuestion ? "query" : "chitchat";

    return {
      intent: fallbackIntent,
      subType: "general",
      confidence: 0.3,
      entities: [],
      reasoning: "Fallback: no classifier matched",
    };
  }

  /**
   * 获取所有分类器的元数据
   */
  getClassifiersMetadata(): ClassifierMetadata[] {
    return this.classifiers.map((c, index) => ({
      id: `classifier_${index}`,
      name: c.name,
      type: this.inferClassifierType(c.name),
      priority: c.priority,
      enabled: true,
    }));
  }

  /**
   * 推断分类器类型
   */
  private inferClassifierType(
    name: string,
  ): "rule" | "semantic" | "llm" | "hybrid" {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("rule")) return "rule";
    if (nameLower.includes("semantic")) return "semantic";
    if (nameLower.includes("llm")) return "llm";
    return "hybrid";
  }

  /**
   * 获取分类器数量
   */
  get size(): number {
    return this.classifiers.length;
  }

  /**
   * 清空所有分类器
   */
  clear(): void {
    this.classifiers = [];
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建分类器链实例
 */
export function createClassifierChain(
  config?: ClassifierChainConfig,
): ClassifierChain {
  return new ClassifierChain(config);
}
