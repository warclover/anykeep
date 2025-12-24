/**
 * 智能分类系统 - 集中默认配置
 *
 * 所有服务的默认配置值统一管理，便于：
 * - 全局调整参数
 * - 环境差异化配置
 * - A/B 测试
 * - 配置审计
 *
 * @since 2025-12-24 (Phase 3.1 - 配置解耦)
 */

// ============================================================================
// 纠错缓存配置
// ============================================================================

/**
 * CorrectionCache 默认配置
 */
export const CORRECTION_CACHE_DEFAULTS = {
  /** 缓存过期时间 (ms)，默认 7 天 */
  expirationMs: 7 * 24 * 60 * 60 * 1000,
  /** 最大缓存条目数 */
  maxEntries: 10000,
  /** 是否启用相似 URL 匹配 */
  enableSimilarUrlMatching: true,
  /** 清理间隔 (ms)，默认 1 小时 */
  cleanupIntervalMs: 60 * 60 * 1000,
} as const;

// ============================================================================
// 重排序服务配置
// ============================================================================

/**
 * Reranker 默认配置
 */
export const RERANKER_DEFAULTS = {
  /** 用户偏好权重 (0-1) */
  preferenceWeight: 0.2,
  /** 时间衰减权重 (0-1) */
  recencyWeight: 0.15,
  /** 文件夹质量权重 (0-1) */
  qualityWeight: 0.1,
  /** 历史回溯天数 */
  lookbackDays: 90,
  /** 最大返回候选数 */
  maxCandidates: 5,
} as const;

// ============================================================================
// 配置中心默认值
// ============================================================================

/**
 * ConfigCenter 阈值默认值
 */
export const THRESHOLDS_DEFAULTS = {
  /** Tier 1 直接分类阈值 */
  tier1DirectThreshold: 85,
  /** Tier 2 AI 确认阈值 */
  tier2ConfirmThreshold: 60,
  /** 自动创建文件夹阈值 */
  autoCreateThreshold: 40,
  /** 待整理阈值 */
  inboxThreshold: 30,
} as const;

/**
 * ConfigCenter AI 配置默认值
 */
export const AI_CONFIG_DEFAULTS = {
  /** 是否启用 AI */
  enabled: true,
  /** 模型名称 */
  model: "gpt-4o-mini",
  /** 最大 Token 数 */
  maxTokens: 500,
  /** 温度参数 */
  temperature: 0.3,
} as const;

/**
 * ConfigCenter 功能开关默认值
 */
export const CONFIG_CENTER_FEATURE_FLAGS_DEFAULTS = {
  /** 是否启用自动创建文件夹 */
  enableAutoCreate: true,
  /** 是否启用 AI 确认 */
  enableAIConfirm: true,
  /** 是否启用 KNN 直接匹配 */
  enableKnnDirect: true,
  /** 是否启用通用分类 */
  enableUniversalCategory: true,
  /** 是否启用纠错缓存 */
  enableCorrectionCache: true,
} as const;

// ============================================================================
// 分层分类配置
// ============================================================================

/**
 * TieredClassification 默认配置
 */
export const TIERED_CLASSIFICATION_DEFAULTS = {
  /** Tier 1 置信度阈值 */
  tier1Threshold: 85,
  /** Tier 2 置信度阈值 */
  tier2Threshold: 60,
  /** 自动创建阈值 */
  autoCreateThreshold: 40,
  /** 是否启用 AI */
  enableAI: true,
  /** 是否启用自动创建 */
  enableAutoCreate: true,
  /** 最大候选数 */
  maxCandidates: 5,
} as const;

// ============================================================================
// 动态权重配置
// ============================================================================

/**
 * DynamicWeights 匹配器权重默认值
 */
export const MATCHER_WEIGHTS_DEFAULTS = {
  vector: 0.35,
  tag: 0.25,
  fingerprint: 0.2,
  history: 0.2,
} as const;

/**
 * DynamicWeights 阈值默认值
 */
export const DYNAMIC_WEIGHTS_THRESHOLDS_DEFAULTS = {
  highConfidence: 85,
  mediumConfidence: 60,
  lowConfidence: 40,
} as const;

