/**
 * Trust Mode Configuration
 * V4.2 托管模式配置中心
 *
 * @description 集中管理托管模式的所有配置常量
 * - 阈值配置
 * - 限制配置
 * - 环境变量覆盖
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { TrustMode, TrustModeConfig } from "@/types/trust-mode";
import {
  FULL_AUTO_CONFIG,
  SEMI_AUTO_CONFIG,
  MANUAL_CONFIG,
} from "@/types/trust-mode";

// ============================================================================
// 阈值配置
// ============================================================================

/**
 * 置信度阈值
 */
export const CONFIDENCE_THRESHOLDS = {
  /** 高置信度阈值：高于此值直接执行 */
  HIGH: 80,
  /** 中置信度阈值：介于此值和低阈值之间时需要确认（半托管） */
  MEDIUM: 60,
  /** 低置信度阈值：低于此值放入待整理 */
  LOW: 40,
} as const;

/**
 * 快速路径阈值
 */
export const FAST_PATH_THRESHOLDS = {
  /** 来源匹配最小样本数 */
  MIN_SOURCE_SAMPLES: 3,
  /** 来源匹配最小置信度 */
  MIN_SOURCE_CONFIDENCE: 70,
  /** 标题匹配最小相似度 */
  MIN_TITLE_SIMILARITY: 0.85,
  /** 标签完全匹配最小数量 */
  MIN_TAG_EXACT_MATCHES: 2,
  /** 标签匹配最小分数 */
  MIN_TAG_MATCH_SCORE: 40,
  /** 标签匹配最小匹配数 */
  MIN_TAG_MATCHES: 1,
  /** 标题相似度匹配最小分数 */
  MIN_TITLE_MATCH_SCORE: 60,
  /** 标题匹配最小书签数 */
  MIN_TITLE_BOOKMARK_COUNT: 3,
} as const;

/**
 * 慢速路径阈值
 */
export const SLOW_PATH_THRESHOLDS = {
  /** 向量匹配最小相似度 */
  MIN_VECTOR_SIMILARITY: 0.7,
  /** AI 推荐最小置信度 */
  MIN_AI_CONFIDENCE: 60,
  /** 匹配器一致性阈值 */
  MATCHER_AGREEMENT_THRESHOLD: 0.6,
} as const;

// ============================================================================
// 限制配置
// ============================================================================

/**
 * 文件夹操作限制
 */
export const FOLDER_LIMITS = {
  /** 每日自动创建文件夹上限 */
  DAILY_AUTO_CREATE_LIMIT: 6,
  /** 每日自动合并上限 */
  DAILY_AUTO_MERGE_LIMIT: 3,
  /** 每日自动拆分上限 */
  DAILY_AUTO_SPLIT_LIMIT: 2,
  /** 每日自动重命名上限 */
  DAILY_AUTO_RENAME_LIMIT: 5,
  /** 最小文件夹大小（低于此值不拆分） */
  MIN_FOLDER_SIZE_FOR_SPLIT: 10,
  /** 最大文件夹大小（超过此值考虑拆分） */
  MAX_FOLDER_SIZE_BEFORE_SPLIT: 100,
} as const;

/**
 * 待确认消息限制
 */
export const CONFIRMATION_LIMITS = {
  /** 默认过期天数 */
  DEFAULT_EXPIRY_DAYS: 7,
  /** 最大待确认消息数量（超过后自动过期最旧的） */
  MAX_PENDING_COUNT: 50,
  /** 批量处理数量 */
  BATCH_SIZE: 10,
} as const;

/**
 * 学习限制
 */
export const LEARNING_LIMITS = {
  /** 排除规则最小样本数 */
  MIN_SAMPLES_FOR_EXCLUSION: 2,
  /** 排除规则衰减周期（天） */
  EXCLUSION_DECAY_DAYS: 30,
  /** 最大排除标签数量 */
  MAX_EXCLUDED_TAGS: 20,
  /** 最大排除来源数量 */
  MAX_EXCLUDED_SOURCES: 10,
} as const;

// ============================================================================
// 路由配置
// ============================================================================

/**
 * 内容路由配置
 */
export const CONTENT_ROUTER_CONFIG = {
  /** 快速路径超时（毫秒） */
  FAST_PATH_TIMEOUT_MS: 500,
  /** 慢速路径超时（毫秒） */
  SLOW_PATH_TIMEOUT_MS: 5000,
  /** 内容复杂度阈值（token 数） */
  COMPLEXITY_THRESHOLD: 1000,
  /** 并行匹配器数量 */
  PARALLEL_MATCHERS: 3,
} as const;

