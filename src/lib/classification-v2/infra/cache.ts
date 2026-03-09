/**
 * 分类结果缓存 — 内存 LRU
 *
 * 避免对同一书签短时间内重复分类。
 * 简单实现，不引入外部依赖。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { CLASSIFICATION_CONFIG } from "../config";
import type { ClassifyResult } from "../types";

interface CacheEntry {
  result: ClassifyResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const { ttlMs, maxEntries } = CLASSIFICATION_CONFIG.cache;

/**
 * 生成缓存 key
 */
function buildKey(userId: string, bookmarkId: string): string {
  return `${userId}:${bookmarkId}`;
}

/**
 * 从缓存获取
 */
export function getCached(
  userId: string,
  bookmarkId: string,
): ClassifyResult | null {
  const key = buildKey(userId, bookmarkId);
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.result;
}

/**
 * 写入缓存
 */
export function setCache(
  userId: string,
  bookmarkId: string,
  result: ClassifyResult,
): void {
  // LRU 驱逐
  if (cache.size >= maxEntries) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }

  cache.set(buildKey(userId, bookmarkId), {
    result,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * 清除特定条目
 */
export function invalidateCache(userId: string, bookmarkId: string): void {
  cache.delete(buildKey(userId, bookmarkId));
}

/**
 * 清除全部缓存
 */
export function clearCache(): void {
  cache.clear();
}
