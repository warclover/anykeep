/**
 * Rename Service (V4.2)
 * 文件夹重命名服务 - AI 建议更合适的文件夹名称
 *
 * 核心功能：
 * - 分析文件夹内容生成命名建议
 * - 检测命名与内容不匹配的文件夹
 * - 支持 Level 2 (需确认) 和 Level 3 (自动) 模式
 *
 * @module folder-evolution/rename
 * @since 2026-03-11 - 从 classification-v1 独立迁移
 */

import { createClient } from "@/lib/supabase/server";
import { operationLogService } from "@/lib/operation-log";
import { generateFolderNameFromBookmarks } from "@/lib/ai-generator";
import { logger } from "@/lib/logger";

// ============================================
// Type Definitions
// ============================================

/**
 * Folder with bookmarks for analysis
 */
interface FolderForRename {
  id: number;
  name: string;
  user_id: string;
  bookmarks: Array<{
    id: number;
    title: string;
    ai_summary: string | null;
    ai_tags: string[] | null;
  }>;
}

/**
 * Rename suggestion
 */
export interface RenameSuggestion {
  folderId: number;
  currentName: string;
  suggestedName: string;
  confidence: number;
  reason: string;
  sampleTitles: string[];
  commonTags: string[];
}

/**
 * Rename result
 */
export interface RenameResult {
  success: boolean;
  message: string;
  oldName?: string;
  newName?: string;
  snapshotId?: string;
}

// ============================================
// Service Implementation
// ============================================

class RenameService {
  private readonly LOG_PREFIX = "[RenameService]";

  /**
   * 分析文件夹并生成重命名建议
   */
  async analyzeFolder(
    userId: string,
    folderId: number,
  ): Promise<RenameSuggestion | null> {
    try {
      const supabase = await createClient();

      // 获取文件夹信息和书签
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, name, user_id")
        .eq("id", folderId)
        .eq("user_id", userId)
        .single();

      if (folderError || !folder) {
        logger.warn(`${this.LOG_PREFIX} Folder not found: ${folderId}`);
        return null;
      }

      // 获取文件夹内的书签
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from("bookmarks")
        .select("id, title, ai_summary, ai_tags")
        .eq("folder_id", folderId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(50);

      if (bookmarksError || !bookmarks || bookmarks.length < 3) {
        logger.info(
          `${this.LOG_PREFIX} Not enough bookmarks for rename analysis: ${bookmarks?.length || 0}`,
        );
        return null;
      }

      // 分析内容生成建议名称
      const suggestion = await this.generateRenameSuggestion({
        id: folder.id,
        name: folder.name,
        user_id: folder.user_id,
        bookmarks,
      });

      return suggestion;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        `${this.LOG_PREFIX} analyzeFolder error`,
      );
      return null;
    }
  }