// ============================================================================
// 模式配置映射
// ============================================================================

/**
 * 托管模式配置映射
 */
export const TRUST_MODE_CONFIGS: Record<TrustMode, TrustModeConfig> = {
  full_auto: FULL_AUTO_CONFIG,
  semi_auto: SEMI_AUTO_CONFIG,
  manual: MANUAL_CONFIG,
};

/**
 * 获取托管模式配置
 */
export function getTrustModeConfig(mode: TrustMode): TrustModeConfig {
  return TRUST_MODE_CONFIGS[mode];
}

/**
 * 合并用户覆盖配置
 */
export function mergeWithOverrides(
  baseConfig: TrustModeConfig,
  overrides?: Partial<TrustModeConfig>,
): TrustModeConfig {
  if (!overrides) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    mode: baseConfig.mode, // mode 不可覆盖
    classification: {
      ...baseConfig.classification,
      ...(overrides.classification || {}),
    },
    folderManagement: {
      ...baseConfig.folderManagement,
      ...(overrides.folderManagement || {}),
    },
    notification: {
      ...baseConfig.notification,
      ...(overrides.notification || {}),
    },
    learning: {
      ...baseConfig.learning,
      ...(overrides.learning || {}),
    },
  };
}

// ============================================================================
// 环境变量覆盖
// ============================================================================

/**
 * 置信度阈值可变类型
 */
type MutableConfidenceThresholds = {
  HIGH?: number;
  MEDIUM?: number;
  LOW?: number;
};

/**
 * 从环境变量读取配置覆盖
 */
export function getEnvOverrides(): MutableConfidenceThresholds {
  const overrides: MutableConfidenceThresholds = {};

  const highThreshold = process.env.TRUST_MODE_HIGH_CONFIDENCE_THRESHOLD;
  if (highThreshold) {
    overrides.HIGH = parseInt(highThreshold, 10);
  }

  const mediumThreshold = process.env.TRUST_MODE_MEDIUM_CONFIDENCE_THRESHOLD;
  if (mediumThreshold) {
    overrides.MEDIUM = parseInt(mediumThreshold, 10);
  }

  const lowThreshold = process.env.TRUST_MODE_LOW_CONFIDENCE_THRESHOLD;
  if (lowThreshold) {
    overrides.LOW = parseInt(lowThreshold, 10);
  }

  return overrides;
}

/**
 * 置信度阈值类型
 */
export type ConfidenceThresholdsType = {
  HIGH: number;
  MEDIUM: number;
  LOW: number;
};

/**
 * 获取生效的置信度阈值（含环境变量覆盖）
 */
export function getEffectiveConfidenceThresholds(): ConfidenceThresholdsType {
  const envOverrides = getEnvOverrides();
  return {
    ...CONFIDENCE_THRESHOLDS,
    ...envOverrides,
  };
}

// ============================================================================
// 决策辅助
// ============================================================================

/**
 * 判断是否需要确认
 */
export function requiresConfirmation(
  mode: TrustMode,
  confidence: number,
): boolean {
  if (mode === "full_auto") {
    return false; // 完全托管从不需要确认
  }

  if (mode === "manual") {
    return false; // 手动模式不自动分类，也不需要确认
  }

  // 半托管模式：低于阈值需要确认
  const config = getTrustModeConfig(mode);
  const threshold = config.classification.confirmationThreshold || CONFIDENCE_THRESHOLDS.MEDIUM;
  return confidence < threshold;
}

/**
 * 判断是否应该自动分类
 */
export function shouldAutoClassify(mode: TrustMode): boolean {
  const config = getTrustModeConfig(mode);
  return config.classification.autoClassify;
}

/**
 * 判断是否应该自动创建文件夹
 */
export function shouldAutoCreateFolder(mode: TrustMode): boolean {
  const config = getTrustModeConfig(mode);
  return config.folderManagement.autoCreate;
}

/**
 * 获取低置信度处理策略
 */
export function getLowConfidenceAction(
  mode: TrustMode,
): TrustModeConfig["classification"]["lowConfidenceAction"] {
  const config = getTrustModeConfig(mode);
  return config.classification.lowConfidenceAction;
}

// ============================================================================
// 配置版本
// ============================================================================

export const CONFIG_VERSION = {
  version: "1.0.0",
  lastUpdated: "2025-12-11",
  description: "V4.2 Trust Mode Configuration",
};
