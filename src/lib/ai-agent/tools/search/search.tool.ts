/**
 * search Tool
 *
 * 搜索书签（极简版）
 * 只需提供搜索词，自动使用混合搜索模式
 *
 * @version 1.1.0
 * @since 2025-12-23
 * @updated 2025-12-27 - 添加搜索结果持久化到会话状态
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { searchSkill } from "@/lib/ai-skills/skills/search";
import { logger } from "@/lib/logger";
import { SEARCH_TOOL_DESCRIPTIONS } from "../tool-description-templates";
import { sessionMemory } from "@/lib/ai-memory";

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
    name: "search_bookmarks",
    description: SEARCH_TOOL_DESCRIPTIONS.search,
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

      // 更新会话状态：记录搜索结果（用于后续序数引用）
      if (context.conversationId && result.results.length > 0) {
        const state = sessionMemory.getOrCreateState(
          context.conversationId,
          context.userId,
        );

        if (state) {
          // 记录搜索结果
          sessionMemory.recordSearchResults(context.conversationId, {
            query: params.query,
            resultCount: result.total,
            resultIds: result.results.map((r) => r.id),
            searchedAt: Date.now(),
            // 存储前 10 条结果摘要，用于序数引用时提供上下文
            resultSummaries: result.results.slice(0, 10).map((r) => ({
              id: r.id,
              title: r.title,
              summary: r.summary?.substring(0, 100),
            })),
          });

          // 记录输出摘要
          sessionMemory.recordOutput(context.conversationId, {
            type: "list",
            summary: `搜索"${params.query}"找到 ${result.total} 条结果`,
            relatedEntityIds: result.results.map((r) => r.id),
            outputAt: Date.now(),
          });

          logger.debug(
            {
              conversationId: context.conversationId,
              query: params.query.substring(0, 30),
              resultCount: result.results.length,
            },
            "search_bookmarks: Updated session memory",
          );
        }
      }

      logger.info(
        {
          toolName: "search_bookmarks",
          userId: context.userId,
          query: params.query.substring(0, 50),
          resultCount: result.total,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "search_bookmarks: Success",
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
          toolName: "search_bookmarks",
          userId: context.userId,
          query: params.query.substring(0, 50),
          error: errorMessage,
        },
        "search_bookmarks: Failed",
      );

      return {
        success: false,
        error: `搜索失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
