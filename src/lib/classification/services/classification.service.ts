/**
 * Classification Service
 * Main service for bookmark classification
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IClassificationService } from "./interfaces";
import type { IMatcher, IScoreAggregator } from "../strategies/interfaces";
import type {
  ClassificationResult,
  BookmarkInput,
  MatcherContext,
  MatchResult,
  VectorMatchDetail,
  HistoryMatchDetail,
} from "../types";
import type { UserStageService } from "./user-stage.service";
import type { AIRecommender } from "../strategies";
import {
  generateEmbedding,
  buildEmbeddingText,
} from "@/lib/utils/embedding-generator";
import { logger } from "@/lib/logger";

/**
 * Classification service
 * Coordinates multiple matchers to classify bookmarks
 */
export class ClassificationService implements IClassificationService {
  constructor(
    private matchers: IMatcher[],
    private aggregator: IScoreAggregator,
    private userStageService: UserStageService,
    private supabase: SupabaseClient,
  ) {}

  /**
   * Classify a single bookmark
   */
  async classify(
    userId: string,
    bookmark: BookmarkInput,
  ): Promise<ClassificationResult> {
    try {
      return await this.classifyInternal(userId, bookmark);
    } catch (error) {
      logger.error(
        {
          userId,
          title: bookmark.title,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          action: "classification_error",
        },
        "Classification: Unexpected error, falling back to inbox",
      );
      return this.createInboxResult(
        "Classification failed due to unexpected error",
      );
    }
  }

  /**
   * Internal classification logic
   * Enhanced with performance metrics
   *
   * V3.5: Cold start now uses lightweight matchers (VectorMatcher with name_embedding)
   * instead of sending all bookmarks to inbox
   */
  private async classifyInternal(
    userId: string,
    bookmark: BookmarkInput,
  ): Promise<ClassificationResult> {
    const startTime = performance.now();
    const perfMetrics: Record<string, number> = {};

    // Check user stage
    const stageCheckStart = performance.now();
    const isInColdStart = await this.userStageService.isInColdStart(userId);
    perfMetrics.stageCheckMs = performance.now() - stageCheckStart;

    // V3.5: Cold start mode - use lightweight matchers only (vector, tag, fingerprint)
    // Skip heavy matchers (AI, history) to save resources while still allowing classification
    const coldStartLightweightMatchers = [
      "vector",
      "tag",
      "fingerprint",
      "knn-direct",
      "universal",
    ];

    if (isInColdStart) {
      logger.info(
        { userId, title: bookmark.title, action: "classification_cold_start" },
        "Classification: Cold start mode - using lightweight matchers with name_embedding",
      );
    }

    // Prepare context
    const contextStart = performance.now();
    const context = await this.prepareContext(userId, bookmark);
    perfMetrics.contextPrepMs = performance.now() - contextStart;

    if (!context.embedding || context.embedding.length === 0) {
      // No embedding - cannot classify intelligently
      logger.warn(
        {
          userId,
          title: bookmark.title,
          action: "classification_no_embedding",
        },
        "Classification: No embedding available",
      );
      return this.createInboxResult(
        "No embedding available for classification",
      );
    }

    // Run matchers
    const results = new Map<string, MatchResult[]>();

    // First run vector and history matchers
    let vectorResults: VectorMatchDetail[] = [];
    let historyResults: HistoryMatchDetail[] = [];

    for (const matcher of this.matchers) {
      if (matcher.name === "ai") continue; // Run AI last

      // V3.5: In cold start, skip heavy matchers (history)
      if (
        isInColdStart &&
        !coldStartLightweightMatchers.includes(matcher.name)
      ) {
        logger.debug(
          { matcher: matcher.name },
          "Classification: Skipping matcher in cold start mode",
        );
        continue;
      }

      const isAvailable = await matcher.isAvailable(context);
      if (!isAvailable) continue;

      const matcherStart = performance.now();
      try {
        const matchResults = await matcher.match(context);
        results.set(matcher.name, matchResults);
        perfMetrics[`${matcher.name}MatcherMs`] =
          performance.now() - matcherStart;

        // Cache results for AI - type guard based on matcher name
        if (
          matcher.name === "vector" &&
          this.isVectorMatchResults(matchResults)
        ) {
          vectorResults = matchResults;
        } else if (
          matcher.name === "history" &&
          this.isHistoryMatchResults(matchResults)
        ) {
          historyResults = matchResults;
        }
      } catch (error) {
        perfMetrics[`${matcher.name}MatcherMs`] =
          performance.now() - matcherStart;
        logger.error(
          {
            matcher: matcher.name,
            error: error instanceof Error ? error.message : "Unknown error",
            action: "matcher_failed",
          },
          `Classification: ${matcher.name} matcher failed`,
        );
      }
    }

    // V3.5: Skip AI matcher in cold start mode to save API calls
    // Run AI matcher with context from other matchers
    const aiMatcher = this.findAIMatcher();
    if (aiMatcher && !isInColdStart) {
      const isAvailable = await aiMatcher.isAvailable(context);
      if (isAvailable) {
        const aiStart = performance.now();
        try {
          // Pass results from other matchers to AI
          aiMatcher.setMatcherResults(vectorResults, historyResults);
          const aiResults = await aiMatcher.match(context);
          results.set("ai", aiResults);
          perfMetrics.aiMatcherMs = performance.now() - aiStart;
        } catch (error) {
          perfMetrics.aiMatcherMs = performance.now() - aiStart;
          logger.error(
            {
              error: error instanceof Error ? error.message : "Unknown error",
              action: "ai_matcher_failed",
            },
            "Classification: AI matcher failed",
          );
        }
      }
    }

    // Aggregate results
    const aggregateStart = performance.now();
    const classification = this.aggregator.aggregate(results, this.matchers);
    perfMetrics.aggregateMs = performance.now() - aggregateStart;
    perfMetrics.totalMs = performance.now() - startTime;

    logger.info(
      {
        userId,
        title: bookmark.title,
        folderId: classification.folderId,
        folderName: classification.folderName,
        confidence: classification.confidence,
        action: classification.action,
        scores: classification.scores,
        perfMetrics,
        coldStartMode: isInColdStart,
      },
      `Classification: ${classification.action} (${perfMetrics.totalMs.toFixed(1)}ms)${isInColdStart ? " [cold-start]" : ""}`,
    );

    return classification;
  }

