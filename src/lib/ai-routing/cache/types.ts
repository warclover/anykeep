/**
 * Cache 模块类型导出
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { ClassifierResult } from "../types";

/**
 * 缓存条目
 */
export interface CacheEntry<T> {
  /** 缓存值 */
  value: T;
  /** 创建时间戳 */
  createdAt: number;
  /** 过期时间戳 */
  expiresAt: number;
  /** 访问次数 */
  accessCount: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  /** 缓存大小 */
  size: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 过期条目数 */
  expiredCount: number;
}

/**
 * 意图缓存值类型
 */
export type IntentCacheValue = ClassifierResult;
