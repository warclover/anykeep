/**
 * 画像推断引擎类型定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaType, PersonaGroup } from "../personas/types";

// 重新导出常用类型，方便模块内使用
export type { PersonaType, PersonaGroup };

// =============================================================================
// 推断信号类型
// =============================================================================

/**
 * 推断信号类型
 */
export type InferenceSignalType = "platform" | "tag" | "density" | "content";

/**
 * 单个推断信号
 */
export interface InferenceSignal {
  /** 信号类型 */
  type: InferenceSignalType;
  /** 信号来源（如域名、标签名） */
  source: string;
  /** 匹配的画像列表 */
  personas: PersonaType[];
  /** 信号权重 (0-1) */
  weight: number;
  /** 命中次数 */
  count: number;
}

// =============================================================================
// 推断结果
// =============================================================================

/**
 * 画像推断结果
 */
export interface PersonaInferenceResult {
  /** 推断的主画像 */
  primaryPersona: PersonaType;

  /** 画像分组 */
  group: PersonaGroup;

  /** 置信度 (0-100) */
  confidence: number;

  /** 备选画像（按置信度排序） */
  alternatives: Array<{
    persona: PersonaType;
    confidence: number;
  }>;

  /** 推断依据 */
  signals: InferenceSignal[];

  /** 推断时间戳 */
  inferredAt: string;

  /** 数据样本量 */
  sampleSize: number;
}

// =============================================================================
// 推断配置
// =============================================================================

/**
 * 推断引擎配置
 */
export interface PersonaInferenceConfig {
  /** 最小置信度阈值（低于此值回退到 general） */
  minConfidenceThreshold: number; // 默认 60

  /** 高置信度阈值（高于此值完全信任推断） */
  highConfidenceThreshold: number; // 默认 85

  /** 最小样本量（收藏数量） */
  minSampleSize: number; // 默认 10

  /** 缓存有效期（毫秒） */
  cacheTTL: number; // 默认 1小时

  /** 是否启用推断 */
  enabled: boolean; // Feature Flag 控制
}

/**
 * 默认推断配置
 */
export const DEFAULT_INFERENCE_CONFIG: PersonaInferenceConfig = {
  minConfidenceThreshold: 60,
  highConfidenceThreshold: 85,
  minSampleSize: 10,
  cacheTTL: 60 * 60 * 1000, // 1小时
  enabled: true,
};

// =============================================================================
// 用户统计数据
// =============================================================================

/**
 * 用户收藏统计数据（用于推断）
 */
export interface UserBookmarkStats {
  /** 用户 ID */
  userId: string;

  /** 平台分布 { domain: count } */
  platformDistribution: Record<string, number>;

  /** 标签频率 { tag: count } */
  tagFrequency: Record<string, number>;

  /** 总收藏数 */
  totalBookmarks: number;

  /** 统计时间范围 */
  statsRange: {
    from: string;
    to: string;
  };
}

// =============================================================================
// 平台规则
// =============================================================================

/**
 * 平台画像规则项
 */
export interface PlatformPersonaRule {
  persona: PersonaType;
  weight: number;
}

/**
 * 标签画像规则项
 */
export interface TagPersonaRule {
  pattern: RegExp;
  personas: Array<{
    persona: PersonaType;
    weight: number;
  }>;
}

// =============================================================================
// 信号类型权重
// =============================================================================

/**
 * 信号类型权重配置
 */
export const SIGNAL_TYPE_WEIGHTS: Record<InferenceSignalType, number> = {
  platform: 0.4, // 平台信号权重 40%
  tag: 0.35, // 标签信号权重 35%
  density: 0.15, // 密度信号权重 15%
  content: 0.1, // 内容信号权重 10%（Phase 2+）
};
