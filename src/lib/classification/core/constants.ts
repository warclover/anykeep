/**
 * Classification Core Constants
 * 常量定义
 *
 * @version 1.0.0
 * @since 2026-01-24 Phase 2
 */

/**
 * 置信度阈值
 */
export const CONFIDENCE_THRESHOLDS = {
  /** 自动分类阈值 - 高于此值直接分类 */
  AUTO_CLASSIFY: 80,

  /** 建议阈值 - 高于此值保存建议 */
  SUGGEST: 60,

  /** T1 触发阈值 - 低于此值触发 T1 纠正 */
  T1_TRIGGER: 70,

  /** 收件箱阈值 - 低于此值放入收件箱 */
  INBOX: 0,
} as const;

/**
 * 分类状态
 */
export const CLASSIFICATION_STATUS = {
  /** 待分类 */
  PENDING: "pending",

  /** 分类中 */
  PROCESSING: "processing",

  /** 已分类 */
  CLASSIFIED: "classified",

  /** 已建议 */
  SUGGESTED: "suggested",

  /** 待整理 */
  INBOX: "inbox",

  /** 分类失败 */
  FAILED: "failed",
} as const;

/**
 * 灰度发布阶段
 */
export const ROLLOUT_STAGE = {
  DISABLED: 0,
  CANARY: 5,
  EARLY: 20,
  MAJORITY: 50,
  FULL: 100,
} as const;

/**
 * 文件夹限制
 */
export const FOLDER_LIMITS = {
  /** ��日自动创建上限 */
  MAX_AUTO_CREATE_PER_DAY: 5,

  /** 最大文件夹数量 */
  MAX_FOLDERS: 100,

  /** 文件夹名称最大长度 */
  MAX_NAME_LENGTH: 50,
} as const;

/**
 * 缓存配置
 */
export const CACHE_CONFIG = {
  /** Pipeline 缓存 TTL (毫秒) */
  PIPELINE_TTL_MS: 10 * 60 * 1000, // 10 分钟

  /** 文件夹 Profile 缓存 TTL (毫秒) */
  FOLDER_PROFILE_TTL_MS: 5 * 60 * 1000, // 5 分钟
} as const;

/**
 * 默认 Feature Flags
 */
export const DEFAULT_FEATURE_FLAGS = {
  defaultStrategy: "modern" as const,
  rolloutStage: ROLLOUT_STAGE.FULL,
  rolloutPercentage: 100,
  userWhitelist: [] as string[],
  userBlacklist: [] as string[],

  enableL0Rules: true,
  enableT1Correction: true,
  enableCrystalGrowth: false,

  enableAISelection: true,
  enableAICreate: true,

  autoClassifyThreshold: CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY,
  suggestThreshold: CONFIDENCE_THRESHOLDS.SUGGEST,
  t1TriggerThreshold: CONFIDENCE_THRESHOLDS.T1_TRIGGER,

  enablePipelineCache: true,
  pipelineCacheTtlMs: CACHE_CONFIG.PIPELINE_TTL_MS,
} as const;
