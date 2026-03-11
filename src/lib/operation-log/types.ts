/**
 * Operation Log 模块类型定义
 *
 * 从 @/types/supabase 派生操作快照相关类型，
 * 不再依赖 classification-v1 归档模块。
 *
 * @module operation-log/types
 * @version 2.0.0
 * @since 2025-12-25
 */

import type { Database, Json } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Supabase 派生类型
// ============================================================================

type Tables = Database["public"]["Tables"];

/** 操作快照行类型（数据库返回） */
export type OperationSnapshotRow = Tables["operation_snapshots"]["Row"];

/** 操作快照插入类型 */
export type OperationSnapshotInsert = Tables["operation_snapshots"]["Insert"];

/** 操作快照（Row 别名，与旧 classification/types 保持一致） */
export type OperationSnapshot = OperationSnapshotRow;

/** Re-export Json type for convenience */
export type { Json };

// ============================================================================
// Supabase 客户端类型
// ============================================================================

export type SupabaseClientType = SupabaseClient;

// ============================================================================
// 操作快照动作类型
// ============================================================================

/**
 * 操作快照动作类型（从数据库模式同步）
 */
export type OperationSnapshotAction =
  | "create"
  | "split"
  | "merge"
  | "rename"
  | "move"
  | "delete"
  | "update"
  | "archive"
  | "add_tag"
  | "remove_tag"
  | "batch_move"
  | "batch_tag"
  | "batch_delete"
  | "merge_folder"
  | "create_folder"
  | "rename_folder"
  | "delete_folder"
  | "undo";

// ============================================================================
// 操作快照状态类型
// ============================================================================

/**
 * 创建文件夹操作状态 (snake_case 匹配数据库字段)
 */
export interface CreateOperationState {
  folder?: { id: number; name: string; parent_id?: number | null };
  folder_id?: number;
  folder_name?: string;
  bookmark_ids?: number[];
  bookmarks?: Array<{ id: number; title: string; folder_id: number | null }>;
  source?: string;
}

/**
 * 分拆文件夹操作状态
 */
export interface SplitOperationState {
  original_folder?: { id: number; name: string; parent_id?: number | null };
  original_folder_id?: number;
  original_folder_name?: string;
  new_folders?: Array<{
    id: number;
    name: string;
    parent_id?: number | null;
    bookmark_ids?: number[];
  }>;
  bookmark_moves?: Array<{
    bookmark_id: number;
    from_folder_id: number;
    to_folder_id: number;
  }>;
  source?: string;
}

/**
 * 合并文件夹操作状态
 */
export interface MergeOperationState {
  source_folders?: Array<{
    id: number;
    name: string;
    parent_id?: number | null;
    bookmark_ids?: number[];
  }>;
  target_folder?: {
    id: number;
    name: string;
    parent_id?: number | null;
  };
  target_folder_id?: number;
  target_folder_name?: string;
  merged_bookmarks?: Array<{
    id: number;
    title: string;
    folder_id: number | null;
  }>;
  source?: string;
}

/**
 * 重命名文件夹操作状态
 */
export interface RenameOperationState {
  folder_id?: number;
  old_name?: string;
  new_name?: string;
  source?: string;
}

// ============================================================================
// 业务类型
// ============================================================================

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
 * 快照行类型（数据库返回，查询映射用）
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
