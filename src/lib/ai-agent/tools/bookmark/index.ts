/**
 * 书签 Tools 导出
 *
 * 这些 Tools 处理书签的基本操作，
 * 包括已读/星标状态切换、删除、创建、更新、批量操作和快照。
 *
 * @version 1.1.0
 * @since 2025-12-23
 */

export { toggleBookmarkReadTool } from "./toggle-bookmark-read.tool";
export { toggleBookmarkStarredTool } from "./toggle-bookmark-starred.tool";
export { deleteBookmarkTool } from "./delete-bookmark.tool";
export { createBookmarkTool } from "./create-bookmark.tool";
export { updateBookmarkTool } from "./update-bookmark.tool";
export { batchDeleteBookmarksTool } from "./batch-delete-bookmarks.tool";
export { createSnapshotTool } from "./create-snapshot.tool";

// 导出所有书签 Tools 数组
import { toggleBookmarkReadTool } from "./toggle-bookmark-read.tool";
import { toggleBookmarkStarredTool } from "./toggle-bookmark-starred.tool";
import { deleteBookmarkTool } from "./delete-bookmark.tool";
import { createBookmarkTool } from "./create-bookmark.tool";
import { updateBookmarkTool } from "./update-bookmark.tool";
import { batchDeleteBookmarksTool } from "./batch-delete-bookmarks.tool";
import { createSnapshotTool } from "./create-snapshot.tool";

export const bookmarkTools = [
  toggleBookmarkReadTool,
  toggleBookmarkStarredTool,
  deleteBookmarkTool,
  createBookmarkTool,
  updateBookmarkTool,
  batchDeleteBookmarksTool,
  createSnapshotTool,
];
