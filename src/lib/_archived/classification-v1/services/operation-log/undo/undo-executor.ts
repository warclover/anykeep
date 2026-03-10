/**
 * 撤销执行器
 *
 * @module classification/operation-log/undo/undo-executor
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import type {
  OperationSnapshot,
  OperationSnapshotAction,
} from "@/lib/classification/types";
import type {
  CreateOperationState,
  SplitOperationState,
  MergeOperationState,
  RenameOperationState,
} from "@/lib/classification/types";
import { Notify } from "@/lib/notifications/server";
import { eventBus, OrganizationEvents } from "@/lib/shared/event-bus";
import type { SupabaseClientType, UndoResult } from "../types";
import { getSnapshotById, markSnapshotAsUndone } from "../persistence";

// ============================================
// 操作标签
// ============================================

/**
 * 获取操作类型的中文标签
 */
export function getActionLabel(action: OperationSnapshotAction): string {
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

// ============================================
// 撤销操作
// ============================================

/**
 * 执行撤销操作
 */
export async function undoOperation(
  supabase: SupabaseClientType,
  userId: string,
  snapshotId: string,
): Promise<UndoResult> {
  // 1. 获取快照
  const snapshot = await getSnapshotById(supabase, userId, snapshotId);
  if (!snapshot) {
    return { success: false, message: "操作记录不存在" };
  }

  // 2. 检查是否可撤销
  if (snapshot.is_undone) {
    return { success: false, message: "该操作已被撤销" };
  }

  const expiresAt = snapshot.expires_at
    ? new Date(snapshot.expires_at)
    : new Date(0);
  if (expiresAt < new Date()) {
    return { success: false, message: "撤销窗口已过期（超过 2 天）" };
  }

  // 3. 根据操作类型执行回滚
  try {
    const result = await executeUndo(supabase, snapshot);

    // 4. 标记快照为已撤销
    await markSnapshotAsUndone(supabase, snapshotId);

    // 5. 发送撤销成功的消息通知
    if (result.success) {
      const actionLabel = getActionLabel(
        snapshot.action as OperationSnapshotAction,
      );
      await Notify.folderOperationUndone(userId, actionLabel);

      // 6. 发布撤销事件
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
      "[UndoExecutor] Undo failed",
    );
    return {
      success: false,
      message: error instanceof Error ? error.message : "撤销操作失败",
    };
  }
}

// ============================================
// 具体撤销逻辑
// ============================================

/**
 * 执行具体的撤销逻辑
 */
export async function executeUndo(
  supabase: SupabaseClientType,
  snapshot: OperationSnapshot,
): Promise<UndoResult> {
  switch (snapshot.action) {
    case "create":
      return executeUndoCreate(supabase, snapshot);

    case "rename":
      return executeUndoRename(supabase, snapshot);

    case "split":
      return executeUndoSplit(supabase, snapshot);

    case "merge":
      return executeUndoMerge(supabase, snapshot);

    case "move":
      return executeUndoMove(supabase, snapshot);

    default:
      return {
        success: false,
        message: `不支持撤销的操作类型: ${snapshot.action}`,
      };
  }
}

/**
 * 撤销文件夹创建
 */
async function executeUndoCreate(
  supabase: SupabaseClientType,
  snapshot: OperationSnapshot,
): Promise<UndoResult> {
  if (!snapshot.before_state || !snapshot.after_state) {
    return { success: false, message: "操作快照数据不完整，无法撤销" };
  }
  const beforeState = snapshot.before_state as unknown as CreateOperationState;
  const afterState = snapshot.after_state as unknown as CreateOperationState;

  // 恢复书签到原位置
  const bookmarks = beforeState.bookmarks || [];
  for (const bookmark of bookmarks) {
    await supabase
      .from("bookmarks")
      .update({ folder_id: bookmark.folder_id })
      .eq("id", bookmark.id);
  }

  // 软删除新创建的文件夹
  const folderId =
    afterState.folder?.id || (afterState as Record<string, unknown>).folder_id;
  const folderName =
    afterState.folder?.name ||
    (afterState as Record<string, unknown>).folder_name ||
    "未知";
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

/**
 * 撤销重命名
 */
async function executeUndoRename(
  supabase: SupabaseClientType,
  snapshot: OperationSnapshot,
): Promise<UndoResult> {
  if (!snapshot.before_state) {
    return { success: false, message: "操作快照数据不完整，无法撤销" };
  }
  const beforeState = snapshot.before_state as unknown as RenameOperationState;
  const folderId = beforeState.folder_id;
  const oldName = beforeState.old_name || "未知";

  if (folderId) {
    await supabase.from("folders").update({ name: oldName }).eq("id", folderId);
  }

  return {
    success: true,
    message: `已恢复文件夹名称为「${oldName}」`,
    restoredFolders: folderId ? [folderId] : [],
  };
}

/**
 * 撤销分拆
 */
async function executeUndoSplit(
  supabase: SupabaseClientType,
  snapshot: OperationSnapshot,
): Promise<UndoResult> {
  if (!snapshot.before_state || !snapshot.after_state) {
    return { success: false, message: "操作快照数据不完整，无法撤销" };
  }
  const beforeState = snapshot.before_state as unknown as SplitOperationState;
  const afterState = snapshot.after_state as unknown as SplitOperationState;

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
    (beforeState as Record<string, unknown>).original_folder_name ||
    "未知";
  const originalFolderId =
    beforeState.original_folder?.id ||
    (beforeState as Record<string, unknown>).original_folder_id;

  return {
    success: true,
    message: `已撤销分拆文件夹「${originalFolderName}」`,
    restoredFolders: originalFolderId ? [originalFolderId as number] : [],
    restoredBookmarks: bookmarkMoves.map((m) => m.bookmark_id),
  };
}

/**
 * 撤销合并
 */
async function executeUndoMerge(
  supabase: SupabaseClientType,
  snapshot: OperationSnapshot,
): Promise<UndoResult> {
  const beforeState = snapshot.before_state as unknown as MergeOperationState;

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

/**
 * 撤销移动
 */
async function executeUndoMove(
  supabase: SupabaseClientType,
  snapshot: OperationSnapshot,
): Promise<UndoResult> {
  const beforeState = snapshot.before_state as unknown as CreateOperationState;

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
