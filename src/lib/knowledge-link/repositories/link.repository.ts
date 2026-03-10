/**
 * Link Repository
 *
 * 知识关联数据访问层
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import { logger } from "@/lib/logger";
import { LinkEvidenceSchema } from "../types/link.schemas";
import type {
  KnowledgeLink,
  LinkType,
  RelatedBookmark,
  SaveLinkInput,
  BatchSaveLinkInput,
  LinkQueryFilter,
  KnowledgeGraphStats,
  DiscoveredLink,
  LinkEvidence,
} from "../types/link.types";

// ============================================================================
// Repository Interface
// ============================================================================

export interface ILinkRepository {
  /**
   * 保存或更新单条关联
   */
  upsertLink(input: SaveLinkInput): Promise<string>;

  /**
   * 批量保存关联
   */
  batchUpsertLinks(input: BatchSaveLinkInput): Promise<number>;

  /**
   * 获取书签的关联列表
   */
  getBookmarkLinks(
    bookmarkId: number,
    filter?: LinkQueryFilter,
  ): Promise<KnowledgeLink[]>;

  /**
   * 获取相关书签（带详情）
   */
  getRelatedBookmarks(
    bookmarkId: number,
    userId: string,
    options?: {
      limit?: number;
      minStrength?: number;
      types?: LinkType[];
    },
  ): Promise<RelatedBookmark[]>;

  /**
   * 删除书签的所有关联
   */
  deleteBookmarkLinks(bookmarkId: number): Promise<number>;

  /**
   * 获取用户知识图谱统计
   */
  getGraphStats(userId: string): Promise<KnowledgeGraphStats>;

  /**
   * 发现书签关联（调用数据库函数）
   */
  discoverLinks(
    userId: string,
    bookmarkId: number,
    options?: Record<string, unknown>,
  ): Promise<DiscoveredLink[]>;

  /**
   * 获取书签的实体列表
   */
  getBookmarkEntities(bookmarkId: number): Promise<string[]>;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * 知识关联 Repository
 */
export class LinkRepository implements ILinkRepository {
  constructor(private supabase: SupabaseClient<Database> = createClient()) {}

  /**
   * 保存或更新单条关联
   */
  async upsertLink(input: SaveLinkInput): Promise<string> {
    const { data, error } = await this.supabase.rpc("upsert_knowledge_link", {
      p_user_id: input.userId,
      p_bookmark_id_1: input.bookmarkId1,
      p_bookmark_id_2: input.bookmarkId2,
      p_link_type: input.linkType,
      p_strength: input.strength,
      p_evidence: input.evidence as unknown as Json,
      p_algorithm: input.algorithm,
    });

    if (error) {
      throw new Error(`Failed to upsert link: ${error.message}`);
    }

    return data;
  }

  /**
   * 批量保存关联
   */
  async batchUpsertLinks(input: BatchSaveLinkInput): Promise<number> {
    const linksJson = input.links.map((link) => ({
      bookmarkId1: link.bookmarkId1,
      bookmarkId2: link.bookmarkId2,
      linkType: link.linkType,
      strength: link.strength,
      evidence: link.evidence as unknown as Json,
      algorithm: link.algorithm || null,
    }));

    const { data, error } = await this.supabase.rpc(
      "batch_upsert_knowledge_links",
      {
        p_user_id: input.userId,
        p_links: linksJson as unknown as Json,
      },
    );

    if (error) {
      throw new Error(`Failed to batch upsert links: ${error.message}`);
    }

    return data;
  }

  /**
   * 获取书签的关联列表
   */
  async getBookmarkLinks(
    bookmarkId: number,
    filter?: LinkQueryFilter,
  ): Promise<KnowledgeLink[]> {
    const { data, error } = await this.supabase.rpc("get_bookmark_links", {
      p_bookmark_id: bookmarkId,
      p_user_id: filter?.userId,
      p_min_strength: filter?.minStrength || 0.5,
      p_link_types: (filter?.linkTypes as unknown as string[]) || undefined,
      p_limit: filter?.limit || 20,
    });

    if (error) {
      throw new Error(`Failed to get bookmark links: ${error.message}`);
    }

    // 映射数据库结果到 TypeScript 类型
    return (data || []).map((row) => ({
      id: row.link_id,
      userId: filter?.userId || "",
      sourceBookmarkId: Math.min(bookmarkId, row.related_bookmark_id),
      targetBookmarkId: Math.max(bookmarkId, row.related_bookmark_id),
      linkType: row.link_type as LinkType,
      strength: row.strength,
      evidence: this.parseEvidence(row.evidence),
      createdAt: row.created_at,
    }));
  }

  /**
   * 解析并验证 Evidence 数据
   */
  private parseEvidence(evidence: unknown): LinkEvidence {
    try {
      return LinkEvidenceSchema.parse(evidence);
    } catch (error) {
      logger.warn(
        { error, evidence },
        "Invalid link evidence format, using fallback",
      );
      // Fallback for invalid data to prevent crash
      return {
        type: "semantic",
        score: 0,
        details: {},
      } as LinkEvidence;
    }
  }

