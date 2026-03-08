/**
 * Entity Repository
 *
 * 实体数据访问层，管理 bookmark_entities 表的 CRUD 操作
 *
 * @version 3.0.0
 * @since 2025-12-14
 */

import { logger } from "@/lib/logger";
// V4.2.5: 修复 - 使用服务端客户端而非浏览器客户端
import { createClient } from "@/lib/supabase/server";
import type { Entity, EntityType } from "@/lib/classification/types/ai-summary";
import type { RpcResult } from "@/lib/supabase/typed-queries";

/**
 * bookmark_entities 表及其 RPC 函数不在 Supabase 生成类型中，
 * 使用以下辅助函数集中处理类型断言。
 */

type SupabaseInstance = Awaited<ReturnType<typeof createClient>>;

/** 内部 RPC 调用辅助（bookmark_entities 相关 RPC） */
function callEntityRpc<T>(
  supabase: SupabaseInstance,
  name: string,
  params: Record<string, unknown>,
): Promise<RpcResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bookmark_entities RPC 不在 Supabase 生成类型中
  return (supabase.rpc as any)(name, params) as Promise<RpcResult<T>>;
}

/** 查询 bookmark_entities 表的辅助函数 */
function fromBookmarkEntities(supabase: SupabaseInstance) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bookmark_entities 表不在 Supabase 生成类型中
  return (supabase as any).from("bookmark_entities");
}

/**
 * 实体存储数据
 */
export interface EntityRecord {
  id: string;
  bookmark_id: number;
  user_id: string;
  name: string;
  type: EntityType;
  normalized_name: string;
  confidence: number;
  created_at: string;
}

/**
 * 共享实体的书签结果
 */
export interface SharedEntityBookmark {
  bookmark_id: number;
  shared_entities: string[];
  shared_count: number;
}

/**
 * Entity Repository 实现
 *
 * @example
 * ```typescript
 * const repo = new EntityRepository();
 *
 * // 保存实体
 * await repo.saveEntities(123, 'user-uuid', entities);
 *
 * // 获取书签实体
 * const entities = await repo.getBookmarkEntities(123);
 *
 * // 查找共享实体的书签
 * const related = await repo.findBookmarksBySharedEntities(
 *   'user-uuid',
 *   ['React', 'TypeScript'],
 *   123
 * );
 * ```
 */
export class EntityRepository {
  /**
   * 保存书签实体（替换现有实体）
   *
   * @param bookmarkId - 书签 ID
   * @param userId - 用户 ID
   * @param entities - 实体列表
   * @returns 保存的实体数量
   */
  async saveEntities(
    bookmarkId: number,
    userId: string,
    entities: Entity[],
  ): Promise<number> {
    if (!entities || entities.length === 0) {
      return 0;
    }

    try {
      const supabase = await createClient();

      // 使用数据库函数批量保存（会自动替换现有实体）
      const { data, error } = await callEntityRpc<number>(
        supabase,
        "save_bookmark_entities",
        {
          p_bookmark_id: bookmarkId,
          p_user_id: userId,
          p_entities: entities.map((e) => ({
            name: e.name,
            type: e.type,
            confidence: e.confidence ?? 1.0,
          })),
        },
      );

      if (error) {
        logger.error(
          {
            bookmarkId,
            userId,
            error: error.message,
          },
          "EntityRepository: Failed to save entities",
        );
        throw new Error(`保存实体失败: ${error.message}`);
      }

      logger.info(
        {
          bookmarkId,
          userId,
          count: data,
        },
        "EntityRepository: Entities saved successfully",
      );

      return data as number;
    } catch (err) {
      logger.error(
        {
          bookmarkId,
          userId,
          error: err instanceof Error ? err.message : String(err),
        },
        "EntityRepository: Error saving entities",
      );
      throw err;
    }
  }

  /**
   * 获取书签的实体列表
   *
   * @param bookmarkId - 书签 ID
   * @returns 实体列表
   */
  async getBookmarkEntities(bookmarkId: number): Promise<Entity[]> {
    try {
      const supabase = await createClient();

      const { data, error } = await callEntityRpc<
        Array<{ name: string; type: string; confidence: number }>
      >(supabase, "get_bookmark_entities", {
        p_bookmark_id: bookmarkId,
      });

      if (error) {
        logger.error(
          {
            bookmarkId,
            error: error.message,
          },
          "EntityRepository: Failed to get entities",
        );
        throw new Error(`获取实体失败: ${error.message}`);
      }

      if (!data || !Array.isArray(data)) {
        return [];
      }

      return data.map(
        (row: { name: string; type: string; confidence: number }) => ({
          name: row.name,
          type: row.type as EntityType,
          confidence: row.confidence,
        }),
      );
    } catch (err) {
      logger.error(
        {
          bookmarkId,
          error: err instanceof Error ? err.message : String(err),
        },
        "EntityRepository: Error getting entities",
      );
      throw err;
    }
  }

  /**
   * 删除书签的所有实体
   *
   * @param bookmarkId - 书签 ID
   */
  async deleteBookmarkEntities(bookmarkId: number): Promise<void> {
    try {
      const supabase = await createClient();

      const table = await fromBookmarkEntities(supabase);
      const { error } = await table.delete().eq("bookmark_id", bookmarkId);

      if (error) {
        logger.error(
          {
            bookmarkId,
            error: error.message,
          },
          "EntityRepository: Failed to delete entities",
        );
        throw new Error(`删除实体失败: ${error.message}`);
      }

      logger.info(
        { bookmarkId },
        "EntityRepository: Entities deleted successfully",
      );
    } catch (err) {
      logger.error(
        {
          bookmarkId,
          error: err instanceof Error ? err.message : String(err),
        },
        "EntityRepository: Error deleting entities",
      );
      throw err;
    }
  }

