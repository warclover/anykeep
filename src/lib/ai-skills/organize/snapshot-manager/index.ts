/**
 * SnapshotManager 模块导出
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

// 类型导出
export type {
  OrganizeSnapshotAction,
  BookmarkStateSnapshot,
  FolderStateSnapshot,
  CategorizeOperationSnapshot,
  TagOperationSnapshot,
  DedupeOperationSnapshot,
  ArchiveOperationSnapshot,
  DeleteOperationSnapshot,
  OrganizeOperationSnapshot,
  OrganizeSnapshot,
  CreateSnapshotInput,
  UpdateSnapshotInput,
  UndoResult,
  SnapshotManagerConfig,
} from "./types";

// 常量导出
export { ORGANIZE_ACTION_TO_SNAPSHOT, DEFAULT_SNAPSHOT_CONFIG } from "./types";

// 服务导出
export { SnapshotManager, snapshotManager } from "./snapshot-manager";
