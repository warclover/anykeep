/**
 * AI 标签匹配器
 *
 * 在 L0 规则匹配的最前端执行，将书签的 AI 标签与文件夹进行匹配
 * 支持多种匹配策略：
 * 1. 精确匹配：标签 ↔ 文件夹名（标准化后）
 * 2. 别名匹配：标签 ↔ 文件夹别名
 * 3. 部分匹配：标签 ⊃ 文件夹名（需 T0 校验）
 * 4. 核心标签匹配：标签 ↔ 文件夹核心标签
 * 5. 相关标签匹配：标签 ↔ 文件夹相关标签
 *
 * v1.1.0: 集成同义词映射器和监控指标
 * v1.2.0: 添加缓存过期策略（TTL 5分钟）
 * v1.3.0: 集成标签可信度过滤、激进标准化、别名管理、安全部分匹配
 * v1.4.0: 统一 match 方法，消除重复逻辑（Issue #4）
 *
 * @module @/lib/classification/v5/classification-pipeline/ai-tag-matcher
 * @version 1.4.0
 * @since 2026-01-23
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import type {
  ClassificationRequest,
  FolderTagProfile,
  TagMatchResult,
  TagMatcherConfig,
  EnhancedTagMatchResult,
} from "./types";
import { tagMatchMetrics } from "./tag-match-metrics";
import { tagNormalizer } from "./tag-normalizer";
import { tagTrustFilter, TagSourceLevel } from "./tag-trust-filter";
import { FolderAliasManager } from "./folder-alias-manager";

const logger = createLogger("ai-tag-matcher");

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TagMatcherConfig = {
  exactMatchConfidence: 0.98,
  coreTagConfidence: 0.92,
  relatedTagConfidence: 0.85,
  minMatchingTags: 1,
  minCoreTagHits: 2,
};

/**
 * 默认缓存 TTL：5 分钟
 */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 缓存条目（带过期时间）
 */
interface CachedProfileEntry {
  profiles: FolderTagProfile[];
  cachedAt: number;
}

/**
 * AI 标签匹配器类
 *
 * v1.5.0: 修复缓存并发竞争条件，使用 Promise 缓存模式
 */
export class AiTagMatcher {
  private config: TagMatcherConfig;
  private profileCache: Map<string, CachedProfileEntry>;
  private cacheTtlMs: number;
  private folderAliasManager: FolderAliasManager;
  /** v1.5.0: 正在加载的 Promise 缓存，防止并发重复请求 */
  private loadingPromises: Map<string, Promise<FolderTagProfile[]>>;

  constructor(
    private supabase: SupabaseClient,
    config?: Partial<TagMatcherConfig>,
    cacheTtlMs?: number,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.profileCache = new Map();
    this.cacheTtlMs = cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.folderAliasManager = new FolderAliasManager(supabase);
    this.loadingPromises = new Map();
  }

