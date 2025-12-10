/**
 * Suggestion-related type definitions
 */

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

/**
 * Cluster result from inbox analysis
 */
export interface BookmarkCluster {
  bookmarkIds: number[];
  centroid: number[];
  avgSimilarity: number;
  sampleTitles: string[];
  suggestedName?: string;
}

/**
 * Inbox analysis result
 */
export interface InboxAnalysis {
  totalInInbox: number;
  clusters: BookmarkCluster[];
  suggestions: SuggestionInput[];
  remainingCount: number;
}

/**
 * V4.2 聚类处理状态
 * 导入并重新导出自 supabase.ts 以保持一致性
 */
import type { ClusterProcessingStatus } from "@/types/supabase";
export type { ClusterProcessingStatus };

/**
 * Organization analysis result for UI
 */
export interface OrganizationAnalysis {
  inboxCount: number;
  suggestions: OrganizationSuggestion[];
  lastAnalyzedAt: Date | null;
  nextSuggestedAnalyzeAt: Date | null;
  /** V4.2 聚类处理状态 */
  clusterStatus?: ClusterProcessingStatus;
}
