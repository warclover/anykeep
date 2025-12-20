/**
 * 预览工具函数
 */

import type {
  BookmarkWithFolder,
  ExportFormat,
  ExportPreviewData,
} from "../types";
import {
  CsvFormatter,
  MarkdownFormatter,
  ObsidianFormatter,
} from "../formatters";

/**
 * 估算导出文件大小（字节）
 * 基于格式和数据量进行估算
 */
export function estimateFileSize(
  bookmarks: BookmarkWithFolder[],
  format: ExportFormat,
): number {
  const count = bookmarks.length;

  // 估算单条书签的平均大小（字节）
  const avgSizePerItem: Record<ExportFormat, number> = {
    csv: 200, // CSV 比较紧凑
    markdown: 500, // Markdown 中等
    obsidian: 600, // Obsidian 带 Frontmatter
    "obsidian-zip": 700, // ZIP 压缩后可能更小，但预留空间
    json: 400, // JSON 带格式化
    html: 350, // HTML 标签开销
  };

  const avgSize = avgSizePerItem[format] || 400;
  const baseSize = count * avgSize;

  // 添加文件头开销
  const headerSize: Record<ExportFormat, number> = {
    csv: 100, // 表头
    markdown: 200, // 标题和说明
    obsidian: 300, // Frontmatter
    "obsidian-zip": 1000, // 索引文件
    json: 50, // 括号
    html: 500, // HTML 结构
  };

  return baseSize + (headerSize[format] || 100);
}

/**
 * 格式化文件大小显示
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * 生成预览内容
 */
export function generatePreviewContent(
  bookmarks: BookmarkWithFolder[],
  format: ExportFormat,
  count: number = 3,
): string {
  const previewItems = bookmarks.slice(0, count);

  switch (format) {
    case "csv": {
      const formatter = new CsvFormatter();
      return formatter.generatePreview(previewItems, count);
    }
    case "markdown": {
      const formatter = new MarkdownFormatter();
      return formatter.generatePreview(previewItems, count);
    }
    case "obsidian":
    case "obsidian-zip": {
      const formatter = new ObsidianFormatter();
      return formatter.generatePreview(previewItems, count);
    }
    case "json": {
      return JSON.stringify(
        previewItems.map((b) => ({
          title: b.title,
          url: b.url,
          folder: b.folders?.name,
          platform: b.platform,
          created_at: b.created_at,
        })),
        null,
        2,
      );
    }
    case "html": {
      return generateHtmlPreview(previewItems);
    }
    default:
      return "";
  }
}

/**
 * 生成 HTML 预览
 */
function generateHtmlPreview(bookmarks: BookmarkWithFolder[]): string {
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n`;
  html += `<!-- This is an automatically generated file. -->\n`;
  html += `<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n`;
  html += `<TITLE>AnyKeep Bookmarks</TITLE>\n`;
  html += `<H1>AnyKeep Bookmarks</H1>\n`;
  html += `<DL><p>\n`;

  bookmarks.forEach((bookmark) => {
    const addDate = bookmark.created_at
      ? Math.floor(new Date(bookmark.created_at).getTime() / 1000)
      : "";
    html += `    <DT><A HREF="${bookmark.url}" ADD_DATE="${addDate}">${bookmark.title || "无标题"}</A>\n`;
  });

  html += `</DL><p>\n`;

  return html;
}

/**
 * 生成完整的导出预览数据
 */
export function generateExportPreview(
  bookmarks: BookmarkWithFolder[],
  format: ExportFormat,
  previewCount: number = 3,
): ExportPreviewData {
  return {
    totalCount: bookmarks.length,
    estimatedSize: estimateFileSize(bookmarks, format),
    previewItems: bookmarks.slice(0, previewCount),
    previewContent: generatePreviewContent(bookmarks, format, previewCount),
  };
}

/**
 * 获取格式的描述
 */
export function getFormatDescription(format: ExportFormat): string {
  const descriptions: Record<ExportFormat, string> = {
    csv: "逗号分隔值格式，适合 Excel 分析",
    markdown: "Markdown 格式，适合笔记工具",
    obsidian: "Obsidian 格式，带 Frontmatter 元数据",
    "obsidian-zip": "Obsidian ZIP 包，每条书签独立文件",
    json: "JSON 格式，适合数据备份和程序处理",
    html: "HTML 格式，可导入到浏览器",
  };

  return descriptions[format] || "未知格式";
}
