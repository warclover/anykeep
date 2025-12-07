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
  UserInterestProfile,
  InterestProfileInput,
  BookmarkAnalysisResult,
  UserStage,
  InterestKeyword,
} from "../types";

/**
 * Classification service interface
 */
export interface IClassificationService {
  /**
   * Classify a bookmark
   */
  classify(
    userId: string,
    bookmark: BookmarkInput,
  ): Promise<ClassificationResult>;

  /**
   * Batch classify multiple bookmarks
   */
  classifyBatch(
    userId: string,
    bookmarks: BookmarkInput[],
  ): Promise<ClassificationResult[]>;
}

/**
 * User stage service interface
 */
export interface IUserStageService {
  /**
   * Get user's classification stage
   */
  getStage(userId: string): Promise<ClassificationStage>;

  /**
   * Check if user is in cold start phase
   */
  isInColdStart(userId: string): Promise<boolean>;
}

/**
 * Inbox organizer service interface
 */
export interface IInboxOrganizerService {
  /**
   * Analyze inbox folder
   */
  analyze(userId: string): Promise<OrganizationAnalysis>;

  /**
   * Apply organization suggestion
   */
  applySuggestion(userId: string, suggestionId: number): Promise<void>;

  /**
   * Reject organization suggestion
   */
  rejectSuggestion(userId: string, suggestionId: number): Promise<void>;
}

/**
 * Interest service interface
 */
export interface IInterestService {
  /**
   * Get user's interest configuration
   */
  getUserInterests(userId: string): Promise<UserInterestConfigFull>;

  /**
   * Set preset interests
   */
  setPresetInterests(
    userId: string,
    interestIds: PresetInterestId[],
  ): Promise<void>;

  /**
   * Add custom interest
   */
  addCustomInterest(
    userId: string,
    interest: CustomInterestInput,
  ): Promise<CustomInterest>;

  /**
   * Update custom interest
   */
  updateCustomInterest(
    interestId: string,
    interest: Partial<CustomInterestInput>,
  ): Promise<CustomInterest>;

  /**
   * Delete custom interest
   */
  deleteCustomInterest(interestId: string): Promise<void>;

  /**
   * Create initial folders based on interests
   */
  createInitialFolders(userId: string): Promise<string[]>;
}

/**
 * Interest profile service interface V2
 * Manages user interest profiles with progressive learning
 */
export interface IInterestProfileService {
  /**
   * Get or create user's interest profile
   */
  getOrCreateProfile(userId: string): Promise<UserInterestProfile>;

  /**
   * Get user's interest profile (returns null if not found)
   */
  getProfile(userId: string): Promise<UserInterestProfile | null>;

  /**
   * Initialize profile with optional manual description
   */
  initializeProfile(
    userId: string,
    input: InterestProfileInput,
  ): Promise<UserInterestProfile>;

  /**
   * Analyze imported bookmarks and update profile
   */
  analyzeImportedBookmarks(
    userId: string,
    importSource?: string,
  ): Promise<BookmarkAnalysisResult>;

  /**
   * Learn from user's bookmark organization behavior
   */
  learnFromBehavior(userId: string): Promise<{
    success: boolean;
    learnedKeywords: number;
    message: string;
  }>;

  /**
   * Update user's manual description
   */
  updateManualDescription(
    userId: string,
    description: string,
  ): Promise<UserInterestProfile>;

  /**
   * Update user's stage based on current data
   */
  updateStage(userId: string): Promise<UserStage>;

  /**
   * Get profile statistics
   */
  getProfileStats(userId: string): Promise<{
    stage: UserStage;
    confidence: number;
    interestCount: number;
    hasManual: boolean;
    hasImported: boolean;
    hasLearned: boolean;
    importedBookmarkCount: number;
    learnedBookmarkCount: number;
  }>;

  /**
   * Get top interests
   */
  getTopInterests(userId: string, limit?: number): Promise<InterestKeyword[]>;
}