  /**
   * 查找共享实体的书签
   *
   * 用于知识关联：找到与当前书签有相同实体的其他书签
   *
   * @param userId - 用户 ID
   * @param entityNames - 实体名称列表
   * @param excludeBookmarkId - 排除的书签 ID（通常是当前书签）
   * @param minShared - 最少共享实体数
   * @param limit - 返回数量限制
   * @returns 共享实体的书签列表
   */
  async findBookmarksBySharedEntities(
    userId: string,
    entityNames: string[],
    excludeBookmarkId?: number,
    minShared: number = 1,
    limit: number = 20,
  ): Promise<SharedEntityBookmark[]> {
    if (!entityNames || entityNames.length === 0) {
      return [];
    }

    try {
      const supabase = await createClient();

      const { data, error } = await callEntityRpc<
        Array<{
          bookmark_id: number;
          shared_entities: string[];
          shared_count: number;
        }>
      >(supabase, "find_bookmarks_by_shared_entities", {
        p_user_id: userId,
        p_entity_names: entityNames,
        p_exclude_bookmark_id: excludeBookmarkId ?? null,
        p_min_shared: minShared,
        p_limit: limit,
      });

      if (error) {
        logger.error(
          {
            userId,
            entityCount: entityNames.length,
            error: error.message,
          },
          "EntityRepository: Failed to find bookmarks by shared entities",
        );
        throw new Error(`查找共享实体书签失败: ${error.message}`);
      }

      if (!data || !Array.isArray(data)) {
        return [];
      }

      return data.map(
        (row: {
          bookmark_id: number;
          shared_entities: string[];
          shared_count: number;
        }) => ({
          bookmark_id: row.bookmark_id,
          shared_entities: row.shared_entities,
          shared_count: row.shared_count,
        }),
      );
    } catch (err) {
      logger.error(
        {
          userId,
          entityCount: entityNames.length,
          error: err instanceof Error ? err.message : String(err),
        },
        "EntityRepository: Error finding bookmarks by shared entities",
      );
      throw err;
    }
  }

  /**
   * 获取用户的实体统计
   *
   * @param userId - 用户 ID
   * @returns 实体类型统计
   */
  async getEntityStats(userId: string): Promise<Record<EntityType, number>> {
    try {
      const supabase = await createClient();

      const table = await fromBookmarkEntities(supabase);
      const { data, error } = await table.select("type").eq("user_id", userId);

      if (error) {
        logger.error(
          {
            userId,
            error: error.message,
          },
          "EntityRepository: Failed to get entity stats",
        );
        throw new Error(`获取实体统计失败: ${error.message}`);
      }

      const stats: Record<EntityType, number> = {
        person: 0,
        company: 0,
        tech: 0,
        concept: 0,
        product: 0,
        place: 0,
        other: 0,
      };

      if (data) {
        for (const row of data as Array<{ type: string }>) {
          const type = row.type as EntityType;
          if (type in stats) {
            stats[type]++;
          }
        }
      }

      return stats;
    } catch (err) {
      logger.error(
        {
          userId,
          error: err instanceof Error ? err.message : String(err),
        },
        "EntityRepository: Error getting entity stats",
      );
      throw err;
    }
  }

  /**
   * 获取热门实体（用于标签云等）
   *
   * @param userId - 用户 ID
   * @param limit - 返回数量限制
   * @returns 热门实体列表
   */
  async getTopEntities(
    userId: string,
    limit: number = 20,
  ): Promise<Array<{ name: string; type: EntityType; count: number }>> {
    try {
      const supabase = await createClient();

      const table = await fromBookmarkEntities(supabase);
      const { data, error } = await table
        .select("name, type, normalized_name")
        .eq("user_id", userId);

      if (error) {
        logger.error(
          {
            userId,
            error: error.message,
          },
          "EntityRepository: Failed to get top entities",
        );
        throw new Error(`获取热门实体失败: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // 在内存中聚合（小数据量下可接受）
      const countMap = new Map<
        string,
        { name: string; type: EntityType; count: number }
      >();

      type EntityRow = { name: string; type: string; normalized_name: string };
      for (const row of data as EntityRow[]) {
        const key = row.normalized_name;
        const existing = countMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          countMap.set(key, {
            name: row.name,
            type: row.type as EntityType,
            count: 1,
          });
        }
      }

      // 排序并取前 N 个
      return Array.from(countMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (err) {
      logger.error(
        {
          userId,
          error: err instanceof Error ? err.message : String(err),
        },
        "EntityRepository: Error getting top entities",
      );
      throw err;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let repositoryInstance: EntityRepository | null = null;

/**
 * 获取 EntityRepository 单例
 */
export function getEntityRepository(): EntityRepository {
  if (!repositoryInstance) {
    repositoryInstance = new EntityRepository();
  }
  return repositoryInstance;
}

/**
 * 重置 EntityRepository 单例（主要用于测试）
 */
export function resetEntityRepository(): void {
  repositoryInstance = null;
}
