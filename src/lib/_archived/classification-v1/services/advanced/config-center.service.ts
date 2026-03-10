/**
 * V4.0 配置中心服务
 *
 * 功能：
 * - 从数据库加载配置（通用分类、策略权重、阈值）
 * - 内存缓存 + 自动刷新（5 分钟 TTL）
 * - 热更新支持（配置变更 < 1 分钟生效）
 * - 场景化权重加载
 *
 * 设计原则：
 * - 配置只读（通过管理 API 写入）
 * - 高命中率（> 95%）
 * - 降级到默认值（数据库不可用时）
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import type { UserScenario } from "./user-scenario-detector.service";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 通用分类（从数据库加载）
 */
export interface UniversalCategoryConfig {
  id: string;
  name: string;
  synonyms: string[];
  group: string;
  suggestedFolderName: string;
  icon: string;
  sortOrder: number;
}

/**
 * 场景化权重
 */
export interface ScenarioWeights {
  vector: number;
  history: number;
  fingerprint: number;
  universal: number;
  tag: number;
}

/**
 * 全局阈值配置
 */
export interface ThresholdsConfig {
  directLock: number;
  highConfidence: number;
  mediumConfidence: number;
  aiConfirm: number;
  autoCreate: number;
  correctionCacheMin: number;
}

/**
 * 功能开关
 */
export interface FeatureFlags {
  enableTieredOptimization: boolean;
  enableCorrectionCache: boolean;
  enableTracing: boolean;
  enableDynamicWeights: boolean;
  enableCoTPrompt: boolean;
  enableReranking: boolean;
  enableAutoCreate: boolean;
}

/**
 * 匹配器配置
 */
export interface MatcherConfigItem {
  threshold?: number;
  maxCandidates?: number;
  topK?: number;
  minScore?: number;
  lookbackDays?: number;
  minActions?: number;
  minTagMatch?: number;
  enabled?: boolean;
  exactMatchBoost?: number;
}

/**
 * AI 配置
 */
export interface AIConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  fallbackModel: string;
}

/**
 * 完整策略配置
 */
export interface StrategyConfig {
  version: string;
  scenarioWeights: Record<UserScenario, ScenarioWeights>;
  thresholds: ThresholdsConfig;
  featureFlags: FeatureFlags;
  matcherConfig: Record<string, MatcherConfigItem>;
  aiConfig: AIConfig;
}

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  data: T;
  loadedAt: number;
  expiresAt: number;
}

/**
 * 缓存统计
 */
interface CacheStats {
  categoriesHits: number;
  categoriesMisses: number;
  strategyHits: number;
  strategyMisses: number;
  lastRefresh: number;
}

// ============================================================================
// 默认配置（降级使用）
// ============================================================================

const DEFAULT_SCENARIO_WEIGHTS: Record<UserScenario, ScenarioWeights> = {
  cold_start: {
    vector: 0.8,
    universal: 0.2,
    history: 0.0,
    fingerprint: 0.0,
    tag: 0.0,
  },
  learning: {
    vector: 0.5,
    history: 0.3,
    fingerprint: 0.1,
    universal: 0.1,
    tag: 0.0,
  },
  mature: {
    vector: 0.3,
    history: 0.4,
    fingerprint: 0.2,
    tag: 0.1,
    universal: 0.0,
  },
};

const DEFAULT_THRESHOLDS: ThresholdsConfig = {
  directLock: 0.92,
  highConfidence: 0.8,
  mediumConfidence: 0.5,
  aiConfirm: 0.65,
  autoCreate: 0.75,
  correctionCacheMin: 0.6,
};

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableTieredOptimization: true,
  enableCorrectionCache: true,
  enableTracing: true,
  enableDynamicWeights: true,
  enableCoTPrompt: true,
  enableReranking: false,
  enableAutoCreate: true,
};

const DEFAULT_AI_CONFIG: AIConfig = {
  model: "deepseek-v3",
  maxTokens: 512,
  temperature: 0.3,
  timeoutMs: 5000,
  fallbackModel: "qwen-turbo",
};

const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  version: "v4.0-fallback",
  scenarioWeights: DEFAULT_SCENARIO_WEIGHTS,
  thresholds: DEFAULT_THRESHOLDS,
  featureFlags: DEFAULT_FEATURE_FLAGS,
  matcherConfig: {},
  aiConfig: DEFAULT_AI_CONFIG,
};

// ============================================================================
// 配置中心服务
// ============================================================================

/**
 * 配置中心服务类
 */
export class ConfigCenterService {
  private supabase: SupabaseClient<Database>;

