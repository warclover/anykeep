/**
 * HybridIntentClassifier - 混合意图分类器
 *
 * @deprecated 自 v2.8.3 起废弃
 * 请使用 `IntentAnalyzer` 作为统一的意图分析入口。
 * IntentAnalyzer 已整合语义匹配和 LLM 分类能力。
 *
 * @see IntentAnalyzer - 推荐使用的统一意图分析器
 *
 * 迁移指南:
 * ```typescript
 * // 旧代码
 * const classifier = new HybridIntentClassifier();
 * const result = await classifier.classify(message, context);
 *
 * // 新代码
 * const analyzer = new IntentAnalyzer();
 * const result = await analyzer.analyze(message, context);
 * ```
 *
 * 职责：
 * - 结合规则匹配（快速）和语义匹配（精准）
 * - 融合两种匹配结果，提升准确率
 * - 支持口语化、模糊表达
 *
 * 策略：
 * 1. Fast Track: 规则匹配 + 槽位提取（≤200ms）
 * 2. Slow Track: 语义匹配 + LLM 验证（≤1500ms）
 * 3. 超时回退：Slow Track 超时自动回退到 Fast Track 结果
 *
 * Code Review P1-1: 添加 Slow Track 超时取消机制
 * - 使用 AbortController 取消超时的操作
 * - 避免资源浪费（LLM 调用、Embedding 计算）
 *
 * @version 1.3.0
 * @since 2026-01-09
 * @updated 2026-01-11 - 标记为废弃，推荐使用 IntentAnalyzer
 */

import { logger } from "@/lib/logger";
import type {
  IntentClassification,
  IntentType,
  IntentClassifierConfig,
  IntentRule,
  IntentSlot,
} from "./types";
import { IntentClassifier } from "./intent-classifier";
import {
  SemanticIntentMatcher,
  type SemanticMatch,
} from "./semantic-intent-matcher";
import { LLMIntentClassifier } from "./llm-classifier";
import { getSlotDefinition } from "./slot-schemas";
import { ContextEnhancer } from "./context-enhancer";

// ============================================
// Fast/Slow Track 配置（符合主方案规范）
// ============================================

/**
 * Fast Track 配置
 * - 规则匹配 + 槽位提取
 * - 高置信度直接返回，跳过 Slow Track
 */
export const FAST_TRACK_CONFIG = {
  /** 最大延迟（毫秒） */
  maxLatency: 200,
  /** 最小置信度（高于此值直接返回，跳过 Slow Track） */
  minConfidence: 0.7,
  /** 延迟告警阈值（毫秒） */
  warnThreshold: 50,
} as const;

/**
 * Slow Track 配置
 * - 语义匹配 + LLM 分类
 * - 超时自动回退到 Fast Track 结果
 */
export const SLOW_TRACK_CONFIG = {
  /** 最大延迟（毫秒） */
  maxLatency: 1500,
  /** 是否启用 LLM */
  enableLLM: true,
  /** 超时是否回退到 Fast Track */
  fallbackToFast: true,
} as const;

/**
 * 混合分类上下文
 */
export interface ClassificationContext {
  /** 用户输入 */
  input: string;
  /** 对话历史（可选） */
  messageHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  /** 已选中的书签 ID 列表（可选） */
  selectedBookmarks?: number[];
  /** 当前文件夹 ID（可选） */
  currentFolder?: number;
}

/**
 * 歧义槽位（符合主方案 IntentWithSlots 规范）
 */
export interface AmbiguousSlot {
  /** 槽位名称 */
  slot: string;
  /** 候选值列表 */
  candidates: string[];
  /** 消歧时的问题 */
  question: string;
}

/**
 * 混合分类结果（符合主方案 IntentWithSlots 规范）
 */
