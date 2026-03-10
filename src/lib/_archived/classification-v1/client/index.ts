/**
 * Classification client-side utilities
 */

export {
  getInterestProfile,
  initializeInterestProfile,
  updateManualDescription,
  analyzeImportedBookmarks,
  learnFromBehavior,
  updateStage,
  shouldTriggerAnalysis,
  type ProfileStats,
} from "./interest-profile";

// Phase 4: 前端预匹配模块 (v1.1.0)
export {
  TagPreMatcher,
  tagPreMatcher,
  type CachedFolder,
  type PreMatchResult,
  type TagPreMatcherConfig,
} from "./tag-pre-matcher";

export {
  FolderCacheSyncService,
  folderCacheSync,
  type SyncResult,
  type FolderCacheSyncConfig,
} from "./folder-cache-sync";
