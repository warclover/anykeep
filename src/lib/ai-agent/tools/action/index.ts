/**
 * 操作 Tools 导出
 *
 * 这些 Tools 执行实际的数据修改操作，
 * 大多数需要用户确认才能执行。
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

export { batchTagsTool } from "./batch-tags.tool";
export { moveBookmarksTool } from "./move-bookmarks.tool";

// 导出所有操作 Tools 数组
import { batchTagsTool } from "./batch-tags.tool";
import { moveBookmarksTool } from "./move-bookmarks.tool";

export const actionTools = [batchTagsTool, moveBookmarksTool];
