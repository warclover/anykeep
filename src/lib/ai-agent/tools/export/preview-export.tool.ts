/**
 * preview_export Tool
 *
 * 预览导出内容，返回格式化后的示例
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import {
  CsvFormatter,
  MarkdownFormatter,
  ObsidianFormatter,
} from "@/lib/export/formatters";
import type { ExportFormat, BookmarkWithFolder } from "@/lib/export/types";
import { logger } from "@/lib/logger";
import { EXPORT_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  format: z
    .enum(["csv", "markdown", "obsidian", "json", "html"])
    .describe("预览格式"),
  bookmarkIds: z.array(z.number()).optional().describe("指定预览的书签 ID"),
  previewCount: z
    .number()
    .min(1)
    .max(5)
    .default(3)
    .describe("预览数量，默认 3 条"),
});

type PreviewExportParams = z.infer<typeof paramsSchema>;

interface PreviewExportResult {
  format: ExportFormat;
  previewContent: string;
  bookmarkCount: number;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const previewExportTool: Tool<PreviewExportParams, PreviewExportResult> =
  {
    definition: {
      name: "preview_export",
      description: EXPORT_TOOL_DESCRIPTIONS.preview_export,
      parameters: paramsSchema,
      category: "query",
    },

    async execute(
      params: PreviewExportParams,
      context: ToolContext,
    ): Promise<ToolResult<PreviewExportResult>> {
      const startTime = performance.now();

      try {
        const supabase = await createClient();

        // 获取预览数据
        let query = supabase
          .from("bookmarks")
          .select("*, folders!bookmarks_folder_id_fkey(name)")
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .not("platform", "in", '("CHROME","EDGE","FIREFOX","SAFARI")')
          .order("created_at", { ascending: false })
          .limit(params.previewCount);

        if (params.bookmarkIds?.length) {
          query = supabase
            .from("bookmarks")
            .select("*, folders!bookmarks_folder_id_fkey(name)")
            .eq("user_id", context.userId)
            .is("deleted_at", null)
            .in("id", params.bookmarkIds)
            .limit(params.previewCount);
        }

        const { data: bookmarks, error } = await query;

        if (error) throw error;
        if (!bookmarks?.length) {
          return {
            success: false,
            error: "没有可预览的书签",
            errorCode: "NO_DATA",
          };
        }

        // 生成预览内容
        let previewContent: string;
        const typedBookmarks = bookmarks as BookmarkWithFolder[];

        switch (params.format) {
          case "csv": {
            const csvFormatter = new CsvFormatter();
            previewContent = csvFormatter.generatePreview(
              typedBookmarks,
              params.previewCount,
            );
            break;
          }
          case "markdown": {
            const mdFormatter = new MarkdownFormatter();
            previewContent = mdFormatter.generatePreview(
              typedBookmarks,
              params.previewCount,
            );
            break;
          }
          case "obsidian": {
            const obsFormatter = new ObsidianFormatter();
            previewContent = obsFormatter.generatePreview(
              typedBookmarks,
              params.previewCount,
            );
            break;
          }
          case "json": {
            previewContent = JSON.stringify(
              typedBookmarks.slice(0, params.previewCount).map((b) => ({
                title: b.title,
                url: b.url,
                platform: b.platform,
                folder: b.folders?.name,
                aiTags: b.ai_tags,
                createdAt: b.created_at,
              })),
              null,
              2,
            );
            break;
          }
          case "html": {
            previewContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>AnyKeep Bookmarks</TITLE>
<H1>AnyKeep Bookmarks</H1>
<DL><p>
${typedBookmarks
  .slice(0, params.previewCount)
  .map((b) => `    <DT><A HREF="${b.url}">${b.title || "无标题"}</A>`)
  .join("\n")}
</DL><p>`;
            break;
          }
          default:
            previewContent = "不支持的格式";
        }

        logger.info(
          {
            toolName: "preview_export",
            userId: context.userId,
            format: params.format,
            previewCount: params.previewCount,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "preview_export: Success",
        );

        return {
          success: true,
          data: {
            format: params.format,
            previewContent,
            bookmarkCount: bookmarks.length,
            message: `以下是 ${params.format.toUpperCase()} 格式的预览（${bookmarks.length} 条）`,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        logger.error(
          {
            toolName: "preview_export",
            userId: context.userId,
            format: params.format,
            error: errorMessage,
          },
          "preview_export: Failed",
        );

        return {
          success: false,
          error: `预览失败: ${errorMessage}`,
          errorCode: "EXECUTION_ERROR",
        };
      }
    },
  };
