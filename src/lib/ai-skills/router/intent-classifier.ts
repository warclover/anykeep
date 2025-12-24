/**
 * IntentClassifier - 意图分类器
 *
 * 职责：
 * - 分析用户输入，识别意图类型
 * - 提取实体（主题、时间、数量等）
 * - 判断是否需要多步骤处理
 * - 判断是否期望交付物
 *
 * 策略：规则优先 + LLM 兜底
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type {
  IntentType,
  IntentClassification,
  IntentRule,
  ExtractedEntity,
  IntentClassifierConfig,
} from "./types";

/**
 * 默认意图分类规则
 *
 * 规则按优先级排序，匹配后立即返回
 */
const DEFAULT_RULES: IntentRule[] = [
  // ============================================
  // 学习类（高优先级，通常需要编排）
  // ============================================
  {
    pattern: /复习|回顾|巩固|温习|重温/,
    type: "learn",
    subType: "review",
    complexity: "complex",
    weight: 90,
  },
  {
    pattern: /准备.{0,5}面试|面试.{0,5}准备/,
    type: "learn",
    subType: "interview",
    complexity: "complex",
    weight: 90,
  },
  {
    pattern: /学习路径|学习计划|学习规划/,
    type: "learn",
    subType: "path",
    complexity: "complex",
    weight: 85,
  },

  // ============================================
  // 整理类（通常需要编排）
  // ============================================
  {
    pattern: /整理|清理|规整|梳理/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 80,
  },
  {
    pattern: /去重|重复|找出重复|清理重复/,
    type: "organize",
    subType: "dedupe",
    complexity: "complex",
    weight: 85,
  },
  {
    pattern: /过期|失效|无效.{0,3}链接/,
    type: "organize",
    subType: "expire",
    complexity: "medium",
    weight: 75,
  },
  {
    pattern: /分类|归类|归档/,
    type: "organize",
    subType: "classify",
    complexity: "medium",
    weight: 70,
  },

  // ============================================
  // 分析类
  // ============================================
  {
    pattern: /周报|月报|报告|统计报告/,
    type: "analyze",
    subType: "report",
    complexity: "complex",
    weight: 80,
  },
  {
    pattern: /分析|洞察|趋势/,
    type: "analyze",
    subType: "insight",
    complexity: "medium",
    weight: 70,
  },
  {
    pattern: /统计|有多少|数量|总共/,
    type: "query",
    subType: "count",
    complexity: "simple",
    weight: 60,
  },

  // ============================================
  // 创建类
  // ============================================
  {
    pattern: /摘要|总结|概括|速览/,
    type: "create",
    subType: "digest",
    complexity: "medium",
    weight: 70,
  },
  {
    pattern: /笔记|记录|心得/,
    type: "create",
    subType: "note",
    complexity: "medium",
    weight: 65,
  },
  {
    pattern: /分享|导出|生成.{0,3}文档/,
    type: "create",
    subType: "share",
    complexity: "medium",
    weight: 65,
  },

  // ============================================
  // 查询类（简单任务）
  // ============================================
  {
    pattern: /搜索|搜|找|查找|查询/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 50,
  },
  {
    pattern: /最近|列表|列出|显示/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 45,
  },
  {
    pattern: /什么是|介绍|解释/,
    type: "query",
    subType: "explain",
    complexity: "simple",
    weight: 40,
  },

  // ============================================
  // 操作类
  // ============================================
  {
    pattern: /移动|转移|放到/,
    type: "action",
    subType: "move",
    complexity: "simple",
    weight: 50,
  },
  {
    pattern: /删除|移除|清除/,
    type: "action",
    subType: "delete",
    complexity: "simple",
    weight: 50,
  },
  {
    pattern: /添加.{0,3}标签|打标签|标记/,
    type: "action",
    subType: "tag",
    complexity: "simple",
    weight: 50,
  },
  {
    pattern: /重命名|改名/,
    type: "action",
    subType: "rename",
    complexity: "simple",
    weight: 45,
  },

  // ============================================
  // 闲聊类（最低优先级）
  // ============================================
  {
    pattern: /你好|您好|嗨|hi|hello/i,
    type: "chitchat",
    subType: "greeting",
    complexity: "simple",
    weight: 10,
  },
  {
    pattern: /帮助|怎么用|如何使用|功能/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 15,
  },
  {
    pattern: /谢谢|感谢|辛苦/,
    type: "chitchat",
    subType: "thanks",
    complexity: "simple",
    weight: 10,
  },
];

