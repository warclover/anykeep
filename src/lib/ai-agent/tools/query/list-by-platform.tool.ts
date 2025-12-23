/**
 * list_by_platform Tool
 *
 * 按平台获取书签（简化版）
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";

// ============================================
// 参数定义（简化）
// ============================================

const paramsSchema = z.object({
  platform: z
    .enum([
      "WECHAT",
      "BILIBILI",
      "XIAOHONGSHU",
      "ZHIHU",
      "WEIBO",
      "DOUYIN",
      "BROWSER_CHROME",
      "BROWSER_EDGE",
      "BROWSER_FIREFOX",
      "BROWSER_SAFARI",
      "OTHER",
    ])
    .describe("平台类型"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("返回数量，默认 20"),
});

type ListByPlatformParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface BookmarkItem {
  id: number;
  title: string;
  url: string;
  platform: string;
  tags: string[];
  createdAt: string;
}

interface ListByPlatformResult {
  platform: string;
  bookmarks: BookmarkItem[];
  total: number;
}

// ============================================
// Tool 实现
// ============================================

export const listByPlatformTool: Tool<
  ListByPlatformParams,
  ListByPlatformResult
> = {
  definition: {
    name: "list_by_platform",
    description:
      "获取某个平台的书签。用于回答「微信收藏有哪些」「B站收藏列表」等问题。",
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: ListByPlatformParams,
    context: ToolContext,
  ): Promise<ToolResult<ListByPlatformResult>> {
    const supabase = await createClient();
    const { platform, limit = 20 } = params;

    const { data, count, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, platform, user_tags, created_at", {
        count: "exact",
      })
      .eq("user_id", context.userId)
      .eq("platform", platform)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return {
        success: false,
        error: error.message,
        errorCode: "DB_ERROR",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookmarks: BookmarkItem[] = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title || "",
      url: item.url,
      platform: item.platform || "OTHER",
      tags: item.user_tags || [],
      createdAt: item.created_at,
    }));

    return {
      success: true,
      data: {
        platform,
        bookmarks,
        total: count ?? 0,
      },
      metadata: {
        executionTimeMs: 0,
        affectedCount: bookmarks.length,
      },
    };
  },
};
