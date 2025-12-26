/**
 * 增强置信度计算器
 *
 * 综合多个因素评估意图理解的置信度
 * 借鉴：Claude Code Agent 的多阶段验证机制
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { DynamicContext } from "./types";

/**
 * 意图类型（简化版，用于置信度计算）
 */
export type IntentType =
  | "query"
  | "action"
  | "organize"
  | "analyze"
  | "learn"
  | "create"
  | "chitchat";

/**
 * 实体类型
 */
export type EntityType =
  | "platform"
  | "folder"
  | "tag"
  | "topic"
  | "quantity"
  | "time"
  | "target";

/**
 * 提取的实体
 */
export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: number;
  raw: string;
}

/**
 * 意图分类结果（简化版）
 */
export interface IntentClassificationLite {
  type: IntentType;
  subType?: string;
  confidence: number;
  entities: ExtractedEntity[];
}

/**
 * 置信度因素
 */
export interface ConfidenceFactor {
  /** 因素名称 */
  name: string;
  /** 权重（0-1） */
  weight: number;
  /** 分数（0-1） */
  score: number;
  /** 说明 */
  reason: string;
}

/**
 * 增强置信度结果
 */
export interface EnhancedConfidenceResult {
  /** 原始置信度 */
  originalConfidence: number;
  /** 增强后置信度 */
  enhancedConfidence: number;
  /** 各因素详情 */
  factors: ConfidenceFactor[];
  /** 置信度级别 */
  level: "high" | "medium" | "low";
  /** 建议的执行策略 */
  suggestedStrategy: "silent" | "explain" | "clarify";
}

/**
 * 扩展偏好类型
 */
interface ExtendedPreferences {
  frequentActions?: IntentType[];
}

/**
 * 获取意图类型所需的实体
 */
function getRequiredEntities(intentType: IntentType): EntityType[] {
  const requirements: Record<IntentType, EntityType[]> = {
    query: [],
    action: ["target"],
    organize: ["platform", "folder"],
    analyze: ["time"],
    learn: ["topic"],
    create: ["topic"],
    chitchat: [],
  };
  return requirements[intentType] ?? [];
}

/**
 * 计算实体完整度
 */
function calculateEntityCompleteness(
  intent: IntentClassificationLite,
): ConfidenceFactor {
  const requiredEntities = getRequiredEntities(intent.type);

  if (requiredEntities.length === 0) {
    return {
      name: "entity_completeness",
      weight: 0.15,
      score: 1.0,
      reason: "此意图类型无必需实体",
    };
  }

  const foundEntities = intent.entities.map((e) => e.type);
  const matchCount = requiredEntities.filter((e) =>
    foundEntities.includes(e),
  ).length;
  const completeness = matchCount / requiredEntities.length;

  return {
    name: "entity_completeness",
    weight: 0.15,
    score: completeness,
    reason:
      completeness === 1
        ? "所有必需实体已提取"
        : `缺少实体: ${requiredEntities.filter((e) => !foundEntities.includes(e)).join(", ")}`,
  };
}

/**
 * 计算上下文相关度
 */
function calculateContextRelevance(
  intent: IntentClassificationLite,
  context: DynamicContext,
): ConfidenceFactor {
  let score = 0.8; // 基础分
  let reason = "上下文相关度正常";

  // 整理意图但收藏太少
  if (intent.type === "organize" && context.stats.totalBookmarks < 10) {
    score = 0.5;
    reason = "收藏数量较少，整理意图可能不准确";
  }

  // 搜索意图但没有关键词实体
  if (
    intent.type === "query" &&
    intent.subType === "search" &&
    !intent.entities.some((e) => e.type === "topic")
  ) {
    score = 0.6;
    reason = "搜索意图但未提取到关键词";
  }

  // 平台相关但平台不匹配
  const platformEntity = intent.entities.find((e) => e.type === "platform");
  if (
    platformEntity &&
    context.stats.topPlatform.name.toLowerCase() !==
      platformEntity.value.toLowerCase()
  ) {
    // 提及的平台不是用户最常用的，略微降低置信度
    score *= 0.95;
    reason = "提及的平台非用户最常用";
  }

  return {
    name: "context_relevance",
    weight: 0.2,
    score,
    reason,
  };
}

