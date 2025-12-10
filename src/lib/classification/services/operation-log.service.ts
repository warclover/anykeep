/**
 * Operation Log Service (V4.2)
 * 管理 AI 文件夹操作的快照与撤销功能
 *
 * 核心功能：
 * - 创建操作快照（支持 2 天撤销窗口）
 * - 执行撤销操作
 * - 查询操作历史
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  OperationSnapshot,
  OperationSnapshotInsert,
  OperationSnapshotAction,
  Json,
  CreateOperationState,
  SplitOperationState,
  MergeOperationState,
  RenameOperationState,
} from "@/lib/classification/types";
import { MessageService } from "@/lib/messages/message-service";
import { eventBus, OrganizationEvents } from "@/lib/shared/event-bus";
import type { OperationDetail } from "@/types/supabase";

/**
 * 撤销操作结果
 */
export interface UndoResult {
  success: boolean;
  message: string;
  restoredFolders?: number[];
  restoredBookmarks?: number[];
}

/**
 * 操作历史查询选项
 */
export interface OperationHistoryOptions {
  limit?: number;
  includeUndone?: boolean;
  includeExpired?: boolean;
  actionFilter?: OperationSnapshotAction[];
}

/**
 * 操作日志服务
 */
export class OperationLogService {
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

  /**
   * 创建操作快照
   */
  async createSnapshot(
    userId: string,
    action: OperationSnapshotAction,
    beforeState: Json,
    afterState: Json,
    options: {
      folderId?: number;
      folderIds?: number[];
      bookmarkIds?: number[];
      reason?: string;
    } = {},
  ): Promise<OperationSnapshot> {
    const supabase = await this.getSupabase();

    const snapshotData: OperationSnapshotInsert = {
      user_id: userId,
      action,
      before_state: beforeState,
      after_state: afterState,
      folder_id: options.folderId ?? null,
      folder_ids: options.folderIds ?? null,
      bookmark_ids: options.bookmarkIds ?? null,
      reason: options.reason ?? null,
    };

    // V4.2 表
    const { data, error } = await supabase
      .from("operation_snapshots")
      .insert(snapshotData)
      .select()
      .single();

    if (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[OperationLogService] Failed to create snapshot",
      );
      throw new Error(`创建操作快照失败: ${error.message}`);
    }

