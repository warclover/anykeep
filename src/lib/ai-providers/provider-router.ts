/**
 * AI Provider Router
 *
 * 职责：
 * - 管理多个 AI Provider
 * - 根据任务类型智能路由
 * - 实现故障转移和健康检查
 * - 电路断路器模式（Circuit Breaker）
 *
 * @version 1.2.0
 * @since 2025-12-22
 */

import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { logger } from "@/lib/logger";
import type {
  ProviderName,
  ProviderConfig,
  ProviderHealth,
  ProviderSelection,
  RoutingDecisionInput,
  AITaskType,
  CircuitBreakerConfig,
  CircuitState,
} from "./types";

// =============================================================================
// 模型创建器映射（策略模式）
// =============================================================================

/**
 * 模型创建器函数类型
 * 接收 API Key，返回可以创建模型的工厂函数
 */
type ModelCreatorFn = (apiKey: string) => (modelId: string) => LanguageModel;

/**
 * 阿里百炼云模型创建器
 * 使用 OpenAI 兼容接口
 */
const createAliyunBailian: ModelCreatorFn = (apiKey) => {
  const provider = createOpenAI({
    apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });
  // 使用 .chat() 强制使用 Chat Completions API
  // DashScope 不支持 OpenAI Responses API (/v1/responses)
  return (modelId: string) => provider.chat(modelId);
};

/**
 * 模型创建器映射表
 * 将 provider 名称映射到对应的创建函数，避免冗长的 switch 语句
 *
 * null 表示该 provider 尚未实现或不适用
 */
/**
 * OpenAI 模型创建器
 * 强制使用 Chat Completions API，避免 Responses API 兼容性问题
 */
const createOpenAIChat: ModelCreatorFn = (apiKey) => {
  const provider = createOpenAI({ apiKey });
  return (modelId: string) => provider.chat(modelId);
};

const MODEL_CREATORS: Partial<Record<ProviderName, ModelCreatorFn | null>> = {
  deepseek: (apiKey) => createDeepSeek({ apiKey }),
  "aliyun-bailian": createAliyunBailian,
  openai: createOpenAIChat,
  anthropic: (apiKey) => createAnthropic({ apiKey }),
  // TODO: 添加 Ollama 支持（本地模型）
  // ollama: () => createOllama({}),
  local: null, // 本地模型暂不支持
};

// =============================================================================
// 缓存配置
// =============================================================================

/**
 * 模型缓存 TTL（毫秒）
 * 默认 30 分钟，避免长时间持有可能过期的模型实例
 */
const MODEL_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * 模型缓存版本
 * 修改此值会使所有旧缓存失效
 * v2: 2026-01-06 修复 DashScope .chat() 方法强制使用 Chat Completions API
 */
const MODEL_CACHE_VERSION = "v2";

/**
 * 带 TTL 的缓存条目
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * 默认电路断路器配置
 */
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3, // 连续失败3次触发断开
  cooldownMs: 30000, // 断开后等待30秒
  halfOpenRequests: 2, // 半开状态允许2个测试请求
  recoveryThreshold: 2, // 需要2次成功才能完全恢复
};

/**
 * 默认 Provider 配置
 */
