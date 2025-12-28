/**
 * Persona Analytics 类型定义
 *
 * @module ai-agent/personas/analytics/types
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaType, PersonaGroup } from "../types";

// =============================================================================
// 事件类型定义
// =============================================================================

/**
 * 画像推断事件
 */
export interface PersonaInferredEvent {
  /** 用户 ID */
  userId: string;
  /** 推断的画像类型 */
  personaType: PersonaType;
  /** 画像分组 */
  personaGroup: PersonaGroup;
  /** 置信度 (0-100) */
  confidence: number;
  /** 备选画像数量 */
  alternativesCount: number;
  /** 书签数量（用于推断） */
  bookmarkCount: number;
  /** 推断耗时 (ms) */
  inferenceTimeMs: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 画像设置变更事件
 */
export interface PersonaSettingsChangedEvent {
  /** 用户 ID */
  userId: string;
  /** 变更类型 */
  changeType: "set_manual" | "reset_to_inferred" | "update_preferences";
  /** 之前的画像类型 */
  previousType: PersonaType | null;
  /** 新的画像类型 */
  newType: PersonaType | null;
  /** 之前的来源 */
  previousSource: "inferred" | "manual" | null;
  /** 新的来源 */
  newSource: "inferred" | "manual";
  /** 时间戳 */
  timestamp: string;
}

/**
 * 画像意图路由事件
 */
export interface PersonaIntentRoutedEvent {
  /** 用户 ID */
  userId: string;
  /** 使用的画像类型 */
  personaType: PersonaType;
  /** 意图类型 */
  intentType: string;
  /** 意图子类型 */
  intentSubType?: string;
  /** 是否应用了画像加成 */
  boostApplied: boolean;
  /** 原始置信度 */
  originalConfidence: number;
  /** 加成后置信度 */
  boostedConfidence: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 画像功能错误事件
 */
export interface PersonaErrorEvent {
  /** 用户 ID */
  userId: string;
  /** 错误类型 */
  errorType:
    | "inference_failed"
    | "settings_save_failed"
    | "prompt_inject_failed";
  /** 错误消息 */
  errorMessage: string;
  /** 错误上下文 */
  context?: Record<string, unknown>;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 画像灰度发布状态事件
 */
export interface PersonaRolloutCheckEvent {
  /** 用户 ID */
  userId: string;
  /** 是否在灰度范围内 */
  inRollout: boolean;
  /** 当前灰度百分比 */
  rolloutPercentage: number;
  /** 用户哈希值 (0-99) */
  userHash: number;
  /** 时间戳 */
  timestamp: string;
}

// =============================================================================
// 事件类型映射
// =============================================================================

/**
 * 画像分析事件类型映射
 */
export interface PersonaEventTypes {
  "persona:inferred": PersonaInferredEvent;
  "persona:settings_changed": PersonaSettingsChangedEvent;
  "persona:intent_routed": PersonaIntentRoutedEvent;
  "persona:error": PersonaErrorEvent;
  "persona:rollout_check": PersonaRolloutCheckEvent;
}

/**
 * 画像事件名称联合类型
 */
export type PersonaEventName = keyof PersonaEventTypes;

/**
 * 获取画像事件负载类型
 */
export type PersonaEventPayload<K extends PersonaEventName> =
  PersonaEventTypes[K];

// =============================================================================
// 统计类型定义
// =============================================================================

/**
 * 画像分布统计
 */
export interface PersonaDistributionStats {
  /** 按类型统计 */
  byType: Array<{
    type: PersonaType;
    count: number;
    percentage: number;
  }>;
  /** 按分组统计 */
  byGroup: Array<{
    group: PersonaGroup;
    count: number;
    percentage: number;
  }>;
  /** 按来源统计 */
  bySource: {
    inferred: number;
    manual: number;
  };
  /** 总用户数 */
  totalUsers: number;
  /** 统计时间 */
  generatedAt: string;
}

/**
 * 画像推断统计
 */
export interface PersonaInferenceStats {
  /** 总推断次数 */
  totalInferences: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 成功率 (0-100) */
  successRate: number;
  /** 平均置信度 */
  avgConfidence: number;
  /** 平均耗时 (ms) */
  avgLatencyMs: number;
  /** 按画像类型统计 */
  byType: Array<{
    type: PersonaType;
    count: number;
    avgConfidence: number;
  }>;
  /** 统计周期（天） */
  periodDays: number;
}

/**
 * 画像意图加成统计
 */
export interface PersonaBoostStats {
  /** 总意图路由次数 */
  totalIntents: number;
  /** 应用加成次数 */
  boostAppliedCount: number;
  /** 加成应用率 */
  boostRate: number;
  /** 平均置信度提升 */
  avgConfidenceBoost: number;
  /** 按画像类型统计 */
  byType: Array<{
    type: PersonaType;
    intentCount: number;
    boostRate: number;
  }>;
  /** 统计周期（天） */
  periodDays: number;
}
