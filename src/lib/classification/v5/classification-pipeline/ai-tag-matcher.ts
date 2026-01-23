/**
 * AI 标签匹配器
 *
 * 在 L0 规则匹配的最前端执行，将书签的 AI 标签与文件夹进行匹配
 * 支持三种匹配策略：
 * 1. 精确匹配：标签 ↔ 文件夹名
 * 2. 核心标签匹配：标签 ↔ 文件夹核心标签
 * 3. 相关标签匹配：标签 ↔ 文件夹相关标签
 *
 * v1.1.0: 集成同义词映射器和监控指标
 *
 * @module @/lib/classification/v5/classification-pipeline/ai-tag-matcher
 * @version 1.1.0
 * @since 2026-01-23
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import type {
  ClassificationRequest,
  FolderTagProfile,
  TagMatchResult,
  TagMatcherConfig,
} from "./types";
import { tagSynonymMapper } from "./tag-synonym-mapper";
import { tagMatchMetrics } from "./tag-match-metrics";

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
 * AI 标签匹配器类
 */
export class AiTagMatcher {
  private config: TagMatcherConfig;
  private folderProfiles: Map<string, FolderTagProfile[]>;

  constructor(
    private supabase: SupabaseClient,
    config?: Partial<TagMatcherConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.folderProfiles = new Map();
  }

  /**
   * 主匹配方法 - 在 L0 最前端调用
   * v1.1.0: 集成监控指标和同义词扩展
   */
  async match(request: ClassificationRequest): Promise<TagMatchResult | null> {
    const startTime = Date.now();

    if (!request.tags || request.tags.length === 0) {
      logger.debug(
        { bookmarkId: request.bookmarkId },
        "无标签，跳过 AI 标签匹配",
      );
      return null;
    }

    const profiles = await this.getFolderProfiles(request.userId);
    if (profiles.length === 0) {
      logger.debug(
        { userId: request.userId },
        "无文件夹画像，跳过 AI 标签匹配",
      );
      return null;
    }

    const normalizedTags = request.tags.map((t) => t.toLowerCase().trim());
    // v1.1.0: 使用同义词映射器扩展标签
    const expandedTags = tagSynonymMapper.expandTags(normalizedTags);

    // 策略 1：标签 ↔ 文件夹名精确���配（最高优先级）
    const exactMatch = this.matchExactFolderName(expandedTags, profiles);
    if (exactMatch) {
      const duration = Date.now() - startTime;
      logger.info(
        {
          bookmarkId: request.bookmarkId,
          matchType: "exact_name",
          folderId: exactMatch.folderId,
          confidence: exactMatch.confidence,
          duration,
        },
        "AI标签精确匹配成功",
      );
      // v1.1.0: 记录监控指标
      tagMatchMetrics.recordMatch(
        request.bookmarkId,
        request.userId,
        "exact_name",
        exactMatch.confidence,
        exactMatch.matchedTags,
        exactMatch.folderId,
        duration,
      );
      return exactMatch;
    }

    // 策略 2：标签 ↔ 文件夹核心标签匹配
    const coreMatch = this.matchCoreTags(expandedTags, profiles);
    if (coreMatch) {
      const duration = Date.now() - startTime;
      logger.info(
        {
          bookmarkId: request.bookmarkId,
          matchType: "core_tag",
          folderId: coreMatch.folderId,
          confidence: coreMatch.confidence,
          duration,
        },
        "AI标签核心标签匹配成功",
      );
      // v1.1.0: 记录监控指标
      tagMatchMetrics.recordMatch(
        request.bookmarkId,
        request.userId,
        "core_tag",
        coreMatch.confidence,
        coreMatch.matchedTags,
        coreMatch.folderId,
        duration,
      );
      return coreMatch;
    }

    // 策略 3：标签 ↔ 文件夹相关标签匹配
    const relatedMatch = this.matchRelatedTags(expandedTags, profiles);
    if (relatedMatch) {
      const duration = Date.now() - startTime;
      logger.info(
        {
          bookmarkId: request.bookmarkId,
          matchType: "related_tag",
          folderId: relatedMatch.folderId,
          confidence: relatedMatch.confidence,
          duration,
        },
        "AI标签相关标签匹配成功",
      );
      // v1.1.0: 记录监控指标
      tagMatchMetrics.recordMatch(
        request.bookmarkId,
        request.userId,
        "related_tag",
        relatedMatch.confidence,
        relatedMatch.matchedTags,
        relatedMatch.folderId,
        duration,
      );
      return relatedMatch;
    }

    const duration = Date.now() - startTime;
    logger.debug(
      { bookmarkId: request.bookmarkId, duration },
      "AI 标签无匹配，继续后续流程",
    );
    // v1.1.0: 记录无匹配
    tagMatchMetrics.recordNoMatch(request.bookmarkId, request.userId, duration);
    return null;
  }

  /**
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
   * 获取用户的文件夹标签画像（带缓存）
   */
  async getFolderProfiles(userId: string): Promise<FolderTagProfile[]> {
    // 缓存检查
    if (this.folderProfiles.has(userId)) {
      return this.folderProfiles.get(userId)!;
    }

    // 从数据库加载
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

    this.folderProfiles.set(userId, profiles);
    return profiles;
  }

  /**
   * 清除用户缓存（文件夹变更时调用）
   */
  clearCache(userId: string): void {
    this.folderProfiles.delete(userId);
    logger.debug({ userId }, "已清除用户文件夹画像缓存");
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.folderProfiles.clear();
    logger.debug("已清除所有文件夹画像缓存");
  }
}
