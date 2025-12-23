/**
 * SearchMdCollections Tool - 搜索 MD 收藏
 *
 * 在 MD 收藏中搜索相关内容，支持关键词、语义和混合搜索
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/utils/embedding-generator";
import { logger } from "@/lib/logger";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  query: z.string().min(2).max(500).describe("搜索查询文本，至少 2 个字符"),
  mode: z
    .enum(["keyword", "semantic", "hybrid"])
    .optional()
    .default("hybrid")
    .describe(
      "搜索模式：keyword（关键词）、semantic（语义）、hybrid（混合，默认）",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("返回结果数量，最大 50"),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.5)
    .describe("语义搜索相似度阈值，0-1 之间"),
});

type SearchMdCollectionsParams = z.infer<typeof paramsSchema>;

interface SearchResultItem {
  id: number;
  title: string;
  snippet: string;
  similarity: number | null;
  contentType: string | null;
  aiTags: string[] | null;
  wordCount: number | null;
  createdAt: string;
}

interface SearchMdCollectionsResult {
  query: string;
  mode: "keyword" | "semantic" | "hybrid";
  actualMode: "keyword" | "semantic" | "hybrid";
  results: SearchResultItem[];
  totalFound: number;
  message: string;
}

// ============================================
// 辅助函数
// ============================================

interface MdSearchResult {
  id: number;
  title: string;
  ai_summary: string | null;
  ai_tags: string[] | null;
  content_type: string | null;
  word_count: number | null;
  raw_content?: string;
  created_at: string;
  similarity?: number;
}

/**
 * 语义搜索 MD 收藏
 */
async function searchSemantic(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  query: string,
  options: { threshold: number; limit: number },
): Promise<MdSearchResult[]> {
  try {
    // 生成查询向量
    const queryEmbedding = await generateEmbedding(query);

    // 调用数据库语义搜索函数
    const { data, error } = await (supabase.rpc as CallableFunction)(
      "search_md_collections_semantic",
      {
        query_embedding: queryEmbedding,
        p_user_id: userId,
        match_threshold: options.threshold,
        match_count: options.limit,
      },
    );

    if (error) {
      logger.warn(
        { error: error.message },
        "search_md_collections: Semantic search failed, falling back",
      );
      return [];
    }

    return (data as MdSearchResult[]) || [];
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "search_md_collections: Semantic search error",
    );
    return [];
  }
}

/**
 * 关键词搜索 MD 收藏
 */