export interface HybridIntentMatch extends IntentClassification {
  /** 匹配方法 */
  method: "rule" | "semantic" | "hybrid" | "llm";
  /** 缺失的必需槽位（主方案要求） */
  missingRequiredSlots: string[];
  /** 歧义槽位（主方案要求） */
  ambiguousSlots: AmbiguousSlot[];
  /** 调试信息 */
  debugInfo?: {
    ruleConfidence?: number;
    semanticSimilarity?: number;
    fusionStrategy?: string;
    llmConfidence?: number;
    reasoning?: string;
    /** Fast Track 延迟 */
    fastTrackDurationMs?: number;
    /** Slow Track 延迟 */
    slowTrackDurationMs?: number;
    /** 是否超时回退 */
    slowTrackTimeout?: boolean;
  };
}

/**
 * 混合意图分类器配置
 */
export interface HybridIntentClassifierConfig extends IntentClassifierConfig {
  /** 是否启用语义匹配（默认 true） */
  enableSemanticMatching?: boolean;
  /** 语义匹配相似度阈值（默认 0.7） */
  semanticThreshold?: number;
  /** 规则匹配高置信度阈值（默认 0.7） */
  ruleHighConfidenceThreshold?: number;
  /** 语义覆盖规则的最小相似度差值（默认 0.15） */
  semanticOverrideThreshold?: number;
}

/**
 * 混合意图分类器
 */
export class HybridIntentClassifier {
  private ruleClassifier: IntentClassifier;
  private semanticMatcher: SemanticIntentMatcher | null = null;
  private llmClassifier: LLMIntentClassifier | null = null;
  private contextEnhancer: ContextEnhancer;
  private config: HybridIntentClassifierConfig & {
    enableEntityExtraction: boolean;
    llmTimeoutMs: number;
    llmFallbackThreshold: number;
    enableLLMFallback: boolean;
    debug: boolean;
    enableSemanticMatching: boolean;
    semanticThreshold: number;
    ruleHighConfidenceThreshold: number;
    semanticOverrideThreshold: number;
    customRules: IntentRule[];
    disambiguationThreshold: number;
  };

  constructor(config: HybridIntentClassifierConfig = {}) {
    // 构建基础配置（不包含 llmClassifierConfig）
    const baseConfig: Omit<
      Required<HybridIntentClassifierConfig>,
      "llmClassifierConfig"
    > = {
      enableEntityExtraction: config.enableEntityExtraction ?? true,
      llmTimeoutMs: config.llmTimeoutMs ?? 5000,
      llmFallbackThreshold: config.llmFallbackThreshold ?? 0.6,
      enableLLMFallback: config.enableLLMFallback ?? false,
      debug: config.debug ?? false,
      enableSemanticMatching: config.enableSemanticMatching ?? true,
      semanticThreshold: config.semanticThreshold ?? 0.7,
      ruleHighConfidenceThreshold: config.ruleHighConfidenceThreshold ?? 0.7,
      semanticOverrideThreshold: config.semanticOverrideThreshold ?? 0.15,
      customRules: config.customRules ?? [],
      disambiguationThreshold: config.disambiguationThreshold ?? 0.15,
    };

    // 如果提供了 llmClassifierConfig，添加到配置中
    this.config = {
      ...baseConfig,
      ...(config.llmClassifierConfig && {
        llmClassifierConfig: config.llmClassifierConfig,
      }),
    } as Required<HybridIntentClassifierConfig>;

    // 初始化规则分类器
    this.ruleClassifier = new IntentClassifier({
      enableEntityExtraction: this.config.enableEntityExtraction,
      llmTimeoutMs: this.config.llmTimeoutMs,
      llmFallbackThreshold: this.config.llmFallbackThreshold,
      enableLLMFallback: this.config.enableLLMFallback,
      debug: this.config.debug,
      customRules: config.customRules,
      llmClassifierConfig: config.llmClassifierConfig,
    });

    // 初始化语义匹配器（如果启用）
    if (this.config.enableSemanticMatching) {
      this.semanticMatcher = new SemanticIntentMatcher({
        similarityThreshold: this.config.semanticThreshold,
        enableCache: true,
        debug: this.config.debug,
      });
    }

    // 初始化上下文增强器
    this.contextEnhancer = new ContextEnhancer();
  }

