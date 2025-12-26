/**
 * AI 快照管理模块
 *
 * @module ai-snapshot
 * @version 1.0.0
 * @since 2025-12-26
 */

export {
  SnapshotManager,
  snapshotManager,
  createSnapshotManager,
} from "./snapshot.manager";

export type {
  OperationType,
  BookmarkState,
  OperationRecord,
  Snapshot,
  CreateSnapshotParams,
  UndoableOperation,
  UndoResult,
  SnapshotServiceResult,
} from "./types";