  /**
   * 批量分析用户的所有文件夹
   */
  async analyzeAllFolders(
    userId: string,
    options: { minBookmarks?: number; limit?: number } = {},
  ): Promise<RenameSuggestion[]> {
    const { minBookmarks = 5, limit = 10 } = options;

    try {
      const supabase = await createClient();

      // 获取用户的非系统文件夹
      const { data: folders, error: foldersError } = await supabase
        .from("folders")
        .select("id, name, user_id")
        .eq("user_id", userId)
        .eq("is_system", false)
        .is("deleted_at", null);

      if (foldersError || !folders) {
        logger.error(`${this.LOG_PREFIX} Failed to fetch folders`);
        return [];
      }

      const suggestions: RenameSuggestion[] = [];

      for (const folder of folders) {
        if (suggestions.length >= limit) break;

        // 获取书签数量
        const { count } = await supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("folder_id", folder.id)
          .eq("user_id", userId)
          .is("deleted_at", null);

        if ((count || 0) < minBookmarks) continue;

        // 分析单个文件夹
        const suggestion = await this.analyzeFolder(userId, folder.id);
        if (suggestion && suggestion.confidence >= 70) {
          suggestions.push(suggestion);
        }
      }

      // 按置信度排序
      return suggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        `${this.LOG_PREFIX} analyzeAllFolders error`,
      );
      return [];
    }
  }

  /**
   * 执行重命名操作
   */
  async executeRename(
    userId: string,
    folderId: number,
    newName: string,
  ): Promise<RenameResult> {
    try {
      const supabase = await createClient();

      // 获取当前文件夹信息
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, name, user_id")
        .eq("id", folderId)
        .eq("user_id", userId)
        .single();

      if (folderError || !folder) {
        return {
          success: false,
          message: "文件夹不存在或无权访问",
        };
      }

      const oldName = folder.name;

      // 检查新名称是否与旧名称相同
      if (oldName === newName) {
        return {
          success: false,
          message: "新名称与当前名称相同",
        };
      }

      // 检查是否存在同名文件夹
      const { data: existing } = await supabase
        .from("folders")
        .select("id")
        .eq("user_id", userId)
        .eq("name", newName)
        .is("deleted_at", null)
        .neq("id", folderId)
        .single();

      if (existing) {
        return {
          success: false,
          message: `已存在名为「${newName}」的文件夹`,
        };
      }

      // 执行重命名
      const { error: updateError } = await supabase
        .from("folders")
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq("id", folderId)
        .eq("user_id", userId);

      if (updateError) {
        logger.error(
          { error: updateError.message },
          `${this.LOG_PREFIX} Update error`,
        );
        return {
          success: false,
          message: "重命名失败",
        };
      }

      // 记录操作快照
      let snapshotId: string | undefined;
      try {
        const snapshot = await operationLogService.createSnapshot(
          userId,
          "rename",
          { folder: { id: folderId, name: oldName } },
          {
            folder: { id: folderId, name: newName },
            old_name: oldName,
            new_name: newName,
          },
          { folderId, reason: `AI 建议将「${oldName}」重命名为「${newName}」` },
        );
        snapshotId = snapshot?.id != null ? String(snapshot.id) : undefined;
      } catch (snapshotErr) {
        logger.warn(
          {
            error:
              snapshotErr instanceof Error
                ? snapshotErr.message
                : String(snapshotErr),
          },
          `${this.LOG_PREFIX} Snapshot creation warning`,
        );
      }

      logger.info(
        `${this.LOG_PREFIX} Folder renamed: ${oldName} -> ${newName}`,
      );

      return {
        success: true,
        message: `已将「${oldName}」重命名为「${newName}」`,
        oldName,
        newName,
        snapshotId,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        `${this.LOG_PREFIX} executeRename error`,
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : "重命名失败",
      };
    }
  }

  /**
   * 生成重命名建议
   */
  private async generateRenameSuggestion(
    folder: FolderForRename,
  ): Promise<RenameSuggestion | null> {
    try {
      const { bookmarks, name: currentName } = folder;

      // 收集所有标签
      const tagCounts = new Map<string, number>();
      const allTags: string[] = [];
      for (const bookmark of bookmarks) {
        for (const tag of bookmark.ai_tags || []) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          if (!allTags.includes(tag)) allTags.push(tag);
        }
      }

      // 找出高频标签
      const threshold = bookmarks.length * 0.3;
      const commonTags = Array.from(tagCounts.entries())
        .filter(([, count]) => count >= threshold)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      // 使用 AI 生成建议名称
      const result = await generateFolderNameFromBookmarks({
        titles: bookmarks.slice(0, 20).map((b) => b.title),
        tags: allTags.slice(0, 20),
        summaries: bookmarks
          .slice(0, 10)
          .map((b) => b.ai_summary)
          .filter((s): s is string => !!s),
        count: bookmarks.length,
      });

      if (!result || !result.name) {
        return null;
      }

      const suggestedName = result.name;

      // 计算置信度
      const confidence = this.calculateRenameConfidence(
        currentName,
        suggestedName,
        commonTags,
        bookmarks.length,
      );

      // 如果建议名称与当前名称相似度高，不建议重命名
      if (this.areNamesSimilar(currentName, suggestedName)) {
        return null;
      }

      // 生成建议原因
      const reason =
        result.reason ||
        this.generateReason(currentName, suggestedName, commonTags);

      return {
        folderId: folder.id,
        currentName,
        suggestedName,
        confidence,
        reason,
        sampleTitles: bookmarks.slice(0, 3).map((b) => b.title),
        commonTags,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        `${this.LOG_PREFIX} generateRenameSuggestion error`,
      );
      return null;
    }
  }

  /**
   * 计算重命名置信度
   */
  private calculateRenameConfidence(
    currentName: string,
    suggestedName: string,
    commonTags: string[],
    bookmarkCount: number,
  ): number {
    let confidence = 50;

    // 标签与建议名称匹配度
    const nameInTags = commonTags.some(
      (tag) =>
        suggestedName.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(suggestedName.toLowerCase()),
    );
    if (nameInTags) confidence += 20;

    // 书签数量因素
    if (bookmarkCount >= 10) confidence += 10;
    if (bookmarkCount >= 20) confidence += 10;

    // 当前名称是否过于通用
    const genericNames = [
      "新文件夹",
      "未命名",
      "其他",
      "杂项",
      "临时",
      "待整理",
    ];
    if (genericNames.some((g) => currentName.includes(g))) {
      confidence += 15;
    }

    return Math.min(100, confidence);
  }

  /**
   * 检查两个名称是否相似
   */
  private areNamesSimilar(name1: string, name2: string): boolean {
    const n1 = name1.toLowerCase().replace(/\s+/g, "");
    const n2 = name2.toLowerCase().replace(/\s+/g, "");

    // 完全相同
    if (n1 === n2) return true;

    // 包含关系
    if (n1.includes(n2) || n2.includes(n1)) return true;

    // 简单的编辑距离检查
    const longer = n1.length > n2.length ? n1 : n2;
    const shorter = n1.length > n2.length ? n2 : n1;
    const similarity = shorter.length / longer.length;

    return similarity > 0.8;
  }

  /**
   * 生成建议原因
   */
  private generateReason(
    currentName: string,
    suggestedName: string,
    commonTags: string[],
  ): string {
    const reasons: string[] = [];

    // 检查当前名称问题
    const genericNames = [
      "新文件夹",
      "未命名",
      "其他",
      "杂项",
      "临时",
      "待整理",
    ];
    if (genericNames.some((g) => currentName.includes(g))) {
      reasons.push("当前名称过于通用");
    }

    // 标签相关性
    if (commonTags.length > 0) {
      reasons.push(`内容主要涉及「${commonTags.slice(0, 2).join("」「")}」`);
    }

    // 建议名称优势
    reasons.push(`「${suggestedName}」更能反映文件夹内容`);

    return reasons.join("，");
  }
}

// 导出单例
export const renameService = new RenameService();
