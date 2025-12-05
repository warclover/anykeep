/**
 * Interest Service
 * Manages user interests and initial folder creation
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { IInterestService } from './interfaces'
import type {
  UserInterestConfigFull,
  PresetInterestId,
  CustomInterest,
  CustomInterestInput,
} from '../types'
import { InterestRepository } from '../repositories'
import {
  PRESET_INTEREST_DOMAINS,
  getSuggestedFolders,
  DEFAULT_FOLDERS,
} from '../constants'
import { FOLDER_LIMITS } from '../constants'
import { logger } from '@/lib/logger'

/**
 * Service for managing user interests
 */
export class InterestService implements IInterestService {
  private interestRepo: InterestRepository

  constructor(
    interestRepo: InterestRepository,
    private supabase: SupabaseClient
  ) {
    this.interestRepo = interestRepo
  }

  /**
   * Get user's full interest configuration
   */
  async getUserInterests(userId: string): Promise<UserInterestConfigFull> {
    const config = await this.interestRepo.getUserInterestConfig(userId)
    const customInterests = await this.interestRepo.getCustomInterests(userId)

    return {
      presetInterests: config?.presetInterests || [],
      customInterests,
    }
  }

  /**
   * Set user's preset interests
   */
  async setPresetInterests(
    userId: string,
    interestIds: PresetInterestId[]
  ): Promise<void> {
    // Validate interest IDs
    const validIds = interestIds.filter(id => id in PRESET_INTEREST_DOMAINS)

    await this.interestRepo.setPresetInterests(userId, validIds)

    logger.info(
      { userId, interestIds: validIds, action: 'preset_interests_set' },
      'Interest: Preset interests set'
    )
  }

  /**
   * Add a custom interest
   */
  async addCustomInterest(
    userId: string,
    interest: CustomInterestInput
  ): Promise<CustomInterest> {
    const result = await this.interestRepo.addCustomInterest(userId, interest)

    logger.info(
      { userId, interestId: result.id, name: interest.name, action: 'custom_interest_added' },
      'Interest: Custom interest added'
    )

    return result
  }

  /**
   * Update a custom interest
   */
  async updateCustomInterest(
    interestId: string,
    interest: Partial<CustomInterestInput>
  ): Promise<CustomInterest> {
    return this.interestRepo.updateCustomInterest(interestId, interest)
  }

  /**
   * Delete a custom interest
   */
  async deleteCustomInterest(interestId: string): Promise<void> {
    await this.interestRepo.deleteCustomInterest(interestId)
  }

  /**
   * Create initial folders based on user's interests
   */
  async createInitialFolders(userId: string): Promise<string[]> {
    const config = await this.getUserInterests(userId)

    // Collect suggested folders from preset interests
    const presetFolders = getSuggestedFolders(config.presetInterests)

    // Collect folders from custom interests
    const customFolders = config.customInterests.flatMap(c => c.suggestedFolders)

    // Combine and dedupe
    const allFolders = [...new Set([...presetFolders, ...customFolders])]

    // Limit to max initial folders
    let finalFolders = allFolders.slice(0, FOLDER_LIMITS.INITIAL_MAX)

    // Ensure minimum folders
    if (finalFolders.length < FOLDER_LIMITS.INITIAL_MIN) {
      for (const df of DEFAULT_FOLDERS) {
        if (finalFolders.length >= FOLDER_LIMITS.INITIAL_MIN) break
        if (!finalFolders.includes(df)) {
          finalFolders.push(df)
        }
      }
    }

    // Create folders in database
    const createdFolders: string[] = []

    for (const folderName of finalFolders) {
      try {
        const { error } = await this.supabase.from('folders').insert({
          user_id: userId,
          name: folderName,
          is_system: false,
          source: 'interest_onboarding',
        })

        if (!error) {
          createdFolders.push(folderName)
        }
      } catch (error) {
        logger.warn(
          {
            userId,
            folderName,
            error: error instanceof Error ? error.message : 'Unknown error',
            action: 'folder_creation_failed',
          },
          'Interest: Folder creation failed'
        )
      }
    }

    // Mark onboarding as completed
    await this.interestRepo.markOnboardingCompleted(userId)

    logger.info(
      { userId, folderCount: createdFolders.length, folders: createdFolders, action: 'initial_folders_created' },
      'Interest: Initial folders created'
    )

    return createdFolders
  }

  /**
   * Get all preset interest domains for UI
   */
  getAllPresetDomains(): Record<PresetInterestId, { name: string; icon: string; category: string }> {
    const domains: Record<string, { name: string; icon: string; category: string }> = {}

    for (const [id, domain] of Object.entries(PRESET_INTEREST_DOMAINS)) {
      domains[id] = {
        name: domain.name,
        icon: domain.icon,
        category: domain.category,
      }
    }

    return domains as Record<PresetInterestId, { name: string; icon: string; category: string }>
  }
}