  /**
   * 增强型主匹配方法 - v1.3.0 新增
   *
   * 支持：
   * 1. 标签可信度过滤（SEO 垃圾词过滤）
   * 2. 激进标准化（Vue.js → vuejs）
   * 3. 别名匹配
   * 4. 安全部分匹配（需 T0 校验）
   */
  async matchEnhanced(
    request: ClassificationRequest,
    tagSourceLevel: TagSourceLevel = TagSourceLevel.S,
  ): Promise<EnhancedTagMatchResult | null> {
    const startTime = Date.now();

    if (!request.tags || request.tags.length === 0) {
      logger.debug(
        { bookmarkId: request.bookmarkId },
        "无标签，跳过增强型 AI 标签匹配",
      );
      return null;
    }

    // Phase 0.1: 标签可信度过滤
    const weightedTags = tagTrustFilter.filterAndWeight(
      request.tags,
      tagSourceLevel,
      request.userId,
    );

    const usableTags = tagTrustFilter.getUsableTags(weightedTags);
    if (usableTags.length === 0) {
      logger.debug(
        { bookmarkId: request.bookmarkId, filtered: weightedTags.length },
        "所有标签被过滤",
      );
      return null;
    }

    const profiles = await this.getFolderProfiles(request.userId);
    if (profiles.length === 0) {
      logger.debug(
        { userId: request.userId },
        "无文件夹画像，跳过增强型 AI 标签匹配",
      );
      return null;
    }

    // Phase 0.2: 标准化处理 + 同义词扩展
    const expandedTags = tagNormalizer.expandWithVariants(
      usableTags.map((wt) => wt.tag),
    );

    // 策略 1: 精确匹配（标准化后完全相等）
    const exactMatch = this.matchExactNormalized(expandedTags, profiles);
    if (exactMatch) {
      const duration = Date.now() - startTime;
      logger.info(
        {
          bookmarkId: request.bookmarkId,
          matchMode: "exact",
          folderId: exactMatch.folderId,
          confidence: exactMatch.confidence,
          duration,
        },
        "AI标签精确匹配成功（标准化）",
      );
      tagMatchMetrics.recordMatch(
        request.bookmarkId,
        request.userId,
        "exact_name",
        exactMatch.confidence,
        exactMatch.matchedTags,
        exactMatch.folderId,
        duration,
      );
      return {
        ...exactMatch,
        matchMode: "exact",
        needsT0Validation: false,
        tagScore: 1.0,
      };
    }

    // 策略 2: 别名匹配
    const aliasMatch = await this.matchAliases(
      expandedTags,
      profiles,
      request.userId,
    );
    if (aliasMatch) {
      const duration = Date.now() - startTime;
      logger.info(
        {
          bookmarkId: request.bookmarkId,
          matchMode: "normalized",
          folderId: aliasMatch.folderId,
          confidence: aliasMatch.confidence,
          duration,
        },
        "AI标签别名匹配成功",
      );
      tagMatchMetrics.recordMatch(
        request.bookmarkId,
        request.userId,
        "exact_name",
        aliasMatch.confidence,
        aliasMatch.matchedTags,
        aliasMatch.folderId,
        duration,
      );
      return {
        ...aliasMatch,
        matchMode: "normalized",
        needsT0Validation: false,
        tagScore: 0.95,
      };
    }

    // 策略 3: 安全部分匹配（需要 T0 校验）
    const partialMatch = this.matchPartialSafe(expandedTags, profiles);
    if (partialMatch) {
      const duration = Date.now() - startTime;
      logger.info(
        {
          bookmarkId: request.bookmarkId,
          matchMode: "partial",
          folderId: partialMatch.folderId,
          confidence: partialMatch.confidence,
          needsT0Validation: true,
          duration,
        },
        "AI标签部分匹配，需 T0 校验",
      );
      // 部分匹配不直接记录为成功，等待 T0 校验
      return {
        ...partialMatch,
        matchMode: "partial",
        needsT0Validation: true,
        tagScore: 0.6,
      };
    }

    // 策略 4: 核心标签匹配（仅高信标签）
    if (tagSourceLevel !== TagSourceLevel.C) {
      const coreMatch = this.matchCoreTags(expandedTags, profiles);
      if (coreMatch) {
        const duration = Date.now() - startTime;
        const needsValidation = coreMatch.confidence < 0.9;
        logger.info(
          {
            bookmarkId: request.bookmarkId,
            matchMode: "core_tag",
            folderId: coreMatch.folderId,
            confidence: coreMatch.confidence,
            needsT0Validation: needsValidation,
            duration,
          },
          "AI标签核心标签匹配成功",
        );
        tagMatchMetrics.recordMatch(
          request.bookmarkId,
          request.userId,
          "core_tag",
          coreMatch.confidence,
          coreMatch.matchedTags,
          coreMatch.folderId,
          duration,
        );
        return {
          ...coreMatch,
          matchMode: "core_tag",
          needsT0Validation: needsValidation,
          tagScore: coreMatch.confidence,
        };
      }

      // 策略 5: 相关标签匹配
      const relatedMatch = this.matchRelatedTags(expandedTags, profiles);
      if (relatedMatch) {
        const duration = Date.now() - startTime;
        logger.info(
          {
            bookmarkId: request.bookmarkId,
            matchMode: "related_tag",
            folderId: relatedMatch.folderId,
            confidence: relatedMatch.confidence,
            needsT0Validation: true,
            duration,
          },
          "AI标签相关标签匹配成功",
        );
        tagMatchMetrics.recordMatch(
          request.bookmarkId,
          request.userId,
          "related_tag",
          relatedMatch.confidence,
          relatedMatch.matchedTags,
          relatedMatch.folderId,
          duration,
        );
        return {
          ...relatedMatch,
          matchMode: "related_tag",
          needsT0Validation: true,
          tagScore: relatedMatch.confidence,
        };
      }
    }

    const duration = Date.now() - startTime;
    logger.debug(
      { bookmarkId: request.bookmarkId, duration },
      "增强型 AI 标签无匹配，继续后续流程",
    );
    tagMatchMetrics.recordNoMatch(request.bookmarkId, request.userId, duration);
    return null;
  }