/**
 * 计算历史行为匹配度
 */
function calculateHistoryMatch(
  intent: IntentClassificationLite,
  context: DynamicContext,
): ConfidenceFactor {
  const preferences = context.preferences as ExtendedPreferences;
  const frequentActions = preferences.frequentActions ?? [];

  if (frequentActions.length === 0) {
    return {
      name: "history_match",
      weight: 0.1,
      score: 0.7,
      reason: "无历史行为数据",
    };
  }

  const isFrequent = frequentActions.includes(intent.type);

  return {
    name: "history_match",
    weight: 0.1,
    score: isFrequent ? 1.0 : 0.7,
    reason: isFrequent ? "符合用户常见操作模式" : "非用户常见操作类型",
  };
}

/**
 * 计算消息清晰度
 */
function calculateMessageClarity(
  message: string,
  intent: IntentClassificationLite,
): ConfidenceFactor {
  let score = 0.8;
  let reason = "消息清晰度正常";

  // 消息太短
  if (message.length < 5) {
    score = 0.5;
    reason = "消息过短，可能信息不足";
  }

  // 消息太长（可能包含多个意图）
  if (message.length > 100) {
    score = 0.7;
    reason = "消息较长，可能包含多个意图";
  }

  // 包含问号（可能是疑问而非指令）
  if (message.includes("?") || message.includes("？")) {
    if (intent.type !== "query") {
      score *= 0.9;
      reason = "消息为疑问句，但识别为非查询意图";
    }
  }

  return {
    name: "message_clarity",
    weight: 0.15,
    score,
    reason,
  };
}

/**
 * 计算增强置信度
 *
 * @param intent 意图分类结果
 * @param context 动态上下文
 * @param message 原始用户消息
 */
export function calculateEnhancedConfidence(
  intent: IntentClassificationLite,
  context: DynamicContext,
  message: string,
): EnhancedConfidenceResult {
  const factors: ConfidenceFactor[] = [
    // 因素1：原始规则置信度
    {
      name: "rule_confidence",
      weight: 0.4,
      score: intent.confidence,
      reason: `规则匹配置信度: ${(intent.confidence * 100).toFixed(0)}%`,
    },
    // 因素2：实体完整度
    calculateEntityCompleteness(intent),
    // 因素3：上下文相关度
    calculateContextRelevance(intent, context),
    // 因素4：历史行为匹配
    calculateHistoryMatch(intent, context),
    // 因素5：消息清晰度
    calculateMessageClarity(message, intent),
  ];

  // 计算加权平均
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
  const enhancedConfidence = Math.min(
    1,
    Math.max(0, weightedSum / totalWeight),
  );

  // 确定置信度级别
  let level: "high" | "medium" | "low";
  let suggestedStrategy: "silent" | "explain" | "clarify";

  if (enhancedConfidence >= 0.85) {
    level = "high";
    suggestedStrategy = "silent";
  } else if (enhancedConfidence >= 0.6) {
    level = "medium";
    suggestedStrategy = "explain";
  } else {
    level = "low";
    suggestedStrategy = "clarify";
  }

  return {
    originalConfidence: intent.confidence,
    enhancedConfidence,
    factors,
    level,
    suggestedStrategy,
  };
}

/**
 * 快速计算增强置信度（不返回详情）
 */
export function getEnhancedConfidence(
  intent: IntentClassificationLite,
  context: DynamicContext,
  message: string,
): number {
  return calculateEnhancedConfidence(intent, context, message)
    .enhancedConfidence;
}
