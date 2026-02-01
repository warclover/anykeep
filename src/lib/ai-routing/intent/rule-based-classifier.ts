/**
 * 规则分类器适配器
 *
 * 将现有的 IntentAnalyzer 适配为 IntentClassifier 接口
 * 实现从 ai-skills/router 到 ai-routing 的平滑过渡
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import { logger } from "@/lib/logger";
import type {
  ClassificationContext,
  ClassifierResult,
  ExtractedEntity,
} from "../types";
import type { IntentClassifier } from "./classifier-interface";

// ============================================
// 规则分类器适配器
// ============================================

/**
 * 规则分类器配置
 */
export interface RuleBasedClassifierConfig {
  /** 是否启用实体提取 */
  enableEntityExtraction?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 规则分类器适配器
 *
 * 优先级: 10 (最高优先级)
 * 适配现有的 IntentAnalyzer 规则引擎
 */
export class RuleBasedClassifier implements IntentClassifier {
  readonly name = "RuleBasedClassifier";
  readonly priority = 10;

  private config: RuleBasedClassifierConfig;
  private analyzer: IntentAnalyzerAdapter | null = null;

  constructor(config: RuleBasedClassifierConfig = {}) {
    this.config = config;
  }

  /**
   * 判断是否能处理
   * 规则分类器可以处理任何消息
   */
  canHandle(_message: string, _context: ClassificationContext): boolean {
    return true;
  }

  /**
   * 执行分类
   */
  async classify(
    message: string,
    context: ClassificationContext,
  ): Promise<ClassifierResult> {
    // 延迟加载以避免循环依赖
    if (!this.analyzer) {
      this.analyzer = await this.loadAnalyzer();
    }

    if (!this.analyzer) {
      // 如果无法加载，返回低置信度结果
      return this.fallbackResult(message);
    }

    try {
      const result = await this.analyzer.analyze(message, context);

      return {
        intent: result.intent,
        subType: result.subType,
        confidence: result.confidence,
        entities: result.entities,
        matchedSkill: result.execution?.suggestedSkill,
        reasoning: `规则匹配: ${result.source}`,
      };
    } catch (error) {
      logger.warn({ error }, "RuleBasedClassifier: Analysis failed");
      return this.fallbackResult(message);
    }
  }

  /**
   * 置信度校准
   */
  calibrate(result: ClassifierResult): ClassifierResult {
    // 规则分类器的结果通常已经校准过
    // 这里可以添加额外的校准逻辑
    return result;
  }

  /**
   * 延迟加载分析器
   */
  private async loadAnalyzer(): Promise<IntentAnalyzerAdapter | null> {
    try {
      // 动态导入以避免循环依赖
      const analyzerModule = await import(
        "@/lib/ai-skills/router/intent-analyzer"
      );
      return {
        analyze: async (message: string, context: ClassificationContext) => {
          const analyzer = new analyzerModule.IntentAnalyzer({
            enableEntityExtraction: this.config.enableEntityExtraction ?? true,
            debug: this.config.debug,
          });
          return analyzer.analyze(message, context);
        },
      };
    } catch (error) {
      logger.warn(
        { error },
        "RuleBasedClassifier: Failed to load IntentAnalyzer",
      );
      return null;
    }
  }

  /**
   * 降级结果
   */
  private fallbackResult(message: string): ClassifierResult {
    const hasQuestion = message.includes("?") || message.includes("？");
    return {
      intent: hasQuestion ? "query" : "chitchat",
      subType: "general",
      confidence: 0.3,
      entities: [],
      reasoning: "规则分类器加载失败，使用降级结果",
    };
  }
}

/**
 * IntentAnalyzer 适配器接口
 */
interface IntentAnalyzerAdapter {
  analyze(
    message: string,
    context: ClassificationContext,
  ): Promise<{
    intent: string;
    subType?: string;
    confidence: number;
    entities: ExtractedEntity[];
    source: string;
    execution?: {
      suggestedSkill?: string;
    };
  }>;
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建规则分类器
 */
export function createRuleBasedClassifier(
  config?: RuleBasedClassifierConfig,
): RuleBasedClassifier {
  return new RuleBasedClassifier(config);
}
