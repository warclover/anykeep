/**
 * 数据导出格式化器模块
 *
 * 提供多种格式的书签导出功能
 *
 * @module data-export/formatters
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { ExportedBookmark, ExportField, DataExportInput } from "./types";

// ============================================
// 辅助函数
// ============================================

/**
 * HTML 转义
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================
// CSV 格式化
// ============================================

/**
 * 格式化为 CSV
 */
export function formatCsv(
  bookmarks: ExportedBookmark[],
  fields: ExportField[],
): string {
  const fieldMap: Record<ExportField, (b: ExportedBookmark) => string> = {
    title: (b) => b.title,
    url: (b) => b.url,
    platform: (b) => b.platform,
    folder: (b) => b.folderName || "",
    tags: (b) => b.tags.join("; "),
    aiSummary: (b) => b.aiSummary || "",
    aiTags: (b) => b.aiTags.join("; "),
    rating: (b) => b.rating?.toString() || "",
    note: (b) => b.note || "",
    createdAt: (b) => b.createdAt,
    updatedAt: (b) => b.updatedAt,
  };

  const headers = fields.join(",");
  const rows = bookmarks.map((b) =>
    fields
      .map((f) => {
        const value = fieldMap[f](b);
        // CSV 转义
        if (
          value.includes(",") ||
          value.includes('"') ||
          value.includes("\n")
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(","),
  );

  return [headers, ...rows].join("\n");
}

// ============================================
// Markdown 格式化
// ============================================

/**
 * 格式化为 Markdown
 */
export function formatMarkdown(
  bookmarks: ExportedBookmark[],
  _fields: ExportField[],
  options?: DataExportInput["options"],
): string {
  const headingLevel = options?.markdownHeadingLevel || 2;
  const heading = "#".repeat(headingLevel);

  let content = `# 书签导出\n\n`;
  content += `导出时间: ${new Date().toLocaleString("zh-CN")}\n`;
  content += `总数量: ${bookmarks.length}\n\n---\n\n`;

  for (const bookmark of bookmarks) {
    content += `${heading} ${bookmark.title}\n\n`;
    content += `- **URL**: [${bookmark.url}](${bookmark.url})\n`;
    content += `- **平台**: ${bookmark.platform}\n`;
    if (bookmark.folderName) {
      content += `- **文件夹**: ${bookmark.folderName}\n`;
    }
    if (bookmark.tags.length > 0) {
      content += `- **标签**: ${bookmark.tags.map((t) => `\`${t}\``).join(" ")}\n`;
    }
    if (options?.includeAiContent && bookmark.aiSummary) {
      content += `\n> ${bookmark.aiSummary}\n`;
    }
    if (options?.includeNotes && bookmark.note) {
      content += `\n**笔记**: ${bookmark.note}\n`;
    }
    content += `\n---\n\n`;
  }

  return content;
}

// ============================================
// JSON 格式化
// ============================================

/**
 * 格式化为 JSON
 */
export function formatJson(
  bookmarks: ExportedBookmark[],
  fields: ExportField[],
): string {
  const exportData = bookmarks.map((b) => {
    const item: Record<string, unknown> = {};
    for (const field of fields) {
      switch (field) {
        case "title":
          item.title = b.title;
          break;
        case "url":
          item.url = b.url;
          break;
        case "platform":
          item.platform = b.platform;
          break;
        case "folder":
          item.folder = b.folderName;
          break;
        case "tags":
          item.tags = b.tags;
          break;
        case "aiSummary":
          item.aiSummary = b.aiSummary;
          break;
        case "aiTags":
          item.aiTags = b.aiTags;
          break;
        case "rating":
          item.rating = b.rating;
          break;
        case "note":
          item.note = b.note;
          break;
        case "createdAt":
          item.createdAt = b.createdAt;
          break;
        case "updatedAt":
          item.updatedAt = b.updatedAt;
          break;
      }
    }
    return item;
  });

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalCount: bookmarks.length,
      bookmarks: exportData,
    },
    null,
    2,
  );
}

// ============================================
// HTML 格式化
// ============================================

/**
 * 格式化为 HTML（浏览器书签格式）
 */
export function formatHtml(bookmarks: ExportedBookmark[]): string {
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>\n`;

  // 按文件夹分组
  const byFolder = new Map<string, ExportedBookmark[]>();
  for (const b of bookmarks) {
    const folder = b.folderName || "未分类";
    const folderBookmarks = byFolder.get(folder);
    if (folderBookmarks) {
      folderBookmarks.push(b);
    } else {
      byFolder.set(folder, [b]);
    }
  }

  for (const [folder, items] of byFolder) {
    html += `    <DT><H3>${escapeHtml(folder)}</H3>\n`;
    html += `    <DL><p>\n`;
    for (const item of items) {
      const timestamp = Math.floor(new Date(item.createdAt).getTime() / 1000);
      html += `        <DT><A HREF="${escapeHtml(item.url)}" ADD_DATE="${timestamp}">${escapeHtml(item.title)}</A>\n`;
    }
    html += `    </DL><p>\n`;
  }

  html += `</DL><p>\n`;
  return html;
}

// ============================================
// Obsidian 格式化
// ============================================

/**
 * 格式化为 Obsidian 格式
 */
export function formatObsidian(
  bookmarks: ExportedBookmark[],
  options?: DataExportInput["options"],
): string {
  let content = `---
type: bookmark-export
exported: ${new Date().toISOString()}
count: ${bookmarks.length}
---

# 书签库导出

`;

  for (const bookmark of bookmarks) {
    content += `## [[${bookmark.title}]]\n\n`;
    content += `- 链接: ${bookmark.url}\n`;
    content += `- 平台: #${bookmark.platform.replace(/\s+/g, "-")}\n`;
    if (bookmark.folderName) {
      content += `- 文件夹: [[${bookmark.folderName}]]\n`;
    }
    if (bookmark.tags.length > 0) {
      content += `- 标签: ${bookmark.tags.map((t) => `#${t.replace(/\s+/g, "-")}`).join(" ")}\n`;
    }
    if (bookmark.aiSummary) {
      content += `\n> [!summary]\n> ${bookmark.aiSummary}\n`;
    }
    if (options?.includeNotes && bookmark.note) {
      content += `\n### 笔记\n${bookmark.note}\n`;
    }
    content += `\n---\n\n`;
  }

  return content;
}

// ============================================
// 统一格式化入口
// ============================================

/**
 * 根据格式类型格式化内容
 */
export function formatContent(
  bookmarks: ExportedBookmark[],
  format: "csv" | "markdown" | "json" | "html" | "obsidian",
  fields: ExportField[],
  options?: DataExportInput["options"],
): string {
  switch (format) {
    case "csv":
      return formatCsv(bookmarks, fields);
    case "markdown":
      return formatMarkdown(bookmarks, fields, options);
    case "json":
      return formatJson(bookmarks, fields);
    case "html":
      return formatHtml(bookmarks);
    case "obsidian":
      return formatObsidian(bookmarks, options);
    default:
      return formatJson(bookmarks, fields);
  }
}
