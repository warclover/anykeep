/**
 * 语义分类器适配器
 *
 * 基于语义相似度的意图分类
 * 优先级低于规则分类器，作为补充
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
// 语义分类器
// ============================================

/**
 * 语义分类器配置
 */
export interface SemanticClassifierConfig {
  /** 相似度阈值 */
  similarityThreshold?: number;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 语义分类器
 *
 * 优先级: 50 (中等优先级)
 * 使用向量相似度进行意图匹配
 */
export class SemanticClassifier implements IntentClassifier {
  readonly name = "SemanticClassifier";
  readonly priority = 50;

  private config: SemanticClassifierConfig;

  constructor(config: SemanticClassifierConfig = {}) {
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.75,
      debug: config.debug ?? false,
    };
  }

  /**
   * 判断是否能处理
   * 语义分类器需要一定长度的消息
   */
  canHandle(message: string, _context: ClassificationContext): boolean {
    // 消息太短不适合语义分类
    return message.length >= 5;
  }

  /**
   * 执行分类
   */
  async classify(
    message: string,
    context: ClassificationContext,
  ): Promise<ClassifierResult> {
    try {
      // 尝试加载语义匹配器
      const matcher = await this.loadSemanticMatcher();

      if (!matcher) {
        return this.fallbackResult();
      }

      const result = await matcher.match(message, context);

      return {
        intent: result.intent as IntentType,
        subType: result.subType,
        confidence: result.confidence,
        entities: [],
        matchedSkill: result.matchedSkill,
        reasoning: `语义匹配: 相似度 ${(result.confidence * 100).toFixed(0)}%`,
      };
    } catch (error) {
      if (this.config.debug) {
        logger.warn({ error }, "SemanticClassifier: Match failed");
      }
      return this.fallbackResult();
    }
  }

  /**
   * 延迟加载语义匹配器
   */
  private async loadSemanticMatcher(): Promise<SemanticMatcherAdapter | null> {
    try {
      const semanticModule = await import(
        "@/lib/ai-skills/router/semantic-intent-matcher"
      );
      if (semanticModule.SemanticIntentMatcher) {
        const matcher = new semanticModule.SemanticIntentMatcher();
        return {
          match: async (message: string, _context: ClassificationContext) => {
            const results = await matcher.match(message);
            // match() 返回 SemanticMatch[] 数组，取第一个最佳匹配
            const bestMatch = results?.[0];
            return {
              intent: bestMatch?.type ?? "chitchat",
              subType: bestMatch?.subType,
              confidence: bestMatch?.similarity ?? 0.3,
              matchedSkill: undefined,
            };
          },
        };
      }
      return null;
    } catch {
      // 语义匹配器可能未启用
      return null;
    }
  }

  /**
   * 降级结果
   */
  private fallbackResult(): ClassifierResult {
    return {
      intent: "chitchat",
      subType: "general",
      confidence: 0.2,
      entities: [],
      reasoning: "语义分类器未匹配",
    };
  }
}

/**
 * 语义匹配器适配器接口
 */
interface SemanticMatcherAdapter {
  match(
    message: string,
    context: ClassificationContext,
  ): Promise<{
    intent: string;
    subType?: string;
    confidence: number;
    matchedSkill?: string;
  }>;
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建语义分类器
 */
export function createSemanticClassifier(
  config?: SemanticClassifierConfig,
): SemanticClassifier {
  return new SemanticClassifier(config);
}
