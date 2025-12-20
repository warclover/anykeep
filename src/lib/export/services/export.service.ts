/**
 * 导出服务
 * 核心导出执行逻辑，支持多种格式、进度回调、取消操作
 */

import {
  CHUNK_SIZE,
  EXPORT_ERROR_MESSAGES,
  EXPORT_FORMAT_CONFIG,
  EXPORT_THRESHOLDS,
  EXPORT_TIMEOUT,
} from "../constants";
import {
  CsvFormatter,
  MarkdownFormatter,
  ObsidianFormatter,
} from "../formatters";
import type {
  BookmarkWithFolder,
  ExportConfig,
  ExportErrorCode,
  ExportFormat,
  ExportFormatOptions,
  ExportProgress,
  ExportResult,
  ExportStatus,
} from "../types";

/**
 * 进度回调类型
 */
export type ProgressCallback = (progress: ExportProgress) => void;

/**
 * 导出选项
 */
export interface ExportOptions {
  /** 进度回调 */
  onProgress?: ProgressCallback;
  /** 取消信号 */
  signal?: AbortSignal;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 生成导出文件名
 */
export function generateExportFilename(
  format: ExportFormat,
  prefix: string = "anykeep_export",
): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = date.toTimeString().slice(0, 5).replace(/:/g, "");
  const extension = EXPORT_FORMAT_CONFIG[format]?.extension || format;

  return `${prefix}_${dateStr}_${timeStr}.${extension}`;
}

/**
 * 触发文件下载
 */
