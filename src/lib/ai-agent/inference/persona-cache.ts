/**
 * 画像推断结果缓存
 *
 * 使用 LRU 策略缓存用户画像推断结果
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { LRUCache } from "lru-cache";
import type { PersonaInferenceResult } from "./types";

// =============================================================================
// 缓存配置
// =============================================================================

/**
 * 缓存配置
 */
export interface PersonaCacheConfig {
  /** 最大缓存用户数 */
  maxSize: number;
  /** 默认 TTL（毫秒） */
  defaultTTL: number;
}

/**
 * 默认缓存配置
 */
const DEFAULT_CACHE_CONFIG: PersonaCacheConfig = {
  maxSize: 1000, // 最多缓存 1000 个用户
  defaultTTL: 60 * 60 * 1000, // 默认 1 小时过期
};

// =============================================================================
// 画像缓存类
// =============================================================================

/**
 * 画像推断结果缓存
 */
class PersonaCache {
  private cache: LRUCache<string, PersonaInferenceResult>;
  private config: PersonaCacheConfig;

  constructor(config: Partial<PersonaCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };

    this.cache = new LRUCache({
      max: this.config.maxSize,
      ttl: this.config.defaultTTL,
    });
  }

  /**
   * 获取缓存的推断结果
   */
  get(userId: string): PersonaInferenceResult | undefined {
    return this.cache.get(userId);
  }

  /**
   * 设置推断结果缓存
   * @param userId 用户 ID
   * @param result 推断结果
   * @param ttl 可选的自定义 TTL
   */
  set(userId: string, result: PersonaInferenceResult, ttl?: number): void {
    this.cache.set(userId, result, { ttl });
  }

  /**
   * 检查是否存在缓存
   */
  has(userId: string): boolean {
    return this.cache.has(userId);
  }

  /**
   * 删除用户缓存
   */
  delete(userId: string): boolean {
    return this.cache.delete(userId);
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    const _calculatedSize = this.cache.calculatedSize || 0;
    const hits = (this.cache as unknown as { hits?: number }).hits || 0;
    const misses = (this.cache as unknown as { misses?: number }).misses || 0;
    const total = hits + misses;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: total > 0 ? hits / total : 0,
    };
  }

  /**
   * 刷新缓存 TTL
   */
  touch(userId: string): void {
    const result = this.cache.get(userId);
    if (result) {
      // 重新设置以刷新 TTL
      this.cache.set(userId, result);
    }
  }

  /**
   * 批量删除缓存
   */
  deleteMany(userIds: string[]): number {
    let deleted = 0;
    for (const userId of userIds) {
      if (this.cache.delete(userId)) {
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * 获取所有缓存的用户 ID
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

/**
 * 单例实例
 */
export const personaCache = new PersonaCache();

/**
 * 创建新的缓存实例（用于测试）
 */
export function createPersonaCache(
  config?: Partial<PersonaCacheConfig>,
): PersonaCache {
  return new PersonaCache(config);
}