  /**
   * 预计算语义匹配的 Embedding
   * 应在应用启动时调用一次
   *
   * @param rules - 意图规则列表（必须提供，通常从 DEFAULT_RULES 导入）
   */
  async initialize(rules: IntentRule[]): Promise<void> {
    if (!this.semanticMatcher) {
      return;
    }

    if (!rules || rules.length === 0) {
      logger.warn(
        "HybridIntentClassifier: No rules provided for precomputation",
      );
      return;
    }

    await this.semanticMatcher.precomputeEmbeddings(rules);
  }

  /**
   * 混合分类策略（符合主方案 Fast/Slow Track 规范）
   *
   * @param input - 用户输入
   * @param context - 分类上下文
   * @returns 意图分类结果
   */
  async classify(
    input: string,
    context: ClassificationContext = { input },
  ): Promise<HybridIntentMatch> {
    // ========== Fast Track: 规则匹配 ==========
    const fastTrackStart = performance.now();
    const ruleMatch = await this.ruleClassifier.classify(input);
    const fastTrackDurationMs = Math.round(performance.now() - fastTrackStart);

    // Fast Track 延迟监控
    if (fastTrackDurationMs > FAST_TRACK_CONFIG.warnThreshold) {
      logger.warn(
        {
          durationMs: fastTrackDurationMs,
          threshold: FAST_TRACK_CONFIG.warnThreshold,
          input: input.substring(0, 50),
        },
        "HybridIntentClassifier: Fast Track exceeded warn threshold",
      );
    }

    // 计算缺失槽位
    const missingRequiredSlots = this.calculateMissingSlots(
      ruleMatch.type,
      ruleMatch.subType,
      ruleMatch.slots?.slots || {},
    );

    // 高置信度 + 槽位完整 → 直接返回（Fast Track 命中）
    if (
      ruleMatch.confidence >= FAST_TRACK_CONFIG.minConfidence &&
      missingRequiredSlots.length === 0
    ) {
      if (this.config.debug) {
        logger.debug(
          {
            input: input.substring(0, 50),
            intent: ruleMatch.type,
            subType: ruleMatch.subType,
            confidence: ruleMatch.confidence,
            method: "rule",
            fastTrackDurationMs,
          },
          "HybridIntentClassifier: Fast Track hit (high confidence + complete slots)",
        );
      }

      return {
        ...ruleMatch,
        method: "rule",
        missingRequiredSlots: [],
        ambiguousSlots: [],
        debugInfo: {
          ruleConfidence: ruleMatch.confidence,
          fastTrackDurationMs,
        },
      };
    }

    // ========== Slow Track: 语义匹配 + LLM ==========
    const slowTrackStart = performance.now();

    // P1-1: 使用 AbortController 实现真正的超时取消
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, SLOW_TRACK_CONFIG.maxLatency);

    let slowResult: HybridIntentMatch | null = null;
    let slowTrackTimeout = false;

    try {
      slowResult = await this.runSlowTrack(
        input,
        ruleMatch,
        context,
        controller.signal,
      );
    } catch (error) {
      // 检查是否为取消错误
      if (error instanceof Error && error.name === "AbortError") {
        slowTrackTimeout = true;
        if (this.config.debug) {
          logger.debug(
            { input: input.substring(0, 50) },
            "HybridIntentClassifier: Slow Track aborted due to timeout",
          );
        }
      } else {
        // 其他错误，记录日志
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            input: input.substring(0, 50),
          },
          "HybridIntentClassifier: Slow Track error",
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }

    const slowTrackDurationMs = Math.round(performance.now() - slowTrackStart);