  /**
   * 策略 1: 标准化后精确匹配
   * v1.3.0 新增
   */
  private matchExactNormalized(
    tags: string[],
    profiles: FolderTagProfile[],
  ): TagMatchResult | null {
    for (const profile of profiles) {
      const normalizedFolderName = tagNormalizer.normalize(profile.folderName);
      if (!normalizedFolderName) continue;

      for (const tag of tags) {
        if (tag === normalizedFolderName) {
          return {
            matched: true,
            folderId: profile.folderId.toString(),
            folderName: profile.folderName,
            confidence: this.config.exactMatchConfidence,
            matchType: "exact_name",
            matchedTags: [tag],
            reason: `标签 "${tag}" 与文件夹名完全匹配（标准化）`,
          };
        }
      }
    }
    return null;
  }

  /**
   * 策略 2: 别名匹配
   * v1.3.0 新增
   */
  private async matchAliases(
    tags: string[],
    profiles: FolderTagProfile[],
    userId: string,
  ): Promise<TagMatchResult | null> {
    for (const profile of profiles) {
      const matchedTags = await this.folderAliasManager.findMatchingTags(
        userId,
        profile.folderId.toString(),
        profile.folderName,
        tags,
      );

      if (matchedTags.length > 0) {
        return {
          matched: true,
          folderId: profile.folderId.toString(),
          folderName: profile.folderName,
          confidence: this.config.exactMatchConfidence - 0.03,
          matchType: "exact_name",
          matchedTags,
          reason: `标签 "${matchedTags[0]}" 匹配文件夹别名`,
        };
      }
    }
    return null;
  }

  /**
   * 策略 3: 安全的部分匹配
   * v1.3.0 新增
   *
   * 防止 "Java" 误匹配 "JavaScript" 的情况
   * 要求长度比例 >= 70%
   */
  private matchPartialSafe(
    tags: string[],
    profiles: FolderTagProfile[],
  ): TagMatchResult | null {
    for (const profile of profiles) {
      const normalizedFolderName = tagNormalizer.normalize(profile.folderName);
      if (!normalizedFolderName || normalizedFolderName.length < 3) continue;

      for (const tag of tags) {
        if (tag.length < 3) continue;

        // 检查包含关系
        const isContained =
          normalizedFolderName.includes(tag) ||
          tag.includes(normalizedFolderName);

        if (!isContained) continue;

        // 长度比例检查：避免 "java" 匹配 "javascript"
        const shorter = Math.min(tag.length, normalizedFolderName.length);
        const longer = Math.max(tag.length, normalizedFolderName.length);
        const ratio = shorter / longer;

        // v1.3.1: 降低阈值到 50%，配合同义词表处理短标签
        // 同时要求较短的一方至少 3 个字符
        if (ratio < 0.5 || shorter < 3) {
          logger.debug(
            { tag, folderName: profile.folderName, ratio },
            "部分匹配被拒绝：长度比例不足",
          );
          continue;
        }

        return {
          matched: true,
          folderId: profile.folderId.toString(),
          folderName: profile.folderName,
          confidence: 0.6, // 低置信度，需要 T0 校验
          matchType: "exact_name",
          matchedTags: [tag],
          reason: `标签 "${tag}" 与文件夹名 "${profile.folderName}" 部分匹配（需校验）`,
        };
      }
    }
    return null;
  }

  /**
   * 记录别名学习事件
   * v1.3.0 新增
   *
   * 当用户确认分类���调用，用于自动学习别名
   */
  recordAliasLearning(userId: string, folderId: string, tag: string): void {
    this.folderAliasManager.recordLearningEvent(userId, folderId, tag);
  }

  /**
   * 获取别名管理器（用于外部访问）
   * v1.3.0 新增
   */
  getAliasManager(): FolderAliasManager {
    return this.folderAliasManager;
  }

