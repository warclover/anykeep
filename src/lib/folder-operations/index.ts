/**
 * Folder Operations Module
 * V4.2 文件夹操作模块导出
 *
 * @version 1.0.0
 * @since 2025-12-11
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
} from "./folder-executor.types";

// Service
export {
  FolderExecutorService,
  folderExecutorService,
} from "./folder-executor.service";
