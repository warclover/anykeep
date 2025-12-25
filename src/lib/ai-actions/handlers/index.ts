/**
 * AI Action Handlers Index
 *
 * 统一导出所有操作处理器
 *
 * @module ai-actions/handlers
 * @version 1.0.0
 * @since 2025-12-25
 */

// Bookmark handlers
export {
  bookmarkSearch,
  bookmarkGet,
  bookmarkList,
  bookmarkRelated,
  bookmarkCreate,
  bookmarkUpdate,
  bookmarkMove,
  bookmarkDelete,
  bookmarkRate,
} from "./bookmark-handlers";

// Folder handlers
export {
  folderList,
  folderGet,
  folderBookmarks,
  folderCreate,
  folderUpdate,
  folderDelete,
} from "./folder-handlers";

// Tag handlers
export {
  tagList,
  tagBookmarks,
  tagAdd,
  tagRemove,
  tagBatchAdd,
  tagBatchRemove,
} from "./tag-handlers";

// User handlers
export { userPreferences, userStats } from "./user-handlers";
