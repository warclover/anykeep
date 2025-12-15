/**
 * Summary Service Implementation
 *
 * 摘要服务核心实现，集成 Provider、EventBus、JobQueue
 * v3.0: 支持增强模式（实体提取、关键数据、难度评估）
 *
 * @version 3.0.0
 * @since 2025-12-12
 * @updated 2025-12-14 - 添加增强模式支持
 */

import { logger } from "@/lib/logger";
import { eventBus } from "@/lib/shared/event-bus";
import { JobQueueService } from "@/lib/classification/services/job-queue.service";
import type {
  SummaryCompletedEvent,
  TagsGeneratedEvent,
  EntitiesExtractedEvent,
  KeyDataExtractedEvent,
} from "@/lib/shared/event-bus/event-types";
import type { ISummaryService } from "./summary.service.interface";
import type {
  SummaryInput,
  SummaryResult,
  SummaryServiceConfig,
  SummaryServiceStats,
  GenerateOptions,
  ProviderHealth,
  ProviderName,
  ContentType,
  SummaryMode,
} from "../summary.types";
import { SummaryError, SummaryErrorCode } from "../summary.types";
import {
  getProviderFactory,
  EnhancedSummaryProvider,
  type ISummaryProvider,
} from "../providers";
import { getSummaryServiceConfig, isFallbackEnabled } from "../summary.config";
import {
  getUserSummaryMode,
  getEnhancedModeConfig,
} from "@/lib/classification/config/ai-summary-config";
import { getEntityRepository } from "../repositories/entity.repository";
import { getSummaryRepository } from "../repositories/summary.repository";
import { createClient } from "@/lib/supabase/server";
import { initializeLinkEventHandler } from "@/lib/knowledge-link";

/**
 * 摘要服务统计
 */
interface ServiceStats {
  totalGenerated: number;
  successCount: number;
  failedCount: number;
  totalLatencyMs: number;
  providerUsage: Record<ProviderName, number>;
  fallbackTriggered: number;
  byContentType: Record<string, number>;
  // v3.0 统计
  enhancedModeUsage: number;
  entitiesExtracted: number;
}

/**
 * 摘要服务实现
 *
 * 核心功能：
 * - 通过 ProviderFactory 获取 Provider 生成摘要
 * - 通过 EventBus 发布事件，与分类系统解耦
 * - 支持通过 JobQueue 异步处理
 * - 支持回退机制
 *
 * @example
 * ```typescript
 * const service = new SummaryService();
 *
 * // 同步生成
 * const result = await service.generate({
 *   bookmarkId: 123,
 *   userId: 'user-uuid',
 *   title: '文章标题',
 *   content: '文章内容...',
 * });
 *
 * // 异步入队（通过 JobQueue）
 * await service.enqueueGeneration(123, 'user-uuid');
 * ```
 */
export class SummaryService implements ISummaryService {
  private config: SummaryServiceConfig;
  private stats: ServiceStats;
  private jobQueue: JobQueueService;

  constructor(config?: Partial<SummaryServiceConfig>) {
    this.config = {
      ...getSummaryServiceConfig(),
      ...config,
    };

    this.stats = {
      totalGenerated: 0,
      successCount: 0,
      failedCount: 0,
      totalLatencyMs: 0,
      providerUsage: {
        deepseek: 0,
        "aliyun-bailian": 0,
        ollama: 0,
        local: 0, // V4.2.7: 本地降级 Provider
      },
      fallbackTriggered: 0,
      byContentType: {},
      // v3.0 统计
      enhancedModeUsage: 0,
      entitiesExtracted: 0,
    };

    this.jobQueue = new JobQueueService("summary-service");
  }

  /**
   * 生成摘要
   *
   * v3.0: 根据用户设置或选项自动选择标准模式或增强模式
   */
  async generate(
    input: SummaryInput,
    options?: GenerateOptions,
  ): Promise<SummaryResult> {
    const startTime = Date.now();

    // 确定摘要模式
    const summaryMode: SummaryMode =
      options?.summaryMode || (await getUserSummaryMode(input.userId));

    // 根据模式选择生成方法
    if (summaryMode === "enhanced") {
      return this.generateEnhanced(input, options, startTime);
    }

    return this.generateStandard(input, options, startTime);
  }

