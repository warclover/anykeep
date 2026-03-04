/**
 * V4.2.17: 首页 Hooks 统一导出
 *
 * Phase 2.2 - 适配层构建
 * 提供首页相关的所有自定义 Hooks
 */

// 视图模式 Hook（已存在）
export { useHomeViewMode } from "./use-home-view-mode";

// 书签数据 Hook（新增）
export { useHomeBookmarks } from "./use-home-bookmarks";
export type {
  UseHomeBookmarksOptions,
  UseHomeBookmarksReturn,
} from "./use-home-bookmarks";

// 书签 CRUD 操作 Hook（Phase 2.3.1）
export { useHomeMutations } from "./use-home-mutations";
export type {
  UseHomeMutationsOptions,
  UseHomeMutationsReturn,
} from "./use-home-mutations";

// 批量操作 Hook（Phase 2.3.2）
export { useHomeBatch } from "./use-home-batch";
export type { UseHomeBatchOptions, UseHomeBatchReturn } from "./use-home-batch";

// URL 同步 Hook
export { useHomeUrlSync } from "./use-home-url-sync";
export type { UseHomeUrlSyncReturn } from "./use-home-url-sync";

// 书签数据获取 Hook
export { useHomeBookmarkData } from "./use-home-bookmark-data";

// 加载更多 Hook
export { useHomeLoadMore } from "./use-home-load-more";

// 对话框 Hook
export { useHomeDialogs } from "./use-home-dialogs";
