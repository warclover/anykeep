/**
 * 快照 Tools 导出
 *
 * 这些 Tools 处理快照相关操作，
 * 包括快照对比、列表查询、删除等。
 *
 * @version 1.1.0
 * @since 2025-12-28
 * @updated 2026-01-10 - 新增 list_snapshots, delete_snapshot Tools
 */

export { compareSnapshotsTool } from "./compare-snapshots.tool";
export { listSnapshotsTool } from "./list-snapshots.tool";
export { deleteSnapshotTool } from "./delete-snapshot.tool";

// 导出所有快照 Tools 数组
import { compareSnapshotsTool } from "./compare-snapshots.tool";
import { listSnapshotsTool } from "./list-snapshots.tool";
import { deleteSnapshotTool } from "./delete-snapshot.tool";

/**
 * 快照 Tools 数组
 *
 * - compare_snapshots: 对比快照版本差异
 * - list_snapshots: 列出用户快照
 * - delete_snapshot: 删除快照
 *
 * 共计: 3 个 Tools
 */
export const snapshotTools = [
  compareSnapshotsTool,
  listSnapshotsTool,
  deleteSnapshotTool,
];
