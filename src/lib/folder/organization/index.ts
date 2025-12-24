/**
 * Folder Organization Module
 * 文件夹自组织模块导出
 *
 * 职责：
 * - 订阅分类模块事件
 * - 管理文件夹画像（读写权限）
 * - 执行文件夹演进操作（创建、分拆、合并、重命名）
 * - 生成演进报告
 *
 * @module folder/organization
 * @version 4.2.1
 * @updated 2025-12-24 - Migrated to unified folder module
 */

// ============================================================================
// Types
// ============================================================================
export * from "./types";

// ============================================================================
// Services
// ============================================================================

// 注意：以下服务从 classification 模块迁移，当前通过 re-export 方式引用
// 后续迭代将逐步将实现迁移到本模块

// 智能分拣服务（从 classification 模块）
export {
  SmartSortingService,
  smartSortingService,
} from "@/lib/classification/services/smart-sorting.service";

// 增量画像更新服务（从 classification 模块）
export {
  IncrementalProfileService,
  createIncrementalProfileService,
  type BookmarkChangeEvent,
  type ProfileUpdateResult,
  type IncrementalProfileConfig,
} from "@/lib/classification/v3/services/incremental-profile.service";

// ============================================================================
// Algorithms
// ============================================================================
export {
  DBSCANCluster,
  cosineDistance,
  euclideanDistance,
  createBookmarkClusterer,
  createFolderSplitAnalyzer,
  type DBSCANOptions,
  type ClusterResult,
  type ClusterSummary,
} from "./algorithms/dbscan-cluster";

// ============================================================================
// Auto-Organization Service
// ============================================================================
export {
  FolderAutoOrganizationService,
  createFolderAutoOrganizationService,
  type OrganizationSuggestion,
  type OrganizationSuggestionType,
  type MergeSuggestionAction,
  type SplitSuggestionAction,
  type RenameSuggestionAction,
  type AutoOrganizationConfig,
} from "./services/auto-organization.service";

// ============================================================================
// Heat Tracking Service
// ============================================================================
export {
  FolderHeatTrackerService,
  initHeatTracker,
  getHeatTracker,
  stopHeatTracker,
  getPendingSuggestionsCount,
  type HeatTrackerConfig,
  type HeatTrackerStatus,
} from "./services/heat-tracker.service";

// ============================================================================
// Module Initialization
// ============================================================================
export {
  initFolderOrganization,
  stopFolderOrganization,
  getFolderOrganizationStatus,
  getFullFolderOrganizationStatus,
  updateLastEventTime,
} from "./init";
