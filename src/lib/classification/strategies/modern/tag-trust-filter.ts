/**
 * 标签可信度过滤器
 *
 * 处理 SEO 垃圾标签过滤、标签来源分级、黑名单排除
 *
 * @module @/lib/classification/v5/classification-pipeline/tag-trust-filter
 * @version 1.1.0
 * @since 2026-01-23
 */

import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FolderId } from "@/lib/shared/types";

const logger = createLogger("tag-trust-filter");

/**
 * 标签来源等级
 */
export enum TagSourceLevel {
  /** Level S: 高信 - 用户手动输入/LLM 根据内容生成 */
  S = "S",
  /** Level B: 中信 - OpenGraph article:tag */
  B = "B",
  /** Level C: 低信 - Meta keywords (SEO 重灾区) */
  C = "C",
}

/**
 * 标签来源权重
 */
export const TAG_SOURCE_WEIGHTS: Record<TagSourceLevel, number> = {
  [TagSourceLevel.S]: 1.0,
  [TagSourceLevel.B]: 0.8,
  [TagSourceLevel.C]: 0.3,
};

/**
 * 全局停用词表（高 IDF 万金油词）
 *
 * 这些词在几乎所有页面都出现，没有分类意义
 */
export const GLOBAL_STOP_TAGS = new Set([
  // 通用无意义词 - 英文
  "home",
  "page",
  "article",
  "post",
  "blog",
  "news",
  "content",
  "website",
  "site",
  "web",
  "online",
  "digital",
  "media",
  "company",
  "business",
  "service",
  "services",
  "product",
  "products",
  "solution",
  "solutions",

  // 通用无意义词 - 中文
  "首页",
  "文章",
  "帖子",
  "博客",
  "新闻",
  "内容",
  "分享",
  "网站",
  "网页",
  "资讯",
  "动态",
  "公司",
  "企业",
  "服务",
  "产品",

  // SEO 常见堆砌词 - 英文
  "best",
  "top",
  "guide",
  "tutorial",
  "how to",
  "howto",
  "tips",
  "tricks",
  "ultimate",
  "complete",
  "comprehensive",
  "definitive",
  "essential",
  "beginner",
  "advanced",
  "expert",
  "professional",
  "free",
  "download",
  "latest",
  "new",
  "update",
  "updated",

  // SEO 常见堆砌词 - 中文
  "最佳",
  "指南",
  "教程",
  "技巧",
  "入门",
  "精选",
  "推荐",
  "必看",
  "必读",
  "干货",
  "合集",
  "大全",
  "完整",
  "详解",
  "深度",
  "全面",
  "最新",
  "免费",
  "下载",

  // 过于宽泛的技术词
  "technology",
  "tech",
  "software",
  "internet",
  "computer",
  "programming",
  "development",
  "developer",
  "code",
  "coding",

  // 过于宽泛的技术词 - 中文
  "技术",
  "科技",
  "软件",
  "互联网",
  "网络",
  "电脑",
  "计算机",
  "编程",
  "开发",
  "程序",
]);

/**
 * 带权重的标签
 */
export interface WeightedTag {
  /** 原始标签 */
  tag: string;
  /** 标准化后的标签（小写、去空格） */
  normalizedTag: string;
  /** 标签来源等级 */
  sourceLevel: TagSourceLevel;
  /** 权重 (0-1) */
  weight: number;
  /** 是否被过滤 */
  isFiltered: boolean;
  /** 过滤原因 */
  filterReason?:
    | "global_stop_tag"
    | "user_blacklist"
    | "too_short"
    | "too_long";
}

/**
 * 过滤统计
 */
export interface FilterStats {
  /** 总标签数 */
  total: number;
  /** 通过的标签数 */
  passed: number;
  /** 被过滤的标签数 */
  filtered: number;
  /** 按过滤原因分类 */
  byReason: Record<string, number>;
}

/**
 * 标签可信度过滤器
 *
 * 功能：
 * 1. SEO 垃圾词过滤（全局停用词表）
 * 2. 标签来源分级权重
 * 3. 用户自定义黑名单（支持数据库持久化）
 * 4. 长度过滤（过短/过长）
 *
 * v1.1.0: 支持 Supabase 持久化黑名单
 */
export class TagTrustFilter {
  /** 用户黑名单缓存: userId -> folderId -> Set<tag> */
  private userBlacklist: Map<string, Map<FolderId, Set<string>>>;

  /** 自定义停用词（可扩展） */
  private customStopTags: Set<string>;

  /** Supabase 客户端（可选，用于持久化） */
  private supabase?: SupabaseClient;

  /** 黑名单缓存 TTL（毫秒） */
  private readonly blacklistCacheTtlMs = 5 * 60 * 1000; // 5 分钟

  /** 黑名单加载时间记录: userId -> lastLoadTime */
  private blacklistLoadTimes: Map<string, number>;

  constructor(supabase?: SupabaseClient) {
    this.userBlacklist = new Map();
    this.customStopTags = new Set();
    this.supabase = supabase;
    this.blacklistLoadTimes = new Map();
  }

