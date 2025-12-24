/**
 * Folder Heat Tracking Service
 * 文件夹热度追踪服务
 *
 * @description
 * 定期更新用户文件夹的热度分数，用于识别活跃/冷门文件夹：
 * - 基于最近7天书签添加数量
 * - 基于最后添加时间的时间衰减
 * - 支持手动/定时触发更新
 *
 * @module folder/organization/services
 * @version 1.1.0
 * @since 2025-12-16
 * @updated 2025-12-24 - Migrated to unified folder module
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

/** 热度追踪配置 */
export interface HeatTrackerConfig {
  /** 更新间隔（毫秒），默认 1 小时 */
  intervalMs: number;
  /** 是否启用自动更新 */
  autoUpdate: boolean;
}

/** 热度追踪状态 */
export interface HeatTrackerStatus {
  /** 是否正在运行 */
  isRunning: boolean;
  /** 上次更新时间 */
  lastUpdateAt: string | null;
  /** 上次更新的文件夹数量 */
  lastUpdateCount: number;
  /** 下次更新时间 */
  nextUpdateAt: string | null;
}

const DEFAULT_CONFIG: HeatTrackerConfig = {
  intervalMs: 60 * 60 * 1000, // 1 小时
  autoUpdate: true,
};

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * 文件夹热度追踪服务
 */
export class FolderHeatTrackerService {
  private config: HeatTrackerConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastUpdateAt: string | null = null;
  private lastUpdateCount: number = 0;
  private pendingUsers: Set<string> = new Set();

  constructor(config?: Partial<HeatTrackerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * 启动热度追踪
   */
  start(): void {
    if (this.intervalId) {
      logger.warn({}, "[HeatTracker] Already running, skipping start");
      return;
    }

    if (!this.config.autoUpdate) {
      logger.info(
        {},
        "[HeatTracker] Auto-update disabled, tracker not started",
      );
      return;
    }

    // 启动定时任务
    this.intervalId = setInterval(() => {
      this.processPendingUsers();
    }, this.config.intervalMs);

    logger.info(
      { intervalMs: this.config.intervalMs },
      "[HeatTracker] Started with interval",
    );
  }

  /**
   * 停止热度追踪
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.pendingUsers.clear();
      logger.info({}, "[HeatTracker] Stopped");
    }
  }

  /**
   * 检查是否正在运行
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * 获取追踪状态
   */
  getStatus(): HeatTrackerStatus {
    const nextUpdateAt =
      this.intervalId && this.lastUpdateAt
        ? new Date(
            new Date(this.lastUpdateAt).getTime() + this.config.intervalMs,
          ).toISOString()
        : null;

    return {
      isRunning: this.isRunning(),
      lastUpdateAt: this.lastUpdateAt,
      lastUpdateCount: this.lastUpdateCount,
      nextUpdateAt,
    };
  }

  /**
   * 将用户加入待更新队列
   * @param userId - 用户 ID
   */
  queueUserUpdate(userId: string): void {
    this.pendingUsers.add(userId);
    logger.debug({ userId }, "[HeatTracker] User queued for heat update");
  }

  /**
   * 立即更新指定用户的文件夹热度
   * @param supabase - Supabase 客户端
   * @param userId - 用户 ID
   */
  async updateUserHeat(
    supabase: SupabaseClient<Database>,
    userId: string,
  ): Promise<number> {
    try {
      // 调用数据库函数批量更新用户所有文件夹热度
      const { data, error } = await supabase.rpc("update_user_folder_heats", {
        p_user_id: userId,
      });

      if (error) {
        logger.error(
          { error: error.message, userId },
          "[HeatTracker] Failed to update user folder heats",
        );
        return 0;
      }

      const updatedCount = typeof data === "number" ? data : 0;

      this.lastUpdateAt = new Date().toISOString();
      this.lastUpdateCount = updatedCount;

      logger.info(
        { userId, updatedCount },
        "[HeatTracker] User folder heats updated",
      );

      return updatedCount;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[HeatTracker] Exception during heat update",
      );
      return 0;
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * 处理待更新用户队列
   * 注意：此方法在定时任务中调用，需要外部提供 Supabase 客户端
   */
  private async processPendingUsers(): Promise<void> {
    if (this.pendingUsers.size === 0) {
      return;
    }

    // 由于定时任务无法持有 Supabase 客户端，只记录日志
    // 实际更新需要在 API 请求上下文中调用 updateUserHeat
    logger.debug(
      { pendingCount: this.pendingUsers.size },
      "[HeatTracker] Pending users waiting for heat update",
    );
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let heatTrackerInstance: FolderHeatTrackerService | null = null;

/**
 * 初始化热度追踪服务
 */
export function initHeatTracker(
  config?: Partial<HeatTrackerConfig>,
): FolderHeatTrackerService {
  if (!heatTrackerInstance) {
    heatTrackerInstance = new FolderHeatTrackerService(config);
  }
  return heatTrackerInstance;
}

/**
 * 获取热度追踪服务实例
 */
export function getHeatTracker(): FolderHeatTrackerService | null {
  return heatTrackerInstance;
}

/**
 * 停止并销毁热度追踪服务
 */
export function stopHeatTracker(): void {
  if (heatTrackerInstance) {
    heatTrackerInstance.stop();
    heatTrackerInstance = null;
  }
}

/**
 * 获取待处理建议数量
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 */
export async function getPendingSuggestionsCount(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc(
      "get_pending_suggestions_count",
      {
        p_user_id: userId,
      },
    );

    if (error) {
      logger.warn(
        { error: error.message },
        "[HeatTracker] Failed to get pending suggestions count",
      );
      return 0;
    }

    return typeof data === "number" ? data : 0;
  } catch {
    return 0;
  }
}

export default FolderHeatTrackerService;
