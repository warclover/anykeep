/**
 * Link Service
 *
 * 知识关联核心服务
 * 负责协调各种关联发现策略并管理关联数据
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import type {
  KnowledgeLink,
  RelatedBookmark,
  GetRelatedOptions,
  LinkDiscoveryInput,
  DiscoveredLink,
  KnowledgeGraphStats,
  LinkServiceConfig,
  LinkType,
} from "../types/link.types";
import {
  getLinkRepository,
  type ILinkRepository,
} from "../repositories/link.repository";
import { logger } from "@/lib/logger";
import {
  getSimilarityEngineService,
  type ISimilarityEngineService,
} from "./similarity-engine.service";
import {
  getEntityMatcherService,
  type IEntityMatcherService,
} from "./entity-matcher.service";
import { createClient } from "@/lib/supabase/client";

// ============================================================================
// Service Interface
// ============================================================================

export interface ILinkService {
  /**
   * 处理新书签的关联发现
   */
  processNewBookmark(bookmarkId: number, userId: string): Promise<void>;

  /**
   * 获取书签的相关内容
   */
  getRelatedBookmarks(
    bookmarkId: number,
    userId: string,
    options?: GetRelatedOptions,
  ): Promise<RelatedBookmark[]>;

  /**
   * 获取书签的关联列表
   */
  getBookmarkLinks(
    bookmarkId: number,
    userId: string,
  ): Promise<KnowledgeLink[]>;

  /**
   * 获取用户知识图谱统计
   */
  getGraphStats(userId: string): Promise<KnowledgeGraphStats>;

  /**
   * 手动触发单个书签的关联重建
   */
  rebuildLinks(bookmarkId: number, userId: string): Promise<number>;

  /**
   * 重建用户的整个知识图谱
   * 批量处理所有书签的关联发现
   */
  rebuildUserGraph(
    userId: string,
    options?: {
      /** 批处理大小 */
      batchSize?: number;
      /** 进度回调 */
      onProgress?: (processed: number, total: number) => void;
    },
  ): Promise<{ totalProcessed: number; totalLinks: number }>;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * 知识关联服务
 */
export class LinkService implements ILinkService {
  private config: LinkServiceConfig;

  constructor(
    private linkRepo: ILinkRepository = getLinkRepository(),
    private similarityEngine: ISimilarityEngineService = getSimilarityEngineService(),
    private entityMatcher: IEntityMatcherService = getEntityMatcherService(),
    config?: Partial<LinkServiceConfig>,
  ) {
    this.config = {
      enableSemantic: true,
      enableEntity: true,
      enableTag: true,
      semanticThreshold: 0.7,
      entityMinShared: 1,
      tagMinShared: 2,
      maxLinksPerType: 10,
      emitEvents: true,
      ...config,
    };
  }

  /**
   * 处理新书签的关联发现
   */
  async processNewBookmark(bookmarkId: number, userId: string): Promise<void> {
    logger.info(
      { bookmarkId, userId },
      "[LinkService] Processing new bookmark",
    );

    try {
      // 1. 获取书签信息
      const bookmark = await this.getBookmarkInfo(bookmarkId, userId);
      if (!bookmark) {
        logger.warn({ bookmarkId }, "[LinkService] Bookmark not found");
        return;
      }

      // 2. 发现关联
      const discoveredLinks = await this.discoverAllLinks({
        userId,
        bookmarkId,
        title: bookmark.title,
        tags: bookmark.aiTags,
        entities: bookmark.entities,
      });

      logger.info(
        { bookmarkId, linksCount: discoveredLinks.length },
        "[LinkService] Discovered links",
      );

      if (discoveredLinks.length === 0) {
        return;
      }

      // 3. 过滤和去重
      const filteredLinks = this.filterAndDeduplicateLinks(discoveredLinks);

      // 4. 保存关联
      await this.saveLinks(userId, bookmarkId, filteredLinks);

      logger.info(
        { bookmarkId, savedCount: filteredLinks.length },
        "[LinkService] Saved links",
      );
    } catch (error) {
      logger.error(
        {
          bookmarkId,
          error: error instanceof Error ? error.message : String(error),
        },
        "[LinkService] Error processing bookmark",
      );
    }
  }

  /**
   * 获取书签的相关内容
   */
  async getRelatedBookmarks(
    bookmarkId: number,
    userId: string,
    options?: GetRelatedOptions,
  ): Promise<RelatedBookmark[]> {
    return this.linkRepo.getRelatedBookmarks(bookmarkId, userId, {
      limit: options?.limit || 10,
      minStrength: options?.minStrength || 0.3,
      types: options?.types,
    });
  }

