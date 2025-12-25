/**
 * Smart Sorting Service (V4.2) - 协调器
 * 智能分拣服务 - AI 文件夹进化系统核心
 *
 * 核心功能：
 * - 处理缓存池中的待聚类书签
 * - DBSCAN 密度聚类分析
 * - AI 文件夹命名与重复检测
 * - 自动创建文件夹（Level 1）或生成建议（Level 2/3）
 *
 * @version 4.2.1
 * @since 2025-12-25 - Refactored into coordinator pattern
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { AIFolderSettings } from "@/types/supabase";

// Import from submodules
import type {
  PendingBookmark,
  Cluster,
  SortingResult,
  FolderSuggestion,
  SupabaseClientType,
} from "./smart-sorting/types";
import { CLUSTERING_CONFIG, DAILY_LIMIT } from "./smart-sorting/types";
import { performClustering } from "./smart-sorting/clustering";
import {
  generateClusterName,
  generateFallbackName,
} from "./smart-sorting/naming";
import {
  checkDuplicateFolder,
  autoCreateFolder,
  updateBookmarkClusters,
  createSuggestion,
  getClusterPreview,
  confirmCreate,
  rejectCreate,
} from "./smart-sorting/operations";

// Re-export for backward compatibility
export type { PendingBookmark, Cluster, SortingResult, FolderSuggestion };
export { CLUSTERING_CONFIG, DAILY_LIMIT };

// ============================================
// SmartSortingService 类
// ============================================

export class SmartSortingService {
  private supabase: SupabaseClientType | null = null;

  /**
   * 获取 Supabase 客户端（延迟初始化）
   */
  private async getSupabase(): Promise<SupabaseClientType> {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient();
    }
    return this.supabase;
  }

  /**
   * 处理用户的缓存池
   * 主入口函数，定时任务调用
   */
  async processInboxCache(userId: string): Promise<SortingResult> {
    const result: SortingResult = {
      processed: 0,
      clustered: 0,
      foldersCreated: 0,
      suggestionsCreated: 0,
      errors: [],
    };

    try {
      // 1. 获取用户设置
      const settings = await this.getUserSettings(userId);

      // 如果用户禁用了自动创建，跳过
      if (!settings.enable_auto_create) {
        logger.info(
          { userId },
          "SmartSorting: User disabled auto-create, skipping",
        );
        return result;
      }

      // 2. 检查今日创建额度
      const todayCreated = await this.getTodayFolderCount(userId);
      const dailyLimit = settings.daily_create_limit ?? DAILY_LIMIT;
      const remainingQuota = Math.min(
        dailyLimit - todayCreated,
        DAILY_LIMIT - todayCreated,
      );

      if (remainingQuota <= 0) {
        logger.info({ userId }, "SmartSorting: User reached daily limit");
        return result;
      }

      // 3. 获取待聚类书签
      const pendingBookmarks = await this.getPendingBookmarks(userId);
      result.processed = pendingBookmarks.length;

      if (pendingBookmarks.length < CLUSTERING_CONFIG.MIN_CLUSTER_SIZE) {
        logger.info(
          { count: pendingBookmarks.length },
          "SmartSorting: Not enough pending bookmarks",
        );
        return result;
      }

      // 4. 执行 DBSCAN 聚类（使用子模块）
      const clusters = performClustering(pendingBookmarks);
      result.clustered = clusters.reduce(
        (sum, c) => sum + c.bookmarks.length,
        0,
      );

      if (clusters.length === 0) {
        logger.info("SmartSorting: No valid clusters found");
        return result;
      }

      // 5. 为每个聚类生成文件夹名称
      for (const cluster of clusters) {
        try {
          const naming = await generateClusterName(cluster);
          cluster.suggestedName = naming.name;
          cluster.suggestedNameReason = naming.reason;
        } catch (namingError) {
          logger.error(
            { error: namingError },
            "SmartSorting: Failed to name cluster",
          );
          cluster.suggestedName = generateFallbackName(cluster);
          cluster.suggestedNameReason = "基于关键词自动生成";
        }
      }

      // 6. 根据托管等级处理
      const supabase = await this.getSupabase();
      const processedClusters = clusters.slice(0, remainingQuota);

      if (settings.autonomy_level === 1) {
        // Level 1: 全自动创建
        for (const cluster of processedClusters) {
          try {
            await autoCreateFolder(supabase, userId, cluster);
            result.foldersCreated++;
          } catch {
            result.errors.push(`创建文件夹失败: ${cluster.suggestedName}`);
          }
        }
      } else {
        // Level 2/3: 创建建议
        const autonomyLevel = settings.autonomy_level ?? 2;
        for (const cluster of processedClusters) {
          try {
            await createSuggestion(supabase, userId, cluster, autonomyLevel);
            result.suggestionsCreated++;
          } catch {
            result.errors.push(`创建建议失败: ${cluster.suggestedName}`);
          }
        }
      }

      // 7. 更新书签的聚类 ID
      await updateBookmarkClusters(supabase, clusters);

      logger.info({ userId, result }, "SmartSorting: User processed");
      return result;
    } catch (processError) {
      logger.error(
        { userId, error: processError },
        "SmartSorting: Error processing user",
      );
      result.errors.push(
        processError instanceof Error ? processError.message : "未知错误",
      );
      return result;
    }
  }

  // ============================================
  // 数据获取方法
  // ============================================

  /**
   * 获取用户 AI 文件夹设置
   */
  private async getUserSettings(userId: string): Promise<AIFolderSettings> {
    const supabase = await this.getSupabase();

    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single();

    const settings = profile?.settings as {
      ai_folder_settings?: AIFolderSettings;
    } | null;
    const aiSettings = settings?.ai_folder_settings;

    return {
      autonomy_level: aiSettings?.autonomy_level ?? 2,
      enable_auto_create: aiSettings?.enable_auto_create ?? true,
      enable_auto_split: aiSettings?.enable_auto_split ?? false,
      enable_auto_merge: aiSettings?.enable_auto_merge ?? false,
      enable_auto_rename: aiSettings?.enable_auto_rename ?? false,
      create_notification: aiSettings?.create_notification ?? true,
      report_interval: aiSettings?.report_interval ?? "monthly",
      daily_create_limit: aiSettings?.daily_create_limit ?? DAILY_LIMIT,
    };
  }

  /**
   * 获取今日已创建的文件夹数量
   */
  private async getTodayFolderCount(userId: string): Promise<number> {
    const supabase = await this.getSupabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("folders")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("source", "auto_created")
      .gte("created_at", today.toISOString());

    return count ?? 0;
  }

  /**
   * 获取待聚类书签
   */
  private async getPendingBookmarks(
    userId: string,
  ): Promise<PendingBookmark[]> {
    const supabase = await this.getSupabase();

    const cutoffTime = new Date();
    cutoffTime.setHours(
      cutoffTime.getHours() - CLUSTERING_CONFIG.MIN_WAIT_HOURS,
    );

    const { data, error } = await supabase
      .from("bookmarks")
      .select(
        "id, title, url, ai_summary, ai_tags, embedding, pending_since, cluster_id",
      )
      .eq("user_id", userId)
      .eq("pending_cluster", true)
      .is("deleted_at", null)
      .not("embedding", "is", null)
      .lt("pending_since", cutoffTime.toISOString())
      .order("pending_since", { ascending: true })
      .limit(CLUSTERING_CONFIG.MAX_BATCH_SIZE);

    if (error) {
      logger.error(
        { error: error.message },
        "[SmartSorting] Failed to get pending bookmarks",
      );
      return [];
    }

    return (data || []).filter(
      (b: { embedding?: unknown }) => b.embedding != null,
    ) as unknown as PendingBookmark[];
  }

  // ============================================
  // 公共 API（委托给子模块）
  // ============================================

  /**
   * DBSCAN 聚类算法
   */
  performClustering(bookmarks: PendingBookmark[]): Cluster[] {
    return performClustering(bookmarks);
  }

  /**
   * 检查重复文件夹
   */
  async checkDuplicateFolder(
    userId: string,
    folderName: string,
  ): Promise<boolean> {
    const supabase = await this.getSupabase();
    return checkDuplicateFolder(supabase, userId, folderName);
  }

  /**
   * 获取用户的聚类预览
   */
  async getClusterPreview(userId: string): Promise<FolderSuggestion[]> {
    const supabase = await this.getSupabase();
    return getClusterPreview(supabase, userId);
  }

  /**
   * 确认创建文件夹（用户批准建议）
   */
  async confirmCreate(
    userId: string,
    suggestionId: number,
    customName?: string,
  ): Promise<{ success: boolean; folderId?: number; error?: string }> {
    const supabase = await this.getSupabase();
    return confirmCreate(supabase, userId, suggestionId, customName);
  }

  /**
   * 拒绝创建建议
   */
  async rejectCreate(userId: string, suggestionId: number): Promise<boolean> {
    const supabase = await this.getSupabase();
    return rejectCreate(supabase, userId, suggestionId);
  }
}

// 导出单例
export const smartSortingService = new SmartSortingService();
