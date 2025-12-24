/**
 * 文件夹缓存失效管理
 *
 * 当文件夹发生变更时，需要同时清除：
 * 1. dataCache 中的文件夹数据缓存
 * 2. Keep-Alive 中的 /folders 页面缓存
 * 3. localStorage 中的文件夹数据缓存（V4.2.26 新增）
 *
 * V4.2.7: 修复生产构建问题
 * - 移除服务端分类缓存清除逻辑（避免客户端引入服务端代码）
 * - 服务端分类缓存由 folder-executor.service.ts 直接清除
 * - 此模块仅处理客户端可用的缓存（dataCache、Keep-Alive、localStorage）
 *
 * @version 1.4.0
 * @since 2025-12-15
 */

import { dataCache } from "./data-cache";
import { CACHE_KEYS } from "./cache-config";
import { clearFoldersCache } from "@/lib/folders/cache";
import { clientLogger } from "@/lib/client-logger";

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
 * V4.2.7: 仅处理客户端缓存
 * - dataCache: 文件夹数据缓存
 * - Keep-Alive: 页面缓存（通过监听器）
 *
 * V4.2.26: 新增 localStorage 缓存清除
 *
 * 注意：服务端分类缓存由 folder-executor.service.ts 直接调用
 * fastPathCacheManager.invalidateUser() 来清除
 */
export function invalidateFolderCache(userId?: string): void {
  // 1. 清除 dataCache 中的文件夹数据
  if (userId) {
    dataCache.invalidate(CACHE_KEYS.folders(userId));
  } else {
    // 清除所有用户的文件夹缓存
    dataCache.invalidate(/^folders:/);
  }

  // 2. V4.2.26: 清除 localStorage 缓存
  clearFoldersCache();

  // 3. 通知所有监听器（用于清除 Keep-Alive 缓存）
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      clientLogger.error({ error }, "[FolderCacheInvalidation] Listener error");
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
