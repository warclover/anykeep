/**
 * 操作日志服务 — 桥接导出
 *
 * 实际实现位于 classification/services/operation-log/，
 * Phase 8 迁移时将物理移入此目录。
 *
 * 职责：文件夹层级操作（创建/分拆/合并/重命名）的快照、撤销和通知。
 * 与 classification-v2/operation-log.ts（单条书签分类撤销）互补，不重复。
 *
 * @module operation-log
 * @version 1.0.0
 * @since 2026-03-10
 */

// 主服务（单例）
export {
  OperationLogService,
  operationLogService,
} from "@/lib/classification/services/operation-log/operation-log.service";

// 类型
export type {
  UndoResult,
  OperationHistoryOptions,
  OperationSnapshotAction,
  FolderInfo,
  BookmarkInfo,
  BookmarkMoveInfo,
} from "@/lib/classification/services/operation-log/types";

// 持久化
export {
  createSnapshot,
  getOperationHistory,
  getSnapshotById,
  getUndoableCount,
  cleanupExpiredSnapshots,
} from "@/lib/classification/services/operation-log/persistence";

// 撤销
export {
  undoOperation,
  getActionLabel,
} from "@/lib/classification/services/operation-log/undo";

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
} from "@/lib/classification/services/operation-log/notification";
