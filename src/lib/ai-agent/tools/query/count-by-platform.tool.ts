/**
 * count_by_platform Tool
 *
 * 统计某个平台的收藏数量
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
});

type CountByPlatformParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface CountByPlatformResult {
  platform: string;
  count: number;
}

// ============================================
// Tool 实现
// ============================================

export const countByPlatformTool: Tool<
  CountByPlatformParams,
  CountByPlatformResult
> = {
  definition: {
    name: "count_by_platform",
    description:
      "统计某个平台的收藏数量。用于回答「微信收藏有多少」「B站收藏有多少」等问题。",
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 300,
  },

  async execute(
    params: CountByPlatformParams,
    context: ToolContext,
  ): Promise<ToolResult<CountByPlatformResult>> {
    const supabase = await createClient();
    const { platform } = params;

    const { count, error } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("platform", platform)
      .is("deleted_at", null);

    if (error) {
      return {
        success: false,
        error: error.message,
        errorCode: "DB_ERROR",
      };
    }

    return {
      success: true,
      data: {
        platform,
        count: count ?? 0,
      },
      metadata: {
        executionTimeMs: 0,
        affectedCount: count ?? 0,
      },
    };
  },
};
