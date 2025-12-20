/**
 * CSV 格式化器
 * 支持自定义字段选择、UTF-8 BOM、特殊字符处理
 */

import { CSV_FIELD_LABELS, DEFAULT_CSV_FIELDS } from "../constants";
import type {
  BookmarkWithFolder,
  CsvFormatOptions,
  ExportFormatter,
  ExportFormatOptions,
} from "../types";

/** UTF-8 BOM 前缀（解决 Excel 中文乱码） */
const UTF8_BOM = "\uFEFF";

/**
 * 转义 CSV 字段值
 * - 如果包含逗号、引号、换行符，则用双引号包裹
 * - 如果包含双引号，则双引号转义为两个双引号
 */
function escapeCsvValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // 检查是否需要转义
  const needsEscape =
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r");

  if (needsEscape) {
    // 双引号转义为两个双引号，然后整体用双引号包裹
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("zh-CN");
  } catch {
    return dateStr;
  }
}

/**
 * 格式化标签数组
 */
function formatTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) return "";
  return tags.join(", ");
}

/**
 * 从书签中提取字段值
 */
function getFieldValue(bookmark: BookmarkWithFolder, field: string): string {
  switch (field) {
    case "title":
      return bookmark.title || "";
    case "url":
      return bookmark.url || "";
    case "folder":
      return bookmark.folders?.name || "";
    case "created_at":
      return formatDate(bookmark.created_at);
    case "platform":
      return bookmark.platform || "";
    case "ai_tags":
      return formatTags(bookmark.ai_tags);
    case "user_tags":
      return formatTags(bookmark.user_tags);
    case "ai_summary":
      return bookmark.ai_summary || "";
    case "description":
      return bookmark.description || "";
    case "author":
      return bookmark.author || "";
    case "notes":
      return bookmark.notes || "";
    case "rating":
      return bookmark.rating?.toString() || "";
    case "is_starred":
      return bookmark.is_starred ? "是" : "否";
    default:
      return "";
  }
}

/**
 * CSV 格式化器类
 */
export class CsvFormatter implements ExportFormatter {
  private fields: string[];
  private delimiter: string;
  private includeHeader: boolean;

  constructor(options?: CsvFormatOptions) {
    this.fields = options?.fields ?? [...DEFAULT_CSV_FIELDS];
    this.delimiter = options?.delimiter ?? ",";
    this.includeHeader = options?.includeHeader ?? true;
  }

  /**
   * 生成表头行
   */
  generateHeader(): string {
    const headers = this.fields.map((field) =>
      escapeCsvValue(CSV_FIELD_LABELS[field] || field),
    );
    return headers.join(this.delimiter);
  }

  /**
   * 格式化单条书签
   */
  formatItem(bookmark: BookmarkWithFolder, _index: number): string {
    const values = this.fields.map((field) =>
      escapeCsvValue(getFieldValue(bookmark, field)),
    );
    return values.join(this.delimiter);
  }

  /**
   * 格式化多条书签
   */
  formatAll(
    bookmarks: BookmarkWithFolder[],
    options?: ExportFormatOptions,
  ): string {
    // 合并选项
    if (options?.csv) {
      if (options.csv.fields) {
        this.fields = options.csv.fields;
      }
      if (options.csv.delimiter) {
        this.delimiter = options.csv.delimiter;
      }
      if (options.csv.includeHeader !== undefined) {
        this.includeHeader = options.csv.includeHeader;
      }
    }

    const lines: string[] = [];

    // 添加 UTF-8 BOM
    let content = UTF8_BOM;

    // 添加表头
    if (this.includeHeader) {
      lines.push(this.generateHeader());
    }

    // 添加数据行
    bookmarks.forEach((bookmark, index) => {
      lines.push(this.formatItem(bookmark, index));
    });

    content += lines.join("\n");

    return content;
  }

  /**
   * 生成预览
   */
  generatePreview(bookmarks: BookmarkWithFolder[], count: number = 3): string {
    const previewItems = bookmarks.slice(0, count);
    return this.formatAll(previewItems);
  }

  /**
   * 获取 MIME 类型
   */
  getMimeType(): string {
    return "text/csv;charset=utf-8";
  }

  /**
   * 获取文件扩展名
   */
  getExtension(): string {
    return "csv";
  }
}

/**
 * 快捷导出函数
 */
export function exportToCsv(
  bookmarks: BookmarkWithFolder[],
  options?: CsvFormatOptions,
): string {
  const formatter = new CsvFormatter(options);
  return formatter.formatAll(bookmarks);
}

/**
 * 生成 CSV 预览
 */
export function generateCsvPreview(
  bookmarks: BookmarkWithFolder[],
  options?: CsvFormatOptions,
  count: number = 3,
): string {
  const formatter = new CsvFormatter(options);
  return formatter.generatePreview(bookmarks, count);
}