  /**
   * 设置 Supabase 客户端（用于延迟初始化）
   */
  setSupabaseClient(supabase: SupabaseClient): void {
    this.supabase = supabase;
  }

  /**
   * 过滤并加权标签
   *
   * @param tags 原始标签列表
   * @param sourceLevel 标签来源等级
   * @param userId 用户 ID（用于检查黑名单）
   * @param targetFolderId 目标文件夹 ID（用于检查黑名单）
   */
  filterAndWeight(
    tags: string[],
    sourceLevel: TagSourceLevel,
    userId?: string,
    targetFolderId?: FolderId,
  ): WeightedTag[] {
    const result: WeightedTag[] = [];

    for (const tag of tags) {
      const normalizedTag = this.normalizeForFilter(tag);
      const baseWeight = TAG_SOURCE_WEIGHTS[sourceLevel];

      // 检查全局停用词
      if (this.isStopTag(normalizedTag)) {
        result.push({
          tag,
          normalizedTag,
          sourceLevel,
          weight: 0,
          isFiltered: true,
          filterReason: "global_stop_tag",
        });
        continue;
      }

      // 检查用户黑名单
      if (
        userId &&
        targetFolderId &&
        this.isBlacklisted(userId, targetFolderId, normalizedTag)
      ) {
        result.push({
          tag,
          normalizedTag,
          sourceLevel,
          weight: 0,
          isFiltered: true,
          filterReason: "user_blacklist",
        });
        continue;
      }

      // 长度过滤
      const lengthResult = this.checkLength(normalizedTag, baseWeight);
      if (lengthResult.isFiltered) {
        result.push({
          tag,
          normalizedTag,
          sourceLevel,
          weight: 0,
          isFiltered: true,
          filterReason: lengthResult.reason,
        });
        continue;
      }

      result.push({
        tag,
        normalizedTag,
        sourceLevel,
        weight: lengthResult.weight,
        isFiltered: false,
      });
    }

    return result;
  }

  /**
   * 获取可用标签（未被过滤的）
   */
  getUsableTags(weightedTags: WeightedTag[]): WeightedTag[] {
    return weightedTags.filter((wt) => !wt.isFiltered);
  }

  /**
   * 获取可用于直接匹配的高信标签（Level S/B）
   *
   * Level C 标签仅用于 T0 加成，不用于直接匹配
   */
  getDirectMatchableTags(weightedTags: WeightedTag[]): string[] {
    return weightedTags
      .filter((wt) => !wt.isFiltered && wt.sourceLevel !== TagSourceLevel.C)
      .map((wt) => wt.normalizedTag);
  }

  /**
   * 获取过滤统计
   */
  getFilterStats(weightedTags: WeightedTag[]): FilterStats {
    const stats: FilterStats = {
      total: weightedTags.length,
      passed: 0,
      filtered: 0,
      byReason: {},
    };

    for (const wt of weightedTags) {
      if (wt.isFiltered) {
        stats.filtered++;
        const reason = wt.filterReason || "unknown";
        stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;
      } else {
        stats.passed++;
      }
    }

    return stats;
  }

  /**
   * 添加标签到用户黑名单（支持持久化）
   */
  async addToBlacklist(
    userId: string,
    folderId: FolderId,
    tag: string,
  ): Promise<void> {
    const normalizedTag = this.normalizeForFilter(tag);

    // 1. 更新内存缓存
    if (!this.userBlacklist.has(userId)) {
      this.userBlacklist.set(userId, new Map());
    }
    // 安全获取：上面已确保 userId 存在
    const userMap = this.userBlacklist.get(userId) ?? new Map();

    if (!userMap.has(folderId)) {
      userMap.set(folderId, new Set());
    }
    // 安全获取：上面已确保 folderId 存在
    const folderSet = userMap.get(folderId);
    if (folderSet) {
      folderSet.add(normalizedTag);
    }

    // 2. 持久化到数据库
    if (this.supabase) {
      try {
        const { error } = await this.supabase.rpc("add_folder_blacklist_tag", {
          p_user_id: userId,
          p_folder_id: folderId,
          p_tag: normalizedTag,
        });

        if (error) {
          logger.warn(
            { error, userId, folderId, tag: normalizedTag },
            "持久化黑名单失败",
          );
        } else {
          logger.debug(
            { userId, folderId, tag: normalizedTag },
            "标签已添加到黑名单（已持久化）",
          );
        }
      } catch (err) {
        logger.warn(
          { err, userId, folderId, tag: normalizedTag },
          "持久化黑名单异常",
        );
      }
    } else {
      logger.debug(
        { userId, folderId, tag: normalizedTag },
        "标签已添加到黑名单（仅内存）",
      );
    }
  }

