/**
 * 通知集成模块
 *
 * @module classification/operation-log/notification/notification-integrations
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { OperationSnapshot, Json } from "@/lib/classification/types";
import type {
  CreateOperationState,
  RenameOperationState,
  SplitOperationState,
  MergeOperationState,
} from "@/lib/classification/types";
import { MessageService } from "@/lib/messages/message-service";
import { eventBus, OrganizationEvents } from "@/lib/shared/event-bus";
import type {
  SupabaseClientType,
  FolderInfo,
  BookmarkInfo,
  BookmarkMoveInfo,
} from "../types";
import { createSnapshot } from "../persistence";

// ============================================
// 快照创建辅助方法
// ============================================

/**
 * 创建文件夹创建操作的快照
 */
export async function createFolderCreateSnapshot(
  supabase: SupabaseClientType,
  userId: string,
  folder: FolderInfo,
  bookmarks: BookmarkInfo[],
  reason?: string,
): Promise<OperationSnapshot> {
  const beforeState: CreateOperationState = {
    folder: { id: 0, name: "", parent_id: null },
    bookmarks: bookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      folder_id: b.folder_id,
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
      folder_id: folder.id,
    })),
  };

  return createSnapshot(
    supabase,
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
export async function createRenameSnapshot(
  supabase: SupabaseClientType,
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

  return createSnapshot(
    supabase,
    userId,
    "rename",
    beforeState as Json,
    afterState as Json,
    { folderId, reason },
  );
}

/**
 * 创建文件夹分拆操作的快照
 */
export async function createSplitSnapshot(
  supabase: SupabaseClientType,
  userId: string,
  originalFolder: FolderInfo,
  newFolders: FolderInfo[],
  bookmarkMoves: BookmarkMoveInfo[],
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
      to_folder_id: originalFolder.id,
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

  return createSnapshot(
    supabase,
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
export async function createMergeSnapshot(
  supabase: SupabaseClientType,
  userId: string,
  sourceFolders: FolderInfo[],
  targetFolder: FolderInfo,
  mergedBookmarks: BookmarkInfo[],
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
      folder_id: b.folder_id,
    })),
  };

  const afterState: MergeOperationState = {
    source_folders: [],
    target_folder: {
      id: targetFolder.id,
      name: targetFolder.name,
      parent_id: targetFolder.parent_id,
    },
    merged_bookmarks: mergedBookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      folder_id: targetFolder.id,
    })),
  };

  return createSnapshot(
    supabase,
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

// ============================================
// 带通知的操作方法
// ============================================

/**
 * 创建文件夹操作并发送通知
 */
export async function createFolderWithNotification(
  supabase: SupabaseClientType,
  userId: string,
  folder: FolderInfo,
  bookmarks: BookmarkInfo[],
  reason?: string,
): Promise<OperationSnapshot> {
  const snapshot = await createFolderCreateSnapshot(
    supabase,
    userId,
    folder,
    bookmarks,
    reason,
  );

  await MessageService.notifyFolderAutoCreated(
    userId,
    folder.id,
    folder.name,
    bookmarks.length,
    reason,
    String(snapshot.id),
  );

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
export async function renameFolderWithNotification(
  supabase: SupabaseClientType,
  userId: string,
  folderId: number,
  oldName: string,
  newName: string,
  reason?: string,
): Promise<OperationSnapshot> {
  const snapshot = await createRenameSnapshot(
    supabase,
    userId,
    folderId,
    oldName,
    newName,
    reason,
  );

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
export async function splitFolderWithNotification(
  supabase: SupabaseClientType,
  userId: string,
  originalFolder: FolderInfo,
  newFolders: FolderInfo[],
  bookmarkMoves: BookmarkMoveInfo[],
  reason?: string,
): Promise<OperationSnapshot> {
  const snapshot = await createSplitSnapshot(
    supabase,
    userId,
    originalFolder,
    newFolders,
    bookmarkMoves,
    reason,
  );

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
export async function mergeFoldersWithNotification(
  supabase: SupabaseClientType,
  userId: string,
  sourceFolders: FolderInfo[],
  targetFolder: FolderInfo,
  mergedBookmarks: BookmarkInfo[],
  reason?: string,
): Promise<OperationSnapshot> {
  const snapshot = await createMergeSnapshot(
    supabase,
    userId,
    sourceFolders,
    targetFolder,
    mergedBookmarks,
    reason,
  );

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
export async function sendEvolutionReport(
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
