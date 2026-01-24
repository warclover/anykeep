/**
 * 文件夹别名管理器
 *
 * 管理文件夹的手动别名和自动学习的别名
 * 解决 "Golang" vs "Go"、"JS" vs "JavaScript" 等别名匹配问题
 *
 * @module @/lib/classification/v5/classification-pipeline/folder-alias-manager
 * @version 1.0.0
 * @since 2026-01-23
 */

import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FolderId } from "@/lib/shared/types";
import { tagNormalizer } from "./tag-normalizer";

const logger = createLogger("folder-alias-manager");

/**
 * 别名学习记录
 */
interface AliasLearningRecord {
  /** 标签（已标准化） */
  tag: string;
  /** 文件夹 ID */
  folderId: FolderId;
  /** 命中次数 */
  hitCount: number;
  /** 最后命中时间 */
  lastHitAt: Date;
}

/**
 * 别名缓存条目
 */
interface AliasCacheEntry {
  /** 别名列表 */
  aliases: string[];
  /** 缓存时间 */
  cachedAt: number;
}

/**
 * 文件夹别名管理器配置
 */
export interface FolderAliasManagerConfig {
  /** 自动学习阈值：相同标签-文件夹组合出现 N 次后自动添加别名 */
  learningThreshold: number;
  /** 缓存 TTL（毫秒） */
  cacheTtlMs: number;
  /** 学习记录过期时间（毫秒），超过此时间未命中则清除 */
  learningRecordExpiryMs: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FolderAliasManagerConfig = {
  learningThreshold: 3,
  cacheTtlMs: 5 * 60 * 1000, // 5 分钟
  learningRecordExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 天
};

/**
 * 缓存限制配置
 */
const CACHE_LIMITS = {
  /** 每个用户最多缓存的文件夹数 */
  maxFoldersPerUser: 100,
  /** 最多缓存的用户数 */
  maxUsers: 1000,
  /** 每个用户最多保留的学习记录数 */
  maxLearningRecordsPerUser: 500,
  /** 清理检查间隔（毫秒） */
  cleanupIntervalMs: 10 * 60 * 1000, // 10 分钟
};

/**
 * 文件夹别名管理器
 *
 * 功能：
 * 1. 管理文件夹的手动别名
 * 2. 自动学习用户行为中的隐含别名
 * 3. 检查标签是否匹配文件夹别名
 */
export class FolderAliasManager {
  /** 别名缓存: userId -> folderId -> AliasCacheEntry */
  private aliasCache: Map<string, Map<string, AliasCacheEntry>>;

  /** 学习中的别名: userId -> AliasLearningRecord[] */
  private learningRecords: Map<string, AliasLearningRecord[]>;

  /** 配置 */
  private config: FolderAliasManagerConfig;

  /** 上次清理时间 */
  private lastCleanupTime: number = 0;

  constructor(
    private supabase: SupabaseClient,
    config?: Partial<FolderAliasManagerConfig>,
  ) {
    this.aliasCache = new Map();
    this.learningRecords = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lastCleanupTime = Date.now();
  }

  /**
   * 执行定期清理（限制缓存大小 + 清理过期记录）
   * 每次访问时检查，避免无界增长
   */
  private performPeriodicCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanupTime < CACHE_LIMITS.cleanupIntervalMs) {
      return;
    }
    this.lastCleanupTime = now;

    // 1. 清理过期学习记录
    this.cleanupExpiredLearningRecords();

    // 2. 限制用户数（LRU 策略：删除最早的用户）
    if (this.aliasCache.size > CACHE_LIMITS.maxUsers) {
      const usersToRemove = this.aliasCache.size - CACHE_LIMITS.maxUsers;
      const keys = Array.from(this.aliasCache.keys()).slice(0, usersToRemove);
      for (const key of keys) {
        this.aliasCache.delete(key);
      }
      logger.debug({ removed: usersToRemove }, "缓存用户数超限，已清理");
    }

