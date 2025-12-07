/**
 * Classification-related type definitions
 */

/**
 * User classification stage
 */
export type ClassificationStage =
  | "onboarding"
  | "cold_start"
  | "growing"
  | "mature";

/**
 * Classification action
 */
export type ClassificationAction =
  | "classify"
  | "inbox"
  | "suggest"
  | "suggest_new"
  | "suggest_create"
  | "auto_create";

/**
 * Match result from a single matcher
 */
export interface MatchResult {
  folderId: number;
  folderName: string;
  score: number; // 0-100 score
  confidence: number; // confidence level
  reason: string; // match reason
  metadata?: Record<string, unknown>; // extra metadata
}

/**
 * Matcher context - input for matchers
 */
export interface MatcherContext {
  userId: string;
  /** 当前书签 ID，用于排除自匹配 */
  bookmarkId?: number;
  title: string;
  summary: string;
  tags: string[];
  embedding: number[];
}

/**
 * Classification result
 */
export interface ClassificationResult {
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason: string;
  action: ClassificationAction;
  scores: {
    vectorScore: number;
    historyScore: number;
    aiScore: number;
  };
  matchDetails?: MatchResult[]; // detailed match info (for debugging)
}

/**
 * Bookmark input for classification
 */
export interface BookmarkInput {
  /** 书签 ID（可选，用于排除自匹配） */
  id?: number;
  title: string;
  summary?: string;
  tags?: string[];
  embedding?: number[];
  url?: string;
}

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

/**
 * Similar bookmark with folder info
 */
export interface SimilarBookmarkWithFolder {
  bookmarkId: number;
  bookmarkTitle: string;
  folderId: number | null;
  folderName: string | null;
  similarity: number;
}

/**
 * Folder statistics
 */
export interface FolderStats {
  totalFolders: number;
  foldersToday: number;
  canCreateMore: boolean;
  dailyRemaining: number;
}

/**
 * Vector match detail
 */
export interface VectorMatchDetail extends MatchResult {
  topTags: string[];
  sampleTitles: string[];
  bookmarkCount: number;
}

/**
 * History match detail
 */
export interface HistoryMatchDetail extends MatchResult {
  similarBookmarkCount: number;
  similarTitles: string[];
}

/**
 * AI recommendation context
 */
export interface AIRecommendationContext {
  title: string;
  summary: string;
  tags: string[];
  vectorMatches: VectorMatchDetail[];
  historyMatches: HistoryMatchDetail[];
  allFolders: Array<{ id: number; name: string }>;
}

/**
 * AI recommendation result
 */
export interface AIRecommendation {
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason: string;
  suggestNew?: boolean;
}