  /**
   * 主匹配方法 - 在 L0 最前端调用
   *
   * v1.1.0: 集成监控指标和同义词扩展
   * v1.4.0: 委托给 matchEnhanced，统一匹配逻辑，消除重复代码
   *
   * @deprecated 推荐直接使用 matchEnhanced() 获取更丰富的匹配信息
   */
  async match(request: ClassificationRequest): Promise<TagMatchResult | null> {
    // v1.4.0: 统一委托给 matchEnhanced，避免重复逻辑
    const enhancedResult = await this.matchEnhanced(request);

    if (!enhancedResult) {
      return null;
    }

    // 转换 EnhancedTagMatchResult 为 TagMatchResult（保持向后兼容）
    return {
      matched: enhancedResult.matched,
      folderId: enhancedResult.folderId,
      folderName: enhancedResult.folderName,
      confidence: enhancedResult.confidence,
      matchType: enhancedResult.matchType,
      matchedTags: enhancedResult.matchedTags,
      reason: enhancedResult.reason,
    };
  }

  /**
   * @deprecated 旧版精确匹配方法，已被 matchExactNormalized 替代
   * 保留用于向后兼容测试
   *
   * 策略 1：标签与文件夹名精确匹配
   * - AI 标签 "独立开发与产品策略" 匹配文件夹 "独立开发与产品策略"
   * - AI 标签 "前端开发" 匹配文件夹 "前端开发"
   */
  private matchExactFolderName(
    tags: string[],
    profiles: FolderTagProfile[],
  ): TagMatchResult | null {
    for (const profile of profiles) {
      const folderNameLower = profile.folderName.toLowerCase();

      for (const tag of tags) {
        // 完全匹配
        if (tag === folderNameLower) {
          return {
            matched: true,
            folderId: profile.folderId.toString(),
            folderName: profile.folderName,
            confidence: this.config.exactMatchConfidence,
            matchType: "exact_name",
            matchedTags: [tag],
            reason: `标签 "${tag}" 与文件夹名完全匹配`,
          };
        }

        // 包含匹配（标签包含文件夹名，或文件夹名包含标签）
        if (tag.length >= 4 && folderNameLower.length >= 4) {
          if (tag.includes(folderNameLower) || folderNameLower.includes(tag)) {
            return {
              matched: true,
              folderId: profile.folderId.toString(),
              folderName: profile.folderName,
              confidence: this.config.exactMatchConfidence - 0.03,
              matchType: "exact_name",
              matchedTags: [tag],
              reason: `标签 "${tag}" 与文件夹名 "${profile.folderName}" 高度相关`,
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * 策略 2：匹配文件夹核心标签
   */
  private matchCoreTags(
    tags: string[],
    profiles: FolderTagProfile[],
  ): TagMatchResult | null {
    let bestMatch: TagMatchResult | null = null;
    let bestScore = 0;

    for (const profile of profiles) {
      if (profile.coreTags.length === 0) continue;

      const matchedTags = tags.filter((t) =>
        profile.coreTags.some(
          (ct) =>
            ct.toLowerCase() === t ||
            ct.toLowerCase().includes(t) ||
            t.includes(ct.toLowerCase()),
        ),
      );

      if (matchedTags.length >= this.config.minMatchingTags) {
        // 计算匹配分数：匹配数 / 总核心标签数
        const score = matchedTags.length / Math.max(profile.coreTags.length, 1);

        if (score > bestScore) {
          bestScore = score;
          const confidence =
            matchedTags.length >= this.config.minCoreTagHits
              ? this.config.coreTagConfidence
              : this.config.coreTagConfidence - 0.05;

          bestMatch = {
            matched: true,
            folderId: profile.folderId.toString(),
            folderName: profile.folderName,
            confidence,
            matchType: "core_tag",
            matchedTags,
            reason: `匹配 ${matchedTags.length} 个核心标签: ${matchedTags.join(", ")}`,
          };
        }
      }
    }
    return bestMatch;
  }

  /**
   * 策略 3��匹配文件夹相关标签
   */
  private matchRelatedTags(
    tags: string[],
    profiles: FolderTagProfile[],
  ): TagMatchResult | null {
    let bestMatch: TagMatchResult | null = null;
    let bestScore = 0;

    for (const profile of profiles) {
      if (profile.relatedTags.length === 0) continue;

      const matchedTags = tags.filter((t) =>
        profile.relatedTags.some(
          (rt) =>
            rt.toLowerCase() === t ||
            rt.toLowerCase().includes(t) ||
            t.includes(rt.toLowerCase()),
        ),
      );

      // 相关标签需要更多命中数
      if (matchedTags.length >= 3) {
        const score =
          matchedTags.length / Math.max(profile.relatedTags.length, 1);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            matched: true,
            folderId: profile.folderId.toString(),
            folderName: profile.folderName,
            confidence: this.config.relatedTagConfidence,
            matchType: "related_tag",
            matchedTags,
            reason: `匹配 ${matchedTags.length} 个相关标签: ${matchedTags.join(", ")}`,
          };
        }
      }
    }
    return bestMatch;
  }

  /**
   * 获取用户的文件夹标签画像（带缓存和 TTL）
   * v1.2.0: 添加缓存过期策略
   * v1.5.0: 修复并发竞争条件，使用 Promise 缓存模式
   */
  async getFolderProfiles(userId: string): Promise<FolderTagProfile[]> {
    // 1. 检查有效缓存
    const cached = this.profileCache.get(userId);
    if (cached) {
      const age = Date.now() - cached.cachedAt;
      if (age < this.cacheTtlMs) {
        logger.debug(
          { userId, cacheAge: age, ttl: this.cacheTtlMs },
          "使用缓存的文件夹画像",
        );
        return cached.profiles;
      }
      // 缓存过期，清除
      logger.debug(
        { userId, cacheAge: age, ttl: this.cacheTtlMs },
        "缓存已过期，重新加载文件夹画像",
      );
      this.profileCache.delete(userId);
    }

    // 2. v1.5.0: 检查是否已有正在进行的加载请求（防止并发重复请��）
    const existingPromise = this.loadingPromises.get(userId);
    if (existingPromise) {
      logger.debug({ userId }, "复用正在进行的加载请求");
      return existingPromise;
    }

    // 3. 创建新的加载 Promise 并缓存
    const loadPromise = this.loadFolderProfilesFromDb(userId);
    this.loadingPromises.set(userId, loadPromise);

    try {
      const profiles = await loadPromise;
      return profiles;
    } finally {
      // 4. 无论成功失败，都清除 loading Promise
      this.loadingPromises.delete(userId);
    }
  }

  /**
   * 从数据库加载文件夹画像（内部方法）
   * v1.5.0: 从 getFolderProfiles 拆分出来
   */
  private async loadFolderProfilesFromDb(
    userId: string,
  ): Promise<FolderTagProfile[]> {
    const { data, error } = await this.supabase
      .from("folder_tag_profiles")
      .select(
        `
        folder_id,
        core_tags,
        related_tags,
        folder_name_tokens,
        bookmark_count,
        folders!inner(name)
      `,
      )
      .eq("user_id", userId);

    if (error) {
      logger.warn({ error, userId }, "加载文件夹标签画像失败");
      return [];
    }

    if (!data || data.length === 0) {
      logger.debug({ userId }, "用户无文件夹标签画像");
      return [];
    }

    const profiles: FolderTagProfile[] = data.map((row) => {
      // folders 可能是单个对象或数组，取决于 Supabase 版本
      const folderData = Array.isArray(row.folders)
        ? row.folders[0]
        : row.folders;
      return {
        folderId: row.folder_id,
        folderName: (folderData as { name: string })?.name || "",
        coreTags: row.core_tags || [],
        relatedTags: row.related_tags || [],
        folderNameTokens: row.folder_name_tokens || [],
        bookmarkCount: row.bookmark_count,
      };
    });

    // 存入缓存
    this.profileCache.set(userId, {
      profiles,
      cachedAt: Date.now(),
    });

    return profiles;
  }

  /**
   * 清除用户缓存（文件夹变更时调用）
   */
  clearCache(userId: string): void {
    this.profileCache.delete(userId);
    logger.debug({ userId }, "已清除用户文件夹画像缓存");
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.profileCache.clear();
    logger.debug("已清除所有文件夹画像缓存");
  }

  /**
   * 获取缓存统计信息（用于监控）
   * v1.2.0 新增
   */
  getCacheStats(): { size: number; ttlMs: number } {
    return {
      size: this.profileCache.size,
      ttlMs: this.cacheTtlMs,
    };
  }
}
