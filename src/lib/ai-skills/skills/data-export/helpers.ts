/**
 * 数据导出辅助函数模块
 *
 * 提供统计、文件名生成、摘要等辅助功能
 *
 * @module data-export/helpers
 * @version 1.0.0
 * @since 2025-12-25
 */

import type {
  DataExportInput,
  ExportedBookmark,
  ExportStats,
  ExportFormat,
} from "./types";
import { EXPORT_FORMAT_CONFIG } from "./types";

// ============================================
// 统计计算
// ============================================

/**
 * 计算导出统计信息
 */
export function calculateStats(
  bookmarks: ExportedBookmark[],
  content: string,
  durationMs: number,
): ExportStats {
  const byPlatform: Record<string, number> = {};
  const byFolder: Record<string, number> = {};

  for (const b of bookmarks) {
    byPlatform[b.platform] = (byPlatform[b.platform] || 0) + 1;
    const folder = b.folderName || "未分类";
    byFolder[folder] = (byFolder[folder] || 0) + 1;
  }

  return {
    totalExported: bookmarks.length,
    byPlatform,
    byFolder,
    fileSize: new TextEncoder().encode(content).length,
    durationMs,
  };
}

// ============================================
// 文件名生成
// ============================================

/**
 * 生成导出文件名
 */
export function generateFilename(
  input: DataExportInput,
  extension: string,
): string {
  const prefix = input.options?.filenamePrefix || "anykeep-export";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${prefix}-${timestamp}${extension}`;
}

// ============================================
// 文件大小格式化
// ============================================

/**
 * 格式化文件大小为人类可读格式
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// 摘要生成
// ============================================

/**
 * 生成导出摘要文本
 */
export function generateSummary(
  stats: ExportStats,
  format: ExportFormat,
): string {
  const formatName = EXPORT_FORMAT_CONFIG[format].name;
  return `成功导出 **${stats.totalExported}** 条书签为 **${formatName}** 格式，文件大小 ${formatFileSize(stats.fileSize)}，耗时 ${stats.durationMs}ms`;
}

// ============================================
// 建议生成
// ============================================

/**
 * 生成后续建议
 */
export function generateSuggestions(
  input: DataExportInput,
  stats: ExportStats,
): string[] {
  const suggestions: string[] = [];

  if (input.format !== "html") {
    suggestions.push("导出为 HTML 格式可直接导入浏览器");
  }
  if (input.format !== "obsidian" && stats.totalExported > 50) {
    suggestions.push("使用 Obsidian 格式可以建立知识网络");
  }
  if (!input.options?.includeAiContent) {
    suggestions.push("添加 AI 摘要可以让导出内容更丰富");
  }
  if (stats.totalExported > 100) {
    suggestions.push("考虑按文件夹分批导出以便管理");
  }

  return suggestions;
}
