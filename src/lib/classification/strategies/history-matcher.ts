/**
 * History Matcher Strategy
 * Matches bookmarks to folders based on historical user behavior
 */

import type { IMatcher, MatcherOptions } from './interfaces'
import type { MatchResult, MatcherContext, HistoryMatchDetail } from '../types'
import { CLASSIFICATION_WEIGHTS, CLASSIFICATION_THRESHOLDS } from '../constants'
import { BookmarkRepository } from '../repositories'

/**
 * History-based folder matching strategy
 * Analyzes which folders similar bookmarks were placed in
 */
export class HistoryMatcher implements IMatcher {
  readonly name = 'history'
  readonly weight: number

  private bookmarkRepo: BookmarkRepository
  private matchCount: number

  constructor(
    bookmarkRepo: BookmarkRepository,
    options?: MatcherOptions
  ) {
    this.bookmarkRepo = bookmarkRepo
    this.weight = options?.weight ?? CLASSIFICATION_WEIGHTS.HISTORY
    this.matchCount = options?.thresholds?.matchCount ?? CLASSIFICATION_THRESHOLDS.HISTORY_MATCH_COUNT
  }

  /**
   * Match bookmark to folders based on historical similar bookmarks
   */
  async match(context: MatcherContext): Promise<MatchResult[]> {
    if (!context.embedding || context.embedding.length === 0) {
      return []
    }

    // Find similar bookmarks with their folder assignments
    const similarBookmarks = await this.bookmarkRepo.findSimilarWithFolders(
      context.embedding,
      context.userId,
      this.matchCount
    )

    // Filter out bookmarks without folders
    const classifiedBookmarks = similarBookmarks.filter(
      b => b.folderId != null && b.folderName != null
    )

    if (classifiedBookmarks.length === 0) {
      return []
    }

    // Group by folder and count
    const folderCounts = new Map<number, {
      name: string
      count: number
      titles: string[]
      totalSimilarity: number
    }>()

    for (const bookmark of classifiedBookmarks) {
      const folderId = bookmark.folderId!
      const folderName = bookmark.folderName!

      if (!folderCounts.has(folderId)) {
        folderCounts.set(folderId, {
          name: folderName,
          count: 0,
          titles: [],
          totalSimilarity: 0,
        })
      }

      const entry = folderCounts.get(folderId)!
      entry.count++
      entry.totalSimilarity += bookmark.similarity
      if (entry.titles.length < 3) {
        entry.titles.push(bookmark.bookmarkTitle)
      }
    }

    // Sort by count (descending) and convert to results
    const sortedFolders = Array.from(folderCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)

    const totalClassified = classifiedBookmarks.length

    return sortedFolders.map(([folderId, data]): HistoryMatchDetail => {
      // Score based on proportion of similar bookmarks in this folder
      const proportion = data.count / totalClassified
      const avgSimilarity = data.totalSimilarity / data.count
      // Combine proportion and similarity for final score
      const score = Math.round((proportion * 0.6 + avgSimilarity * 0.4) * 100)

      return {
        folderId,
        folderName: data.name,
        score,
        confidence: score,
        reason: `${data.count} similar bookmarks in this folder`,
        similarBookmarkCount: data.count,
        similarTitles: data.titles,
        metadata: {
          proportion,
          avgSimilarity,
          similarCount: data.count,
          similarTitles: data.titles,
        },
      }
    })
  }

  /**
   * Check if history matching is available
   */
  async isAvailable(context: MatcherContext): Promise<boolean> {
    // History matching requires embedding
    return context.embedding != null && context.embedding.length > 0
  }
}