  /**
   * 获取书签的关联列表
   */
  async getBookmarkLinks(
    bookmarkId: number,
    userId: string,
  ): Promise<KnowledgeLink[]> {
    return this.linkRepo.getBookmarkLinks(bookmarkId, {
      userId,
      minStrength: 0.3,
      limit: 20,
    });
  }

  /**
   * 获取用户知识图谱统计
   */
  async getGraphStats(userId: string): Promise<KnowledgeGraphStats> {
    return this.linkRepo.getGraphStats(userId);
  }

  /**
   * 手动触发关联重建
   */
  async rebuildLinks(bookmarkId: number, userId: string): Promise<number> {
    // 1. 删除现有关联
    await this.linkRepo.deleteBookmarkLinks(bookmarkId);

    // 2. 重新发现关联
    await this.processNewBookmark(bookmarkId, userId);

    // 3. 返回新关联数量
    const links = await this.linkRepo.getBookmarkLinks(bookmarkId, { userId });
    return links.length;
  }

  /**
   * 重建用户的整个知识图谱
   * 批量处理所有书签的关联发现
   */
  async rebuildUserGraph(
    userId: string,
    options?: {
      batchSize?: number;
      onProgress?: (processed: number, total: number) => void;
    },
  ): Promise<{ totalProcessed: number; totalLinks: number }> {
    const batchSize = options?.batchSize || 10;
    const onProgress = options?.onProgress;

    logger.info(
      { userId, batchSize },
      "[LinkService] Starting user graph rebuild",
    );

    const supabase = createClient();

    try {
      // 1. 获取用户的所有书签 ID
      const { data: bookmarks, error } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to get bookmarks: ${error.message}`);
      }

      const bookmarkIds = (bookmarks || []).map((b) => b.id);
      const total = bookmarkIds.length;

      if (total === 0) {
        logger.info({ userId }, "[LinkService] No bookmarks to process");
        return { totalProcessed: 0, totalLinks: 0 };
      }

      logger.info(
        { userId, totalBookmarks: total },
        "[LinkService] Found bookmarks for rebuild",
      );

      // 2. 删除所有现有关联
      await this.deleteAllUserLinks(userId);

      // 3. 批量处理书签
      let processed = 0;
      let totalLinksCreated = 0;

      for (let i = 0; i < bookmarkIds.length; i += batchSize) {
        const batch = bookmarkIds.slice(i, i + batchSize);

        // 并行处理批次内的书签
        const results = await Promise.allSettled(
          batch.map((bookmarkId) =>
            this.processNewBookmark(bookmarkId, userId),
          ),
        );

        // 统计成功处理的数量
        for (const result of results) {
          if (result.status === "fulfilled") {
            processed++;
          } else {
            logger.warn(
              { error: result.reason },
              "[LinkService] Failed to process bookmark in batch",
            );
          }
        }

        // 调用进度回调
        if (onProgress) {
          onProgress(processed, total);
        }

        // 短暂延迟，避免过载
        if (i + batchSize < bookmarkIds.length) {
          await this.delay(100);
        }
      }

      // 4. 获取最终统计
      const stats = await this.getGraphStats(userId);
      totalLinksCreated = stats.totalLinks;

      logger.info(
        { userId, totalProcessed: processed, totalLinks: totalLinksCreated },
        "[LinkService] User graph rebuild complete",
      );

      return {
        totalProcessed: processed,
        totalLinks: totalLinksCreated,
      };
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "[LinkService] User graph rebuild failed",
      );
      throw error;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * 删除用户的所有知识关联
   */
  private async deleteAllUserLinks(userId: string): Promise<void> {
    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("knowledge_links")
      .delete()
      .eq("user_id", userId);

    if (error) {
      logger.error({ error }, "[LinkService] Failed to delete user links");
      throw new Error(`Failed to delete user links: ${error.message}`);
    }

    logger.info({ userId }, "[LinkService] Deleted all user links");
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取书签信息（用于关联发现）
   */
  private async getBookmarkInfo(
    bookmarkId: number,
    userId: string,
  ): Promise<{
    id: number;
    title: string;
    url: string;
    aiTags: string[];
    entities: string[];
    hasEmbedding: boolean;
  } | null> {
    const supabase = createClient();

    // 获取书签基本信息
    const { data: bookmark, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, ai_tags, embedding")
      .eq("id", bookmarkId)
      .eq("user_id", userId)
      .single();

    if (error || !bookmark) {
      return null;
    }

    // 获取实体
    const entities = await this.linkRepo.getBookmarkEntities(bookmarkId);

    return {
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      aiTags: bookmark.ai_tags || [],
      entities,
      hasEmbedding: !!bookmark.embedding,
    };
  }

  /**
   * 发现所有类型的关联
   */
  private async discoverAllLinks(
    input: LinkDiscoveryInput,
  ): Promise<DiscoveredLink[]> {
    const allLinks: DiscoveredLink[] = [];

    // 并行执行各种关联发现
    const promises: Promise<DiscoveredLink[]>[] = [];

    // 1. 语义相似度
    if (this.config.enableSemantic) {
      promises.push(
        this.similarityEngine.findSimilar(input.userId, input.bookmarkId, {
          minSimilarity: this.config.semanticThreshold,
          limit: this.config.maxLinksPerType,
        }),
      );
    }

    // 2. 实体匹配
    if (
      this.config.enableEntity &&
      input.entities &&
      input.entities.length > 0
    ) {
      promises.push(
        this.entityMatcher.findBySharedEntities(
          input.userId,
          input.entities,
          input.bookmarkId,
          {
            minShared: this.config.entityMinShared,
            limit: this.config.maxLinksPerType,
          },
        ),
      );
    }

    // 3. 标签匹配（通过数据库函数）
    if (this.config.enableTag && input.tags && input.tags.length > 0) {
      promises.push(
        this.findByTags(input.userId, input.tags, input.bookmarkId),
      );
    }

    // 等待所有结果
    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === "fulfilled") {
        allLinks.push(...result.value);
      } else {
        logger.error(
          { error: result.reason },
          "[LinkService] Link discovery failed",
        );
      }
    }

    return allLinks;
  }

  /**
   * 按标签查找关联
   */
  private async findByTags(
    userId: string,
    tags: string[],
    excludeBookmarkId: number,
  ): Promise<DiscoveredLink[]> {
    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(
      "find_bookmarks_by_tags",
      {
        p_user_id: userId,
        p_tags: tags,
        p_exclude_id: excludeBookmarkId,
        p_min_shared: this.config.tagMinShared,
        p_limit: this.config.maxLinksPerType,
      },
    );

    if (error) {
      logger.error({ error }, "[LinkService] Failed to find by tags");
      return [];
    }

    return (data || []).map(
      (row: {
        bookmark_id: number;
        title: string;
        shared_count: number;
        shared_tags: string[];
      }) => ({
        targetBookmarkId: row.bookmark_id,
        linkType: "tag" as LinkType,
        strength: Math.min(row.shared_count / 3, 1),
        evidence: {
          type: "tag" as const,
          score: row.shared_count / Math.max(tags.length, 1),
          details: {
            sharedTags: row.shared_tags,
          },
        },
        algorithm: "tag-matching",
      }),
    );
  }

  /**
   * 过滤和去重关联
   */
  private filterAndDeduplicateLinks(links: DiscoveredLink[]): DiscoveredLink[] {
    // 按 targetBookmarkId + linkType 去重，保留强度最高的
    const linkMap = new Map<string, DiscoveredLink>();

    for (const link of links) {
      const key = `${link.targetBookmarkId}-${link.linkType}`;
      const existing = linkMap.get(key);

      if (!existing || link.strength > existing.strength) {
        linkMap.set(key, link);
      }
    }

    // 过滤低质量关联
    return Array.from(linkMap.values()).filter((link) => link.strength >= 0.3);
  }

  /**
   * 保存关联到数据库
   */
  private async saveLinks(
    userId: string,
    sourceBookmarkId: number,
    links: DiscoveredLink[],
  ): Promise<void> {
    if (links.length === 0) {
      return;
    }

    await this.linkRepo.batchUpsertLinks({
      userId,
      links: links.map((link) => ({
        bookmarkId1: sourceBookmarkId,
        bookmarkId2: link.targetBookmarkId,
        linkType: link.linkType,
        strength: link.strength,
        evidence: link.evidence,
        algorithm: link.algorithm,
      })),
    });
  }
}

// ============================================================================
// Singleton
// ============================================================================

let linkServiceInstance: LinkService | null = null;

/**
 * 获取 LinkService 单例
 */
export function getLinkService(): LinkService {
  if (!linkServiceInstance) {
    linkServiceInstance = new LinkService();
  }
  return linkServiceInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetLinkService(): void {
  linkServiceInstance = null;
}
