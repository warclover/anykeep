/**
 * 领域类型统一导出
 * @module types/domain
 * @description 所有领域类型的单一入口
 */

// ============================================================================
// 文件夹领域类型
// ============================================================================

export type {
  FolderRow,
  FolderInsert,
  FolderUpdate,
  FolderWithStats,
  FolderWithStatsDbRow,
} from "./folder";

export { toFolderWithStats, toFolderWithStatsList } from "./folder";

// ============================================================================
// 合成报告领域类型
// ============================================================================

export type {
  ReportSuggestionType,
  UISupportedSuggestionType,
  SuggestionPriority,
  SuggestionStatus,
  ReportSuggestion,
  UISuggestion,
} from "./synthesis";

export {
  REPORT_SUGGESTION_TYPES,
  toUISuggestion,
  toUISuggestionList,
  isUISupportedType,
} from "./synthesis";
