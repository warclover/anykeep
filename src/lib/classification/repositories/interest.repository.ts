/**
 * Interest Repository
 * Data access layer for user interests
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type {
  CustomInterest,
  CustomInterestInput,
  UserInterestConfig,
  UserProfileSettings,
  PresetInterestId,
} from '../types'
import { CUSTOM_INTEREST_LIMITS } from '../constants'

/**
 * Repository for interest-related operations
 */
export class InterestRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get user's custom interests
   */
  async getCustomInterests(userId: string): Promise<CustomInterest[]> {
    const { data, error } = await this.supabase
      .from('user_custom_interests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch custom interests: ${error.message}`)
    }

    return (data || []).map(this.mapToCustomInterest)
  }

  /**
   * Add a custom interest
   */
  async addCustomInterest(
    userId: string,
    input: CustomInterestInput
  ): Promise<CustomInterest> {
    // Check limit
    const existing = await this.getCustomInterests(userId)
    if (existing.length >= CUSTOM_INTEREST_LIMITS.MAX_CUSTOM_INTERESTS) {
      throw new Error(`Maximum ${CUSTOM_INTEREST_LIMITS.MAX_CUSTOM_INTERESTS} custom interests allowed`)
    }

    // Validate input
    if (input.name.length > CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH) {
      throw new Error(`Name must be at most ${CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH} characters`)
    }
    if (input.keywords.length > CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS) {
      throw new Error(`Maximum ${CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS} keywords allowed`)
    }
    if (input.suggestedFolders.length > CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS) {
      throw new Error(`Maximum ${CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS} suggested folders allowed`)
    }

    const { data, error } = await this.supabase
      .from('user_custom_interests')
      .insert({
        user_id: userId,
        name: input.name,
        icon: input.icon,
        keywords: input.keywords,
        suggested_folders: input.suggestedFolders,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create custom interest: ${error.message}`)
    }

    return this.mapToCustomInterest(data)
  }

  /**
   * Update a custom interest
   */
  async updateCustomInterest(
    interestId: string,
    input: Partial<CustomInterestInput>
  ): Promise<CustomInterest> {
    const updateData: Record<string, unknown> = {}

    if (input.name !== undefined) {
      if (input.name.length > CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH) {
        throw new Error(`Name must be at most ${CUSTOM_INTEREST_LIMITS.MAX_NAME_LENGTH} characters`)
      }
      updateData.name = input.name
    }
    if (input.icon !== undefined) {
      updateData.icon = input.icon
    }
    if (input.keywords !== undefined) {
      if (input.keywords.length > CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS) {
        throw new Error(`Maximum ${CUSTOM_INTEREST_LIMITS.MAX_KEYWORDS} keywords allowed`)
      }
      updateData.keywords = input.keywords
    }
    if (input.suggestedFolders !== undefined) {
      if (input.suggestedFolders.length > CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS) {
        throw new Error(`Maximum ${CUSTOM_INTEREST_LIMITS.MAX_SUGGESTED_FOLDERS} suggested folders allowed`)
      }
      updateData.suggested_folders = input.suggestedFolders
    }

    const { data, error } = await this.supabase
      .from('user_custom_interests')
      .update(updateData)
      .eq('id', interestId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update custom interest: ${error.message}`)
    }

    return this.mapToCustomInterest(data)
  }

  /**
   * Delete a custom interest
   */
  async deleteCustomInterest(interestId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_custom_interests')
      .delete()
      .eq('id', interestId)

    if (error) {
      throw new Error(`Failed to delete custom interest: ${error.message}`)
    }
  }

  /**
   * Get user's interest configuration from profile settings
   */
  async getUserInterestConfig(userId: string): Promise<UserInterestConfig | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch user profile: ${error.message}`)
    }

    const settings = data?.settings as UserProfileSettings | null
    return settings?.interest_config || null
  }

  /**
   * Save user's preset interest selection
   */
  async setPresetInterests(
    userId: string,
    presetInterests: PresetInterestId[]
  ): Promise<void> {
    // Get current settings
    const { data: profile, error: fetchError } = await this.supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch profile: ${fetchError.message}`)
    }

    const currentSettings = (profile?.settings as UserProfileSettings) || {}
    const newSettings: UserProfileSettings = {
      ...currentSettings,
      interest_config: {
        presetInterests,
        customInterestIds: currentSettings.interest_config?.customInterestIds || [],
      },
    }

    const { error: updateError } = await this.supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', userId)

    if (updateError) {
      throw new Error(`Failed to update preset interests: ${updateError.message}`)
    }
  }

  /**
   * Mark onboarding as completed
   */
  async markOnboardingCompleted(userId: string): Promise<void> {
    const { data: profile, error: fetchError } = await this.supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch profile: ${fetchError.message}`)
    }

    const currentSettings = (profile?.settings as UserProfileSettings) || {}
    const newSettings: UserProfileSettings = {
      ...currentSettings,
      onboarding_completed_at: new Date().toISOString(),
    }

    const { error: updateError } = await this.supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', userId)

    if (updateError) {
      throw new Error(`Failed to mark onboarding completed: ${updateError.message}`)
    }
  }

  /**
   * Update last inbox organize timestamp
   */
  async updateLastInboxOrganizeAt(userId: string): Promise<void> {
    const { data: profile, error: fetchError } = await this.supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch profile: ${fetchError.message}`)
    }

    const currentSettings = (profile?.settings as UserProfileSettings) || {}
    const newSettings: UserProfileSettings = {
      ...currentSettings,
      last_inbox_organize_at: new Date().toISOString(),
    }

    const { error: updateError } = await this.supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', userId)

    if (updateError) {
      throw new Error(`Failed to update last inbox organize: ${updateError.message}`)
    }
  }

  /**
   * Map database row to CustomInterest
   */
  private mapToCustomInterest(row: Record<string, unknown>): CustomInterest {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      icon: row.icon as string,
      keywords: (row.keywords as string[]) || [],
      suggestedFolders: (row.suggested_folders as string[]) || [],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }
  }
}
