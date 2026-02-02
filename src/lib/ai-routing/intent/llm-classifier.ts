/**
 * LLM 分类器适配器
 *
 * 使用大语言模型进行意图分类
 * 作为规则和语义分类器的兜底
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
import type { IntentClassifier } from "./classifier-interface";

// ============================================
// LLM 分类器
// ============================================

/**
 * LLM 分类器配置
 */
export interface LLMClassifierConfig {
  /** 超时时间（毫秒） */
  timeoutMs?: number;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * LLM 分类器
 *
 * 优先级: 100 (最低优先级，兜底)
 * 使用 LLM 进行意图分类
 */
export class LLMClassifier implements IntentClassifier {
  readonly name = "LLMClassifier";
  readonly priority = 100;

  private config: LLMClassifierConfig;

  constructor(config: LLMClassifierConfig = {}) {
    this.config = {
      timeoutMs: config.timeoutMs ?? 5000,
      enableCache: config.enableCache ?? true,
      debug: config.debug ?? false,
    };
  }

  /**
   * 判断是否能处理
   * LLM 分类器可以处理任何消息
   */
  canHandle(_message: string, _context: ClassificationContext): boolean {
    return true;
  }

  /**
   * 执行分类
   */
  async classify(
    message: string,
    _context: ClassificationContext,
  ): Promise<ClassifierResult> {
    try {
      // 尝试加载 LLM 分类器
      const classifier = await this.loadLLMClassifier();

      if (!classifier) {
        return this.fallbackResult(message);
      }

      const result = await classifier.classify(message);

      if (!result) {
        return this.fallbackResult(message);
      }

      return {
        intent: result.type as IntentType,
        subType: result.subType,
        confidence: result.confidence,
        entities: [],
        reasoning: `LLM 分类: ${result.reasoning ?? ""}`,
      };
    } catch (error) {
      if (this.config.debug) {
        logger.warn({ error }, "LLMClassifier: Classification failed");
      }
      return this.fallbackResult(message);
    }
  }

  /**
   * 置信度校准
   * LLM 的置信度通常需要校准
   */
  calibrate(result: ClassifierResult): ClassifierResult {
    // LLM 倾向于过度自信，适当降低置信度
    const calibratedConfidence = Math.min(result.confidence * 0.9, 0.95);

    return {
      ...result,
      confidence: calibratedConfidence,
    };
  }

  /**
   * 延迟加载 LLM 分类器
   */
  private async loadLLMClassifier(): Promise<LLMClassifierAdapter | null> {
    try {
      const llmModule = await import("@/lib/ai-skills/router/llm-classifier");
      if (llmModule.createLLMClassifier) {
        const classifier = llmModule.createLLMClassifier({
          timeoutMs: this.config.timeoutMs,
          cacheEnabled: this.config.enableCache,
          debug: this.config.debug,
        });
        return {
          classify: async (message: string) => {
            return classifier.classify(message);
          },
        };
      }
      return null;
    } catch {
      // LLM 分类器可能未配置
      return null;
    }
  }

  /**
   * 降级结果
   */
  private fallbackResult(message: string): ClassifierResult {
    const hasQuestion = message.includes("?") || message.includes("？");
    return {
      intent: hasQuestion ? "query" : ("chitchat" as IntentType),
      subType: "general",
      confidence: 0.3,
      entities: [],
      reasoning: "LLM 分类器不可用，使用降级结果",
    };
  }
}

/**
 * LLM 分类器适配器接口
 */
interface LLMClassifierAdapter {
  classify(message: string): Promise<{
    type: string;
    subType?: string;
    confidence: number;
    reasoning?: string;
  } | null>;
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 LLM 分类器
 */
export function createLLMClassifier(
  config?: LLMClassifierConfig,
): LLMClassifier {
  return new LLMClassifier(config);
}