  /**
   * 获取相关书签（带详情）
   */
  async getRelatedBookmarks(
    bookmarkId: number,
    userId: string,
    options?: {
      limit?: number;
      minStrength?: number;
      types?: LinkType[];
    },
  ): Promise<RelatedBookmark[]> {
    const rpcParams = {
      p_bookmark_id: bookmarkId,
      p_user_id: userId,
      p_limit: options?.limit || 10,
      p_min_strength: options?.minStrength || 0.5,
      p_link_types: (options?.types as unknown as string[]) || null,
    };

    logger.info(
      { bookmarkId, userId, rpcParams },
      "[LinkRepository] Calling get_related_bookmarks_with_details",
    );

    const { data, error } = await this.supabase.rpc(
      "get_related_bookmarks_with_details",
      rpcParams,
    );

    if (error) {
      logger.error(
        { error, bookmarkId, userId, rpcParams },
        "[LinkRepository] RPC call failed",
      );
      throw new Error(`Failed to get related bookmarks: ${error.message}`);
    }

    logger.info(
      { bookmarkId, userId, resultCount: data?.length || 0, data },
      "[LinkRepository] RPC call returned",
    );

    // 映射数据库结果
    return (data || []).map((row) => ({
      bookmark: {
        id: row.bookmark_id,
        title: row.title,
        url: row.url,
        favicon: row.favicon ?? undefined,
        platform: row.platform ?? undefined,
      },
      link: {
        type: row.link_type as LinkType,
        strength: row.strength,
        sharedItems: row.shared_items || [],
      },
    }));
  }

  /**
   * 删除书签的所有关联
   */
  async deleteBookmarkLinks(bookmarkId: number): Promise<number> {
    const { data, error } = await this.supabase.rpc("delete_bookmark_links", {
      p_bookmark_id: bookmarkId,
    });

    if (error) {
      throw new Error(`Failed to delete bookmark links: ${error.message}`);
    }

    return data;
  }

  /**
   * 获取用户知识图谱统计
   */
  async getGraphStats(userId: string): Promise<KnowledgeGraphStats> {
    const { data, error } = await this.supabase.rpc(
      "get_knowledge_graph_stats",
      {
        p_user_id: userId,
      },
    );

    if (error) {
      throw new Error(`Failed to get graph stats: ${error.message}`);
    }

    const row = data?.[0] || {
      total_bookmarks: 0,
      total_links: 0,
      avg_links_per_bookmark: 0,
      semantic_links: 0,
      entity_links: 0,
      tag_links: 0,
      topic_links: 0,
      strong_links: 0,
      medium_links: 0,
      weak_links: 0,
    };

    return {
      totalBookmarks: Number(row.total_bookmarks),
      totalLinks: Number(row.total_links),
      avgLinksPerBookmark: Number(row.avg_links_per_bookmark),
      linksByType: {
        semantic: Number(row.semantic_links),
        entity: Number(row.entity_links),
        tag: Number(row.tag_links),
        topic: Number(row.topic_links),
      },
      linksByStrength: {
        strong: Number(row.strong_links),
        medium: Number(row.medium_links),
        weak: Number(row.weak_links),
      },
    };
  }

  /**
   * 发现书签关联（调用数据库函数）
   */
  async discoverLinks(
    userId: string,
    bookmarkId: number,
    options?: Record<string, unknown>,
  ): Promise<DiscoveredLink[]> {
    const { data, error } = await this.supabase.rpc("discover_bookmark_links", {
      p_user_id: userId,
      p_bookmark_id: bookmarkId,
      p_options: (options as unknown as Json) || {},
    });

    if (error) {
      throw new Error(`Failed to discover links: ${error.message}`);
    }

    return (data || []).map((row) => ({
      targetBookmarkId: row.related_bookmark_id,
      linkType: row.link_type as LinkType,
      strength: row.strength,
      evidence: this.parseEvidence(row.evidence),
      algorithm: `discover-${row.link_type}`,
    }));
  }

  /**
   * 获取书签详情（内部使用）
   */
  async getBookmarkById(bookmarkId: number): Promise<{
    id: number;
    userId: string;
    title: string;
    url: string;
    aiTags: string[];
    embedding: number[] | null;
  } | null> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, user_id, title, url, ai_tags, embedding")
      .eq("id", bookmarkId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      url: data.url,
      aiTags: data.ai_tags || [],
      embedding: (data.embedding as unknown as number[]) || null,
    };
  }

  /**
   * 获取书签的实体列表
   */
  async getBookmarkEntities(bookmarkId: number): Promise<string[]> {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data, error } = await this.supabase
      .from("bookmark_entities" as any)
      .select("name")
      .eq("bookmark_id", bookmarkId);
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (error) {
      logger.error({ error }, "Failed to get bookmark entities");
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => row.name);
  }
}

// ============================================================================
// Singleton
// ============================================================================

let linkRepositoryInstance: LinkRepository | null = null;

/**
 * 获取 LinkRepository
 * @param supabase 可选；在 API Route 等服务端场景传入服务端 createClient()，以携带当前用户 session，否则使用浏览器客户端（RLS 可能无用户导致查不到数据）
 */
export function getLinkRepository(
  supabase?: SupabaseClient<Database>,
): LinkRepository {
  if (supabase) {
    return new LinkRepository(supabase);
  }
  if (!linkRepositoryInstance) {
    linkRepositoryInstance = new LinkRepository();
  }
  return linkRepositoryInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetLinkRepository(): void {
  linkRepositoryInstance = null;
}
