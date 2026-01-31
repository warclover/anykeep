/**
 * 过期内容检测器
 *
 * 检测长期未访问的书签内容
 *
 * @module health-check/detectors/stale-detector
 * @version 1.0.0
 * @since 2026-01-31
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { StaleContentItem, HealthIssueSeverity } from "../types";
import { HEALTH_CHECK_CONFIG } from "../types";

// ============================================
// 类型定义
// ============================================

interface StaleDetectorOptions {
  thresholdDays?: number;
  limit?: number;
  folderId?: string;
  bookmarkIds?: string[];
}

interface StaleBookmarkRow {
  bookmark_id: string;
  title: string;
  url: string;
  folder_id: string | null;
  last_accessed_at: string | null;
  created_at: string;
  days_since_access: number;
  access_count: number;
}

// ============================================
// 过期内容检测器
// ============================================

export class StaleContentDetector {
  /**
   * 检测过期内容
   */
  async detect(
    userId: string,
    options: StaleDetectorOptions = {},
  ): Promise<StaleContentItem[]> {
    const {
      thresholdDays = HEALTH_CHECK_CONFIG.STALE_THRESHOLDS.EXPIRED,
      limit = HEALTH_CHECK_CONFIG.MAX_CHECK_LIMIT,
      folderId,
      bookmarkIds,
    } = options;

    try {
      const supabase = await createClient();

      // 使用 RPC 函数获取过期书签
      const { data, error } = await supabase.rpc("get_stale_bookmarks", {
        p_user_id: userId,
        p_days_threshold: thresholdDays,
        p_limit: limit,
      });

      if (error) {
        logger.error(
          { error: error.message, userId },
          "StaleContentDetector: Failed to fetch stale bookmarks",
        );
        throw new Error(`获取过期书签失败: ${error.message}`);
      }

      let staleBookmarks = (data || []) as StaleBookmarkRow[];

      // 如果指定了文件夹，过滤结果
      if (folderId) {
        staleBookmarks = staleBookmarks.filter((b) => b.folder_id === folderId);
      }

      // 如果指定了书签ID列表，过滤结果
      if (bookmarkIds?.length) {
        const idSet = new Set(bookmarkIds);
        staleBookmarks = staleBookmarks.filter((b) => idSet.has(b.bookmark_id));
      }

      // 获取文件夹名称
      const folderIds = [
        ...new Set(
          staleBookmarks
            .map((b) => b.folder_id)
            .filter((id): id is string => id !== null),
        ),
      ];

      const folderNames = await this.getFolderNames(folderIds);

      // 转换为 StaleContentItem
      return staleBookmarks.map((row) => ({
        bookmarkId: row.bookmark_id,
        title: row.title,
        url: row.url,
        folderId: row.folder_id || undefined,
        folderName: row.folder_id ? folderNames.get(row.folder_id) : undefined,
        lastAccessedAt: row.last_accessed_at,
        createdAt: row.created_at,
        daysSinceAccess: row.days_since_access,
        accessCount: row.access_count,
        severity: this.calculateSeverity(row.days_since_access),
      }));
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
        },
        "StaleContentDetector: Detection failed",
      );
      throw error;
    }
  }

  /**
   * 快速检测（仅返回数量）
   */
  async countStale(
    userId: string,
    thresholdDays: number = HEALTH_CHECK_CONFIG.STALE_THRESHOLDS.EXPIRED,
  ): Promise<number> {
    try {
      const supabase = await createClient();

      const { count, error } = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null)
        .or(
          `last_accessed_at.is.null,last_accessed_at.lt.${this.getThresholdDate(thresholdDays)}`,
        );

      if (error) {
        throw new Error(`统计过期书签失败: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
        },
        "StaleContentDetector: Count failed",
      );
      return 0;
    }
  }

  /**
   * 按严重程度分组统计
   */
  async getStatsBySeverity(
    userId: string,
  ): Promise<Record<HealthIssueSeverity, number>> {
    const stats: Record<HealthIssueSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
    };

    try {
      const supabase = await createClient();
      const now = new Date();

      // 获取各阈值的日期
      const warningDate = new Date(now);
      warningDate.setDate(
        warningDate.getDate() - HEALTH_CHECK_CONFIG.STALE_THRESHOLDS.WARNING,
      );

      const staleDate = new Date(now);
      staleDate.setDate(
        staleDate.getDate() - HEALTH_CHECK_CONFIG.STALE_THRESHOLDS.STALE,
      );

      const expiredDate = new Date(now);
      expiredDate.setDate(
        expiredDate.getDate() - HEALTH_CHECK_CONFIG.STALE_THRESHOLDS.EXPIRED,
      );

      // 查询 low (30-60天)
      const { count: lowCount } = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null)
        .or(
          `and(last_accessed_at.gte.${staleDate.toISOString()},last_accessed_at.lt.${warningDate.toISOString()}),and(last_accessed_at.is.null,created_at.gte.${staleDate.toISOString()},created_at.lt.${warningDate.toISOString()})`,
        );

      // 查询 medium (60-90天)
      const { count: mediumCount } = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null)
        .or(
          `and(last_accessed_at.gte.${expiredDate.toISOString()},last_accessed_at.lt.${staleDate.toISOString()}),and(last_accessed_at.is.null,created_at.gte.${expiredDate.toISOString()},created_at.lt.${staleDate.toISOString()})`,
        );

      // 查询 high (>90天)
      const { count: highCount } = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null)
        .or(
          `last_accessed_at.lt.${expiredDate.toISOString()},and(last_accessed_at.is.null,created_at.lt.${expiredDate.toISOString()})`,
        );

      stats.low = lowCount || 0;
      stats.medium = mediumCount || 0;
      stats.high = highCount || 0;

      return stats;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
        },
        "StaleContentDetector: Stats by severity failed",
      );
      return stats;
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 计算严重程度
   */
  private calculateSeverity(daysSinceAccess: number): HealthIssueSeverity {
    if (daysSinceAccess >= HEALTH_CHECK_CONFIG.STALE_THRESHOLDS.EXPIRED) {
      return "high";
    }
    if (daysSinceAccess >= HEALTH_CHECK_CONFIG.STALE_THRESHOLDS.STALE) {
      return "medium";
    }
    return "low";
  }

  /**
   * 获取阈值日期
   */
  private getThresholdDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  /**
   * 批量获取文件夹名称
   */
  private async getFolderNames(
    folderIds: string[],
  ): Promise<Map<string, string>> {
    const folderNames = new Map<string, string>();

    if (folderIds.length === 0) {
      return folderNames;
    }

    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("folders")
        .select("id, name")
        .in("id", folderIds);

      if (error) {
        logger.warn(
          { error: error.message },
          "StaleContentDetector: Failed to fetch folder names",
        );
        return folderNames;
      }

      for (const folder of data || []) {
        folderNames.set(folder.id, folder.name);
      }

      return folderNames;
    } catch {
      return folderNames;
    }
  }
}

// 导出单例
export const staleContentDetector = new StaleContentDetector();
