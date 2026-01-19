/**
 * export_bookmarks Tool
 *
 * 导出用户的书签收藏到指定格式
 * 这是一个需要用户确认的操作
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type {
  Tool,
  ToolContext,
  ToolResult,
  PendingConfirmation,
} from "../types";
import {
  generateConfirmationId,
  getBookmarkTitles,
  getConfirmationExpiryTime,
} from "../utils";
import { exportService } from "@/lib/export/services/export.service";
import { EXPORT_FORMAT_CONFIG } from "@/lib/export/constants";
import type { ExportFormat, BookmarkWithFolder } from "@/lib/export/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { EXPORT_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数和结果类型定义
// ============================================

const filterSchema = z.object({
  scope: z
    .enum(["all", "all_with_browser", "selected"])
    .optional()
    .describe(
      "导出范围：all-全部收藏（不含浏览器书签），all_with_browser-全部（含浏览器书签），selected-指定书签",
    ),
  folderIds: z.array(z.number()).optional().describe("指定文件夹 ID"),
  platforms: z
    .array(z.string())
    .optional()
    .describe("指定平台：WECHAT, BILIBILI, XIAOHONGSHU 等"),
  dateRange: z
    .object({
      start: z.string().describe("开始日期 ISO 格式"),
      end: z.string().describe("结束日期 ISO 格式"),
    })
    .optional()
    .describe("时间范围"),
  tags: z.array(z.string()).optional().describe("包含这些标签的书签"),
  isStarred: z.boolean().optional().describe("仅导出收藏的书签"),
});

const csvOptionsSchema = z.object({
  fields: z
    .array(z.string())
    .optional()
    .describe(
      "导出字段：title, url, folder, created_at, platform, ai_tags, user_tags, ai_summary, description, author, notes",
    ),
  includeHeader: z.boolean().optional().default(true),
});

const markdownOptionsSchema = z.object({
  includeFrontmatter: z.boolean().optional().default(false),
  includeAiSummary: z.boolean().optional().default(true),
  groupByFolder: z.boolean().optional().default(true),
});

const paramsSchema = z.object({
  format: z
    .enum(["csv", "markdown", "obsidian", "obsidian-zip", "json", "html"])
    .describe("导出格式"),
  filter: filterSchema.optional().describe("筛选条件（与 bookmarkIds 二选一）"),
  bookmarkIds: z
    .array(z.number())
    .optional()
    .describe("指定导出的书签 ID 列表（与 filter 二选一）"),
  options: z
    .object({
      csv: csvOptionsSchema.optional(),
      markdown: markdownOptionsSchema.optional(),
    })
    .optional()
    .describe("格式特定选项"),
});

type ExportBookmarksParams = z.infer<typeof paramsSchema>;

interface ExportBookmarksResult {
  filename: string;
  format: ExportFormat;
  count: number;
  size: number;
  sizeFormatted: string;
  downloadUrl?: string;
  /** 导出内容（文本或 Base64 编码） */
  content?: string;
  /** MIME 类型 */
  mimeType?: string;
  /** 是否为 Base64 编码 */
  isBase64?: boolean;
  message: string;
  __pendingConfirmation?: PendingConfirmation;
}

// ============================================
// 辅助函数
// ============================================

// 导出筛选条件类型
type ExportFilter = z.infer<typeof filterSchema>;

// 使用 any 类型简化查询构建（Supabase 链式调用类型复杂）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilder = any;

/**
 * 应用导出筛选条件
 */
function applyExportFilter(
  query: QueryBuilder,
  filter: ExportFilter,
): QueryBuilder {
  // 范围筛选
  if (filter.scope === "all") {
    query = query.not("platform", "in", '("CHROME","EDGE","FIREFOX","SAFARI")');
  }
  // all_with_browser 不需要额外筛选

  // 文件夹筛选
  if (filter.folderIds?.length) {
    query = query.in("folder_id", filter.folderIds);
  }

  // 平台筛选
  if (filter.platforms?.length) {
    query = query.in("platform", filter.platforms);
  }

  // 时间范围
  if (filter.dateRange) {
    query = query
      .gte("created_at", filter.dateRange.start)
      .lte("created_at", filter.dateRange.end);
  }

  // 标签筛选
  if (filter.tags?.length) {
    query = query.overlaps("ai_tags", filter.tags);
  }

  // 收藏筛选
  if (filter.isStarred !== undefined) {
    query = query.eq("is_starred", filter.isStarred);
  }

  return query;
}

/**
 * 估算导出文件大小
 */
