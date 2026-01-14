/**
 * list_tags Tool
 *
 * 列出用户的所有标签及其使用次数
 *
 * P0-3a: 新增核心查询工具
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(50)
    .describe("返回的最大标签数量，默认 50，最大 100"),
  orderBy: z
    .enum(["name", "count"])
    .optional()
    .default("count")
    .describe("排序方式：按名称(name)或使用次数(count)，默认按使用次数"),
  includeAiTags: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含 AI 生成的标签，默认 true"),
  includeUserTags: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含用户自定义标签，默认 true"),
});

type ListTagsParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface TagInfo {
  /** 标签名称 */
  name: string;
  /** 使用次数 */
  count: number;
  /** 标签来源：ai | user | both */
  source: "ai" | "user" | "both";
}

interface ListTagsResult {
  /** 标签列表 */
  tags: TagInfo[];
  /** 标签总数（去重后） */
  total: number;
  /** AI 标签数量 */
  aiTagCount: number;
  /** 用户标签数量 */
  userTagCount: number;
}

// ============================================
// Tool 实现
// ============================================

export const listTagsTool: Tool<ListTagsParams, ListTagsResult> = {
  definition: {
    name: "list_tags",
    description: `列出用户的所有标签及其使用次数。

使用场景：
- 用户询问自己有哪些标签："我有哪些标签"、"列出我的标签"
- 用户想了解标签使用情况："哪些标签用得最多"
- 为标签管理提供数据支持

返回信息：
- 标签名称和使用次数
- 按使用次数或名称排序
- 区分 AI 标签和用户自定义标签`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: ListTagsParams,
    context: ToolContext,
  ): Promise<ToolResult<ListTagsResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 查询用户所有书签的标签
      const { data, error } = await supabase
        .from("bookmarks")
        .select("ai_tags, user_tags")
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      if (error) {
        logger.error(
          {
            toolName: "list_tags",
            userId: context.userId,
            error: error.message,
          },
          "list_tags: DB Error",
        );

        return {
          success: false,
          error: error.message,
          errorCode: "DB_ERROR",
        };
      }

      // 统计标签频次，区分来源
      const aiTagCounts = new Map<string, number>();
      const userTagCounts = new Map<string, number>();

      for (const row of data || []) {
        // 统计 AI 标签
        if (params.includeAiTags && row.ai_tags) {
          for (const tag of row.ai_tags as string[]) {
            aiTagCounts.set(tag, (aiTagCounts.get(tag) || 0) + 1);
          }
        }

        // 统计用户标签
        if (params.includeUserTags && row.user_tags) {
          for (const tag of row.user_tags as string[]) {
            userTagCounts.set(tag, (userTagCounts.get(tag) || 0) + 1);
          }
        }
      }

      // 合并标签，计算总使用次数和来源
      const mergedTags = new Map<
        string,
        { count: number; source: "ai" | "user" | "both" }
      >();

      for (const [tag, count] of aiTagCounts) {
        mergedTags.set(tag, { count, source: "ai" });
      }

      for (const [tag, count] of userTagCounts) {
        const existing = mergedTags.get(tag);
        if (existing) {
          // 标签同时存在于 AI 和用户标签中
          mergedTags.set(tag, {
            count: existing.count + count,
            source: "both",
          });
        } else {
          mergedTags.set(tag, { count, source: "user" });
        }
      }

      // 转换为数组并排序
      let tags: TagInfo[] = Array.from(mergedTags.entries()).map(
        ([name, { count, source }]) => ({
          name,
          count,
          source,
        }),
      );

      // 排序
      if (params.orderBy === "name") {
        tags.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
      } else {
        // 默认按使用次数降序
        tags.sort((a, b) => b.count - a.count);
      }

      // 限制数量
      tags = tags.slice(0, params.limit);

      const result: ListTagsResult = {
        tags,
        total: mergedTags.size,
        aiTagCount: aiTagCounts.size,
        userTagCount: userTagCounts.size,
      };

      logger.info(
        {
          toolName: "list_tags",
          userId: context.userId,
          totalTags: result.total,
          returnedTags: tags.length,
          orderBy: params.orderBy,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "list_tags: Success",
      );

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: tags.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "list_tags",
          userId: context.userId,
          error: errorMessage,
        },
        "list_tags: Failed",
      );

      return {
        success: false,
        error: `获取标签列表失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
