/**
 * CorrectionDetector - 纠正检测器
 *
 * 检测用户输入是否为对 AI 回答的纠正信号
 *
 * 检测策略：
 * 1. 模式匹配：直接否定、纠正句式
 * 2. 语义相似度：用户换种说法重试
 * 3. 负面反馈：QuickActions 👎 按钮
 *
 * @module ai-learning
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import type {
  CorrectionSignal,
  CorrectionPattern,
  CorrectionSignalType,
  AIOutput,
  ConversationState,
  DetectionResult,
  IntentType,
} from "./types";

// =============================================================================
// 常量定义
// =============================================================================

/**
 * 纠正模式列表
 */
const CORRECTION_PATTERNS: CorrectionPattern[] = [
  // 纠正句式 - 明确的纠正意图（优先匹配，避免被 "不是" 前缀误判）
  {
    pattern: /我(说的|要的|想要的?|需要的?)是.*不是/i,
    signal: "correction_follow",
    confidence: 0.9,
  },
  {
    pattern: /不是.+是.+/i, // "不是...是..." 中间必须有内容
    signal: "correction_follow",
    confidence: 0.85,
  },
  {
    pattern: /应该是/i,
    signal: "correction_follow",
    confidence: 0.8,
  },
  {
    pattern: /我(是|)要.*而不是/i,
    signal: "correction_follow",
    confidence: 0.88,
  },

  // 直接否定 - 高置信度
  {
    pattern: /^(不对|错了|不是这个|搞错了|弄错了)/i,
    signal: "explicit_wrong",
    confidence: 0.95,
  },
  {
    pattern: /^(否|no|wrong)/i, // 移除单独的 "不" 避免误匹配
    signal: "explicit_wrong",
    confidence: 0.7,
  },

  // 重新表述 - 用户尝试换种说法
  {
    pattern: /我(再|重新)说一遍/i,
    signal: "reformulation",
    confidence: 0.75,
  },
  {
    pattern: /换个说法/i,
    signal: "reformulation",
    confidence: 0.75,
  },
  {
    pattern: /让我重新(描述|说明)/i,
    signal: "reformulation",
    confidence: 0.78,
  },
];

/**
 * 意图否定映射
 *
 * 注意：IntentType 统一使用 router/types 定义
 * - export → analyze（导出归类到分析）
 * - review → learn（复习归类到学习）
 */
const INTENT_NEGATIONS: Record<string, IntentType[]> = {
  不是搜索: ["organize", "create", "analyze"],
  不是整理: ["query", "create", "analyze"],
  不是总结: ["query", "organize", "analyze"],
  不是导出: ["query", "organize", "create"],
  不要搜: ["organize", "create", "analyze"],
  不要整理: ["query", "create", "analyze"],
  不要总结: ["query", "organize", "analyze"],
};

/**
 * 动作到意图映射
 *
 * 注意：IntentType 统一使用 router/types 定义
 * 完整类型：query | action | organize | analyze | learn | create | chitchat
 */
const ACTION_TO_INTENT: Record<string, IntentType> = {
  // organize - 整理归类
  整理: "organize",
  分类: "organize",
  归类: "organize",
  移动: "organize",
  // query - 搜索查询
  搜索: "query",
  查找: "query",
  找: "query",
  搜: "query",
  // create - 内容创作
  总结: "create",
  摘要: "create",
  概括: "create",
  // analyze - 数据分析（包含导出）
  导出: "analyze",
  下载: "analyze",
  统计: "analyze",
  分析: "analyze",
  // learn - 知识学习（包含复习）
  复习: "learn",
  回顾: "learn",
  学习: "learn",
  // action - 操作类
  删除: "action",
  添加: "action",
  编辑: "action",
};

// =============================================================================
// CorrectionDetector 类
// =============================================================================

export class CorrectionDetector {
  private readonly patterns: CorrectionPattern[];
  private readonly similarityThreshold: number;

  constructor(options?: { similarityThreshold?: number }) {
    this.patterns = CORRECTION_PATTERNS;
    this.similarityThreshold = options?.similarityThreshold ?? 0.7;
  }

