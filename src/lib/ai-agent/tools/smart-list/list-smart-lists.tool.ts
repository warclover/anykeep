/**
 * 列出智能列表 Tool
 *
 * 获取用户的所有智能列表，包括预设列表和自定义列表
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { toSmartListClient, type SmartList } from "@/types/smart-list";
import type { SmartListSummary } from "./types";

const paramsSchema = z.object({
  includePresets: z
    .boolean()
    .default(true)
    .describe("是否包含预设列表，默认 true"),
  pinnedOnly: z.boolean().default(false).describe("是否只返回置顶列表"),
});

type ListSmartListsParams = z.infer<typeof paramsSchema>;

/**
 * 列出智能列表 Tool
 */
export const listSmartListsTool: Tool<
  ListSmartListsParams,
  SmartListSummary[]
> = {
  definition: {
    name: "list_smart_lists",
    description: `获取用户的所有智能列表。用于回答：
- "我有哪些智能列表"
- "查看我的列表"
- "列出智能列表"
返回列表名称、图标、书签数量等信息。`,
    parameters: paramsSchema,
    category: "query",
  },

  async execute(
    params: ListSmartListsParams,
    context: ToolContext,
  ): Promise<ToolResult<SmartListSummary[]>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 构建查询
      let query = supabase
        .from("smart_lists")
        .select("*")
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      // 是否只返回置顶
      if (params.pinnedOnly) {
        query = query.eq("is_pinned", true);
      }

      // 是否包含预设
      if (!params.includePresets) {
        query = query.eq("is_preset", false);
      }

      // 排序：置顶优先，然后按排序顺序
      query = query
        .order("is_pinned", { ascending: false })
        .order("sort_order", { ascending: true });

      const { data: smartLists, error } = await query;

      if (error) {
        return {
          success: false,
          error: `查询智能列表失败: ${error.message}`,
          errorCode: "QUERY_ERROR",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 转换为摘要格式
      const summaries: SmartListSummary[] = (
        (smartLists as SmartList[]) || []
      ).map((list) => {
        const client = toSmartListClient(list);
        return {
          id: client.id,
          name: client.name,
          icon: client.icon,
          color: client.color,
          description: client.description,
          isPreset: client.isPreset,
          isPinned: client.isPinned,
          bookmarkCount: client.bookmarkCount,
        };
      });

      return {
        success: true,
        data: summaries,
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: summaries.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取智能列表失败",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
