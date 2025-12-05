/**
 * Classification Module
 *
 * Intelligent bookmark classification system with:
 * - Vector similarity matching (40%)
 * - Historical behavior matching (30%)
 * - AI-powered recommendations (30%)
 *
 * @example
 * ```typescript
 * import { ClassificationContainer, PRESET_INTEREST_DOMAINS } from '@/lib/classification'
 *
 * // Initialize container with Supabase client
 * const container = ClassificationContainer.initialize(supabase)
 *
 * // Get services
 * const classificationService = container.getClassificationService()
 * const interestService = container.getInterestService()
 *
 * // Classify a bookmark
 * const result = await classificationService.classify(userId, {
 *   title: 'React 18 New Features',
 *   summary: 'Overview of React 18 concurrent features',
 *   tags: ['React', 'JavaScript']
 * })
 *
 * // Get user's classification stage
 * const stage = await container.getUserStageService().getStage(userId)
 * ```
 */

// Container
export {
  ClassificationContainer,
  getClassificationContainer,
} from "./container";

// Types
export type {
  // Classification types
  ClassificationStage,
  ClassificationAction,
  ClassificationResult,
  MatchResult,
  MatcherContext,
  BookmarkInput,
  FolderProfile,
  SimilarFolder,
  SimilarBookmarkWithFolder,
  FolderStats,
  VectorMatchDetail,
  HistoryMatchDetail,
  AIRecommendationContext,
  AIRecommendation,

  // Interest types
  PresetInterestId,
  InterestCategory,
  PresetInterestDomain,
  CustomInterest,
  CustomInterestInput,
  UserInterestConfig,
  UserInterestConfigFull,
  ExtendedUserProfile,
  UserProfileSettings,

  // Suggestion types
  SuggestionType,
  SuggestionStatus,
  OrganizationSuggestion,
  SuggestionInput,
  BookmarkCluster,
  InboxAnalysis,
  OrganizationAnalysis,
} from "./types";

// Constants
export {
  CLASSIFICATION_WEIGHTS,
  CLASSIFICATION_THRESHOLDS,
  FOLDER_LIMITS,
  INBOX_ORGANIZE_TRIGGERS,
  CUSTOM_INTEREST_LIMITS,
  USER_LIFECYCLE_THRESHOLDS,
  PROFILE_UPDATE_SCHEDULE,
} from "./constants/limits";

export {
  PRESET_INTEREST_DOMAINS,
  getAllPresetInterestIds,
  getInterestsByCategory,
  getSuggestedFolders,
  getKeywordsForInterests,
  DEFAULT_FOLDERS,
} from "./constants/interest-domains";

// Services (interfaces for external use)
export type {
  IClassificationService,
  IInboxOrganizerService,
  IInterestService,
  IUserStageService,
} from "./services/interfaces";

// Utility functions (client-safe)
export {
  cosineSimilarity,
  euclideanDistance,
  calculateCentroid,
  calculateInternalSimilarity,
  findTopKSimilar,
  normalizeVector,
} from "./utils/similarity";

export {
  clusterBookmarks,
  kMeansClustering,
  densityClustering,
} from "./utils/clustering";

// NOTE: Server-only exports (integration layer) are in ./server
// Import from '@/lib/classification/server' for:
// - classifyBookmarkV2
// - updateFolderProfileAfterClassification
// - shouldUseV2Classification
