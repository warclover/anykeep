/**
 * list_recent Tool
 *
 * 获取最近的书签（简化版，最常用）
 * 只有 1 个参数，LLM 容易正确调用
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";

// ============================================
// 参数定义（极简）
// ============================================

const paramsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe("返回数量，默认 10，最大 20"),
});

type ListRecentParams = z.infer<typeof paramsSchema>;

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

interface ListRecentResult {
  bookmarks: BookmarkItem[];
  total: number;
}

// ============================================
// Tool 实现
// ============================================

export const listRecentTool: Tool<ListRecentParams, ListRecentResult> = {
  definition: {
    name: "list_recent",
    description:
      "获取最近收藏的书签。用于回答「最近收藏了什么」「看看我的收藏」等问题。",
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: ListRecentParams,
    context: ToolContext,
  ): Promise<ToolResult<ListRecentResult>> {
    const supabase = await createClient();
    const limit = params.limit ?? 10;

    const { data, count, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, platform, user_tags, created_at", {
        count: "exact",
      })
      .eq("user_id", context.userId)
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
