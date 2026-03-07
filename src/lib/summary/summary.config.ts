/**
 * AI Summary Configuration
 *
 * 摘要服务配置管理
 *
 * 功能：
 * - 环境变量配置（默认）
 * - 内存缓存 + 自动刷新（5 分钟 TTL）
 * - 配置变更日志
 * - Provider 健康状态追踪
 *
 * @version 2.1.0
 * @since 2025-12-12
 */

import { logger } from "@/lib/logger";
import { aiEnv } from "@/lib/env";
import type {
  SummaryServiceConfig,
  ProviderConfig,
  ProviderName,
  SummaryVersion,
  ProviderHealth,
} from "./summary.types";

// ============================================================================
// Environment Variables
// ============================================================================

/**
 * 环境变量名称
 */
export const ENV_VARS = {
  // DeepSeek
  DEEPSEEK_API_KEY: "DEEPSEEK_API_KEY",

  // 阿里百炼云 (DashScope)
  DASHSCOPE_API_KEY: "DASHSCOPE_API_KEY",

  // 摘要服务配置
  USE_NEW_SUMMARY_SERVICE: "USE_NEW_SUMMARY_SERVICE",
  AI_SUMMARY_JSON_OUTPUT: "AI_SUMMARY_JSON_OUTPUT",
  SUMMARY_ENABLE_FALLBACK: "SUMMARY_ENABLE_FALLBACK",
  SUMMARY_TRACK_QUALITY: "SUMMARY_TRACK_QUALITY",
  SUMMARY_DEFAULT_PROVIDER: "SUMMARY_DEFAULT_PROVIDER",
  SUMMARY_FALLBACK_PROVIDER: "SUMMARY_FALLBACK_PROVIDER",
} as const;

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * DeepSeek 默认配置
 */
export const DEEPSEEK_DEFAULT_CONFIG: ProviderConfig = {
  apiKey: aiEnv.hasDeepseekApiKey ? aiEnv.deepseekApiKey : "",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  timeoutMs: 30000,
  maxRetries: 2,
  temperature: 0.7,
  maxTokens: 2000,
};

/**
 * 阿里百炼云默认配置
 *
 * @see https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
 */
export const ALIYUN_BAILIAN_DEFAULT_CONFIG: ProviderConfig = {
  apiKey: aiEnv.hasDashscopeApiKey ? aiEnv.dashscopeApiKey : "",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "qwen-turbo",
  timeoutMs: 30000,
  maxRetries: 2,
  temperature: 0.7,
  maxTokens: 2000,
};

/**
 * 阿里百炼云支持的模型
 */
export const ALIYUN_MODELS = {
  /** 通义千问 Turbo - 速度快，成本低 */
  QWEN_TURBO: "qwen-turbo",
  /** 通义千问 Plus - 平衡性能 */
  QWEN_PLUS: "qwen-plus",
  /** 通义千问 Max - 最强性能 */
  QWEN_MAX: "qwen-max",
  /** 通义千问 Long - 长上下文 (支持 1M tokens) */
  QWEN_LONG: "qwen-long",
} as const;

/**
 * 模型定价（每 1K tokens，单位：分）
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> =
  {
    // DeepSeek
    "deepseek-chat": { input: 0.1, output: 0.2 },

    // 阿里百炼云
    "qwen-turbo": { input: 0.3, output: 0.6 },
    "qwen-plus": { input: 0.8, output: 2 },
    "qwen-max": { input: 2, output: 6 },
    "qwen-long": { input: 0.5, output: 2 },
  };

/**
 * Provider 默认定价（用于未知模型的回退）
 *
 * 与 MODEL_PRICING 中对应 provider 的默认模型价格保持一致
 */
export const PROVIDER_DEFAULT_PRICING: Record<
  ProviderName,
  { input: number; output: number }
> = {
  deepseek: MODEL_PRICING["deepseek-chat"],
  "aliyun-bailian": MODEL_PRICING["qwen-turbo"],
  ollama: { input: 0, output: 0 }, // 本地模型无成本
  local: { input: 0, output: 0 }, // 本地模型无成本
};

/**
 * 默认服务配置
 */
