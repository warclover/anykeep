/**
 * System Coordinator Service
 * V4.2 GAP-10 三系统事件深度协同
 *
 * 职责：
 * 1. 协调 AI摘要、智能分类、文件夹自组织 三系统之间的事件流
 * 2. 实现事件驱动的级联处理
 * 3. 提供系统健康状态监控
 *
 * 事件流：
 * summary:completed → classification:bookmark_classified → organization:profile_updated
 *                  ↘                                     ↘
 *           summary:tags_generated              organization:suggestion_generated
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
// 直接从子模块导入，避免循环依赖（Phase 4 修复）
import { eventBus } from "./event-bus";
import {
  ClassificationEvents,
  OrganizationEvents,
  SummaryEvents,
  type SummaryCompletedEvent,
  type BookmarkClassifiedEvent,
  type FolderProfileUpdatedEvent,
} from "./event-types";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 协调器配置
 */
export interface SystemCoordinatorConfig {
  /** 是否启用摘要→分类级联 */
  enableSummaryToClassification: boolean;
  /** 是否启用分类→画像级联 */
  enableClassificationToProfile: boolean;
  /** 是否启用画像→建议级联 */
  enableProfileToSuggestion: boolean;
  /** 级联处理延迟 (ms)，用于防抖 */
  cascadeDelayMs: number;
  /** 是否在完全托管模式下自动执行建议 */
  autoExecuteInFullTrust: boolean;
}

/**
 * 系统状态
 */
export interface SystemCoordinatorStatus {
  isActive: boolean;
  /** 各系统事件统计 */
  eventStats: {
    summaryCompleted: number;
    classificationCompleted: number;
    profileUpdated: number;
    suggestionsGenerated: number;
  };
  /** 级联触发统计 */
  cascadeStats: {
    summaryToClassification: number;
    classificationToProfile: number;
    profileToSuggestion: number;
  };
  /** 最后活动时间 */
  lastActivityTime: Date | null;
  /** 错误统计 */
  errorCount: number;
}

/**
 * 级联回调函数类型
 */
type CascadeCallback = (
  userId: string,
  bookmarkId?: number,
  folderId?: number,
) => Promise<void>;

