/**
 * 收件箱服务适配器
 *
 * 封装 API 调用逻辑，供 InboxTriageSkill 使用
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 未分类书签信息
 */
export interface UnclassifiedBookmark {
  id: number;
  title: string;
  url: string;
  platform?: string;
  tags?: string[];
  created_at: string;
}

/**
 * 整理建议项
 */
export interface OrganizationSuggestion {
  id: string;
  action: "move" | "tag" | "archive";
  bookmarkIds: number[];
  targetFolder?: { id: number; name: string };
  tags?: string[];
  reason: string;
  confidence: number;
}

/**
 * 收件箱分析结果
 */
export interface InboxAnalysis {
  unclassifiedBookmarks: UnclassifiedBookmark[];
  totalCount: number;
  platformDistribution: Record<string, number>;
}

// ============================================
// 适配器实现
// ============================================

/**
 * 收件箱服务适配器
 *
 * 封装收件箱相关的数据库操作和业务逻辑
 */
export class InboxServiceAdapter {
  /**
   * 获取未分类书签
   *
   * @param userId - 用户 ID
   * @param limit - 最大返回数量
   * @returns 未分类书签列表
   */
  async getUnclassifiedBookmarks(
    userId: string,
    limit: number = 100,
  ): Promise<InboxAnalysis> {
    try {
      const supabase = await createClient();

      const { data: unclassified, error } = await supabase
        .from("bookmarks")
        .select("id, title, url, platform, user_tags, created_at")
        .eq("user_id", userId)
        .is("folder_id", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        logger.error(
          { error, userId },
          "InboxAdapter: Failed to get unclassified bookmarks",
        );
        return {
          unclassifiedBookmarks: [],
          totalCount: 0,
          platformDistribution: {},
        };
      }

      const bookmarks = (unclassified || []) as UnclassifiedBookmark[];

      // 计算平台分布
      const platformDistribution: Record<string, number> = {};
      for (const bookmark of bookmarks) {
        const platform = bookmark.platform || "other";
        platformDistribution[platform] =
          (platformDistribution[platform] || 0) + 1;
      }

      return {
        unclassifiedBookmarks: bookmarks,
        totalCount: bookmarks.length,
        platformDistribution,
      };
    } catch (error) {
      logger.error(
        { error, userId },
        "InboxAdapter: Error getting unclassified bookmarks",
      );
      return {
        unclassifiedBookmarks: [],
        totalCount: 0,
        platformDistribution: {},
      };
    }
  }

  /**
   * 获取用户文件夹列表
   *
   * @param userId - 用户 ID
   * @returns 文件夹列表
   */
  async getUserFolders(
    userId: string,
  ): Promise<Array<{ id: number; name: string }>> {
    try {
      const supabase = await createClient();

      const { data: folders, error } = await supabase
        .from("folders")
        .select("id, name")
        .eq("user_id", userId)
        .order("name");

      if (error) {
        logger.error(
          { error, userId },
          "InboxAdapter: Failed to get user folders",
        );
        return [];
      }

      return folders || [];
    } catch (error) {
      logger.error({ error, userId }, "InboxAdapter: Error getting folders");
      return [];
    }
  }

  /**
   * 移动书签到文件夹
   *
   * @param userId - 用户 ID
   * @param bookmarkIds - 书签 ID 列表
   * @param folderId - 目标文件夹 ID
   * @returns 是否成功
   */
  async moveBookmarksToFolder(
    userId: string,
    bookmarkIds: number[],
    folderId: number,
  ): Promise<boolean> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from("bookmarks")
        .update({ folder_id: folderId, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .in("id", bookmarkIds);

      if (error) {
        logger.error(
          { error, userId, bookmarkIds, folderId },
          "InboxAdapter: Failed to move bookmarks",
        );
        return false;
      }

      logger.info(
        { userId, count: bookmarkIds.length, folderId },
        "InboxAdapter: Bookmarks moved successfully",
      );
      return true;
    } catch (error) {
      logger.error(
        { error, userId, bookmarkIds, folderId },
        "InboxAdapter: Error moving bookmarks",
      );
      return false;
    }
  }

  /**
   * 批量添加标签
   *
   * @param userId - 用户 ID
   * @param bookmarkIds - 书签 ID 列表
   * @param tags - 标签列表
   * @returns 是否成功
   */
  async addTagsToBookmarks(
    userId: string,
    bookmarkIds: number[],
    tags: string[],
  ): Promise<boolean> {
    try {
      const supabase = await createClient();

      // 获取现有书签及其标签
      const { data: bookmarks, error: fetchError } = await supabase
        .from("bookmarks")
        .select("id, user_tags")
        .eq("user_id", userId)
        .in("id", bookmarkIds);

      if (fetchError) {
        logger.error(
          { error: fetchError, userId },
          "InboxAdapter: Failed to fetch bookmarks for tagging",
        );
        return false;
      }

      // 批量更新每个书签的标签
      const updates = (bookmarks || []).map((bookmark) => {
        const existingTags = (bookmark.user_tags as string[]) || [];
        const newTags = [...new Set([...existingTags, ...tags])];
        return supabase
          .from("bookmarks")
          .update({ user_tags: newTags, updated_at: new Date().toISOString() })
          .eq("id", bookmark.id)
          .eq("user_id", userId);
      });

      await Promise.all(updates);

      logger.info(
        { userId, count: bookmarkIds.length, tags },
        "InboxAdapter: Tags added successfully",
      );
      return true;
    } catch (error) {
      logger.error(
        { error, userId, bookmarkIds, tags },
        "InboxAdapter: Error adding tags",
      );
      return false;
    }
  }
}

// ============================================
// 单例导出
// ============================================

let inboxServiceAdapter: InboxServiceAdapter | null = null;

/**
 * 获取收件箱服务适配器单例
 */
export function getInboxServiceAdapter(): InboxServiceAdapter {
  if (!inboxServiceAdapter) {
    inboxServiceAdapter = new InboxServiceAdapter();
  }
  return inboxServiceAdapter;
}