/**
 * 实体提取模式
 */
const ENTITY_PATTERNS: Array<{
  type: ExtractedEntity["type"];
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => string;
}> = [
  // 时间实体
  {
    type: "time",
    pattern: /今[天日]|昨[天日]|前[天日]|本周|上周|这周|本月|上月|这个月/,
    extractor: (m) => m[0],
  },
  {
    type: "time",
    pattern: /最近(\d+)[天日周月]/,
    extractor: (m) => m[0],
  },
  {
    type: "time",
    pattern: /(\d+)[天日周月][前内以]?来?/,
    extractor: (m) => m[0],
  },

  // 数量实体
  {
    type: "quantity",
    pattern: /(\d+)\s*[条个篇份]/,
    extractor: (m) => m[1],
  },
  {
    type: "quantity",
    pattern: /前\s*(\d+)/,
    extractor: (m) => m[1],
  },

  // 主题实体（关于xxx的）
  {
    type: "topic",
    pattern: /关于(.+?)的|(.+?)相关|(.+?)方面/,
    extractor: (m) => m[1] || m[2] || m[3],
  },

  // 平台实体
  {
    type: "platform",
    pattern: /微信|公众号|B站|bilibili|小红书|知乎|掘金|GitHub|twitter|x\.com/i,
    extractor: (m) => m[0].toLowerCase(),
  },

  // 文件夹实体
  {
    type: "folder",
    pattern: /[「「【\[](.+?)[」」】\]]|"(.+?)"|'(.+?)'/,
    extractor: (m) => m[1] || m[2] || m[3],
  },
];

/**
 * 意图分类器
 */
export class IntentClassifier {
  private rules: IntentRule[];
  private config: IntentClassifierConfig;

  constructor(config: IntentClassifierConfig = {}) {
    this.config = {
      enableEntityExtraction: true,
      llmTimeoutMs: 5000,
      ...config,
    };

    // 合并自定义规则和默认规则
    this.rules = [...(config.customRules || []), ...DEFAULT_RULES].sort(
      (a, b) => (b.weight || 0) - (a.weight || 0),
    );
  }

  /**
   * 分类用户意图
   *
   * @param message - 用户输入的消息
   * @returns 意图分类结果
   */
  async classify(message: string): Promise<IntentClassification> {
    const startTime = performance.now();

    // 1. 规则快速匹配
    const ruleMatch = this.matchRules(message);

    if (ruleMatch && ruleMatch.confidence >= 0.8) {
      logger.debug(
        {
          message: message.substring(0, 50),
          intent: ruleMatch.type,
          subType: ruleMatch.subType,
          confidence: ruleMatch.confidence,
          source: "rule",
          durationMs: Math.round(performance.now() - startTime),
        },
        "IntentClassifier: Rule match succeeded",
      );
      return ruleMatch;
    }

    // 2. 规则匹配置信度不足时，仍返回规则结果（暂不使用 LLM）
    // TODO: 后续可添加 LLM 分类逻辑
    if (ruleMatch) {
      logger.debug(
        {
          message: message.substring(0, 50),
          intent: ruleMatch.type,
          confidence: ruleMatch.confidence,
          source: "rule",
          note: "Low confidence, but using rule result",
        },
        "IntentClassifier: Using rule match with low confidence",
      );
      return ruleMatch;
    }

    // 3. 无规则匹配，返回默认结果
    const defaultResult = this.getDefaultClassification(message);
    logger.debug(
      {
        message: message.substring(0, 50),
        intent: defaultResult.type,
        source: "default",
      },
      "IntentClassifier: No rule match, using default",
    );

    return defaultResult;
  }