    return data as OperationSnapshot;
  }

  /**
   * 创建文件夹创建操作的快照
   */
  async createFolderCreateSnapshot(
    userId: string,
    folder: { id: number; name: string; parent_id: number | null },
    bookmarks: Array<{ id: number; title: string; folder_id: number | null }>,
    reason?: string,
  ): Promise<OperationSnapshot> {
    const beforeState: CreateOperationState = {
      folder: { id: 0, name: "", parent_id: null }, // 创建前不存在
      bookmarks: bookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        folder_id: b.folder_id, // 原始位置
      })),
    };

    const afterState: CreateOperationState = {
      folder: {
        id: folder.id,
        name: folder.name,
        parent_id: folder.parent_id,
      },
      bookmarks: bookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        folder_id: folder.id, // 移动到新文件夹
      })),
    };

    return this.createSnapshot(
      userId,
      "create",
      beforeState as Json,
      afterState as Json,
      {
        folderId: folder.id,
        bookmarkIds: bookmarks.map((b) => b.id),
        reason,
      },
    );
  }

  /**
   * 创建文件夹重命名操作的快照
   */
  async createRenameSnapshot(
    userId: string,
    folderId: number,
    oldName: string,
    newName: string,
    reason?: string,
  ): Promise<OperationSnapshot> {
    const beforeState: RenameOperationState = {
      folder_id: folderId,
      old_name: oldName,
      new_name: oldName,
    };

    const afterState: RenameOperationState = {
      folder_id: folderId,
      old_name: oldName,
      new_name: newName,
    };

    return this.createSnapshot(
      userId,
      "rename",
      beforeState as Json,
      afterState as Json,
      {
        folderId,
        reason,
      },
    );
  }

  /**
   * 创建文件夹分拆操作的快照
   */
  async createSplitSnapshot(
    userId: string,
    originalFolder: { id: number; name: string; parent_id: number | null },
    newFolders: Array<{ id: number; name: string; parent_id: number | null }>,
    bookmarkMoves: Array<{
      bookmark_id: number;
      from_folder_id: number;
      to_folder_id: number;
    }>,
    reason?: string,
  ): Promise<OperationSnapshot> {
    const beforeState: SplitOperationState = {
      original_folder: {
        id: originalFolder.id,
        name: originalFolder.name,
        parent_id: originalFolder.parent_id,
      },
      new_folders: [],
      bookmark_moves: bookmarkMoves.map((m) => ({
        bookmark_id: m.bookmark_id,
        from_folder_id: originalFolder.id,
        to_folder_id: originalFolder.id, // 分拆前都在原文件夹
      })),
    };

    const afterState: SplitOperationState = {
      original_folder: {
        id: originalFolder.id,
        name: originalFolder.name,
        parent_id: originalFolder.parent_id,
      },
      new_folders: newFolders.map((f) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
      })),
      bookmark_moves: bookmarkMoves,
    };

    return this.createSnapshot(
      userId,
      "split",
      beforeState as Json,
      afterState as Json,
      {
        folderId: originalFolder.id,
        folderIds: newFolders.map((f) => f.id),
        bookmarkIds: bookmarkMoves.map((m) => m.bookmark_id),
        reason,
      },
    );
  }

  /**
   * 创建文件夹合并操作的快照
   */
  async createMergeSnapshot(
    userId: string,
    sourceFolders: Array<{
      id: number;
      name: string;
      parent_id: number | null;
    }>,
    targetFolder: { id: number; name: string; parent_id: number | null },
    mergedBookmarks: Array<{
      id: number;
      title: string;
      folder_id: number | null;
    }>,
    reason?: string,
  ): Promise<OperationSnapshot> {
    const beforeState: MergeOperationState = {
      source_folders: sourceFolders.map((f) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
      })),
      target_folder: {
        id: targetFolder.id,
        name: targetFolder.name,
        parent_id: targetFolder.parent_id,
      },
      merged_bookmarks: mergedBookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        folder_id: b.folder_id, // 原始位置
      })),
    };

    const afterState: MergeOperationState = {
      source_folders: [], // 合并后源文件夹被删除
      target_folder: {
        id: targetFolder.id,
        name: targetFolder.name,
        parent_id: targetFolder.parent_id,
      },
      merged_bookmarks: mergedBookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        folder_id: targetFolder.id, // 全部移动到目标文件夹
      })),
    };

    return this.createSnapshot(
      userId,
      "merge",
      beforeState as Json,
      afterState as Json,
      {
        folderId: targetFolder.id,
        folderIds: sourceFolders.map((f) => f.id),
        bookmarkIds: mergedBookmarks.map((b) => b.id),
        reason,
      },
    );
  }

  /**
   * 获取用户的操作历史
   */
  async getOperationHistory(
    userId: string,
    options: OperationHistoryOptions = {},
  ): Promise<OperationDetail[]> {
    const supabase = await this.getSupabase();
    const {
      limit = 50,
      includeUndone = false,
      includeExpired = false,
      actionFilter,
    } = options;

    // V4.2 表
    let query = supabase
      .from("operation_snapshots")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // 默认排除已撤销的操作
    if (!includeUndone) {
      query = query.eq("is_undone", false);
    }

    // 默认排除已过期的操作
    if (!includeExpired) {
      query = query.gt("expires_at", new Date().toISOString());
    }

    // 按操作类型筛选
    if (actionFilter && actionFilter.length > 0) {
      query = query.in("action", actionFilter);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[OperationLogService] Failed to get history",
      );
      throw new Error(`获取操作历史失败: ${error.message}`);
    }

    // 类型断言
    type SnapshotRow = {
      id: number;
      action: string;
      folder_id: number | null;
      folder_ids: number[] | null;
      bookmark_ids: number[] | null;
      before_state: Record<string, unknown> | null;
      after_state: Record<string, unknown> | null;
      reason: string | null;
      created_at: string;
      expires_at: string;
      is_undone: boolean;
      undone_at: string | null;
    };
    const typedData = (data || []) as unknown as SnapshotRow[];

    // 转换为 OperationDetail 格式
    return typedData.map((snapshot: SnapshotRow) => ({
      id: String(snapshot.id),
      action: snapshot.action as OperationSnapshotAction,
      folder_id: snapshot.folder_id,
      folder_ids: snapshot.folder_ids,
      bookmark_ids: snapshot.bookmark_ids,
      before_state: snapshot.before_state as Json,
      after_state: snapshot.after_state as Json,
      reason: snapshot.reason,
      created_at: snapshot.created_at,
      expires_at: snapshot.expires_at,
      is_undone: snapshot.is_undone,
      undone_at: snapshot.undone_at,
      can_undo:
        !snapshot.is_undone && new Date(snapshot.expires_at) > new Date(),
    }));
  }

  /**
   * 获取单个操作快照详情
   */
  async getSnapshotById(
    userId: string,
    snapshotId: string,
  ): Promise<OperationSnapshot | null> {
    const supabase = await this.getSupabase();

    // V4.2 表
    const { data, error } = await supabase
      .from("operation_snapshots")
      .select("*")
      .eq("id", snapshotId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // 未找到
      }
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[OperationLogService] Failed to get snapshot",
      );
      throw new Error(`获取操作快照失败: ${error.message}`);
    }

    return data as unknown as OperationSnapshot;
  }

  /**
   * 执行撤销操作
   */
  async undoOperation(userId: string, snapshotId: string): Promise<UndoResult> {
    const supabase = await this.getSupabase();

    // 1. 获取快照
    const snapshot = await this.getSnapshotById(userId, snapshotId);
    if (!snapshot) {
      return { success: false, message: "操作记录不存在" };
    }

    // 2. 检查是否可撤销
    if (snapshot.is_undone) {
      return { success: false, message: "该操作已被撤销" };
    }

    // expires_at 可能为 null
    const expiresAt = snapshot.expires_at
      ? new Date(snapshot.expires_at)
      : new Date(0);
    if (expiresAt < new Date()) {
      return { success: false, message: "撤销窗口已过期（超过 2 天）" };
    }

    // 3. 根据操作类型执行回滚
    try {
      const result = await this.executeUndo(snapshot);

      // 4. 标记快照为已撤销 (V4.2 表)
      await supabase
        .from("operation_snapshots")
        .update({
          is_undone: true,
          undone_at: new Date().toISOString(),
        })
        .eq("id", snapshotId);

      // 5. 发送撤销成功的消息通知
      if (result.success) {
        const actionLabel = this.getActionLabel(
          snapshot.action as OperationSnapshotAction,
        );
        await MessageService.notifyOperationUndone(
          userId,
          actionLabel,
          result.message,
        );

        // 6. 发布撤销事件（V4.2 事件总线）
        eventBus.emit(OrganizationEvents.OPERATION_UNDONE, {
          userId,
          snapshotId,
          action: snapshot.action as OperationSnapshotAction,
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[OperationLogService] Undo failed",
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : "撤销操作失败",
      };
    }
  }

  /**
   * 获取操作类型的中文标签
   */
  private getActionLabel(action: OperationSnapshotAction): string {
    const labels: Record<OperationSnapshotAction, string> = {
      create: "创建文件夹",
      split: "分拆文件夹",
      merge: "合并文件夹",
      rename: "重命名文件夹",
      move: "移动书签",
      delete: "删除文件夹",
    };
    return labels[action] || action;
  }

  /**
   * 执行具体的撤销逻辑
   */
  private async executeUndo(snapshot: OperationSnapshot): Promise<UndoResult> {
    const supabase = await this.getSupabase();

    switch (snapshot.action) {
      case "create": {
        // 撤销文件夹创建：删除文件夹，恢复书签位置
        // 空值检查：确保操作状态完整
        if (!snapshot.before_state || !snapshot.after_state) {
          return { success: false, message: "操作快照数据不完整，无法撤销" };
        }
        const beforeState =
          snapshot.before_state as unknown as CreateOperationState;
        const afterState =
          snapshot.after_state as unknown as CreateOperationState;

        // 恢复书签到原位置
        const bookmarks = beforeState.bookmarks || [];
        for (const bookmark of bookmarks) {
          await supabase
            .from("bookmarks")
            .update({ folder_id: bookmark.folder_id })
            .eq("id", bookmark.id);
        }

        // 软删除新创建的文件夹
        const folderId = afterState.folder?.id || afterState.folder_id;
        const folderName =
          afterState.folder?.name || afterState.folder_name || "未知";
        if (folderId) {
          await supabase
            .from("folders")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", folderId);
        }

        return {
          success: true,
          message: `已撤销创建文件夹「${folderName}」`,
          restoredBookmarks: bookmarks.map((b) => b.id),
        };
      }

      case "rename": {
        // 撤销重命名：恢复原名称
        if (!snapshot.before_state) {
          return { success: false, message: "操作快照数据不完整，无法撤销" };
        }
        const beforeState =
          snapshot.before_state as unknown as RenameOperationState;
        const folderId = beforeState.folder_id;
        const oldName = beforeState.old_name || "未知";

        if (folderId) {
          await supabase
            .from("folders")
            .update({ name: oldName })
            .eq("id", folderId);
        }

        return {
          success: true,
          message: `已恢复文件夹名称为「${oldName}」`,
          restoredFolders: folderId ? [folderId] : [],
        };
      }

      case "split": {
        // 撤销分拆：删除新文件夹，恢复书签位置
        if (!snapshot.before_state || !snapshot.after_state) {
          return { success: false, message: "操作快照数据不完整，无法撤销" };
        }
        const beforeState =
          snapshot.before_state as unknown as SplitOperationState;
        const afterState =
          snapshot.after_state as unknown as SplitOperationState;

        // 恢复书签到原文件夹
        const bookmarkMoves = beforeState.bookmark_moves || [];
        for (const move of bookmarkMoves) {
          await supabase
            .from("bookmarks")
            .update({ folder_id: move.from_folder_id })
            .eq("id", move.bookmark_id);
        }

        // 软删除新创建的文件夹
        const newFolders = afterState.new_folders || [];
        for (const folder of newFolders) {
          await supabase
            .from("folders")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", folder.id);
        }

        const originalFolderName =
          beforeState.original_folder?.name ||
          beforeState.original_folder_name ||
          "未知";
        const originalFolderId =
          beforeState.original_folder?.id || beforeState.original_folder_id;

        return {
          success: true,
          message: `已撤销分拆文件夹「${originalFolderName}」`,
          restoredFolders: originalFolderId ? [originalFolderId] : [],
          restoredBookmarks: bookmarkMoves.map((m) => m.bookmark_id),
        };
      }

      case "merge": {
        // 撤销合并：恢复源文件夹，恢复书签位置
        const beforeState =
          snapshot.before_state as unknown as MergeOperationState;

        // 恢复源文件夹（取消软删除）
        const sourceFolders = beforeState.source_folders || [];
        for (const folder of sourceFolders) {
          await supabase
            .from("folders")
            .update({ deleted_at: null })
            .eq("id", folder.id);
        }

        // 恢复书签到原位置
        const mergedBookmarks = beforeState.merged_bookmarks || [];
        for (const bookmark of mergedBookmarks) {
          await supabase
            .from("bookmarks")
            .update({ folder_id: bookmark.folder_id })
            .eq("id", bookmark.id);
        }

        return {
          success: true,
          message: `已撤销合并，恢复了 ${sourceFolders.length} 个文件夹`,
          restoredFolders: sourceFolders.map((f) => f.id),
          restoredBookmarks: mergedBookmarks.map((b) => b.id),
        };
      }

      case "move": {
        // 撤销移动：恢复书签位置
        const beforeState =
          snapshot.before_state as unknown as CreateOperationState;

        const bookmarks = beforeState.bookmarks || [];
        for (const bookmark of bookmarks) {
          await supabase
            .from("bookmarks")
            .update({ folder_id: bookmark.folder_id })
            .eq("id", bookmark.id);
        }

        return {
          success: true,
          message: `已恢复 ${bookmarks.length} 个书签的位置`,
          restoredBookmarks: bookmarks.map((b) => b.id),
        };
      }

      default:
        return {
          success: false,
          message: `不支持撤销的操作类型: ${snapshot.action}`,
        };
    }
  }

  /**
   * 获取可撤销操作数量
   */
  async getUndoableCount(userId: string): Promise<number> {
    const supabase = await this.getSupabase();

    // V4.2 表
    const { count, error } = await supabase
      .from("operation_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_undone", false)
      .gt("expires_at", new Date().toISOString());

    if (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[OperationLogService] Failed to get undoable count",
      );
      return 0;
    }

    return count ?? 0;
  }

  /**
   * 清理过期的操作记录（用于定时任务）
   */
  async cleanupExpiredSnapshots(): Promise<number> {
    const supabase = await this.getSupabase();

    // V4.2 表
    const { data, error } = await supabase
      .from("operation_snapshots")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[OperationLogService] Failed to cleanup",
      );
      return 0;
    }

    return data?.length ?? 0;
  }

  // ============================================
  // 消息通知集成方法 (V4.2)
  // ============================================

  /**
   * 创建文件夹操作并发送通知
   * 包装 createFolderCreateSnapshot，完成后自动发送消息
   */
  async createFolderWithNotification(
    userId: string,
    folder: { id: number; name: string; parent_id: number | null },
    bookmarks: Array<{ id: number; title: string; folder_id: number | null }>,
    reason?: string,
  ): Promise<OperationSnapshot> {
    // 创建快照
    const snapshot = await this.createFolderCreateSnapshot(
      userId,
      folder,
      bookmarks,
      reason,
    );

    // 发送消息通知
    await MessageService.notifyFolderAutoCreated(
      userId,
      folder.id,
      folder.name,
      bookmarks.length,
      reason,
      String(snapshot.id),
    );

    // 发布文件夹创建事件（V4.2 事件总线）
    eventBus.emit(OrganizationEvents.FOLDER_CREATED, {
      userId,
      folderId: folder.id,
      folderName: folder.name,
      isAiSuggested: true,
      bookmarkIds: bookmarks.map((b) => b.id),
      timestamp: new Date().toISOString(),
    });

    return snapshot;
  }

  /**
   * 重命名文件夹操作并发送通知
   */
  async renameFolderWithNotification(
    userId: string,
    folderId: number,
    oldName: string,
    newName: string,
    reason?: string,
  ): Promise<OperationSnapshot> {
    // 创建快照
    const snapshot = await this.createRenameSnapshot(
      userId,
      folderId,
      oldName,
      newName,
      reason,
    );

    // 发送消息通知
    await MessageService.notifyFolderAutoRenamed(
      userId,
      folderId,
      oldName,
      newName,
      reason,
      String(snapshot.id),
    );

    return snapshot;
  }

  /**
   * 分拆文件夹操作并发送通知
   */
  async splitFolderWithNotification(
    userId: string,
    originalFolder: { id: number; name: string; parent_id: number | null },
    newFolders: Array<{ id: number; name: string; parent_id: number | null }>,
    bookmarkMoves: Array<{
      bookmark_id: number;
      from_folder_id: number;
      to_folder_id: number;
    }>,
    reason?: string,
  ): Promise<OperationSnapshot> {
    // 创建快照
    const snapshot = await this.createSplitSnapshot(
      userId,
      originalFolder,
      newFolders,
      bookmarkMoves,
      reason,
    );

    // 发送消息通知
    await MessageService.notifyFolderAutoSplit(
      userId,
      originalFolder.name,
      newFolders.map((f) => f.name),
      reason,
      String(snapshot.id),
    );

    return snapshot;
  }

  /**
   * 合并文件夹操作并发送通知
   */
  async mergeFoldersWithNotification(
    userId: string,
    sourceFolders: Array<{
      id: number;
      name: string;
      parent_id: number | null;
    }>,
    targetFolder: { id: number; name: string; parent_id: number | null },
    mergedBookmarks: Array<{
      id: number;
      title: string;
      folder_id: number | null;
    }>,
    reason?: string,
  ): Promise<OperationSnapshot> {
    // 创建快照
    const snapshot = await this.createMergeSnapshot(
      userId,
      sourceFolders,
      targetFolder,
      mergedBookmarks,
      reason,
    );

    // 发送消息通知
    await MessageService.notifyFolderAutoMerged(
      userId,
      targetFolder.id,
      targetFolder.name,
      sourceFolders.length,
      reason,
      String(snapshot.id),
    );

    return snapshot;
  }

  /**
   * 发送月度进化报告通知
   */
  async sendEvolutionReport(
    userId: string,
    month: string,
    classifiedCount: number,
    createdFolders: number,
    reportUrl?: string,
  ): Promise<void> {
    await MessageService.notifyEvolutionReport(
      userId,
      month,
      classifiedCount,
      createdFolders,
      reportUrl,
    );
  }
}

// 导出单例
export const operationLogService = new OperationLogService();
