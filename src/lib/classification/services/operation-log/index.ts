/**
 * Operation Log 模块索引
 *
 * @module classification/operation-log
 * @version 1.0.0
 * @since 2025-12-25
 */

// 类型导出
export type {
  UndoResult,
  OperationHistoryOptions,
  OperationSnapshotAction,
  FolderInfo,
  BookmarkInfo,
  BookmarkMoveInfo,
} from "./types";

// 持久化
export {
  createSnapshot,
  getOperationHistory,
  getSnapshotById,
  getUndoableCount,
  cleanupExpiredSnapshots,
} from "./persistence";

// 撤销
export { undoOperation, getActionLabel } from "./undo";

// 通知集成
export {
  createFolderCreateSnapshot,
  createRenameSnapshot,
  createSplitSnapshot,
  createMergeSnapshot,
  createFolderWithNotification,
  renameFolderWithNotification,
  splitFolderWithNotification,
  mergeFoldersWithNotification,
  sendEvolutionReport,
} from "./notification";

// 主服务（向后兼容）
export {
  OperationLogService,
  operationLogService,
} from "./operation-log.service";
