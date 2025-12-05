/**
 * Vector Matcher Strategy
 * Matches bookmarks to folders using vector similarity
 */

import type { IMatcher, MatcherOptions } from './interfaces'
import type { MatchResult, MatcherContext, VectorMatchDetail } from '../types'
import { CLASSIFICATION_WEIGHTS, CLASSIFICATION_THRESHOLDS } from '../constants'
import { FolderProfileRepository } from '../repositories'

/**
 * Vector-based folder matching strategy
 * Uses cosine similarity between bookmark embedding and folder profile embeddings
 */
export class VectorMatcher implements IMatcher {
  readonly name = 'vector'
  readonly weight: number

  private folderProfileRepo: FolderProfileRepository
  private threshold: number

  constructor(
    folderProfileRepo: FolderProfileRepository,
    options?: MatcherOptions
  ) {
    this.folderProfileRepo = folderProfileRepo
    this.weight = options?.weight ?? CLASSIFICATION_WEIGHTS.VECTOR
    this.threshold = options?.thresholds?.similarity ?? CLASSIFICATION_THRESHOLDS.VECTOR_SIMILARITY
  }

  /**
   * Match bookmark to folders using vector similarity
   */
  async match(context: MatcherContext): Promise<MatchResult[]> {
    if (!context.embedding || context.embedding.length === 0) {
      return []
    }

    const similarFolders = await this.folderProfileRepo.searchSimilarFolders(
      context.embedding,
      context.userId,
      this.threshold,
      5 // Top 5 folders
    )

    return similarFolders.map((folder): VectorMatchDetail => ({
      folderId: folder.folderId,
      folderName: folder.folderName,
      score: Math.round(folder.similarity * 100),
      confidence: Math.round(folder.similarity * 100),
      reason: `Vector similarity: ${(folder.similarity * 100).toFixed(0)}%`,
      topTags: folder.topTags,
      sampleTitles: folder.sampleTitles,
      bookmarkCount: folder.bookmarkCount,
      metadata: {
        similarity: folder.similarity,
        topTags: folder.topTags,
        sampleTitles: folder.sampleTitles,
      },
    }))
  }

  /**
   * Check if vector matching is available
   */
  async isAvailable(context: MatcherContext): Promise<boolean> {
    // Vector matching requires embedding
    return context.embedding != null && context.embedding.length > 0
  }
}