    // 超时回退到 Fast Track 结果
    if (slowTrackTimeout && SLOW_TRACK_CONFIG.fallbackToFast) {
      if (this.config.debug) {
        logger.warn(
          {
            input: input.substring(0, 50),
            slowTrackDurationMs,
            maxLatency: SLOW_TRACK_CONFIG.maxLatency,
          },
          "HybridIntentClassifier: Slow Track timeout, fallback to Fast Track",
        );
      }

      return {
        ...ruleMatch,
        method: "rule",
        missingRequiredSlots,
        ambiguousSlots: [],
        debugInfo: {
          ruleConfidence: ruleMatch.confidence,
          fastTrackDurationMs,
          slowTrackDurationMs,
          slowTrackTimeout: true,
          fusionStrategy: "timeout_fallback",
        },
      };
    }

    // Slow Track 成功返回结果
    if (slowResult) {
      if (this.config.debug) {
        logger.debug(
          {
            input: input.substring(0, 50),
            method: slowResult.method,
            confidence: slowResult.confidence,
            fastTrackDurationMs,
            slowTrackDurationMs,
          },
          "HybridIntentClassifier: Slow Track completed",
        );
      }
      return {
        ...slowResult,
        debugInfo: {
          ...slowResult.debugInfo,
          fastTrackDurationMs,
          slowTrackDurationMs,
        },
      };
    }

