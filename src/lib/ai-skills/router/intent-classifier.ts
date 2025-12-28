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
 * @version 2.0.0
 * @since 2025-12-24
 * @updated 2025-12-26 - 添加 LLM 分类兜底支持
 */

import { logger } from "@/lib/logger";
import type {
  IntentType,
  IntentClassification,
  IntentRule,
  ExtractedEntity,
  IntentClassifierConfig,
  IntentCandidate,
  MultiCandidateResult,
  DisambiguationRule,
} from "./types";
import { DISAMBIGUATION_RULES, findMatchingRule } from "./disambiguation-rules";
import type { LLMIntentClassifier } from "./llm-classifier";
import { createLLMClassifier } from "./llm-classifier";

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
  {
    pattern: /监控|变更检测|页面监控|变化检测|内容变化|监控列表|我的监控/,
    type: "organize",
    subType: "monitor",
    complexity: "simple",
    weight: 80,
  },

  // ============================================
  // 分析类
  // ============================================
  {
    pattern:
      /微信.{0,3}(文章|阅读|收藏).{0,3}(摘要|总结|整理|报告)|公众号.{0,3}(摘要|总结)/,
    type: "analyze",
    subType: "wechat",
    complexity: "medium",
    weight: 88,
  },
  {
    // 收件箱/消息摘要规则
    pattern:
      /消息.{0,3}(摘要|总结|概览|统计)|收件箱.{0,3}(摘要|总结|报告)|未读.{0,3}(摘要|总结)|通知.{0,3}(摘要|总结)/,
    type: "analyze",
    subType: "inbox_digest",
    complexity: "medium",
    weight: 87,
  },
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
    // 使用负向后行断言排除「阅读」中的「读」
    pattern: /(?<!阅)读|朗读|播放.{0,3}摘要|听|语音|念|tts/i,
    type: "create",
    subType: "tts",
    complexity: "simple",
    weight: 85,
  },
  {
    // B站字幕提取规则
    pattern:
      /B站|bilibili.{0,5}(字幕|文字稿|转文字)|视频.{0,3}(字幕|文字稿)|提取.{0,3}字幕/i,
    type: "create",
    subType: "bilibili_transcript",
    complexity: "medium",
    weight: 86,
  },
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
  // 过滤/筛选类（需要上下文有搜索结果）
  // ============================================
  {
    pattern: /里面|其中|当中/,
    type: "refine",
    subType: "filter",
    complexity: "simple",
    weight: 75,
  },
  {
    pattern: /有没有.{1,10}的|有.{1,10}的吗/,
    type: "refine",
    subType: "check",
    complexity: "simple",
    weight: 70,
  },
  {
    pattern: /哪[几个篇条]+.{0,5}是.{0,10}的|哪[几个篇条]+.{0,5}关于/,
    type: "refine",
    subType: "filter",
    complexity: "simple",
    weight: 72,
  },
  {
    pattern: /筛选|过滤|只看|只要/,
    type: "refine",
    subType: "filter",
    complexity: "simple",
    weight: 68,
  },

  // ============================================
  // 设置/配置类
  // ============================================
  {
    pattern:
      /推荐.{0,5}(模式|信任|托管)|适合.{0,5}(模式|信任)|哪个模式.{0,3}(好|适合)|优化.{0,5}(AI|设置)/,
    type: "query",
    subType: "trust_mode_recommend",
    complexity: "simple",
    weight: 85,
  },
  {
    pattern:
      /(信任|托管).{0,5}模式.{0,5}(是|什么)|当前.{0,5}(模式|托管|信任)|我的.{0,5}(模式|托管|信任)/,
    type: "query",
    subType: "trust_mode",
    complexity: "simple",
    weight: 80,
  },

  // ============================================
  // 插件授权类（v2.3.0 新增）
  // ============================================
  {
    pattern:
      /插件.{0,5}(授权|登录|设备)|设备.{0,5}(登录|授权)|浏览器.{0,5}(插件|授权)/,
    type: "query",
    subType: "plugin_auth",
    complexity: "simple",
    weight: 75,
  },
  {
    pattern:
      /退出.{0,5}(插件|所有设备)|撤销.{0,5}(授权|插件)|登出.{0,5}(插件|设备)/,
    type: "action",
    subType: "revoke_plugin_auth",
    complexity: "simple",
    weight: 80,
  },

  // ============================================
  // 知识图谱类（v2.4.0 新增）
  // ============================================
  {
    pattern:
      /知识.{0,3}(图谱|网络|关系)|关联.{0,3}(图|网络|分析)|图谱.{0,3}(数据|统计)/,
    type: "query",
    subType: "knowledge_graph",
    complexity: "simple",
    weight: 78,
  },
  {
    pattern:
      /相关.{0,3}(内容|书签|文章)|同.{0,3}主题|主题.{0,3}(聚类|分组|相似)/,
    type: "query",
    subType: "related_by_topic",
    complexity: "simple",
    weight: 75,
  },

  // ============================================
  // 微信文章类（v2.4.0 新增）
  // ============================================
  {
    pattern:
      /微信.{0,3}(文章|收藏).{0,3}(列表|清单|有哪些)|公众号.{0,3}(文章|收藏).{0,3}(列表|有)/,
    type: "query",
    subType: "wechat_articles",
    complexity: "simple",
    weight: 76,
  },
  {
    pattern:
      /微信.{0,3}(文章|收藏).{0,3}(统计|概览|数据)|公众号.{0,3}(统计|多少)/,
    type: "query",
    subType: "wechat_article_stats",
    complexity: "simple",
    weight: 74,
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
  private llmClassifier: LLMIntentClassifier | null = null;

  constructor(config: IntentClassifierConfig = {}) {
    this.config = {
      enableEntityExtraction: true,
      llmTimeoutMs: 5000,
      llmFallbackThreshold: 0.6,
      debug: false,
      ...config,
    };

    // 合并自定义规则和默认规则
    this.rules = [...(config.customRules || []), ...DEFAULT_RULES].sort(
      (a, b) => (b.weight || 0) - (a.weight || 0),
    );

    // 初始化 LLM 分类器（如果启用）
    if (config.enableLLMFallback) {
      this.llmClassifier = createLLMClassifier({
        timeoutMs: config.llmTimeoutMs,
        ...config.llmClassifierConfig,
        debug: config.debug,
      });
    }
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
      if (this.config.debug) {
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
      }
      return ruleMatch;
    }

    // 2. 规则置信度不足，尝试 LLM 兜底
    const llmFallbackThreshold = this.config.llmFallbackThreshold ?? 0.6;

    if (
      this.llmClassifier &&
      (!ruleMatch || ruleMatch.confidence < llmFallbackThreshold)
    ) {
      const llmResult = await this.llmClassifier.classify(message);

      if (llmResult && llmResult.confidence > (ruleMatch?.confidence ?? 0)) {
        if (this.config.debug) {
          logger.debug(
            {
              message: message.substring(0, 50),
              ruleConfidence: ruleMatch?.confidence,
              llmConfidence: llmResult.confidence,
              llmType: llmResult.type,
            },
            "IntentClassifier: LLM fallback used",
          );
        }

        const entities = this.config.enableEntityExtraction
          ? this.extractEntities(message)
          : [];

        const classification: IntentClassification = {
          type: llmResult.type as IntentType,
          subType: llmResult.subType,
          confidence: llmResult.confidence,
          entities,
          requiresMultiStep: this.isMultiStepByType(
            llmResult.type as IntentType,
          ),
          hasDeliverableExpectation: this.expectsDeliverableByType(
            llmResult.type as IntentType,
            llmResult.subType,
          ),
          source: "llm",
        };

        return classification;
      }
    }

    // 3. 规则匹配置信度不足但有结果，返回规则结果
    if (ruleMatch) {
      if (this.config.debug) {
        logger.debug(
          {
            message: message.substring(0, 50),
            intent: ruleMatch.type,
            confidence: ruleMatch.confidence,
            source: "rule",
            note: "Low confidence, LLM unavailable or no improvement",
          },
          "IntentClassifier: Using rule match with low confidence",
        );
      }
      return ruleMatch;
    }

    // 4. 无规则匹配，返回默认结果
    const defaultResult = this.getDefaultClassification(message);
    if (this.config.debug) {
      logger.debug(
        {
          message: message.substring(0, 50),
          intent: defaultResult.type,
          source: "default",
        },
        "IntentClassifier: No rule match, using default",
      );
    }

    return defaultResult;
  }

  /**
   * 根据意图类型判断是否需要多步骤
   */
  private isMultiStepByType(type: IntentType): boolean {
    const multiStepTypes: IntentType[] = ["organize", "analyze", "learn"];
    return multiStepTypes.includes(type);
  }

  /**
   * 根据意图类型判断是否期望交付物
   */
  private expectsDeliverableByType(
    type: IntentType,
    subType?: string,
  ): boolean {
    const deliverableTypes: IntentType[] = ["analyze", "create", "learn"];
    if (deliverableTypes.includes(type)) {
      return true;
    }
    const deliverableSubTypes = ["report", "digest", "path", "share", "review"];
    return subType ? deliverableSubTypes.includes(subType) : false;
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

  // ============================================
  // 多候选收集机制 (Phase 1.1)
  // ============================================

  /**
   * 收集所有匹配的意图候选项
   *
   * 遍历所有规则，返回所有匹配结果，不立即返回
   *
   * @param message - 用户输入的消息
   * @returns 所有匹配的候选项列表
   */
  collectAllMatches(message: string): IntentCandidate[] {
    const candidates: IntentCandidate[] = [];

    for (const rule of this.rules) {
      const match = rule.pattern.exec(message);
      if (match) {
        candidates.push({
          pattern: rule.pattern.source,
          type: rule.type,
          subType: rule.subType,
          weight: rule.weight || 0,
          matchIndex: match.index,
          confidence: this.calculateConfidence(message, rule),
          complexity: rule.complexity,
        });
      }
    }

    // 按置信度降序排序
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 候选去重：相同意图类型只保留最高权重的候选
   *
   * @param candidates - 原始候选列表
   * @returns 去重后的候选列表
   */
  deduplicateCandidates(candidates: IntentCandidate[]): IntentCandidate[] {
    const typeMap = new Map<IntentType, IntentCandidate>();

    for (const candidate of candidates) {
      const existing = typeMap.get(candidate.type);
      if (!existing || candidate.weight > existing.weight) {
        typeMap.set(candidate.type, candidate);
      }
    }

    // 按置信度降序排序后返回
    return Array.from(typeMap.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );
  }

  /**
   * 多候选分类（完整流程）
   *
   * 1. 收集所有匹配
   * 2. 去重
   * 3. 判断是否需要消歧
   * 4. 返回结果
   *
   * @param message - 用户输入的消息
   * @returns 多候选分类结果
   */
  async classifyWithCandidates(message: string): Promise<MultiCandidateResult> {
    const startTime = performance.now();

    // 1. 收集所有匹配
    const allMatches = this.collectAllMatches(message);

    // 2. 去重
    const candidates = this.deduplicateCandidates(allMatches);

    // 3. 提取实体
    const entities = this.config.enableEntityExtraction
      ? this.extractEntities(message)
      : [];

    // 4. 无候选时返回默认结果
    if (candidates.length === 0) {
      const defaultResult = this.getDefaultClassification(message);
      logger.debug(
        {
          message: message.substring(0, 50),
          candidates: 0,
          durationMs: Math.round(performance.now() - startTime),
        },
        "IntentClassifier: No candidates found, using default",
      );
      return {
        primary: defaultResult,
        candidates: [],
        disambiguated: false,
      };
    }

    // 5. 单一候选直接返回
    if (candidates.length === 1) {
      const primary = this.candidateToClassification(candidates[0], entities);
      logger.debug(
        {
          message: message.substring(0, 50),
          intent: primary.type,
          candidates: 1,
          durationMs: Math.round(performance.now() - startTime),
        },
        "IntentClassifier: Single candidate",
      );
      return {
        primary,
        candidates,
        disambiguated: false,
      };
    }

    // 6. 多候选：检查是否需要消歧
    const threshold = this.config.disambiguationThreshold ?? 0.2;
    const top1 = candidates[0];
    const top2 = candidates[1];
    const needsDisambiguation = top1.confidence - top2.confidence < threshold;

    if (needsDisambiguation) {
      logger.debug(
        {
          message: message.substring(0, 50),
          top1: { type: top1.type, confidence: top1.confidence },
          top2: { type: top2.type, confidence: top2.confidence },
          gap: top1.confidence - top2.confidence,
        },
        "IntentClassifier: Disambiguation needed",
      );

      // 调用消歧规则引擎
      const disambiguationResult = this.disambiguate(message, candidates);

      if (disambiguationResult.disambiguated) {
        const winner = candidates.find(
          (c) => c.type === disambiguationResult.winnerType,
        );

        if (winner) {
          const primary = this.candidateToClassification(winner, entities);

          logger.debug(
            {
              message: message.substring(0, 50),
              intent: primary.type,
              rule: disambiguationResult.ruleId,
              reason: disambiguationResult.reason,
              durationMs: Math.round(performance.now() - startTime),
            },
            "IntentClassifier: Disambiguation succeeded",
          );

          return {
            primary,
            candidates,
            disambiguated: true,
            disambiguationReason: disambiguationResult.reason,
          };
        }
      }
    }

    // 无消歧或消歧失败，返回 top1 作为主意图
    const primary = this.candidateToClassification(top1, entities);

    logger.debug(
      {
        message: message.substring(0, 50),
        intent: primary.type,
        candidates: candidates.length,
        needsDisambiguation,
        durationMs: Math.round(performance.now() - startTime),
      },
      "IntentClassifier: Multi-candidate result",
    );

    return {
      primary,
      candidates,
      disambiguated: false,
      disambiguationReason: needsDisambiguation
        ? "Confidence gap below threshold"
        : undefined,
    };
  }

  /**
   * 将候选项转换为完整的分类结果
   */
  private candidateToClassification(
    candidate: IntentCandidate,
    entities: ExtractedEntity[],
  ): IntentClassification {
    return {
      type: candidate.type,
      subType: candidate.subType,
      confidence: candidate.confidence,
      entities,
      requiresMultiStep: this.isMultiStepByCandidate(candidate),
      hasDeliverableExpectation: this.expectsDeliverableByCandidate(candidate),
      source: "rule",
    };
  }

  /**
   * 根据候选判断是否需要多步骤
   */
  private isMultiStepByCandidate(candidate: IntentCandidate): boolean {
    if (candidate.complexity === "complex") {
      return true;
    }
    const multiStepTypes: IntentType[] = ["organize", "analyze", "learn"];
    return multiStepTypes.includes(candidate.type);
  }

  /**
   * 根据候选判断是否期望交付物
   */
  private expectsDeliverableByCandidate(candidate: IntentCandidate): boolean {
    const deliverableTypes: IntentType[] = ["analyze", "create", "learn"];
    if (deliverableTypes.includes(candidate.type)) {
      return true;
    }
    const deliverableSubTypes = ["report", "digest", "path", "share", "review"];
    return candidate.subType
      ? deliverableSubTypes.includes(candidate.subType)
      : false;
  }

  // ============================================
  // 消歧规则引擎 (Phase 1.2)
  // ============================================

  /**
   * 消歧结果类型
   */
  private disambiguationRules: DisambiguationRule[] = DISAMBIGUATION_RULES;

  /**
   * 执行消歧逻辑
   *
   * 当多个意图候选置信度接近时，使用消歧规则选择正确的意图
   *
   * @param message - 用户输入的消息
   * @param candidates - 候选意图列表
   * @returns 消歧结果
   */
  disambiguate(
    message: string,
    candidates: IntentCandidate[],
  ): {
    disambiguated: boolean;
    winnerType?: IntentType;
    ruleId?: string;
    reason?: string;
  } {
    if (candidates.length < 2) {
      return { disambiguated: false };
    }

    // 获取所有冲突的意图类型
    const conflictTypes = candidates.map((c) => c.type);

    // 查找匹配的消歧规则
    const matchedRule = findMatchingRule(message, conflictTypes);

    if (matchedRule) {
      // 确保 winner 类型在候选列表中
      const winnerExists = candidates.some(
        (c) => c.type === matchedRule.winner,
      );

      if (winnerExists) {
        logger.debug(
          {
            message: message.substring(0, 50),
            ruleId: matchedRule.id,
            winner: matchedRule.winner,
            conflictTypes,
          },
          "IntentClassifier: Disambiguation rule matched",
        );

        return {
          disambiguated: true,
          winnerType: matchedRule.winner,
          ruleId: matchedRule.id,
          reason: matchedRule.reason,
        };
      }
    }

    // 无匹配规则，尝试基于位置消歧
    // 规则：如果多个意图匹配，优先选择匹配位置更靠后的（通常是核心动词）
    const sortedByPosition = [...candidates].sort(
      (a, b) => b.matchIndex - a.matchIndex,
    );

    // 如果位置差距大于 5 个字符，使用位置消歧
    if (
      sortedByPosition.length >= 2 &&
      sortedByPosition[0].matchIndex - sortedByPosition[1].matchIndex > 5
    ) {
      logger.debug(
        {
          message: message.substring(0, 50),
          winner: sortedByPosition[0].type,
          positions: candidates.map((c) => ({
            type: c.type,
            index: c.matchIndex,
          })),
        },
        "IntentClassifier: Position-based disambiguation",
      );

      return {
        disambiguated: true,
        winnerType: sortedByPosition[0].type,
        ruleId: "position-based",
        reason: "后置核心动词优先",
      };
    }

    return { disambiguated: false };
  }

  /**
   * 添加自定义消歧规则
   *
   * @param rule - 消歧规则
   */
  addDisambiguationRule(rule: DisambiguationRule): void {
    this.disambiguationRules.unshift(rule);
    this.disambiguationRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取所有消歧规则（用于调试）
   */
  getDisambiguationRules(): DisambiguationRule[] {
    return [...this.disambiguationRules];
  }

  /**
   * 获取 LLM 分类器（用于调试和状态监控）
   */
  getLLMClassifier(): LLMIntentClassifier | null {
    return this.llmClassifier;
  }

  /**
   * 检查 LLM 分类器是否已启用
   */
  isLLMFallbackEnabled(): boolean {
    return this.llmClassifier !== null;
  }

  /**
   * 获取 LLM 分类器缓存统计（用于监控）
   */
  getLLMCacheStats(): {
    size: number;
    activeCount: number;
    expiredCount: number;
  } | null {
    return this.llmClassifier?.getCacheStats() ?? null;
  }

  /**
   * 清理 LLM 分类器缓存
   */
  cleanupLLMCache(): number {
    return this.llmClassifier?.cleanupCache() ?? 0;
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
