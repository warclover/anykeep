/**
 * Entity Matcher Service
 *
 * 实体匹配关联发现服务
 * 基于共享实体查找相关书签
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiscoveredLink } from "../types/link.types";

// ============================================================================
// Types
// ============================================================================

export interface EntityMatchConfig {
  /** 最小共享实体数量 */
  minShared: number;

  /** 最大返回数量 */
  limit: number;
}

export interface EntityMatch {
  bookmarkId: number;
  sharedEntities: string[];
  sharedCount: number;
}

// ============================================================================
// Service Interface
// ============================================================================

export interface IEntityMatcherService {
  /**
   * 查找共享实体的书签
   */
  findBySharedEntities(
    userId: string,
    entityNames: string[],
    excludeBookmarkId: number,
    config?: Partial<EntityMatchConfig>,
  ): Promise<DiscoveredLink[]>;

  /**
   * 获取两个书签的共享实体
   */
  getSharedEntities(
    bookmarkId1: number,
    bookmarkId2: number,
  ): Promise<string[]>;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * 实体匹配服务
 */
export class EntityMatcherService implements IEntityMatcherService {
  private defaultConfig: EntityMatchConfig = {
    minShared: 1,
    limit: 10,
  };

  constructor(private supabase: SupabaseClient = createClient()) {}

  /**
   * 查找共享实体的书签
   */
  async findBySharedEntities(
    userId: string,
    entityNames: string[],
    excludeBookmarkId: number,
    config?: Partial<EntityMatchConfig>,
  ): Promise<DiscoveredLink[]> {
    if (!entityNames || entityNames.length === 0) {
      return [];
    }

    const mergedConfig = { ...this.defaultConfig, ...config };

    try {
      // 调用数据库函数查找共享实体的书签
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (this.supabase.rpc as any)(
        "find_bookmarks_by_shared_entities",
        {
          p_user_id: userId,
          p_entity_names: entityNames,
          p_exclude_bookmark_id: excludeBookmarkId,
          p_min_shared: mergedConfig.minShared,
          p_limit: mergedConfig.limit,
        },
      );

      if (error) {
        console.error("Failed to find bookmarks by entities:", error);
        return [];
      }

      // 映射结果
      return (data || []).map(
        (row: {
          bookmark_id: number;
          shared_entities: string[];
          shared_count: number;
        }) => ({
          targetBookmarkId: row.bookmark_id,
          linkType: "entity" as const,
          // 强度计算：共享实体数 / 3，最大为 1
          strength: Math.min(row.shared_count / 3, 1),
          evidence: {
            type: "entity" as const,
            score: row.shared_count / Math.max(entityNames.length, 1),
            details: {
              sharedEntities: row.shared_entities,
            },
          },
          algorithm: "entity-matching",
        }),
      );
    } catch (error) {
      console.error("Error in findBySharedEntities:", error);
      return [];
    }
  }

  /**
   * 获取两个书签的共享实体
   */
  async getSharedEntities(
    bookmarkId1: number,
    bookmarkId2: number,
  ): Promise<string[]> {
    try {
      // 获取两个书签的实体
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: entities1, error: error1 } = await (this.supabase as any)
        .from("bookmark_entities")
        .select("normalized_name")
        .eq("bookmark_id", bookmarkId1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: entities2, error: error2 } = await (this.supabase as any)
        .from("bookmark_entities")
        .select("normalized_name")
        .eq("bookmark_id", bookmarkId2);

      if (error1 || error2) {
        return [];
      }

      // 计算交集
      const set1 = new Set(
        (entities1 || []).map(
          (e: { normalized_name: string }) => e.normalized_name,
        ),
      );
      const shared: string[] = [];

      for (const entity of entities2 || []) {
        if (set1.has(entity.normalized_name)) {
          shared.push(entity.normalized_name);
        }
      }

      return shared;
    } catch (error) {
      console.error("Error getting shared entities:", error);
      return [];
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let entityMatcherInstance: EntityMatcherService | null = null;

/**
 * 获取 EntityMatcherService 单例
 */
export function getEntityMatcherService(): EntityMatcherService {
  if (!entityMatcherInstance) {
    entityMatcherInstance = new EntityMatcherService();
  }
  return entityMatcherInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetEntityMatcherService(): void {
  entityMatcherInstance = null;
}
