/**
 * Classification V2 Integration Layer
 * Integrates the V2 classification service with the existing bookmark creation flow
 */

import { ClassificationContainer } from './container'
import { CLASSIFICATION_THRESHOLDS, FOLDER_LIMITS } from './constants'
import { logger } from '@/lib/logger'
import type { ClassificationResult, BookmarkInput } from './types'

// Local thresholds based on constants
const AUTO_CLASSIFY_THRESHOLD = CLASSIFICATION_THRESHOLDS.HIGH_CONFIDENCE // 70
const SUGGEST_THRESHOLD = 50 // Between LOW (30) and HIGH (70)

/**
 * Process bookmark classification using V2 system
 * Replaces the legacy processAIFolderRecommendation function
 */
export async function classifyBookmarkV2(
  bookmarkId: number,
  title: string,
  summary: string | null,
  tags: string[],
  userId: string
): Promise<{
  classified: boolean
  folderId: number | null
  folderName: string | null
  confidence: number
  action: ClassificationResult['action']
  suggestionId?: number
}> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Initialize classification container
    const container = ClassificationContainer.initialize(supabase)
    const classificationService = container.getClassificationService()

    // Prepare bookmark input
    const bookmarkInput: BookmarkInput = {
      title,
      summary: summary || undefined,
      tags,
    }

    // Run classification
    const result = await classificationService.classify(userId, bookmarkInput)

    logger.info(
      {
        bookmarkId,
        title: title.substring(0, 30),
        action: result.action,
        confidence: result.confidence,
        folderId: result.folderId,
        folderName: result.folderName,
        scores: result.scores,
      },
      'Classification V2: Result received'
    )

    // Handle result based on action and confidence
    if (result.action === 'classify' && result.folderId) {
      // High confidence - auto-classify
      if (result.confidence >= AUTO_CLASSIFY_THRESHOLD) {
        // Move bookmark to classified folder
        const { error: moveError } = await supabase
          .from('bookmarks')
          .update({ folder_id: result.folderId })
          .eq('id', bookmarkId)
          .eq('user_id', userId)

        if (moveError) {
          logger.error(
            { error: moveError, bookmarkId, folderId: result.folderId },
            'Classification V2: Failed to move bookmark'
          )
          return {
            classified: false,
            folderId: null,
            folderName: null,
            confidence: result.confidence,
            action: 'inbox',
          }
        }

        logger.info(
          {
            bookmarkId,
            folderId: result.folderId,
            folderName: result.folderName,
            confidence: result.confidence,
          },
          'Classification V2: Auto-classified (high confidence)'
        )

        return {
          classified: true,
          folderId: result.folderId,
          folderName: result.folderName,
          confidence: result.confidence,
          action: 'classify',
        }
      }

      // Medium confidence - save suggestion
      if (result.confidence >= SUGGEST_THRESHOLD) {
        const { data: suggestion, error: suggestionError } = await supabase
          .from('classification_suggestions')
          .insert({
            user_id: userId,
            bookmark_id: bookmarkId,
            suggested_folder_id: result.folderId,
            suggested_folder_name: result.folderName,
            suggest_new_folder: false,
            confidence: result.confidence,
            reason: result.reason,
            status: 'pending',
            batch_id: crypto.randomUUID(),
          })
          .select('id')
          .single()

        if (!suggestionError && suggestion) {
          logger.info(
            {
              bookmarkId,
              suggestionId: suggestion.id,
              folderId: result.folderId,
              folderName: result.folderName,
              confidence: result.confidence,
            },
            'Classification V2: Saved suggestion (medium confidence)'
          )

          return {
            classified: false,
            folderId: result.folderId,
            folderName: result.folderName,
            confidence: result.confidence,
            action: 'classify',
            suggestionId: suggestion.id,
          }
        }
      }
    }

    // Handle suggest_new action
    if (result.action === 'suggest_new' && result.folderName) {
      // Check daily folder creation limit
      const today = new Date().toISOString().split('T')[0]
      const { count: todayCount } = await supabase
        .from('folders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`)

      if ((todayCount || 0) >= FOLDER_LIMITS.MAX_AUTO_CREATE_PER_DAY) {
        logger.warn(
          { userId, todayCount },
          'Classification V2: Daily folder creation limit reached'
        )
        // Save as suggestion instead
        const { data: suggestion, error: suggestionError } = await supabase
          .from('classification_suggestions')
          .insert({
            user_id: userId,
            bookmark_id: bookmarkId,
            suggested_folder_id: null,
            suggested_folder_name: result.folderName,
            suggest_new_folder: true,
            confidence: result.confidence,
            reason: result.reason || 'Suggest creating new folder',
            status: 'pending',
            batch_id: crypto.randomUUID(),
          })
          .select('id')
          .single()

        if (!suggestionError && suggestion) {
          return {
            classified: false,
            folderId: null,
            folderName: result.folderName,
            confidence: result.confidence,
            action: 'suggest_new',
            suggestionId: suggestion.id,
          }
        }
      }

      // High confidence - auto-create folder
      if (result.confidence >= AUTO_CLASSIFY_THRESHOLD) {
        // Create new folder
        const { data: newFolder, error: createError } = await supabase
          .from('folders')
          .insert({
            user_id: userId,
            name: result.folderName,
            sort_order: 0,
          })
          .select('id')
          .single()

        if (!createError && newFolder) {
          // Move bookmark to new folder
          const { error: moveError } = await supabase
            .from('bookmarks')
            .update({ folder_id: newFolder.id })
            .eq('id', bookmarkId)
            .eq('user_id', userId)

          if (!moveError) {
            logger.info(
              {
                bookmarkId,
                folderId: newFolder.id,
                folderName: result.folderName,
                confidence: result.confidence,
              },
              'Classification V2: Created new folder and classified'
            )

            return {
              classified: true,
              folderId: newFolder.id,
              folderName: result.folderName,
              confidence: result.confidence,
              action: 'suggest_new',
            }
          }
        }
      }

      // Medium confidence - save suggestion for new folder
      if (result.confidence >= SUGGEST_THRESHOLD) {
        const { data: suggestion, error: suggestionError } = await supabase
          .from('classification_suggestions')
          .insert({
            user_id: userId,
            bookmark_id: bookmarkId,
            suggested_folder_id: null,
            suggested_folder_name: result.folderName,
            suggest_new_folder: true,
            confidence: result.confidence,
            reason: result.reason || 'Suggest creating new folder',
            status: 'pending',
            batch_id: crypto.randomUUID(),
          })
          .select('id')
          .single()

        if (!suggestionError && suggestion) {
          logger.info(
            {
              bookmarkId,
              suggestionId: suggestion.id,
              folderName: result.folderName,
              confidence: result.confidence,
            },
            'Classification V2: Saved new folder suggestion'
          )

          return {
            classified: false,
            folderId: null,
            folderName: result.folderName,
            confidence: result.confidence,
            action: 'suggest_new',
            suggestionId: suggestion.id,
          }
        }
      }
    }

    // Low confidence or inbox action - stay in inbox
    logger.info(
      {
        bookmarkId,
        confidence: result.confidence,
        action: result.action,
      },
      'Classification V2: Staying in inbox (low confidence)'
    )

    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: result.confidence,
      action: 'inbox',
    }
  } catch (error) {
    logger.error(
      {
        bookmarkId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Classification V2: Failed'
    )

    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: 0,
      action: 'inbox',
    }
  }
}

/**
 * Update folder profile after bookmark classification
 * Should be called after a bookmark is added to a folder
 */
export async function updateFolderProfileAfterClassification(
  folderId: number,
  userId: string
): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Call the SQL function to compute folder profile
    // Note: compute_folder_profile is defined in migration but not yet in generated types
    // Using type assertion as a workaround until types are regenerated
    const { error } = await (supabase.rpc as CallableFunction)(
      'compute_folder_profile',
      { p_folder_id: folderId }
    )

    if (error) {
      logger.error(
        { error, folderId, userId },
        'Classification V2: Failed to update folder profile'
      )
    } else {
      logger.info(
        { folderId, userId },
        'Classification V2: Folder profile updated'
      )
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        folderId,
        userId,
      },
      'Classification V2: Exception updating folder profile'
    )
  }
}

/**
 * Check if V2 classification system should be used
 * Can be controlled via feature flag or environment variable
 */
export function shouldUseV2Classification(): boolean {
  // Default to V2 enabled
  // Can be overridden via environment variable
  const v2Enabled = process.env.CLASSIFICATION_V2_ENABLED
  return v2Enabled !== 'false'
}
