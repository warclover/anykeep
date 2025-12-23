/**
 * 导出相关 Tools
 *
 * 提供数据导出功能的 AI 工具集
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import type { Tool } from "../types";
import { exportBookmarksTool } from "./export-bookmarks.tool";
import { previewExportTool } from "./preview-export.tool";
import { listExportFormatsTool } from "./list-export-formats.tool";

/**
 * 导出 Tools 集合
 *
 * 使用 any[] 类型转换以兼容批量注册
 * 实际类型在运行时是正确的
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const exportTools: Tool<any, any>[] = [
  exportBookmarksTool,
  previewExportTool,
  listExportFormatsTool,
];

export { exportBookmarksTool, previewExportTool, listExportFormatsTool };
