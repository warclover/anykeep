/**
 * Folder Health Service
 * Analyzes folder quality and generates merge/split suggestions
 *
 * 从 classification-v1/services/folder-health.service 迁移，
 * 所有依赖改为本地模块引用。
 *
 * @module folder/health
 * @version 2.0.0
 * @since 2026-03-11
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FolderProfile,
  FolderProfileRepository,
  SuggestionInput,
  SuggestionRepository,
} from "./types";
import { FOLDER_LIMITS } from "./constants";
import { cosineSimilarity } from "./similarity";
import { logger } from "@/lib/logger";

/**
 * Folder health status
 */
export type FolderHealthStatus = "healthy" | "needs_attention" | "critical";

/**
 * Merge suggestion detail
 */
export interface MergeSuggestion {
  folder1: {
    id: number;
    name: string;
    bookmarkCount: number;
  };
  folder2: {
    id: number;
    name: string;
    bookmarkCount: number;
  };
  similarity: number;
  reason: string;
  suggestedAction: "merge_to_first" | "merge_to_second" | "rename_and_merge";
}

/**
 * Split suggestion detail
 */
export interface SplitSuggestion {
  folderId: number;
  folderName: string;
  bookmarkCount: number;
  internalSimilarity: number;
  reason: string;
  suggestedClusters?: number; // Estimated number of sub-categories
}

/**
 * Folder health report
 */
export interface FolderHealthReport {
  userId: string;
  status: FolderHealthStatus;
  totalFolders: number;
  healthyFolders: number;
  foldersNeedingAttention: number;
  mergeSuggestions: MergeSuggestion[];
  splitSuggestions: SplitSuggestion[];
  analyzedAt: Date;
}

/**
 * Service for analyzing folder health and generating suggestions
 */
export class FolderHealthService {
  constructor(
    private folderProfileRepo: FolderProfileRepository,
    private suggestionRepo: SuggestionRepository,
    private supabase: SupabaseClient,
  ) {}

