/**
 * 文件夹领域类型定义
 * @module types/domain/folder
 * @description 统一的文件夹类型定义，作为单一真相源
 */

import type { Database } from "@/types/supabase";

// ============================================================================
// 数据库类型别名
// ============================================================================

/** 数据库文件夹行类型 */
export type FolderRow = Database["public"]["Tables"]["folders"]["Row"];

/** 数据库文件夹插入类型 */
export type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];

/** 数据库文件夹更新类型 */
export type FolderUpdate = Database["public"]["Tables"]["folders"]["Update"];

// ============================================================================
// 领域类型（统一定义）
// ============================================================================

/**
 * 带统计信息的文件夹类型
 *
 * 这是项目中唯一的 FolderWithStats 定义，所有使用方应从此处导入。
 *
 * @example
 * ```typescript
 * import { FolderWithStats, toFolderWithStats } from "@/types/domain/folder";
 *
 * const folder: FolderWithStats = toFolderWithStats(dbRow);
 * ```
 */
export interface FolderWithStats {
  // 来自数据库的字段
  id: number;
  user_id: string;
  name: string;
  parent_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  folder_group: string | null;
  sort_order: number | null;
  source: string | null;
  system_type: string | null;

  // 统一为 boolean（数据库可能为 null，转换时处理）
  is_system: boolean;
  is_archived: boolean;

  // Crystal Growth 相关字段（与数据库保持一致，使用 null 而非 undefined）
  ai_generation_source: string | null;
  crystal_birth_time: string | null;
  is_ai_generated: boolean | null;
  is_naming_pending: boolean | null;
  origin_bookmark_ids: number[] | null;

  // 统计信息（必填）
  bookmark_count: number;
  today_count: number;

  // UI 层扩展字段（可选）
  is_locked?: boolean;
}

// ============================================================================
// 类型转换器
// ============================================================================

/**
 * 数据库行转 FolderWithStats 的原始行类型
 * 用于类型断言
 */
export interface FolderWithStatsDbRow extends FolderRow {
  bookmark_count?: number;
  today_count?: number;
}

/**
 * 将数据库行转换为 FolderWithStats
 *
 * 处理 null → boolean 的转换，确保类型安全
 *
 * @param row 数据库行（可能包含 bookmark_count/today_count）
 * @returns FolderWithStats 实例
 */
export function toFolderWithStats(row: FolderWithStatsDbRow): FolderWithStats {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    parent_id: row.parent_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    folder_group: row.folder_group,
    sort_order: row.sort_order,
    source: row.source,
    system_type: row.system_type,
    // null → false
    is_system: row.is_system ?? false,
    is_archived: row.is_archived ?? false,
    // Crystal Growth 字段（默认 null）
    ai_generation_source: row.ai_generation_source ?? null,
    crystal_birth_time: row.crystal_birth_time ?? null,
    is_ai_generated: row.is_ai_generated ?? null,
    is_naming_pending: row.is_naming_pending ?? null,
    origin_bookmark_ids: row.origin_bookmark_ids ?? null,
    // 统计字段默认 0
    bookmark_count: row.bookmark_count ?? 0,
    today_count: row.today_count ?? 0,
  };
}

/**
 * 批量转换数据库行
 */
export function toFolderWithStatsList(
  rows: FolderWithStatsDbRow[],
): FolderWithStats[] {
  return rows.map(toFolderWithStats);
}