  /**
   * 标准模式生成摘要（v2.0）
   */
  private async generateStandard(
    input: SummaryInput,
    options: GenerateOptions | undefined,
    startTime: number,
  ): Promise<SummaryResult> {
    let result: SummaryResult | null = null;
    let lastError: Error | null = null;
    let fallbackUsed = false;

    const factory = getProviderFactory();

    // 如果指定了 Provider，直接使用
    if (options?.forceProvider) {
      const provider = factory.getProvider(options.forceProvider);
      if (!provider) {
        throw new SummaryError(
          SummaryErrorCode.PROVIDER_UNAVAILABLE,
          `Provider ${options.forceProvider} not available`,
          options.forceProvider,
        );
      }

      try {
        result = await provider.generateSummary(input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        throw new SummaryError(
          SummaryErrorCode.API_CALL_FAILED,
          lastError.message,
          options.forceProvider,
          lastError,
        );
      }
    } else {
      // 自动选择 Provider，支持回退
      const providersToTry: ISummaryProvider[] = [];

      try {
        const primaryProvider = await factory.getAvailableProvider();
        providersToTry.push(primaryProvider);
      } catch {
        // 没有可用的主 Provider
      }

      // 如果启用回退，添加所有其他可用 Provider
      if (this.config.enableFallback && isFallbackEnabled()) {
        const allHealth = await factory.getAllHealth();
        for (const [name, health] of allHealth) {
          if (health.available) {
            const provider = factory.getProvider(name);
            if (provider && !providersToTry.includes(provider)) {
              providersToTry.push(provider);
            }
          }
        }
      }

      if (providersToTry.length === 0) {
        throw new SummaryError(
          SummaryErrorCode.PROVIDER_UNAVAILABLE,
          "No available providers",
        );
      }

      // 按优先级尝试
      providersToTry.sort((a, b) => a.priority - b.priority);

      for (let i = 0; i < providersToTry.length; i++) {
        const provider = providersToTry[i];

        try {
          result = await provider.generateSummary(input);
          if (i > 0) {
            fallbackUsed = true;
            this.stats.fallbackTriggered++;
          }
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.warn(
            {
              provider: provider.name,
              error: lastError.message,
              attemptIndex: i,
            },
            "SummaryService: Provider failed, trying next",
          );
        }
      }
    }

    if (!result) {
      this.stats.failedCount++;
      throw new SummaryError(
        SummaryErrorCode.API_CALL_FAILED,
        lastError?.message || "All providers failed",
        undefined,
        lastError || undefined,
      );
    }

    // 更新统计
    const latencyMs = Date.now() - startTime;
    this.updateStats(result, latencyMs, fallbackUsed);

    // 发布事件
    if (this.config.emitEvents) {
      await this.emitEvents(
        input,
        result,
        options?.needsClassification ?? true,
        "standard",
      );
    }

    logger.info(
      {
        bookmarkId: input.bookmarkId,
        provider: result.providerUsed,
        latencyMs,
        fallbackUsed,
        tagsCount: result.tags.length,
        mode: "standard",
      },
      "SummaryService: Summary generated successfully (standard mode)",
    );

    return result;
  }

  /**
   * 增强模式生成摘要（v3.0）
   *
   * 包含实体提取、关键数据、难度评估
   */
  private async generateEnhanced(
    input: SummaryInput,
    options: GenerateOptions | undefined,
    startTime: number,
  ): Promise<SummaryResult> {
    const enhancedConfig = getEnhancedModeConfig();
    const provider = new EnhancedSummaryProvider(undefined, enhancedConfig);

    let result: SummaryResult;

    try {
      result = await provider.generateSummary(input);
    } catch (error) {
      // 增强模式失败，降级到标准模式
      logger.warn(
        {
          bookmarkId: input.bookmarkId,
          error: error instanceof Error ? error.message : String(error),
        },
        "SummaryService: Enhanced mode failed, falling back to standard",
      );
      return this.generateStandard(input, options, startTime);
    }

    // 更新统计
    const latencyMs = Date.now() - startTime;
    this.updateStats(result, latencyMs, false);
    this.stats.enhancedModeUsage++;

    // 保存实体（如果有）
    if (
      options?.saveEntities !== false &&
      result.enhanced?.entities &&
      result.enhanced.entities.length > 0
    ) {
      try {
        const entityRepo = getEntityRepository();
        const savedCount = await entityRepo.saveEntities(
          input.bookmarkId,
          input.userId,
          result.enhanced.entities,
        );
        this.stats.entitiesExtracted += savedCount;

        logger.info(
          {
            bookmarkId: input.bookmarkId,
            entitiesCount: savedCount,
          },
          "SummaryService: Entities saved successfully",
        );
      } catch (err) {
        // 实体保存失败不影响摘要结果
        logger.error(
          {
            bookmarkId: input.bookmarkId,
            error: err instanceof Error ? err.message : String(err),
          },
          "SummaryService: Failed to save entities",
        );
      }
    }

    // 发布事件
    if (this.config.emitEvents) {
      await this.emitEvents(
        input,
        result,
        options?.needsClassification ?? true,
        "enhanced",
      );

      // 发布实体提取事件
      if (result.enhanced?.entities && result.enhanced.entities.length > 0) {
        await this.emitEntitiesExtractedEvent(input, result);
      }

      // 发布关键数据提取事件
      if (result.enhanced?.key_data && result.enhanced.key_data.length > 0) {
        await this.emitKeyDataExtractedEvent(input, result);
      }
    }

    logger.info(
      {
        bookmarkId: input.bookmarkId,
        provider: result.providerUsed,
        latencyMs,
        tagsCount: result.tags.length,
        entitiesCount: result.enhanced?.entities?.length || 0,
        keyDataCount: result.enhanced?.key_data?.length || 0,
        difficulty: result.enhanced?.difficulty,
        mode: "enhanced",
      },
      "SummaryService: Summary generated successfully (enhanced mode)",
    );

    return result;
  }

  /**
   * 批量生成摘要
   */
  async generateBatch(
    inputs: SummaryInput[],
    options?: GenerateOptions,
  ): Promise<Array<SummaryResult | Error>> {
    const results: Array<SummaryResult | Error> = [];

    // 并发处理，但限制并发数
    const concurrencyLimit = 5;
    const chunks: SummaryInput[][] = [];

    for (let i = 0; i < inputs.length; i += concurrencyLimit) {
      chunks.push(inputs.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map((input) => this.generate(input, options)),
      );

      for (const result of chunkResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push(
            result.reason instanceof Error
              ? result.reason
              : new Error(String(result.reason)),
          );
        }
      }
    }

    return results;
  }

