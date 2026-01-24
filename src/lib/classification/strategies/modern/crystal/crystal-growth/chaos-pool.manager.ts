/**
 * V5.5 混沌池管理器
 *
 * 管理未分类书签的混沌池：
 * - 添加书签到混沌池
 * - 标记已处理
 * - 查询邻居书签
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { ChaosPoolEntry } from "./types";

export class ChaosPoolManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 添加书签到混沌池
   */
  async add(userId: string, bookmarkId: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc("add_to_chaos_pool", {
        p_user_id: userId,
        p_bookmark_id: bookmarkId,
      });

      if (error) {
        logger.error(
          { userId, bookmarkId, error },
          "V5.5: Failed to add to chaos pool",
        );
        return false;
      }

      logger.debug({ userId, bookmarkId }, "V5.5: Added to chaos pool");
      return data ?? false;
    } catch (error) {
      logger.error(
        { userId, bookmarkId, error },
        "V5.5: Exception adding to chaos pool",
      );
      return false;
    }
  }

  /**
   * 批量��记混沌池记录已处理
   */
  async markProcessed(
    userId: string,
    bookmarkIds: number[],
    resultFolderId: number,
  ): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc(
        "mark_chaos_pool_processed",
        {
          p_user_id: userId,
          p_bookmark_ids: bookmarkIds,
          p_result_folder_id: resultFolderId,
        },
      );

      if (error) {
        logger.error(
          { userId, bookmarkIds, error },
          "V5.5: Failed to mark processed",
        );
        return 0;
      }

      logger.info(
        {
          userId,
          bookmarkIds,
          resultFolderId,
          count: data,
        },
        "V5.5: Marked chaos pool entries as processed",
      );

      return data ?? 0;
    } catch (error) {
      logger.error(
        { userId, bookmarkIds, error },
        "V5.5: Exception marking processed",
      );
      return 0;
    }
  }

  /**
   * 获取用户混沌池中的书签 ID 列表
   */
  async getBookmarkIds(userId: string): Promise<number[]> {
    try {
      const { data, error } = await this.supabase.rpc(
        "get_chaos_pool_bookmark_ids",
        {
          p_user_id: userId,
        },
      );

      if (error) {
        logger.error(
          { userId, error },
          "V5.5: Failed to get chaos pool bookmark IDs",
        );
        return [];
      }

      return data ?? [];
    } catch (error) {
      logger.error(
        { userId, error },
        "V5.5: Exception getting chaos pool bookmark IDs",
      );
      return [];
    }
  }

  /**
   * 获取混沌池记录详情
   */
  async getEntry(
    userId: string,
    bookmarkId: number,
  ): Promise<ChaosPoolEntry | null> {
    try {
      const { data, error } = await this.supabase
        .from("chaos_pool")
        .select("*")
        .eq("user_id", userId)
        .eq("bookmark_id", bookmarkId)
        .maybeSingle();

      if (error) {
        logger.error(
          { userId, bookmarkId, error },
          "V5.5: Failed to get chaos pool entry",
        );
        return null;
      }

      return data as ChaosPoolEntry | null;
    } catch (error) {
      logger.error(
        { userId, bookmarkId, error },
        "V5.5: Exception getting chaos pool entry",
      );
      return null;
    }
  }

  /**
   * 获取未处理的混沌池记录数量
   */
  async getUnprocessedCount(userId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from("chaos_pool")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("crystal_processed", false);

      if (error) {
        logger.error(
          { userId, error },
          "V5.5: Failed to get unprocessed count",
        );
        return 0;
      }

      return count ?? 0;
    } catch (error) {
      logger.error(
        { userId, error },
        "V5.5: Exception getting unprocessed count",
      );
      return 0;
    }
  }

  /**
   * 从混沌池中移除书签
   */
  async remove(userId: string, bookmarkId: number): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("chaos_pool")
        .delete()
        .eq("user_id", userId)
        .eq("bookmark_id", bookmarkId);

      if (error) {
        logger.error(
          { userId, bookmarkId, error },
          "V5.5: Failed to remove from chaos pool",
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error(
        { userId, bookmarkId, error },
        "V5.5: Exception removing from chaos pool",
      );
      return false;
    }
  }
}
