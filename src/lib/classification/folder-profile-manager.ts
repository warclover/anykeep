/**
 * 文件夹 Profile 管理器
 *
 * 处理分类后的文件夹 Profile 更新，包括：
 * - 分类后更新目标文件夹 Profile
 * - 书签移动/删除后批量更新相关文件夹
 * - 新建文件夹时初始化名称嵌入
 *
 * @module classification/folder-profile-manager
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";

// ============================================
// 单文件夹 Profile 更新
// ============================================

/**
 * 分类后更新文件夹 Profile
 * 在书签被分类到某个文件夹后调用
 */
export async function updateFolderProfileAfterClassification(
  folderId: number,
  userId: string,
): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Call the SQL function to compute folder profile
    // Note: compute_folder_profile is defined in migration but not yet in generated types
    // Using type assertion as a workaround until types are regenerated
    const { error } = await (supabase.rpc as CallableFunction)(
      "compute_folder_profile",
      { p_folder_id: folderId },
    );

    if (error) {
      logger.error(
        { error, folderId, userId },
        "FolderProfileManager: Failed to update folder profile",
      );
    } else {
      logger.info(
        { folderId, userId },
        "FolderProfileManager: Folder profile updated",
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        folderId,
        userId,
      },
      "FolderProfileManager: Exception updating folder profile",
    );
  }
}

// ============================================
// 批量 Profile 更新
// ============================================

/**
 * 书签变更时更新相关文件夹的 Profile
 * 处理源文件夹和目标文件夹的 Profile 更新
 *
 * @param fromFolderIds - 源文件夹 ID 列表（书签移出的文件夹）
 * @param toFolderId - 目标文件夹 ID（书签移入的文件夹，null 表示收件箱）
 * @param userId - 用户 ID
 */
export async function updateFolderProfilesOnBookmarkChange(
  fromFolderIds: (number | null)[],
  toFolderId: number | null,
  userId: string,
): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Collect all unique folder IDs that need updating
    const folderIdsToUpdate = new Set<number>();

    // Add source folders (filter out null)
    for (const folderId of fromFolderIds) {
      if (folderId !== null) {
        folderIdsToUpdate.add(folderId);
      }
    }

    // Add target folder
    if (toFolderId !== null) {
      folderIdsToUpdate.add(toFolderId);
    }

    if (folderIdsToUpdate.size === 0) {
      logger.debug({ userId }, "FolderProfileManager: No folders to update");
      return;
    }

    // Update all affected folder profiles
    const updatePromises = Array.from(folderIdsToUpdate).map(
      async (folderId) => {
        try {
          const { error } = await (supabase.rpc as CallableFunction)(
            "compute_folder_profile",
            { p_folder_id: folderId },
          );

          if (error) {
            logger.error(
              { error, folderId, userId },
              "FolderProfileManager: Failed to update folder profile",
            );
          } else {
            logger.debug(
              { folderId, userId },
              "FolderProfileManager: Folder profile updated",
            );
          }
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              folderId,
            },
            "FolderProfileManager: Exception",
          );
        }
      },
    );

    await Promise.allSettled(updatePromises);

    logger.info(
      { folderCount: folderIdsToUpdate.size, userId },
      "FolderProfileManager: All folder profiles updated",
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        userId,
      },
      "FolderProfileManager: Batch update failed",
    );
  }
}

// ============================================
// 文件夹名称 Profile 初始化
// ============================================

/**
 * 初始化或更新文件夹名称 Profile
 * 在文件夹创建或重命名时调用
 *
 * 解决"冷启动"问题：
 * - 新文件夹没有书签，无法生成基于内容的 Profile
 * - 但文件夹名称本身具有语义含义
 * - 通过为文件夹名称生成嵌入向量，分类系统可以在添加书签之前就进行匹配
 *
 * @param folderId - 文件夹 ID
 * @param folderName - 文件夹名称（用于生成嵌入）
 * @param userId - 用户 ID
 */
export async function initializeFolderNameProfile(
  folderId: number,
  folderName: string,
  userId: string,
): Promise<void> {
  try {
    // V1.1: Generate smart tags for better cold-start matching
    const { generateFolderTags } = await import(
      "@/lib/classification/utils/folder-tag-generator"
    );
    const smartTags = generateFolderTags(folderName);

    logger.info(
      { folderId, folderName, tags: smartTags.slice(0, 5), totalTags: smartTags.length },
      "FolderProfileManager: Generated smart tags",
    );

    // Generate embedding for folder name
    const { generateEmbedding } = await import(
      "@/lib/utils/embedding-generator"
    );

    // Use folder name directly for embedding (short text works well)
    const nameEmbedding = await generateEmbedding(folderName);

    logger.info(
      { folderId, folderName, userId },
      "FolderProfileManager: Generated name embedding",
    );

    // Call SQL function to update profile
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Format embedding as PostgreSQL vector string
    const embeddingString = `[${nameEmbedding.join(",")}]`;

    // V1.1: Try to call enhanced version with smart tags
    const { error } = await (supabase.rpc as CallableFunction)(
      "update_folder_name_embedding_v2",
      {
        p_folder_id: folderId,
        p_name_embedding: embeddingString,
        p_smart_tags: smartTags,
      },
    );

    if (error) {
      // Fallback to v1 if v2 doesn't exist
      if (error.message?.includes("function") && error.message?.includes("does not exist")) {
        logger.warn(
          { folderId },
          "FolderProfileManager: v2 function not found, falling back to v1",
        );

        const { error: fallbackError } = await (supabase.rpc as CallableFunction)(
          "update_folder_name_embedding",
          {
            p_folder_id: folderId,
            p_name_embedding: embeddingString,
          },
        );

        if (fallbackError) {
          logger.error(
            { error: fallbackError, folderId, folderName },
            "FolderProfileManager: Failed to update name embedding (fallback)",
          );
        } else {
          logger.info(
            { folderId, folderName },
            "FolderProfileManager: Profile initialized (v1 fallback)",
          );
        }
      } else {
        logger.error(
          { error, folderId, folderName },
          "FolderProfileManager: Failed to update name embedding",
        );
      }
    } else {
      logger.info(
        { folderId, folderName, tagsCount: smartTags.length },
        "FolderProfileManager: Profile initialized with smart tags (v1.1)",
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        folderId,
        folderName,
      },
      "FolderProfileManager: Exception initializing name profile",
    );
  }
}
