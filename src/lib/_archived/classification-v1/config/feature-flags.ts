/**
 * 智能分类功能开关配置
 *
 * 通过功能开关控制分类新功能的启用/禁用
 * 支持渐进式迁移和快速回滚
 *
 * @since 2025-12-24 (Phase 3.1 - 配置解耦)
 */

export interface FeatureFlagsConfig {
  // ═══════════════════════════════════════════════════════════════
  // P0: 基础升级（立即见效）
  // ═══════════════════════════════════════════════════════════════

  /** CoT 思维链 Prompt - 提升准确率 10-15% */
  enableCoTPrompt: boolean;

  /** 反馈闭环 - 记录分类决策，收集学习数据 */
  enableFeedbackLoop: boolean;

  // ═══════════════════════════════════════════════════════════════
  // 置信度阈值
  // ═══════════════════════════════════════════════════════════════

  /** 高置信度阈值 - 自动分类 (默认: 80%) */
  highConfidenceThreshold: number;

  /** 中置信度阈值 - 显示建议 (默认: 60%) */
  mediumConfidenceThreshold: number;

  // ═══════════════════════════════════════════════════════════════
  // P1: 核心功能
  // ═══════════════════════════════════════════════════════════════

  /** 30 个通用分类体系 - 解决冷启动 */
  enableUniversalCategories: boolean;

  /** 回溯分类 - 新文件夹创建后自动整理待整理 */
  enableBackfillClassification: boolean;

  /** 自动创建文件夹增强 - 更智能的创建条件 */
  enableAutoCreateEnhanced: boolean;

  // ═══════════════════════════════════════════════════════════════
  // P2: 性能优化
  // ═══════════════════════════════════════════════════════════════

  /** k-NN 直接锁定 - 高相似度时跳过 AI，减少 30% 调用 */
  enableKnnDirect: boolean;

  /** k-NN 直接锁定阈值 (0-1) */
  knnDirectThreshold: number;

  /** 文件夹意图指纹 - 提升匹配精度 20% */
  enableFolderFingerprint: boolean;

  /** Tag-to-Tag 精准匹配 - 提升可解释性 */
  enableTagMatcher: boolean;

  /** 动态权重调整 - 根据反馈自动调整 */
  enableDynamicWeights: boolean;

  // ═══════════════════════════════════════════════════════════════
  // P3: 高级功能
  // ═══════════════════════════════════════════════════════════════

  /** 整理大师 (AI Librarian) - 全局结构优化 */
  enableAILibrarian: boolean;

  /** 文件夹画像可视化 */
  enableFolderProfileVisualization: boolean;
}

/**
 * 默认配置 - 生产就绪模式
 * 核心功能默认启用
 */
export const FEATURE_FLAGS_DEFAULT: FeatureFlagsConfig = {
  // P0 - 基础功能（启用）
  enableCoTPrompt: true,
  enableFeedbackLoop: true,

  // 置信度阈值
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 60,

  // P1 - 核心功能（启用）
  enableUniversalCategories: true, // 通用分类 - 解决冷启动
  enableBackfillClassification: true, // 回溯分类
  enableAutoCreateEnhanced: true, // 增强自动创建

  // P2 - 性能优化（启用）
  enableKnnDirect: true, // k-NN 直接锁定
  knnDirectThreshold: 0.85, // 降低阈值，更容易触发
  enableFolderFingerprint: true, // 意图指纹
  enableTagMatcher: true, // 标签匹配
  enableDynamicWeights: true, // 动态权重

  // P3 - 高级功能（启用）
  enableAILibrarian: true,
  enableFolderProfileVisualization: true,
};

/**
 * 激进配置 - 全部启用（用于测试）
 */
export const FEATURE_FLAGS_AGGRESSIVE: FeatureFlagsConfig = {
  enableCoTPrompt: true,
  enableFeedbackLoop: true,
  highConfidenceThreshold: 80,
  mediumConfidenceThreshold: 60,
  enableUniversalCategories: true,
  enableBackfillClassification: true,
  enableAutoCreateEnhanced: true,
  enableKnnDirect: true,
  knnDirectThreshold: 0.9,
  enableFolderFingerprint: true,
  enableTagMatcher: true,
  enableDynamicWeights: true,
  enableAILibrarian: true,
  enableFolderProfileVisualization: true,
};

