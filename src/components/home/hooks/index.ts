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
