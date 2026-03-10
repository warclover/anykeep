/**
 * Smart Sorting 模块索引
 *
 * @module classification/smart-sorting
 * @version 1.0.0
 * @since 2025-12-25
 */

// 类型导出
export type {
  PendingBookmark,
  Cluster,
  SortingResult,
  FolderSuggestion,
} from "./types";
export { CLUSTERING_CONFIG, DAILY_LIMIT } from "./types";

// 聚类
export { performClustering } from "./clustering";

// 命名
export { generateClusterName, generateFallbackName } from "./naming";

// 操作
export {
  checkDuplicateFolder,
  autoCreateFolder,
  updateBookmarkClusters,
  createSuggestion,
  getClusterPreview,
  confirmCreate,
  rejectCreate,
} from "./operations";
