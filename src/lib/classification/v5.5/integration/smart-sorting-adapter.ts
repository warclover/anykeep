/**
 * V5.5 SmartSorting 适配器
 *
 * 确保 v5.5 晶体生长与现有 SmartSorting 协同工作：
 * - 排除已在 chaos_pool 中的书签
 * - 标记 SmartSorting 创建的文件夹
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { V55FeatureFlags } from "./v55-feature-flag";
import { logger } from "@/lib/logger";

export class SmartSortingAdapter {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 过滤 SmartSorting 应该处理的书签
   * 排除已在 chaos_pool 中的书签
   */
  async filterBookmarksForSmartSorting(
    userId: string,
    inboxBookmarks: { id: number }[],
  ): Promise<{ id: number }[]> {
    // v5.5 未启用时，返回全部书签
    if (!V55FeatureFlags.V55_ENABLED) {
      return inboxBookmarks;
    }

    // 用户不在灰度范围内，返回全部书签
    if (!V55FeatureFlags.isUserInRollout(userId)) {
      return inboxBookmarks;
    }

    try {
      const chaosPoolIds = await this.getChaosPoolBookmarkIds(userId);
      const chaosPoolSet = new Set(chaosPoolIds);

      const filtered = inboxBookmarks.filter((b) => !chaosPoolSet.has(b.id));

      logger.debug(
        {
          userId,
          totalBookmarks: inboxBookmarks.length,
          chaosPoolCount: chaosPoolIds.length,
          filteredCount: filtered.length,
        },
        "V5.5: Filtered bookmarks for SmartSorting",
      );

      return filtered;
    } catch (error) {
      logger.error(
        { userId, error },
        "V5.5: Failed to filter bookmarks, returning all",
      );
      return inboxBookmarks;
    }
  }

  /**
   * 获取混沌池中的书签 ID 列表
   */
  async getChaosPoolBookmarkIds(userId: string): Promise<number[]> {
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
  }

  /**
   * 标记 SmartSorting 创建的文件夹
   */
  async markSmartSortingFolder(folderId: number): Promise<void> {
    const { error } = await this.supabase
      .from("folders")
      .update({
        is_ai_generated: true,
        ai_generation_source: "SMART_SORTING",
      })
      .eq("id", folderId);

    if (error) {
      logger.error(
        { folderId, error },
        "V5.5: Failed to mark SmartSorting folder",
      );
    }
  }

  /**
   * 检查书签是否在混沌池中
   */
  async isInChaosPool(userId: string, bookmarkId: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("chaos_pool")
      .select("id")
      .eq("user_id", userId)
      .eq("bookmark_id", bookmarkId)
      .eq("crystal_processed", false)
      .maybeSingle();

    if (error) {
      logger.error(
        { userId, bookmarkId, error },
        "V5.5: Failed to check chaos pool",
      );
      return false;
    }

    return data !== null;
  }
}
