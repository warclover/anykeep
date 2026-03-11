/**
 * 操作模块索引
 *
 * @module folder/organization/services/smart-sorting/operations
 * @version 1.0.0
 * @since 2026-03-11 - Migrated from classification-v1
 */

export {
  checkDuplicateFolder,
  autoCreateFolder,
  updateBookmarkClusters,
} from "./folder-operations";

export {
  createSuggestion,
  getClusterPreview,
  confirmCreate,
  rejectCreate,
} from "./suggestion-operations";
