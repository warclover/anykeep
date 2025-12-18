/**
 * Folder 模块统一导出
 *
 * Phase 4: lib/ 模块整理
 * 整合 folder-operations 和 folder-organization 模块
 *
 * 包含功能：
 * - 文件夹操作执行器（创建、合并、分拆、重命名）
 * - 文件夹自组织服务（智能分拣、画像更新）
 * - 聚类算法
 * - 热度追踪
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
} from "../folder-operations";

// Service
export {
  FolderExecutorService,
  folderExecutorService,
} from "../folder-operations";

// ============================================================================
// Folder Organization - 文件夹自组织
// ============================================================================

// Domain Types
export * from "../folder-organization/types/domain-types";

// Smart Sorting Service
export {
  SmartSortingService,
  smartSortingService,
} from "../folder-organization";

// Incremental Profile Service
export {
  IncrementalProfileService,
  createIncrementalProfileService,
  type BookmarkChangeEvent,
  type ProfileUpdateResult,
  type IncrementalProfileConfig,
} from "../folder-organization";

// DBSCAN Clustering Algorithm
export {
  DBSCANCluster,
  type DBSCANOptions,
  type ClusterResult,
} from "../folder-organization";

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
} from "../folder-organization";

// Heat Tracking Service
export {
  FolderHeatTrackerService,
  initHeatTracker,
  getHeatTracker,
  stopHeatTracker,
  getPendingSuggestionsCount,
  type HeatTrackerConfig,
  type HeatTrackerStatus,
} from "../folder-organization";

// Module Initialization
export {
  initFolderOrganization,
  getFolderOrganizationStatus,
  getFullFolderOrganizationStatus,
} from "../folder-organization";
