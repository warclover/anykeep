/**
 * Folder Organization Module Initialization
 * 文件夹自组织模块初始化
 *
 * @version 4.2
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import {
  initProfileEventHandler,
  stopProfileEventHandler,
  getProfileEventHandler,
} from "@/lib/classification/services/profile-event-handler.service";
import type { FolderOrganizationStatus } from "./types/domain-types";

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

  // 2. 热度追踪（后续迭代实现）
  if (enableHeatTracking) {
    // TODO: 初始化热度追踪定时任务
    logger.debug(
      {},
      "FolderOrganization: Heat tracking enabled (pending implementation)",
    );
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

  isInitialized = false;
  logger.info({}, "FolderOrganization: Module stopped");
}

/**
 * 获取模块状态
 */
export function getFolderOrganizationStatus(): FolderOrganizationStatus {
  const handler = getProfileEventHandler();

  return {
    initialized: isInitialized,
    eventHandlerActive: handler !== null,
    heatTrackerActive: false, // TODO: 实现后更新
    lastEventTime,
    pendingSuggestions: 0, // TODO: 从数据库查询
  };
}

/**
 * 更新最后事件时间（供内部使用）
 */
export function updateLastEventTime(): void {
  lastEventTime = new Date().toISOString();
}
