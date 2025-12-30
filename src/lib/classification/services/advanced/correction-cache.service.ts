/**
 * V4.0 实时纠错缓存服务
 *
 * 功能：
 * - 用户移动书签后，将 URL → FolderID 映射写入缓存
 * - 再次遇到相同 URL 时，优先命中缓存，跳过 AI
 * - 支持相似 URL 匹配（同域名路径）
 * - 缓存过期策略（7 天 or 用户再次移动）
 *
 * 设计原则：
 * - 用户行为优先于 AI 判断
 * - 快速响应（< 10ms）
 * - 内存友好（LRU 淘汰策略）
 */

import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 缓存条目
 */
interface CacheEntry {
  /** 目标文件夹 ID */
  folderId: number;
  /** 目标文件夹名称 */
  folderName: string;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 */
  expiresAt: number;
  /** 命中次数 */
  hitCount: number;
  /** 来源：用户移动 / 用户选择 / 系统学习 */
  source: "user_move" | "user_select" | "system_learn";
}

/**
 * 缓存键类型
 */
type CacheKey = string; // 格式: userId:normalizedUrl

/**
 * 缓存配置
 */
export interface CorrectionCacheConfig {
  /** 缓存过期时间 (ms)，默认 7 天 */
  expirationMs: number;
  /** 最大缓存条目数，默认 10000 */
  maxEntries: number;
  /** 是否启用相似 URL 匹配 */
  enableSimilarUrlMatching: boolean;
  /** 清理间隔 (ms)，默认 1 小时 */
  cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: CorrectionCacheConfig = {
  expirationMs: 7 * 24 * 60 * 60 * 1000, // 7 天
  maxEntries: 10000,
  enableSimilarUrlMatching: true,
  cleanupIntervalMs: 60 * 60 * 1000, // 1 小时
};

// ============================================================================
// URL 标准化
// ============================================================================

/**
 * 标准化 URL（去除协议、www、尾部斜杠、查询参数）
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // 去除 www
    const host = parsed.hostname.replace(/^www\./, "");
    // 去除尾部斜杠
    const path = parsed.pathname.replace(/\/$/, "");
    // 返回标准化的 URL
    return `${host}${path}`.toLowerCase();
  } catch {
    // URL 解析失败，返回原始值的小写版本
    return url.toLowerCase().trim();
  }
}

/**
 * 提取 URL 的域名（用于相似匹配）
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * 生成缓存键
 */
function generateCacheKey(userId: string, url: string): CacheKey {
  return `${userId}:${normalizeUrl(url)}`;
}

/**
 * 生成域名级缓存键（用于相似匹配）
 */
function generateDomainKey(userId: string, url: string): CacheKey {
  return `${userId}:domain:${extractDomain(url)}`;
}

// ============================================================================
// 缓存服务实现
// ============================================================================

/**
 * 实时纠错缓存服务
 */
export class CorrectionCacheService {
  private config: CorrectionCacheConfig;

  // 精确 URL 缓存
  private urlCache: Map<CacheKey, CacheEntry> = new Map();

  // 域名级缓存（用于相似 URL 匹配）
  private domainCache: Map<CacheKey, Map<string, CacheEntry>> = new Map();

  // 清理定时器
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // 统计指标
  private stats = {
    hits: 0,
    misses: 0,
    writes: 0,
    evictions: 0,
  };