export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType: string,
): void {
  let blob: Blob;

  if (content instanceof Blob) {
    blob = content;
  } else {
    blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 检查是否需要显示进度条
 */
export function shouldShowProgress(count: number): boolean {
  return count >= EXPORT_THRESHOLDS.WITH_PROGRESS;
}

/**
 * 检查是否需要分块处理
 */
export function shouldChunk(count: number): boolean {
  return count >= EXPORT_THRESHOLDS.CHUNKED;
}

/**
 * 创建进度对象
 */
function createProgress(
  status: ExportStatus,
  current: number,
  total: number,
  stage?: string,
): ExportProgress {
  return {
    status,
    current,
    total,
    percentage: total > 0 ? Math.round((current / total) * 100) : 0,
    stage,
  };
}

/**
 * 等待一帧（用于更新 UI）
 */
function waitFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * 导出服务类
 */
export class ExportService {
  private abortController: AbortController | null = null;

  /**
   * 执行导出
   */
  async export(
    bookmarks: BookmarkWithFolder[],
    config: ExportConfig,
    options?: ExportOptions,
  ): Promise<ExportResult> {
    const startTime = Date.now();
    const { format, options: formatOptions } = config;
    const { onProgress, signal, timeout = EXPORT_TIMEOUT } = options || {};

    // 检查是否有数据
    if (!bookmarks || bookmarks.length === 0) {
      return this.createErrorResult("NO_DATA", format);
    }

    // 设置取消控制器
    this.abortController = new AbortController();
    const internalSignal = this.abortController.signal;

    // 监听外部取消信号
    if (signal) {
      signal.addEventListener("abort", () => {
        this.abortController?.abort();
      });
    }

    // 设置超时
    const timeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, timeout);

    try {
      // 报告开始状态
      onProgress?.(
        createProgress("preparing", 0, bookmarks.length, "准备导出..."),
      );

      // 检查取消
      if (internalSignal.aborted) {
        return this.createErrorResult("CANCELLED", format);
      }

      // 执行格式化
      const result = await this.formatBookmarks(
        bookmarks,
        format,
        formatOptions,
        (current, total) => {
          onProgress?.(
            createProgress("exporting", current, total, "正在导出..."),
          );
        },
        internalSignal,
      );

      // 检查取消
      if (internalSignal.aborted) {
        return this.createErrorResult("CANCELLED", format);
      }

      // 报告完成
      onProgress?.(
        createProgress(
          "success",
          bookmarks.length,
          bookmarks.length,
          "导出完成",
        ),
      );

      const duration = Date.now() - startTime;
      const filename = generateExportFilename(format);
      const size =
        result instanceof Blob ? result.size : new Blob([result]).size;

      return {
        success: true,
        filename,
        content: result,
        count: bookmarks.length,
        format,
        size,
        duration,
      };
    } catch (error) {
      // 检查是否是取消
      if (internalSignal.aborted) {
        return this.createErrorResult("CANCELLED", format);
      }

      console.error("[ExportService] Export failed:", error);
      return this.createErrorResult("UNKNOWN", format, error);
    } finally {
      clearTimeout(timeoutId);
      this.abortController = null;
    }
  }

  /**
   * 取消导出
   */
  cancel(): void {
    this.abortController?.abort();
  }

  /**
   * 格式化书签
   */
  private async formatBookmarks(
    bookmarks: BookmarkWithFolder[],
    format: ExportFormat,
    options?: ExportFormatOptions,
    onProgress?: (current: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<string | Blob> {
    const total = bookmarks.length;
    const needsChunking = shouldChunk(total);

    switch (format) {
      case "csv":
        return this.formatCsv(
          bookmarks,
          options,
          onProgress,
          signal,
          needsChunking,
        );

      case "markdown":
        return this.formatMarkdown(bookmarks, options, onProgress, signal);

      case "obsidian":
        return this.formatObsidian(
          bookmarks,
          options,
          onProgress,
          signal,
          false,
        );

      case "obsidian-zip":
        return this.formatObsidian(
          bookmarks,
          options,
          onProgress,
          signal,
          true,
        );

      case "json":
        return this.formatJson(bookmarks, onProgress, signal, needsChunking);

      case "html":
        return this.formatHtml(bookmarks, onProgress, signal);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * 格式化 CSV（支持分块）
   */
  private async formatCsv(
    bookmarks: BookmarkWithFolder[],
    options?: ExportFormatOptions,
    onProgress?: (current: number, total: number) => void,
    signal?: AbortSignal,
    chunked?: boolean,
  ): Promise<string> {
    const formatter = new CsvFormatter(options?.csv);

    if (!chunked) {
      onProgress?.(bookmarks.length, bookmarks.length);
      return formatter.formatAll(bookmarks, options);
    }

    // 分块处理
    const result: string[] = [];
    const total = bookmarks.length;

    // 添加表头
    const header = formatter
      .formatAll(bookmarks.slice(0, 1), options)
      .split("\n")[0];
    result.push(header);

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      if (signal?.aborted) {
        throw new Error("Cancelled");
      }

      const chunk = bookmarks.slice(i, Math.min(i + CHUNK_SIZE, total));
      chunk.forEach((bookmark, index) => {
        result.push(formatter.formatItem(bookmark, i + index));
      });

      onProgress?.(Math.min(i + CHUNK_SIZE, total), total);

      // 让出主线程
      if (i + CHUNK_SIZE < total) {
        await waitFrame();
      }
    }

    // 添加 UTF-8 BOM
    return "\uFEFF" + result.join("\n");
  }

  /**
   * 格式化 Markdown
   */
  private async formatMarkdown(
    bookmarks: BookmarkWithFolder[],
    options?: ExportFormatOptions,
    onProgress?: (current: number, total: number) => void,
    _signal?: AbortSignal,
  ): Promise<string> {
    const formatter = new MarkdownFormatter(options?.markdown);
    onProgress?.(bookmarks.length, bookmarks.length);
    return formatter.formatAll(bookmarks, options);
  }

  /**
   * 格式化 Obsidian
   */
  private async formatObsidian(
    bookmarks: BookmarkWithFolder[],
    options?: ExportFormatOptions,
    onProgress?: (current: number, total: number) => void,
    _signal?: AbortSignal,
    useZip?: boolean,
  ): Promise<string | Blob> {
    const formatter = new ObsidianFormatter({
      ...options?.obsidian,
      outputMode: useZip ? "zip" : "single",
    });

    onProgress?.(bookmarks.length / 2, bookmarks.length);

    const result = await formatter.formatAll(bookmarks, options);

    onProgress?.(bookmarks.length, bookmarks.length);

    return result;
  }

  /**
   * 格式化 JSON（支持分块）
   */
  private async formatJson(
    bookmarks: BookmarkWithFolder[],
    onProgress?: (current: number, total: number) => void,
    signal?: AbortSignal,
    chunked?: boolean,
  ): Promise<string> {
    if (!chunked) {
      onProgress?.(bookmarks.length, bookmarks.length);
      return JSON.stringify(this.simplifyBookmarks(bookmarks), null, 2);
    }

    // 分块处理
    const result: ReturnType<typeof this.simplifyBookmark>[] = [];
    const total = bookmarks.length;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      if (signal?.aborted) {
        throw new Error("Cancelled");
      }

      const chunk = bookmarks.slice(i, Math.min(i + CHUNK_SIZE, total));
      chunk.forEach((bookmark) => {
        result.push(this.simplifyBookmark(bookmark));
      });

      onProgress?.(Math.min(i + CHUNK_SIZE, total), total);

      // 让出主线程
      if (i + CHUNK_SIZE < total) {
        await waitFrame();
      }
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * 格式化 HTML（浏览器书签格式）
   */
  private async formatHtml(
    bookmarks: BookmarkWithFolder[],
    onProgress?: (current: number, total: number) => void,
    _signal?: AbortSignal,
  ): Promise<string> {
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n`;
    html += `<!-- This is an automatically generated file.\n`;
    html += `     It will be read and overwritten.\n`;
    html += `     DO NOT EDIT! -->\n`;
    html += `<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n`;
    html += `<TITLE>AnyKeep Bookmarks</TITLE>\n`;
    html += `<H1>AnyKeep Bookmarks</H1>\n`;
    html += `<DL><p>\n`;

    // 按文件夹分组
    const grouped = new Map<string, BookmarkWithFolder[]>();

    bookmarks.forEach((bookmark) => {
      const folderName = bookmark.folders?.name || "未分类";
      if (!grouped.has(folderName)) {
        grouped.set(folderName, []);
      }
      grouped.get(folderName)!.push(bookmark);
    });

    grouped.forEach((items, folderName) => {
      html += `    <DT><H3>${this.escapeHtml(folderName)}</H3>\n`;
      html += `    <DL><p>\n`;

      items.forEach((bookmark) => {
        const addDate = bookmark.created_at
          ? Math.floor(new Date(bookmark.created_at).getTime() / 1000)
          : "";
        html += `        <DT><A HREF="${this.escapeHtml(bookmark.url)}" ADD_DATE="${addDate}">${this.escapeHtml(bookmark.title || "无标题")}</A>\n`;
      });

      html += `    </DL><p>\n`;
    });

    html += `</DL><p>\n`;

    onProgress?.(bookmarks.length, bookmarks.length);

    return html;
  }

  /**
   * 简化书签数据（用于 JSON 导出）
   */
  private simplifyBookmarks(bookmarks: BookmarkWithFolder[]) {
    return bookmarks.map((bookmark) => this.simplifyBookmark(bookmark));
  }

  /**
   * 简化单条书签
   */
  private simplifyBookmark(bookmark: BookmarkWithFolder) {
    return {
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      author: bookmark.author,
      platform: bookmark.platform,
      folderId: bookmark.folder_id,
      folderName: bookmark.folders?.name,
      aiSummary: bookmark.ai_summary,
      aiTags: bookmark.ai_tags,
      userTags: bookmark.user_tags,
      notes: bookmark.notes,
      coverUrl: bookmark.cover_url,
      rating: bookmark.rating,
      isStarred: bookmark.is_starred,
      createdAt: bookmark.created_at,
    };
  }

  /**
   * HTML 转义
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    errorCode: ExportErrorCode,
    format: ExportFormat,
    _error?: unknown,
  ): ExportResult {
    return {
      success: false,
      filename: "",
      content: "",
      count: 0,
      format,
      error: EXPORT_ERROR_MESSAGES[errorCode],
      errorCode,
    };
  }
}

/**
 * 默认导出服务实例
 */
export const exportService = new ExportService();

/**
 * 快捷导出函数
 */
export async function quickExport(
  bookmarks: BookmarkWithFolder[],
  format: ExportFormat,
  options?: ExportOptions,
): Promise<ExportResult> {
  const result = await exportService.export(bookmarks, { format }, options);

  if (result.success) {
    const mimeType =
      EXPORT_FORMAT_CONFIG[format]?.mimeType || "application/octet-stream";
    downloadFile(result.content, result.filename, mimeType);
  }

  return result;
}
