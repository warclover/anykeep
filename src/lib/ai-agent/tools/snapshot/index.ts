/**
 * 快照 Tools 导出
 *
 * 这些 Tools 处理快照相关操作，
 * 包括快照对比、版本管理等。
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

export { compareSnapshotsTool } from "./compare-snapshots.tool";

// 导出所有快照 Tools 数组
import { compareSnapshotsTool } from "./compare-snapshots.tool";

export const snapshotTools = [compareSnapshotsTool];
