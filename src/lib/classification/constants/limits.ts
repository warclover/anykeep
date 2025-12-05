/**
 * Classification system limits and thresholds
 */

/**
 * Classification weight configuration
 */
export const CLASSIFICATION_WEIGHTS = {
  /** Vector matching weight (40%) */
  VECTOR: 0.4,
  /** History matching weight (30%) */
  HISTORY: 0.3,
  /** AI recommendation weight (30%) */
  AI: 0.3,
} as const;

/**
 * Classification thresholds
 */
export const CLASSIFICATION_THRESHOLDS = {
  /** Low confidence threshold - below this goes to inbox */
  LOW_CONFIDENCE: 30,
  /** Medium confidence threshold - save as suggestion for user review */
  MEDIUM_CONFIDENCE: 50,
  /** High confidence threshold - above this is auto-classified */
  HIGH_CONFIDENCE: 70,
  /** Vector similarity threshold for folder matching */
  VECTOR_SIMILARITY: 0.5,
  /** History matching count */
  HISTORY_MATCH_COUNT: 10,
} as const;

/**
 * Folder limits
 */
export const FOLDER_LIMITS = {
  /** Maximum folders per user */
  MAX_FOLDERS: 16,
  /** Maximum auto-created folders per day */
  MAX_AUTO_CREATE_PER_DAY: 8,
  /** Initial folder creation minimum */
  INITIAL_MIN: 3,
  /** Initial folder creation maximum */
  INITIAL_MAX: 7,
  /** Merge suggestion similarity threshold (80%) */
  MERGE_SIMILARITY_THRESHOLD: 0.8,
  /** Split suggestion size threshold (bookmarks count) */
  SPLIT_SIZE_THRESHOLD: 100,
  /** Split suggestion diversity threshold - below this is too diverse */
  SPLIT_DIVERSITY_THRESHOLD: 0.5,
  /** Maximum merge suggestions to return */
  MAX_MERGE_SUGGESTIONS: 5,
  /** Maximum split suggestions to return */
  MAX_SPLIT_SUGGESTIONS: 3,
} as const;

/**
 * Inbox organization triggers
 */
export const INBOX_ORGANIZE_TRIGGERS = {
  /** Trigger when inbox reaches this count */
  COUNT_THRESHOLD: 10,
  /** Trigger after this many days since last organize */
  DAYS_SINCE_LAST_ORGANIZE: 7,
  /** Minimum cluster size for suggestion */
  MIN_CLUSTER_SIZE: 5,
  /** Cluster similarity threshold (70%) */
  CLUSTER_SIMILARITY: 0.7,
  /** Minimum similarity to match existing folder */
  FOLDER_MATCH_THRESHOLD: 0.6,
} as const;

/**
 * Custom interest limits
 */
export const CUSTOM_INTEREST_LIMITS = {
  /** Maximum custom interests per user */
  MAX_CUSTOM_INTERESTS: 5,
  /** Maximum name length */
  MAX_NAME_LENGTH: 20,
  /** Maximum keywords per interest */
  MAX_KEYWORDS: 10,
  /** Maximum suggested folders per interest */
  MAX_SUGGESTED_FOLDERS: 3,
} as const;

/**
 * User lifecycle thresholds
 */
export const USER_LIFECYCLE_THRESHOLDS = {
  /** Threshold for cold start phase (0-20 bookmarks) */
  COLD_START_MAX: 20,
  /** Threshold for growing phase (21-100 bookmarks) */
  GROWING_MAX: 100,
} as const;

/**
 * Profile update schedule
 */
export const PROFILE_UPDATE_SCHEDULE = {
  /** Folder profile update interval (daily) */
  FOLDER_PROFILE_UPDATE_HOURS: 24,
  /** Health check interval (weekly) */
  HEALTH_CHECK_DAYS: 7,
  /** Suggestion expiry days */
  SUGGESTION_EXPIRY_DAYS: 7,
} as const;