async function searchKeyword(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  query: string,
  limit: number,
): Promise<MdSearchResult[]> {
  // 转义特殊字符
  const escapedQuery = query.replace(/[%_\\]/g, "\\$&");

  const { data, error } = await supabase
    .from("md_collections")
    .select(
      `
      id, title, ai_summary, ai_tags, content_type,
      word_count, raw_content, created_at
    `,
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(
      `title.ilike.%${escapedQuery}%,ai_summary.ilike.%${escapedQuery}%,raw_content.ilike.%${escapedQuery}%`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.warn(
      { error: error.message },
      "search_md_collections: Keyword search failed",
    );
    return [];
  }

  return (data as MdSearchResult[]) || [];
}

// ============================================
// Tool 实现
// ============================================

export const searchMdCollectionsTool: Tool<
  SearchMdCollectionsParams,
  SearchMdCollectionsResult
> = {
  definition: {
    name: "search_md_collections",
    description: `在用户的 Markdown 收藏中搜索相关内容。

使用场景：
- 用户要求 "在我的 MD 收藏中搜索 React"
- 用户要求 "找一下关于数据库的 MD 文档"
- 用户要求 "语义搜索 TypeScript 最佳实践"

搜索模式：
- keyword：纯关键词匹配，搜索标题、摘要和内容
- semantic：语义搜索，基于向量相似度匹配，理解查询意图
- hybrid：混合搜索（默认），结合关键词和语义，效果最好

参数说明：
- query：搜索关键词或语义查询（至少 2 字符）
- mode：搜索模式，默认 hybrid
- limit：返回结果数量，默认 10，最大 50
- threshold：语义相似度阈值，默认 0.5（仅语义搜索有效）`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 500,
  },

  async execute(
    params: SearchMdCollectionsParams,
    context,
  ): Promise<ToolResult<SearchMdCollectionsResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      let results: MdSearchResult[] = [];
      let actualMode = params.mode;

      // 1. 执行搜索
      switch (params.mode) {
        case "keyword": {
          results = await searchKeyword(
            supabase,
            context.userId,
            params.query,
            params.limit,
          );
          break;
        }

        case "semantic": {
          results = await searchSemantic(
            supabase,
            context.userId,
            params.query,
            {
              threshold: params.threshold,
              limit: params.limit,
            },
          );

          // 如果语义搜索没有结果，降级到关键词搜索
          if (results.length === 0) {
            results = await searchKeyword(
              supabase,
              context.userId,
              params.query,
              params.limit,
            );
            if (results.length > 0) {
              actualMode = "keyword";
            }
          }
          break;
        }

        case "hybrid":
        default: {
          // 并行执行两种搜索
          const [semanticResults, keywordResults] = await Promise.all([
            searchSemantic(supabase, context.userId, params.query, {
              threshold: params.threshold,
              limit: params.limit,
            }),
            searchKeyword(supabase, context.userId, params.query, params.limit),
          ]);

          // 合并去重，语义结果优先
          const seenIds = new Set<number>();
          const mergedResults: MdSearchResult[] = [];

          for (const result of semanticResults) {
            if (!seenIds.has(result.id)) {
              seenIds.add(result.id);
              mergedResults.push(result);
            }
          }

          for (const result of keywordResults) {
            if (
              !seenIds.has(result.id) &&
              mergedResults.length < params.limit
            ) {
              seenIds.add(result.id);
              mergedResults.push({ ...result, similarity: undefined });
            }
          }

          results = mergedResults.slice(0, params.limit);

          // 确定实际搜索类型
          if (semanticResults.length === 0 && keywordResults.length > 0) {
            actualMode = "keyword";
          } else if (
            semanticResults.length > 0 &&
            keywordResults.length === 0
          ) {
            actualMode = "semantic";
          }
          break;
        }
      }

      // 2. 格式化结果
      const formattedResults: SearchResultItem[] = results.map((item) => ({
        id: item.id,
        title: item.title,
        snippet:
          item.ai_summary ||
          (item.raw_content
            ? item.raw_content.substring(0, 200) + "..."
            : "暂无摘要"),
        similarity:
          item.similarity !== undefined
            ? Math.round(item.similarity * 100) / 100
            : null,
        contentType: item.content_type,
        aiTags: item.ai_tags,
        wordCount: item.word_count,
        createdAt: item.created_at,
      }));

      // 3. 构建消息
      let message = `使用${actualMode === "hybrid" ? "混合" : actualMode === "semantic" ? "语义" : "关键词"}搜索`;
      message += `，找到 ${formattedResults.length} 条相关 MD 收藏`;
      if (formattedResults.length === 0) {
        message = `未找到与「${params.query}」相关的 MD 收藏`;
      }

      logger.info(
        {
          toolName: "search_md_collections",
          userId: context.userId,
          query: params.query.substring(0, 50),
          mode: params.mode,
          actualMode,
          resultCount: formattedResults.length,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "search_md_collections: Success",
      );

      return {
        success: true,
        data: {
          query: params.query,
          mode: params.mode,
          actualMode,
          results: formattedResults,
          totalFound: formattedResults.length,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "search_md_collections",
          userId: context.userId,
          query: params.query.substring(0, 50),
          error: errorMessage,
        },
        "search_md_collections: Failed",
      );

      return {
        success: false,
        error: `搜索 MD 收藏失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