  /**
   * 重新生成摘要
   *
   * V4.2.4: 实现从数据库获取书签信息并重新生成
   *
   * @param bookmarkId - 书签 ID
   * @param userId - 用户 ID
   * @param options - 生成选项
   */
  async regenerate(
    bookmarkId: number,
    userId: string,
    options?: GenerateOptions,
  ): Promise<SummaryResult> {
    // 1. 从数据库获取书签信息
    const supabase = await createClient();
    const repository = getSummaryRepository(supabase);
    const bookmark = await repository.getBookmarkForSummary(bookmarkId, userId);

    if (!bookmark) {
      throw new SummaryError(
        SummaryErrorCode.INVALID_INPUT,
        `Bookmark ${bookmarkId} not found for user ${userId}`,
      );
    }

    // 2. 构建 SummaryInput
    const input: SummaryInput = {
      bookmarkId: bookmark.id,
      userId: bookmark.userId,
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
    };

    // 3. 调用 generate 方法，强制重新生成
    logger.info({ bookmarkId, userId }, "SummaryService: Regenerating summary");

    return this.generate(input, {
      ...options,
      forceRegenerate: true,
    });
  }

  /**
   * 入队摘要生成任务
   *
   * 通过 JobQueue 异步处理摘要生成
   */
  async enqueueGeneration(
    bookmarkId: number,
    userId: string,
    options?: {
      priority?: number;
      needsClassification?: boolean;
    },
  ): Promise<string> {
    const jobId = await this.jobQueue.enqueue(
      userId,
      "generate_summary",
      {
        bookmarkId,
        needsClassification: options?.needsClassification ?? true,
      },
      {
        priority: options?.priority ?? 0,
      },
    );

    logger.info(
      { bookmarkId, userId, jobId },
      "SummaryService: Summary generation enqueued",
    );

    return jobId;
  }

  /**
   * 批量入队摘要生成任务
   */
  async enqueueBatchGeneration(
    bookmarkIds: number[],
    userId: string,
    options?: {
      priority?: number;
    },
  ): Promise<string[]> {
    const payloads = bookmarkIds.map((bookmarkId) => ({
      bookmarkId,
      needsClassification: true,
    }));

    const jobIds = await this.jobQueue.enqueueBatch(
      userId,
      "batch_generate_summary",
      payloads,
      {
        priority: options?.priority ?? 0,
      },
    );

    logger.info(
      { count: bookmarkIds.length, userId },
      "SummaryService: Batch summary generation enqueued",
    );

    return jobIds;
  }

  /**
   * 获取所有 Provider 健康状态
   */
  async getProvidersHealth(): Promise<Map<ProviderName, ProviderHealth>> {
    const factory = getProviderFactory();
    return factory.getAllHealth();
  }

  /**
   * 获取服务统计
   */
  async getStats(): Promise<SummaryServiceStats> {
    const successRate =
      this.stats.totalGenerated > 0
        ? this.stats.successCount / this.stats.totalGenerated
        : 0;

    const averageLatencyMs =
      this.stats.successCount > 0
        ? this.stats.totalLatencyMs / this.stats.successCount
        : 0;

    const fallbackRate =
      this.stats.successCount > 0
        ? this.stats.fallbackTriggered / this.stats.successCount
        : 0;

    return {
      totalGenerated: this.stats.totalGenerated,
      successRate,
      averageLatencyMs,
      providerUsage: { ...this.stats.providerUsage },
      fallbackRate,
      byContentType: this.stats.byContentType as Record<ContentType, number>,
    };
  }

