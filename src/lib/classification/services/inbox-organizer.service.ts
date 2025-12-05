/**
 * Inbox Organizer Service
 * Manages intelligent organization of inbox bookmarks
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { IInboxOrganizerService } from './interfaces'
import type {
  OrganizationAnalysis,
  BookmarkCluster,
  SuggestionInput,
} from '../types'
import {
  BookmarkRepository,
  FolderProfileRepository,
  SuggestionRepository,
  InterestRepository,
} from '../repositories'
import { INBOX_ORGANIZE_TRIGGERS, FOLDER_LIMITS } from '../constants'
import { clusterBookmarks } from '../utils/clustering'
import { logger } from '@/lib/logger'

/**
 * Service for organizing inbox bookmarks
 */
export class InboxOrganizerService implements IInboxOrganizerService {
  constructor(
    private bookmarkRepo: BookmarkRepository,
    private folderProfileRepo: FolderProfileRepository,
    private suggestionRepo: SuggestionRepository,
    private interestRepo: InterestRepository,
    private supabase: SupabaseClient
  ) {}

  /**
   * Analyze inbox and generate organization suggestions
   */
  async analyze(userId: string): Promise<OrganizationAnalysis> {
    // Get inbox bookmarks
    const inboxBookmarks = await this.bookmarkRepo.findInboxBookmarks(userId)

    if (inboxBookmarks.length < INBOX_ORGANIZE_TRIGGERS.COUNT_THRESHOLD) {
      // Not enough bookmarks to analyze
      return {
        inboxCount: inboxBookmarks.length,
        suggestions: [],
        lastAnalyzedAt: null,
        nextSuggestedAnalyzeAt: null,
      }
    }

    // Delete old pending suggestions
    await this.suggestionRepo.deletePendingByUserId(userId)

    // Get embeddings for clustering
    const bookmarksWithEmbedding = inboxBookmarks.filter(
      b => b.embedding && b.embedding.length > 0
    )

    if (bookmarksWithEmbedding.length < INBOX_ORGANIZE_TRIGGERS.MIN_CLUSTER_SIZE) {
      return {
        inboxCount: inboxBookmarks.length,
        suggestions: [],
        lastAnalyzedAt: new Date(),
        nextSuggestedAnalyzeAt: this.getNextAnalyzeDate(),
      }
    }

    // Cluster bookmarks
    const clusters = clusterBookmarks(
      bookmarksWithEmbedding.map(b => ({
        id: b.id,
        embedding: b.embedding!,
        title: b.title,
      })),
      INBOX_ORGANIZE_TRIGGERS.CLUSTER_SIMILARITY,
      INBOX_ORGANIZE_TRIGGERS.MIN_CLUSTER_SIZE
    )

    // Generate suggestions from clusters
    const suggestionInputs: SuggestionInput[] = []

    // Get folder stats to check limits
    const { data: folderStats } = await this.supabase.rpc('get_user_folder_stats', {
      p_user_id: userId,
    })
    const canCreateMore = folderStats?.can_create_more ?? true

    for (const cluster of clusters) {
      // Try to match with existing folder
      const matchedFolder = await this.matchClusterToFolder(
        cluster.centroid,
        userId
      )

      if (matchedFolder) {
        // Suggest moving to existing folder
        suggestionInputs.push({
          suggestionType: 'move_to_existing',
          bookmarkIds: cluster.bookmarkIds,
          targetFolderId: matchedFolder.folderId,
          confidence: Math.round(matchedFolder.similarity * 100),
          reason: `${cluster.bookmarkIds.length} bookmarks similar to "${matchedFolder.folderName}"`,
          sampleTitles: cluster.sampleTitles.slice(0, 3),
        })
      } else if (canCreateMore) {
        // Suggest creating new folder
        const suggestedName = await this.generateFolderName(cluster)
        suggestionInputs.push({
          suggestionType: 'create_new',
          bookmarkIds: cluster.bookmarkIds,
          suggestedFolderName: suggestedName,
          confidence: Math.round(cluster.avgSimilarity * 100),
          reason: `${cluster.bookmarkIds.length} similar bookmarks could form a new category`,
          sampleTitles: cluster.sampleTitles.slice(0, 3),
        })
      }
    }

    // Save suggestions
    const savedSuggestions = await this.suggestionRepo.createBatch(
      userId,
      suggestionInputs
    )

    // Update last organize timestamp
    await this.interestRepo.updateLastInboxOrganizeAt(userId)

    const remainingCount = inboxBookmarks.length - suggestionInputs.reduce(
      (sum, s) => sum + s.bookmarkIds.length,
      0
    )

    logger.info(
      {
        userId,
        inboxCount: inboxBookmarks.length,
        clusterCount: clusters.length,
        suggestionCount: savedSuggestions.length,
        action: 'inbox_analyzed',
      },
      'Inbox Organizer: Analysis complete'
    )

    return {
      inboxCount: inboxBookmarks.length,
      suggestions: savedSuggestions,
      lastAnalyzedAt: new Date(),
      nextSuggestedAnalyzeAt: this.getNextAnalyzeDate(),
    }
  }