  /**
   * Batch classify multiple bookmarks
   */
  async classifyBatch(
    userId: string,
    bookmarks: BookmarkInput[],
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];

    for (const bookmark of bookmarks) {
      try {
        const result = await this.classify(userId, bookmark);
        results.push(result);
      } catch (error) {
        logger.error(
          {
            userId,
            title: bookmark.title,
            error: error instanceof Error ? error.message : "Unknown error",
            action: "batch_classification_error",
          },
          "Classification: Batch item failed",
        );
        results.push(this.createInboxResult("Classification failed"));
      }
    }

    return results;
  }

  /**
   * Prepare matcher context
   */
  private async prepareContext(
    userId: string,
    bookmark: BookmarkInput,
  ): Promise<MatcherContext> {
    // Generate embedding if not provided
    let embedding = bookmark.embedding;

    if (!embedding || embedding.length === 0) {
      try {
        const text = buildEmbeddingText(
          bookmark.title,
          bookmark.summary,
          bookmark.tags,
        );
        embedding = await generateEmbedding(text);
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : "Unknown error",
            action: "embedding_generation_failed",
          },
          "Classification: Embedding generation failed",
        );
      }
    }

    return {
      userId,
      bookmarkId: bookmark.id, // 用于排除自匹配
      title: bookmark.title,
      summary: bookmark.summary || "",
      tags: bookmark.tags || [],
      embedding: embedding || [],
    };
  }

  /**
   * Create inbox result
   */
  private createInboxResult(reason: string): ClassificationResult {
    return {
      folderId: null,
      folderName: "待整理",
      confidence: 0,
      reason,
      action: "inbox",
      scores: {
        vectorScore: 0,
        historyScore: 0,
        aiScore: 0,
      },
    };
  }

  /**
   * Find AI matcher from matchers array
   * Type-safe alternative to using 'as' assertion
   */
  private findAIMatcher(): AIRecommender | undefined {
    const matcher = this.matchers.find((m) => m.name === "ai");
    if (matcher && "setMatcherResults" in matcher) {
      return matcher as AIRecommender;
    }
    return undefined;
  }

  /**
   * Type guard for VectorMatchDetail array
   * Checks for VectorMatchDetail-specific fields: topTags, sampleTitles, bookmarkCount
   */
  private isVectorMatchResults(
    results: MatchResult[],
  ): results is VectorMatchDetail[] {
    if (results.length === 0) return true;
    const first = results[0];
    return (
      "folderId" in first &&
      "topTags" in first &&
      "sampleTitles" in first &&
      "bookmarkCount" in first
    );
  }

  /**
   * Type guard for HistoryMatchDetail array
   * Checks for HistoryMatchDetail-specific fields: similarBookmarkCount, similarTitles
   */
  private isHistoryMatchResults(
    results: MatchResult[],
  ): results is HistoryMatchDetail[] {
    if (results.length === 0) return true;
    const first = results[0];
    return (
      "folderId" in first &&
      "similarBookmarkCount" in first &&
      "similarTitles" in first
    );
  }
}
