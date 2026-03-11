/**
 * Persistence 模块索引
 *
 * @module operation-log/persistence
 * @version 2.0.0
 * @since 2025-12-25
 */

export {
  createSnapshot,
  getOperationHistory,
  getSnapshotById,
  getUndoableCount,
  cleanupExpiredSnapshots,
  markSnapshotAsUndone,
} from "./snapshot-repository";