/**
 * 当前生效的配置
 * 可通过环境变量覆盖
 *
 * 逻辑说明：
 * - 默认继承 FEATURE_FLAGS_DEFAULT 的值
 * - 环境变量设置为 "false" 时禁用该功能
 * - 环境变量设置为 "true" 时启用该功能
 * - 未设置环境变量时使用默认值
 */
export const FEATURE_FLAGS: FeatureFlagsConfig = {
  ...FEATURE_FLAGS_DEFAULT,
  // 从环境变量读取覆盖值（只有明确设置为 "false" 才禁用）
  enableCoTPrompt:
    process.env.V3_ENABLE_COT_PROMPT !== "false" &&
    FEATURE_FLAGS_DEFAULT.enableCoTPrompt,
  enableFeedbackLoop:
    process.env.V3_ENABLE_FEEDBACK_LOOP !== "false" &&
    FEATURE_FLAGS_DEFAULT.enableFeedbackLoop,
  // P1 核心功能（默认启用，可通过环境变量禁用）
  enableUniversalCategories:
    process.env.V3_ENABLE_UNIVERSAL_CATEGORIES !== "false" &&
    FEATURE_FLAGS_DEFAULT.enableUniversalCategories,
  enableBackfillClassification:
    process.env.V3_ENABLE_BACKFILL_CLASSIFICATION !== "false" &&
    FEATURE_FLAGS_DEFAULT.enableBackfillClassification,
  enableAutoCreateEnhanced:
    process.env.V3_ENABLE_AUTO_CREATE_ENHANCED !== "false" &&
    FEATURE_FLAGS_DEFAULT.enableAutoCreateEnhanced,
  // P2 性能优化（默认启用，可通过环境变量禁用）
  enableKnnDirect:
    process.env.V3_ENABLE_KNN_DIRECT !== "false" &&
    FEATURE_FLAGS_DEFAULT.enableKnnDirect,
  enableDynamicWeights:
    process.env.V3_ENABLE_DYNAMIC_WEIGHTS !== "false" &&
    FEATURE_FLAGS_DEFAULT.enableDynamicWeights,
  enableFolderFingerprint:
    process.env.V3_ENABLE_FOLDER_FINGERPRINT !== "false" &&
    FEATURE_FLAGS_DEFAULT.enableFolderFingerprint,
  enableTagMatcher:
    process.env.V3_ENABLE_TAG_MATCHER !== "false" &&
    FEATURE_FLAGS_DEFAULT.enableTagMatcher,
};

/**
 * 检查功能是否启用
 */
export function isFeatureEnabled(feature: keyof FeatureFlagsConfig): boolean {
  return Boolean(FEATURE_FLAGS[feature]);
}

/**
 * 获取功能开关配置摘要（用于日志）
 */
export function getFeatureFlagsSummary(): Record<string, boolean | number> {
  return {
    coT: FEATURE_FLAGS.enableCoTPrompt,
    feedbackLoop: FEATURE_FLAGS.enableFeedbackLoop,
    highThreshold: FEATURE_FLAGS.highConfidenceThreshold,
    mediumThreshold: FEATURE_FLAGS.mediumConfidenceThreshold,
    universal: FEATURE_FLAGS.enableUniversalCategories,
    backfill: FEATURE_FLAGS.enableBackfillClassification,
    knn: FEATURE_FLAGS.enableKnnDirect,
    dynamicWeights: FEATURE_FLAGS.enableDynamicWeights,
    fingerprint: FEATURE_FLAGS.enableFolderFingerprint,
    tagMatch: FEATURE_FLAGS.enableTagMatcher,
    librarian: FEATURE_FLAGS.enableAILibrarian,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 向后兼容导出（V3 别名）
// @deprecated 请使用新名称
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated 使用 FeatureFlagsConfig */
export type V3Config = FeatureFlagsConfig;

/** @deprecated 使用 FEATURE_FLAGS_DEFAULT */
export const V3_CONFIG_DEFAULT = FEATURE_FLAGS_DEFAULT;

/** @deprecated 使用 FEATURE_FLAGS_AGGRESSIVE */
export const V3_CONFIG_AGGRESSIVE = FEATURE_FLAGS_AGGRESSIVE;

/** @deprecated 使用 FEATURE_FLAGS */
export const V3_CONFIG = FEATURE_FLAGS;

/** @deprecated 使用 isFeatureEnabled */
export const isV3FeatureEnabled = isFeatureEnabled;

/** @deprecated 使用 getFeatureFlagsSummary */
export const getV3ConfigSummary = getFeatureFlagsSummary;