  // 缓存
  private categoriesCache: CacheEntry<UniversalCategoryConfig[]> | null = null;
  private strategyCache: Map<string, CacheEntry<StrategyConfig>> = new Map();

  // 缓存 TTL
  private readonly CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟
  private readonly STRATEGY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

  // 统计
  private stats: CacheStats = {
    categoriesHits: 0,
    categoriesMisses: 0,
    strategyHits: 0,
    strategyMisses: 0,
    lastRefresh: 0,
  };

  // 刷新定时器
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly REFRESH_INTERVAL_MS = 60 * 1000; // 1 分钟检查一次

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
    this.startAutoRefresh();
  }

  /**
   * 启动自动刷新
   */
  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.checkAndRefreshCache();
    }, this.REFRESH_INTERVAL_MS);
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * 检查并刷新过期缓存
   */
  private async checkAndRefreshCache(): Promise<void> {
    const now = Date.now();

    // 刷新通用分类缓存
    if (this.categoriesCache && this.categoriesCache.expiresAt <= now) {
      try {
        await this.loadCategories(true);
        logger.debug("ConfigCenter: Categories cache refreshed");
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "ConfigCenter: Failed to refresh categories cache",
        );
      }
    }

    // 刷新策略缓存
    for (const [key, entry] of this.strategyCache) {
      if (entry.expiresAt <= now) {
        try {
          await this.loadStrategy(key, true);
          logger.debug(
            { configKey: key },
            "ConfigCenter: Strategy cache refreshed",
          );
        } catch (error) {
          logger.warn(
            {
              configKey: key,
              error: error instanceof Error ? error.message : String(error),
            },
            "ConfigCenter: Failed to refresh strategy cache",
          );
        }
      }
    }

    this.stats.lastRefresh = now;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 通用分类
  // ════════════════════════════════════════════════════════════════════════

  /**
   * 获取所有通用分类
   */
  async getCategories(
    forceRefresh: boolean = false,
  ): Promise<UniversalCategoryConfig[]> {
    const now = Date.now();

    // 检查缓存
    if (
      !forceRefresh &&
      this.categoriesCache &&
      this.categoriesCache.expiresAt > now
    ) {
      this.stats.categoriesHits++;
      return this.categoriesCache.data;
    }

    return this.loadCategories(forceRefresh);
  }

  /**
   * 从数据库加载分类
   */
  private async loadCategories(
    forceRefresh: boolean,
  ): Promise<UniversalCategoryConfig[]> {
    this.stats.categoriesMisses++;

    try {
      // V4.2 表：类型已添加到 supabase.ts
      const { data, error } = await this.supabase
        .from("universal_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        throw error;
      }

      const categories: UniversalCategoryConfig[] = (
        (data as Record<string, unknown>[]) || []
      ).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        synonyms: (row.synonyms as string[]) || [],
        group: row.category_group as string,
        suggestedFolderName: row.suggested_folder_name as string,
        icon: row.icon as string,
        sortOrder: row.sort_order as number,
      }));

      // 更新缓存
      const now = Date.now();
      this.categoriesCache = {
        data: categories,
        loadedAt: now,
        expiresAt: now + this.CATEGORIES_CACHE_TTL_MS,
      };

      logger.info(
        { count: categories.length, forceRefresh },
        "ConfigCenter: Categories loaded from database",
      );

      return categories;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "ConfigCenter: Failed to load categories, using cached data",
      );

      // 返回过期缓存或空数组
      return this.categoriesCache?.data || [];
    }
  }

  /**
   * 根据关键词匹配分类
   */
  async matchCategoriesByKeyword(
    keyword: string,
  ): Promise<Array<{ category: UniversalCategoryConfig; score: number }>> {
    const categories = await this.getCategories();
    const lowerKeyword = keyword.toLowerCase();
    const results: Array<{ category: UniversalCategoryConfig; score: number }> =
      [];

    for (const category of categories) {
      let score = 0;

      // 分类名称完全匹配
      if (category.name.toLowerCase() === lowerKeyword) {
        score = 100;
      }
      // 分类名称包含关键词
      else if (category.name.toLowerCase().includes(lowerKeyword)) {
        score = 80;
      }
      // 同义词完全匹配
      else if (
        category.synonyms.some((syn) => syn.toLowerCase() === lowerKeyword)
      ) {
        score = 90;
      }
      // 同义词包含关键词
      else if (
        category.synonyms.some((syn) =>
          syn.toLowerCase().includes(lowerKeyword),
        )
      ) {
        score = 60;
      }

      if (score > 0) {
        results.push({ category, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 策略配置
  // ════════════════════════════════════════════════════════════════════════

  /**
   * 获取策略配置
   * @param configKey 配置键，默认 'default'
   */
  async getStrategyConfig(
    configKey: string = "default",
  ): Promise<StrategyConfig> {
    const now = Date.now();

    // 检查缓存
    const cached = this.strategyCache.get(configKey);
    if (cached && cached.expiresAt > now) {
      this.stats.strategyHits++;
      return cached.data;
    }

    return this.loadStrategy(configKey, false);
  }

  /**
   * 从数据库加载策略配置
   */
  private async loadStrategy(
    configKey: string,
    forceRefresh: boolean,
  ): Promise<StrategyConfig> {
    this.stats.strategyMisses++;

    try {
      // V4.2 表：类型已添加到 supabase.ts
      const { data, error } = await this.supabase
        .from("classification_strategy_config")
        .select("*")
        .eq("config_key", configKey)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        // 尝试加载默认配置
        if (configKey !== "default") {
          logger.warn(
            { configKey },
            "ConfigCenter: Config not found, falling back to default",
          );
          return this.loadStrategy("default", forceRefresh);
        }
        throw error || new Error("Default config not found");
      }

      const row = data as Record<string, unknown>;
      const config = this.parseStrategyConfig(row);

      // 更新缓存
      const now = Date.now();
      this.strategyCache.set(configKey, {
        data: config,
        loadedAt: now,
        expiresAt: now + this.STRATEGY_CACHE_TTL_MS,
      });

      logger.info(
        { configKey, version: config.version, forceRefresh },
        "ConfigCenter: Strategy config loaded from database",
      );

      return config;
    } catch (error) {
      logger.error(
        {
          configKey,
          error: error instanceof Error ? error.message : String(error),
        },
        "ConfigCenter: Failed to load strategy config, using default",
      );

      // 返回过期缓存或默认配置
      return this.strategyCache.get(configKey)?.data || DEFAULT_STRATEGY_CONFIG;
    }
  }

  /**
   * 解析策略配置
   */
  private parseStrategyConfig(row: Record<string, unknown>): StrategyConfig {
    const scenarioWeightsRaw = row.scenario_weights as
      | Record<string, Record<string, number>>
      | undefined;
    const thresholdsRaw = row.thresholds as Record<string, number>;
    const featureFlagsRaw = row.feature_flags as Record<string, boolean>;
    const matcherConfigRaw = row.matcher_config as Record<
      string,
      MatcherConfigItem
    >;
    const aiConfigRaw = row.ai_config as Record<string, unknown>;

    // 解析场景权重，确保每个属性都有正确的类型
    const parseScenarioWeights = (
      raw: Record<string, number> | undefined,
      defaultVal: ScenarioWeights,
    ): ScenarioWeights => {
      if (!raw) return defaultVal;
      return {
        vector: raw.vector ?? defaultVal.vector,
        history: raw.history ?? defaultVal.history,
        fingerprint: raw.fingerprint ?? defaultVal.fingerprint,
        universal: raw.universal ?? defaultVal.universal,
        tag: raw.tag ?? defaultVal.tag,
      };
    };

    return {
      version: (row.version as string) || "v4.0",

      scenarioWeights: {
        cold_start: parseScenarioWeights(
          scenarioWeightsRaw?.cold_start,
          DEFAULT_SCENARIO_WEIGHTS.cold_start,
        ),
        learning: parseScenarioWeights(
          scenarioWeightsRaw?.learning,
          DEFAULT_SCENARIO_WEIGHTS.learning,
        ),
        mature: parseScenarioWeights(
          scenarioWeightsRaw?.mature,
          DEFAULT_SCENARIO_WEIGHTS.mature,
        ),
      },

      thresholds: {
        directLock: thresholdsRaw?.direct_lock ?? DEFAULT_THRESHOLDS.directLock,
        highConfidence:
          thresholdsRaw?.high_confidence ?? DEFAULT_THRESHOLDS.highConfidence,
        mediumConfidence:
          thresholdsRaw?.medium_confidence ??
          DEFAULT_THRESHOLDS.mediumConfidence,
        aiConfirm: thresholdsRaw?.ai_confirm ?? DEFAULT_THRESHOLDS.aiConfirm,
        autoCreate: thresholdsRaw?.auto_create ?? DEFAULT_THRESHOLDS.autoCreate,
        correctionCacheMin:
          thresholdsRaw?.correction_cache_min ??
          DEFAULT_THRESHOLDS.correctionCacheMin,
      },

      featureFlags: {
        enableTieredOptimization:
          featureFlagsRaw?.enable_tiered_optimization ??
          DEFAULT_FEATURE_FLAGS.enableTieredOptimization,
        enableCorrectionCache:
          featureFlagsRaw?.enable_correction_cache ??
          DEFAULT_FEATURE_FLAGS.enableCorrectionCache,
        enableTracing:
          featureFlagsRaw?.enable_tracing ??
          DEFAULT_FEATURE_FLAGS.enableTracing,
        enableDynamicWeights:
          featureFlagsRaw?.enable_dynamic_weights ??
          DEFAULT_FEATURE_FLAGS.enableDynamicWeights,
        enableCoTPrompt:
          featureFlagsRaw?.enable_cot_prompt ??
          DEFAULT_FEATURE_FLAGS.enableCoTPrompt,
        enableReranking:
          featureFlagsRaw?.enable_reranking ??
          DEFAULT_FEATURE_FLAGS.enableReranking,
        enableAutoCreate:
          featureFlagsRaw?.enable_auto_create ??
          DEFAULT_FEATURE_FLAGS.enableAutoCreate,
      },

      matcherConfig: matcherConfigRaw || {},

      aiConfig: {
        model: (aiConfigRaw?.model as string) || DEFAULT_AI_CONFIG.model,
        maxTokens:
          (aiConfigRaw?.max_tokens as number) || DEFAULT_AI_CONFIG.maxTokens,
        temperature:
          (aiConfigRaw?.temperature as number) || DEFAULT_AI_CONFIG.temperature,
        timeoutMs:
          (aiConfigRaw?.timeout_ms as number) || DEFAULT_AI_CONFIG.timeoutMs,
        fallbackModel:
          (aiConfigRaw?.fallback_model as string) ||
          DEFAULT_AI_CONFIG.fallbackModel,
      },
    };
  }

  /**
   * 根据用户场景获取权重
   */
  async getWeightsForScenario(
    scenario: UserScenario,
  ): Promise<ScenarioWeights> {
    const config = await this.getStrategyConfig();
    return (
      config.scenarioWeights[scenario] || DEFAULT_SCENARIO_WEIGHTS[scenario]
    );
  }

  /**
   * 获取阈值配置
   */
  async getThresholds(): Promise<ThresholdsConfig> {
    const config = await this.getStrategyConfig();
    return config.thresholds;
  }

  /**
   * 获取功能开关
   */
  async getFeatureFlags(): Promise<FeatureFlags> {
    const config = await this.getStrategyConfig();
    return config.featureFlags;
  }

  /**
   * 检查功能是否启用
   */
  async isFeatureEnabled(feature: keyof FeatureFlags): Promise<boolean> {
    const flags = await this.getFeatureFlags();
    return flags[feature] ?? false;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 缓存管理
  // ════════════════════════════════════════════════════════════════════════

  /**
   * 强制刷新所有缓存
   */
  async forceRefreshAll(): Promise<void> {
    await Promise.all([
      this.loadCategories(true),
      this.loadStrategy("default", true),
    ]);
    logger.info("ConfigCenter: All caches force refreshed");
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.categoriesCache = null;
    this.strategyCache.clear();
    logger.info("ConfigCenter: All caches cleared");
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats & {
    categoriesHitRate: number;
    strategyHitRate: number;
    categoriesCached: boolean;
    strategyCachedCount: number;
  } {
    const catTotal = this.stats.categoriesHits + this.stats.categoriesMisses;
    const stratTotal = this.stats.strategyHits + this.stats.strategyMisses;

    return {
      ...this.stats,
      categoriesHitRate:
        catTotal > 0
          ? Math.round((this.stats.categoriesHits / catTotal) * 100)
          : 0,
      strategyHitRate:
        stratTotal > 0
          ? Math.round((this.stats.strategyHits / stratTotal) * 100)
          : 0,
      categoriesCached: this.categoriesCache !== null,
      strategyCachedCount: this.strategyCache.size,
    };
  }
}

// ============================================================================
// 单例管理
// ============================================================================

let _instance: ConfigCenterService | null = null;

/**
 * 获取配置中心服务实例
 */
export function getConfigCenter(
  supabase: SupabaseClient<Database>,
): ConfigCenterService {
  if (!_instance) {
    _instance = new ConfigCenterService(supabase);
  }
  return _instance;
}

/**
 * 重置配置中心实例（用于测试）
 */
export function resetConfigCenter(): void {
  if (_instance) {
    _instance.stop();
    _instance = null;
  }
}
