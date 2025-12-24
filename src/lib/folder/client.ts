/**
 * Folder 模块 - 客户端安全导出
 *
 * ⚠️ 重要：此文件仅包含客户端安全的导出
 *
 * 客户端组件应该从此文件导入：
 * import { setFoldersCache, clearFoldersCache } from "@/lib/folder/client"
 *
 * 不要从 "@/lib/folder" 导入，因为那会引入服务端代码！
 *
 * @module folder/client
 * @version 1.0.0
 * @since 2025-12-25
 */

// ============================================================================
// Folder Cache - 客户端缓存（纯客户端代码，无服务端依赖）
// ============================================================================

export {
  FOLDERS_CACHE_KEY,
  CACHE_STALE_TIME,
  CACHE_MAX_AGE,
  getFoldersCache,
  setFoldersCache,
  isFoldersCacheFresh,
  getFoldersCacheTimestamp,
  clearFoldersCache,
} from "./cache";

// ============================================================================
// Types - 纯类型定义（可在客户端使用）
// ============================================================================

// Operations Types
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
} from "./operations";

// Organization Domain Types
export type { FolderProfile, FolderProfileUpdate } from "./organization/types";
