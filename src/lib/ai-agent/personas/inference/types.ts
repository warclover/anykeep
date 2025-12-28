/**
 * 画像推断引擎类型定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaType, PersonaGroup } from "../types";

// =============================================================================
// 推断条件类型
// =============================================================================

/**
 * 条件类型枚举
 */
export type ConditionType =
  | "tag_match" // 标签匹配
  | "platform_match" // 平台匹配
  | "content_type_match" // 内容类型匹配
  | "folder_match" // 文件夹匹配
  | "domain_match" // 域名匹配
  | "frequency_check" // 频次检查
  | "time_pattern" // 时间模式
  | "composite"; // 组合条件

/**
 * 条件操作符
 */
export type ConditionOperator =
  | "equals" // 等于
  | "contains" // 包含
  | "matches" // 正则匹配
  | "in" // 在列表中
  | "not_in" // 不在列表中
  | "greater_than" // 大于
  | "less_than" // 小于
  | "between"; // 区间

/**
 * 组合条件逻辑
 */
export type LogicalOperator = "and" | "or" | "not";

/**
 * 基础条件定义
 */
export interface BaseCondition {
  type: ConditionType;
  weight?: number; // 条件权重（0-1），默认 1.0
  required?: boolean; // 是否必须满足，默认 false
}

/**
 * 标签匹配条件
 */
export interface TagMatchCondition extends BaseCondition {
  type: "tag_match";
  patterns: RegExp[]; // 匹配模式
  operator: "any" | "all"; // 任一匹配 / 全部匹配
  minMatchCount?: number; // 最小匹配数量
}

/**
 * 平台匹配条件
 */
export interface PlatformMatchCondition extends BaseCondition {
  type: "platform_match";
  platforms: string[]; // 平台列表
  operator: "any" | "all" | "primary"; // 任一 / 全部 / 主要平台
  minRatio?: number; // 最小占比（0-1）
}

/**
 * 内容类型匹配条件
 */
export interface ContentTypeMatchCondition extends BaseCondition {
  type: "content_type_match";
  contentTypes: string[]; // 内容类型列表
  operator: "any" | "all";
  minMatchCount?: number;
}

/**
 * 文件夹匹配条件
 */
export interface FolderMatchCondition extends BaseCondition {
  type: "folder_match";
  patterns: RegExp[]; // 文件夹名称模式
  operator: "any" | "all";
}

/**
 * 域名匹配条件
 */
export interface DomainMatchCondition extends BaseCondition {
  type: "domain_match";
  patterns: RegExp[]; // 域名模式
  operator: "any" | "all";
  minMatchCount?: number;
}

/**
 * 频次检查条件
 */
export interface FrequencyCheckCondition extends BaseCondition {
  type: "frequency_check";
  metric: "daily" | "weekly" | "monthly" | "total";
  operator: ConditionOperator;
  value: number;
  compareValue?: number; // 用于 between
}

/**
 * 时间模式条件
 */
export interface TimePatternCondition extends BaseCondition {
  type: "time_pattern";
  pattern:
    | "morning"
    | "afternoon"
    | "evening"
    | "night"
    | "weekday"
    | "weekend";
  minRatio?: number; // 该时段占比
}

/**
 * 组合条件
 */
export interface CompositeCondition extends BaseCondition {
  type: "composite";
  logic: LogicalOperator;
  conditions: InferenceCondition[];
}

/**
 * 推断条件联合类型
 */
export type InferenceCondition =
  | TagMatchCondition
  | PlatformMatchCondition
  | ContentTypeMatchCondition
  | FolderMatchCondition
  | DomainMatchCondition
  | FrequencyCheckCondition
  | TimePatternCondition
  | CompositeCondition;

// =============================================================================
// 推断规则类型
// =============================================================================

/**
 * 推断规则定义
 */