// ============================================================================
// 增量画像配置
// ============================================================================

/**
 * IncrementalProfile 默认配置
 */
export const INCREMENTAL_PROFILE_DEFAULTS = {
  /** 衰减因子 (0-1)，越大越重视新数据 */
  decayFactor: 0.85,
  /** 最小更新间隔 (ms) */
  minUpdateInterval: 60 * 1000,
  /** 批量更新大小 */
  batchSize: 10,
} as const;

// ============================================================================
// 命名引擎配置
// ============================================================================

/**
 * NamingEngine 默认配置
 */
export const NAMING_ENGINE_DEFAULTS = {
  /** 最大名称长度 */
  maxNameLength: 20,
  /** 候选数量 */
  candidateCount: 3,
  /** 是否使用 AI */
  useAI: true,
} as const;

// ============================================================================
// 回填分类配置
// ============================================================================

/**
 * BackfillClassification 默认配置
 */
export const BACKFILL_DEFAULTS = {
  /** 批量大小 */
  batchSize: 50,
  /** 最小置信度 */
  minConfidence: 70,
  /** 最大并发数 */
  maxConcurrency: 3,
} as const;

// ============================================================================
// 巡检服务配置
// ============================================================================

/**
 * LibrarianPatrol 默认配置
 */
export const PATROL_DEFAULTS = {
  /** 巡检间隔 (ms)，默认 1 小时 */
  intervalMs: 60 * 60 * 1000,
  /** 每次巡检最大书签数 */
  maxBookmarksPerRun: 100,
  /** 重分类置信度阈值 */
  reclassifyThreshold: 75,
} as const;

// ============================================================================
// 用户场景检测配置
// ============================================================================

/**
 * UserScenarioDetector 场景阈值默认值
 */
export const SCENARIO_THRESHOLDS_DEFAULTS = {
  /** 冷启动书签数阈值 */
  coldStartBookmarkCount: 20,
  /** 成长期书签数阈值 */
  growthBookmarkCount: 100,
  /** 稳定期书签数阈值 */
  stableBookmarkCount: 500,
  /** 高活跃度阈值（日均）*/
  highActivityThreshold: 10,
  /** 低活跃度阈值（日均）*/
  lowActivityThreshold: 1,
} as const;

// ============================================================================
// AI 管家配置
// ============================================================================

/**
 * AILibrarian 默认配置
 */
export const AI_LIBRARIAN_DEFAULTS = {
  /** 建议生成间隔 (ms)，默认 1 天 */
  suggestionIntervalMs: 24 * 60 * 60 * 1000,
  /** 每次最大建议数 */
  maxSuggestionsPerRun: 10,
  /** 建议置信度阈值 */
  suggestionThreshold: 70,
} as const;

// ============================================================================
// 可变配置类型（用于运行时覆盖）
// ============================================================================

/** 阈值配置类型 */
export interface ThresholdsConfig {
  tier1DirectThreshold: number;
  tier2ConfirmThreshold: number;
  autoCreateThreshold: number;
  inboxThreshold: number;
}

/** AI 配置类型 */
export interface AIConfigType {
  enabled: boolean;
  model: string;
  maxTokens: number;
  temperature: number;
}

/** 功能开关类型 */
export interface ConfigCenterFeatureFlagsType {
  enableAutoCreate: boolean;
  enableAIConfirm: boolean;
  enableKnnDirect: boolean;
  enableUniversalCategory: boolean;
  enableCorrectionCache: boolean;
}

/**
 * 完整的配置类型（可变版本）
 */