  /**
   * 获取服务配置
   */
  getConfig(): SummaryServiceConfig {
    return { ...this.config };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 更新统计
   */
  private updateStats(
    result: SummaryResult,
    latencyMs: number,
    _fallbackUsed: boolean,
  ): void {
    this.stats.totalGenerated++;
    this.stats.successCount++;
    this.stats.totalLatencyMs += latencyMs;

    if (result.providerUsed) {
      this.stats.providerUsage[result.providerUsed]++;
    }

    if (result.contentType) {
      this.stats.byContentType[result.contentType] =
        (this.stats.byContentType[result.contentType] || 0) + 1;
    }
  }

  /**
   * 发布事件
   */
  private async emitEvents(
    input: SummaryInput,
    result: SummaryResult,
    needsClassification: boolean,
    summaryMode: SummaryMode = "standard",
  ): Promise<void> {
    // 发布摘要完成事件
    const summaryEvent: SummaryCompletedEvent = {
      userId: input.userId,
      bookmarkId: input.bookmarkId,
      summaryVersion: result.version,
      summaryMode,
      tagsGenerated: result.tags.length,
      entitiesExtracted: result.enhanced?.entities?.length,
      processingTimeMs: result.latencyMs,
      needsClassification,
      timestamp: new Date().toISOString(),
    };

    eventBus.emit("summary:completed", summaryEvent);

    // 如果有标签，发布标签生成事件
    if (result.tags.length > 0) {
      const tagsEvent: TagsGeneratedEvent = {
        userId: input.userId,
        bookmarkId: input.bookmarkId,
        tags: result.tags,
        source: "ai_summary",
        timestamp: new Date().toISOString(),
      };

      eventBus.emit("summary:tags_generated", tagsEvent);
    }
  }

  /**
   * 发布实体提取事件
   */
  private async emitEntitiesExtractedEvent(
    input: SummaryInput,
    result: SummaryResult,
  ): Promise<void> {
    if (!result.enhanced?.entities || result.enhanced.entities.length === 0) {
      return;
    }

    const event: EntitiesExtractedEvent = {
      userId: input.userId,
      bookmarkId: input.bookmarkId,
      entities: result.enhanced.entities.map((e) => ({
        name: e.name,
        type: e.type,
        confidence: e.confidence,
      })),
      entityCount: result.enhanced.entities.length,
      needsLinkProcessing: true, // 触发知识关联处理
      timestamp: new Date().toISOString(),
    };

    eventBus.emit("summary:entities_extracted", event);
  }

  /**
   * 发布关键数据提取事件
   */
  private async emitKeyDataExtractedEvent(
    input: SummaryInput,
    result: SummaryResult,
  ): Promise<void> {
    if (!result.enhanced?.key_data || result.enhanced.key_data.length === 0) {
      return;
    }

    const event: KeyDataExtractedEvent = {
      userId: input.userId,
      bookmarkId: input.bookmarkId,
      keyData: result.enhanced.key_data.map((k) => ({
        label: k.label,
        value: k.value,
        unit: k.unit,
      })),
      timestamp: new Date().toISOString(),
    };

    eventBus.emit("summary:key_data_extracted", event);
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let serviceInstance: SummaryService | null = null;
let linkEventHandlerInitialized = false;

/**
 * 获取 SummaryService 单例
 *
 * 同时确保 LinkEventHandler 已初始化，用于监听摘要事件并触发知识关联
 */
export function getSummaryService(
  config?: Partial<SummaryServiceConfig>,
): SummaryService {
  if (!serviceInstance) {
    serviceInstance = new SummaryService(config);
  }

  // 确保 LinkEventHandler 已初始化（仅初始化一次）
  // 这会注册事件监听器，当摘要完成时自动触发知识关联发现
  if (!linkEventHandlerInitialized) {
    try {
      initializeLinkEventHandler({
        enableOnSummaryCompleted: true,
        enableOnEntitiesExtracted: true,
        processingDelayMs: 1000,
        debug: process.env.NODE_ENV === "development",
      });
      linkEventHandlerInitialized = true;
      logger.debug("LinkEventHandler initialized with SummaryService");
    } catch (error) {
      // 不阻塞摘要服务，仅记录警告
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to initialize LinkEventHandler, knowledge linking disabled",
      );
    }
  }

  return serviceInstance;
}

/**
 * 重置 SummaryService 单例（主要用于测试）
 */
export function resetSummaryService(): void {
  serviceInstance = null;
  linkEventHandlerInitialized = false;
}
