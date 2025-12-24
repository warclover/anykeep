/**
 * Folder Operations Module (Backward Compatibility)
 *
 * @deprecated This module is deprecated. Please import from "@/lib/folder" instead.
 * This file is kept for backward compatibility during migration.
 *
 * @version 1.1.0
 * @since 2025-12-11
 * @deprecated 2025-12-24 - Use @/lib/folder instead
 */

// Re-export everything from the new unified folder module
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
} from "@/lib/folder";

export { FolderExecutorService, folderExecutorService } from "@/lib/folder";