const DEFAULT_PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    name: "deepseek",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    supportedTasks: [
      "chat",
      "summary",
      "classify",
      "reasoning",
      "tool_calling",
    ],
    priority: 1,
    enabled: true,
    costFactor: 1, // 基准
    maxTokens: 8192,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
  {
    name: "aliyun-bailian",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    defaultModel: "qwen-turbo",
    supportedTasks: [
      "chat",
      "summary",
      "classify",
      "reasoning",
      "tool_calling",
    ],
    priority: 2, // DeepSeek 备选
    enabled: true,
    costFactor: 3, // 成本约为 DeepSeek 的 3 倍
    maxTokens: 8192,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
  {
    name: "openai",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    supportedTasks: [
      "chat",
      "summary",
      "classify",
      "reasoning",
      "vision",
      "tool_calling",
    ],
    priority: 3, // 第三备选
    enabled: true,
    costFactor: 5, // OpenAI 成本约为 DeepSeek 的 5 倍
    maxTokens: 128000,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
  {
    name: "anthropic",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-3-5-sonnet-20241022",
    supportedTasks: [
      "chat",
      "summary",
      "classify",
      "reasoning",
      "vision",
      "tool_calling",
    ],
    priority: 4, // 最后备选
    enabled: true,
    costFactor: 8, // Claude 成本较高
    maxTokens: 200000,
    supportsToolCalling: true,
    supportsStreaming: true,
  },
];

/**
 * AI Provider Router
 */
export class AIProviderRouter {
  private static instance: AIProviderRouter;
  private providers: Map<ProviderName, ProviderConfig> = new Map();
  private healthStatus: Map<ProviderName, ProviderHealth> = new Map();
  /** 模型缓存（带 TTL 支持） */
  private modelCache: Map<string, CacheEntry<LanguageModel>> = new Map();
  private circuitConfig: CircuitBreakerConfig;

  private constructor(circuitConfig?: Partial<CircuitBreakerConfig>) {
    this.circuitConfig = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...circuitConfig,
    };
    this.initializeProviders();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AIProviderRouter {
    if (!AIProviderRouter.instance) {
      AIProviderRouter.instance = new AIProviderRouter();
    }
    return AIProviderRouter.instance;
  }

  /**
   * 初始化 Providers
   */
  private initializeProviders(): void {
    for (const config of DEFAULT_PROVIDER_CONFIGS) {
      // 检查 API Key 是否存在
      const apiKey = process.env[config.apiKeyEnv];
      if (apiKey) {
        this.providers.set(config.name, config);
        this.healthStatus.set(config.name, {
          name: config.name,
          status: "healthy",
          lastCheckedAt: new Date(),
          consecutiveFailures: 0,
          circuitState: "closed",
          halfOpenRequestCount: 0,
          halfOpenSuccessCount: 0,
        });
        logger.info(
          { provider: config.name, model: config.defaultModel },
          `Provider initialized: ${config.name}`,
        );
      } else {
        logger.warn(
          { provider: config.name, apiKeyEnv: config.apiKeyEnv },
          `Provider ${config.name} skipped: API key not found`,
        );
      }
    }
  }

  /**
   * 获取 Provider 配置
   */
  getProviderConfig(name: ProviderName): ProviderConfig | undefined {
    return this.providers.get(name);
  }

  /**
   * 根据任务类型选择最佳 Provider
   */
  selectProvider(input: RoutingDecisionInput): ProviderSelection | null {
    const {
      taskType,
      preferredProvider,
      requiresToolCalling = false,
      requiresStreaming = false,
      maxCostFactor,
      minTokenLimit,
    } = input;

    // 1. 如果指定了首选 Provider，优先尝试
    if (preferredProvider) {
      const preferred = this.providers.get(preferredProvider);
      if (
        preferred &&
        preferred.enabled &&
        this.isProviderHealthy(preferredProvider)
      ) {
        const model = this.getModel(preferredProvider);
        if (model) {
          return {
            provider: preferred,
            model,
            reason: `Using preferred provider: ${preferredProvider}`,
          };
        }
      }
    }

    // 2. 过滤符合条件的 Providers
    const candidates = Array.from(this.providers.values())
      .filter((p) => p.enabled)
      .filter((p) => p.supportedTasks.includes(taskType))
      .filter((p) => !requiresToolCalling || p.supportsToolCalling)
      .filter((p) => !requiresStreaming || p.supportsStreaming)
      .filter((p) => !maxCostFactor || p.costFactor <= maxCostFactor)
      .filter((p) => !minTokenLimit || p.maxTokens >= minTokenLimit)
      .filter((p) => this.isProviderHealthy(p.name))
      .sort((a, b) => a.priority - b.priority);

    if (candidates.length === 0) {
      logger.error({ input }, "No suitable provider found");
      return null;
    }

    // 3. 选择优先级最高的
    const selected = candidates[0];
    const model = this.getModel(selected.name);

    if (!model) {
      logger.error(
        { provider: selected.name },
        "Failed to create model for selected provider",
      );
      return null;
    }

    return {
      provider: selected,
      model,
      reason: `Selected ${selected.name} for task ${taskType} (priority: ${selected.priority})`,
    };
  }

  /**
   * 获取指定 Provider 的模型
   *
   * 使用策略映射模式替代冗长的 switch 语句
   * 添加新 provider 只需在 MODEL_CREATORS 映射表中添加条目
   */
  getModel(providerName: ProviderName, modelId?: string): LanguageModel | null {
    const config = this.providers.get(providerName);
    if (!config) {
      return null;
    }

    const actualModelId = modelId || config.defaultModel;
    const cacheKey = `${MODEL_CACHE_VERSION}:${providerName}:${actualModelId}`;

    // 检查缓存（带 TTL 验证）
    const cached = this.modelCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // 缓存已过期，删除旧条目
    if (cached) {
      this.modelCache.delete(cacheKey);
    }

    try {
      // 获取模型创建器
      const creator = MODEL_CREATORS[providerName];
      if (creator === null) {
        logger.warn(
          { providerName },
          `Provider ${providerName} not yet implemented`,
        );
        return null;
      }
      if (creator === undefined) {
        logger.error({ providerName }, "Unknown provider");
        return null;
      }

      // 获取 API Key
      const apiKey = process.env[config.apiKeyEnv];
      if (!apiKey) {
        logger.error(
          { providerName, apiKeyEnv: config.apiKeyEnv },
          `${config.apiKeyEnv} not found`,
        );
        return null;
      }

      // 创建模型
      const providerInstance = creator(apiKey);
      const model = providerInstance(actualModelId);

      if (model) {
        // 缓存模型实例（带 TTL）
        this.modelCache.set(cacheKey, {
          value: model,
          expiresAt: Date.now() + MODEL_CACHE_TTL_MS,
        });
      }

      return model;
    } catch (error) {
      logger.error(
        { providerName, modelId: actualModelId, error },
        "Failed to create model",
      );
      return null;
    }
  }

  /**
   * 获取默认模型（用于简单场景）
   */
  getDefaultModel(): LanguageModel | null {
    const selection = this.selectProvider({ taskType: "chat" });
    return selection?.model ?? null;
  }

  /**
   * 检查 Provider 是否健康（考虑电路断路器状态）
   */
  isProviderHealthy(name: ProviderName): boolean {
    const health = this.healthStatus.get(name);
    if (!health) return false;

    // 检查电路断路器状态
    switch (health.circuitState) {
      case "closed":
        // 正常状态，允许请求
        return health.status !== "unhealthy";

      case "open":
        // 检查是否已过冷却期
        if (this.shouldTransitionToHalfOpen(health)) {
          this.transitionCircuitState(name, "half-open");
          logger.info(
            { provider: name },
            `Circuit breaker transitioned to half-open for ${name}`,
          );
          return true; // 允许测试请求
        }
        return false; // 冷却期内拒绝请求

      case "half-open":
        // 半开状态，检查是否还有测试配额
        return (
          health.halfOpenRequestCount < this.circuitConfig.halfOpenRequests
        );

      default:
        return false;
    }
  }

  /**
   * 检查是否应该从 open 转换到 half-open
   */
  private shouldTransitionToHalfOpen(health: ProviderHealth): boolean {
    if (!health.circuitOpenedAt) return true;
    const elapsed = Date.now() - health.circuitOpenedAt.getTime();
    return elapsed >= this.circuitConfig.cooldownMs;
  }

  /**
   * 转换电路断路器状态
   */
  private transitionCircuitState(
    name: ProviderName,
    newState: CircuitState,
  ): void {
    const health = this.healthStatus.get(name);
    if (!health) return;

    const oldState = health.circuitState;
    health.circuitState = newState;

    switch (newState) {
      case "open":
        health.circuitOpenedAt = new Date();
        health.halfOpenRequestCount = 0;
        health.halfOpenSuccessCount = 0;
        logger.warn(
          { provider: name, oldState },
          `Circuit breaker OPENED for ${name}`,
        );
        break;

      case "half-open":
        health.halfOpenRequestCount = 0;
        health.halfOpenSuccessCount = 0;
        logger.info(
          { provider: name, oldState },
          `Circuit breaker HALF-OPEN for ${name}`,
        );
        break;

      case "closed":
        health.circuitOpenedAt = undefined;
        health.halfOpenRequestCount = 0;
        health.halfOpenSuccessCount = 0;
        health.consecutiveFailures = 0;
        logger.info(
          { provider: name, oldState },
          `Circuit breaker CLOSED for ${name}`,
        );
        break;
    }
  }

  /**
   * 记录 Provider 成功
   */
  recordSuccess(name: ProviderName, latencyMs: number): void {
    const health = this.healthStatus.get(name);
    if (!health) return;

    health.latencyMs = latencyMs;
    health.lastCheckedAt = new Date();
    health.errorMessage = undefined;

    // 根据当前电路状态处理
    switch (health.circuitState) {
      case "half-open":
        // 半开状态下成功
        health.halfOpenRequestCount++;
        health.halfOpenSuccessCount++;

        // 检查是否达到恢复阈值
        if (
          health.halfOpenSuccessCount >= this.circuitConfig.recoveryThreshold
        ) {
          this.transitionCircuitState(name, "closed");
          health.status = "healthy";
        }
        break;

      case "closed":
        // 正常状态下成功
        health.status = "healthy";
        health.consecutiveFailures = 0;
        break;

      case "open":
        // 不应该发生，但以防万一
        logger.warn(
          { provider: name },
          `Unexpected success in open state for ${name}`,
        );
        break;
    }
  }

  /**
   * 记录 Provider 失败
   */
  recordFailure(name: ProviderName, error: string): void {
    const health = this.healthStatus.get(name);
    if (!health) return;

    health.lastCheckedAt = new Date();
    health.errorMessage = error;
    health.consecutiveFailures++;

    // 根据当前电路状态处理
    switch (health.circuitState) {
      case "half-open":
        // 半开状态下失败，立即重新断开
        health.halfOpenRequestCount++;
        this.transitionCircuitState(name, "open");
        health.status = "unhealthy";
        logger.warn(
          { provider: name, error },
          `Half-open test failed for ${name}, circuit re-opened`,
        );
        break;

      case "closed":
        // 正常状态下失败
        if (health.consecutiveFailures >= this.circuitConfig.failureThreshold) {
          this.transitionCircuitState(name, "open");
          health.status = "unhealthy";
        } else {
          health.status = "degraded";
        }
        break;

      case "open":
        // 已经断开，保持状态
        break;
    }
  }

  /**
   * 获取所有 Provider 的健康状态
   */
  getHealthStatus(): ProviderHealth[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * 获取可用的 Provider 列表
   */
  getAvailableProviders(): ProviderConfig[] {
    return Array.from(this.providers.values()).filter(
      (p) => p.enabled && this.isProviderHealthy(p.name),
    );
  }

  /**
   * 根据任务类型获取推荐的 Provider
   */
  getRecommendedProvider(taskType: AITaskType): ProviderName | null {
    const selection = this.selectProvider({ taskType });
    return selection?.provider.name ?? null;
  }

  /**
   * 执行带故障转移的操作
   */
  async executeWithFallback<T>(
    taskType: AITaskType,
    operation: (model: LanguageModel) => Promise<T>,
  ): Promise<T> {
    const candidates = Array.from(this.providers.values())
      .filter((p) => p.enabled && p.supportedTasks.includes(taskType))
      .filter((p) => this.isProviderHealthy(p.name))
      .sort((a, b) => a.priority - b.priority);

    let lastError: Error | null = null;

    for (const provider of candidates) {
      const model = this.getModel(provider.name);
      if (!model) continue;

      const startTime = performance.now();

      try {
        const result = await operation(model);
        const latencyMs = Math.round(performance.now() - startTime);
        this.recordSuccess(provider.name, latencyMs);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.recordFailure(provider.name, errorMessage);
        lastError = error instanceof Error ? error : new Error(errorMessage);

        logger.warn(
          { provider: provider.name, error: errorMessage },
          `Provider ${provider.name} failed, trying next...`,
        );
      }
    }

    throw lastError || new Error("All providers failed");
  }

  /**
   * 获取指定 Provider 的电路断路器状态
   */
  getCircuitState(name: ProviderName): CircuitState | null {
    const health = this.healthStatus.get(name);
    return health?.circuitState ?? null;
  }

  /**
   * 手动重置 Provider 的电路断路器（用于管理/调试）
   */
  resetCircuitBreaker(name: ProviderName): boolean {
    const health = this.healthStatus.get(name);
    if (!health) return false;

    this.transitionCircuitState(name, "closed");
    health.status = "healthy";
    health.consecutiveFailures = 0;
    health.errorMessage = undefined;

    logger.info(
      { provider: name },
      `Circuit breaker manually reset for ${name}`,
    );

    return true;
  }

  /**
   * 获取电路断路器配置
   */
  getCircuitBreakerConfig(): CircuitBreakerConfig {
    return { ...this.circuitConfig };
  }

  /**
   * 获取详细的电路断路器状态报告
   */
  getCircuitBreakerReport(): Array<{
    provider: ProviderName;
    circuitState: CircuitState;
    consecutiveFailures: number;
    cooldownRemainingMs: number | null;
    halfOpenProgress: string | null;
  }> {
    const report: Array<{
      provider: ProviderName;
      circuitState: CircuitState;
      consecutiveFailures: number;
      cooldownRemainingMs: number | null;
      halfOpenProgress: string | null;
    }> = [];

    for (const health of this.healthStatus.values()) {
      let cooldownRemainingMs: number | null = null;
      let halfOpenProgress: string | null = null;

      if (health.circuitState === "open" && health.circuitOpenedAt) {
        const elapsed = Date.now() - health.circuitOpenedAt.getTime();
        cooldownRemainingMs = Math.max(
          0,
          this.circuitConfig.cooldownMs - elapsed,
        );
      }

      if (health.circuitState === "half-open") {
        halfOpenProgress = `${health.halfOpenSuccessCount}/${this.circuitConfig.recoveryThreshold} successes`;
      }

      report.push({
        provider: health.name,
        circuitState: health.circuitState,
        consecutiveFailures: health.consecutiveFailures,
        cooldownRemainingMs,
        halfOpenProgress,
      });
    }

    return report;
  }
}

/**
 * 导出单例实例
 */
export const aiProviderRouter = AIProviderRouter.getInstance();
