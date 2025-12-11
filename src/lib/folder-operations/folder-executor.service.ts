/**
 * Folder Executor Service
 * V4.2 文件夹操作执行器 - 统一的文件夹操作执行入口
 *
 * @description 执行文件夹的创建、合并、拆分、重命名操作
 * - 复用现有的 merge/split/rename 服务
 * - 统一的操作快照管理
 * - 支持撤销功能
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operationLogService } from "@/lib/classification/services/operation-log.service";
import { logger } from "@/lib/logger";
import type {
  FolderCreateInput,
  FolderMergeInput,
  FolderSplitInput,
  FolderRenameInput,
  FolderCreateResult,
  FolderMergeResult,
  FolderSplitResult,
  FolderRenameResult,
} from "./folder-executor.types";

// ============================================================================
// FolderExecutorService
// ============================================================================

class FolderExecutorService {
  private readonly LOG_PREFIX = "[FolderExecutor]";

  private supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  > | null = null;

  /**
   * 获取 Supabase 客户端（延迟初始化）
   */
  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient();
    }
    return this.supabase;
  }

  // ==========================================================================
  // 创建文件夹
  // ==========================================================================

  /**
   * 执行文件夹创建
   */
  async executeCreate(input: FolderCreateInput): Promise<FolderCreateResult> {
    const { userId, name, parentId, bookmarkIds, reason, tags } = input;

    try {
      const supabase = await this.getSupabase();

      // 1. 检查是否存在同名文件夹
      const { data: existing } = await supabase
        .from("folders")
        .select("id")
        .eq("user_id", userId)
        .eq("name", name)
        .is("deleted_at", null)
        .single();

      if (existing) {
        return {
          success: false,
          message: `已存在名为「${name}」的文件夹`,
        };
      }

      // 2. 创建文件夹
      const { data: folder, error: createError } = await supabase
        .from("folders")
        .insert({
          user_id: userId,
          name,
          parent_id: parentId ?? null,
          source: "auto_create",
        })
        .select("id, name")
        .single();

      if (createError || !folder) {
        logger.error(
          { error: createError?.message },
          `${this.LOG_PREFIX} Failed to create folder`,
        );
        return {
          success: false,
          message: "创建文件夹失败",
        };
      }

      // 3. 移动书签到新文件夹
      let movedCount = 0;
      if (bookmarkIds.length > 0) {
        const { error: moveError, count } = await supabase
          .from("bookmarks")
          .update({ folder_id: folder.id })
          .in("id", bookmarkIds)
          .eq("user_id", userId);

        if (moveError) {
          logger.warn(
            { error: moveError.message },
            `${this.LOG_PREFIX} Failed to move bookmarks`,
          );
        } else {
          movedCount = count || bookmarkIds.length;
        }
      }

      // 4. 创建操作快照（用于撤销）
      let snapshotId: string | undefined;
      try {
        const snapshot = await operationLogService.createSnapshot(
          userId,
          "create",
          { folder: null },
          {
            folder: { id: folder.id, name: folder.name },
            moved_bookmarks: bookmarkIds,
            tags,
          },
          {
            folderId: folder.id,
            bookmarkIds,
            reason,
          },
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

      // 5. 初始化文件夹画像（异步，不阻塞）
      this.initializeFolderProfile(userId, folder.id).catch((err) => {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          `${this.LOG_PREFIX} Profile init warning`,
        );
      });

      logger.info(
        {
          folderId: folder.id,
          folderName: folder.name,
          movedCount,
        },
        `${this.LOG_PREFIX} Folder created successfully`,
      );

      return {
        success: true,
        message: `已创建文件夹「${folder.name}」`,
        folderId: folder.id,
        folderName: folder.name,
        movedBookmarkCount: movedCount,
        snapshotId,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        `${this.LOG_PREFIX} executeCreate error`,
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : "创建文件夹失败",
      };
    }
  }

  // ==========================================================================
  // 合并文件夹
  // ==========================================================================

  /**
   * 执行文件夹合并
   */
  async executeMerge(input: FolderMergeInput): Promise<FolderMergeResult> {
    const { userId, targetFolderId, sourceFolderIds, reason } = input;

    try {
      const supabase = await this.getSupabase();

      // 1. 验证文件夹
      const allFolderIds = [...sourceFolderIds, targetFolderId];
      const { data: folders, error: folderError } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .in("id", allFolderIds)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (folderError || !folders) {
        return { success: false, message: "获取文件夹信息失败" };
      }

      const targetFolder = folders.find((f) => f.id === targetFolderId);
      const sourceFolders = folders.filter((f) =>
        sourceFolderIds.includes(f.id),
      );

      if (!targetFolder) {
        return { success: false, message: "目标文件夹不存在" };
      }

      if (sourceFolders.length === 0) {
        return { success: false, message: "源文件夹不存在" };
      }

      // 2. 获取要移动的书签
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from("bookmarks")
        .select("id, title, folder_id")
        .in("folder_id", sourceFolderIds)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (bookmarksError) {
        return { success: false, message: "获取书签信息失败" };
      }

      const mergedBookmarks = bookmarks || [];

      // 3. 移动书签到目标文件夹
      if (mergedBookmarks.length > 0) {
        const { error: moveError } = await supabase
          .from("bookmarks")
          .update({ folder_id: targetFolderId })
          .in("folder_id", sourceFolderIds)
          .eq("user_id", userId);

        if (moveError) {
          return {
            success: false,
            message: `移动书签失败: ${moveError.message}`,
          };
        }
      }

      // 4. 软删除源文件夹
      const { error: deleteError } = await supabase
        .from("folders")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", sourceFolderIds)
        .eq("user_id", userId);

      if (deleteError) {
        logger.warn(
          { error: deleteError.message },
          `${this.LOG_PREFIX} Failed to soft-delete source folders`,
        );
      }

      // 5. 创建操作快照
      let snapshotId: string | undefined;
      try {
        const snapshot = await operationLogService.createSnapshot(
          userId,
          "merge",
          {
            source_folders: sourceFolders.map((f) => ({
              id: f.id,
              name: f.name,
            })),
            target_folder: { id: targetFolder.id, name: targetFolder.name },
            bookmark_moves: mergedBookmarks.map((b) => ({
              id: b.id,
              from: b.folder_id,
            })),
          },
          {
            target_folder: { id: targetFolder.id, name: targetFolder.name },
            merged_count: sourceFolders.length,
            moved_bookmarks: mergedBookmarks.length,
          },
          {
            folderId: targetFolderId,
            folderIds: sourceFolderIds,
            bookmarkIds: mergedBookmarks.map((b) => b.id),
            reason,
          },
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
        {
          targetFolderId,
          sourceFolderIds,
          movedCount: mergedBookmarks.length,
        },
        `${this.LOG_PREFIX} Folders merged successfully`,
      );

      return {
        success: true,
        message: `已将 ${sourceFolders.length} 个文件夹合并到「${targetFolder.name}」`,
        targetFolderId: targetFolder.id,
        targetFolderName: targetFolder.name,
        mergedFolderCount: sourceFolders.length,
        movedBookmarkCount: mergedBookmarks.length,
        snapshotId,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        `${this.LOG_PREFIX} executeMerge error`,
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : "合并文件夹失败",
      };
    }
  }

  // ==========================================================================
  // 拆分文件夹
  // ==========================================================================

  /**
   * 执行文件夹拆分
   */
  async executeSplit(input: FolderSplitInput): Promise<FolderSplitResult> {
    const { userId, sourceFolderId, subFolders, reason } = input;

    try {
      const supabase = await this.getSupabase();

      // 1. 验证源文件夹
      const { data: sourceFolder, error: folderError } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .eq("id", sourceFolderId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (folderError || !sourceFolder) {
        return { success: false, message: "源文件夹不存在" };
      }

      const newFolders: Array<{
        id: number;
        name: string;
        bookmarkCount: number;
      }> = [];

      const bookmarkMoves: Array<{
        bookmarkId: number;
        fromFolderId: number;
        toFolderId: number;
      }> = [];

      // 2. 创建子文件夹并移动书签
      for (const subFolder of subFolders) {
        // 创建新文件夹
        const { data: newFolder, error: createError } = await supabase
          .from("folders")
          .insert({
            user_id: userId,
            name: subFolder.name,
            parent_id: sourceFolder.parent_id,
            source: "auto_split",
          })
          .select("id, name")
          .single();

        if (createError || !newFolder) {
          logger.error(
            { error: createError?.message },
            `${this.LOG_PREFIX} Failed to create sub-folder`,
          );
          continue;
        }

        // 移动书签
        const { error: moveError } = await supabase
          .from("bookmarks")
          .update({ folder_id: newFolder.id })
          .in("id", subFolder.bookmarkIds)
          .eq("user_id", userId);

        if (moveError) {
          logger.warn(
            { error: moveError.message },
            `${this.LOG_PREFIX} Failed to move bookmarks to sub-folder`,
          );
        } else {
          newFolders.push({
            id: newFolder.id,
            name: newFolder.name,
            bookmarkCount: subFolder.bookmarkIds.length,
          });

          for (const bookmarkId of subFolder.bookmarkIds) {
            bookmarkMoves.push({
              bookmarkId,
              fromFolderId: sourceFolderId,
              toFolderId: newFolder.id,
            });
          }
        }
      }

      if (newFolders.length === 0) {
        return { success: false, message: "未能创建任何子文件夹" };
      }

      // 3. 软删除源文件夹（如果所有书签都已移走）
      const { count: remainingCount } = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("folder_id", sourceFolderId)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (remainingCount === 0) {
        await supabase
          .from("folders")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", sourceFolderId)
          .eq("user_id", userId);
      }

      // 4. 创建操作快照
      let snapshotId: string | undefined;
      try {
        const snapshot = await operationLogService.createSnapshot(
          userId,
          "split",
          {
            source_folder: { id: sourceFolder.id, name: sourceFolder.name },
            bookmark_moves: bookmarkMoves,
          },
          {
            new_folders: newFolders,
            source_deleted: remainingCount === 0,
          },
          {
            folderId: sourceFolderId,
            folderIds: newFolders.map((f) => f.id),
            bookmarkIds: bookmarkMoves.map((m) => m.bookmarkId),
            reason,
          },
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
        {
          sourceFolderId,
          newFolderCount: newFolders.length,
        },
        `${this.LOG_PREFIX} Folder split successfully`,
      );

      return {
        success: true,
        message: `已将「${sourceFolder.name}」拆分为 ${newFolders.length} 个子文件夹`,
        newFolders,
        snapshotId,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        `${this.LOG_PREFIX} executeSplit error`,
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : "拆分文件夹失败",
      };
    }
  }

  // ==========================================================================
  // 重命名文件夹
  // ==========================================================================

  /**
   * 执行文件夹重命名
   */
  async executeRename(input: FolderRenameInput): Promise<FolderRenameResult> {
    const { userId, folderId, newName, reason } = input;

    try {
      const supabase = await this.getSupabase();

      // 1. 获取当前文件夹信息
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, name")
        .eq("id", folderId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (folderError || !folder) {
        return { success: false, message: "文件夹不存在或无权访问" };
      }

      const oldName = folder.name;

      // 2. 检查新名称是否与旧名称相同
      if (oldName === newName) {
        return { success: false, message: "新名称与当前名称相同" };
      }

      // 3. 检查是否存在同名文件夹
      const { data: existing } = await supabase
        .from("folders")
        .select("id")
        .eq("user_id", userId)
        .eq("name", newName)
        .is("deleted_at", null)
        .neq("id", folderId)
        .single();

      if (existing) {
        return { success: false, message: `已存在名为「${newName}」的文件夹` };
      }

      // 4. 执行重命名
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
        return { success: false, message: "重命名失败" };
      }

      // 5. 创建操作快照
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
          { folderId, reason },
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
        { folderId, oldName, newName },
        `${this.LOG_PREFIX} Folder renamed successfully`,
      );

      return {
        success: true,
        message: `已将「${oldName}」重命名为「${newName}」`,
        folderId,
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

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  /**
   * 初始化文件夹画像
   */
  private async initializeFolderProfile(
    userId: string,
    folderId: number,
  ): Promise<void> {
    try {
      const supabase = await this.getSupabase();

      // 检查是否已存在画像
      const { data: existing } = await supabase
        .from("folder_profiles")
        .select("id")
        .eq("folder_id", folderId)
        .single();

      if (existing) return;

      // 创建初始画像
      await supabase.from("folder_profiles").insert({
        folder_id: folderId,
        user_id: userId,
        bookmark_count: 0,
        internal_similarity: null,
        profile_embedding: null,
        top_tags: [],
        last_updated: new Date().toISOString(),
      });
    } catch (error) {
      // 静默处理，不影响主流程
      logger.debug(
        { error: error instanceof Error ? error.message : String(error) },
        `${this.LOG_PREFIX} initializeFolderProfile skipped`,
      );
    }
  }
}

// ============================================================================
// 导出单例
// ============================================================================

export const folderExecutorService = new FolderExecutorService();
export { FolderExecutorService };
