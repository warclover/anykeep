/**
 * Folder Organization Module Initialization
 * 文件夹自组织模块初始化
 *
 * @module folder/organization
 * @version 4.2.1
 * @updated 2025-12-24 - Migrated to unified folder module
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import {
  initProfileEventHandler,
  stopProfileEventHandler,
  getProfileEventHandler,
} from "@/lib/classification/services/profile-event-handler.service";
import {
  initHeatTracker,
  stopHeatTracker,
  getHeatTracker,
  getPendingSuggestionsCount,
} from "./services/heat-tracker.service";
import type { FolderOrganizationStatus } from "./types";

// ============================================================================
// Module State
// ============================================================================

let isInitialized = false;
let lastEventTime: string | null = null;

// ============================================================================
// Initialization
// ============================================================================

/**
 * 初始化文件夹自组织模块
 *
 * @param supabase - Supabase 客户端实例
 * @param options - 初始化选项
 */
export function initFolderOrganization(
  supabase: SupabaseClient<Database>,
  options?: {
    /** 是否启用事件处理器 */
    enableEventHandler?: boolean;
    /** 是否启用热度追踪 */
    enableHeatTracking?: boolean;
  },
): void {
  if (isInitialized) {
    logger.warn({}, "FolderOrganization: Already initialized, skipping");
    return;
  }

  const { enableEventHandler = true, enableHeatTracking = true } =
    options || {};

  logger.info(
    { enableEventHandler, enableHeatTracking },
    "FolderOrganization: Initializing module",
  );

  // 1. 初始化画像事件处理器（订阅分类事件）
  if (enableEventHandler) {
    initProfileEventHandler(supabase, {
      enabled: true,
      emitProfileUpdatedEvents: true,
    });
    logger.debug({}, "FolderOrganization: Profile event handler started");
  }

  // 2. 热度追踪
  if (enableHeatTracking) {
    const heatTracker = initHeatTracker({
      intervalMs: 60 * 60 * 1000, // 1 小时
      autoUpdate: true,
    });
    heatTracker.start();
    logger.debug({}, "FolderOrganization: Heat tracker started");
  }

  isInitialized = true;
  lastEventTime = new Date().toISOString();

  logger.info({}, "FolderOrganization: Module initialized successfully");
}

/**
 * 停止文件夹自组织模块
 */
export function stopFolderOrganization(): void {
  if (!isInitialized) {
    return;
  }

  // 停止事件处理器
  stopProfileEventHandler();

  // 停止热度追踪
  stopHeatTracker();

  isInitialized = false;
  logger.info({}, "FolderOrganization: Module stopped");
}

/**
 * 获取模块状态（同步版本）
 * @returns 模块状态（不含待处理建议数，需调用异步版本获取）
 */
export function getFolderOrganizationStatus(): FolderOrganizationStatus {
  const handler = getProfileEventHandler();
  const heatTracker = getHeatTracker();

  return {
    initialized: isInitialized,
    eventHandlerActive: handler !== null,
    heatTrackerActive: heatTracker?.isRunning() ?? false,
    lastEventTime,
    pendingSuggestions: 0, // 使用 getFullFolderOrganizationStatus 获取实际值
  };
}

/**
 * 获取完整模块状态（异步版本，包含数据库查询）
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 */
export async function getFullFolderOrganizationStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<FolderOrganizationStatus> {
  const baseStatus = getFolderOrganizationStatus();

  // 查询待处理建议数量
  const pendingSuggestions = await getPendingSuggestionsCount(supabase, userId);

  return {
    ...baseStatus,
    pendingSuggestions,
  };
}

/**
 * 更新最后事件时间（供内部使用）
 */
export function updateLastEventTime(): void {
  lastEventTime = new Date().toISOString();
}
