/**
 * Folder Operations Module
 * 文件夹操作模块导出
 *
 * @module folder/operations
 * @version 1.1.0
 * @since 2025-12-11
 * @updated 2025-12-24 - Migrated to unified folder module
 */

// Types
export type {
  FolderCreateInput,
  FolderMergeInput,
  FolderSplitInput,
  FolderRenameInput,
  FolderCreateResult,
  FolderMergeResult,
  FolderSplitResult,
  FolderRenameResult,
  ExecutionResult,
  BaseExecutionResult,
} from "./types";

// Service
export {
  FolderExecutorService,
  folderExecutorService,
} from "./executor.service";