const DEFAULT_CONFIG: SystemCoordinatorConfig = {
  enableSummaryToClassification: true,
  enableClassificationToProfile: true,
  enableProfileToSuggestion: true,
  cascadeDelayMs: 500,
  autoExecuteInFullTrust: false,
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 三系统协调器
 */
export class SystemCoordinatorService {
  private config: SystemCoordinatorConfig;
  private supabase: SupabaseClient<Database>;
  private unsubscribeFunctions: (() => void)[] = [];
  private isActive: boolean = false;

  /** 级联回调 */
  private cascadeCallbacks: {
    onSummaryCompleted?: CascadeCallback;
    onClassificationCompleted?: CascadeCallback;
    onProfileUpdated?: CascadeCallback;
  } = {};

  /** 状态统计 */
  private status: SystemCoordinatorStatus = {
    isActive: false,
    eventStats: {
      summaryCompleted: 0,
      classificationCompleted: 0,
      profileUpdated: 0,
      suggestionsGenerated: 0,
    },
    cascadeStats: {
      summaryToClassification: 0,
      classificationToProfile: 0,
      profileToSuggestion: 0,
    },
    lastActivityTime: null,
    errorCount: 0,
  };

  /** 防抖定时器 */
  private pendingCascades: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<SystemCoordinatorConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动协调器
   */
  start(): void {
    if (this.isActive) {
      logger.warn("SystemCoordinator already active");
      return;
    }

    // 订阅 AI 摘要完成事件
    this.unsubscribeFunctions.push(
      eventBus.on(SummaryEvents.COMPLETED as "summary:completed", (event) =>
        this.handleSummaryCompleted(event),
      ),
    );

    // 订阅分类完成事件
    this.unsubscribeFunctions.push(
      eventBus.on(
        ClassificationEvents.BOOKMARK_CLASSIFIED as "classification:bookmark_classified",
        (event) => this.handleClassificationCompleted(event),
      ),
    );

    // 订阅画像更新事件
    this.unsubscribeFunctions.push(
      eventBus.on(
        OrganizationEvents.PROFILE_UPDATED as "organization:profile_updated",
        (event) => this.handleProfileUpdated(event),
      ),
    );

    this.isActive = true;
    this.status.isActive = true;

    logger.info(
      { config: this.config },
      "SystemCoordinator: Started with three-system event coordination",
    );
  }

  /**
   * 停止协调器
   */
  stop(): void {
    for (const unsubscribe of this.unsubscribeFunctions) {
      unsubscribe();
    }
    this.unsubscribeFunctions = [];

    // 清理待处理的级联
    for (const timer of this.pendingCascades.values()) {
      clearTimeout(timer);
    }
    this.pendingCascades.clear();

    this.isActive = false;
    this.status.isActive = false;

    logger.info("SystemCoordinator: Stopped");
  }

  /**
   * 注册级联回调
   */
  registerCascadeCallbacks(callbacks: {
    onSummaryCompleted?: CascadeCallback;
    onClassificationCompleted?: CascadeCallback;
    onProfileUpdated?: CascadeCallback;
  }): void {
    this.cascadeCallbacks = { ...this.cascadeCallbacks, ...callbacks };
    logger.debug(
      { registeredCallbacks: Object.keys(callbacks) },
      "SystemCoordinator: Cascade callbacks registered",
    );
  }

  // ============================================================================
  // 事件处理
  // ============================================================================

  /**
   * 处理 AI 摘要完成事件
   * 触发：summary:completed → classification (if needed)
   */
  private async handleSummaryCompleted(
    event: SummaryCompletedEvent,
  ): Promise<void> {
    this.status.eventStats.summaryCompleted++;
    this.status.lastActivityTime = new Date();

    try {
      logger.debug(
        {
          userId: event.userId,
          bookmarkId: event.bookmarkId,
          needsClassification: event.needsClassification,
        },
        "SystemCoordinator: Summary completed event received",
      );

      // 如果需要分类且启用了级联
      if (
        event.needsClassification &&
        this.config.enableSummaryToClassification
      ) {
        await this.scheduleCascade(
          `summary-to-classification:${event.bookmarkId}`,
          async () => {
            if (this.cascadeCallbacks.onSummaryCompleted) {
              await this.cascadeCallbacks.onSummaryCompleted(
                event.userId,
                event.bookmarkId,
              );
            }
            this.status.cascadeStats.summaryToClassification++;
          },
        );
      }
    } catch (error) {
      this.status.errorCount++;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          event,
        },
        "SystemCoordinator: Failed to handle summary completed event",
      );
    }
  }

  /**
   * 处理分类完成事件
   * 触发：classification:bookmark_classified → profile update
   */
  private async handleClassificationCompleted(
    event: BookmarkClassifiedEvent,
  ): Promise<void> {
    this.status.eventStats.classificationCompleted++;
    this.status.lastActivityTime = new Date();

    try {
      logger.debug(
        {
          userId: event.userId,
          bookmarkId: event.bookmarkId,
          folderId: event.folderId,
          confidence: event.confidence,
        },
        "SystemCoordinator: Classification completed event received",
      );

      // 如果有目标文件夹且启用了级联
      if (event.folderId && this.config.enableClassificationToProfile) {
        await this.scheduleCascade(
          `classification-to-profile:${event.folderId}`,
          async () => {
            if (this.cascadeCallbacks.onClassificationCompleted) {
              await this.cascadeCallbacks.onClassificationCompleted(
                event.userId,
                event.bookmarkId,
                event.folderId ?? undefined,
              );
            }
            this.status.cascadeStats.classificationToProfile++;
          },
        );
      }
    } catch (error) {
      this.status.errorCount++;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          event,
        },
        "SystemCoordinator: Failed to handle classification completed event",
      );
    }
  }

  /**
   * 处理画像更新事件
   * 触发：profile_updated → suggestion generation (可选)
   */
  private async handleProfileUpdated(
    event: FolderProfileUpdatedEvent,
  ): Promise<void> {
    this.status.eventStats.profileUpdated++;
    this.status.lastActivityTime = new Date();

    try {
      logger.debug(
        {
          userId: event.userId,
          folderId: event.folderId,
          folderName: event.folderName,
          updateReason: event.updateReason,
        },
        "SystemCoordinator: Profile updated event received",
      );

      // 如果启用了画像→建议级联
      if (this.config.enableProfileToSuggestion) {
        // 使用用户级别的防抖，避免频繁触发建议生成
        await this.scheduleCascade(
          `profile-to-suggestion:${event.userId}`,
          async () => {
            if (this.cascadeCallbacks.onProfileUpdated) {
              await this.cascadeCallbacks.onProfileUpdated(
                event.userId,
                undefined,
                event.folderId,
              );
            }
            this.status.cascadeStats.profileToSuggestion++;
          },
          5000, // 5秒防抖，避免频繁触发
        );
      }
    } catch (error) {
      this.status.errorCount++;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          event,
        },
        "SystemCoordinator: Failed to handle profile updated event",
      );
    }
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 调度级联操作（带防抖）
   */
  private async scheduleCascade(
    key: string,
    callback: () => Promise<void>,
    delayMs?: number,
  ): Promise<void> {
    // 取消已有的同键定时器
    const existing = this.pendingCascades.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const delay = delayMs ?? this.config.cascadeDelayMs;

    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.pendingCascades.delete(key);
        try {
          await callback();
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              key,
            },
            "SystemCoordinator: Cascade callback failed",
          );
        }
        resolve();
      }, delay);

      this.pendingCascades.set(key, timer);
    });
  }

  /**
   * 获取状态
   */
  getStatus(): SystemCoordinatorStatus {
    return { ...this.status };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.status.eventStats = {
      summaryCompleted: 0,
      classificationCompleted: 0,
      profileUpdated: 0,
      suggestionsGenerated: 0,
    };
    this.status.cascadeStats = {
      summaryToClassification: 0,
      classificationToProfile: 0,
      profileToSuggestion: 0,
    };
    this.status.errorCount = 0;
  }

  /**
   * 获取配置
   */
  getConfig(): SystemCoordinatorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SystemCoordinatorConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, "SystemCoordinator: Config updated");
  }

  /**
   * 手动触发建议生成
   */
  async triggerSuggestionGeneration(userId: string): Promise<void> {
    if (this.cascadeCallbacks.onProfileUpdated) {
      await this.cascadeCallbacks.onProfileUpdated(userId);
      this.status.cascadeStats.profileToSuggestion++;
    }
  }
}

// ============================================================================
// 单例管理
// ============================================================================

let coordinatorInstance: SystemCoordinatorService | null = null;

/**
 * 初始化系统协调器
 */
export function initSystemCoordinator(
  supabase: SupabaseClient<Database>,
  config?: Partial<SystemCoordinatorConfig>,
): SystemCoordinatorService {
  if (coordinatorInstance) {
    logger.warn(
      "SystemCoordinator already initialized, returning existing instance",
    );
    return coordinatorInstance;
  }

  coordinatorInstance = new SystemCoordinatorService(supabase, config);
  coordinatorInstance.start();
  return coordinatorInstance;
}

/**
 * 获取当前协调器实例
 */
export function getSystemCoordinator(): SystemCoordinatorService | null {
  return coordinatorInstance;
}

/**
 * 停止并清理协调器
 */
export function stopSystemCoordinator(): void {
  if (coordinatorInstance) {
    coordinatorInstance.stop();
    coordinatorInstance = null;
  }
}

/**
 * 创建协调器实例（不自动启动）
 */
export function createSystemCoordinator(
  supabase: SupabaseClient<Database>,
  config?: Partial<SystemCoordinatorConfig>,
): SystemCoordinatorService {
  return new SystemCoordinatorService(supabase, config);
}
