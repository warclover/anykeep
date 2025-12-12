/**
 * Snapshot Processors Module (V4.2.1)
 * 快照任务处理器导出
 *
 * 处理器类型：
 * - Basic: Readability 正文提取（默认）
 * - Standard: 完整 HTML + CSS 内联（Pro）
 * - Full: 含截图（Pro+，Phase 3）
 */

// Basic 处理器（Phase 1）
export {
  processSnapshotJob,
  processRetrySnapshot,
  processCleanupSnapshots,
} from "./snapshot.processor";

// Standard 处理器（Phase 2）
export { processStandardSnapshot } from "./standard.processor";

// Full 处理器（Phase 3）
export { processFullSnapshot } from "./full.processor";
