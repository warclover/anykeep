/**
 * 浏览器书签模块导出入口
 */

// 类型导出
export type {
  ParsedBookmarkNode,
  ParsedBookmarkFile,
  BrowserSource,
  BrowserBookmarkImportOptions,
  ImportProgress,
  ImportProgressStatus,
  ImportResult,
  ImportExtendedStats,
  ImportError,
  DepthWarning,
  ImportBatch,
} from "./types";

// 类型常量导出
export {
  BROWSER_SOURCE_TO_PLATFORM,
  PLATFORM_TO_BROWSER_SOURCE,
  DEFAULT_IMPORT_OPTIONS,
  DEFAULT_IMPORT_PROGRESS,
} from "./types";

// 模块常量导出
export {
  BATCH_SIZE,
  BATCH_DELAY_MS,
  MAX_FOLDER_DEPTH,
  SUPPORTED_FILE_TYPES,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE,
  CHROME_SIGNATURES,
  EDGE_SIGNATURES,
  FIREFOX_SIGNATURES,
  SAFARI_SIGNATURES,
  IMPORT_DIALOG_STEPS,
  IMPORT_STEP_NAMES,
  type ImportDialogStep,
} from "./constants";

// 解析器导出
export {
  parseBookmarkHtml,
  flattenBookmarks,
  filterSelectedBookmarks,
  countNodes,
  countSelectedBookmarks,
  getMaxDepth,
  getFoldersExceedingDepth,
  isValidBookmarkFile,
} from "./parser";

// 检测器导出
export {
  detectBrowserSource,
  getBrowserSourceName,
  getSupportedBrowserSources,
} from "./detector";

// 文件夹映射导出
export {
  extractFolderPaths,
  extractRequiredFolderPaths,
  extractRequiredFolderPathsFromTree,
  buildFolderMapping,
  updateMappingWithCreatedFolders,
  getFolderIdForBookmark,
  generateFolderSummary,
} from "./folder-mapper";

export type {
  FolderMapping,
  FolderCreateRequest,
  FolderMappingResult,
} from "./folder-mapper";

// 平台筛选工具导出
export {
  extractPlatformStats,
  getBookmarkIdsByPlatform,
  getBookmarkIdsByPlatforms,
} from "./platform-utils";
export type { PlatformStats } from "./platform-utils";

// 合并去重工具导出
export { mergeBookmarkFiles, generateMergeSummary } from "./merge-utils";
export type { MergeResult } from "./merge-utils";

// 导入缓存导出
export {
  createImportSession,
  getImportSession,
  updateImportSession,
  deleteImportSession,
  getPendingSession,
  hasPendingSession,
  createImportBatches,
  getSessionBatches,
  getPendingBatches,
  updateBatchStatus,
  getSessionStats,
  cleanupExpiredSessions,
  clearAllImportCache,
} from "./import-cache";
export type {
  ImportSession,
  ImportBatch as CachedImportBatch,
  ImportSessionStatus,
  ImportBatchStatus,
} from "./import-cache";

// 注意：ImportSessionManager 和相关类型包含服务端依赖
// 如需使用，请直接从 "@/lib/browser-bookmark/import-session-manager" 导入

// 链接验证导出
export {
  validateUrl,
  validateUrls,
  filterInvalidLinks,
  getValidationSummary,
} from "./link-validator";
export type {
  LinkStatus,
  LinkValidationResult,
  BatchValidationResult,
  ValidationConfig,
} from "./link-validator";

// 导出器导出
export {
  generateBookmarkHtml,
  generateExportFilename,
  createDownloadBlob,
  triggerDownload,
  exportAndDownload,
} from "./exporter";
export type { ExportBookmark, ExportConfig } from "./exporter";

// 导入历史导出
export {
  createImportHistory,
  getImportHistory,
  deleteImportHistory,
  browserSourceToImportSource,
  getImportSourceDisplayName,
  calculateSuccessRate,
  formatDuration,
  summarizeHistory,
} from "./import-history";
export type {
  CreateImportHistoryParams,
  GetImportHistoryParams,
  ImportHistoryResult,
} from "./import-history";

// 元数据抓取导出
export {
  fetchMetadata,
  batchFetchMetadata,
  validateMetadata,
  mergeMetadata,
  extractSummary,
} from "./metadata-fetcher";
export type {
  PageMetadata,
  FetchMetadataResult,
  BatchFetchResult,
  FetchConfig,
} from "./metadata-fetcher";
