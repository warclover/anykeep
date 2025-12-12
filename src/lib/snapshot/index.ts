/**
 * Snapshot Module - 网页快照功能
 *
 * 独立模块，实现零侵入现有功能
 *
 * @module snapshot
 */

// 类型导出
export * from "./snapshot.types";

// 服务导出
export { SnapshotService, snapshotService } from "./snapshot.service";
export type {
  CreateSnapshotOptions,
  CreateSnapshotResult,
  SnapshotQueryOptions,
} from "./snapshot.service";

// 处理器导出
export {
  processSnapshotJob,
  processRetrySnapshot,
  processCleanupSnapshots,
  processStandardSnapshot,
  processFullSnapshot,
} from "./processors";

// Browserless 服务导出（Phase 3）
export {
  BrowserlessService,
  getBrowserlessService,
  isBrowserlessConfigured,
} from "./services";
