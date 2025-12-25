/**
 * BatchOrganizeSkill 步骤模块索引
 *
 * 统一导出所有步骤函数
 *
 * @module ai-skills/skills/batch-organize/steps
 * @version 1.0.0
 * @since 2025-12-25
 */

// 类型导出
export type {
  BookmarkRow,
  FolderRow,
  ExecutionResult,
  FolderSuggestionResult,
} from "./types";

// 数据获取
export { fetchBookmarks, fetchFolders } from "./data-fetching.step";

// 分类建议
export {
  generateCategorizeSuggestions,
  suggestFolder,
} from "./categorize.step";

// 标签建议
export { generateTagSuggestions } from "./tag.step";

// 重复检测
export { findDuplicates, normalizeUrl } from "./duplicate.step";

// 归档候选
export { findArchiveCandidates } from "./archive.step";

// 报告生成
export {
  generateSummary,
  generateOrganizeSuggestions,
  buildConfirmationMessage,
} from "./report.step";

// 自动执行
export {
  executeCategorizeSuggestions,
  executeTagSuggestions,
  executeDuplicateCleanup,
  executeArchive,
} from "./execute.step";
