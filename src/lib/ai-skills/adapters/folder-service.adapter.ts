/**
 * 文件夹服务适配器
 *
 * 封装 folder-recommender.ts 的函数调用
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { createClient } from "@/lib/supabase/server";
import {
  recommendFolder,
  generateFallbackFolderRecommendation,
} from "@/lib/ai-generator/folder/folder-recommender";
import type {
  FolderRecommendation,
  ExistingFolder,
} from "@/lib/ai-generator/types";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 文件夹统计信息
 */
export interface FolderStats {
  id: number;
  name: string;
  bookmarkCount: number;
  topTags: string[];
}

/**
 * 带匹配计数的文件夹推荐
 */
export interface FolderRecommendationWithCount extends FolderRecommendation {
  matchingBookmarkCount: number;
}

/**
 * 批量推荐结果
 */
export interface BatchRecommendationResult {
  recommendations: FolderRecommendationWithCount[];
  analyzedBookmarkCount: number;
  currentFolderCount: number;
  unclassifiedCount: number;
}

// ============================================
// 适配器实现
// ============================================

/**
 * 文件夹服务适配器
 *
 * 封装文件夹推荐相关的数据库操作和业务逻辑
 */
export class FolderServiceAdapter {
  /**
   * 获取用户所有文件夹及统计信息
   *
   * @param userId - 用户 ID
   * @returns 文件夹列表及统计
   */
  async getUserFolders(userId: string): Promise<ExistingFolder[]> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("folders")
        .select(
          `
          id,
          name,
          bookmarks:bookmarks(count)
        `,
        )
        .eq("user_id", userId)
        .order("name");

      if (error) {
        logger.error({ error, userId }, "FolderAdapter: Failed to get folders");
        return [];
      }

