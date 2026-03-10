/**
 * 纠错缓存 — v2 内化版
 *
 * 从旧系统 classification/services/advanced/correction-cache.service.ts 精简迁入。
 * 用户反馈后更新 URL → FolderId 映射，下次分类时优先命中缓存。
 *
 * 特性：
 * - 精确 URL 缓存 + 域名级相似匹配
 * - 7 天 TTL + LRU 淘汰（maxEntries=10000）
 * - 纯内存实现，< 10ms 响应
 *
 * @version 2.0.0
 * @since 2026-03-10
 */

import { logger } from "@/lib/logger";
import { extractDomain } from "./utils";

// ============================================================================
// 类型定义
// ============================================================================

interface CacheEntry {
  folderId: number;
  folderName: string;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  source: "user_move" | "user_select" | "system_learn";
}

export interface CorrectionCacheConfig {
  /** 缓存过期时间 (ms)，默认 7 天 */
  expirationMs: number;
  /** 最大缓存条目数 */
  maxEntries: number;
  /** 是否启用相似 URL 匹配 */
  enableSimilarUrlMatching: boolean;
}

const DEFAULT_CONFIG: CorrectionCacheConfig = {
  expirationMs: 7 * 24 * 60 * 60 * 1000,
  maxEntries: 10000,
  enableSimilarUrlMatching: true,
};

// ============================================================================
// URL 标准化
// ============================================================================

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

// ============================================================================
// 缓存服务
// ============================================================================

export class CorrectionCacheService {
  private config: CorrectionCacheConfig;
  private urlCache = new Map<string, CacheEntry>();
  private domainCache = new Map<string, Map<string, CacheEntry>>();

  constructor(config?: Partial<CorrectionCacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 写入纠错缓存
   */
  set(
    userId: string,
    url: string,
    folderId: number,
    folderName: string,
    source: CacheEntry["source"] = "user_move",
  ): void {
    const key = `${userId}:${normalizeUrl(url)}`;
    const now = Date.now();

    const entry: CacheEntry = {
      folderId,
      folderName,
      createdAt: now,
      expiresAt: now + this.config.expirationMs,
      hitCount: 0,
      source,
    };

    this.urlCache.set(key, entry);

    if (this.config.enableSimilarUrlMatching) {
      const domainKey = `${userId}:domain:${extractDomain(url)}`;
      const entries = this.domainCache.get(domainKey) ?? new Map();
      entries.set(normalizeUrl(url), entry);
      this.domainCache.set(domainKey, entries);
    }

    // LRU 淘汰
    if (this.urlCache.size > this.config.maxEntries) {
      this.evictOldest();
    }

    logger.debug(
      { userId, folderId, source },
      "CorrectionCache(v2): Entry written",
    );
  }

  /**
   * 查询纠错缓存
   */
  get(
    userId: string,
    url: string,
  ): { folderId: number; folderName: string; confidence: number } | null {
    const key = `${userId}:${normalizeUrl(url)}`;
    const now = Date.now();

    // 精确匹配
    const exact = this.urlCache.get(key);
    if (exact && exact.expiresAt > now) {
      exact.hitCount++;
      return {
        folderId: exact.folderId,
        folderName: exact.folderName,
        confidence: 1.0, // 归一化 0-1 范围
      };
    }

    // 相似 URL 匹配
    if (this.config.enableSimilarUrlMatching) {
      return this.findSimilar(userId, url, now);
    }

    return null;
  }

  /**
   * 删除缓存条目
   */
  delete(userId: string, url: string): boolean {
    const key = `${userId}:${normalizeUrl(url)}`;
    const deleted = this.urlCache.delete(key);

    if (this.config.enableSimilarUrlMatching) {
      const domainKey = `${userId}:domain:${extractDomain(url)}`;
      this.domainCache.get(domainKey)?.delete(normalizeUrl(url));
    }

    return deleted;
  }

  /**
   * 清理过期条目
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.urlCache) {
      if (entry.expiresAt <= now) this.urlCache.delete(key);
    }
    for (const [dk, entries] of this.domainCache) {
      for (const [url, entry] of entries) {
        if (entry.expiresAt <= now) entries.delete(url);
      }
      if (entries.size === 0) this.domainCache.delete(dk);
    }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.urlCache.clear();
    this.domainCache.clear();
  }

  // ---- 私有方法 ----

  private findSimilar(
    userId: string,
    url: string,
    now: number,
  ): { folderId: number; folderName: string; confidence: number } | null {
    const domainKey = `${userId}:domain:${extractDomain(url)}`;
    const entries = this.domainCache.get(domainKey);
    if (!entries || entries.size === 0) return null;

    const folderCounts = new Map<number, { count: number; name: string }>();
    let total = 0;

    for (const entry of entries.values()) {
      if (entry.expiresAt <= now) continue;
      total++;
      const existing = folderCounts.get(entry.folderId);
      if (existing) {
        existing.count++;
      } else {
        folderCounts.set(entry.folderId, {
          count: 1,
          name: entry.folderName,
        });
      }
    }

    if (total === 0) return null;

    let topId = 0;
    let topName = "";
    let topCount = 0;

    for (const [id, { count, name }] of folderCounts) {
      if (count > topCount) {
        topCount = count;
        topId = id;
        topName = name;
      }
    }

    // 归一化 0-1 范围，上限 0.95（相似匹配不给满分）
    const confidence = Math.min(0.95, topCount / total);
    return confidence >= 0.6
      ? { folderId: topId, folderName: topName, confidence }
      : null;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.urlCache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    if (oldestKey) this.urlCache.delete(oldestKey);
  }
}

// ============================================================================
// 全局单例
// ============================================================================

let _instance: CorrectionCacheService | null = null;

/**
 * 获取全局 CorrectionCache 实例
 */
export function getCorrectionCache(
  config?: Partial<CorrectionCacheConfig>,
): CorrectionCacheService {
  if (!_instance) {
    _instance = new CorrectionCacheService(config);
  }
  return _instance;
}
