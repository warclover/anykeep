/**
 * Domain Types - 业务域类型统一导出
 *
 * 这是项目级业务类型的单一来源（Single Source of Truth）
 *
 * 架构原则：
 * - 所有业务代码应该从这里导入类型，而不是直接从 @/types/supabase 导入
 * - 禁止在业务代码中重复定义 BookmarkRow、FolderRow 等类型
 * - 如需扩展字段，使用 Pick 或 extends，而不是重新定义
 *
 * @module @/types/domain
 * @version 1.1.0
 * @since 2026-01-14
 * @updated 2026-01-14 - 添加 folder.ts 和 synthesis.ts 导出
 */

import type { Database } from "@/types/supabase";

type Tables = Database["public"]["Tables"];

// ============================================================================
// 核心数据表类型
// ============================================================================

export type BookmarkRow = Tables["bookmarks"]["Row"];
export type BookmarkInsert = Tables["bookmarks"]["Insert"];
export type BookmarkUpdate = Tables["bookmarks"]["Update"];

export type FolderRow = Tables["folders"]["Row"];
export type FolderInsert = Tables["folders"]["Insert"];
export type FolderUpdate = Tables["folders"]["Update"];

export type TagRow = Tables["tags"]["Row"];
export type BookmarkTagRow = Tables["bookmark_tags"]["Row"];

// ============================================================================
// 扩展类型（常用场景）
// ============================================================================

export type BookmarkBasic = Pick<
  BookmarkRow,
  "id" | "title" | "url" | "created_at"
>;
export type FolderBasic = Pick<
  FolderRow,
  "id" | "name" | "parent_id" | "created_at"
>;

// ============================================================================
// 类型工具
// ============================================================================

export type ExtractBookmarkFields<K extends keyof BookmarkRow> = Pick<
  BookmarkRow,
  K
>;
export type ExtractFolderFields<K extends keyof FolderRow> = Pick<FolderRow, K>;

// ============================================================================
// 领域类型导出 - 从子模块重新导出
// ============================================================================

// 文件夹类型（完整版，包含 today_count, is_locked 等）
export {
  type FolderWithStats,
  type FolderWithStatsDbRow,
  toFolderWithStats,
  toFolderWithStatsList,
} from "./folder";

// 栏目类型
export {
  type FolderCategory,
  type FolderCategoryDbRow,
  toFolderCategory,
  toFolderCategoryList,
} from "./folder-category";

// 合成报告类型
export {
  REPORT_SUGGESTION_TYPES,
  type ReportSuggestionType,
  type UISupportedSuggestionType,
  type SuggestionPriority,
  type SuggestionStatus,
  type ReportSuggestion,
  type UISuggestion,
  toUISuggestion,
  toUISuggestionList,
  isUISupportedType,
} from "./synthesis";
