/**
 * AI Summary Provider Interface
 *
 * 定义所有 AI Provider 必须实现的统一接口
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

import type {
  SummaryInput,
  SummaryResult,
  ProviderConfig,
  ProviderHealth,
  ProviderName,
  StructuredSummary,
} from "../summary.types";

/**
 * 摘要 Provider 接口
 *
 * 所有 AI Provider（DeepSeek、阿里百炼云、Ollama 等）必须实现此接口
 *
 * @example
 * ```typescript
 * class DeepSeekProvider implements ISummaryProvider {
 *   readonly name = 'deepseek';
 *   readonly priority = 1;
 *
 *   async generateSummary(input: SummaryInput): Promise<SummaryResult> {
 *     // 实现生成逻辑
 *   }
 *   // ... 其他方法
 * }
 * ```
 */
export interface ISummaryProvider {
  /**
   * Provider 名称
   * 用于日志、监控和配置
   */
  readonly name: ProviderName;

  /**
   * Provider 优先级
   * 数字越小优先级越高
   * - 1: 主力 Provider (DeepSeek)
   * - 2: 备选 Provider (阿里百炼云)
   * - 3: 本地 Provider (Ollama)
   */
  readonly priority: number;

  /**
   * 生成摘要
   *
   * 核心方法：调用 AI API 生成摘要和标签
   *
   * @param input - 摘要输入（标题、内容、URL 等）
   * @returns 摘要结果（摘要文本、标签、Token 使用量等）
   * @throws {SummaryError} 当 API 调用失败或解析失败时
   *
   * @example
   * ```typescript
   * const result = await provider.generateSummary({
   *   bookmarkId: 123,
   *   userId: 'user-uuid',
   *   title: '文章标题',
   *   content: '文章内容...',
   * });
   * console.log(result.summary, result.tags);
   * ```
   */
  generateSummary(input: SummaryInput): Promise<SummaryResult>;

  /**
   * 健康检查
   *
   * 检查 Provider 是否可用（API Key 有效、网络可达等）
   *
   * @returns 健康状态（可用性、延迟、错误信息）
   *
   * @example
   * ```typescript
   * const health = await provider.healthCheck();
   * if (health.available) {
   *   console.log(`Provider available, latency: ${health.latencyMs}ms`);
   * } else {
   *   console.error(`Provider unavailable: ${health.error}`);
   * }
   * ```
   */
  healthCheck(): Promise<ProviderHealth>;

  /**
   * 估算成本
   *
   * 根据 Token 数量估算 API 调用成本
   *
   * @param tokenCount - Token 数量
   * @returns 估算成本（单位：分）
   *
   * @example
   * ```typescript
   * const cost = provider.estimateCost(1000);
   * console.log(`Estimated cost: ¥${cost / 100}`);
   * ```
   */
  estimateCost(tokenCount: number): number;

  /**
   * 获取配置
   *
   * 返回 Provider 配置（API Key 会被隐藏）
   *
   * @returns Provider 配置
   */
  getConfig(): ProviderConfig;

  /**
   * 是否支持流式输出
   *
   * 用于判断是否可以使用 generateSummaryStream 方法
   *
   * @returns 是否支持流式输出
   */
  supportsStreaming(): boolean;

  /**
   * 流式生成摘要（可选）
   *
   * 逐字返回生成结果，用于实时显示
   *
   * @param input - 摘要输入
   * @returns AsyncGenerator，逐步返回生成的文本
   *
   * @example
   * ```typescript
   * if (provider.supportsStreaming()) {
   *   for await (const chunk of provider.generateSummaryStream!(input)) {
   *     process.stdout.write(chunk);
   *   }
   * }
   * ```
   */
  generateSummaryStream?(
    input: SummaryInput,
  ): AsyncGenerator<string, SummaryResult, unknown>;
}

/**
 * Provider 工厂配置
 */
export interface ProviderFactoryConfig {
  /** 启用的 Provider 列表 */
  enabledProviders: ProviderName[];
  /** 是否启用回退 */
  enableFallback: boolean;
  /** 健康检查间隔 (ms) */
  healthCheckIntervalMs: number;
}

/**
 * Provider 工厂接口
 *
 * 管理所有 Provider 实例，支持健康检查和智能路由
 */
export interface IProviderFactory {
  /**
   * 获取可用的 Provider
   * 按优先级排序，跳过不健康的 Provider
   */
  getAvailableProvider(): Promise<ISummaryProvider>;

  /**
   * 获取指定 Provider
   */
  getProvider(name: ProviderName): ISummaryProvider | undefined;

  /**
   * 获取所有 Provider 健康状态
   */
  getAllHealth(): Promise<Map<ProviderName, ProviderHealth>>;

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void;

  /**
   * 重新初始化所有 Provider
   */
  reinitialize(): void;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Prompt 构建结果
 */
export interface PromptBuildResult {
  /** System Prompt */
  systemPrompt: string;
  /** User Prompt */
  userPrompt: string;
  /** 温度参数 */
  temperature: number;
  /** 最大 Token 数 */
  maxTokens: number;
}

/**
 * API 响应解析结果
 */
export interface ParsedResponse {
  /** 摘要文本 */
  summary: string;
  /** 标签列表 */
  tags: string[];
  /** 版本 */
  version: 1 | 2;
  /** 结构化摘要（仅 V2） */
  structured?: StructuredSummary;
}

/**
 * Provider 基类抽象方法
 */
export interface IProviderBase {
  /**
   * 构建 Prompt
   */
  buildPrompts(input: SummaryInput): PromptBuildResult;

  /**
   * 解析响应
   */
  parseResponse(content: string): ParsedResponse;
}
