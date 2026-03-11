/**
 * Folder Health 模块本地类型定义
 *
 * 从 classification-v1 提取的最小类型子集，
 * 仅包含 FolderHealthService 所需的接口。
 *
 * @module folder/health
 * @version 1.0.0
 * @since 2026-03-11
 */

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Folder profile from database
 */
export interface FolderProfile {
  id: number;
  userId: string;
  folderId: number;
  folderName?: string;
  profileEmbedding: number[] | null;
  bookmarkCount: number;
  lastBookmarkAt: Date | null;
  topTags: string[];
  sampleTitles: string[];
  internalSimilarity: number | null;
  source: string | null;
  computedAt: Date;
  updatedAt: Date;
}

/**
 * Suggestion creation input
 */
export interface SuggestionInput {
  suggestionType: "move_to_existing" | "create_new" | "merge" | "split";
  bookmarkIds: number[];
  targetFolderId?: number;
  suggestedFolderName?: string;
  confidence: number;
  reason?: string;
  sampleTitles?: string[];
}

// ============================================================================
// Repository Interfaces (依赖注入用)
// ============================================================================

/**
 * FolderProfileRepository 最小接口
 * FolderHealthService 仅使用 findByUserId
 */
export interface FolderProfileRepository {
  findByUserId(userId: string): Promise<FolderProfile[]>;
}

/**
 * SuggestionRepository 最小接口
 * FolderHealthService 仅使用 create
 */
export interface SuggestionRepository {
  create(userId: string, input: SuggestionInput): Promise<unknown>;
}
