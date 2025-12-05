/**
 * Service interfaces
 */

import type {
  ClassificationResult,
  BookmarkInput,
  ClassificationStage,
  OrganizationAnalysis,
  UserInterestConfigFull,
  PresetInterestId,
  CustomInterest,
  CustomInterestInput,
} from '../types'

/**
 * Classification service interface
 */
export interface IClassificationService {
  /**
   * Classify a bookmark
   */
  classify(
    userId: string,
    bookmark: BookmarkInput
  ): Promise<ClassificationResult>

  /**
   * Batch classify multiple bookmarks
   */
  classifyBatch(
    userId: string,
    bookmarks: BookmarkInput[]
  ): Promise<ClassificationResult[]>
}

/**
 * User stage service interface
 */
export interface IUserStageService {
  /**
   * Get user's classification stage
   */
  getStage(userId: string): Promise<ClassificationStage>

  /**
   * Check if user is in cold start phase
   */
  isInColdStart(userId: string): Promise<boolean>
}

/**
 * Inbox organizer service interface
 */
export interface IInboxOrganizerService {
  /**
   * Analyze inbox folder
   */
  analyze(userId: string): Promise<OrganizationAnalysis>

  /**
   * Apply organization suggestion
   */
  applySuggestion(
    userId: string,
    suggestionId: number
  ): Promise<void>

  /**
   * Reject organization suggestion
   */
  rejectSuggestion(
    userId: string,
    suggestionId: number
  ): Promise<void>
}

/**
 * Interest service interface
 */
export interface IInterestService {
  /**
   * Get user's interest configuration
   */
  getUserInterests(userId: string): Promise<UserInterestConfigFull>

  /**
   * Set preset interests
   */
  setPresetInterests(
    userId: string,
    interestIds: PresetInterestId[]
  ): Promise<void>

  /**
   * Add custom interest
   */
  addCustomInterest(
    userId: string,
    interest: CustomInterestInput
  ): Promise<CustomInterest>

  /**
   * Update custom interest
   */
  updateCustomInterest(
    interestId: string,
    interest: Partial<CustomInterestInput>
  ): Promise<CustomInterest>

  /**
   * Delete custom interest
   */
  deleteCustomInterest(interestId: string): Promise<void>

  /**
   * Create initial folders based on interests
   */
  createInitialFolders(userId: string): Promise<string[]>
}
