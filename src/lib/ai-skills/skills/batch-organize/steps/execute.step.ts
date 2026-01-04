/**
 * 自动执行步骤
 *
 * 职责：
 * - 执行分类建议
 * - 执行标签建议
 * - 执行重复清理
 * - 执行归档操作
 *
 * @module ai-skills/skills/batch-organize/steps/execute
 * @version 1.0.0
 * @since 2025-12-25
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  CategorizeSuggestion,
  TagSuggestion,
  DuplicateGroup,
  ArchiveCandidate,
} from "../types";
import type { ExecutionResult } from "./types";

// ============================================
// 分类建议执行
// ============================================

/**
 * 执行分类建议 - 批量移动书签到建议的文件夹
 */
export async function executeCategorizeSuggestions(
  userId: string,
  suggestions: CategorizeSuggestion[],
): Promise<ExecutionResult> {
  const supabase = await createClient();
  let success = 0;
  let failed = 0;

  // 只处理有 suggestedFolderId 的建议
  const validSuggestions = suggestions.filter((s) => s.suggestedFolderId);

  if (validSuggestions.length === 0) {
    return { success: 0, failed: 0 };
  }

  // 按目标文件夹分组，批量更新
  const folderGroups = new Map<number, number[]>();
  for (const suggestion of validSuggestions) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const folderId = suggestion.suggestedFolderId!;
    const bookmarkIds = folderGroups.get(folderId) || [];
    bookmarkIds.push(suggestion.bookmarkId);
    folderGroups.set(folderId, bookmarkIds);
  }

  // 批量执行移动操作
  for (const [folderId, bookmarkIds] of folderGroups) {
    const { data, error } = await supabase
      .from("bookmarks")
      .update({
        folder_id: folderId,
        updated_at: new Date().toISOString(),
      })
      .in("id", bookmarkIds)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("id");

    if (error) {
      logger.error(
        { error, folderId, bookmarkIds },
        "BatchOrganize: Failed to move bookmarks",
      );
      failed += bookmarkIds.length;
    } else {
      success += data?.length || 0;
      failed += bookmarkIds.length - (data?.length || 0);
    }
  }

  logger.info(
    { success, failed, totalSuggestions: validSuggestions.length },
    "BatchOrganize: Categorize suggestions executed",
  );

  return { success, failed };
}

// ============================================
// 标签建议执行
// ============================================

/**
 * 执行标签建议 - 批量为书签添加建议的标签
 */
export async function executeTagSuggestions(
  _userId: string,
  suggestions: TagSuggestion[],
): Promise<ExecutionResult> {
  const supabase = await createClient();
  let success = 0;
  let failed = 0;

  if (suggestions.length === 0) {
    return { success: 0, failed: 0 };
  }

  // 按书签逐个处理（因为每个书签的建议标签不同）
  for (const suggestion of suggestions) {
    if (suggestion.suggestedTags.length === 0) continue;

    try {
      const { data, error } = await supabase.rpc("batch_add_tags", {
        p_bookmark_ids: [suggestion.bookmarkId],
        p_tags: suggestion.suggestedTags,
      });

      if (error) {
        logger.error(
          { error, bookmarkId: suggestion.bookmarkId },
          "BatchOrganize: Failed to add tags",
        );
        failed++;
      } else if (
        (data as { affected_count?: number })?.affected_count ??
        0 > 0
      ) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      logger.error(
        { error, bookmarkId: suggestion.bookmarkId },
        "BatchOrganize: Failed to add tags (exception)",
      );
      failed++;
    }
  }

  logger.info(
    { success, failed, totalSuggestions: suggestions.length },
    "BatchOrganize: Tag suggestions executed",
  );

  return { success, failed };
}

// ============================================
// 重复清理执行
// ============================================

/**
 * 执行重复清理 - 软删除重复书签（保留 keepBookmarkId）
 */
export async function executeDuplicateCleanup(
  userId: string,
  duplicateGroups: DuplicateGroup[],
): Promise<ExecutionResult> {
  const supabase = await createClient();
  let success = 0;
  let failed = 0;

  if (duplicateGroups.length === 0) {
    return { success: 0, failed: 0 };
  }

  // 收集所有需要删除的书签 ID
  const idsToDelete: number[] = [];
  for (const group of duplicateGroups) {
    // 删除除 keepBookmarkId 之外的所有书签
    for (const bookmark of group.bookmarks) {
      if (bookmark.id !== group.keepBookmarkId) {
        idsToDelete.push(bookmark.id);
      }
    }
  }

  if (idsToDelete.length === 0) {
    return { success: 0, failed: 0 };
  }

  // 软删除（设置 deleted_at）
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("bookmarks")
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .in("id", idsToDelete)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    logger.error(
      { error, idsToDelete },
      "BatchOrganize: Failed to delete duplicates",
    );
    failed = idsToDelete.length;
  } else {
    success = data?.length || 0;
    failed = idsToDelete.length - success;
  }

  logger.info(
    { success, failed, totalDuplicates: idsToDelete.length },
    "BatchOrganize: Duplicate cleanup executed",
  );

  return { success, failed };
}

// ============================================
// 归档执行
// ============================================

/**
 * 执行归档 - 移动书签到「归档」文件夹
 */
export async function executeArchive(
  userId: string,
  candidates: ArchiveCandidate[],
): Promise<ExecutionResult> {
  const supabase = await createClient();

  if (candidates.length === 0) {
    return { success: 0, failed: 0 };
  }

  // 获取或创建「归档」文件夹
  const archiveFolderId = await getOrCreateArchiveFolder(userId);

  if (!archiveFolderId) {
    logger.error(
      { userId },
      "BatchOrganize: Failed to get/create archive folder",
    );
    return { success: 0, failed: candidates.length };
  }

  // 批量移动书签
  const bookmarkIds = candidates.map((c) => c.bookmarkId);

  const { data, error } = await supabase
    .from("bookmarks")
    .update({
      folder_id: archiveFolderId,
      updated_at: new Date().toISOString(),
    })
    .in("id", bookmarkIds)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    logger.error(
      { error, bookmarkIds },
      "BatchOrganize: Failed to archive bookmarks",
    );
    return { success: 0, failed: bookmarkIds.length };
  }

  const success = data?.length || 0;
  const failed = bookmarkIds.length - success;

  logger.info(
    { success, failed, archiveFolderId },
    "BatchOrganize: Archive executed",
  );

  return { success, failed };
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取或创建「归档」文件夹
 */
async function getOrCreateArchiveFolder(
  userId: string,
): Promise<number | null> {
  const supabase = await createClient();
  const ARCHIVE_FOLDER_NAME = "归档";

  // 先查找是否已存在
  const { data: existingFolder } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("name", ARCHIVE_FOLDER_NAME)
    .is("deleted_at", null)
    .single();

  if (existingFolder) {
    return existingFolder.id;
  }

  // 不存在则创建
  const { data: newFolder, error } = await supabase
    .from("folders")
    .insert({
      user_id: userId,
      name: ARCHIVE_FOLDER_NAME,
      icon: "📦",
      color: "#6B7280", // 灰色
      is_archived: false, // 归档文件夹本身不归档
    })
    .select("id")
    .single();

  if (error) {
    logger.error({ error }, "BatchOrganize: Failed to create archive folder");
    return null;
  }

  return newFolder?.id || null;
}
