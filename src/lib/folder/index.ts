/**
 * Folder 模块统一导出
 *
 * ⚠️⚠️⚠️ 重要警告 ⚠️⚠️⚠️
 *
 * 此文件包含服务端代码（依赖 next/headers），仅可在以下环境使用：
 * - Server Components
 * - API Routes
 * - Server Actions
 *
 * ❌ 禁止在以下环境使用：
 * - Client Components（"use client"）
 * - pages/ 目录下的组件
 *
 * ✅ 客户端组件请使用：
 * import { setFoldersCache, clearFoldersCache } from "@/lib/folder/client"
 * 或
 * import { setFoldersCache, clearFoldersCache } from "@/lib/folder/cache"
 *
 * 包含功能：
 * - 文件夹操作执行器（创建、合并、分拆、重命名）
 * - 文件夹自组织服务（智能分拣、画像更新）
 * - 聚类算法
 * - 热度追踪
 * - 客户端缓存
 *
 * @module folder
 * @version 2.1.0
 * @since 2025-12-11
 * @updated 2025-12-25 - Added client/server separation warning
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