    // 兜底：返回 Fast Track 结果
    return {
      ...ruleMatch,
      method: "rule",
      missingRequiredSlots,
      ambiguousSlots: [],
      debugInfo: {
        ruleConfidence: ruleMatch.confidence,
        fastTrackDurationMs,
      },
    };
  }

  /**
   * Slow Track: 语义匹配 + LLM 分类
   *
   * 优化: 缓存语义匹配结果，避免重复调用 (Code Review #3)
   * P1-1: 添加 AbortSignal 支持，实现真正的超时取消
   *
   * @param input - 用户输入
   * @param ruleMatch - 规则匹配结果
   * @param context - 分类上下文
   * @param signal - 取消信号
   */
  private async runSlowTrack(
    input: string,
    ruleMatch: IntentClassification,
    context: ClassificationContext,
    signal?: AbortSignal,
  ): Promise<HybridIntentMatch | null> {
    try {
      // 检查是否已取消
      if (signal?.aborted) {
        throw new DOMException("Slow Track aborted", "AbortError");
      }

      // 1. 语义匹配（如果启用）- 缓存结果避免重复调用
      let semanticMatches: SemanticMatch[] = [];
      let fusedResult: HybridIntentMatch | null = null;

      if (this.semanticMatcher) {
        // P1-1: 传递 signal 给语义匹配器
        semanticMatches = await this.semanticMatcher.match(input, { signal });

        // 再次检查是否已取消
        if (signal?.aborted) {
          throw new DOMException("Slow Track aborted", "AbortError");
        }

        fusedResult = this.fuseResults(ruleMatch, semanticMatches, input);

        // 如果融合结果置信度足够高，直接返回
        if (fusedResult.confidence >= FAST_TRACK_CONFIG.minConfidence) {
          return fusedResult;
        }
      }

      // 2. LLM 兜底（如果启用且规则置信度很低）
      if (
        SLOW_TRACK_CONFIG.enableLLM &&
        this.config.enableLLMFallback &&
        ruleMatch.confidence < this.config.llmFallbackThreshold
      ) {
        // P1-1: 传递 signal 给 LLM 分类器
        return await this.runLLMClassification(
          input,
          ruleMatch,
          context,
          signal,
        );
      }

      // 3. 返回已缓存的融合结果（避免重复调用语义匹配）
      return fusedResult;
    } catch (error) {
      // 重新抛出取消错误
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      logger.warn(
        { error, input: input.substring(0, 50) },
        "HybridIntentClassifier: Slow Track failed",
      );
      return null;
    }
  }

  /**
   * LLM 分类（带槽位提取）
   *
   * P1-1: 添加 AbortSignal 支持
   *
   * @param input - 用户输入
   * @param ruleMatch - 规则匹配结果
   * @param context - 分类上下文
   * @param signal - 取消信号
   */
  private async runLLMClassification(
    input: string,
    ruleMatch: IntentClassification,
    context: ClassificationContext,
    signal?: AbortSignal,
  ): Promise<HybridIntentMatch | null> {
    // 检查是否已取消
    if (signal?.aborted) {
      throw new DOMException("LLM classification aborted", "AbortError");
    }

    // 初始化 LLM 分类器
    if (!this.llmClassifier) {
      this.llmClassifier = new LLMIntentClassifier({
        ...this.config.llmClassifierConfig,
        timeoutMs: SLOW_TRACK_CONFIG.maxLatency, // 使用 Slow Track 超时
        enableSlotExtraction: true,
        debug: this.config.debug,
      });
    }

    try {
      // P1-1: 传递 signal 给 LLM 分类器
      const llmResult = await this.llmClassifier.classifyWithSlots(
        input,
        context,
        { signal },
      );

      if (!llmResult || llmResult.confidence <= ruleMatch.confidence) {
        return null;
      }

      // 转换槽位格式
      let convertedSlots: Record<string, IntentSlot> = {};
      if (llmResult.slots) {
        const slotDefinition = getSlotDefinition(
          llmResult.type,
          llmResult.subType,
        );
        const requiredSlots = slotDefinition?.required || [];
        for (const [slotName, slotData] of Object.entries(llmResult.slots)) {
          convertedSlots[slotName] = {
            name: slotName,
            value: slotData.value,
            type: slotData.type,
            confidence: slotData.confidence,
            required: requiredSlots.includes(slotName),
            source: slotData.source,
          };
        }
      }

      // 上下文增强
      const enhancement = this.contextEnhancer.enhanceSlots(
        convertedSlots,
        llmResult.type,
        llmResult.subType,
        context,
      );
      convertedSlots = enhancement.slots;

      // 验证槽位完整性
      const validation = this.contextEnhancer.validateCompleteness(
        llmResult.type,
        llmResult.subType,
        convertedSlots,
      );

      // 计算缺失槽位
      const missingRequiredSlots = this.calculateMissingSlots(
        llmResult.type,
        llmResult.subType,
        convertedSlots,
      );

      return {
        type: llmResult.type,
        subType: llmResult.subType,
        confidence: llmResult.confidence,
        entities: [],
        requiresMultiStep: this.isMultiStepByType(llmResult.type),
        hasDeliverableExpectation: this.expectsDeliverableByType(
          llmResult.type,
          llmResult.subType,
        ),
        source: "llm",
        slots: {
          intentType: (llmResult.subType
            ? `${llmResult.type}:${llmResult.subType}`
            : `${llmResult.type}:*`) as `${typeof llmResult.type}:${string}`,
          slots: convertedSlots,
          completeness: validation.completeness,
        },
        method: "llm",
        missingRequiredSlots,
        ambiguousSlots: [],
        debugInfo: {
          ruleConfidence: ruleMatch.confidence,
          llmConfidence: llmResult.confidence,
          reasoning: llmResult.reasoning,
        },
      };
    } catch (error) {
      logger.warn(
        { error, input: input.substring(0, 50) },
        "HybridIntentClassifier: LLM classification failed",
      );
      return null;
    }
  }

  /**
   * 计算缺失的必需槽位
   */
  private calculateMissingSlots(
    intentType: IntentType,
    subType: string | undefined,
    slots: Record<string, IntentSlot>,
  ): string[] {
    const slotDefinition = getSlotDefinition(intentType, subType);
    if (!slotDefinition) {
      return [];
    }

    return slotDefinition.required.filter((slotName) => !(slotName in slots));
  }

  /**
   * 结果融合策略
   */
  private fuseResults(
    ruleMatch: IntentClassification,
    semanticMatches: SemanticMatch[],
    _input: string,
  ): HybridIntentMatch {
    const topSemantic = semanticMatches[0];

    // 计算缺失槽位（基于当前最佳匹配）
    const calculateMissing = (type: IntentType, subType?: string) => {
      return this.calculateMissingSlots(
        type,
        subType,
        ruleMatch.slots?.slots || {},
      );
    };

    // 情况 1: 规则和语义匹配结果一致，提升置信度
    if (
      topSemantic &&
      ruleMatch.type === topSemantic.type &&
      ruleMatch.subType === topSemantic.subType
    ) {
      const boostedConfidence = Math.min(
        0.95,
        ruleMatch.confidence + topSemantic.similarity * 0.2,
      );

      return {
        ...ruleMatch,
        confidence: boostedConfidence,
        method: "hybrid",
        missingRequiredSlots: calculateMissing(
          ruleMatch.type,
          ruleMatch.subType,
        ),
        ambiguousSlots: [],
        debugInfo: {
          ruleConfidence: ruleMatch.confidence,
          semanticSimilarity: topSemantic.similarity,
          fusionStrategy: "agree_boost",
        },
      };
    }

    // 情况 2: 语义匹配明显更优，使用语义结果
    if (
      topSemantic &&
      topSemantic.similarity >
        ruleMatch.confidence + this.config.semanticOverrideThreshold
    ) {
      return {
        type: topSemantic.type,
        subType: topSemantic.subType,
        confidence: topSemantic.similarity,
        entities: ruleMatch.entities,
        requiresMultiStep: this.isMultiStepByType(topSemantic.type),
        hasDeliverableExpectation: this.expectsDeliverableByType(
          topSemantic.type,
          topSemantic.subType,
        ),
        source: "semantic",
        method: "semantic",
        missingRequiredSlots: calculateMissing(
          topSemantic.type,
          topSemantic.subType,
        ),
        ambiguousSlots: [],
        debugInfo: {
          ruleConfidence: ruleMatch.confidence,
          semanticSimilarity: topSemantic.similarity,
          fusionStrategy: "semantic_override",
        },
      };
    }

    // 情况 3: 否则使用规则匹配结果
    return {
      ...ruleMatch,
      method: "rule",
      missingRequiredSlots: calculateMissing(ruleMatch.type, ruleMatch.subType),
      ambiguousSlots: [],
      debugInfo: {
        ruleConfidence: ruleMatch.confidence,
        semanticSimilarity: topSemantic?.similarity,
        fusionStrategy: "rule_fallback",
      },
    };
  }

  /**
   * 推断复杂度
   */
  private inferComplexity(
    type: IntentType,
    _subType?: string,
  ): "simple" | "medium" | "complex" {
    // 基于意图类型推断复杂度
    const complexTypes: IntentType[] = ["organize", "learn", "create"];
    const mediumTypes: IntentType[] = ["analyze", "action"];

    if (complexTypes.includes(type)) {
      return "complex";
    }

    if (mediumTypes.includes(type)) {
      return "medium";
    }

    return "simple";
  }

  /**
   * 判断是否需要多步骤处理
   */
  private isMultiStepByType(type: IntentType): boolean {
    const multiStepTypes: IntentType[] = [
      "organize",
      "learn",
      "create",
      "analyze",
    ];
    return multiStepTypes.includes(type);
  }

  /**
   * 判断是否期望获得交付物
   */
  private expectsDeliverableByType(
    type: IntentType,
    _subType?: string,
  ): boolean {
    const deliverableTypes: IntentType[] = ["create", "analyze", "learn"];
    return deliverableTypes.includes(type);
  }

  /**
   * 获取语义匹配器状态
   */
  getSemanticMatcherStatus(): {
    initialized: boolean;
    intentCount: number;
  } {
    if (!this.semanticMatcher) {
      return { initialized: false, intentCount: 0 };
    }

    return {
      initialized: this.semanticMatcher.getIsInitialized(),
      intentCount: this.semanticMatcher.getInitializedCount(),
    };
  }
}