export interface InferenceRule {
  id: string; // 规则 ID
  name: string; // 规则名称
  description?: string; // 规则描述
  targetPersona: PersonaType; // 目标画像
  targetGroup: PersonaGroup; // 目标分组
  priority: number; // 优先级（1-100，越高越优先）
  conditions: InferenceCondition[]; // 条件列表
  conditionLogic: LogicalOperator; // 条件间逻辑（默认 and）
  minConfidence: number; // 最小置信度阈值（0-1）
  enabled: boolean; // 是否启用
}

/**
 * 规则匹配结果
 */
export interface RuleMatchResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  confidence: number; // 匹配置信度（0-1）
  matchedConditions: string[]; // 匹配的条件描述
  failedConditions: string[]; // 未匹配的条件描述
  targetPersona: PersonaType;
  targetGroup: PersonaGroup;
}

// =============================================================================
// 用户行为数据类型
// =============================================================================

/**
 * 用户行为数据（用于推断）
 */
export interface UserBehaviorData {
  // 标签相关
  tags: string[]; // 所有标签
  tagCounts: Record<string, number>; // 标签使用次数

  // 平台相关
  platforms: string[]; // 收藏来源平台
  platformCounts: Record<string, number>; // 各平台收藏数

  // 内容相关
  contentTypes: string[]; // 内容类型
  contentTypeCounts: Record<string, number>;

  // 文件夹相关
  folders: string[]; // 文件夹名称
  folderCounts: Record<string, number>;

  // 域名相关
  domains: string[]; // 收藏 URL 域名
  domainCounts: Record<string, number>;

  // 时间模式
  timePatterns: {
    hourDistribution: number[]; // 24 小时分布
    weekdayDistribution: number[]; // 星期分布
  };

  // 活跃度
  activityMetrics: {
    totalBookmarks: number;
    recentWeekCount: number;
    recentMonthCount: number;
    avgDailyCount: number;
  };
}

// =============================================================================
// 推断引擎类型
// =============================================================================

/**
 * 推断引擎配置
 */
export interface InferenceEngineConfig {
  /** 最小置信度阈值（低于此值不返回结果） */
  minConfidenceThreshold: number;
  /** 最大返回结果数 */
  maxResults: number;
  /** 是否启用调试模式 */
  debug: boolean;
  /** 是否使用缓存 */
  enableCache: boolean;
  /** 缓存 TTL（毫秒） */
  cacheTtlMs: number;
}

/**
 * 推断结果
 */
export interface InferenceResult {
  /** 推荐画像 */
  recommendedPersona: PersonaType;
  /** 推荐画像分组 */
  recommendedGroup: PersonaGroup;
  /** 置信度（0-1） */
  confidence: number;
  /** 匹配的规则列表 */
  matchedRules: RuleMatchResult[];
  /** 备选画像（按置信度排序） */
  alternatives: Array<{
    persona: PersonaType;
    group: PersonaGroup;
    confidence: number;
  }>;
  /** 推断耗时（毫秒） */
  inferenceTimeMs: number;
  /** 调试信息 */
  debugInfo?: {
    totalRulesEvaluated: number;
    behaviorDataSummary: Record<string, unknown>;
  };
}

/**
 * 推断引擎接口
 */
export interface IInferenceEngine {
  /**
   * 执行画像推断
   * @param behaviorData 用户行为数据
   * @returns 推断结果
   */
  infer(behaviorData: UserBehaviorData): Promise<InferenceResult>;

  /**
   * 注册推断规则
   * @param rule 推断规则
   */
  registerRule(rule: InferenceRule): void;

  /**
   * 获取所有已注册规则
   */
  getRules(): InferenceRule[];

  /**
   * 启用/禁用规则
   * @param ruleId 规则 ID
   * @param enabled 是否启用
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void;

  /**
   * 清除缓存
   */
  clearCache(): void;
}

// =============================================================================
// 默认配置
// =============================================================================

/**
 * 默认推断引擎配置
 */
export const DEFAULT_INFERENCE_CONFIG: InferenceEngineConfig = {
  minConfidenceThreshold: 0.3,
  maxResults: 5,
  debug: false,
  enableCache: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 分钟
};
