/**
 * Obsidian 格式化器
 * 支持 Frontmatter 元数据、单文件和多文件 ZIP 模式
 */

import { OBSIDIAN_ZIP_THRESHOLD } from "../constants";
import type {
  BookmarkWithFolder,
  ExportFormatter,
  ExportFormatOptions,
  ObsidianFormatOptions,
} from "../types";

/**
 * 格式化日期为 ISO 格式
 */
function formatDateISO(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}

/**
 * 格式化日期为本地格式
 */
function formatDateLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("zh-CN");
  } catch {
    return dateStr;
  }
}

/**
 * 清理文件名中的非法字符
 */
function sanitizeFilename(name: string): string {
  // 移除或替换非法字符
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 100); // 限制长度
}

/**
 * 生成 URL 哈希（用于文件命名）
 */
function generateUrlHash(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

/**
 * Obsidian 格式化器类
 */
export class ObsidianFormatter implements ExportFormatter {
  private outputMode: "single" | "zip";
  private zipThreshold: number;
  private fileNamePattern: "title" | "url-hash" | "date-title";

  constructor(options?: ObsidianFormatOptions) {
    this.outputMode = options?.outputMode ?? "single";
    this.zipThreshold = options?.zipThreshold ?? OBSIDIAN_ZIP_THRESHOLD;
    this.fileNamePattern = options?.fileNamePattern ?? "title";
  }

  /**
   * 生成 Frontmatter
   */
  private generateFrontmatter(bookmark: BookmarkWithFolder): string {
    const fm: string[] = ["---"];

    fm.push(`title: "${(bookmark.title || "无标题").replace(/"/g, '\\"')}"`);
    fm.push(`url: "${bookmark.url}"`);

    if (bookmark.author) {
      fm.push(`author: "${bookmark.author.replace(/"/g, '\\"')}"`);
    }

    if (bookmark.platform) {
      fm.push(`platform: "${bookmark.platform}"`);
    }

    if (bookmark.folders?.name) {
      fm.push(`folder: "${bookmark.folders.name.replace(/"/g, '\\"')}"`);
    }

    if (bookmark.created_at) {
      fm.push(`created: ${formatDateISO(bookmark.created_at)}`);
    }

    // 标签（Obsidian 格式）
    const allTags = [
      ...(bookmark.ai_tags || []),
      ...(bookmark.user_tags || []),
    ];
    if (allTags.length > 0) {
      fm.push(`tags:`);
      allTags.forEach((tag) => {
        // 清理标签中的特殊字符
        const cleanTag = tag.replace(/[#\[\]]/g, "").trim();
        if (cleanTag) {
          fm.push(`  - ${cleanTag}`);
        }
      });
    }

    if (bookmark.rating !== null && bookmark.rating !== undefined) {
      fm.push(`rating: ${bookmark.rating}`);
    }

    if (bookmark.is_starred) {
      fm.push(`starred: true`);
    }

    fm.push("---");
    fm.push("");

    return fm.join("\n");
  }

  /**
   * 生成文件名
   */
  generateFilename(bookmark: BookmarkWithFolder): string {
    switch (this.fileNamePattern) {
      case "url-hash":
        return `bookmark_${generateUrlHash(bookmark.url)}.md`;
      case "date-title": {
        const date = formatDateISO(bookmark.created_at) || "unknown";
        const title = sanitizeFilename(bookmark.title || "无标题");
        return `${date}_${title}.md`;
      }
      case "title":
      default: {
        const title = sanitizeFilename(bookmark.title || "无标题");
        return `${title}.md`;
      }
    }
  }

  /**
   * 格式化单条书签（Obsidian 格式）
   */
  formatItem(bookmark: BookmarkWithFolder, _index: number): string {
    let md = "";

    // Frontmatter
    md += this.generateFrontmatter(bookmark);

    // 标题
    md += `# ${bookmark.title || "无标题"}\n\n`;

    // 链接
    md += `**链接**：[${bookmark.url}](${bookmark.url})\n\n`;

    // 元信息
    const metaInfo: string[] = [];
    if (bookmark.author) {
      metaInfo.push(`作者: ${bookmark.author}`);
    }
    if (bookmark.platform) {
      metaInfo.push(`平台: ${bookmark.platform}`);
    }
    if (bookmark.created_at) {
      metaInfo.push(`收藏时间: ${formatDateLocal(bookmark.created_at)}`);
    }
    if (metaInfo.length > 0) {
      md += `> ${metaInfo.join(" | ")}\n\n`;
    }

    // AI 摘要
    if (bookmark.ai_summary) {
      md += `## 摘要\n\n${bookmark.ai_summary}\n\n`;
    }

    // 描述
    if (bookmark.description) {
      md += `## 描述\n\n${bookmark.description}\n\n`;
    }

    // 笔记
    if (bookmark.notes) {
      md += `## 笔记\n\n${bookmark.notes}\n\n`;
    }

    // 标签（Obsidian 格式）
    const allTags = [
      ...(bookmark.ai_tags || []),
      ...(bookmark.user_tags || []),
    ];
    if (allTags.length > 0) {
      const tagLinks = allTags.map((tag) => {
        const cleanTag = tag.replace(/[#\[\]]/g, "").trim();
        return `#${cleanTag}`;
      });
      md += `\n---\n\n${tagLinks.join(" ")}\n`;
    }

    return md;
  }

  /**
   * 格式化多条书签（单文件模式）
   */
  formatAllSingle(bookmarks: BookmarkWithFolder[]): string {
    let md = "";

    // 文件头部（简化版 Frontmatter）
    md += "---\n";
    md += `title: "AnyKeep 书签导出"\n`;
    md += `exported: ${new Date().toISOString().split("T")[0]}\n`;
    md += `count: ${bookmarks.length}\n`;
    md += "---\n\n";

    md += `# AnyKeep 书签导出\n\n`;
    md += `> 导出时间：${new Date().toLocaleString("zh-CN")}\n`;
    md += `> 总计：${bookmarks.length} 条书签\n\n`;
    md += "---\n\n";

    // 按文件夹分组
    const grouped = new Map<string, BookmarkWithFolder[]>();

    bookmarks.forEach((bookmark) => {
      const folderName = bookmark.folders?.name || "未分类";
      if (!grouped.has(folderName)) {
        grouped.set(folderName, []);
      }
      grouped.get(folderName)!.push(bookmark);
    });

    // 遍历每个文件夹
    grouped.forEach((items, folderName) => {
      md += `## ${folderName}\n\n`;

      items.forEach((bookmark, index) => {
        md += `### ${index + 1}. ${bookmark.title || "无标题"}\n\n`;
        md += `**链接**：[${bookmark.url}](${bookmark.url})\n\n`;

        if (bookmark.author) {
          md += `**作者**：${bookmark.author}\n\n`;
        }

        if (bookmark.platform) {
          md += `**平台**：${bookmark.platform}\n\n`;
        }

        if (bookmark.ai_summary) {
          md += `**摘要**：${bookmark.ai_summary}\n\n`;
        }

        // 标签
        const allTags = [
          ...(bookmark.ai_tags || []),
          ...(bookmark.user_tags || []),
        ];
        if (allTags.length > 0) {
          const tagLinks = allTags
            .map((tag) => `#${tag.replace(/[#\[\]]/g, "").trim()}`)
            .join(" ");
          md += `**标签**：${tagLinks}\n\n`;
        }

        md += "---\n\n";
      });
    });

    return md;
  }

  /**
   * 格式化多条书签
   * 根据数量自动选择单文件或 ZIP 模式
   */
  formatAll(
    bookmarks: BookmarkWithFolder[],
    options?: ExportFormatOptions,
  ): string | Promise<Blob> {
    // 合并选项
    if (options?.obsidian) {
      if (options.obsidian.outputMode) {
        this.outputMode = options.obsidian.outputMode;
      }
      if (options.obsidian.zipThreshold !== undefined) {
        this.zipThreshold = options.obsidian.zipThreshold;
      }
      if (options.obsidian.fileNamePattern) {
        this.fileNamePattern = options.obsidian.fileNamePattern;
      }
    }

    // 根据模式和数量决定输出方式
    const shouldUseZip =
      this.outputMode === "zip" || bookmarks.length > this.zipThreshold;

    if (shouldUseZip) {
      // 返回 ZIP 文件生成 Promise
      return this.formatAllZip(bookmarks);
    }

    // 单文件模式
    return this.formatAllSingle(bookmarks);
  }

  /**
   * 格式化多条书签（ZIP 模式）
   * 返回 Blob Promise
   */
  async formatAllZip(bookmarks: BookmarkWithFolder[]): Promise<Blob> {
    // 动态导入 JSZip
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // 创建文件夹结构
    const folders = new Map<string, typeof zip>();

    bookmarks.forEach((bookmark) => {
      const folderName = bookmark.folders?.name || "未分类";

      // 获取或创建文件夹
      if (!folders.has(folderName)) {
        folders.set(folderName, zip.folder(sanitizeFilename(folderName))!);
      }

      const folder = folders.get(folderName)!;
      const filename = this.generateFilename(bookmark);
      const content = this.formatItem(bookmark, 0);

      folder.file(filename, content);
    });

    // 生成索引文件
    const indexContent = this.generateIndexFile(bookmarks);
    zip.file("INDEX.md", indexContent);

    // 生成 ZIP
    return zip.generateAsync({ type: "blob" });
  }

  /**
   * 生成索引文件
   */
  private generateIndexFile(bookmarks: BookmarkWithFolder[]): string {
    let md = "";

    md += "---\n";
    md += `title: "AnyKeep 书签索引"\n`;
    md += `exported: ${new Date().toISOString().split("T")[0]}\n`;
    md += `count: ${bookmarks.length}\n`;
    md += "---\n\n";

    md += `# AnyKeep 书签索引\n\n`;
    md += `> 导出时间：${new Date().toLocaleString("zh-CN")}\n`;
    md += `> 总计：${bookmarks.length} 条书签\n\n`;
    md += "---\n\n";

    // 按文件夹分组生成索引
    const grouped = new Map<string, BookmarkWithFolder[]>();

    bookmarks.forEach((bookmark) => {
      const folderName = bookmark.folders?.name || "未分类";
      if (!grouped.has(folderName)) {
        grouped.set(folderName, []);
      }
      grouped.get(folderName)!.push(bookmark);
    });

    grouped.forEach((items, folderName) => {
      md += `## ${folderName}\n\n`;

      items.forEach((bookmark, index) => {
        const filename = this.generateFilename(bookmark);
        const safeFolderName = sanitizeFilename(folderName);
        md += `${index + 1}. [[${safeFolderName}/${filename}|${bookmark.title || "无标题"}]]\n`;
      });

      md += "\n";
    });

    return md;
  }

  /**
   * 生成预览
   */
  generatePreview(bookmarks: BookmarkWithFolder[], count: number = 3): string {
    const previewItems = bookmarks.slice(0, count);

    let md = `# 导出预览（Obsidian 格式，前 ${count} 条）\n\n`;
    md += "---\n\n";

    previewItems.forEach((bookmark, index) => {
      md += this.formatItem(bookmark, index);
      md += "\n---\n\n";
    });

    return md;
  }

  /**
   * 获取 MIME 类型
   */
  getMimeType(): string {
    return this.outputMode === "zip"
      ? "application/zip"
      : "text/markdown;charset=utf-8";
  }

  /**
   * 获取文件扩展名
   */
  getExtension(): string {
    return this.outputMode === "zip" ? "zip" : "md";
  }

  /**
   * 检查是否应该使用 ZIP 模式
   */
  shouldUseZip(count: number): boolean {
    return this.outputMode === "zip" || count > this.zipThreshold;
  }
}

/**
 * 快捷导出函数
 */
export function exportToObsidian(
  bookmarks: BookmarkWithFolder[],
  options?: ObsidianFormatOptions,
): string | Promise<Blob> {
  const formatter = new ObsidianFormatter(options);
  return formatter.formatAll(bookmarks);
}

/**
 * 生成 Obsidian 预览
 */
export function generateObsidianPreview(
  bookmarks: BookmarkWithFolder[],
  options?: ObsidianFormatOptions,
  count: number = 3,
): string {
  const formatter = new ObsidianFormatter(options);
  return formatter.generatePreview(bookmarks, count);
}
