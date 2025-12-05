/**
 * Classification Service
 * Main service for bookmark classification
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { IClassificationService } from './interfaces'
import type { IMatcher, IScoreAggregator } from '../strategies/interfaces'
import type {
  ClassificationResult,
  BookmarkInput,
  MatcherContext,
  MatchResult,
  VectorMatchDetail,
  HistoryMatchDetail,
} from '../types'
import { UserStageService } from './user-stage.service'
import { AIRecommender } from '../strategies'
import { generateEmbedding, buildEmbeddingText } from '@/lib/utils/embedding-generator'
import { logger } from '@/lib/logger'

/**
 * Classification service
 * Coordinates multiple matchers to classify bookmarks
 */
export class ClassificationService implements IClassificationService {
  constructor(
    private matchers: IMatcher[],
    private aggregator: IScoreAggregator,
    private userStageService: UserStageService,
    private supabase: SupabaseClient
  ) {}

  /**
   * Classify a single bookmark
   */
  async classify(
    userId: string,
    bookmark: BookmarkInput
  ): Promise<ClassificationResult> {
    // Check user stage
    const isInColdStart = await this.userStageService.isInColdStart(userId)

    if (isInColdStart) {
      // During cold start, all bookmarks go to inbox
      logger.info(
        { userId, title: bookmark.title, action: 'classification_cold_start' },
        'Classification: User in cold start, sending to inbox'
      )
      return this.createInboxResult('User in cold start phase - collecting data')
    }

    // Prepare context
    const context = await this.prepareContext(userId, bookmark)

    if (!context.embedding || context.embedding.length === 0) {
      // No embedding - cannot classify intelligently
      logger.warn(
        { userId, title: bookmark.title, action: 'classification_no_embedding' },
        'Classification: No embedding available'
      )
      return this.createInboxResult('No embedding available for classification')
    }

    // Run matchers
    const results = new Map<string, MatchResult[]>()

    // First run vector and history matchers
    let vectorResults: VectorMatchDetail[] = []
    let historyResults: HistoryMatchDetail[] = []

    for (const matcher of this.matchers) {
      if (matcher.name === 'ai') continue // Run AI last

      const isAvailable = await matcher.isAvailable(context)
      if (!isAvailable) continue

      try {
        const matchResults = await matcher.match(context)
        results.set(matcher.name, matchResults)

        // Cache results for AI
        if (matcher.name === 'vector') {
          vectorResults = matchResults as VectorMatchDetail[]
        } else if (matcher.name === 'history') {
          historyResults = matchResults as HistoryMatchDetail[]
        }
      } catch (error) {
        logger.error(
          {
            matcher: matcher.name,
            error: error instanceof Error ? error.message : 'Unknown error',
            action: 'matcher_failed',
          },
          `Classification: ${matcher.name} matcher failed`
        )
      }
    }

    // Run AI matcher with context from other matchers
    const aiMatcher = this.matchers.find(m => m.name === 'ai') as AIRecommender | undefined
    if (aiMatcher) {
      const isAvailable = await aiMatcher.isAvailable(context)
      if (isAvailable) {
        try {
          // Pass results from other matchers to AI
          aiMatcher.setMatcherResults(vectorResults, historyResults)
          const aiResults = await aiMatcher.match(context)
          results.set('ai', aiResults)
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : 'Unknown error',
              action: 'ai_matcher_failed',
            },
            'Classification: AI matcher failed'
          )
        }
      }
    }

    // Aggregate results
    const classification = this.aggregator.aggregate(results, this.matchers)

    logger.info(
      {
        userId,
        title: bookmark.title,
        folderId: classification.folderId,
        folderName: classification.folderName,
        confidence: classification.confidence,
        action: classification.action,
        scores: classification.scores,
      },
      `Classification: ${classification.action}`
    )

    return classification
  }

  /**
   * Batch classify multiple bookmarks
   */
  async classifyBatch(
    userId: string,
    bookmarks: BookmarkInput[]
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = []

    for (const bookmark of bookmarks) {
      try {
        const result = await this.classify(userId, bookmark)
        results.push(result)
      } catch (error) {
        logger.error(
          {
            userId,
            title: bookmark.title,
            error: error instanceof Error ? error.message : 'Unknown error',
            action: 'batch_classification_error',
          },
          'Classification: Batch item failed'
        )
        results.push(this.createInboxResult('Classification failed'))
      }
    }

    return results
  }

  /**
   * Prepare matcher context
   */
  private async prepareContext(
    userId: string,
    bookmark: BookmarkInput
  ): Promise<MatcherContext> {
    // Generate embedding if not provided
    let embedding = bookmark.embedding

    if (!embedding || embedding.length === 0) {
      try {
        const text = buildEmbeddingText(
          bookmark.title,
          bookmark.summary,
          bookmark.tags
        )
        embedding = await generateEmbedding(text)
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            action: 'embedding_generation_failed',
          },
          'Classification: Embedding generation failed'
        )
      }
    }

    return {
      userId,
      title: bookmark.title,
      summary: bookmark.summary || '',
      tags: bookmark.tags || [],
      embedding: embedding || [],
    }
  }

  /**
   * Create inbox result
   */
  private createInboxResult(reason: string): ClassificationResult {
    return {
      folderId: null,
      folderName: '待整理',
      confidence: 0,
      reason,
      action: 'inbox',
      scores: {
        vectorScore: 0,
        historyScore: 0,
        aiScore: 0,
      },
    }
  }
}