    // 3. 限制每个用户的学习记录数
    for (const [userId, records] of this.learningRecords.entries()) {
      if (records.length > CACHE_LIMITS.maxLearningRecordsPerUser) {
        // 保留最近的记录
        records.sort((a, b) => b.lastHitAt.getTime() - a.lastHitAt.getTime());
        this.learningRecords.set(
          userId,
          records.slice(0, CACHE_LIMITS.maxLearningRecordsPerUser),
        );
        logger.debug(
          {
            userId,
            removed: records.length - CACHE_LIMITS.maxLearningRecordsPerUser,
          },
          "学习记录超限，已清理",
        );
      }
    }
  }

  /**
   * 获取文件夹的所有别名（包括标准化的文件夹名）
   */
  async getAliases(
    userId: string,
    folderId: FolderId,
    folderName: string,
  ): Promise<string[]> {
    // 定期清理，防止内存泄漏
    this.performPeriodicCleanup();

    // 缓存检查
    const cached = this.getCachedAliases(userId, folderId);
    if (cached) {
      return cached;
    }

    // 从数据库加载
    const { data, error } = await this.supabase
      .from("folder_tag_profiles")
      .select("aliases")
      .eq("user_id", userId)
      .eq("folder_id", parseInt(folderId))
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      logger.warn({ error, userId, folderId }, "加载文件夹别名失败");
    }

    const dbAliases: string[] = (data?.aliases as string[]) || [];

    // 始终包含文件夹名的标准化形式
    const normalizedName = tagNormalizer.normalize(folderName);
    const allAliases = new Set<string>();

    if (normalizedName) {
      allAliases.add(normalizedName);
    }

    for (const alias of dbAliases) {
      const normalized = tagNormalizer.normalize(alias);
      if (normalized) {
        allAliases.add(normalized);
      }
    }

    const result = Array.from(allAliases);

    // 更新缓存
    this.setCachedAliases(userId, folderId, result);

    return result;
  }

  /**
   * 检查标签是否匹配文件夹别名
   */
  async matchesAlias(
    userId: string,
    folderId: FolderId,
    folderName: string,
    tag: string,
  ): Promise<boolean> {
    const aliases = await this.getAliases(userId, folderId, folderName);
    const normalizedTag = tagNormalizer.normalize(tag);

    if (!normalizedTag) {
      return false;
    }

    return aliases.includes(normalizedTag);
  }

  /**
   * 批量检查标签是否匹配任一文件夹别名
   *
   * @returns 匹配的标签列表
   */
  async findMatchingTags(
    userId: string,
    folderId: FolderId,
    folderName: string,
    tags: string[],
  ): Promise<string[]> {
    const aliases = await this.getAliases(userId, folderId, folderName);
    const matched: string[] = [];

    for (const tag of tags) {
      const normalizedTag = tagNormalizer.normalize(tag);
      if (normalizedTag && aliases.includes(normalizedTag)) {
        matched.push(tag);
      }
    }

    return matched;
  }

  /**
   * 记录学习事件（用户将带有某标签的书签放入某文件夹）
   *
   * 当同一标签-文件夹组合达到阈值时，自动添加为别名
   */
  recordLearningEvent(userId: string, folderId: FolderId, tag: string): void {
    const normalizedTag = tagNormalizer.normalize(tag);

    if (!normalizedTag) {
      return;
    }

    if (!this.learningRecords.has(userId)) {
      this.learningRecords.set(userId, []);
    }

    const records = this.learningRecords.get(userId)!;
    const existing = records.find(
      (r) => r.folderId === folderId && r.tag === normalizedTag,
    );

    if (existing) {
      existing.hitCount++;
      existing.lastHitAt = new Date();

      // 达到阈值，自动添加别名
      if (existing.hitCount >= this.config.learningThreshold) {
        logger.info(
          { userId, folderId, tag: normalizedTag, hitCount: existing.hitCount },
          "别名学习达到阈值，自动添加",
        );

        this.addAlias(userId, folderId, normalizedTag).catch((err) => {
          logger.error(
            { err, userId, folderId, tag: normalizedTag },
            "自动添加别名失败",
          );
        });

        // 从学习列表移除
        const index = records.indexOf(existing);
        records.splice(index, 1);
      }
    } else {
      records.push({
        tag: normalizedTag,
        folderId,
        hitCount: 1,
        lastHitAt: new Date(),
      });
    }
  }

  /**
   * 手动添加别名
   */
  async addAlias(
    userId: string,
    folderId: FolderId,
    alias: string,
  ): Promise<void> {
    const normalizedAlias = tagNormalizer.normalize(alias);

    if (!normalizedAlias) {
      logger.warn({ alias }, "无效的别名，跳过添加");
      return;
    }

    // 获取现有别名
    const { data: existing } = await this.supabase
      .from("folder_tag_profiles")
      .select("aliases")
      .eq("user_id", userId)
      .eq("folder_id", parseInt(folderId))
      .single();

    const currentAliases: string[] = (existing?.aliases as string[]) || [];

    if (!currentAliases.includes(normalizedAlias)) {
      currentAliases.push(normalizedAlias);

      const { error } = await this.supabase
        .from("folder_tag_profiles")
        .update({ aliases: currentAliases })
        .eq("user_id", userId)
        .eq("folder_id", parseInt(folderId));

      if (error) {
        logger.error(
          { error, userId, folderId, alias: normalizedAlias },
          "更新别名失败",
        );
        throw error;
      }
    }

    // 清除缓存
    this.clearCache(userId, folderId);

    logger.info(
      { userId, folderId, alias: normalizedAlias },
      "已添加文件夹别名",
    );
  }

  /**
   * 移除别名
   */
  async removeAlias(
    userId: string,
    folderId: FolderId,
    alias: string,
  ): Promise<void> {
    const normalizedAlias = tagNormalizer.normalize(alias);

    if (!normalizedAlias) {
      return;
    }

    // 获取现有别名
    const { data: existing } = await this.supabase
      .from("folder_tag_profiles")
      .select("aliases")
      .eq("user_id", userId)
      .eq("folder_id", parseInt(folderId))
      .single();

    const currentAliases: string[] = (existing?.aliases as string[]) || [];
    const index = currentAliases.indexOf(normalizedAlias);

    if (index !== -1) {
      currentAliases.splice(index, 1);

      const { error } = await this.supabase
        .from("folder_tag_profiles")
        .update({ aliases: currentAliases })
        .eq("user_id", userId)
        .eq("folder_id", parseInt(folderId));

      if (error) {
        logger.error(
          { error, userId, folderId, alias: normalizedAlias },
          "移除别名失败",
        );
        throw error;
      }
    }

    // 清除缓存
    this.clearCache(userId, folderId);

    logger.info(
      { userId, folderId, alias: normalizedAlias },
      "已移除文件夹别名",
    );
  }

  /**
   * 清除缓存
   */
  clearCache(userId: string, folderId?: string): void {
    if (folderId) {
      this.aliasCache.get(userId)?.delete(folderId);
    } else {
      this.aliasCache.delete(userId);
    }
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.aliasCache.clear();
  }

  /**
   * 清理过期的学习记录
   */
  cleanupExpiredLearningRecords(): void {
    const now = Date.now();
    const expiryMs = this.config.learningRecordExpiryMs;

    for (const [userId, records] of this.learningRecords.entries()) {
      const filtered = records.filter(
        (r) => now - r.lastHitAt.getTime() < expiryMs,
      );

      if (filtered.length === 0) {
        this.learningRecords.delete(userId);
      } else if (filtered.length !== records.length) {
        this.learningRecords.set(userId, filtered);
      }
    }
  }

  /**
   * 获取学习统计
   */
  getLearningStats(userId: string): {
    totalRecords: number;
    nearThreshold: number;
  } {
    const records = this.learningRecords.get(userId) || [];
    const nearThreshold = records.filter(
      (r) => r.hitCount >= this.config.learningThreshold - 1,
    ).length;

    return {
      totalRecords: records.length,
      nearThreshold,
    };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 获取缓存的别名
   */
  private getCachedAliases(
    userId: string,
    folderId: FolderId,
  ): string[] | null {
    const userCache = this.aliasCache.get(userId);
    if (!userCache) {
      return null;
    }

    const entry = userCache.get(folderId);
    if (!entry) {
      return null;
    }

    // 检查是否过期
    const age = Date.now() - entry.cachedAt;
    if (age >= this.config.cacheTtlMs) {
      userCache.delete(folderId);
      return null;
    }

    return entry.aliases;
  }

  /**
   * 设置缓存的别名
   */
  private setCachedAliases(
    userId: string,
    folderId: FolderId,
    aliases: string[],
  ): void {
    if (!this.aliasCache.has(userId)) {
      this.aliasCache.set(userId, new Map());
    }

    this.aliasCache.get(userId)!.set(folderId, {
      aliases,
      cachedAt: Date.now(),
    });
  }
}
