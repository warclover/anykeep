/**
 * 智能分类统一 Feature Flags
 *
 * 合并原有两套 Feature Flags 系统：
 * - config/feature-flags.ts (V3/V4 功能开关)
 * - rollout/feature-flag.ts (V5 灰度发布)
 *
 * @since 2026-01-24 (Phase 2.7 - Feature Flags 合并)
 */

import { createHash } from "crypto";

// ═══════════════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 发布阶段
 */
export enum RolloutStage {
  DISABLED = 0,
  CANARY = 5,
  EARLY = 20,
  MAJORITY = 50,
  FULL = 100,
}

/**
 * 统一 Feature Flags 配置
 */
export interface ClassificationFeatureFlags {
  // ═════════════════��═════════════════════════════════════════════
  // 策略选择
  // ═══════════════════════════════════════════════════════════════

  /** 默认策略 */
  defaultStrategy: "classic" | "modern";

  // ═══════════════════════════════════════════════════════════════
  // 灰度发布
  // ═══════════════════════════════════════════════════════════════

  /** 发布阶段百分比 (0-100) */
  rolloutStage: number;
  /** 白名单用户 ID */
  userWhitelist: string[];
  /** 黑名单用户 ID */
  userBlacklist: string[];

  // ═══════════════════════════════════════════════════════════════
  // Modern 策略配置 (原 V5)
  // ══════════════════════════════════════════════════════��════════

  /** L0 规则匹配 */
  enableL0Rules: boolean;
  /** T1 LLM 纠正 */
  enableT1Correction: boolean;
  /** 晶体生长增强 (原 V5.5) */
  enableCrystalGrowth: boolean;

  // ═══════════════════════════════════════════════════════════════
  // Classic 策略配置 (原 V4)
  // ═══════════════════════════════════════════════════════════════

  /** AI 选择题模式 */
  enableAISelection: boolean;
  /** AI 创建文件夹 */
  enableAICreate: boolean;
  /** CoT 思维链 Prompt */
  enableCoTPrompt: boolean;
  /** 反馈闭环 */
  enableFeedbackLoop: boolean;
  /** k-NN 直接锁定 */
  enableKnnDirect: boolean;
  /** k-NN 直接锁定阈值 (0-1) */
  knnDirectThreshold: number;
  /** 文件夹意图指纹 */
  enableFolderFingerprint: boolean;
  /** Tag-to-Tag 精准匹配 */
  enableTagMatcher: boolean;
  /** 动态权重调整 */
  enableDynamicWeights: boolean;
  /** 通用分类体系 (冷启动) */
  enableUniversalCategories: boolean;
  /** 回溯分类 */
  enableBackfillClassification: boolean;
  /** 自动创建文件夹增强 */
  enableAutoCreateEnhanced: boolean;
  /** 整理大师 (AI Librarian) */
  enableAILibrarian: boolean;

  // ═══════════════════════════════════════════════════════════════
  // 置信度阈值
  // ═══════════════════════════════════════════════════════════════

  /** 自动分类阈值 (默认 80) */
  autoClassifyThreshold: number;
  /** 建议阈值 (默认 60) */
  suggestThreshold: number;
  /** T1 触发阈值 (默认 70) */
  t1TriggerThreshold: number;

  // ═══════════════════════════════════════════════════════════════
  // 性能配置
  // ═══════════════════════════════════════════════════════════════

  /** Pipeline 缓存 */
  enablePipelineCache: boolean;
  /** Pipeline 缓存 TTL (毫秒) */
  pipelineCacheTtlMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 默认配置
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 默认配置 - 生产就绪模式
 */
export const FEATURE_FLAGS_DEFAULT: ClassificationFeatureFlags = {
  // 策略选择
  defaultStrategy: "modern",

  // 灰度发布 - 默认全量
  rolloutStage: RolloutStage.FULL,
  userWhitelist: [],
  userBlacklist: [],

  // Modern 策略
  enableL0Rules: true,
  enableT1Correction: true,
  enableCrystalGrowth: false, // 实验性功能，默认关闭

  // Classic 策略
  enableAISelection: true,
  enableAICreate: true,
  enableCoTPrompt: true,
  enableFeedbackLoop: true,
  enableKnnDirect: true,
  knnDirectThreshold: 0.85,
  enableFolderFingerprint: true,
  enableTagMatcher: true,
  enableDynamicWeights: true,
  enableUniversalCategories: true,
  enableBackfillClassification: true,
  enableAutoCreateEnhanced: true,
  enableAILibrarian: true,

  // 置信度阈值
  autoClassifyThreshold: 80,
  suggestThreshold: 60,
  t1TriggerThreshold: 70,

  // 性能配置
  enablePipelineCache: true,
  pipelineCacheTtlMs: 600000, // 10 分钟
};

// ═════════════��═════════════════════════════════════════════════════════════
// Feature Flag 服务
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 统一 Feature Flag 服务
 */
export class FeatureFlagService {
  private config: ClassificationFeatureFlags;