  /**
   * Run full health check for a user's folders
   */
  async checkHealth(userId: string): Promise<FolderHealthReport> {
    try {
      logger.info(
        { userId, action: "folder_health_check_start" },
        "FolderHealth: Starting health check",
      );

      // Get all folder profiles
      const profiles = await this.folderProfileRepo.findByUserId(userId);

      if (profiles.length === 0) {
        return this.createEmptyReport(userId);
      }

      // Find merge candidates
      const mergeSuggestions = this.findMergeCandidates(profiles);

      // Find split candidates
      const splitSuggestions = this.findSplitCandidates(profiles);

      // Calculate overall health status
      const status = this.calculateHealthStatus(
        profiles,
        mergeSuggestions,
        splitSuggestions,
      );

      const report: FolderHealthReport = {
        userId,
        status,
        totalFolders: profiles.length,
        healthyFolders: profiles.filter((p) => this.isFolderHealthy(p)).length,
        foldersNeedingAttention:
          mergeSuggestions.length + splitSuggestions.length,
        mergeSuggestions,
        splitSuggestions,
        analyzedAt: new Date(),
      };

      logger.info(
        {
          userId,
          status,
          totalFolders: report.totalFolders,
          mergeCount: mergeSuggestions.length,
          splitCount: splitSuggestions.length,
          action: "folder_health_check_complete",
        },
        "FolderHealth: Health check complete",
      );

      return report;
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          action: "folder_health_check_error",
        },
        "FolderHealth: Health check failed",
      );
      // Return healthy empty report as fallback
      return this.createEmptyReport(userId);
    }
  }

  /**
   * Find folders that should be merged
   * Optimized: Pre-filters embeddings, early termination, performance logging
   */
  findMergeCandidates(profiles: FolderProfile[]): MergeSuggestion[] {
    const startTime = performance.now();
    const suggestions: MergeSuggestion[] = [];
    const threshold = FOLDER_LIMITS.MERGE_SIMILARITY_THRESHOLD;
    const maxSuggestions = FOLDER_LIMITS.MAX_MERGE_SUGGESTIONS;

    // Pre-filter: Only profiles with valid embeddings
    const profilesWithEmbeddings = profiles.filter(
      (p): p is FolderProfile & { profileEmbedding: number[] } =>
        p.profileEmbedding !== null &&
        p.profileEmbedding !== undefined &&
        p.profileEmbedding.length > 0,
    );

    const totalPairs =
      (profilesWithEmbeddings.length * (profilesWithEmbeddings.length - 1)) / 2;
    let comparisons = 0;

    // Compare folder pairs with early termination
    outer: for (let i = 0; i < profilesWithEmbeddings.length; i++) {
      for (let j = i + 1; j < profilesWithEmbeddings.length; j++) {
        const p1 = profilesWithEmbeddings[i];
        const p2 = profilesWithEmbeddings[j];
        comparisons++;

        // Calculate similarity (embeddings guaranteed to exist from pre-filter)
        const similarity = cosineSimilarity(
          p1.profileEmbedding,
          p2.profileEmbedding,
        );

        if (similarity >= threshold) {
          suggestions.push(this.createMergeSuggestion(p1, p2, similarity));

          // Early termination: Stop if we have enough high-quality suggestions
          if (suggestions.length >= maxSuggestions * 2) {
            break outer;
          }
        }
      }
    }

    // Sort by similarity descending and limit results
    suggestions.sort((a, b) => b.similarity - a.similarity);
    const result = suggestions.slice(0, maxSuggestions);

    const duration = performance.now() - startTime;
    logger.debug(
      {
        totalProfiles: profiles.length,
        profilesWithEmbeddings: profilesWithEmbeddings.length,
        totalPairs,
        comparisons,
        candidatesFound: suggestions.length,
        returned: result.length,
        durationMs: duration.toFixed(2),
        action: "find_merge_candidates_perf",
      },
      `FolderHealth: findMergeCandidates completed in ${duration.toFixed(2)}ms`,
    );

    return result;
  }

  /**
   * Find folders that should be split
   * Optimized: Uses constants, performance logging
   */
  findSplitCandidates(profiles: FolderProfile[]): SplitSuggestion[] {
    const startTime = performance.now();
    const suggestions: SplitSuggestion[] = [];
    const sizeThreshold = FOLDER_LIMITS.SPLIT_SIZE_THRESHOLD;
    const diversityThreshold = FOLDER_LIMITS.SPLIT_DIVERSITY_THRESHOLD;
    const maxSuggestions = FOLDER_LIMITS.MAX_SPLIT_SUGGESTIONS;

    for (const profile of profiles) {
      // Check size threshold
      if (profile.bookmarkCount < sizeThreshold) {
        continue;
      }

      // Check internal similarity (lower = more diverse = needs split)
      if (
        profile.internalSimilarity !== null &&
        profile.internalSimilarity < diversityThreshold
      ) {
        suggestions.push({
          folderId: profile.folderId,
          folderName: profile.folderName || `Folder ${profile.folderId}`,
          bookmarkCount: profile.bookmarkCount,
          internalSimilarity: profile.internalSimilarity,
          reason: this.getSplitReason(profile),
          suggestedClusters: this.estimateClusterCount(profile),
        });
      }
    }

    // Sort by bookmark count descending (prioritize largest folders)
    suggestions.sort((a, b) => b.bookmarkCount - a.bookmarkCount);
    const result = suggestions.slice(0, maxSuggestions);

    const duration = performance.now() - startTime;
    logger.debug(
      {
        totalProfiles: profiles.length,
        candidatesFound: suggestions.length,
        returned: result.length,
        durationMs: duration.toFixed(2),
        action: "find_split_candidates_perf",
      },
      `FolderHealth: findSplitCandidates completed in ${duration.toFixed(2)}ms`,
    );

    return result;
  }

  /**
   * Save suggestions to database for later review
   */
  async saveSuggestions(
    userId: string,
    report: FolderHealthReport,
  ): Promise<number> {
    try {
      let savedCount = 0;

      // Save merge suggestions
      for (const merge of report.mergeSuggestions) {
        const suggestion: SuggestionInput = {
          suggestionType: "merge",
          bookmarkIds: [], // Merge applies to entire folders
          targetFolderId:
            merge.suggestedAction === "merge_to_first"
              ? merge.folder1.id
              : merge.folder2.id,
          confidence: Math.round(merge.similarity * 100),
          reason: merge.reason,
          sampleTitles: [],
        };

        await this.suggestionRepo.create(userId, suggestion);
        savedCount++;
      }

      // Save split suggestions
      for (const split of report.splitSuggestions) {
        const suggestion: SuggestionInput = {
          suggestionType: "split",
          bookmarkIds: [], // Split applies to entire folder
          targetFolderId: split.folderId,
          confidence: Math.round((1 - (split.internalSimilarity || 0)) * 100),
          reason: split.reason,
          sampleTitles: [],
        };

        await this.suggestionRepo.create(userId, suggestion);
        savedCount++;
      }

      return savedCount;
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "folder_health_save_suggestions_error",
        },
        "FolderHealth: Failed to save suggestions",
      );
      return 0;
    }
  }

  /**
   * Get quick health summary (without detailed suggestions)
   */
  async getQuickSummary(userId: string): Promise<{
    status: FolderHealthStatus;
    totalFolders: number;
    issueCount: number;
  }> {
    try {
      const profiles = await this.folderProfileRepo.findByUserId(userId);

      if (profiles.length === 0) {
        return { status: "healthy", totalFolders: 0, issueCount: 0 };
      }

      // Quick check for potential issues
      let issueCount = 0;

      // Check for potential merges (simplified)
      for (let i = 0; i < profiles.length && issueCount < 10; i++) {
        for (let j = i + 1; j < profiles.length && issueCount < 10; j++) {
          const p1 = profiles[i];
          const p2 = profiles[j];
          if (p1.profileEmbedding && p2.profileEmbedding) {
            const sim = cosineSimilarity(
              p1.profileEmbedding,
              p2.profileEmbedding,
            );
            if (sim >= FOLDER_LIMITS.MERGE_SIMILARITY_THRESHOLD) {
              issueCount++;
            }
          }
        }
      }

      // Check for potential splits
      for (const profile of profiles) {
        if (
          profile.bookmarkCount >= FOLDER_LIMITS.SPLIT_SIZE_THRESHOLD &&
          profile.internalSimilarity !== null &&
          profile.internalSimilarity < FOLDER_LIMITS.SPLIT_DIVERSITY_THRESHOLD
        ) {
          issueCount++;
        }
      }

      const status: FolderHealthStatus =
        issueCount === 0
          ? "healthy"
          : issueCount <= 3
            ? "needs_attention"
            : "critical";

      return {
        status,
        totalFolders: profiles.length,
        issueCount,
      };
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
          action: "folder_health_quick_summary_error",
        },
        "FolderHealth: Failed to get quick summary",
      );
      return { status: "healthy", totalFolders: 0, issueCount: 0 };
    }
  }

  // ========== Private Helper Methods ==========

  private createMergeSuggestion(
    p1: FolderProfile,
    p2: FolderProfile,
    similarity: number,
  ): MergeSuggestion {
    // Suggest merging smaller folder into larger one
    const [larger, smaller] =
      p1.bookmarkCount >= p2.bookmarkCount ? [p1, p2] : [p2, p1];

    return {
      folder1: {
        id: larger.folderId,
        name: larger.folderName || `Folder ${larger.folderId}`,
        bookmarkCount: larger.bookmarkCount,
      },
      folder2: {
        id: smaller.folderId,
        name: smaller.folderName || `Folder ${smaller.folderId}`,
        bookmarkCount: smaller.bookmarkCount,
      },
      similarity,
      reason: this.getMergeReason(larger, smaller, similarity),
      suggestedAction: "merge_to_first",
    };
  }

  private getMergeReason(
    larger: FolderProfile,
    smaller: FolderProfile,
    similarity: number,
  ): string {
    const simPercent = Math.round(similarity * 100);

    // Check if tags overlap
    const tagOverlap = larger.topTags.filter((t) =>
      smaller.topTags.includes(t),
    );

    if (tagOverlap.length > 0) {
      return (
        `「${larger.folderName}」与「${smaller.folderName}」内容相似度 ${simPercent}%，` +
        `共同主题：${tagOverlap.slice(0, 3).join("、")}。建议合并以简化管理。`
      );
    }

    return (
      `「${larger.folderName}」与「${smaller.folderName}」内容相似度达 ${simPercent}%，` +
      `建议将「${smaller.folderName}」(${smaller.bookmarkCount}条) 合并到「${larger.folderName}」(${larger.bookmarkCount}条)。`
    );
  }

  private getSplitReason(profile: FolderProfile): string {
    const simPercent = profile.internalSimilarity
      ? Math.round(profile.internalSimilarity * 100)
      : 0;

    return (
      `「${profile.folderName}」包含 ${profile.bookmarkCount} 条书签，` +
      `内部相似度仅 ${simPercent}%，内容较为分散。` +
      `建议拆分为更具体的子文件夹以提高检索效率。`
    );
  }

  private estimateClusterCount(profile: FolderProfile): number {
    // Simple estimation based on size and similarity
    const similarity = profile.internalSimilarity || 0.5;
    const baseCount = Math.ceil(profile.bookmarkCount / 30); // ~30 items per cluster
    const diversityFactor = 1 + (1 - similarity); // Higher diversity = more clusters

    return Math.max(2, Math.min(5, Math.round(baseCount * diversityFactor)));
  }

  private isFolderHealthy(profile: FolderProfile): boolean {
    // A folder is healthy if:
    // 1. Has reasonable size (not too large)
    // 2. Has decent internal similarity (not too diverse)
    const sizeOk = profile.bookmarkCount < FOLDER_LIMITS.SPLIT_SIZE_THRESHOLD;
    const similarityOk =
      profile.internalSimilarity === null || profile.internalSimilarity >= 0.5;

    return sizeOk && similarityOk;
  }

  private calculateHealthStatus(
    profiles: FolderProfile[],
    merges: MergeSuggestion[],
    splits: SplitSuggestion[],
  ): FolderHealthStatus {
    const totalIssues = merges.length + splits.length;

    if (totalIssues === 0) {
      return "healthy";
    }

    // Critical if more than 30% of folders have issues
    const issueRatio = totalIssues / profiles.length;
    if (issueRatio > 0.3 || totalIssues > 5) {
      return "critical";
    }

    return "needs_attention";
  }

  private createEmptyReport(userId: string): FolderHealthReport {
    return {
      userId,
      status: "healthy",
      totalFolders: 0,
      healthyFolders: 0,
      foldersNeedingAttention: 0,
      mergeSuggestions: [],
      splitSuggestions: [],
      analyzedAt: new Date(),
    };
  }
}
