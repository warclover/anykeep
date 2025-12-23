/**
 * CreateSmartList Tool - 创建智能列表
 *
 * 根据筛选条件创建新的智能列表
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { SmartListFilters, SmartListColor } from "@/types/smart-list";
import type { Json } from "@/types/supabase";

// ============================================
// 参数和结果类型定义
// ============================================

const filtersSchema = z.object({
  platform: z.union([z.string(), z.array(z.string())]).optional(),
  folderId: z.union([z.number(), z.literal("uncategorized")]).optional(),
  usageTags: z.array(z.string()).optional(),
  aiTags: z.array(z.string()).optional(),
  userTags: z.array(z.string()).optional(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  isHighValue: z.boolean().optional(),
  keyword: z.string().optional(),
});

const paramsSchema = z.object({
  name: z.string().min(1).max(100).describe("智能列表名称"),
  description: z.string().max(500).optional().describe("描述"),
  icon: z.string().max(10).optional().default("📋").describe("图标（emoji）"),
  color: z
    .enum([
      "default",
      "blue",
      "green",
      "orange",
      "purple",
      "red",
      "cyan",
      "pink",
      "amber",
      "emerald",
    ])
    .optional()
    .default("default")
    .describe("颜色主题"),
  filters: filtersSchema.describe("筛选条件"),
  sortBy: z
    .enum([
      "created_desc",
      "created_asc",
      "title_asc",
      "title_desc",
      "rating_desc",
      "publish_time_desc",
    ])
    .optional()
    .default("created_desc")
    .describe("排序方式"),
  viewMode: z
    .enum(["inherit", "card", "list", "compact"])
    .optional()
    .default("inherit")
    .describe("视图模式"),
});

type CreateSmartListParams = z.infer<typeof paramsSchema>;

interface CreateSmartListResult {
  smartListId: number;
  name: string;
  filters: SmartListFilters;
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const createSmartListTool: Tool<
  CreateSmartListParams,
  CreateSmartListResult
> = {
  definition: {
    name: "create_smart_list",
    description: `创建新的智能列表。

使用场景：
- 用户要求 "创建一个显示所有星标内容的智能列表"
- 用户要求 "帮我建一个筛选微信公众号的列表"
- 用户要求 "创建一个未读文章的智能列表"

筛选条件说明：
- platform: 平台筛选（WECHAT_OFFICIAL_ACCOUNT, BILIBILI 等）
- folderId: 文件夹筛选（数字或 "uncategorized"）
- usageTags: 用途标签筛选
- aiTags: AI 标签筛选
- userTags: 用户标签筛选
- isRead: 阅读状态（true/false）
- isStarred: 星标状态（true/false）
- isHighValue: 高价值筛选（rating === 5）
- keyword: 关键词搜索`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 300,
  },

  async execute(
    params: CreateSmartListParams,
    context,
  ): Promise<ToolResult<CreateSmartListResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 检查名称是否重复
      const { data: nameExists } = await supabase
        .from("smart_lists")
        .select("id")
        .eq("user_id", context.userId)
        .eq("name", params.name)
        .is("deleted_at", null)
        .single();

      if (nameExists) {
        return {
          success: false,
          error: "智能列表名称已存在",
          errorCode: "NAME_EXISTS",
        };
      }

      // 2. 获取当前最大排序值
      const { data: maxOrderData } = await supabase
        .from("smart_lists")
        .select("sort_order")
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      const nextSortOrder = (maxOrderData?.sort_order ?? 0) + 1;

      // 3. 创建智能列表
      const { data: newSmartList, error: createError } = await supabase
        .from("smart_lists")
        .insert({
          user_id: context.userId,
          name: params.name,
          description: params.description || null,
          icon: params.icon || "📋",
          color: (params.color || "default") as SmartListColor,
          filters: params.filters as unknown as Json,
          sort_by: params.sortBy || "created_desc",
          view_mode: params.viewMode || "inherit",
          sort_order: nextSortOrder,
          is_pinned: false,
          is_preset: false,
          bookmark_count: 0,
        })
        .select("id, name, filters")
        .single();

      if (createError) {
        throw createError;
      }

      logger.info(
        {
          toolName: "create_smart_list",
          userId: context.userId,
          smartListId: newSmartList.id,
          name: params.name,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "create_smart_list: Success",
      );

      return {
        success: true,
        data: {
          smartListId: newSmartList.id,
          name: newSmartList.name,
          filters: newSmartList.filters as SmartListFilters,
          message: `已创建智能列表「${params.name}」`,
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
          toolName: "create_smart_list",
          userId: context.userId,
          name: params.name,
          error: errorMessage,
        },
        "create_smart_list: Failed",
      );

      return {
        success: false,
        error: `创建智能列表失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