  /**
   * Apply an organization suggestion
   */
  async applySuggestion(
    userId: string,
    suggestionId: number
  ): Promise<void> {
    const suggestion = await this.suggestionRepo.findById(suggestionId)

    if (!suggestion) {
      throw new Error('Suggestion not found')
    }

    if (suggestion.userId !== userId) {
      throw new Error('Unauthorized')
    }

    if (suggestion.status !== 'pending') {
      throw new Error('Suggestion is not pending')
    }

    if (suggestion.suggestionType === 'move_to_existing') {
      if (!suggestion.targetFolderId) {
        throw new Error('Target folder not specified')
      }

      // Move bookmarks to target folder
      await this.bookmarkRepo.moveToFolder(
        suggestion.bookmarkIds,
        suggestion.targetFolderId
      )

      // Update folder profile
      await this.folderProfileRepo.computeProfile(suggestion.targetFolderId)
    } else if (suggestion.suggestionType === 'create_new') {
      if (!suggestion.suggestedFolderName) {
        throw new Error('Folder name not specified')
      }

      // Create new folder
      const { data: newFolder, error } = await this.supabase
        .from('folders')
        .insert({
          user_id: userId,
          name: suggestion.suggestedFolderName,
          is_system: false,
          source: 'clustering',
        })
        .select('id')
        .single()

      if (error) {
        throw new Error(`Failed to create folder: ${error.message}`)
      }

      // Move bookmarks to new folder
      await this.bookmarkRepo.moveToFolder(
        suggestion.bookmarkIds,
        newFolder.id
      )

      // Compute profile for new folder
      await this.folderProfileRepo.computeProfile(newFolder.id)
    }

    // Mark suggestion as accepted
    await this.suggestionRepo.accept(suggestionId)

    logger.info(
      {
        userId,
        suggestionId,
        type: suggestion.suggestionType,
        bookmarkCount: suggestion.bookmarkIds.length,
        action: 'suggestion_applied',
      },
      'Inbox Organizer: Suggestion applied'
    )
  }

  /**
   * Reject an organization suggestion
   */
  async rejectSuggestion(
    userId: string,
    suggestionId: number
  ): Promise<void> {
    const suggestion = await this.suggestionRepo.findById(suggestionId)

    if (!suggestion) {
      throw new Error('Suggestion not found')
    }

    if (suggestion.userId !== userId) {
      throw new Error('Unauthorized')
    }

    await this.suggestionRepo.reject(suggestionId)

    logger.info(
      { userId, suggestionId, action: 'suggestion_rejected' },
      'Inbox Organizer: Suggestion rejected'
    )
  }

  /**
   * Match cluster to existing folder
   */
  private async matchClusterToFolder(
    centroid: number[],
    userId: string
  ): Promise<{ folderId: number; folderName: string; similarity: number } | null> {
    const similarFolders = await this.folderProfileRepo.searchSimilarFolders(
      centroid,
      userId,
      INBOX_ORGANIZE_TRIGGERS.FOLDER_MATCH_THRESHOLD,
      1
    )

    if (similarFolders.length === 0) {
      return null
    }

    return {
      folderId: similarFolders[0].folderId,
      folderName: similarFolders[0].folderName,
      similarity: similarFolders[0].similarity,
    }
  }

  /**
   * Generate folder name from cluster
   */
  private async generateFolderName(cluster: BookmarkCluster): Promise<string> {
    // If AI suggested a name, use it
    if (cluster.suggestedName) {
      return cluster.suggestedName
    }

    // Otherwise, generate from sample titles
    // Extract common words from titles
    const words = cluster.sampleTitles
      .join(' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .map(w => w.toLowerCase())

    // Count word frequency
    const wordCounts = new Map<string, number>()
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
    }

    // Get top words
    const topWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([word]) => word)

    if (topWords.length > 0) {
      return topWords.join('·')
    }

    return `分类${Date.now()}`
  }

  /**
   * Get next suggested analyze date
   */
  private getNextAnalyzeDate(): Date {
    const next = new Date()
    next.setDate(next.getDate() + INBOX_ORGANIZE_TRIGGERS.DAYS_SINCE_LAST_ORGANIZE)
    return next
  }
}
