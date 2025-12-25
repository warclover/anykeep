/**
 * 操作模块索引
 *
 * @module classification/smart-sorting/operations
 * @version 1.0.0
 * @since 2025-12-25
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
