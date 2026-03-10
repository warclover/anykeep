/**
 * 文件夹标签画像生成器服务
 *
 * 负责为用户文件夹生成和更新标签画像，用于 AI 标签匹配
 *
 * @module @/lib/classification/v5/classification-pipeline/folder-tag-profiler.service
 * @version 1.0.0
 * @since 2026-01-23
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";

const logger = createLogger("folder-tag-profiler");

/**
 * 文件夹标签画像数据
 */
interface ProfileData {
  coreTags: string[];
  relatedTags: string[];
  tagFrequency: Record<string, number>;
  folderNameTokens: string[];
  bookmarkCount: number;
}

/**
 * 文件夹标签画像生成器服务
 */
export class FolderTagProfilerService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 为用户所有文件夹生成/更新标签画像
   */
  async updateAllProfiles(userId: string): Promise<void> {
    logger.info({ userId }, "开始更新用户所有文件夹标签画像");

    const folders = await this.getUserFolders(userId);
    if (folders.length === 0) {
      logger.debug({ userId }, "用户无文件夹，跳过画像更新");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const folder of folders) {
      try {
        await this.updateFolderProfile(userId, folder.id, folder.name);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error({ error, folderId: folder.id }, "更新文件夹画像失败");
      }
    }

    logger.info(
      {
        userId,
        total: folders.length,
        success: successCount,
        error: errorCount,
      },
      "完成用户文件夹标签画像更新",
    );
  }

  /**
   * 获取用户所有文件夹
   */
  private async getUserFolders(
    userId: string,
  ): Promise<Array<{ id: number; name: string }>> {
    const { data, error } = await this.supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId);

    if (error) {
      logger.error({ error, userId }, "获取用户文件夹失败");
      return [];
    }

    return data || [];
  }

  /**
   * 更新单个文件夹的标签画像
   */
  async updateFolderProfile(
    userId: string,
    folderId: number,
    folderName: string,
  ): Promise<void> {
    // 1. 获取文件夹内所有书签的标签
    const { data: bookmarks } = await this.supabase
      .from("bookmarks")
      .select("ai_tags")
      .eq("user_id", userId)
      .eq("folder_id", folderId)
      .not("ai_tags", "is", null);

    if (!bookmarks || bookmarks.length === 0) {
      // 空文件夹：使用文件夹名分词作为核心标签
      await this.upsertProfile(userId, folderId, {
        coreTags: this.tokenizeFolderName(folderName),
        relatedTags: [],
        tagFrequency: {},
        folderNameTokens: this.tokenizeFolderName(folderName),
        bookmarkCount: 0,
      });
      logger.debug(
        { folderId, folderName },
        "空文件夹，使用文件夹名分词作为核心标签",
      );
      return;
    }

    // 2. 统计标签频率
    const tagFrequency: Record<string, number> = {};
    for (const bookmark of bookmarks) {
      for (const tag of bookmark.ai_tags || []) {
        const normalizedTag = tag.toLowerCase().trim();
        tagFrequency[normalizedTag] = (tagFrequency[normalizedTag] || 0) + 1;
      }
    }

    // 3. 按频率排序，分为核心标签和相关标签
    const totalBookmarks = bookmarks.length;
    const sortedTags = Object.entries(tagFrequency).sort((a, b) => b[1] - a[1]);

    const coreTags: string[] = [];
    const relatedTags: string[] = [];

    for (const [tag, count] of sortedTags) {
      const frequency = count / totalBookmarks;
      if (frequency >= 0.3) {
        coreTags.push(tag);
      } else if (frequency >= 0.1) {
        relatedTags.push(tag);
      }
    }

    // 4. 将文件夹名分词加入核心标签（确保匹配）
    const folderTokens = this.tokenizeFolderName(folderName);
    for (const token of folderTokens) {
      if (!coreTags.includes(token)) {
        coreTags.unshift(token); // 添加到最前面
      }
    }

    // 5. 更新数据库
    await this.upsertProfile(userId, folderId, {
      coreTags: coreTags.slice(0, 20), // 最多 20 个核心标签
      relatedTags: relatedTags.slice(0, 30), // 最多 30 个相关标签
      tagFrequency,
      folderNameTokens: folderTokens,
      bookmarkCount: bookmarks.length,
    });

    logger.debug(
      {
        folderId,
        folderName,
        coreTagCount: coreTags.length,
        relatedTagCount: relatedTags.length,
        bookmarkCount: bookmarks.length,
      },
      "已更新文件夹标签画像",
    );
  }

  /**
   * 插入或更新文件夹标签画像
   */
  private async upsertProfile(
    userId: string,
    folderId: number,
    data: ProfileData,
  ): Promise<void> {
    const { error } = await this.supabase.from("folder_tag_profiles").upsert(
      {
        user_id: userId,
        folder_id: folderId,
        core_tags: data.coreTags,
        related_tags: data.relatedTags,
        tag_frequency: data.tagFrequency,
        folder_name_tokens: data.folderNameTokens,
        bookmark_count: data.bookmarkCount,
        last_updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,folder_id",
      },
    );

    if (error) {
      logger.error({ error, folderId }, "更新文件夹标签画像失败");
      throw error;
    }
  }

  /**
   * 删除文件夹的标签画像
   */
  async deleteFolderProfile(userId: string, folderId: number): Promise<void> {
    const { error } = await this.supabase
      .from("folder_tag_profiles")
      .delete()
      .eq("user_id", userId)
      .eq("folder_id", folderId);

    if (error) {
      logger.error({ error, folderId }, "删除文件夹标签画像失败");
      throw error;
    }

    logger.debug({ folderId }, "已删除文件夹标签画像");
  }

  /**
   * 文件夹名分词
   * "独立开发与产品策略" → ["独立开发与产品策略", "独立开发", "产品策略"]
   */
  private tokenizeFolderName(name: string): string[] {
    const tokens: string[] = [name.toLowerCase()];

    // 按常见分隔符拆分
    const separators = ["与", "和", "/", "|", "-", "_", "·", "&", "、"];
    for (const sep of separators) {
      if (name.includes(sep)) {
        tokens.push(...name.split(sep).map((t) => t.trim().toLowerCase()));
      }
    }

    return [...new Set(tokens)].filter((t) => t.length >= 2);
  }
}
