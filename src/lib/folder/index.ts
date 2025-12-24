/**
 * Folder 模块统一导出
 *
 * 整合 operations、organization、cache 子模块
 *
 * 包含功能：
 * - 文件夹操作执行器（创建、合并、分拆、重命名）
 * - 文件夹自组织服务（智能分拣、画像更新）
 * - 聚类算法
 * - 热度追踪
 * - 客户端缓存
 *
 * @module folder
 * @version 2.0.0
 * @since 2025-12-11
 * @updated 2025-12-24 - Consolidated into unified module structure
 */

// ============================================================================
// Folder Operations - 文件夹操作执行器
// ============================================================================

// Types
export type {
  FolderCreateInput,
  FolderMergeInput,
  FolderSplitInput,
  FolderRenameInput,
  FolderCreateResult,
  FolderMergeResult,
  FolderSplitResult,
  FolderRenameResult,
  ExecutionResult,
  BaseExecutionResult,
} from "./operations";

// Service
export { FolderExecutorService, folderExecutorService } from "./operations";

// ============================================================================
// Folder Organization - 文件夹自组织
// ============================================================================

// Domain Types
export * from "./organization/types";

// Smart Sorting Service
export { SmartSortingService, smartSortingService } from "./organization";

// Incremental Profile Service
export {
  IncrementalProfileService,
  createIncrementalProfileService,
  type BookmarkChangeEvent,
  type ProfileUpdateResult,
  type IncrementalProfileConfig,
} from "./organization";

// DBSCAN Clustering Algorithm
export {
  DBSCANCluster,
  cosineDistance,
  euclideanDistance,
  createBookmarkClusterer,
  createFolderSplitAnalyzer,
  type DBSCANOptions,
  type ClusterResult,
  type ClusterSummary,
} from "./organization";

// Auto-Organization Service
export {
  FolderAutoOrganizationService,
  createFolderAutoOrganizationService,
  type OrganizationSuggestion,
  type OrganizationSuggestionType,
  type MergeSuggestionAction,
  type SplitSuggestionAction,
  type RenameSuggestionAction,
  type AutoOrganizationConfig,
} from "./organization";

// Heat Tracking Service
export {
  FolderHeatTrackerService,
  initHeatTracker,
  getHeatTracker,
  stopHeatTracker,
  getPendingSuggestionsCount,
  type HeatTrackerConfig,
  type HeatTrackerStatus,
} from "./organization";

// Module Initialization
export {
  initFolderOrganization,
  stopFolderOrganization,
  getFolderOrganizationStatus,
  getFullFolderOrganizationStatus,
  updateLastEventTime,
} from "./organization";

// ============================================================================
// Folder Cache - 客户端缓存
// ============================================================================

export {
  FOLDERS_CACHE_KEY,
  CACHE_STALE_TIME,
  CACHE_MAX_AGE,
  getFoldersCache,
  setFoldersCache,
  isFoldersCacheFresh,
  getFoldersCacheTimestamp,
  clearFoldersCache,
} from "./cache";