  constructor(overrides?: Partial<ClassificationFeatureFlags>) {
    this.config = {
      ...FEATURE_FLAGS_DEFAULT,
      // 从环境变量读取
      defaultStrategy: this.readEnvStrategy(
        "CLASSIFICATION_DEFAULT_STRATEGY",
        FEATURE_FLAGS_DEFAULT.defaultStrategy,
      ),
      rolloutStage: this.readEnvNumber(
        "CLASSIFICATION_ROLLOUT_STAGE",
        FEATURE_FLAGS_DEFAULT.rolloutStage,
      ),
      userWhitelist: this.readEnvArray("CLASSIFICATION_WHITELIST"),
      userBlacklist: this.readEnvArray("CLASSIFICATION_BLACKLIST"),

      enableL0Rules: this.readEnvBool(
        "CLASSIFICATION_ENABLE_L0_RULES",
        FEATURE_FLAGS_DEFAULT.enableL0Rules,
      ),
      enableT1Correction: this.readEnvBool(
        "CLASSIFICATION_ENABLE_T1",
        FEATURE_FLAGS_DEFAULT.enableT1Correction,
      ),
      enableCrystalGrowth: this.readEnvBool(
        "CLASSIFICATION_ENABLE_CRYSTAL",
        FEATURE_FLAGS_DEFAULT.enableCrystalGrowth,
      ),

      enableAISelection: this.readEnvBool(
        "CLASSIFICATION_ENABLE_AI_SELECT",
        FEATURE_FLAGS_DEFAULT.enableAISelection,
      ),
      enableAICreate: this.readEnvBool(
        "CLASSIFICATION_ENABLE_AI_CREATE",
        FEATURE_FLAGS_DEFAULT.enableAICreate,
      ),
      enableCoTPrompt: this.readEnvBool(
        "V3_ENABLE_COT_PROMPT",
        FEATURE_FLAGS_DEFAULT.enableCoTPrompt,
      ),
      enableFeedbackLoop: this.readEnvBool(
        "V3_ENABLE_FEEDBACK_LOOP",
        FEATURE_FLAGS_DEFAULT.enableFeedbackLoop,
      ),
      enableKnnDirect: this.readEnvBool(
        "V3_ENABLE_KNN_DIRECT",
        FEATURE_FLAGS_DEFAULT.enableKnnDirect,
      ),
      enableDynamicWeights: this.readEnvBool(
        "V3_ENABLE_DYNAMIC_WEIGHTS",
        FEATURE_FLAGS_DEFAULT.enableDynamicWeights,
      ),
      enableFolderFingerprint: this.readEnvBool(
        "V3_ENABLE_FOLDER_FINGERPRINT",
        FEATURE_FLAGS_DEFAULT.enableFolderFingerprint,
      ),
      enableTagMatcher: this.readEnvBool(
        "V3_ENABLE_TAG_MATCHER",
        FEATURE_FLAGS_DEFAULT.enableTagMatcher,
      ),
      enableUniversalCategories: this.readEnvBool(
        "V3_ENABLE_UNIVERSAL_CATEGORIES",
        FEATURE_FLAGS_DEFAULT.enableUniversalCategories,
      ),
      enableBackfillClassification: this.readEnvBool(
        "V3_ENABLE_BACKFILL_CLASSIFICATION",
        FEATURE_FLAGS_DEFAULT.enableBackfillClassification,
      ),
      enableAutoCreateEnhanced: this.readEnvBool(
        "V3_ENABLE_AUTO_CREATE_ENHANCED",
        FEATURE_FLAGS_DEFAULT.enableAutoCreateEnhanced,
      ),

      autoClassifyThreshold: this.readEnvNumber(
        "CLASSIFICATION_AUTO_THRESHOLD",
        FEATURE_FLAGS_DEFAULT.autoClassifyThreshold,
      ),
      suggestThreshold: this.readEnvNumber(
        "CLASSIFICATION_SUGGEST_THRESHOLD",
        FEATURE_FLAGS_DEFAULT.suggestThreshold,
      ),
      t1TriggerThreshold: this.readEnvNumber(
        "CLASSIFICATION_T1_THRESHOLD",
        FEATURE_FLAGS_DEFAULT.t1TriggerThreshold,
      ),

      enablePipelineCache: this.readEnvBool(
        "CLASSIFICATION_ENABLE_CACHE",
        FEATURE_FLAGS_DEFAULT.enablePipelineCache,
      ),
      pipelineCacheTtlMs: this.readEnvNumber(
        "CLASSIFICATION_CACHE_TTL_MS",
        FEATURE_FLAGS_DEFAULT.pipelineCacheTtlMs,
      ),

      ...overrides,
    };
  }