  /**
   * 规则匹配
   */
  private matchRules(message: string): IntentClassification | null {
    for (const rule of this.rules) {
      if (rule.pattern.test(message)) {
        const entities = this.config.enableEntityExtraction
          ? this.extractEntities(message)
          : [];

        return {
          type: rule.type,
          subType: rule.subType,
          confidence: this.calculateConfidence(message, rule),
          entities,
          requiresMultiStep: this.isMultiStepTask(rule),
          hasDeliverableExpectation: this.expectsDeliverable(rule),
          source: "rule",
        };
      }
    }
    return null;
  }

  /**
   * 提取实体
   */
  private extractEntities(message: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    for (const { type, pattern, extractor } of ENTITY_PATTERNS) {
      const matches = message.matchAll(new RegExp(pattern, "g"));
      for (const match of matches) {
        const value = extractor(match);
        if (value) {
          entities.push({
            type,
            value: value.trim(),
            raw: match[0],
            confidence: 0.9,
          });
        }
      }
    }

    return entities;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(message: string, rule: IntentRule): number {
    let confidence = 0.85;

    // 消息长度影响置信度（太短可能不够明确）
    if (message.length < 5) {
      confidence -= 0.1;
    } else if (message.length > 50) {
      confidence -= 0.05;
    }

    // 规则权重影响置信度
    if (rule.weight && rule.weight >= 80) {
      confidence += 0.05;
    }

    // 确保在有效范围内
    return Math.max(0.5, Math.min(1, confidence));
  }

  /**
   * 判断是否需要多步骤
   */
  private isMultiStepTask(rule: IntentRule): boolean {
    // 复杂任务通常需要多步骤
    if (rule.complexity === "complex") {
      return true;
    }

    // 特定意图类型通常需要多步骤
    const multiStepTypes: IntentType[] = ["organize", "analyze", "learn"];
    return multiStepTypes.includes(rule.type);
  }

  /**
   * 判断是否期望交付物
   */
  private expectsDeliverable(rule: IntentRule): boolean {
    // 这些类型通常期望获得文档/报告等交付物
    const deliverableTypes: IntentType[] = ["analyze", "create", "learn"];
    if (deliverableTypes.includes(rule.type)) {
      return true;
    }

    // 特定子类型也期望交付物
    const deliverableSubTypes = ["report", "digest", "path", "share", "review"];
    return rule.subType ? deliverableSubTypes.includes(rule.subType) : false;
  }

  /**
   * 获取默认分类结果（无规则匹配时）
   */
  private getDefaultClassification(message: string): IntentClassification {
    const entities = this.config.enableEntityExtraction
      ? this.extractEntities(message)
      : [];

    // 根据消息特征推断
    // 如果包含问号，可能是查询
    if (message.includes("?") || message.includes("？")) {
      return {
        type: "query",
        subType: "general",
        confidence: 0.5,
        entities,
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      };
    }

    // 默认当作闲聊处理
    return {
      type: "chitchat",
      subType: "general",
      confidence: 0.4,
      entities,
      requiresMultiStep: false,
      hasDeliverableExpectation: false,
      source: "rule",
    };
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: IntentRule): void {
    this.rules.unshift(rule);
    this.rules.sort((a, b) => (b.weight || 0) - (a.weight || 0));
  }

  /**
   * 获取所有规则（用于调试）
   */
  getRules(): IntentRule[] {
    return [...this.rules];
  }
}

/**
 * 创建意图分类器实例
 */
export function createIntentClassifier(
  config?: IntentClassifierConfig,
): IntentClassifier {
  return new IntentClassifier(config);
}

/**
 * 默认意图分类器实例
 */
export const intentClassifier = new IntentClassifier();