      return (data || []).map((f) => ({
        id: f.id,
        name: f.name,
        bookmarkCount:
          (f.bookmarks as unknown as { count: number }[])?.[0]?.count || 0,
        topTags: [], // 可扩展：获取常用标签
      }));
    } catch (error) {
      logger.error({ error, userId }, "FolderAdapter: Error getting folders");
      return [];
    }
  }

  /**
   * 获取文件夹详细统计信息
   *
   * @param userId - 用户 ID
   * @returns 文件夹统计列表
   */
  async getFolderStats(userId: string): Promise<FolderStats[]> {
    try {
      const supabase = await createClient();

      // 获取所有文件夹及其书签数
      const { data: folders, error: folderError } = await supabase
        .from("folders")
        .select(
          `
          id,
          name,
          bookmarks:bookmarks(count)
        `,
        )
        .eq("user_id", userId)
        .order("name");

      if (folderError) {
        logger.error(
          { error: folderError, userId },
          "FolderAdapter: Failed to get folder stats",
        );
        return [];
      }

      // 获取每个文件夹的常用标签
      const stats: FolderStats[] = [];

      for (const folder of folders || []) {
        // 获取该文件夹下书签的标签分布
        const { data: bookmarks } = await supabase
          .from("bookmarks")
          .select("user_tags")
          .eq("user_id", userId)
          .eq("folder_id", folder.id)
          .limit(50);

        // 统计标签频次
        const tagCounts: Record<string, number> = {};
        for (const bookmark of bookmarks || []) {
          const tags = (bookmark.user_tags as string[]) || [];
          for (const tag of tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }

        // 获取 top 5 标签
        const topTags = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag]) => tag);

        stats.push({
          id: folder.id,
          name: folder.name,
          bookmarkCount:
            (folder.bookmarks as unknown as { count: number }[])?.[0]?.count ||
            0,
          topTags,
        });
      }

      return stats;
    } catch (error) {
      logger.error(
        { error, userId },
        "FolderAdapter: Error getting folder stats",
      );
      return [];
    }
  }

  /**
   * 基于书签内容推荐文件夹
   *
   * @param title - 书签标题
   * @param summary - 书签摘要
   * @param tags - 书签标签
   * @param userId - 用户 ID
   * @returns 文件夹推荐结果
   */
  async recommendForBookmark(
    title: string,
    summary: string,
    tags: string[],
    userId: string,
  ): Promise<FolderRecommendation> {
    const existingFolders = await this.getUserFolders(userId);

    if (existingFolders.length === 0) {
      return generateFallbackFolderRecommendation(title, tags, []);
    }

    return recommendFolder(title, summary, tags, existingFolders);
  }

  /**
   * 分析未分类书签的主题分布，生成文件夹推荐
   *
   * @param userId - 用户 ID
   * @param maxRecommendations - 最大推荐数量
   * @returns 批量推荐结果
   */
  async analyzeAndRecommend(
    userId: string,
    maxRecommendations: number = 5,
  ): Promise<BatchRecommendationResult> {
    try {
      const supabase = await createClient();

      // 获取未分类书签
      const { data: unclassified, count: unclassifiedCount } = await supabase
        .from("bookmarks")
        .select("id, title, ai_summary, user_tags", { count: "exact" })
        .eq("user_id", userId)
        .is("folder_id", null)
        .limit(50);

      if (!unclassified || unclassified.length === 0) {
        const folders = await this.getUserFolders(userId);
        return {
          recommendations: [],
          analyzedBookmarkCount: 0,
          currentFolderCount: folders.length,
          unclassifiedCount: 0,
        };
      }

      const existingFolders = await this.getUserFolders(userId);
      // 使用 Map 跟踪每个推荐的匹配书签数
      const recommendationMap = new Map<
        string,
        FolderRecommendationWithCount
      >();

      for (const bookmark of unclassified) {
        const rec = await recommendFolder(
          bookmark.title || "",
          bookmark.ai_summary || "",
          (bookmark.user_tags as string[]) || [],
          existingFolders,
        );

        // 只考虑置信度 >= 60 的推荐
        if (rec.confidence < 60) continue;

        // 生成唯一 key
        const key = rec.suggestNew
          ? `new:${rec.folderName}`
          : `existing:${rec.folderId}`;

        // 累计匹配计数
        if (recommendationMap.has(key)) {
          const existing = recommendationMap.get(key);
          if (existing) {
            existing.matchingBookmarkCount += 1;
            // 保留最高置信度
            if (rec.confidence > existing.confidence) {
              existing.confidence = rec.confidence;
              existing.reason = rec.reason;
            }
          }
        } else {
          recommendationMap.set(key, {
            ...rec,
            matchingBookmarkCount: 1,
          });
        }
      }

      // 转换为数组，按匹配数量和置信度排序，限制数量
      const recommendations = Array.from(recommendationMap.values())
        .sort((a, b) => {
          // 优先按匹配数量排序
          if (b.matchingBookmarkCount !== a.matchingBookmarkCount) {
            return b.matchingBookmarkCount - a.matchingBookmarkCount;
          }
          // 其次按置信度排序
          return b.confidence - a.confidence;
        })
        .slice(0, maxRecommendations);

      return {
        recommendations,
        analyzedBookmarkCount: unclassified.length,
        currentFolderCount: existingFolders.length,
        unclassifiedCount: unclassifiedCount || 0,
      };
    } catch (error) {
      logger.error(
        { error, userId },
        "FolderAdapter: Error analyzing and recommending",
      );
      return {
        recommendations: [],
        analyzedBookmarkCount: 0,
        currentFolderCount: 0,
        unclassifiedCount: 0,
      };
    }
  }

  /**
   * 创建新文件夹
   *
   * @param userId - 用户 ID
   * @param name - 文件夹名称
   * @param parentId - 父文件夹 ID（可选）
   * @returns 创建的文件夹 ID，失败返回 null
   */
  async createFolder(
    userId: string,
    name: string,
    parentId?: number,
  ): Promise<number | null> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("folders")
        .insert({
          user_id: userId,
          name,
          parent_id: parentId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) {
        logger.error(
          { error, userId, name },
          "FolderAdapter: Failed to create folder",
        );
        return null;
      }

      logger.info(
        { userId, folderId: data.id, name },
        "FolderAdapter: Folder created",
      );
      return data.id;
    } catch (error) {
      logger.error(
        { error, userId, name },
        "FolderAdapter: Error creating folder",
      );
      return null;
    }
  }
}

// ============================================
// 单例导出
// ============================================

let folderServiceAdapter: FolderServiceAdapter | null = null;

/**
 * 获取文件夹服务适配器单例
 */
export function getFolderServiceAdapter(): FolderServiceAdapter {
  if (!folderServiceAdapter) {
    folderServiceAdapter = new FolderServiceAdapter();
  }
  return folderServiceAdapter;
}