export interface ClassificationConfiguration {
  correctionCache: {
    expirationMs: number;
    maxEntries: number;
    enableSimilarUrlMatching: boolean;
    cleanupIntervalMs: number;
  };
  reranker: {
    preferenceWeight: number;
    recencyWeight: number;
    qualityWeight: number;
    lookbackDays: number;
    maxCandidates: number;
  };
  thresholds: ThresholdsConfig;
  aiConfig: AIConfigType;
  featureFlags: ConfigCenterFeatureFlagsType;
  tieredClassification: {
    tier1Threshold: number;
    tier2Threshold: number;
    autoCreateThreshold: number;
    enableAI: boolean;
    enableAutoCreate: boolean;
    maxCandidates: number;
  };
  matcherWeights: {
    vector: number;
    tag: number;
    fingerprint: number;
    history: number;
  };
  dynamicWeightsThresholds: {
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
  incrementalProfile: {
    decayFactor: number;
    minUpdateInterval: number;
    batchSize: number;
  };
  namingEngine: {
    maxNameLength: number;
    candidateCount: number;
    useAI: boolean;
  };
  backfill: {
    batchSize: number;
    minConfidence: number;
    maxConcurrency: number;
  };
  patrol: {
    intervalMs: number;
    maxBookmarksPerRun: number;
    reclassifyThreshold: number;
  };
  scenarioThresholds: {
    coldStartBookmarkCount: number;
    growthBookmarkCount: number;
    stableBookmarkCount: number;
    highActivityThreshold: number;
    lowActivityThreshold: number;
  };
  aiLibrarian: {
    suggestionIntervalMs: number;
    maxSuggestionsPerRun: number;
    suggestionThreshold: number;
  };
}

/**
 * 完整的默认配置对象
 */
export const DEFAULT_CLASSIFICATION_CONFIG: ClassificationConfiguration = {
  correctionCache: CORRECTION_CACHE_DEFAULTS,
  reranker: RERANKER_DEFAULTS,
  thresholds: THRESHOLDS_DEFAULTS,
  aiConfig: AI_CONFIG_DEFAULTS,
  featureFlags: CONFIG_CENTER_FEATURE_FLAGS_DEFAULTS,
  tieredClassification: TIERED_CLASSIFICATION_DEFAULTS,
  matcherWeights: MATCHER_WEIGHTS_DEFAULTS,
  dynamicWeightsThresholds: DYNAMIC_WEIGHTS_THRESHOLDS_DEFAULTS,
  incrementalProfile: INCREMENTAL_PROFILE_DEFAULTS,
  namingEngine: NAMING_ENGINE_DEFAULTS,
  backfill: BACKFILL_DEFAULTS,
  patrol: PATROL_DEFAULTS,
  scenarioThresholds: SCENARIO_THRESHOLDS_DEFAULTS,
  aiLibrarian: AI_LIBRARIAN_DEFAULTS,
};

/**
 * 获取特定环境的配置（支持环境变量覆盖）
 */
export function getEnvironmentConfig(): Partial<ClassificationConfiguration> {
  const overrides: Partial<ClassificationConfiguration> = {};

  // 从环境变量读取覆盖值
  const tier1Threshold = process.env.NEXT_PUBLIC_V4_TIER1_THRESHOLD;
  if (tier1Threshold) {
    overrides.thresholds = {
      ...THRESHOLDS_DEFAULTS,
      tier1DirectThreshold: parseInt(tier1Threshold, 10),
    };
  }

  const enableAI = process.env.NEXT_PUBLIC_V4_ENABLE_AI;
  if (enableAI !== undefined) {
    overrides.aiConfig = {
      ...AI_CONFIG_DEFAULTS,
      enabled: enableAI === "true",
    };
  }

  return overrides;
}

// ═══════════════════════════════════════════════════════════════════════════
// 向后兼容导出（V4 别名）
// @deprecated 请使用新名称
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated 使用 ConfigCenterFeatureFlagsType */
export type FeatureFlagsType = ConfigCenterFeatureFlagsType;

/** @deprecated 使用 CONFIG_CENTER_FEATURE_FLAGS_DEFAULTS */
export const FEATURE_FLAGS_DEFAULTS = CONFIG_CENTER_FEATURE_FLAGS_DEFAULTS;

/** @deprecated 使用 ClassificationConfiguration */
export type V4Configuration = ClassificationConfiguration;

/** @deprecated 使用 DEFAULT_CLASSIFICATION_CONFIG */
export const V4_DEFAULT_CONFIG = DEFAULT_CLASSIFICATION_CONFIG;
