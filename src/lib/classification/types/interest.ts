/**
 * Interest-related type definitions
 */

/**
 * Preset interest domain ID
 */
export type PresetInterestId =
  | 'tech_frontend'
  | 'tech_backend'
  | 'tech_ai'
  | 'tech_mobile'
  | 'design_ui'
  | 'design_graphic'
  | 'product'
  | 'marketing'
  | 'reading'
  | 'investment'
  | 'lifestyle'
  | 'learning'

/**
 * Interest category
 */
export type InterestCategory = 'tech' | 'design' | 'business' | 'lifestyle'

/**
 * Preset interest domain definition
 */
export interface PresetInterestDomain {
  name: string
  icon: string
  category: InterestCategory
  keywords: string[]
  suggestedFolders: string[]
}

/**
 * Custom interest from database
 */
export interface CustomInterest {
  id: string
  userId: string
  name: string
  icon: string
  keywords: string[]
  suggestedFolders: string[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Custom interest input for creation
 */
export interface CustomInterestInput {
  name: string
  icon: string
  keywords: string[]
  suggestedFolders: string[]
}

/**
 * User interest configuration
 */
export interface UserInterestConfig {
  presetInterests: PresetInterestId[]
  customInterestIds: string[]
}

/**
 * Full user interest config with details
 */
export interface UserInterestConfigFull {
  presetInterests: PresetInterestId[]
  customInterests: CustomInterest[]
}

/**
 * Extended user profile (optional)
 */
export interface ExtendedUserProfile {
  occupation?: {
    type: 'developer' | 'designer' | 'product_manager' | 'marketer' | 'student' | 'other'
    industry?: string
    yearsOfExperience?: number
  }
  usageScenarios?: Array<'learning' | 'work_reference' | 'inspiration' | 'entertainment' | 'research'>
  contentPreferences?: {
    preferredPlatforms: string[]
    preferredFormats: string[]
    averageReadingTime?: number
  }
  classificationStyle?: {
    granularity: 'coarse' | 'medium' | 'fine'
    namingPattern: 'topic' | 'purpose' | 'mixed'
    averageFolderSize: number
  }
}

/**
 * User profile settings
 */
export interface UserProfileSettings {
  theme?: string
  auto_tag?: boolean
  interest_config?: UserInterestConfig
  classification_stage?: string
  onboarding_completed_at?: string
  last_inbox_organize_at?: string
  extended_profile?: ExtendedUserProfile
}
