/**
 * Provider Factory
 *
 * 管理所有 AI Provider 实例，提供健康检查和智能路由
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

import { logger } from "@/lib/logger";
import type { ProviderName, ProviderHealth } from "../summary.types";
import type {
  ISummaryProvider,
  IProviderFactory,
  ProviderFactoryConfig,
} from "./provider.interface";
import { DeepSeekProvider } from "./deepseek.provider";
import { AliyunBailianProvider } from "./aliyun-bailian.provider";
import { getConfiguredProviders, isFallbackEnabled } from "../summary.config";

/**
 * 默认工厂配置
 */
const DEFAULT_FACTORY_CONFIG: ProviderFactoryConfig = {
  enabledProviders: ["deepseek", "aliyun-bailian"],
  enableFallback: true,
  healthCheckIntervalMs: 60000, // 1 分钟
};

/**
 * Provider Factory 实现
 *
 * 单例模式，管理所有 Provider 实例
 *
 * @example
 * ```typescript
 * const factory = getProviderFactory();
 * const provider = await factory.getAvailableProvider();
 * const result = await provider.generateSummary(input);
 * ```
 */
export class ProviderFactory implements IProviderFactory {
  private providers: Map<ProviderName, ISummaryProvider> = new Map();
  private healthCache: Map<ProviderName, ProviderHealth> = new Map();
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private config: ProviderFactoryConfig;
  private initialized = false;

  constructor(config?: Partial<ProviderFactoryConfig>) {
    this.config = {
      ...DEFAULT_FACTORY_CONFIG,
      ...config,
      enableFallback: config?.enableFallback ?? isFallbackEnabled(),
    };
  }

  /**
   * 初始化所有已配置的 Provider
   */
  private initialize(): void {
    if (this.initialized) return;

    const configuredProviders = getConfiguredProviders();

    for (const providerName of this.config.enabledProviders) {
      // 跳过未配置的 Provider
      if (!configuredProviders.includes(providerName)) {
        logger.debug(
          { provider: providerName },
          "ProviderFactory: Provider not configured, skipping",
        );
        continue;
      }

      try {
        const provider = this.createProvider(providerName);
        if (provider) {
          this.providers.set(providerName, provider);
          logger.info(
            { provider: providerName, priority: provider.priority },
            "ProviderFactory: Provider initialized",
          );
        }
      } catch (error) {
        logger.error(
          {
            provider: providerName,
            error: error instanceof Error ? error.message : String(error),
          },
          "ProviderFactory: Failed to initialize provider",
        );
      }
    }

    // 启动定时健康检查
    this.startHealthCheck();
    this.initialized = true;

    logger.info(
      {
        providers: Array.from(this.providers.keys()),
        fallbackEnabled: this.config.enableFallback,
      },
      "ProviderFactory: Initialization complete",
    );
  }

  /**
   * 创建 Provider 实例
   */
  private createProvider(name: ProviderName): ISummaryProvider | null {
    switch (name) {
      case "deepseek":
        return new DeepSeekProvider();

      case "aliyun-bailian":
        return new AliyunBailianProvider();

      case "ollama":
        // TODO: P3 - 实现 Ollama Provider
        logger.warn(
          { provider: name },
          "ProviderFactory: Ollama provider not implemented yet",
        );
        return null;

      default:
        logger.warn({ provider: name }, "ProviderFactory: Unknown provider");
        return null;
    }
  }

  /**
   * 获取可用的 Provider
   *
   * 按优先级排序，跳过不健康的 Provider
   *
   * @throws {Error} 当没有可用 Provider 时
   */
  async getAvailableProvider(): Promise<ISummaryProvider> {
    this.initialize();

    // 按优先级排序
    const sortedProviders = Array.from(this.providers.values()).sort(
      (a, b) => a.priority - b.priority,
    );

    for (const provider of sortedProviders) {
      // 检查缓存的健康状态
      const cachedHealth = this.healthCache.get(provider.name);
      if (cachedHealth?.available) {
        return provider;
      }

      // 如果缓存不可用或过期，执行实时健康检查
      try {
        const health = await provider.healthCheck();
        this.healthCache.set(provider.name, health);

        if (health.available) {
          return provider;
        }

        logger.warn(
          {
            provider: provider.name,
            error: health.error,
          },
          "ProviderFactory: Provider unhealthy, trying next",
        );
      } catch (error) {
        logger.error(
          {
            provider: provider.name,
            error: error instanceof Error ? error.message : String(error),
          },
          "ProviderFactory: Health check failed",
        );
      }

      // 如果未启用回退，直接抛出错误
      if (!this.config.enableFallback) {
        throw new Error(
          `Provider ${provider.name} is unavailable and fallback is disabled`,
        );
      }
    }

    throw new Error("No available providers");
  }

  /**
   * 获取指定 Provider
   */
  getProvider(name: ProviderName): ISummaryProvider | undefined {
    this.initialize();
    return this.providers.get(name);
  }

  /**
   * 获取所有 Provider 健康状态
   */
  async getAllHealth(): Promise<Map<ProviderName, ProviderHealth>> {
    this.initialize();

    const healthMap = new Map<ProviderName, ProviderHealth>();

    await Promise.all(
      Array.from(this.providers.entries()).map(async ([name, provider]) => {
        try {
          const health = await provider.healthCheck();
          healthMap.set(name, health);
          this.healthCache.set(name, health);
        } catch (error) {
          const errorHealth: ProviderHealth = {
            available: false,
            error: error instanceof Error ? error.message : String(error),
            checkedAt: new Date().toISOString(),
          };
          healthMap.set(name, errorHealth);
          this.healthCache.set(name, errorHealth);
        }
      }),
    );

    return healthMap;
  }

  /**
   * 启动定时健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) return;

    // 立即执行一次健康检查
    this.getAllHealth().catch((error) => {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "ProviderFactory: Initial health check failed",
      );
    });

    // 定时执行健康检查
    this.healthCheckTimer = setInterval(() => {
      this.getAllHealth().catch((error) => {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "ProviderFactory: Periodic health check failed",
        );
      });
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * 重新初始化所有 Provider
   */
  reinitialize(): void {
    this.stopHealthCheck();
    this.providers.clear();
    this.healthCache.clear();
    this.initialized = false;
    this.initialize();
  }

  /**
   * 获取所有已注册的 Provider 名称
   */
  getRegisteredProviders(): ProviderName[] {
    this.initialize();
    return Array.from(this.providers.keys());
  }

  /**
   * 获取健康 Provider 数量
   */
  getHealthyProviderCount(): number {
    let count = 0;
    for (const health of this.healthCache.values()) {
      if (health.available) count++;
    }
    return count;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let factoryInstance: ProviderFactory | null = null;

/**
 * 获取 ProviderFactory 单例
 *
 * @example
 * ```typescript
 * const factory = getProviderFactory();
 * const provider = await factory.getAvailableProvider();
 * ```
 */
export function getProviderFactory(
  config?: Partial<ProviderFactoryConfig>,
): ProviderFactory {
  if (!factoryInstance) {
    factoryInstance = new ProviderFactory(config);
  }
  return factoryInstance;
}

/**
 * 重置 ProviderFactory 单例
 *
 * 主要用于测试
 */
export function resetProviderFactory(): void {
  if (factoryInstance) {
    factoryInstance.stopHealthCheck();
    factoryInstance = null;
  }
}
