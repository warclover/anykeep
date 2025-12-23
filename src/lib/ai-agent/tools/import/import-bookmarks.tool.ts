/**
 * ImportBookmarks Tool - 批量导入书签
 *
 * 批量导入多个 URL 作为书签
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

const bookmarkItemSchema = z.object({
  url: z.string().url().describe("书签 URL"),
  title: z.string().max(500).optional().describe("书签标题"),
  tags: z.array(z.string().max(50)).max(10).optional().describe("标签"),
});

const paramsSchema = z.object({
  bookmarks: z
    .array(bookmarkItemSchema)
    .min(1)
    .max(50)
    .describe("要导入的书签列表，最多 50 个"),
  folderId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("目标文件夹 ID，不指定则放入待整理"),
  skipDuplicates: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否跳过重复 URL，默认 true"),
});

type ImportBookmarksParams = z.infer<typeof paramsSchema>;

interface ImportResult {
  url: string;
  title: string;
  status: "created" | "skipped" | "failed";
  bookmarkId?: number;
  reason?: string;
}

interface ImportBookmarksResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  results: ImportResult[];
  message: string;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 检测 URL 平台
 */
function detectPlatform(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes("mp.weixin.qq.com") || hostname.includes("weixin"))
      return "wechat";
    if (hostname.includes("bilibili.com")) return "bilibili";
    if (hostname.includes("zhihu.com")) return "zhihu";
    if (
      hostname.includes("xiaohongshu.com") ||
      hostname.includes("xhslink.com")
    )
      return "xiaohongshu";
    if (hostname.includes("douyin.com")) return "douyin";
    if (hostname.includes("github.com")) return "github";
    if (hostname.includes("juejin.cn")) return "juejin";
    if (hostname.includes("csdn.net")) return "csdn";

    return "web";
  } catch {
    return "web";
  }
}

// ============================================
// Tool 实现
// ============================================

export const importBookmarksTool: Tool<
  ImportBookmarksParams,
  ImportBookmarksResult
> = {
  definition: {
    name: "import_bookmarks",
    description: `批量导入多个 URL 作为书签。

使用场景：
- 用户要求 "帮我批量导入这些链接"
- 用户要求 "把这些 URL 都加入收藏"
- 用户分享多个链接要求保存

功能特点：
- 单次最多导入 50 个 URL
- 自动检测平台类型
- 自动跳过重复 URL（可配置）
- 支持指定目标文件夹
- 支持为每个书签设置标题和标签

返回详细的导入结果，包括每个 URL 的处理状态。`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 2000,
  },

  async execute(
    params: ImportBookmarksParams,
    context,
  ): Promise<ToolResult<ImportBookmarksResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 如果指定了文件夹，验证文件夹存在
      if (params.folderId) {
        const { data: folder, error: folderError } = await supabase
          .from("folders")
          .select("id, name")
          .eq("id", params.folderId)
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .single();

        if (folderError || !folder) {
          return {
            success: false,
            error: "指定的文件夹不存在",
            errorCode: "FOLDER_NOT_FOUND",
          };
        }
      }

      // 2. 获取用户现有的 URL 列表用于去重
      const urls = params.bookmarks.map((b) => b.url);
      const { data: existingBookmarks } = await supabase
        .from("bookmarks")
        .select("url")
        .eq("user_id", context.userId)
        .in("url", urls)
        .is("deleted_at", null);

      const existingUrls = new Set(existingBookmarks?.map((b) => b.url) || []);

      // 3. 处理每个书签
      const results: ImportResult[] = [];
      const toInsert: Array<{
        user_id: string;
        url: string;
        title: string;
        folder_id: number | null;
        user_tags: string[];
        platform: string;
        status: string;
        is_read: boolean;
        is_starred: boolean;
        created_at: string;
        updated_at: string;
      }> = [];

      const now = new Date().toISOString();

      for (const item of params.bookmarks) {
        // 检查重复
        if (existingUrls.has(item.url)) {
          if (params.skipDuplicates) {
            results.push({
              url: item.url,
              title: item.title || item.url,
              status: "skipped",
              reason: "URL 已存在",
            });
            continue;
          }
        }

        const platform = detectPlatform(item.url);
        const title = item.title || item.url;

        toInsert.push({
          user_id: context.userId,
          url: item.url,
          title,
          folder_id: params.folderId || null,
          user_tags: item.tags || [],
          platform,
          status: item.title ? "COMPLETED" : "PENDING",
          is_read: false,
          is_starred: false,
          created_at: now,
          updated_at: now,
        });

        results.push({
          url: item.url,
          title,
          status: "created", // 暂时标记，后续更新
        });
      }

      // 4. 批量插入
      let createdCount = 0;
      if (toInsert.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from("bookmarks")
          .insert(toInsert)
          .select("id, url");

        if (insertError) {
          // 插入失败，更新结果状态
          for (const result of results) {
            if (result.status === "created") {
              result.status = "failed";
              result.reason = insertError.message;
            }
          }
        } else if (inserted) {
          // 更新结果中的书签 ID
          const urlToId = new Map(inserted.map((b) => [b.url, b.id]));
          for (const result of results) {
            if (result.status === "created") {
              const bookmarkId = urlToId.get(result.url);
              if (bookmarkId) {
                result.bookmarkId = bookmarkId;
                createdCount++;
              } else {
                result.status = "failed";
                result.reason = "插入后未返回 ID";
              }
            }
          }
        }
      }

      const skippedCount = results.filter((r) => r.status === "skipped").length;
      const failedCount = results.filter((r) => r.status === "failed").length;

      logger.info(
        {
          toolName: "import_bookmarks",
          userId: context.userId,
          total: params.bookmarks.length,
          created: createdCount,
          skipped: skippedCount,
          failed: failedCount,
          folderId: params.folderId,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "import_bookmarks: Success",
      );

      return {
        success: true,
        data: {
          total: params.bookmarks.length,
          created: createdCount,
          skipped: skippedCount,
          failed: failedCount,
          results,
          message: `导入完成：${createdCount} 个成功，${skippedCount} 个跳过，${failedCount} 个失败`,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: createdCount,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "import_bookmarks",
          userId: context.userId,
          count: params.bookmarks.length,
          error: errorMessage,
        },
        "import_bookmarks: Failed",
      );

      return {
        success: false,
        error: `批量导入失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