  /**
   * 从用户黑名单移除标签（支持持久化）
   */
  async removeFromBlacklist(
    userId: string,
    folderId: FolderId,
    tag: string,
  ): Promise<void> {
    const normalizedTag = this.normalizeForFilter(tag);

    // 1. 更新内存缓存
    this.userBlacklist.get(userId)?.get(folderId)?.delete(normalizedTag);

    // 2. 持久化到数据库
    if (this.supabase) {
      try {
        const { error } = await this.supabase.rpc(
          "remove_folder_blacklist_tag",
          {
            p_user_id: userId,
            p_folder_id: folderId,
            p_tag: normalizedTag,
          },
        );

        if (error) {
          logger.warn(
            { error, userId, folderId, tag: normalizedTag },
            "从数据库移除黑名单失败",
          );
        } else {
          logger.debug(
            { userId, folderId, tag: normalizedTag },
            "标签已从黑名单移除（已持久化）",
          );
        }
      } catch (err) {
        logger.warn(
          { err, userId, folderId, tag: normalizedTag },
          "从数据库移除黑名单异常",
        );
      }
    } else {
      logger.debug(
        { userId, folderId, tag: normalizedTag },
        "标签已从黑名单移除（仅内存）",
      );
    }
  }

  /**
   * 从数据库加载用户黑名单
   */
  async loadBlacklistFromDb(userId: string): Promise<void> {
    if (!this.supabase) {
      return;
    }

    // 检查缓存是否过期
    const lastLoadTime = this.blacklistLoadTimes.get(userId) || 0;
    if (Date.now() - lastLoadTime < this.blacklistCacheTtlMs) {
      return; // 缓存未过期
    }

    try {
      const { data, error } = await this.supabase
        .from("folder_tag_profiles")
        .select("folder_id, blacklist_tags")
        .eq("user_id", userId);

      if (error) {
        logger.warn({ error, userId }, "从数据库加载黑名单失败");
        return;
      }

      // 更新内存缓存
      const userMap = new Map<FolderId, Set<string>>();
      for (const row of data || []) {
        const folderId = row.folder_id;
        const tags = (row.blacklist_tags as string[]) || [];
        if (tags.length > 0) {
          userMap.set(
            folderId,
            new Set(tags.map((t) => this.normalizeForFilter(t))),
          );
        }
      }

      this.userBlacklist.set(userId, userMap);
      this.blacklistLoadTimes.set(userId, Date.now());

      logger.debug(
        { userId, folderCount: userMap.size },
        "从数据库加载黑名单成功",
      );
    } catch (err) {
      logger.warn({ err, userId }, "从数据库加载黑名单异常");
    }
  }

  /**
   * 获取用户的黑名单
   */
  getBlacklist(userId: string, folderId: FolderId): string[] {
    return Array.from(this.userBlacklist.get(userId)?.get(folderId) || []);
  }

  /**
   * 添加自定义停用词
   */
  addCustomStopTag(tag: string): void {
    this.customStopTags.add(this.normalizeForFilter(tag));
  }

  /**
   * 移除自定义停用词
   */
  removeCustomStopTag(tag: string): void {
    this.customStopTags.delete(this.normalizeForFilter(tag));
  }

  /**
   * 清除用户黑名单缓存
   */
  clearBlacklistCache(userId?: string): void {
    if (userId) {
      this.userBlacklist.delete(userId);
    } else {
      this.userBlacklist.clear();
    }
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 用于过滤检查的标准化（仅小写和去除首尾空格）
   */
  private normalizeForFilter(tag: string): string {
    return tag.toLowerCase().trim();
  }

  /**
   * 检查是否是停用词
   */
  private isStopTag(normalizedTag: string): boolean {
    return (
      GLOBAL_STOP_TAGS.has(normalizedTag) ||
      this.customStopTags.has(normalizedTag)
    );
  }

  /**
   * 检查是否在用户黑名单中
   */
  private isBlacklisted(
    userId: string,
    folderId: FolderId,
    normalizedTag: string,
  ): boolean {
    return (
      this.userBlacklist.get(userId)?.get(folderId)?.has(normalizedTag) || false
    );
  }

  /**
   * 检查标签长度
   */
  private checkLength(
    normalizedTag: string,
    baseWeight: number,
  ): {
    isFiltered: boolean;
    weight: number;
    reason?: "too_short" | "too_long";
  } {
    // 过短的标签（单字符）
    if (normalizedTag.length < 2) {
      return { isFiltered: true, weight: 0, reason: "too_short" };
    }

    // 过长的标签（可能是句子而非标签）
    if (normalizedTag.length > 50) {
      return { isFiltered: true, weight: 0, reason: "too_long" };
    }

    // 长度惩罚
    let lengthPenalty = 1.0;
    if (normalizedTag.length < 3) {
      lengthPenalty = 0.5; // 2 字符标签降权
    } else if (normalizedTag.length > 30) {
      lengthPenalty = 0.7; // 过长标签降权
    }

    return {
      isFiltered: false,
      weight: baseWeight * lengthPenalty,
    };
  }
}

// 导出单例实例
export const tagTrustFilter = new TagTrustFilter();
