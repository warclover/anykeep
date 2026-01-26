/**
 * Classification Module Dependency Container
 * Manages service instances and dependencies
 *
 * @updated 2026-01-24 Phase 1: V3 废弃移除
 * @updated 2026-01-24 Phase 4: 增强容器集成
 * @updated 2026-01-24 Phase 4.4: 迁移到增强容器委托模式
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IClassificationService,
  IInboxOrganizerService,
  IInterestService,
} from "./services/interfaces";
import type { IMatcher } from "./strategies/interfaces";

// Repositories - 仅用于类型
import type {
  FolderProfileRepository,
  BookmarkRepository,
  InterestRepository,
  SuggestionRepository,
} from "./repositories";

// Services - 仅用于类型
import type { UserStageService } from "./services";

import { logger } from "@/lib/logger";

// Phase 4: 增强容器
import type { EnhancedContainer } from "./infrastructure/container";
import {
  initializeContainer as initEnhanced,
  getContainer as getEnhanced,
  isContainerInitialized as isEnhancedInitialized,
  resetContainer as resetEnhanced,
  registerAllServices,
  SERVICE_TYPES,
} from "./infrastructure/container";

/**
 * Dependency injection container for classification module
 *
 * Phase 4.4: 现在委托给 EnhancedContainer 管理所有服务实例
 * 保留此类以保持向后兼容，新代码建议直接使用 getEnhancedContainer()
 *
 * @deprecated 建议迁移到 EnhancedContainer
 * 使用 getEnhancedContainer() 获取新容器
 */
export class ClassificationContainer {
  private supabase: SupabaseClient;
  private enhancedContainer: EnhancedContainer;

  // Singleton instance
  private static instance: ClassificationContainer | null = null;

  private constructor(supabase: SupabaseClient) {
    this.supabase = supabase;

    // Phase 4: 初始化增强容器并注册所有服务
    this.enhancedContainer = initEnhanced({ supabase });
    registerAllServices(this.enhancedContainer);
  }

  /**
   * Initialize container with Supabase client
   */
  static initialize(supabase: SupabaseClient): ClassificationContainer {
    if (!ClassificationContainer.instance) {
      ClassificationContainer.instance = new ClassificationContainer(supabase);
    } else {
      // Update supabase client if already initialized
      ClassificationContainer.instance.supabase = supabase;
      // 重新初始化增强容器
      resetEnhanced();
      ClassificationContainer.instance.enhancedContainer = initEnhanced({
        supabase,
      });
      registerAllServices(ClassificationContainer.instance.enhancedContainer);
    }
    return ClassificationContainer.instance;
  }

  /**
   * Get container instance
   * @throws Error if not initialized
   */
  static getInstance(): ClassificationContainer {
    if (!ClassificationContainer.instance) {
      throw new Error(
        "ClassificationContainer not initialized. Call initialize() first.",
      );
    }
    return ClassificationContainer.instance;
  }

  /**
   * Check if container is initialized
   */
  static isInitialized(): boolean {
    return ClassificationContainer.instance !== null;
  }

  /**
   * Reset container (for testing)
   */
  static reset(): void {
    ClassificationContainer.instance = null;
    // 重置增强容器（清除所有缓存实例）
    resetEnhanced();
  }

  /**
   * 获取增强容器
   * Phase 4: 推荐使用此方法获取服务
   */
  getEnhanced(): EnhancedContainer {
    return this.enhancedContainer;
  }

  // ============================================================================
  // Repository getters - 委托给 EnhancedContainer
  // ============================================================================

  private getFolderProfileRepository(): FolderProfileRepository {
    return this.enhancedContainer.get<FolderProfileRepository>(
      SERVICE_TYPES.FolderProfileRepository,
    );
  }

  private getBookmarkRepository(): BookmarkRepository {
    return this.enhancedContainer.get<BookmarkRepository>(
      SERVICE_TYPES.BookmarkRepository,
    );
  }

  private getInterestRepository(): InterestRepository {
    return this.enhancedContainer.get<InterestRepository>(
      SERVICE_TYPES.InterestRepository,
    );
  }

  private getSuggestionRepository(): SuggestionRepository {
    return this.enhancedContainer.get<SuggestionRepository>(
      SERVICE_TYPES.SuggestionRepository,
    );
  }

  // ============================================================================
  // Service getters - 委托给 EnhancedContainer
  // ============================================================================

  /**
   * Get User Stage Service
   */
  getUserStageService(): UserStageService {
    return this.enhancedContainer.get<UserStageService>(
      SERVICE_TYPES.UserStageService,
    );
  }

  /**
   * Get V3 Matchers (Public for debugging)
   * @deprecated V3 已废弃移除 (Phase 1, 2026-01-24)
   */
  public getV3Matchers(): IMatcher[] {
    logger.warn(
      "getV3Matchers() is deprecated and V3 matchers have been removed. Returning empty array.",
    );
    return [];
  }

  /**
   * Get Classification Service
   * @deprecated V3 已废弃移除 (Phase 1, 2026-01-24)。使用 SimpleClassificationService 或 TieredClassificationService 替代。
   * @throws {Error} 调用此方法将抛出废弃错误
   * @see {@link SimpleClassificationService} 推荐替代方案
   */
  getClassificationService(): never {
    logger.error(
      "getClassificationService() is deprecated. V3 has been removed. Use V4.1 or V5.0 instead.",
    );
    throw new Error(
      "V3 ClassificationService has been removed. Set CLASSIFICATION_VERSION=v4.1 or v5.0",
    );
  }

  /**
   * Get Interest Service
   */
  getInterestService(): IInterestService {
    return this.enhancedContainer.get<IInterestService>(
      SERVICE_TYPES.InterestService,
    );
  }

  /**
   * Get Inbox Organizer Service
   */
  getInboxOrganizerService(): IInboxOrganizerService {
    return this.enhancedContainer.get<IInboxOrganizerService>(
      SERVICE_TYPES.InboxOrganizerService,
    );
  }

  /**
   * Get all services (convenience method)
   * @deprecated 由于 classification 已废弃，此方法将抛出错误
   */
  getAllServices(): {
    classification: IClassificationService;
    interest: IInterestService;
    inboxOrganizer: IInboxOrganizerService;
    userStage: UserStageService;
  } {
    return {
      classification: this.getClassificationService(),
      interest: this.getInterestService(),
      inboxOrganizer: this.getInboxOrganizerService(),
      userStage: this.getUserStageService(),
    };
  }
}

/**
 * Helper function to get initialized container
 * @throws Error if not initialized
 */
export function getClassificationContainer(): ClassificationContainer {
  return ClassificationContainer.getInstance();
}

/**
 * 获取增强容器
 * Phase 4: 推荐使用此函数
 *
 * @example
 * ```typescript
 * const container = getEnhancedContainer();
 * const pipeline = container.get<ClassificationPipelineService>(SERVICE_TYPES.PipelineService);
 * ```
 */
export function getEnhancedContainer(): EnhancedContainer {
  if (!isEnhancedInitialized()) {
    throw new Error(
      "Enhanced container not initialized. Call ClassificationContainer.initialize() first.",
    );
  }
  return getEnhanced();
}

// 导出增强容器相关
export {
  EnhancedContainer,
  SERVICE_TYPES,
  initializeContainer as initEnhancedContainer,
  resetContainer as resetEnhancedContainer,
  isContainerInitialized as isEnhancedContainerInitialized,
} from "./infrastructure/container";