  /**
   * 检测是否为纠正信号
   */
  detect(
    currentInput: string,
    previousOutput: AIOutput | undefined,
    context: ConversationState,
  ): DetectionResult {
    // 无前次输出，无法判断纠正
    if (!previousOutput) {
      return { isCorrection: false };
    }

    logger.debug(
      {
        currentInput: currentInput.substring(0, 50),
        previousIntent: previousOutput.intent,
        wasSuccessful: previousOutput.wasSuccessful,
      },
      "CorrectionDetector: Analyzing input",
    );

    // 1. 模式匹配检测
    const patternMatch = this.detectByPattern(currentInput);
    if (patternMatch) {
      const signal = this.buildSignal(
        patternMatch,
        currentInput,
        previousOutput,
        context,
      );
      logger.info(
        { signal: signal.signal, confidence: signal.confidence },
        "CorrectionDetector: Pattern match detected",
      );
      return { isCorrection: true, signal };
    }

    // 2. 语义相似度检测（用户换种说法重试）
    if (context.lastUserInput && previousOutput.wasSuccessful === false) {
      const similarity = this.computeSimpleSimilarity(
        currentInput,
        context.lastUserInput,
      );
      if (similarity > this.similarityThreshold) {
        const signal: CorrectionSignal = {
          signal: "reformulation",
          confidence: similarity,
          originalInput: context.lastUserInput,
          wrongIntent: previousOutput.intent,
          correctionInput: currentInput,
          inferredCorrectIntent: this.inferCorrectIntent(
            currentInput,
            previousOutput.intent,
          ),
        };
        logger.info(
          { similarity, threshold: this.similarityThreshold },
          "CorrectionDetector: Reformulation detected",
        );
        return { isCorrection: true, signal };
      }
    }

    // 3. 连续失败检测
    if (context.consecutiveFailures >= 2) {
      // 用户可能在尝试不同的表达方式
      const signal: CorrectionSignal = {
        signal: "reformulation",
        confidence: 0.6 + context.consecutiveFailures * 0.1,
        originalInput: context.lastUserInput || currentInput,
        wrongIntent: previousOutput.intent,
        correctionInput: currentInput,
      };
      logger.info(
        { consecutiveFailures: context.consecutiveFailures },
        "CorrectionDetector: Consecutive failures detected",
      );
      return { isCorrection: true, signal };
    }

    return { isCorrection: false };
  }

  /**
   * 从负面反馈创建纠正信号
   */
  createFromNegativeFeedback(
    originalInput: string,
    wrongIntent: IntentType,
    feedbackReason?: string,
  ): CorrectionSignal {
    return {
      signal: "negative_feedback",
      confidence: 0.85,
      originalInput,
      wrongIntent,
      correctionInput: feedbackReason || "用户点击了负面反馈",
    };
  }

  /**
   * 推断正确意图
   */
  inferCorrectIntent(
    correctionInput: string,
    wrongIntent: IntentType,
  ): IntentType | undefined {
    // 1. 从"我是要...，不是..."句式中提取
    const match = correctionInput.match(
      /我(?:是要|想要?|要的是|需要)(.+?)(?:不是|而不是)/,
    );
    if (match) {
      const action = match[1].trim();
      const intent = this.mapActionToIntent(action);
      if (intent) {
        logger.debug(
          { action, intent },
          "CorrectionDetector: Inferred intent from correction phrase",
        );
        return intent;
      }
    }

    // 2. 基于否定推断
    for (const [negation, alternatives] of Object.entries(INTENT_NEGATIONS)) {
      if (correctionInput.includes(negation)) {
        // 返回最可能的替代意图（排除当前错误意图）
        const alternative = alternatives.find((i) => i !== wrongIntent);
        if (alternative) {
          logger.debug(
            { negation, alternative },
            "CorrectionDetector: Inferred intent from negation",
          );
          return alternative;
        }
      }
    }

    // 3. 从纠正输入中直接匹配动作词
    for (const [action, intent] of Object.entries(ACTION_TO_INTENT)) {
      if (correctionInput.includes(action) && intent !== wrongIntent) {
        logger.debug(
          { action, intent },
          "CorrectionDetector: Inferred intent from action keyword",
        );
        return intent;
      }
    }

    return undefined;
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 模式匹配检测
   */
  private detectByPattern(
    input: string,
  ): { signal: CorrectionSignalType; confidence: number } | null {
    for (const { pattern, signal, confidence } of this.patterns) {
      if (pattern.test(input)) {
        return { signal, confidence };
      }
    }
    return null;
  }

  /**
   * 构建纠正信号
   */
  private buildSignal(
    match: { signal: CorrectionSignalType; confidence: number },
    currentInput: string,
    previousOutput: AIOutput,
    context: ConversationState,
  ): CorrectionSignal {
    return {
      signal: match.signal,
      confidence: match.confidence,
      originalInput: context.lastUserInput || "",
      wrongIntent: previousOutput.intent,
      correctionInput: currentInput,
      inferredCorrectIntent: this.inferCorrectIntent(
        currentInput,
        previousOutput.intent,
      ),
    };
  }

  /**
   * 简单文本相似度计算（基于 Jaccard 系数）
   *
   * 注意：生产环境应使用向量相似度
   */
  private computeSimpleSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.tokenize(text1));
    const words2 = new Set(this.tokenize(text2));

    if (words1.size === 0 || words2.size === 0) {
      return 0;
    }

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * 简单分词
   */
  private tokenize(text: string): string[] {
    // 移除标点，转小写，按空格和中文字符分割
    return text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }

  /**
   * 动作词映射到意图
   */
  private mapActionToIntent(action: string): IntentType | undefined {
    for (const [keyword, intent] of Object.entries(ACTION_TO_INTENT)) {
      if (action.includes(keyword)) {
        return intent;
      }
    }
    return undefined;
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建纠正检测器实例
 */
export function createCorrectionDetector(options?: {
  similarityThreshold?: number;
}): CorrectionDetector {
  return new CorrectionDetector(options);
}

// 默认实例
export const correctionDetector = createCorrectionDetector();
