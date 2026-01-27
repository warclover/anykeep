/**
 * Classification Facade
 * 统一分类门面 - 单一公开 API 入口
 *
 * @version 1.1.0
 * @since 2026-01-24 Phase 2
 * @updated 2026-01-24 Phase 4.5: 集成增强容器
 */

import { logger } from "@/lib/logger";
import type {
  ClassificationRequest,
  ClassificationResult,
  ClassificationFacadeConfig,
  LegacyClassificationResult,
  IClassificationFacade,
} from "./core";
import { CONFIDENCE_THRESHOLDS } from "./core";
import { StrategyResolver } from "./strategy-resolver";
import {
  getContainer,
  isContainerInitialized,
} from "./infrastructure/container";

/**
 * 分类门面
 *
 * 职责：
 * 1. 提供统一的分类入口
 * 2. 路由到正确的策略
 * 3. 处理批量分类
 * 4. 向后兼容旧 API
 * 5. 自动注入增强容器到策略解析器（Phase 4.5）
 */
export class ClassificationFacade implements IClassificationFacade {
  private resolver: StrategyResolver;

  constructor(config?: ClassificationFacadeConfig) {
    this.resolver = new StrategyResolver({
      featureFlags: config?.featureFlags,
      container: config?.container,
    });

    // Phase 4.5: 如果容器已初始化但未传入，自动注入
    if (!config?.container && isContainerInitialized()) {
      this.resolver.setContainer(getContainer());
    }
  }

  /**
   * 设置增强容器
   * Phase 4.5: 允许延迟注入容器
   */
  setContainer(
    container: Parameters<StrategyResolver["setContainer"]>[0],
  ): void {
    this.resolver.setContainer(container);
  }

  /**
   * 统一分类入口
   */
  async classify(
    request: ClassificationRequest,
  ): Promise<ClassificationResult> {
    const startTime = Date.now();

    try {
      const strategy = await this.resolver.resolve(request.userId);

      logger.debug(
        {
          userId: request.userId,
          bookmarkId: request.bookmarkId,
          strategy: strategy.name,
        },
        "Classification: Starting",
      );

      const result = await strategy.classify(request);

      logger.info(
        {
          userId: request.userId,
          bookmarkId: request.bookmarkId,
          strategy: strategy.name,
          action: result.action,
          confidence: result.confidence,
          latencyMs: Date.now() - startTime,
        },
        "Classification: Completed",
      );

      return result;
    } catch (error) {
      logger.error(
        {
          userId: request.userId,
          bookmarkId: request.bookmarkId,
          error: error instanceof Error ? error.message : String(error),
          latencyMs: Date.now() - startTime,
        },
        "Classification: Failed",
      );

      // 返回安全默认值
      return {
        folderId: null,
        folderName: null,
        confidence: 0,
        action: "inbox",
        reason: "Classification failed",
      };
    }
  }

  /**
   * 批量分类
   */
  async classifyBatch(
    requests: ClassificationRequest[],
  ): Promise<ClassificationResult[]> {
    // 按用户分组，每组使用相同策略
    const grouped = this.groupByUser(requests);
    const results: ClassificationResult[] = [];

    for (const [userId, userRequests] of grouped) {
      const strategy = await this.resolver.resolve(userId);

      // 如果策略支持批量，使用批量方法
      if (strategy.classifyBatch) {
        const batchResults = await strategy.classifyBatch(userRequests);
        results.push(...batchResults);
      } else {
        // 否则逐个处理
        for (const request of userRequests) {
          const result = await strategy.classify(request);
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * 仅 T0 快速分类（用于 Optimistic UI）
   */
  async classifyQuick(
    request: ClassificationRequest,
  ): Promise<ClassificationResult> {
    const strategy = await this.resolver.resolve(request.userId);

    if (strategy.classifyT0Only) {
      return strategy.classifyT0Only(request);
    }

    // 降级到普通分类
    return strategy.classify(request);
  }

  /**
   * 按用户分组请求
   */
  private groupByUser(
    requests: ClassificationRequest[],
  ): Map<string, ClassificationRequest[]> {
    const grouped = new Map<string, ClassificationRequest[]>();

    for (const request of requests) {
      const existing = grouped.get(request.userId) || [];
      existing.push(request);
      grouped.set(request.userId, existing);
    }

    return grouped;
  }
}

// ============================================================================
// 单例和便捷函数
// ============================================================================

let facadeInstance: ClassificationFacade | null = null;

/**
 * 获取分类门面单例
 */
export function getClassificationFacade(
  config?: ClassificationFacadeConfig,
): ClassificationFacade {
  // Support creating a new instance if config is provided (e.g. for testing or specific context)
  if (config) {
    return new ClassificationFacade(config);
  }

  if (!facadeInstance) {
    facadeInstance = new ClassificationFacade(config);
  }
  return facadeInstance;
}

/**
 * 重置分类门面（用于测试）
 */
export function resetClassificationFacade(): void {
  facadeInstance = null;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { EnhancedContainer } from "./infrastructure/container";
import { registerAllServices } from "./infrastructure/container/registrations";

/**
 * 创建包含完整依赖注入的分类门面
 * (Request-scoped factory)
 */
export function createClassificationFacade(
  supabase: SupabaseClient,
  config?: ClassificationFacadeConfig,
): ClassificationFacade {
  const container = new EnhancedContainer({ supabase });
  registerAllServices(container);

  return new ClassificationFacade({
    ...config,
    container,
  });
}

// ============================================================================
// 向后兼容导出
// ============================================================================

/**
 * 向后兼容的分类函数
 *
 * @deprecated 使用 getClassificationFacade().classify() 代替
 */
export async function classifyBookmarkV2Compat(
  bookmarkId: number,
  title: string,
  summary: string | null,
  tags: string[],
  userId: string,
): Promise<LegacyClassificationResult> {
  const facade = getClassificationFacade();

  const result = await facade.classify({
    userId,
    bookmarkId: String(bookmarkId),
    title,
    summary: summary ?? undefined,
    tags,
    url: "",
  });

  // 转换为旧格式
  return {
    classified: result.confidence >= CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY,
    folderId: result.folderId,
    folderName: result.folderName ?? null,
    confidence: result.confidence,
    action: result.action,
    suggestionId: result.suggestionId,
  };
}
