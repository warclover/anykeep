/**
 * 规则学习模块类型定义
 *
 * 从用户纠正行为中自动学习和提取规则
 *
 * @module ai-agent/preferences/rule-learning
 * @version 1.0.0
 * @since 2025-12-30
 * @description Phase 3 - 规则自动学习
 */

import type { IntentType } from "@/lib/ai-skills/router/types";

// =============================================================================
// 规则类型
// =============================================================================

/**
 * 提取的规则
 */
export interface ExtractedRule {
  /** 规则 ID */
  id: string;
  /** 规则类型 */
  type: RuleType;
  /** 触发条件（意图或关键词） */
  condition: RuleCondition;
  /** 规则动作 */
  action: RuleAction;
  /** 置信度 (0-1) */
  confidence: number;
  /** 观测次数 */
  observedCount: number;
  /** 最后触发时间 */
  lastTriggeredAt: number;
  /** 创建时间 */
  createdAt: number;
  /** 是否激活 */
  isActive: boolean;
  /** 规则来源 */
  source: "correction" | "explicit" | "inferred";
}

/**
 * 规则类型
 */
export type RuleType =
  | "intent_override" // 意图覆盖：用户总是希望 X 被解释为 Y
  | "param_default" // 参数默认值：某意图总是使用特定参数
  | "action_chain" // 动作链：执行 A 后自动执行 B
  | "context_trigger" // 上下文触发：某条件下自动触发某意图
  | "exclusion"; // 排除规则：不要做某事

/**
 * 规则条件
 */
export interface RuleCondition {
  /** 意图类型匹配 */
  intentType?: IntentType;
  /** 子类型匹配 */
  subType?: string;
  /** 关键词匹配（任一） */
  keywords?: string[];
  /** 正则匹配 */
  pattern?: string;
  /** 时间条件（如：周一早上） */
  timeCondition?: TimeCondition;
  /** 上下文条件 */
  contextCondition?: ContextCondition;
}

/**
 * 时间条件
 */
export interface TimeCondition {
  /** 星期几 (0-6, 0=周日) */
  dayOfWeek?: number[];
  /** 小时范围 (0-23) */
  hourRange?: { start: number; end: number };
}

/**
 * 上下文条件
 */
export interface ContextCondition {
  /** 最小书签数 */
  minBookmarks?: number;
  /** 最大书签数 */
  maxBookmarks?: number;
  /** 特定平台 */
  platform?: string;
  /** 特定标签存在 */
  hasTag?: string;
}

/**
 * 规则动作
 */
export interface RuleAction {
  /** 动作类型 */
  type: "override_intent" | "set_param" | "chain_action" | "skip" | "notify";
  /** 覆盖后的意图 */
  targetIntent?: IntentType;
  /** 覆盖后的子类型 */
  targetSubType?: string;
  /** 设置的参数 */
  params?: Record<string, unknown>;
  /** 链式动作 */
  chainedAction?: string;
  /** 通知消息 */
  notifyMessage?: string;
}

// =============================================================================
// 纠正分析类型
// =============================================================================

/**
 * 纠正模式
 */
export interface CorrectionPattern {
  /** 原始意图 */
  originalIntent: IntentType;
  /** 原始子类型 */
  originalSubType?: string;
  /** 纠正后意图 */
  correctedIntent: IntentType;
  /** 纠正后子类型 */
  correctedSubType?: string;
  /** 出现次数 */
  count: number;
  /** 最近出现时间 */
  lastSeen: number;
  /** 相关消息样本 */
  messageSamples: string[];
}

/**
 * 规则候选
 */
export interface RuleCandidate {
  /** 建议的规则 */
  rule: Omit<ExtractedRule, "id" | "createdAt" | "lastTriggeredAt">;
  /** 支持度 (0-1) */
  support: number;
  /** 置信度 (0-1) */
  confidence: number;
  /** 提升度 (相对于随机的提升) */
  lift: number;
}

// =============================================================================
// 配置类型
// =============================================================================

/**
 * 规则提取器配置
 */
export interface RuleExtractorConfig {
  /** 最小观测次数才生成规则 */
  minObservations: number;
  /** 最小置信度阈值 */
  minConfidence: number;
  /** 最大规则数量 */
  maxRules: number;
  /** 规则过期天数 */
  ruleExpirationDays: number;
  /** 是否启用自动激活 */
  autoActivateRules: boolean;
  /** 自动激活阈值 */
  autoActivateThreshold: number;
}

// =============================================================================
// 服务接口
// =============================================================================

/**
 * 规则提取器接口
 */
export interface IRuleExtractor {
  /** 服务配置 */
  readonly config: RuleExtractorConfig;

  /**
   * 分析纠正记录，提取规则候选
   * @param userId - 用户 ID
   * @returns 规则候选列表
   */
  analyzeCorrections(userId: string): Promise<RuleCandidate[]>;

  /**
   * 获取用户的激活规则
   * @param userId - 用户 ID
   * @returns 激活规则列表
   */
  getActiveRules(userId: string): Promise<ExtractedRule[]>;

  /**
   * 应用规则到意图
   * @param userId - 用户 ID
   * @param intent - 原始意图
   * @param message - 用户消息
   * @returns 应用后的意图和动作
   */
  applyRules(
    userId: string,
    intent: { type: IntentType; subType?: string },
    message: string,
  ): Promise<RuleApplicationResult>;

  /**
   * 激活规则
   * @param userId - 用户 ID
   * @param ruleId - 规则 ID
   */
  activateRule(userId: string, ruleId: string): Promise<void>;

  /**
   * 停用规则
   * @param userId - 用户 ID
   * @param ruleId - 规则 ID
   */
  deactivateRule(userId: string, ruleId: string): Promise<void>;
}

/**
 * 规则应用结果
 */
export interface RuleApplicationResult {
  /** 是否有规则被应用 */
  applied: boolean;
  /** 应用的规则列表 */
  appliedRules: ExtractedRule[];
  /** 修改后的意图 */
  modifiedIntent?: {
    type: IntentType;
    subType?: string;
  };
  /** 附加参数 */
  additionalParams?: Record<string, unknown>;
  /** 链式动作 */
  chainedActions?: string[];
  /** 跳过标志 */
  shouldSkip?: boolean;
  /** 通知消息 */
  notifications?: string[];
}

// =============================================================================
// 常量
// =============================================================================

/**
 * 默认配置
 */
export const DEFAULT_EXTRACTOR_CONFIG: RuleExtractorConfig = {
  minObservations: 3,
  minConfidence: 0.7,
  maxRules: 50,
  ruleExpirationDays: 90,
  autoActivateRules: true,
  autoActivateThreshold: 0.85,
};

/**
 * 日志模块名称
 */
export const LOG_MODULE = "rule-extractor";
