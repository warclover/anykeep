/**
 * Markdown 格式化器
 * 基础 Markdown 格式，支持按文件夹分组
 */

import type {
  BookmarkWithFolder,
  ExportFormatter,
  ExportFormatOptions,
  MarkdownFormatOptions,
} from "../types";

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
 * Markdown 格式化器类
 */
export class MarkdownFormatter implements ExportFormatter {
  private groupByFolder: boolean;
  private includeAiSummary: boolean;

  constructor(options?: MarkdownFormatOptions) {
    this.groupByFolder = options?.groupByFolder ?? true;
    this.includeAiSummary = options?.includeAiSummary ?? true;
  }

  /**
   * 格式化单条书签
   */
  formatItem(bookmark: BookmarkWithFolder, index: number): string {
    let md = "";

    // 标题
    md += `### ${index + 1}. ${bookmark.title || "无标题"}\n\n`;

    // 链接
    md += `**链接**：[${bookmark.url}](${bookmark.url})\n\n`;

    // 作者
    if (bookmark.author) {
      md += `**作者**：${bookmark.author}\n\n`;
    }

    // 平台
    if (bookmark.platform) {
      md += `**平台**：${bookmark.platform}\n\n`;
    }

    // 收藏时间
    if (bookmark.created_at) {
      md += `**收藏时间**：${formatDate(bookmark.created_at)}\n\n`;
    }

    // AI 摘要
    if (this.includeAiSummary && bookmark.ai_summary) {
      md += `**AI 摘要**：\n\n${bookmark.ai_summary}\n\n`;
    }

    // 描述
    if (bookmark.description) {
      md += `**描述**：\n\n${bookmark.description}\n\n`;
    }

    // AI 标签
    if (bookmark.ai_tags && bookmark.ai_tags.length > 0) {
      md += `**AI 标签**：${bookmark.ai_tags.map((tag) => `\`${tag}\``).join(" ")}\n\n`;
    }

    // 用户标签
    if (bookmark.user_tags && bookmark.user_tags.length > 0) {
      md += `**我的标签**：${bookmark.user_tags.map((tag) => `\`${tag}\``).join(" ")}\n\n`;
    }

    // 笔记
    if (bookmark.notes) {
      md += `**笔记**：\n\n${bookmark.notes}\n\n`;
    }

    md += "---\n\n";

    return md;
  }

  /**
   * 格式化多条书签
   */
  formatAll(
    bookmarks: BookmarkWithFolder[],
    options?: ExportFormatOptions,
  ): string {
    // 合并选项
    if (options?.markdown) {
      if (options.markdown.groupByFolder !== undefined) {
        this.groupByFolder = options.markdown.groupByFolder;
      }
      if (options.markdown.includeAiSummary !== undefined) {
        this.includeAiSummary = options.markdown.includeAiSummary;
      }
    }

    // 文件头部
    let md = `# 我的书签\n\n`;
    md += `> 导出时间：${new Date().toLocaleString("zh-CN")}\n`;
    md += `> 总计：${bookmarks.length} 条书签\n\n`;
    md += "---\n\n";

    if (this.groupByFolder) {
      // 按文件夹分组
      const grouped = new Map<string, BookmarkWithFolder[]>();

      bookmarks.forEach((bookmark) => {
        const folderName = bookmark.folders?.name || "未分类";
        const folderBookmarks = grouped.get(folderName);
        if (folderBookmarks) {
          folderBookmarks.push(bookmark);
        } else {
          grouped.set(folderName, [bookmark]);
        }
      });

      // 遍历每个文件夹
      grouped.forEach((items, folderName) => {
        md += `## ${folderName}\n\n`;
        items.forEach((bookmark, index) => {
          md += this.formatItem(bookmark, index);
        });
      });
    } else {
      // 不分组，直接列出
      bookmarks.forEach((bookmark, index) => {
        md += this.formatItem(bookmark, index);
      });
    }

    return md;
  }

  /**
   * 生成预览
   */
  generatePreview(bookmarks: BookmarkWithFolder[], count: number = 3): string {
    const previewItems = bookmarks.slice(0, count);

    let md = `# 导出预览（前 ${count} 条）\n\n`;
    md += "---\n\n";

    previewItems.forEach((bookmark, index) => {
      md += this.formatItem(bookmark, index);
    });

    return md;
  }

  /**
   * 获取 MIME 类型
   */
  getMimeType(): string {
    return "text/markdown;charset=utf-8";
  }

  /**
   * 获取文件扩展名
   */
  getExtension(): string {
    return "md";
  }
}

/**
 * 快捷导出函数
 */
export function exportToMarkdown(
  bookmarks: BookmarkWithFolder[],
  options?: MarkdownFormatOptions,
): string {
  const formatter = new MarkdownFormatter(options);
  return formatter.formatAll(bookmarks);
}

/**
 * 生成 Markdown 预览
 */
export function generateMarkdownPreview(
  bookmarks: BookmarkWithFolder[],
  options?: MarkdownFormatOptions,
  count: number = 3,
): string {
  const formatter = new MarkdownFormatter(options);
  return formatter.generatePreview(bookmarks, count);
}
