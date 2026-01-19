/**
 * 智能分类 v5.0 - Shadow Sorting 服务
 *
 * 影子分拣功能（Inbox Zero 模式）：
 * - 建议分类路径但不立即移动书签
 * - 用户可批量确认或拒绝建议
 * - 支持待处理列表查询
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { LoggerService } from "../shared/logger";
import type {
  ShadowBookmark,
  ShadowSortingStats,
  BatchOperationResult,
} from "./types";

export class ShadowSortingService {
  private supabase: SupabaseClient<Database>;
  private logger: LoggerService;

  constructor(supabase: SupabaseClient<Database>, logger: LoggerService) {
    this.supabase = supabase;
    this.logger = logger.child({ service: "ShadowSortingService" });
  }

  /**
   * 设置影子分拣建议
   */
  async suggestShadowFolder(
    bookmarkId: number,
    folderId: number,
    folderName: string,
    confidence: number,
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("bookmarks")
        .update({
          shadow_folder_id: folderId,
          shadow_folder_name: folderName,
          shadow_confidence: confidence / 100,
          shadow_suggested_at: new Date().toISOString(),
        })
        .eq("id", bookmarkId);

      if (error) {
        throw new Error(`Failed to set shadow suggestion: ${error.message}`);
      }

      this.logger.debug("Shadow suggestion set", {
        bookmarkId,
        folderId,
        confidence,
      });
    } catch (error) {
      this.logger.error("Failed to set shadow suggestion", {
        error: error instanceof Error ? error.message : String(error),
        bookmarkId,
      });
      throw error;
    }
  }

  /**
   * 获取待处理的影子分拣列表
   */
  async getPendingList(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<ShadowBookmark[]> {
    try {
      const { data, error } = await this.supabase
        .from("bookmarks")
        .select(
          `
          id,
          title,
          url,
          shadow_folder_id,
          shadow_folder_name,
          shadow_confidence,
          shadow_suggested_at,
          folder_id,
          folders:folder_id (name)
        `,
        )
        .eq("user_id", userId)
        .not("shadow_folder_id", "is", null)
        .order("shadow_suggested_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get pending list: ${error.message}`);
      }

      return (data || []).map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        shadowFolderId: item.shadow_folder_id ?? 0,
        shadowFolderName: item.shadow_folder_name ?? "",
        shadowConfidence: (item.shadow_confidence ?? 0) * 100,
        shadowSuggestedAt: item.shadow_suggested_at ?? new Date().toISOString(),
        currentFolderId: item.folder_id,
        currentFolderName:
          (item.folders as { name: string } | null)?.name || null,
      }));
    } catch (error) {
      this.logger.error("Failed to get pending list", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * 获取影子分拣统计
   */
  async getStats(userId: string): Promise<ShadowSortingStats> {
    try {
      const { data, error } = await this.supabase
        .from("bookmarks")
        .select("shadow_confidence, shadow_suggested_at")
        .eq("user_id", userId)
        .not("shadow_folder_id", "is", null);

      if (error) {
        throw new Error(`Failed to get stats: ${error.message}`);
      }

      const totalPending = data?.length || 0;
      const avgConfidence =
        totalPending > 0 && data
          ? (data.reduce(
              (sum, item) => sum + (item.shadow_confidence || 0),
              0,
            ) /
              totalPending) *
            100
          : 0;

      const oldestSuggestion =
        totalPending > 0 && data
          ? data.sort(
              (a, b) =>
                new Date(a.shadow_suggested_at ?? "").getTime() -
                new Date(b.shadow_suggested_at ?? "").getTime(),
            )[0].shadow_suggested_at
          : null;

      return {
        totalPending,
        avgConfidence: Math.round(avgConfidence),
        oldestSuggestion,
      };
    } catch (error) {
      this.logger.error("Failed to get stats", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * 批量确认影子分拣
   */
  async batchConfirm(
    userId: string,
    bookmarkIds: number[],
  ): Promise<BatchOperationResult[]> {
    try {
      this.logger.info("Batch confirming shadow suggestions", {
        userId,
        count: bookmarkIds.length,
      });

      const { data, error } = await this.supabase.rpc(
        "shadow_sorting_batch_confirm",
        {
          p_bookmark_ids: bookmarkIds,
        },
      );

      if (error) {
        throw new Error(`Failed to batch confirm: ${error.message}`);
      }

      return (data || []).map(
        (item: {
          bookmark_id: number;
          success: boolean;
          error_message: string | null;
        }) => ({
          bookmarkId: item.bookmark_id,
          success: item.success,
          errorMessage: item.error_message,
        }),
      );
    } catch (error) {
      this.logger.error("Failed to batch confirm", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * 批量拒绝影子分拣
   */
  async batchReject(
    userId: string,
    bookmarkIds: number[],
  ): Promise<BatchOperationResult[]> {
    try {
      this.logger.info("Batch rejecting shadow suggestions", {
        userId,
        count: bookmarkIds.length,
      });

      const { data, error } = await this.supabase.rpc(
        "shadow_sorting_batch_reject",
        {
          p_bookmark_ids: bookmarkIds,
        },
      );

      if (error) {
        throw new Error(`Failed to batch reject: ${error.message}`);
      }

      return (data || []).map(
        (item: {
          bookmark_id: number;
          success: boolean;
          error_message: string | null;
        }) => ({
          bookmarkId: item.bookmark_id,
          success: item.success,
          errorMessage: item.error_message,
        }),
      );
    } catch (error) {
      this.logger.error("Failed to batch reject", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }
}
