/**
 * 文件夹缓存失效管理
 *
 * 当文件夹发生变更时，需要同时清除：
 * 1. dataCache 中的文件夹数据缓存
 * 2. Keep-Alive 中的 /folders 页面缓存
 * 3. V4.2.5: 分类系统相关缓存（快速路径、纠错缓存等）
 *
 * @version 1.1.0
 * @since 2025-12-15
 */

import { dataCache } from "./data-cache";
import { CACHE_KEYS } from "./cache-config";
import { fastPathCacheManager } from "@/lib/classification/router/cache-manager";
import { logger } from "@/lib/logger";

// 缓存失效事件类型
type CacheInvalidationListener = () => void;

// 事件监听器列表
const listeners: Set<CacheInvalidationListener> = new Set();

/**
 * 订阅文件夹缓存失效事件
 * 用于 Keep-Alive 组件监听并清除页面缓存
 */
export function subscribeFolderCacheInvalidation(
  listener: CacheInvalidationListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 触发文件夹缓存失效
 * 清除所有文件夹相关缓存
 *
 * V4.2.5: 增强版 - 同时清除分类系统缓存
 */
export function invalidateFolderCache(userId?: string): void {
  // 1. 清除 dataCache 中的文件夹数据
  if (userId) {
    dataCache.invalidate(CACHE_KEYS.folders(userId));
  } else {
    // 清除所有用户的文件夹缓存
    dataCache.invalidate(/^folders:/);
  }

  // 2. V4.2.5: 清除分类系统缓存（快速路径缓存）
  // 这确保文件夹变更后，分类系统使用最新的文件夹信息
  try {
    if (userId) {
      fastPathCacheManager.invalidateUser(userId);
      logger.debug(
        { userId },
        "[FolderCacheInvalidation] Classification cache invalidated for user",
      );
    } else {
      fastPathCacheManager.clearAllCache();
      logger.debug(
        "[FolderCacheInvalidation] All classification caches cleared",
      );
    }
  } catch (error) {
    // 分类缓存清除失败不应影响主流程
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "[FolderCacheInvalidation] Failed to invalidate classification cache",
    );
  }

  // 3. 通知所有监听器（用于清除 Keep-Alive 缓存）
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("[FolderCacheInvalidation] Listener error:", error);
    }
  });
}

/**
 * 文件夹操作后的缓存失效
 * 提供语义化的 API
 */
export const folderCacheInvalidation = {
  /** 创建文件夹后 */
  onFolderCreate: (userId: string) => invalidateFolderCache(userId),

  /** 删除文件夹后 */
  onFolderDelete: (userId: string) => invalidateFolderCache(userId),

  /** 重命名文件夹后 */
  onFolderRename: (userId: string) => invalidateFolderCache(userId),

  /** 合并文件夹后 */
  onFolderMerge: (userId: string) => invalidateFolderCache(userId),

  /** 文件夹分组变更后 */
  onFolderGroupChange: (userId: string) => invalidateFolderCache(userId),

  /** 任意文件夹变更 */
  onAnyChange: (userId?: string) => invalidateFolderCache(userId),
};
