/**
 * Folder Profile module types
 *
 * Extracted from classification-v1 types for independent usage.
 *
 * @module folder/profile
 * @version 1.0.0
 * @since 2026-03-11
 */

// ============================================================================
// Folder Profile Types
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
 * Similar folder search result
 */
export interface SimilarFolder {
  folderId: number;
  folderName: string;
  bookmarkCount: number;
  topTags: string[];
  sampleTitles: string[];
  similarity: number;
}

// ============================================================================
// Suggestion Types
// ============================================================================

/**
 * Organization suggestion type
 */
export type SuggestionType =
  | "move_to_existing"
  | "create_new"
  | "merge"
  | "split";

/**
 * Suggestion status
 */
export type SuggestionStatus = "pending" | "accepted" | "rejected" | "expired";

/**
 * Organization suggestion from database
 */
export interface OrganizationSuggestion {
  id: number;
  userId: string;
  suggestionType: SuggestionType;
  bookmarkIds: number[];
  targetFolderId: number | null;
  suggestedFolderName: string | null;
  confidence: number;
  reason: string | null;
  sampleTitles: string[];
  status: SuggestionStatus;
  createdAt: Date;
  respondedAt: Date | null;
}

/**
 * Suggestion creation input
 */
export interface SuggestionInput {
  suggestionType: SuggestionType;
  bookmarkIds: number[];
  targetFolderId?: number;
  suggestedFolderName?: string;
  confidence: number;
  reason?: string;
  sampleTitles?: string[];
}
