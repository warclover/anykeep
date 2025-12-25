/**
 * Operation Log 模块类型定义
 *
 * @module classification/operation-log/types
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 客户端类型
 */
export type SupabaseClientType = SupabaseClient;

/**
 * 撤销操作结果
 */
export interface UndoResult {
  success: boolean;
  message: string;
  restoredFolders?: number[];
  restoredBookmarks?: number[];
}

/**
 * 操作历史查询选项
 */
export interface OperationHistoryOptions {
  limit?: number;
  includeUndone?: boolean;
  includeExpired?: boolean;
  actionFilter?: OperationSnapshotAction[];
}

/**
 * 操作快照动作类型（从主类型模块引用）
 */
export type OperationSnapshotAction =
  | "create"
  | "split"
  | "merge"
  | "rename"
  | "move"
  | "delete";

/**
 * 快照行类型（数据库返回）
 */
export interface SnapshotRow {
  id: number;
  action: string;
  folder_id: number | null;
  folder_ids: number[] | null;
  bookmark_ids: number[] | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  expires_at: string;
  is_undone: boolean;
  undone_at: string | null;
}

/**
 * 文件夹信息
 */
export interface FolderInfo {
  id: number;
  name: string;
  parent_id: number | null;
}

/**
 * 书签信息
 */
export interface BookmarkInfo {
  id: number;
  title: string;
  folder_id: number | null;
}

/**
 * 书签移动信息
 */
export interface BookmarkMoveInfo {
  bookmark_id: number;
  from_folder_id: number;
  to_folder_id: number;
}
