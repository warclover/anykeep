/**
 * 文件夹画像 Repository — 独立模块
 *
 * 包含 FolderProfileRepository 和 SuggestionRepository 的完整实现，
 * 不再依赖 classification-v1 归档模块。
 *
 * @module folder/profile
 * @version 2.0.0
 * @since 2026-03-11
 */

export { FolderProfileRepository } from "./folder-profile.repository";
export { SuggestionRepository } from "./suggestion.repository";
export type {
  FolderProfile,
  SimilarFolder,
  OrganizationSuggestion,
  SuggestionInput,
  SuggestionStatus,
  SuggestionType,
} from "./types";