function estimateExportSize(
  bookmarks: BookmarkWithFolder[],
  format: ExportFormat,
): number {
  const avgBookmarkSize: Record<ExportFormat, number> = {
    csv: 200, // 每条约 200 字节
    markdown: 500, // 每条约 500 字节
    obsidian: 600, // 带 frontmatter
    "obsidian-zip": 700,
    json: 400,
    html: 150,
  };

  return bookmarks.length * (avgBookmarkSize[format] || 300);
}

/**
 * 格式化字节数
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ============================================
// Tool 实现
// ============================================

export const exportBookmarksTool: Tool<
  ExportBookmarksParams,
  ExportBookmarksResult
> = {
  definition: {
    name: "export_bookmarks",
    description: EXPORT_TOOL_DESCRIPTIONS.export_bookmarks,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true,
    estimatedDurationMs: 3000,
  },

  async execute(
    params: ExportBookmarksParams,
    context: ToolContext,
  ): Promise<ToolResult<ExportBookmarksResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 构建查询获取书签
      let query = supabase
        .from("bookmarks")
        .select("*, folders!bookmarks_folder_id_fkey(name)")
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      // 2. 应用筛选条件
      if (params.bookmarkIds?.length) {
        // 指定 ID 模式
        query = query.in("id", params.bookmarkIds);
      } else if (params.filter) {
        query = applyExportFilter(query, params.filter);
      } else {
        // 默认排除浏览器书签
        query = query.not(
          "platform",
          "in",
          '("CHROME","EDGE","FIREFOX","SAFARI")',
        );
      }

      // 3. 执行查询
      const { data: bookmarks, error } = await query;

      if (error) throw error;
      if (!bookmarks?.length) {
        return {
          success: false,
          error: "没有符合条件的书签可导出",
          errorCode: "NO_DATA",
        };
      }

      // 4. 估算文件大小
      const estimatedSize = estimateExportSize(
        bookmarks as BookmarkWithFolder[],
        params.format,
      );

      // 5. 如果需要确认且未确认，返回确认请求
      if (!context.confirmed) {
        const formatLabel =
          EXPORT_FORMAT_CONFIG[params.format]?.label || params.format;

        const affectedItems = await getBookmarkTitles(
          context.userId,
          bookmarks.slice(0, 5).map((b) => b.id),
        );

        const confirmation: PendingConfirmation = {
          confirmationId: generateConfirmationId(),
          toolName: "export_bookmarks",
          description: `导出 ${bookmarks.length} 条书签到 ${formatLabel}`,
          impactSummary: `将导出 ${bookmarks.length} 条书签，预估文件大小 ${formatBytes(estimatedSize)}`,
          affectedItems,
          params,
          expiresAt: getConfirmationExpiryTime(),
          riskLevel: "low", // 导出是只读操作，风险低
        };

        logger.info(
          {
            toolName: "export_bookmarks",
            userId: context.userId,
            format: params.format,
            bookmarkCount: bookmarks.length,
            confirmationId: confirmation.confirmationId,
          },
          "export_bookmarks: Confirmation required",
        );

        return {
          success: true,
          data: {
            filename: "",
            format: params.format,
            count: bookmarks.length,
            size: estimatedSize,
            sizeFormatted: formatBytes(estimatedSize),
            message: `待用户确认：导出 ${bookmarks.length} 条书签到 ${formatLabel}。界面上已显示确认对话框。`,
            __pendingConfirmation: confirmation,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 6. 已确认，执行导出
      const result = await exportService.export(
        bookmarks as BookmarkWithFolder[],
        {
          format: params.format,
          options: params.options,
        },
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "导出失败",
          errorCode: result.errorCode,
        };
      }

      // 7. 处理导出内容
      let content: string;
      let isBase64 = false;

      if (result.content instanceof Blob) {
        // Blob 转 Base64
        const arrayBuffer = await result.content.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        content = btoa(binary);
        isBase64 = true;
      } else {
        content = result.content;
      }

      const mimeType =
        EXPORT_FORMAT_CONFIG[params.format]?.mimeType ||
        "application/octet-stream";

      logger.info(
        {
          toolName: "export_bookmarks",
          userId: context.userId,
          format: params.format,
          bookmarkCount: result.count,
          fileSize: result.size,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "export_bookmarks: Success",
      );

      return {
        success: true,
        data: {
          filename: result.filename,
          format: params.format,
          count: result.count,
          size: result.size || 0,
          sizeFormatted: formatBytes(result.size || 0),
          content,
          mimeType,
          isBase64,
          message: `已成功导出 ${result.count} 条书签到 ${EXPORT_FORMAT_CONFIG[params.format]?.label || params.format} 格式，文件大小 ${formatBytes(result.size || 0)}`,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: result.count,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "export_bookmarks",
          userId: context.userId,
          format: params.format,
          error: errorMessage,
        },
        "export_bookmarks: Failed",
      );

      return {
        success: false,
        error: `导出失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
