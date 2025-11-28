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
