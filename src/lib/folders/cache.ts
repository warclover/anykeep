/**
 * 文件夹列表缓存工具
 * @description 提供 localStorage 缓存支持，实现立即显示 + 后台刷新
 * @version 1.0.0 - V4.2.26 收藏夹性能优化
 */

import type { FolderWithStats } from "@/components/folders/types";

// ============================================
// 配置常量
// ============================================

/** localStorage 缓存键 */
export const FOLDERS_CACHE_KEY = "anykeep_folders_cache";

/** 缓存新鲜期（60秒内认为数据新鲜，不触发后台刷新） */
export const CACHE_STALE_TIME = 60 * 1000;

/** 缓存最大有效期（24小时后强制刷新） */
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// ============================================
// 类型定义
// ============================================

interface CacheData {
  /** 缓存的文件夹数据 */
  data: FolderWithStats[];
  /** 缓存时间戳 */
  timestamp: number;
  /** 用户 ID（防止多用户混淆） */
  userId?: string;
}

// ============================================
// 缓存操作函数
// ============================================

/**
 * 从 localStorage 读取缓存
 * @param userId 当前用户 ID（可选，用于验证缓存归属）
 * @returns 缓存数据，如果无效则返回 null
 */
export function getFoldersCache(userId?: string): FolderWithStats[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(FOLDERS_CACHE_KEY);
    if (!raw) return null;

    const cache: CacheData = JSON.parse(raw);

    // 验证缓存归属
    if (userId && cache.userId && cache.userId !== userId) {
      // 用户不匹配，清除缓存
      localStorage.removeItem(FOLDERS_CACHE_KEY);
      return null;
    }

    // 检查缓存是否过期（超过最大有效期）
    if (Date.now() - cache.timestamp > CACHE_MAX_AGE) {
      localStorage.removeItem(FOLDERS_CACHE_KEY);
      return null;
    }

    return cache.data;
  } catch {
    // 解析失败，清除无效缓存
    localStorage.removeItem(FOLDERS_CACHE_KEY);
    return null;
  }
}

/**
 * 将文件夹数据写入缓存
 * @param data 文件夹数据
 * @param userId 当前用户 ID（可选）
 */
export function setFoldersCache(
  data: FolderWithStats[],
  userId?: string,
): void {
  if (typeof window === "undefined") return;

  try {
    const cache: CacheData = {
      data,
      timestamp: Date.now(),
      userId,
    };
    localStorage.setItem(FOLDERS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 存储失败（可能是配额问题），静默处理
  }
}

/**
 * 检查缓存是否新鲜（在 STALE_TIME 内）
 * @returns true 表示缓存新鲜，不需要后台刷新
 */
export function isFoldersCacheFresh(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const raw = localStorage.getItem(FOLDERS_CACHE_KEY);
    if (!raw) return false;

    const cache: CacheData = JSON.parse(raw);
    return Date.now() - cache.timestamp < CACHE_STALE_TIME;
  } catch {
    return false;
  }
}

/**
 * 获取缓存时间戳
 * @returns 缓存时间戳，如果没有缓存则返回 0
 */
export function getFoldersCacheTimestamp(): number {
  if (typeof window === "undefined") return 0;

  try {
    const raw = localStorage.getItem(FOLDERS_CACHE_KEY);
    if (!raw) return 0;

    const cache: CacheData = JSON.parse(raw);
    return cache.timestamp;
  } catch {
    return 0;
  }
}

/**
 * 清除文件夹缓存
 * @description 在文件夹操作后调用，保证数据一致性
 */
export function clearFoldersCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FOLDERS_CACHE_KEY);
}
