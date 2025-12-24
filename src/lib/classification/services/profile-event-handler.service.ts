/**
 * Profile Event Handler Service
 * V4.2 事件驱动的画像更新处理器
 *
 * 职责：
 * 1. 订阅分类事件（classification:bookmark_classified）
 * 2. 转换事件格式，调用 IncrementalProfileService
 * 3. 触发核心/边缘区画像计算（节流处理）
 * 4. 发布画像更新完成事件（organization:profile_updated）
 *
 * @version 4.2.1
 * @description 实现分类模块与自组织模块的事件驱动解耦，增加核心/边缘区画像支持
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
} from "@/lib/classification/services/advanced";
import type { CoreEdgeProfileService } from "@/lib/classification/profile";
import { createCoreEdgeProfileService } from "@/lib/classification/profile";
import { logger } from "@/lib/logger";

/**
 * 事件处理器配置
 */
export interface ProfileEventHandlerConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 是否发布画像更新事件 */
  emitProfileUpdatedEvents: boolean;
  /** 是否启用核心/边缘区计算 */
  enableZoneComputation: boolean;
  /** 核心/边缘区计算节流时间（毫秒） */
  zoneComputeThrottleMs: number;
  /** 触发核心/边缘区计算的最小书签数 */
  minBookmarksForZone: number;
}

const DEFAULT_CONFIG: ProfileEventHandlerConfig = {
  enabled: true,
  emitProfileUpdatedEvents: true,
  enableZoneComputation: true,
  zoneComputeThrottleMs: 30000, // 30秒节流
  minBookmarksForZone: 3,
};

/**
 * Profile Event Handler Service
 * 负责订阅分类事件并触发画像更新
 */
export class ProfileEventHandlerService {
  private config: ProfileEventHandlerConfig;
  private supabase: SupabaseClient<Database>;
  private profileService: IncrementalProfileService;
  private coreEdgeService: CoreEdgeProfileService;
  private unsubscribe: (() => void) | null = null;

  /** 核心/边缘区计算节流记录 */
  private zoneComputeTimers: Map<number, NodeJS.Timeout> = new Map();
  /** 待计算的文件夹队列 */
  private pendingZoneComputes: Map<number, { userId: string; count: number }> =
    new Map();

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<ProfileEventHandlerConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.profileService = new IncrementalProfileService(supabase);
    this.coreEdgeService = createCoreEdgeProfileService(supabase);
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
    }

    // 清理所有待执行的 zone 计算定时器
    for (const timer of this.zoneComputeTimers.values()) {
      clearTimeout(timer);
    }
    this.zoneComputeTimers.clear();
    this.pendingZoneComputes.clear();

    logger.info({}, "ProfileEventHandlerService: Stopped");
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

      // V4.2.4: 修复事件类型转换 bug
      // 原代码两个分支都返回 "create"，无法区分不同操作类型
      // 正确映射：
      // - create_folder: 创建新文件夹并分类 → create
      // - classify: 分类到现有文件夹 → move
      // - inbox: 放入待整理 → create
      const eventType: "create" | "move" | "delete" | "update_tags" =
        event.action === "create_folder"
          ? "create"
          : event.action === "classify"
            ? "move"
            : "create"; // inbox

      const changeEvent: BookmarkChangeEvent = {
        type: eventType,
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

      // 调度核心/边缘区计算（节流处理）
      if (this.config.enableZoneComputation) {
        this.scheduleZoneComputation(event.userId, event.folderId);
      }

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
   * 调度核心/边缘区计算（节流处理）
   * 同一文件夹在短时间内多次分类只触发一次计算
   */
  private scheduleZoneComputation(userId: string, folderId: number): void {
    // 累积计数
    const pending = this.pendingZoneComputes.get(folderId);
    if (pending) {
      pending.count++;
    } else {
      this.pendingZoneComputes.set(folderId, { userId, count: 1 });
    }

    // 如果已有定时器，跳过
    if (this.zoneComputeTimers.has(folderId)) {
      logger.debug(
        { folderId },
        "ProfileEventHandlerService: Zone computation already scheduled",
      );
      return;
    }

    // 设置节流定时器
    const timer = setTimeout(async () => {
      this.zoneComputeTimers.delete(folderId);
      const pendingInfo = this.pendingZoneComputes.get(folderId);
      this.pendingZoneComputes.delete(folderId);

      if (!pendingInfo) return;

      try {
        // 执行核心/边缘区计算
        const profile = await this.coreEdgeService.computeZoneProfile(
          pendingInfo.userId,
          folderId,
        );

        if (profile) {
          logger.info(
            {
              folderId,
              coreCount: profile.coreCount,
              edgeCount: profile.edgeCount,
              pendingCount: pendingInfo.count,
            },
            "ProfileEventHandlerService: Zone profile computed",
          );
        }
      } catch (error) {
        logger.error(
          {
            folderId,
            error: error instanceof Error ? error.message : String(error),
          },
          "ProfileEventHandlerService: Failed to compute zone profile",
        );
      }
    }, this.config.zoneComputeThrottleMs);

    this.zoneComputeTimers.set(folderId, timer);

    logger.debug(
      { folderId, throttleMs: this.config.zoneComputeThrottleMs },
      "ProfileEventHandlerService: Scheduled zone computation",
    );
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

    // 立即执行所有待处理的 zone 计算
    await this.flushPendingZoneComputes();
  }

  /**
   * 强制执行所有待处理的核心/边缘区计算
   */
  async flushPendingZoneComputes(): Promise<void> {
    // 取消所有定时器
    for (const timer of this.zoneComputeTimers.values()) {
      clearTimeout(timer);
    }
    this.zoneComputeTimers.clear();

    // 立即执行所有待处理的计算
    const computePromises: Promise<void>[] = [];

    for (const [folderId, info] of this.pendingZoneComputes) {
      computePromises.push(
        this.coreEdgeService
          .computeZoneProfile(info.userId, folderId)
          .then((profile) => {
            if (profile) {
              logger.info(
                {
                  folderId,
                  coreCount: profile.coreCount,
                  edgeCount: profile.edgeCount,
                },
                "ProfileEventHandlerService: Zone profile flushed",
              );
            }
          })
          .catch((error) => {
            logger.error(
              {
                folderId,
                error: error instanceof Error ? error.message : String(error),
              },
              "ProfileEventHandlerService: Failed to flush zone profile",
            );
          }),
      );
    }

    this.pendingZoneComputes.clear();
    await Promise.all(computePromises);
  }

  /**
   * 手动触发单个文件夹的核心/边缘区计算
   */
  async computeZoneProfile(userId: string, folderId: number): Promise<void> {
    const profile = await this.coreEdgeService.computeZoneProfile(
      userId,
      folderId,
    );

    if (profile) {
      logger.info(
        {
          folderId,
          coreCount: profile.coreCount,
          edgeCount: profile.edgeCount,
          coreTightness: profile.coreTightness.toFixed(2),
          boundaryClarity: profile.boundaryClarity.toFixed(2),
        },
        "ProfileEventHandlerService: Manual zone profile computation completed",
      );
    }
  }

  /**
   * 获取核心/边缘区服务实例
   */
  getCoreEdgeService(): CoreEdgeProfileService {
    return this.coreEdgeService;
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
