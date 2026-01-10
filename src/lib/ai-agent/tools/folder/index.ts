/**
 * 文件夹 Tools 模块导出
 *
 * Phase 1: 查询类 Tools（无需确认）- 3 个
 * Phase 2: 基础操作 Tools（低风险，需确认）- 6 个
 * Phase 3: 高级操作 Tools（无批量移动，使用 action/move_bookmarks）- 6 个
 *
 * @version 1.2.0
 * @since 2025-12-23
 */

// 类型导出
export * from "./types";

// ============================================
// Phase 1: 查询类 Tools
// ============================================
export { listFoldersTool } from "./list-folders.tool";
export { getFolderDetailTool } from "./get-folder-detail.tool";
export { getFolderBookmarksTool } from "./get-folder-bookmarks.tool";

// ============================================
// Phase 2: 基础操作 Tools
// ============================================
export { createFolderTool } from "./create-folder.tool";
export { renameFolderTool } from "./rename-folder.tool";
export { moveBookmarkToFolderTool } from "./move-bookmark.tool";
export { reorderFolderTool } from "./reorder-folder.tool";
export { moveFolderToGroupTool } from "./move-folder-to-group.tool";
export { toggleFolderArchiveTool } from "./toggle-folder-archive.tool";

// ============================================
// Phase 3: 高级操作 Tools
// ============================================
export { toggleFolderLockTool } from "./toggle-folder-lock.tool";
export { mergeFoldersTool } from "./merge-folders.tool";
export { splitFolderTool } from "./split-folder.tool";
export { deleteFolderTool } from "./delete-folder.tool";
export { deleteFolderBookmarksTool } from "./delete-folder-bookmarks.tool";
export { autoClassifyInboxTool } from "./auto-classify-inbox.tool";

// ============================================
// Tools 数组（用于注册）
// ============================================
import type { Tool } from "../types";

// Phase 1
import { listFoldersTool } from "./list-folders.tool";
import { getFolderDetailTool } from "./get-folder-detail.tool";
import { getFolderBookmarksTool } from "./get-folder-bookmarks.tool";

// Phase 2
import { createFolderTool } from "./create-folder.tool";
import { renameFolderTool } from "./rename-folder.tool";
import { moveBookmarkToFolderTool } from "./move-bookmark.tool";
import { reorderFolderTool } from "./reorder-folder.tool";
import { moveFolderToGroupTool } from "./move-folder-to-group.tool";
import { toggleFolderArchiveTool } from "./toggle-folder-archive.tool";

// Phase 3
import { toggleFolderLockTool } from "./toggle-folder-lock.tool";
import { mergeFoldersTool } from "./merge-folders.tool";
import { splitFolderTool } from "./split-folder.tool";
import { deleteFolderTool } from "./delete-folder.tool";
import { deleteFolderBookmarksTool } from "./delete-folder-bookmarks.tool";
import { autoClassifyInboxTool } from "./auto-classify-inbox.tool";

/**
 * 文件夹相关 Tools 数组
 *
 * Phase 1: 查询类（3 个）
 * - list_folders: 列出文件夹
 * - get_folder_detail: 获取文件夹详情
 * - get_folder_bookmarks: 获取文件夹内书签
 *
 * Phase 2: 基础操作类（6 个）
 * - create_folder: 创建文件夹
 * - rename_folder: 重命名文件夹
 * - move_bookmark_to_folder: 移动单个书签
 * - reorder_folder: 调整文件夹位置
 * - move_folder_to_group: 移动文件夹到分组
 * - toggle_folder_archive: 归档/取消归档文件夹
 *
 * Phase 3: 高级操作类（6 个）
 * - toggle_folder_lock: AI 锁定/解锁
 * - merge_folders: 合并文件夹
 * - split_folder: 拆分文件夹
 * - delete_folder: 删除文件夹
 * - delete_folder_bookmarks: 删除文件夹内书签
 * - auto_classify_inbox: 一键分类待整理
 *
 * 共计: 15 个 Tools
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const folderTools: Tool<any, any>[] = [
  // Phase 1: 查询类
  listFoldersTool,
  getFolderDetailTool,
  getFolderBookmarksTool,
  // Phase 2: 基础操作类
  createFolderTool,
  renameFolderTool,
  moveBookmarkToFolderTool,
  reorderFolderTool,
  moveFolderToGroupTool,
  toggleFolderArchiveTool,
  // Phase 3: 高级操作类
  toggleFolderLockTool,
  mergeFoldersTool,
  splitFolderTool,
  deleteFolderTool,
  deleteFolderBookmarksTool,
  autoClassifyInboxTool,
];
