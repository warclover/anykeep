/**
 * Folder Operations Types
 * V4.2 文件夹操作执行器类型定义
 *
 * @module folder/operations
 * @version 1.1.0
 * @since 2025-12-11
 * @updated 2025-12-24 - Migrated to unified folder module
 */

// ============================================================================
// 执行输入类型
// ============================================================================

/**
 * 文件夹创建输入
 */
export interface FolderCreateInput {
  userId: string;
  name: string;
  parentId?: number | null;
  bookmarkIds: number[];
  reason: string;
  tags?: string[];
}

/**
 * 文件夹合并输入
 */
export interface FolderMergeInput {
  userId: string;
  targetFolderId: number;
  sourceFolderIds: number[];
  reason: string;
}

/**
 * 文件夹拆分输入
 */
export interface FolderSplitInput {
  userId: string;
  sourceFolderId: number;
  subFolders: Array<{
    name: string;
    bookmarkIds: number[];
  }>;
  reason: string;
}

/**
 * 文件夹重命名输入
 */
export interface FolderRenameInput {
  userId: string;
  folderId: number;
  newName: string;
  reason: string;
}

// ============================================================================
// 执行结果类型
// ============================================================================

/**
 * 基础执行结果
 */
export interface BaseExecutionResult {
  success: boolean;
  message: string;
  snapshotId?: string;
}

/**
 * 文件夹创建结果
 */
export interface FolderCreateResult extends BaseExecutionResult {
  folderId?: number;
  folderName?: string;
  movedBookmarkCount?: number;
}

/**
 * 文件夹合并结果
 */
export interface FolderMergeResult extends BaseExecutionResult {
  targetFolderId?: number;
  targetFolderName?: string;
  mergedFolderCount?: number;
  movedBookmarkCount?: number;
}

/**
 * 文件夹拆分结果
 */
export interface FolderSplitResult extends BaseExecutionResult {
  newFolders?: Array<{
    id: number;
    name: string;
    bookmarkCount: number;
  }>;
}

/**
 * 文件夹重命名结果
 */
export interface FolderRenameResult extends BaseExecutionResult {
  folderId?: number;
  oldName?: string;
  newName?: string;
}

/**
 * 统一执行结果类型
 */
export type ExecutionResult =
  | FolderCreateResult
  | FolderMergeResult
  | FolderSplitResult
  | FolderRenameResult;
