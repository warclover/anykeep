/**
 * LearningAwareClassifier - 学习感知分类器
 *
 * 职责：
 * - 包装现有分类器，应用学习纠正
 * - 在分类前查找相似的历史纠正
 * - 记录分类结果用于后续学习
 *
 * 工作流程：
 * 1. 查找相似的历史纠正
 * 2. 如果找到高置信度匹配，直接使用学习结果
 * 3. 否则调用原始分类器
 * 4. 返回包含学习信息的分类结果
 *
 * @module ai-learning
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import type { CorrectionLearner } from "./correction-learner";
import { createCorrectionLearner } from "./correction-learner";
import type { CorrectionDetector } from "./correction-detector";
import { createCorrectionDetector } from "./correction-detector";
import type {
  IntentType,
  ClassificationRequest,
  ClassificationResponse,
  LearningResult,
  ConversationState,
  AIOutput,
} from "./types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 原始分类器接口
 */
export interface OriginalClassifier {
  classify(input: string): Promise<{
    intent: IntentType;
    confidence: number;
  }>;
}

/**
 * 学习感知分类器配置
 */
export interface LearningAwareClassifierConfig {
  /** 学习覆盖阈值（相似度 > 此值时使用学习结果） */
  learningOverrideThreshold?: number;
  /** 是否启用学习 */
  enableLearning?: boolean;
  /** 原始分类器 */
  originalClassifier?: OriginalClassifier;
}

/**
 * 内部配置类型（originalClassifier 保持可选）
 */
interface InternalConfig {
  learningOverrideThreshold: number;
  enableLearning: boolean;
  originalClassifier?: OriginalClassifier;
}

// =============================================================================
// LearningAwareClassifier 类
// =============================================================================

export class LearningAwareClassifier {
  private readonly learner: CorrectionLearner;
  private readonly detector: CorrectionDetector;
  private readonly config: InternalConfig;
  private originalClassifier?: OriginalClassifier;

  constructor(config?: LearningAwareClassifierConfig) {
    this.learner = createCorrectionLearner();
    this.detector = createCorrectionDetector();
    this.config = {
      learningOverrideThreshold: config?.learningOverrideThreshold ?? 0.85,
      enableLearning: config?.enableLearning ?? true,
      originalClassifier: config?.originalClassifier,
    };
    this.originalClassifier = config?.originalClassifier;
  }

  /**
   * 设置原始分类器
   */
  setOriginalClassifier(classifier: OriginalClassifier): void {
    this.originalClassifier = classifier;
  }

