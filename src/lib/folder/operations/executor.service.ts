/**
 * Folder Executor Service
 * V4.2.7 文件夹操作执行器 - 统一的文件夹操作执行入口
 *
 * @description 执行文件夹的创建、合并、拆分、重命名操作
 * - 复用现有的 merge/split/rename 服务
 * - 统一的操作快照管理
 * - 支持撤销功能
 * - V4.2.2: executeMerge 使用 merge_folders_atomic RPC 确保原子性
 * - V4.2.7: 文件夹变更时清除服务端分类缓存 (fastPathCacheManager)
 *
 * @module folder/operations
 * @version 1.3.0
 * @since 2025-12-11
 * @updated 2025-12-24 - Migrated to unified folder module
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operationLogService } from "@/lib/classification/services/operation-log.service";
import { initializeFolderNameProfile } from "@/lib/folder-profile/manager";
import { logger } from "@/lib/logger";
import { folderCacheInvalidation } from "@/lib/cache/folder-cache-invalidation";
import { fastPathCacheManager } from "@/lib/classification/router/cache-manager";
import type {
  FolderCreateInput,
  FolderMergeInput,
  FolderSplitInput,
  FolderRenameInput,
  FolderCreateResult,
  FolderMergeResult,
  FolderSplitResult,
  FolderRenameResult,
} from "./types";

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

      // 5. V4.2.8: 计算文件夹画像（异步，不阻塞）
      // 如果有书签移动，计算实际画像；否则初始化名称向量
      if (movedCount > 0) {
        this.computeFolderProfile(folder.id).catch((err) => {
          logger.warn(
            { error: err instanceof Error ? err.message : String(err) },
            `${this.LOG_PREFIX} Profile computation warning`,
          );
        });
        // 同时也要初始化名称向量，确保加权平均正确
        initializeFolderNameProfile(folder.id, folder.name, userId).catch(
          (err) => {
            logger.warn(
              { error: err instanceof Error ? err.message : String(err) },
              `${this.LOG_PREFIX} Name embedding init warning`,
            );
          },
        );
      } else {
        // V4.2.8: 空文件夹也需要名称向量，用于冷启动分类
        initializeFolderNameProfile(folder.id, folder.name, userId).catch(
          (err) => {
            logger.warn(
              { error: err instanceof Error ? err.message : String(err) },
              `${this.LOG_PREFIX} Name embedding init warning`,
            );
          },
        );
      }

      logger.info(
        {
          folderId: folder.id,
          folderName: folder.name,
          movedCount,
        },
        `${this.LOG_PREFIX} Folder created successfully`,
      );

      // 6. 触发缓存失效（确保客户端获取最新数据）
      folderCacheInvalidation.onFolderCreate(userId);
      // V4.2.7: 清除服务端分类缓存（确保下次分类使用最新文件夹列表）
      fastPathCacheManager.invalidateUser(userId);

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
   * V4.2.2: 使用 merge_folders_atomic RPC 确保每个合并操作的原子性
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

      // 2. 获取要移动的书签（用于快照记录）
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

      // 3. 使用 RPC 事务函数逐个合并源文件夹（原子性保证）
      let totalMovedCount = 0;
      const mergeResults: Array<{
        sourceFolderId: number;
        sourceFolderName: string;
        bookmarksMoved: number;
        success: boolean;
        error?: string;
      }> = [];

      for (const sourceFolder of sourceFolders) {
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "merge_folders_atomic",
          {
            p_source_folder_id: sourceFolder.id,
            p_target_folder_id: targetFolderId,
            p_user_id: userId,
          },
        );

        if (rpcError) {
          logger.warn(
            {
              error: rpcError.message,
              sourceFolderId: sourceFolder.id,
              targetFolderId,
            },
            `${this.LOG_PREFIX} RPC merge_folders_atomic failed for folder`,
          );
          mergeResults.push({
            sourceFolderId: sourceFolder.id,
            sourceFolderName: sourceFolder.name,
            bookmarksMoved: 0,
            success: false,
            error: rpcError.message,
          });
          continue;
        }

        const result = rpcResult as {
          success: boolean;
          bookmarksMoved?: number;
          error?: string;
        };

        if (result.success) {
          totalMovedCount += result.bookmarksMoved || 0;
          mergeResults.push({
            sourceFolderId: sourceFolder.id,
            sourceFolderName: sourceFolder.name,
            bookmarksMoved: result.bookmarksMoved || 0,
            success: true,
          });
        } else {
          logger.warn(
            {
              error: result.error,
              sourceFolderId: sourceFolder.id,
            },
            `${this.LOG_PREFIX} merge_folders_atomic returned error`,
          );
          mergeResults.push({
            sourceFolderId: sourceFolder.id,
            sourceFolderName: sourceFolder.name,
            bookmarksMoved: 0,
            success: false,
            error: result.error,
          });
        }
      }

      const successfulMerges = mergeResults.filter((r) => r.success);
      if (successfulMerges.length === 0) {
        return {
          success: false,
          message: "所有文件夹合并均失败",
        };
      }

      // 4. 创建操作快照
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
            merged_count: successfulMerges.length,
            moved_bookmarks: totalMovedCount,
            merge_results: mergeResults,
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
          successfulMerges: successfulMerges.length,
          totalSourceFolders: sourceFolders.length,
          movedCount: totalMovedCount,
        },
        `${this.LOG_PREFIX} Folders merged successfully (atomic)`,
      );

      const partialSuccess =
        successfulMerges.length < sourceFolders.length
          ? ` (${sourceFolders.length - successfulMerges.length} 个失败)`
          : "";

      // 5. 触发缓存失效（确保客户端获取最新数据）
      folderCacheInvalidation.onFolderMerge(userId);
      // V4.2.7: 清除服务端分类缓存（确保下次分类使用最新文件夹列表）
      fastPathCacheManager.invalidateUser(userId);

      return {
        success: true,
        message: `已将 ${successfulMerges.length} 个文件夹合并到「${targetFolder.name}」${partialSuccess}`,
        targetFolderId: targetFolder.id,
        targetFolderName: targetFolder.name,
        mergedFolderCount: successfulMerges.length,
        movedBookmarkCount: totalMovedCount,
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

      // 5. V4.2.5: 为新文件夹计算画像（异步，不阻塞）
      // 这确保新文件夹可以被分类系统正确匹配
      Promise.all(
        newFolders.map((folder) => this.computeFolderProfile(folder.id)),
      ).catch((err) => {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          `${this.LOG_PREFIX} Profile computation warning after split`,
        );
      });

      // 6. 触发缓存失效（确保客户端获取最新数据）
      folderCacheInvalidation.onFolderGroupChange(userId);
      // V4.2.7: 清除服务端分类缓存（确保下次分类使用最新文件夹列表）
      fastPathCacheManager.invalidateUser(userId);

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

      // 6. V4.2.8: 更新文件夹名称向量（异步，不阻塞）
      // 重命名后需要重新生成 name_embedding 以确保分类准确性
      initializeFolderNameProfile(folderId, newName, userId).catch((err) => {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          `${this.LOG_PREFIX} Failed to update name embedding after rename`,
        );
      });

      // 7. 触发缓存失效（确保客户端获取最新数据）
      folderCacheInvalidation.onFolderRename(userId);
      // V4.2.7: 清除服务端分类缓存（确保下次分类使用最新文件夹列表）
      fastPathCacheManager.invalidateUser(userId);

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

  /**
   * V4.2.5: 计算/更新文件夹画像
   * 调用 compute_folder_profile RPC 函数重新计算文件夹的向量画像
   * 用于文件夹创建、合并、拆分后更新画像
   */
  private async computeFolderProfile(folderId: number): Promise<void> {
    try {
      const supabase = await this.getSupabase();

      const { error } = await supabase.rpc("compute_folder_profile", {
        p_folder_id: folderId,
      });

      if (error) {
        logger.warn(
          { error: error.message, folderId },
          `${this.LOG_PREFIX} compute_folder_profile RPC failed`,
        );
      } else {
        logger.debug(
          { folderId },
          `${this.LOG_PREFIX} Folder profile computed`,
        );
      }
    } catch (error) {
      // 静默处理，不影响主流程
      logger.debug(
        {
          error: error instanceof Error ? error.message : String(error),
          folderId,
        },
        `${this.LOG_PREFIX} computeFolderProfile skipped`,
      );
    }
  }
}

// ============================================================================
// 导出单例
// ============================================================================

export const folderExecutorService = new FolderExecutorService();
export { FolderExecutorService };