  constructor(config?: Partial<CorrectionCacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * 启动定期清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * 停止服务（用于测试和优雅关闭）
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 写入纠错缓存
   *
   * @param userId 用户 ID
   * @param url 书签 URL
   * @param folderId 目标文件夹 ID
   * @param folderName 目标文件夹名称
   * @param source 来源
   */
  set(
    userId: string,
    url: string,
    folderId: number,
    folderName: string,
    source: CacheEntry["source"] = "user_move",
  ): void {
    const key = generateCacheKey(userId, url);
    const now = Date.now();

    const entry: CacheEntry = {
      folderId,
      folderName,
      createdAt: now,
      expiresAt: now + this.config.expirationMs,
      hitCount: 0,
      source,
    };

    // 写入精确缓存
    this.urlCache.set(key, entry);

    // 写入域名级缓存（用于相似匹配）
    if (this.config.enableSimilarUrlMatching) {
      const domainKey = generateDomainKey(userId, url);
      const domainEntries = this.domainCache.get(domainKey);
      if (domainEntries) {
        domainEntries.set(normalizeUrl(url), entry);
      } else {
        this.domainCache.set(domainKey, new Map([[normalizeUrl(url), entry]]));
      }
    }

    this.stats.writes++;

    // LRU 淘汰
    if (this.urlCache.size > this.config.maxEntries) {
      this.evictOldest();
    }

    logger.debug(
      {
        userId,
        url: normalizeUrl(url),
        folderId,
        folderName,
        source,
      },
      "CorrectionCache: Entry written",
    );
  }

  /**
   * 查询纠错缓存
   *
   * @param userId 用户 ID
   * @param url 书签 URL
   * @returns 缓存条目或 null
   */
  get(
    userId: string,
    url: string,
  ): { folderId: number; folderName: string; confidence: number } | null {
    const key = generateCacheKey(userId, url);
    const now = Date.now();

    // 1. 精确匹配
    const exactEntry = this.urlCache.get(key);
    if (exactEntry && exactEntry.expiresAt > now) {
      exactEntry.hitCount++;
      this.stats.hits++;

      logger.debug(
        {
          userId,
          url: normalizeUrl(url),
          folderId: exactEntry.folderId,
          matchType: "exact",
        },
        "CorrectionCache: Exact hit",
      );

      return {
        folderId: exactEntry.folderId,
        folderName: exactEntry.folderName,
        confidence: 100, // 精确匹配置信度 100%
      };
    }

    // 2. 相似 URL 匹配（同域名下的其他 URL）
    if (this.config.enableSimilarUrlMatching) {
      const similarResult = this.findSimilarUrlMatch(userId, url, now);
      if (similarResult) {
        this.stats.hits++;
        return similarResult;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 查找相似 URL 匹配
   */
  private findSimilarUrlMatch(
    userId: string,
    url: string,
    now: number,
  ): { folderId: number; folderName: string; confidence: number } | null {
    const domainKey = generateDomainKey(userId, url);
    const domainEntries = this.domainCache.get(domainKey);

    if (!domainEntries || domainEntries.size === 0) {
      return null;
    }

    // 统计同域名下各文件夹的出现次数
    const folderCounts = new Map<number, { count: number; name: string }>();

    for (const [, entry] of domainEntries) {
      if (entry.expiresAt <= now) continue;

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

    if (folderCounts.size === 0) {
      return null;
    }

    // 找出出现次数最多的文件夹
    let topFolderId = 0;
    let topFolderName = "";
    let topCount = 0;
    let totalCount = 0;

    for (const [folderId, { count, name }] of folderCounts) {
      totalCount += count;
      if (count > topCount) {
        topCount = count;
        topFolderId = folderId;
        topFolderName = name;
      }
    }

    // 计算置信度（基于占比）
    const confidence = Math.min(
      95, // 相似匹配最高 95%
      Math.round((topCount / totalCount) * 100),
    );

    // 仅当置信度 >= 60% 时返回
    if (confidence >= 60) {
      logger.debug(
        {
          userId,
          url: normalizeUrl(url),
          folderId: topFolderId,
          matchType: "similar",
          confidence,
        },
        "CorrectionCache: Similar URL hit",
      );

      return {
        folderId: topFolderId,
        folderName: topFolderName,
        confidence,
      };
    }

    return null;
  }

  /**
   * 删除指定 URL 的缓存（用户再次移动时）
   */
  delete(userId: string, url: string): boolean {
    const key = generateCacheKey(userId, url);
    const deleted = this.urlCache.delete(key);

    // 也从域名缓存中删除
    if (this.config.enableSimilarUrlMatching) {
      const domainKey = generateDomainKey(userId, url);
      const domainEntries = this.domainCache.get(domainKey);
      if (domainEntries) {
        domainEntries.delete(normalizeUrl(url));
      }
    }

    return deleted;
  }

  /**
   * 清理过期条目
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    // 清理 URL 缓存
    for (const [key, entry] of this.urlCache) {
      if (entry.expiresAt <= now) {
        this.urlCache.delete(key);
        cleaned++;
      }
    }

    // 清理域名缓存
    for (const [domainKey, entries] of this.domainCache) {
      for (const [url, entry] of entries) {
        if (entry.expiresAt <= now) {
          entries.delete(url);
          cleaned++;
        }
      }
      if (entries.size === 0) {
        this.domainCache.delete(domainKey);
      }
    }

    if (cleaned > 0) {
      logger.info(
        { cleaned, remaining: this.urlCache.size },
        "CorrectionCache: Cleanup completed",
      );
    }
  }

  /**
   * LRU 淘汰最旧的条目
   */
  private evictOldest(): void {
    // 找到最旧的条目
    let oldestKey: CacheKey | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.urlCache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.urlCache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    writes: number;
    evictions: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.urlCache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0,
      writes: this.stats.writes,
      evictions: this.stats.evictions,
    };
  }

  /**
   * 清空缓存（用于测试）
   */
  clear(): void {
    this.urlCache.clear();
    this.domainCache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0,
    };
  }
}

// ============================================================================
// 单例实例（已废弃，请使用 service-factory.ts）
// ============================================================================

let _instance: CorrectionCacheService | null = null;

/**
 * 获取全局 CorrectionCache 实例
 *
 * @deprecated 请使用 `import { getCorrectionCache } from './service-factory'` 代替
 */
export function getCorrectionCache(
  config?: Partial<CorrectionCacheConfig>,
): CorrectionCacheService {
  if (!_instance) {
    _instance = new CorrectionCacheService(config);
  }
  return _instance;
}

/**
 * 重置全局实例（用于测试）
 *
 * @deprecated 请使用 `import { cleanupV4Services } from './service-factory'` 代替
 */
export function resetCorrectionCache(): void {
  if (_instance) {
    _instance.stop();
    _instance = null;
  }
}