export const DEFAULT_SERVICE_CONFIG: SummaryServiceConfig = {
  enableFallback: true,
  maxRetries: 2,
  emitEvents: true,
  trackQuality: true,
  outputVersion: 2 as SummaryVersion,
  defaultProvider: "deepseek" as ProviderName,
  fallbackProvider: "aliyun-bailian" as ProviderName,
};

// ============================================================================
// Configuration Functions
// ============================================================================

/**
 * 检查是否启用新摘要服务
 */
export function isNewSummaryServiceEnabled(): boolean {
  return process.env.USE_NEW_SUMMARY_SERVICE === "true";
}

/**
 * 检查是否启用 JSON 结构化输出
 */
export function isJsonOutputEnabled(): boolean {
  return process.env.AI_SUMMARY_JSON_OUTPUT !== "false";
}

/**
 * 检查是否启用 Fallback
 */
export function isFallbackEnabled(): boolean {
  return process.env.SUMMARY_ENABLE_FALLBACK !== "false";
}

/**
 * 检查是否启用质量追踪
 */
export function isQualityTrackingEnabled(): boolean {
  return process.env.SUMMARY_TRACK_QUALITY !== "false";
}

/**
 * 获取默认 Provider
 */
export function getDefaultProvider(): ProviderName {
  const provider = process.env.SUMMARY_DEFAULT_PROVIDER;
  if (provider === "aliyun-bailian" || provider === "ollama") {
    return provider;
  }
  return "deepseek";
}

/**
 * 获取 Fallback Provider
 */
export function getFallbackProvider(): ProviderName {
  const provider = process.env.SUMMARY_FALLBACK_PROVIDER;
  if (provider === "deepseek" || provider === "ollama") {
    return provider;
  }
  return "aliyun-bailian";
}

/**
 * 获取服务配置
 */
export function getSummaryServiceConfig(): SummaryServiceConfig {
  return {
    enableFallback: isFallbackEnabled(),
    maxRetries: DEFAULT_SERVICE_CONFIG.maxRetries,
    emitEvents: DEFAULT_SERVICE_CONFIG.emitEvents,
    trackQuality: isQualityTrackingEnabled(),
    outputVersion: isJsonOutputEnabled() ? 2 : 1,
    defaultProvider: getDefaultProvider(),
    fallbackProvider: getFallbackProvider(),
  };
}

/**
 * 获取 Provider 配置
 */
