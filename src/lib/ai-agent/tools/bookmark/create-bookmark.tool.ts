/**
 * CreateBookmark Tool - 创建书签
 *
 * 创建新的书签收藏
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { BOOKMARK_TOOL_DESCRIPTIONS } from "../tool-description-templates";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  url: z.string().url().describe("书签 URL"),
  title: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe("书签标题，不传则使用 URL 作为占位符等待后续抓取"),
  description: z.string().max(2000).optional().describe("书签描述"),
  folderId: z.number().int().positive().optional().describe("目标文件夹 ID"),
  tags: z
    .array(z.string().max(50))
    .max(20)
    .optional()
    .describe("用户标签列表，最多 20 个标签"),
  isStarred: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否添加星标，默认 false"),
});

type CreateBookmarkParams = z.infer<typeof paramsSchema>;

interface CreateBookmarkResult {
  bookmarkId: number;
  title: string;
  url: string;
  folderId: number | null;
  folderName: string | null;
  platform: string;
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
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
      return "youtube";
    if (hostname.includes("twitter.com") || hostname.includes("x.com"))
      return "twitter";
    if (hostname.includes("medium.com")) return "medium";
    if (hostname.includes("notion.so")) return "notion";

    return "web";
  } catch {
    return "web";
  }
}

/**
 * 获取平台中文名称
 */
function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    wechat: "微信公众号",
    bilibili: "B站",
    zhihu: "知乎",
    xiaohongshu: "小红书",
    douyin: "抖音",
    github: "GitHub",
    juejin: "掘金",
    csdn: "CSDN",
    youtube: "YouTube",
    twitter: "Twitter/X",
    medium: "Medium",
    notion: "Notion",
    web: "网页",
  };
  return labels[platform] || "网页";
}

// ============================================
// Tool 实现
// ============================================

export const createBookmarkTool: Tool<
  CreateBookmarkParams,
  CreateBookmarkResult
> = {
  definition: {
    name: "create_bookmark",
    description: BOOKMARK_TOOL_DESCRIPTIONS.create_bookmark,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: CreateBookmarkParams,
    context,
  ): Promise<ToolResult<CreateBookmarkResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 检查 URL 是否已存在
      const { data: existing } = await supabase
        .from("bookmarks")
        .select("id, title")
        .eq("url", params.url)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (existing) {
        return {
          success: false,
          error: `该 URL 已存在于收藏中：「${existing.title}」(ID: ${existing.id})`,
          errorCode: "DUPLICATE_URL",
        };
      }

      // 2. 如果指定了文件夹，验证文件夹存在
      let folderName: string | null = null;
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
        folderName = folder.name;
      }

      // 3. 检测平台
      const platform = detectPlatform(params.url);
      const platformLabel = getPlatformLabel(platform);

      // 4. 创建书签
      const now = new Date().toISOString();
      const title = params.title || params.url; // 如果没有标题，使用 URL 作为临时标题

      const { data: bookmark, error: insertError } = await supabase
        .from("bookmarks")
        .insert({
          user_id: context.userId,
          url: params.url,
          title,
          description: params.description || null,
          folder_id: params.folderId || null,
          user_tags: params.tags || [],
          is_starred: params.isStarred || false,
          is_read: false,
          status: params.title ? "COMPLETED" : "PENDING", // 如果没有标题，标记为待处理
          platform,
          created_at: now,
          updated_at: now,
        })
        .select("id, title, url, folder_id")
        .single();

      if (insertError || !bookmark) {
        throw insertError || new Error("创建书签失败");
      }

      const message = params.folderId
        ? `已创建${platformLabel}书签「${bookmark.title}」并保存到「${folderName}」`
        : `已创建${platformLabel}书签「${bookmark.title}」`;

      logger.info(
        {
          toolName: "create_bookmark",
          userId: context.userId,
          bookmarkId: bookmark.id,
          platform,
          folderId: params.folderId,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "create_bookmark: Success",
      );

      return {
        success: true,
        data: {
          bookmarkId: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          folderId: bookmark.folder_id,
          folderName,
          platform,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: 1,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "create_bookmark",
          userId: context.userId,
          url: params.url,
          error: errorMessage,
        },
        "create_bookmark: Failed",
      );

      return {
        success: false,
        error: `创建书签失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
