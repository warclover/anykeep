/**
 * 微信文章导出模块
 *
 * @module wechat-article/export
 * @description 支持 Markdown 和 PDF 格式导出
 *
 * Phase 6 升级
 */

// Markdown 导出
export {
  exportToMarkdown,
  htmlToMarkdownEnhanced,
  type MarkdownExportOptions,
  type MarkdownExportResult,
} from "./markdown.exporter";

// PDF 导出
export {
  exportToPdf,
  isPuppeteerAvailable,
  type PdfExportOptions,
  type PdfExportResult,
} from "./pdf.exporter";

// 共享类型
export type { ArticleMetadata } from "./markdown.exporter";