export function getProviderConfig(provider: ProviderName): ProviderConfig {
  switch (provider) {
    case "deepseek":
      return { ...DEEPSEEK_DEFAULT_CONFIG };
    case "aliyun-bailian":
      return { ...ALIYUN_BAILIAN_DEFAULT_CONFIG };
    case "ollama":
      // P3: 见 @/lib/ai-providers/provider-router.ts Ollama 实现计划
      throw new Error("Ollama provider not implemented yet");
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * 检查 Provider 是否可配置
 */
export function isProviderConfigured(provider: ProviderName): boolean {
  switch (provider) {
    case "deepseek":
      return aiEnv.hasDeepseekApiKey;
    case "aliyun-bailian":
      return aiEnv.hasDashscopeApiKey;
    case "ollama":
      // Ollama 是本地服务，不需要 API Key
      return false; // P3: 检查 Ollama 服务是否运行 (见 provider-router.ts)
    default:
      return false;
  }
}

/**
 * 获取所有已配置的 Provider
 */
export function getConfiguredProviders(): ProviderName[] {
  const providers: ProviderName[] = [];

  if (isProviderConfigured("deepseek")) {
    providers.push("deepseek");
  }
  if (isProviderConfigured("aliyun-bailian")) {
    providers.push("aliyun-bailian");
  }
  // P3: Ollama 检测 (见 provider-router.ts Ollama 实现计划)

  return providers;
}

/**
 * 估算成本
 *
 * @param provider - Provider 名称（用于未知模型的回退定价）
 * @param model - 模型名称
 * @param inputTokens - 输入 Token 数
 * @param outputTokens - 输出 Token 数
 * @returns 成本（单位：分）
 */
export function estimateCost(
  provider: ProviderName,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    // 根据 provider 使用不同的回退定价
    const fallbackPricing = getFallbackPricing(provider);
    return Math.ceil(
      (inputTokens / 1000) * fallbackPricing.input +
        (outputTokens / 1000) * fallbackPricing.output,
    );
  }

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;

  return Math.ceil(inputCost + outputCost);
}

/**
 * 获取回退定价（当模型未在 MODEL_PRICING 中定义时）
 *
 * 使用 PROVIDER_DEFAULT_PRICING 常量，确保与默认模型价格一致
 */
function getFallbackPricing(provider: ProviderName): {
  input: number;
  output: number;
} {
  return (
    PROVIDER_DEFAULT_PRICING[provider] ?? PROVIDER_DEFAULT_PRICING.deepseek
  );
}

// ============================================================================
// Configuration Change Log
// ============================================================================

/**
 * 配置变更日志条目
 */
export interface ConfigChangeLogEntry {
  timestamp: string;
  changeType: "provider" | "service" | "feature";
  field: string;
  oldValue: unknown;
  newValue: unknown;
  source: "env" | "api" | "runtime";
}

/**
 * Provider 健康状态缓存
 */
interface HealthCacheEntry {
  health: ProviderHealth;
  checkedAt: number;
}

/**
 * 配置中心统计
 */
export interface SummaryConfigStats {
  configLoadCount: number;
  healthCheckCount: number;
  lastHealthCheck: number;
  configChanges: number;
  providerHealth: Record<ProviderName, ProviderHealth | null>;
}

// ============================================================================
// Summary Config Service
// ============================================================================

/**
 * 摘要配置服务
 *
 * 提供配置管理、健康检查追踪、变更日志功能
 *
 * @example
 * ```typescript
 * const configService = getSummaryConfigService();
 *
 * // 获取配置
 * const config = configService.getConfig();
 *
 * // 更新 Provider 健康状态
 * configService.updateProviderHealth('deepseek', { available: true, ... });
 *
 * // 获取统计信息
 * const stats = configService.getStats();
 * ```
 */
export class SummaryConfigService {
  private configCache: SummaryServiceConfig | null = null;
  private configCacheTime: number = 0;
  private readonly CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

  private healthCache: Map<ProviderName, HealthCacheEntry> = new Map();
  private readonly HEALTH_CACHE_TTL_MS = 60 * 1000; // 1 分钟

  private changeLog: ConfigChangeLogEntry[] = [];
  private readonly MAX_CHANGE_LOG_SIZE = 100;

  private stats: SummaryConfigStats = {
    configLoadCount: 0,
    healthCheckCount: 0,
    lastHealthCheck: 0,
    configChanges: 0,
    providerHealth: {
      deepseek: null,
      "aliyun-bailian": null,
      ollama: null,
      local: null, // V4.2.7: 本地降级 Provider
    },
  };

  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private readonly HEALTH_CHECK_INTERVAL_MS = 60 * 1000; // 1 分钟

  constructor() {
    // 初始加载配置
    this.loadConfig();
  }

  /**
   * 启动健康检查定时器
   */
  startHealthCheckTimer(
    checkFn: () => Promise<Map<ProviderName, ProviderHealth>>,
  ): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        const healthMap = await checkFn();
        for (const [provider, health] of healthMap) {
          this.updateProviderHealth(provider, health);
        }
        logger.debug(
          { providerCount: healthMap.size },
          "SummaryConfigService: Health check completed",
        );
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "SummaryConfigService: Health check failed",
        );
      }
    }, this.HEALTH_CHECK_INTERVAL_MS);

    logger.info("SummaryConfigService: Health check timer started");
  }

  /**
   * 停止健康检查定时器
   */
  stopHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      logger.info("SummaryConfigService: Health check timer stopped");
    }
  }

  /**
   * 获取服务配置
   */
  getConfig(forceRefresh: boolean = false): SummaryServiceConfig {
    const now = Date.now();

    if (
      !forceRefresh &&
      this.configCache &&
      now - this.configCacheTime < this.CONFIG_CACHE_TTL_MS
    ) {
      return this.configCache;
    }

    return this.loadConfig();
  }

  /**
   * 加载配置
   */
  private loadConfig(): SummaryServiceConfig {
    this.stats.configLoadCount++;

    const config = getSummaryServiceConfig();
    this.configCache = config;
    this.configCacheTime = Date.now();

    logger.debug(
      {
        defaultProvider: config.defaultProvider,
        fallbackEnabled: config.enableFallback,
        outputVersion: config.outputVersion,
      },
      "SummaryConfigService: Config loaded",
    );

    return config;
  }

  /**
   * 更新 Provider 健康状态
   */
  updateProviderHealth(provider: ProviderName, health: ProviderHealth): void {
    const now = Date.now();
    const oldHealth = this.healthCache.get(provider);

    this.healthCache.set(provider, {
      health,
      checkedAt: now,
    });

    this.stats.healthCheckCount++;
    this.stats.lastHealthCheck = now;
    this.stats.providerHealth[provider] = health;

    // 记录状态变更
    if (oldHealth && oldHealth.health.available !== health.available) {
      this.logChange({
        timestamp: new Date().toISOString(),
        changeType: "provider",
        field: `${provider}.available`,
        oldValue: oldHealth.health.available,
        newValue: health.available,
        source: "runtime",
      });

      logger.info(
        {
          provider,
          oldAvailable: oldHealth.health.available,
          newAvailable: health.available,
          latencyMs: health.latencyMs,
        },
        "SummaryConfigService: Provider health changed",
      );
    }
  }

  /**
   * 获取 Provider 健康状态
   */
  getProviderHealth(provider: ProviderName): ProviderHealth | null {
    const cached = this.healthCache.get(provider);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.checkedAt > this.HEALTH_CACHE_TTL_MS) {
      // 缓存过期，但仍返回旧数据
      return { ...cached.health, error: "cache_stale" };
    }

    return cached.health;
  }

  /**
   * 获取所有 Provider 健康状态
   */
  getAllProviderHealth(): Map<ProviderName, ProviderHealth | null> {
    const result = new Map<ProviderName, ProviderHealth | null>();
    const providers: ProviderName[] = ["deepseek", "aliyun-bailian", "ollama"];

    for (const provider of providers) {
      result.set(provider, this.getProviderHealth(provider));
    }

    return result;
  }

  /**
   * 记录配置变更
   */
  logChange(entry: ConfigChangeLogEntry): void {
    this.changeLog.push(entry);
    this.stats.configChanges++;

    // 限制日志大小
    if (this.changeLog.length > this.MAX_CHANGE_LOG_SIZE) {
      this.changeLog = this.changeLog.slice(-this.MAX_CHANGE_LOG_SIZE);
    }

    logger.info(
      {
        changeType: entry.changeType,
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        source: entry.source,
      },
      "SummaryConfigService: Config changed",
    );
  }

  /**
   * 获取配置变更日志
   */
  getChangeLog(limit: number = 50): ConfigChangeLogEntry[] {
    return this.changeLog.slice(-limit);
  }

  /**
   * 获取统计信息
   */
  getStats(): SummaryConfigStats {
    return { ...this.stats };
  }

  /**
   * 获取配置摘要（用于调试）
   */
  getConfigSummary(): Record<string, unknown> {
    const config = this.getConfig();
    const configuredProviders = getConfiguredProviders();

    return {
      // 服务配置
      defaultProvider: config.defaultProvider,
      fallbackProvider: config.fallbackProvider,
      enableFallback: config.enableFallback,
      outputVersion: config.outputVersion,
      trackQuality: config.trackQuality,

      // Provider 配置状态
      configuredProviders,
      providerHealth: Object.fromEntries(this.getAllProviderHealth()),

      // 缓存状态
      configCacheAge: this.configCache
        ? Date.now() - this.configCacheTime
        : null,
      healthCacheSize: this.healthCache.size,

      // 统计
      stats: this.stats,
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.configCache = null;
    this.configCacheTime = 0;
    this.healthCache.clear();
    logger.info("SummaryConfigService: Cache cleared");
  }

  /**
   * 停止服务
   */
  stop(): void {
    this.stopHealthCheckTimer();
    this.clearCache();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let configServiceInstance: SummaryConfigService | null = null;

/**
 * 获取 SummaryConfigService 单例
 */
export function getSummaryConfigService(): SummaryConfigService {
  if (!configServiceInstance) {
    configServiceInstance = new SummaryConfigService();
  }
  return configServiceInstance;
}

/**
 * 重置 SummaryConfigService 单例（主要用于测试）
 */
export function resetSummaryConfigService(): void {
  if (configServiceInstance) {
    configServiceInstance.stop();
    configServiceInstance = null;
  }
}
