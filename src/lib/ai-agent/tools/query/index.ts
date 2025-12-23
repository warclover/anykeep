/**
 * 数据查询 Tools 导出
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

export { countBookmarksTool } from "./count-bookmarks.tool";
export { listBookmarksTool } from "./list-bookmarks.tool";
export { getStatsTool } from "./get-stats.tool";

// 导出所有查询 Tools 数组
import { countBookmarksTool } from "./count-bookmarks.tool";
import { listBookmarksTool } from "./list-bookmarks.tool";
import { getStatsTool } from "./get-stats.tool";

export const queryTools = [countBookmarksTool, listBookmarksTool, getStatsTool];
