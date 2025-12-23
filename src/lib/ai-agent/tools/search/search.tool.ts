/**
 * search Tool
 *
 * 搜索书签（极简版）
 * 只需提供搜索词，自动使用混合搜索模式
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { searchSkill } from "@/lib/ai-skills/skills/search";
import { logger } from "@/lib/logger";

// ============================================
// 参数定义（极简）
// ============================================

const paramsSchema = z.object({
  query: z
    .string()
    .min(1, "搜索关键词不能为空")
    .max(200, "搜索关键词不能超过200字符")
    .describe("搜索关键词"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe("返回数量，默认 5"),
});

type SearchParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型（精简）
// ============================================

interface SearchResultItem {
  id: number;
  title: string;
  url: string;
  platform: string;
  summary: string | null;
  tags: string[];
  similarity: number;
}

interface SearchResult {
  query: string;
  results: SearchResultItem[];
  total: number;
}

// ============================================
// Tool 实现
// ============================================

export const searchTool: Tool<SearchParams, SearchResult> = {
  definition: {
    name: "search",
    description:
      "在用户的收藏中搜索内容。用于回答「找关于 React 的文章」「有没有收藏过机器学习的内容」等问题。",
    parameters: paramsSchema,
    category: "search",
    requiresConfirmation: false,
    estimatedDurationMs: 2000,
  },

  async execute(
    params: SearchParams,
    context: ToolContext,
  ): Promise<ToolResult<SearchResult>> {
    const startTime = performance.now();

    try {
      // 调用 SearchSkill，固定使用 hybrid 模式
      const skillResult = await searchSkill.execute(
        {
          query: params.query,
          mode: "hybrid",
          limit: params.limit ?? 5,
          threshold: 0.5,
        },
        {
          userId: context.userId,
          conversationId: context.conversationId,
          traceId: context.traceId,
        },
      );

      if (!skillResult.success) {
        return {
          success: false,
          error: skillResult.error || "搜索失败",
          errorCode: skillResult.errorCode,
        };
      }

      // 精简返回结果
      const result: SearchResult = {
        query: params.query,
        results: skillResult.data.results.map((r) => ({
          id: r.id,
          title: r.title,
          url: r.url,
          platform: r.platform,
          summary: r.aiSummary || r.description,
          tags: [...(r.aiTags || []), ...(r.userTags || [])],
          similarity: r.similarity ?? 0,
        })),
        total: skillResult.data.totalCount,
      };

      logger.info(
        {
          toolName: "search",
          userId: context.userId,
          query: params.query.substring(0, 50),
          resultCount: result.total,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "search: Success",
      );

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: result.total,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "search",
          userId: context.userId,
          query: params.query.substring(0, 50),
          error: errorMessage,
        },
        "search: Failed",
      );

      return {
        success: false,
        error: `搜索失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
