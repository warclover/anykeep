/**
 * ImportBrowserBookmarks Tool - 获取浏览器书签导入状态
 *
 * 查询浏览器书签导入历史和状态
 *
 * 注意：完整的浏览器书签导入功能需要客户端文件解析，
 * 此 Tool 提供导入历史查询和状态检查功能。
 * 实际的文件导入应通过前端 UI 完成。
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  action: z
    .enum(["status", "history"])
    .optional()
    .default("status")
    .describe("操作类型：status(查看当前状态) 或 history(查看导入历史)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe("history 模式下返回的记录数量"),
});

type ImportBrowserBookmarksParams = z.infer<typeof paramsSchema>;

interface ImportHistoryItem {
  id: number;
  source: string;
  totalCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  foldersCreated: number;
  importedAt: string;
}

interface BrowserBookmarkStats {
  total: number;
  byPlatform: Record<string, number>;
}

interface ImportBrowserBookmarksResult {
  stats?: BrowserBookmarkStats;
  history?: ImportHistoryItem[];
  hasImported: boolean;
  lastImportAt: string | null;
  message: string;
  hint?: string;
}

// ============================================
// 平台常量
// ============================================

const BROWSER_PLATFORMS = [
  "CHROME",
  "EDGE",
  "FIREFOX",
  "SAFARI",
  "BROWSER_OTHER",
];

// ============================================
// Tool 实现
// ============================================

export const importBrowserBookmarksTool: Tool<
  ImportBrowserBookmarksParams,
  ImportBrowserBookmarksResult
> = {
  definition: {
    name: "import_browser_bookmarks",
    description: `查询浏览器书签导入状态和历史。

使用场景：
- 用户要求 "查看我的浏览器书签导入情况"
- 用户要求 "我导入过浏览器书签吗"
- 用户要求 "显示导入历史记录"

功能说明：
- status: 查看当前浏览器书签统计
- history: 查看导入历史记录

注意：如需导入新的浏览器书签文件，请引导用户使用侧边栏的「导入浏览器书签」功能。`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: ImportBrowserBookmarksParams,
    context,
  ): Promise<ToolResult<ImportBrowserBookmarksResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      if (params.action === "history") {
        // 查询导入历史
        const { data: history, error: historyError } = await supabase
          .from("import_history")
          .select("*")
          .eq("user_id", context.userId)
          .order("created_at", { ascending: false })
          .limit(params.limit);

        if (historyError) {
          throw historyError;
        }

        const historyItems: ImportHistoryItem[] = (history || []).map(
          (item) => ({
            id: item.id,
            source: item.import_source,
            totalCount: item.total_count,
            successCount: item.success_count,
            skippedCount: item.skipped_count,
            failedCount: item.failed_count,
            foldersCreated: item.folders_created,
            importedAt: item.created_at,
          }),
        );

        const hasImported = historyItems.length > 0;
        const lastImportAt = hasImported ? historyItems[0].importedAt : null;

        logger.info(
          {
            toolName: "import_browser_bookmarks",
            userId: context.userId,
            action: "history",
            recordCount: historyItems.length,
            executionTimeMs: Math.round(performance.now() - startTime),
          },
          "import_browser_bookmarks: History query success",
        );

        return {
          success: true,
          data: {
            history: historyItems,
            hasImported,
            lastImportAt,
            message: hasImported
              ? `共有 ${historyItems.length} 条导入记录`
              : "尚未导入过浏览器书签",
            hint: hasImported
              ? undefined
              : "如需导入浏览器书签，请点击侧边栏的「导入」按钮",
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 默认：status 查询
      // 统计浏览器书签数量
      const { data: browserBookmarks, error: countError } = await supabase
        .from("bookmarks")
        .select("platform")
        .eq("user_id", context.userId)
        .in("platform", BROWSER_PLATFORMS)
        .is("deleted_at", null);

      if (countError) {
        throw countError;
      }

      const total = browserBookmarks?.length || 0;
      const byPlatform: Record<string, number> = {};

      for (const bookmark of browserBookmarks || []) {
        const platform = bookmark.platform || "BROWSER_OTHER";
        byPlatform[platform] = (byPlatform[platform] || 0) + 1;
      }

      // 获取最近一次导入时间
      const { data: lastImport } = await supabase
        .from("import_history")
        .select("created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const hasImported = total > 0;
      const lastImportAt = lastImport?.created_at || null;

      logger.info(
        {
          toolName: "import_browser_bookmarks",
          userId: context.userId,
          action: "status",
          total,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "import_browser_bookmarks: Status query success",
      );

      return {
        success: true,
        data: {
          stats: {
            total,
            byPlatform,
          },
          hasImported,
          lastImportAt,
          message: hasImported
            ? `已导入 ${total} 个浏览器书签`
            : "尚未导入浏览器书签",
          hint: hasImported
            ? undefined
            : "如需导入浏览器书签，请点击侧边栏的「导入」按钮，支持 Chrome、Edge、Firefox、Safari 格式",
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
          toolName: "import_browser_bookmarks",
          userId: context.userId,
          action: params.action,
          error: errorMessage,
        },
        "import_browser_bookmarks: Failed",
      );

      return {
        success: false,
        error: `查询浏览器书签状态失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
