/**
 * list_export_formats Tool
 *
 * 列出所有可用的导出格式及其说明
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { EXPORT_FORMAT_CONFIG } from "@/lib/export/constants";
import { EXPORT_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({});

interface FormatInfo {
  format: string;
  label: string;
  description: string;
  extension: string;
  bestFor: string;
}

interface ListExportFormatsResult {
  formats: FormatInfo[];
  recommendation: {
    forExcel: string;
    forObsidian: string;
    forNotion: string;
    forBackup: string;
    forBrowserImport: string;
  };
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const listExportFormatsTool: Tool<
  z.infer<typeof paramsSchema>,
  ListExportFormatsResult
> = {
  definition: {
    name: "list_export_formats",
    description: EXPORT_TOOL_DESCRIPTIONS.list_export_formats,
    parameters: paramsSchema,
    category: "query",
  },

  async execute(): Promise<ToolResult<ListExportFormatsResult>> {
    const startTime = performance.now();

    const formats: FormatInfo[] = [
      {
        format: "csv",
        label: EXPORT_FORMAT_CONFIG.csv.label,
        description: EXPORT_FORMAT_CONFIG.csv.description,
        extension: "csv",
        bestFor: "Excel 分析、数据统计、批量处理",
      },
      {
        format: "markdown",
        label: EXPORT_FORMAT_CONFIG.markdown.label,
        description: EXPORT_FORMAT_CONFIG.markdown.description,
        extension: "md",
        bestFor: "Notion、Typora、简单笔记",
      },
      {
        format: "obsidian",
        label: EXPORT_FORMAT_CONFIG.obsidian.label,
        description: EXPORT_FORMAT_CONFIG.obsidian.description,
        extension: "md",
        bestFor: "Obsidian 单文件导入、带元数据",
      },
      {
        format: "obsidian-zip",
        label: EXPORT_FORMAT_CONFIG["obsidian-zip"].label,
        description: EXPORT_FORMAT_CONFIG["obsidian-zip"].description,
        extension: "zip",
        bestFor: "Obsidian 批量导入、双链引用",
      },
      {
        format: "json",
        label: EXPORT_FORMAT_CONFIG.json.label,
        description: EXPORT_FORMAT_CONFIG.json.description,
        extension: "json",
        bestFor: "数据备份、程序处理、API 集成",
      },
      {
        format: "html",
        label: EXPORT_FORMAT_CONFIG.html.label,
        description: EXPORT_FORMAT_CONFIG.html.description,
        extension: "html",
        bestFor: "Chrome/Edge/Firefox/Safari 书签导入",
      },
    ];

    return {
      success: true,
      data: {
        formats,
        recommendation: {
          forExcel: "csv",
          forObsidian: "obsidian-zip",
          forNotion: "markdown",
          forBackup: "json",
          forBrowserImport: "html",
        },
        message: `支持 ${formats.length} 种导出格式。Excel 用户推荐 CSV，Obsidian 用户推荐 obsidian-zip，备份推荐 JSON。`,
      },
      metadata: {
        executionTimeMs: Math.round(performance.now() - startTime),
      },
    };
  },
};
