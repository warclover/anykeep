/**
 * 数据导出功能 - 模块入口
 * V2.1: 独立页面 + 多入口复用
 */

// 类型导出
export type {
  ExportFormat,
  ExportStatus,
  ExportScope,
  ExportMode,
  ExportFilter,
  CsvFormatOptions,
  MarkdownFormatOptions,
  ObsidianFormatOptions,
  ExportFormatOptions,
  ExportConfig,
  ExportErrorCode,
  ExportResult,
  ExportProgress,
  ExportDialogV2Props,
  ExportPreviewData,
  BookmarkWithFolder,
  ExportFormatter,
  ExportSource,
  ExportAnalyticsParams,
} from "./types";

// 常量导出
export {
  EXPORT_THRESHOLDS,
  CHUNK_SIZE,
  EXPORT_TIMEOUT,
  OBSIDIAN_ZIP_THRESHOLD,
  DEFAULT_CSV_FIELDS,
  OPTIONAL_CSV_FIELDS,
  CSV_FIELD_CONFIG,
  CSV_FIELD_LABELS,
  EXPORT_FORMAT_CONFIG,
  EXPORT_ERROR_MESSAGES,
  EXPORT_PAGE_TEXT,
  EXPORT_DIALOG_TEXT,
  EXPORT_ANALYTICS_EVENTS,
} from "./constants";

// 格式化器导出
export {
  CsvFormatter,
  exportToCsv,
  generateCsvPreview,
  MarkdownFormatter,
  exportToMarkdown,
  generateMarkdownPreview,
  ObsidianFormatter,
  exportToObsidian,
  generateObsidianPreview,
} from "./formatters";

// 服务导出
export {
  ExportService,
  exportService,
  quickExport,
  generateExportFilename,
  downloadFile,
  shouldShowProgress,
  shouldChunk,
  type ProgressCallback,
  type ExportOptions,
} from "./services";

// 工具函数导出
export {
  estimateFileSize,
  formatFileSize,
  generatePreviewContent,
  generateExportPreview,
  getFormatDescription,
  generateObsidianZip,
  generateZip,
  isZipSupported,
} from "./utils";

// 埋点导出
export { exportAnalytics } from "./analytics";
