/**
 * Folder Organization Module (Backward Compatibility)
 *
 * @deprecated This module is deprecated. Please import from "@/lib/folder" instead.
 * This file is kept for backward compatibility during migration.
 *
 * @module folder-organization
 * @version 4.2.1
 * @deprecated 2025-12-24 - Use @/lib/folder instead
 */

// Re-export everything from the new unified folder module

// Types
export * from "@/lib/folder/organization/types";

// Services
export { SmartSortingService, smartSortingService } from "@/lib/folder";

export {
  IncrementalProfileService,
  createIncrementalProfileService,
  type BookmarkChangeEvent,
  type ProfileUpdateResult,
  type IncrementalProfileConfig,
} from "@/lib/folder";

// Algorithms
export {
  DBSCANCluster,
  type DBSCANOptions,
  type ClusterResult,
} from "@/lib/folder";

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
} from "@/lib/folder";

// Heat Tracking Service
export {
  FolderHeatTrackerService,
  initHeatTracker,
  getHeatTracker,
  stopHeatTracker,
  getPendingSuggestionsCount,
  type HeatTrackerConfig,
  type HeatTrackerStatus,
} from "@/lib/folder";

// Module Initialization
export {
  initFolderOrganization,
  getFolderOrganizationStatus,
  getFullFolderOrganizationStatus,
} from "@/lib/folder";