  /**
   * 分类用户输入（带学习增强）
   */
  async classify(
    request: ClassificationRequest,
  ): Promise<ClassificationResponse> {
    const startTime = Date.now();

    logger.debug(
      {
        userId: request.userId,
        inputPreview: request.input.substring(0, 50),
        enableLearning: request.enableLearning ?? this.config.enableLearning,
      },
      "LearningAwareClassifier: Starting classification",
    );

    // 检查是否启用学习
    const enableLearning = request.enableLearning ?? this.config.enableLearning;

    // 1. 查找相似的历史纠正
    let learningResult: LearningResult = { applied: false };

    if (enableLearning) {
      const similarResult = await this.learner.findSimilarCorrection({
        input: request.input,
        userId: request.userId,
        similarityThreshold: this.config.learningOverrideThreshold,
      });

      if (similarResult.success && similarResult.data) {
        const similar = similarResult.data;

        logger.info(
          {
            correctionId: similar.id,
            similarity: similar.similarity,
            correctIntent: similar.correctIntent,
          },
          "LearningAwareClassifier: Found similar correction, applying learning",
        );

        // 记录学习应用
        await this.learner.recordApplication(similar.id);

        learningResult = {
          applied: true,
          correctionId: similar.id,
          adjustedIntent: similar.correctIntent,
          adjustmentConfidence: similar.similarity,
        };

        // 如果相似度足够高，直接返回学习结果
        if (similar.similarity >= this.config.learningOverrideThreshold) {
          return {
            intent: similar.correctIntent,
            confidence: similar.similarity,
            learning: learningResult,
          };
        }
      }
    }

    // 2. 调用原始分类器
    let originalIntent: IntentType = "chitchat";
    let originalConfidence = 0;

    if (this.originalClassifier) {
      const originalResult = await this.originalClassifier.classify(
        request.input,
      );
      originalIntent = originalResult.intent;
      originalConfidence = originalResult.confidence;
    } else {
      // 如果没有原始分类器，使用简单的关键词匹配
      const simpleResult = this.simpleClassify(request.input);
      originalIntent = simpleResult.intent;
      originalConfidence = simpleResult.confidence;
    }

    // 3. 决定最终结果
    let finalIntent = originalIntent;
    let finalConfidence = originalConfidence;

    if (learningResult.applied && learningResult.adjustedIntent) {
      // 如果有学习结果但相似度不够高，根据置信度混合
      if (
        (learningResult.adjustmentConfidence ?? 0) > originalConfidence &&
        (learningResult.adjustmentConfidence ?? 0) >= 0.7
      ) {
        finalIntent = learningResult.adjustedIntent;
        finalConfidence = learningResult.adjustmentConfidence ?? 0;
        learningResult.originalConfidence = originalConfidence;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      {
        finalIntent,
        finalConfidence,
        learningApplied: learningResult.applied,
        durationMs: duration,
      },
      "LearningAwareClassifier: Classification complete",
    );

    return {
      intent: finalIntent,
      confidence: finalConfidence,
      learning: learningResult,
      originalIntent: learningResult.applied ? originalIntent : undefined,
    };
  }

  /**
   * 处理纠正信号
   */
  async handleCorrection(
    currentInput: string,
    previousOutput: AIOutput,
    context: ConversationState,
    correctIntent?: IntentType,
  ): Promise<{ recorded: boolean; correctionId?: string }> {
    // 1. 检测是否为纠正
    const detection = this.detector.detect(
      currentInput,
      previousOutput,
      context,
    );

    if (!detection.isCorrection || !detection.signal) {
      return { recorded: false };
    }

    // 2. 确定正确意图
    const finalCorrectIntent =
      correctIntent ||
      detection.signal.inferredCorrectIntent ||
      this.inferFromContext(currentInput, previousOutput.intent);

    if (!finalCorrectIntent || finalCorrectIntent === previousOutput.intent) {
      logger.debug(
        { wrongIntent: previousOutput.intent },
        "LearningAwareClassifier: Could not determine correct intent",
      );
      return { recorded: false };
    }

    // 3. 记录纠正
    const result = await this.learner.recordCorrection({
      userId: context.conversationId.split("_")[0] || "unknown", // 从会话 ID 提取用户 ID
      originalMessage: context.lastUserInput || currentInput,
      wrongIntent: previousOutput.intent,
      correctIntent: finalCorrectIntent,
      signal: detection.signal,
    });

    if (result.success && result.data) {
      logger.info(
        {
          correctionId: result.data.id,
          wrongIntent: previousOutput.intent,
          correctIntent: finalCorrectIntent,
        },
        "LearningAwareClassifier: Correction recorded",
      );
      return { recorded: true, correctionId: result.data.id };
    }

    return { recorded: false };
  }

  /**
   * 从负面反馈记录纠正
   */
  async handleNegativeFeedback(
    userId: string,
    originalInput: string,
    wrongIntent: IntentType,
    correctIntent?: IntentType,
    feedbackReason?: string,
  ): Promise<{ recorded: boolean; correctionId?: string }> {
    // 创建负面反馈信号
    const signal = this.detector.createFromNegativeFeedback(
      originalInput,
      wrongIntent,
      feedbackReason,
    );

    // 如果没有明确的正确意图，尝试从反馈原因推断
    const finalCorrectIntent =
      correctIntent || this.inferFromFeedback(feedbackReason, wrongIntent);

    if (!finalCorrectIntent || finalCorrectIntent === wrongIntent) {
      logger.debug(
        { wrongIntent, feedbackReason },
        "LearningAwareClassifier: Could not determine correct intent from feedback",
      );
      return { recorded: false };
    }

    // 记录纠正
    const result = await this.learner.recordCorrection({
      userId,
      originalMessage: originalInput,
      wrongIntent,
      correctIntent: finalCorrectIntent,
      signal,
    });

    if (result.success && result.data) {
      logger.info(
        {
          correctionId: result.data.id,
          wrongIntent,
          correctIntent: finalCorrectIntent,
        },
        "LearningAwareClassifier: Negative feedback recorded as correction",
      );
      return { recorded: true, correctionId: result.data.id };
    }

    return { recorded: false };
  }

  /**
   * 获取学习统计
   */
  async getStats(userId: string) {
    return this.learner.getStats(userId);
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 简单分类（备用）
   *
   * 注意：IntentType 统一使用 router/types 定义
   * 完整类型：query | action | organize | analyze | learn | create | chitchat
   */
  private simpleClassify(input: string): {
    intent: IntentType;
    confidence: number;
  } {
    const lowerInput = input.toLowerCase();

    // 关键词匹配
    if (/搜索|查找|找|搜|有没有/.test(lowerInput)) {
      return { intent: "query", confidence: 0.7 };
    }
    if (/整理|分类|归类|移动|放到/.test(lowerInput)) {
      return { intent: "organize", confidence: 0.7 };
    }
    if (/总结|摘要|概括|萃取|提炼/.test(lowerInput)) {
      return { intent: "create", confidence: 0.7 };
    }
    if (/导出|下载|备份|统计|分析/.test(lowerInput)) {
      return { intent: "analyze", confidence: 0.7 };
    }
    if (/复习|回顾|重温|学习/.test(lowerInput)) {
      return { intent: "learn", confidence: 0.7 };
    }
    if (/删除|添加|编辑|修改/.test(lowerInput)) {
      return { intent: "action", confidence: 0.7 };
    }

    return { intent: "chitchat", confidence: 0.3 };
  }

  /**
   * 从上下文推断正确意图
   */
  private inferFromContext(
    input: string,
    wrongIntent: IntentType,
  ): IntentType | undefined {
    return this.detector.inferCorrectIntent(input, wrongIntent);
  }

  /**
   * 从反馈原因推断正确意图
   */
  private inferFromFeedback(
    feedbackReason: string | undefined,
    wrongIntent: IntentType,
  ): IntentType | undefined {
    if (!feedbackReason) return undefined;

    // 根据反馈原因推断
    const lowerReason = feedbackReason.toLowerCase();

    if (lowerReason.includes("wrong_intent") || lowerReason.includes("意图")) {
      // 用户说意图错误，但我们不知道正确的意图
      // 返回最可能的替代意图
      const alternatives: Record<IntentType, IntentType> = {
        query: "organize",
        action: "query",
        organize: "query",
        analyze: "query",
        learn: "query",
        create: "organize",
        refine: "query",
        chitchat: "query",
      };
      return alternatives[wrongIntent];
    }

    return undefined;
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建学习感知分类器
 */
export function createLearningAwareClassifier(
  config?: LearningAwareClassifierConfig,
): LearningAwareClassifier {
  return new LearningAwareClassifier(config);
}

// 默认实例
export const learningAwareClassifier = createLearningAwareClassifier();
