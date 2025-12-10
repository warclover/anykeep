/**
 * Profile Event Handler Service
 * V4.2 事件驱动的画像更新处理器
 *
 * 职责：
 * 1. 订阅分类事件（classification:bookmark_classified）
 * 2. 转换事件格式，调用 IncrementalProfileService
 * 3. 发布画像更新完成事件（organization:profile_updated）
 *
 * @version 4.2
 * @description 实现分类模块与自组织模块的事件驱动解耦
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  eventBus,
  ClassificationEvents,
  OrganizationEvents,
  type BookmarkClassifiedEvent,
} from "@/lib/shared/event-bus";
import {
  IncrementalProfileService,
  type BookmarkChangeEvent,
} from "@/lib/classification/v3/services/incremental-profile.service";
import { logger } from "@/lib/logger";

/**
 * 事件处理器配置
 */
export interface ProfileEventHandlerConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 是否发布画像更新事件 */
  emitProfileUpdatedEvents: boolean;
}

const DEFAULT_CONFIG: ProfileEventHandlerConfig = {
  enabled: true,
  emitProfileUpdatedEvents: true,
};

/**
 * Profile Event Handler Service
 * 负责订阅分类事件并触发画像更新
 */
export class ProfileEventHandlerService {
  private config: ProfileEventHandlerConfig;
  private profileService: IncrementalProfileService;
  private unsubscribe: (() => void) | null = null;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<ProfileEventHandlerConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.profileService = new IncrementalProfileService(supabase);
  }

  /**
   * 启动事件订阅
   */
  start(): void {
    if (!this.config.enabled) {
      logger.debug(
        {},
        "ProfileEventHandlerService: Disabled, skipping subscription",
      );
      return;
    }

    if (this.unsubscribe) {
      logger.warn(
        {},
        "ProfileEventHandlerService: Already started, ignoring duplicate start",
      );
      return;
    }

    // 订阅书签分类完成事件
    this.unsubscribe = eventBus.on(
      ClassificationEvents.BOOKMARK_CLASSIFIED,
      (event) => this.handleBookmarkClassified(event),
    );

    logger.info(
      {},
      "ProfileEventHandlerService: Started, listening for classification events",
    );
  }

  /**
   * 停止事件订阅
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      logger.info({}, "ProfileEventHandlerService: Stopped");
    }
  }

  /**
   * 处理书签分类完成事件
   */
  private async handleBookmarkClassified(
    event: BookmarkClassifiedEvent,
  ): Promise<void> {
    try {
      // 只处理有目标文件夹的分类
      if (!event.folderId) {
        logger.debug(
          { bookmarkId: event.bookmarkId, action: event.action },
          "ProfileEventHandlerService: No folderId, skipping profile update",
        );
        return;
      }

      // 转换为 BookmarkChangeEvent
      const changeEvent: BookmarkChangeEvent = {
        type: event.action === "create_folder" ? "create" : "create",
        bookmarkId: event.bookmarkId,
        userId: event.userId,
        toFolderId: event.folderId,
      };

      // 触发增量画像更新
      await this.profileService.handleBookmarkChange(changeEvent);

      logger.debug(
        {
          bookmarkId: event.bookmarkId,
          folderId: event.folderId,
          action: event.action,
        },
        "ProfileEventHandlerService: Triggered profile update",
      );

      // 发布画像更新事件
      if (this.config.emitProfileUpdatedEvents) {
        this.emitProfileUpdatedEvent(event);
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          bookmarkId: event.bookmarkId,
          folderId: event.folderId,
        },
        "ProfileEventHandlerService: Failed to handle bookmark classified event",
      );
    }
  }

  /**
   * 发布画像更新事件
   */
  private emitProfileUpdatedEvent(event: BookmarkClassifiedEvent): void {
    if (!event.folderId || !event.folderName) return;

    eventBus.emit(OrganizationEvents.PROFILE_UPDATED, {
      userId: event.userId,
      folderId: event.folderId,
      folderName: event.folderName,
      bookmarkCount: 0, // 暂时无法获取准确值，由订阅者按需查询
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 强制刷新所有待处理的更新
   */
  async flushPendingUpdates(): Promise<void> {
    await this.profileService.flushAll();
  }
}

// ============================================================================
// 单例管理
// ============================================================================

let handlerInstance: ProfileEventHandlerService | null = null;

/**
 * 初始化并启动 Profile Event Handler
 */
export function initProfileEventHandler(
  supabase: SupabaseClient<Database>,
  config?: Partial<ProfileEventHandlerConfig>,
): ProfileEventHandlerService {
  if (handlerInstance) {
    logger.warn(
      {},
      "ProfileEventHandlerService: Already initialized, returning existing instance",
    );
    return handlerInstance;
  }

  handlerInstance = new ProfileEventHandlerService(supabase, config);
  handlerInstance.start();
  return handlerInstance;
}

/**
 * 获取当前实例
 */
export function getProfileEventHandler(): ProfileEventHandlerService | null {
  return handlerInstance;
}

/**
 * 停止并清理实例
 */
export function stopProfileEventHandler(): void {
  if (handlerInstance) {
    handlerInstance.stop();
    handlerInstance = null;
  }
}
