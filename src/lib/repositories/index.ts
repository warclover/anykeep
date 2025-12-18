/**
 * Repository 模块统一导出
 * @description Phase 2 架构优化 - 数据仓库层
 * @version 1.0.0
 *
 * Repository 层职责：
 * - 统一数据获取和缓存管理
 * - 提供类型安全的数据访问接口
 * - 封装 SWR 缓存逻辑
 * - 支持乐观更新和缓存失效
 */

// ============================================================================
// Bookmark Repository
// ============================================================================
export {
  bookmarkRepository,
  bookmarkKeys,
  useBookmarkList,
  useBookmarkDetail,
  type BookmarkRepository,
} from "./bookmark.repository";

// ============================================================================
// Folder Repository
// ============================================================================
export {
  folderRepository,
  folderKeys,
  useFolderTree,
  useFolderDetail,
  useFolderSuggestions,
  type FolderWithChildren,
  type FolderRepository,
} from "./folder.repository";