  /**
   * 检查用户是否启用 Modern 策略
   */
  isEnabledForUser(userId: string): boolean {
    // 1. 检查默认策略
    if (this.config.defaultStrategy === "classic") {
      return false;
    }

    // 2. 黑名单优先
    if (this.config.userBlacklist.includes(userId)) {
      return false;
    }

    // 3. 白名单直接通过
    if (this.config.userWhitelist.includes(userId)) {
      return true;
    }

    // 4. 按比例灰度
    const bucket = this.getUserBucket(userId);
    return bucket < this.config.rolloutStage;
  }

  /**
   * 获取用户分桶 (0-99)
   */
  private getUserBucket(userId: string): number {
    const hash = createHash("md5").update(userId).digest("hex");
    return parseInt(hash.slice(0, 8), 16) % 100;
  }

  /**
   * 获取配置值
   */
  get<K extends keyof ClassificationFeatureFlags>(
    key: K,
  ): ClassificationFeatureFlags[K] {
    return this.config[key];
  }

  /**
   * 获取完整配置
   */
  getConfig(): ClassificationFeatureFlags {
    return { ...this.config };
  }

  /**
   * 获取配置摘要（用于日志）
   */
  getSummary(): Record<string, boolean | number | string> {
    return {
      strategy: this.config.defaultStrategy,
      rollout: this.config.rolloutStage,
      l0Rules: this.config.enableL0Rules,
      t1Correction: this.config.enableT1Correction,
      crystal: this.config.enableCrystalGrowth,
      coT: this.config.enableCoTPrompt,
      knn: this.config.enableKnnDirect,
      autoThreshold: this.config.autoClassifyThreshold,
      suggestThreshold: this.config.suggestThreshold,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 环境变量读取辅助方法
  // ═══════════════════════════════════════════════════════════════

  private readEnvStrategy(
    key: string,
    defaultValue: "classic" | "modern",
  ): "classic" | "modern" {
    const value = process.env[key];
    if (value === "classic" || value === "modern") {
      return value;
    }
    return defaultValue;
  }

  private readEnvBool(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === "true") return true;
    if (value === "false") return false;
    return defaultValue;
  }

  private readEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return defaultValue;
  }

  private readEnvArray(key: string): string[] {
    const value = process.env[key];
    if (!value) return [];
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 全局单例
// ═══════════════════════════════════════════════════════════════════════════

let globalFeatureFlagService: FeatureFlagService | null = null;

/**
 * 获取全局 Feature Flag 服务实例
 */
export function getFeatureFlagService(): FeatureFlagService {
  if (!globalFeatureFlagService) {
    globalFeatureFlagService = new FeatureFlagService();
  }
  return globalFeatureFlagService;
}

/**
 * 重置全局实例（用于测试）
 */
export function resetFeatureFlagService(): void {
  globalFeatureFlagService = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 向后兼容导出
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated 使用 ClassificationFeatureFlags */
export type FeatureFlagConfig = ClassificationFeatureFlags;

/** @deprecated 使用 getFeatureFlagService() */
export function getFeatureFlag(): FeatureFlagService {
  return getFeatureFlagService();
}

/** @deprecated 使用 resetFeatureFlagService() */
export function resetFeatureFlag(): void {
  resetFeatureFlagService();
}

// 从旧配置导出兼容常量
/** @deprecated 使用 FEATURE_FLAGS_DEFAULT */
export const FEATURE_FLAGS = FEATURE_FLAGS_DEFAULT;

/** @deprecated 使用 FeatureFlagService.get() */
export function isFeatureEnabled(
  feature: keyof ClassificationFeatureFlags,
): boolean {
  return Boolean(getFeatureFlagService().get(feature));
}

/** @deprecated 使用 FeatureFlagService.getSummary() */
export function getFeatureFlagsSummary(): Record<
  string,
  boolean | number | string
> {
  return getFeatureFlagService().getSummary();
}
