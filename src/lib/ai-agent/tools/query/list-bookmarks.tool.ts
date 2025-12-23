/**
 * list_bookmarks Tool
 *
 * 获取用户的书签列表
 * 支持多种筛选和排序条件
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  folder_id: z.number().int().positive().optional().describe("指定文件夹 ID"),
  platform: z
    .string()
    .optional()
    .describe("指定平台，如 WECHAT、BROWSER_CHROME"),
  tags: z
    .array(z.string())
    .optional()
    .describe("按标签筛选，书签需包含所有指定标签"),
  date_from: z.string().optional().describe("起始日期（ISO 格式）"),
  date_to: z.string().optional().describe("结束日期（ISO 格式）"),
  sort_by: z
    .enum(["created_at", "updated_at", "title", "rating"])
    .optional()
    .default("created_at")
    .describe("排序字段"),
  sort_order: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc")
    .describe("排序方向"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("返回数量，最大50"),
  offset: z.number().int().min(0).optional().default(0).describe("分页偏移量"),
});

type ListParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface BookmarkItem {
  id: number;
  title: string;
  url: string;
  description?: string;
  tags: string[];
  folderName?: string;
  platform: string;
  rating?: number;
  createdAt: string;
}

interface ListResult {
  /** 书签列表 */
  bookmarks: BookmarkItem[];
  /** 总数（满足筛选条件的） */
  total: number;
  /** 是否有更多 */
  hasMore: boolean;
  /** 分页信息 */
  pagination: {
    limit: number;
    offset: number;
  };
}

// ============================================
// Tool 实现
// ============================================

export const listBookmarksTool: Tool<ListParams, ListResult> = {
  definition: {
    name: "list_bookmarks",
    description:
      "获取用户的书签列表。支持按文件夹、平台、标签、时间筛选，支持排序和分页。用于回答「最近收藏了什么」「某个文件夹的内容」「带某个标签的书签」等问题。",
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 800,
  },

  async execute(
    params: ListParams,
    context: ToolContext,
  ): Promise<ToolResult<ListResult>> {
    const supabase = await createClient();
    const {
      folder_id,
      platform,
      tags,
      date_from,
      date_to,
      sort_by = "created_at",
      sort_order = "desc",
      limit = 10,
      offset = 0,
    } = params;

    // 基础查询
    let query = supabase
      .from("bookmarks")
      .select(
        "id, title, url, description, user_tags, platform, rating, created_at, folders(name)",
        { count: "exact" },
      )
      .eq("user_id", context.userId)
      .is("deleted_at", null);

    // 应用筛选条件
    if (folder_id) {
      query = query.eq("folder_id", folder_id);
    }
    if (platform) {
      query = query.eq("platform", platform);
    }
    if (tags && tags.length > 0) {
      query = query.contains("user_tags", tags);
    }
    if (date_from) {
      query = query.gte("created_at", date_from);
    }
    if (date_to) {
      query = query.lte("created_at", date_to);
    }

    // 排序
    query = query.order(sort_by, { ascending: sort_order === "asc" });

    // 分页
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return {
        success: false,
        error: error.message,
        errorCode: "DB_ERROR",
      };
    }

    const total = count ?? 0;

    // 转换结果
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookmarks: BookmarkItem[] = (data || []).map((item: any) => ({
      id: item.id,
      title: item.title || "",
      url: item.url,
      description: item.description ?? undefined,
      tags: item.user_tags || [],
      folderName: item.folders?.name ?? undefined,
      platform: item.platform || "OTHER",
      rating: item.rating ?? undefined,
      createdAt: item.created_at,
    }));

    return {
      success: true,
      data: {
        bookmarks,
        total,
        hasMore: offset + bookmarks.length < total,
        pagination: {
          limit,
          offset,
        },
      },
      metadata: {
        executionTimeMs: 0,
        affectedCount: bookmarks.length,
      },
    };
  },
};
