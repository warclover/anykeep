/**
 * semantic_search Tool
 *
 * 语义搜索书签内容，复用 SearchSkill 能力
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { searchSkill } from "@/lib/ai-skills/skills/search";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  query: z
    .string()
    .min(1, "搜索关键词不能为空")
    .max(200, "搜索关键词不能超过200字符")
    .describe("搜索关键词，支持自然语言查询"),
  mode: z
    .enum(["keyword", "semantic", "hybrid"])
    .optional()
    .default("hybrid")
    .describe(
      "搜索模式：keyword-关键词精确匹配，semantic-语义相似度搜索，hybrid-混合搜索（推荐）",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe("返回结果数量，默认 5，最大 20"),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.5)
    .describe("语义搜索相似度阈值，0-1 之间，越高越精确，默认 0.5"),
  platform: z
    .string()
    .optional()
    .describe("筛选平台，如 wechat、bilibili、zhihu、chrome 等"),
  folder_id: z.number().int().positive().optional().describe("筛选文件夹 ID"),
  tags: z.array(z.string()).optional().describe("筛选标签，结果需包含任一标签"),
  starred_only: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否只搜索已收藏的书签"),
});

type SearchParams = z.infer<typeof paramsSchema>;

interface SearchResultItem {
  id: number;
  title: string;
  url: string;
  platform: string;
  description: string | null;
  aiSummary: string | null;
  aiTags: string[] | null;
  userTags: string[] | null;
  folderId: number | null;
  folderName: string | null;
  author: string | null;
  similarity?: number;
  createdAt: string;
}

interface SearchResult {
  query: string;
  searchMode: "keyword" | "semantic" | "hybrid";
  results: SearchResultItem[];
  totalCount: number;
  hasMore: boolean;
  suggestions?: string[];
}

// ============================================
// Tool 实现
// ============================================

export const semanticSearchTool: Tool<SearchParams, SearchResult> = {
  definition: {
    name: "semantic_search",
    description: `在用户的书签库中进行智能搜索。

使用场景：
- 用户搜索内容："找一下关于 React 的文章"
- 用户查找主题："有没有关于机器学习的收藏"
- 用户探索知识："我之前收藏过什么技术文章"

搜索模式说明：
- hybrid（推荐）：结合关键词和语义，综合效果最好
- semantic：基于含义相似度，适合模糊搜索
- keyword：精确匹配关键词，适合查找特定内容

返回结果包含：
- 匹配的书签列表
- 相似度分数（语义搜索模式）
- 书签摘要和标签
- 搜索建议（无结果时）`,
    parameters: paramsSchema,
    category: "search",
    estimatedDurationMs: 2000,
  },

  async execute(
    params: SearchParams,
    context: ToolContext,
  ): Promise<ToolResult<SearchResult>> {
    const startTime = performance.now();

    try {
      // 调用 SearchSkill
      const skillResult = await searchSkill.execute(
        {
          query: params.query,
          mode: params.mode,
          limit: params.limit,
          threshold: params.threshold,
          platform: params.platform,
          folderId: params.folder_id,
          tags: params.tags,
          starredOnly: params.starred_only,
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

      // 转换结果格式
      const result: SearchResult = {
        query: skillResult.data.query,
        searchMode: skillResult.data.searchMode,
        results: skillResult.data.results.map((r) => ({
          id: r.id,
          title: r.title,
          url: r.url,
          platform: r.platform,
          description: r.description,
          aiSummary: r.aiSummary,
          aiTags: r.aiTags,
          userTags: r.userTags,
          folderId: r.folderId,
          folderName: r.folderName,
          author: r.author,
          similarity: r.similarity,
          createdAt: r.createdAt,
        })),
        totalCount: skillResult.data.totalCount,
        hasMore: skillResult.data.hasMore,
        suggestions: skillResult.data.suggestions,
      };

      logger.info(
        {
          toolName: "semantic_search",
          userId: context.userId,
          query: params.query.substring(0, 50),
          mode: params.mode,
          resultCount: result.totalCount,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "semantic_search: Success",
      );

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: result.totalCount,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "semantic_search",
          userId: context.userId,
          query: params.query.substring(0, 50),
          error: errorMessage,
        },
        "semantic_search: Failed",
      );

      return {
        success: false,
        error: `搜索失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
