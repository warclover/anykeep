/**
 * MD 收藏语义搜索 API
 * P2-007: Markdown 内容收藏 - 语义搜索
 *
 * GET /api/md-collections/search - 搜索 MD 收藏（支持关键词、语义、混合搜索）
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  forbiddenError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { generateEmbedding } from "@/lib/utils/embedding-generator";
import { logger } from "@/lib/logger";

/**
 * 搜索模式
 */
type SearchMode = "keyword" | "semantic" | "hybrid";

/**
 * MD 收藏搜索结果类型
 */
interface MdSearchResult {
  id: number;
  title: string;
  ai_summary: string | null;
  ai_tags: string[] | null;
  content_type: string | null;
  word_count: number | null;
  reading_time_minutes: number | null;
  folder_id: number | null;
  created_at: string;
  similarity?: number;
}

/**
 * 语义搜索 MD 收藏
 */
async function searchMdSemantic(
  supabase: ReturnType<typeof createClient> extends Promise<infer T>
    ? T
    : never,
  userId: string,
  query: string,
  options: { threshold?: number; limit?: number } = {},
): Promise<{ data: MdSearchResult[] | null; error: Error | null }> {
  const { threshold = 0.5, limit = 20 } = options;

  try {
    // 生成查询向量
    const queryEmbedding = await generateEmbedding(query);

    // 调用数据库语义搜索函数
    // Note: 类型定义将在执行 `npm run supabase:gen:types` 后自动生成
    const { data, error } = await (supabase.rpc as CallableFunction)(
      "search_md_collections_semantic",
      {
        query_embedding: queryEmbedding,
        p_user_id: userId,
        match_threshold: threshold,
        match_count: limit,
      },
    );

    if (error) {
      logger.error(
        { error: error.message, action: "md_semantic_search_db_error" },
        "MD Semantic Search: Database error",
      );
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as unknown as MdSearchResult[], error: null };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        action: "md_semantic_search_failed",
      },
      "MD Semantic Search: Failed",
    );
    return {
      data: null,
      error: error instanceof Error ? error : new Error("语义搜索失败"),
    };
  }
}

/**
 * 关键词搜索 MD 收藏
 */
async function searchMdKeyword(
  supabase: ReturnType<typeof createClient> extends Promise<infer T>
    ? T
    : never,
  userId: string,
  query: string,
  limit: number,
): Promise<{ data: MdSearchResult[] | null; error: Error | null }> {
  try {
    // 转义特殊字符
    const escapedQuery = query.replace(/[%_\\]/g, "\\$&");

    const { data, error } = await supabase
      .from("md_collections")
      .select(
        `
        id, title, ai_summary, ai_tags, content_type,
        word_count, reading_time_minutes, folder_id, created_at
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
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as MdSearchResult[], error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("关键词搜索失败"),
    };
  }
}

/**
 * GET /api/md-collections/search
 *
 * Query Parameters:
 * - q: 搜索关键词（必填，至少 2 个字符）
 * - mode: 搜索模式 (keyword | semantic | hybrid)，默认 hybrid
 * - limit: 结果数量限制，默认 20，最大 100
 * - threshold: 语义搜索相似度阈值 (0-1)，默认 0.5
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 检查 PRO 权限
    // 类型断言: 手动维护类型文件时需要此断言
    type ProfileRow = { membership_type: string | null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("membership_type")
      .eq("id", user.id)
      .single() as { data: ProfileRow | null };

    if (profile?.membership_type !== "PRO") {
      return forbiddenError("MD 收藏搜索功能仅限 Pro 用户使用");
    }

    // 3. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const mode = (searchParams.get("mode") || "hybrid") as SearchMode;
    const limitParam = searchParams.get("limit");
    const thresholdParam = searchParams.get("threshold");

    // 验证必填参数
    if (!query || query.trim().length < 2) {
      return badRequestError("搜索关键词至少需要 2 个字符");
    }

    // 解析可选参数
    const limit = Math.min(
      Math.max(parseInt(limitParam || "20", 10) || 20, 1),
      100,
    );
    const threshold = Math.min(
      Math.max(parseFloat(thresholdParam || "0.5") || 0.5, 0),
      1,
    );

    logger.info(
      {
        userId: user.id,
        query: query.substring(0, 50),
        mode,
        limit,
        threshold,
        action: "md_search_request",
      },
      "MD Search: Request received",
    );

    // 4. 执行搜索
    let results: MdSearchResult[] = [];
    let searchType = mode;
    let error: Error | null = null;

    switch (mode) {
      case "keyword": {
        const keywordResult = await searchMdKeyword(
          supabase,
          user.id,
          query,
          limit,
        );
        results = keywordResult.data || [];
        error = keywordResult.error;
        break;
      }

      case "semantic": {
        const semanticResult = await searchMdSemantic(
          supabase,
          user.id,
          query,
          {
            threshold,
            limit,
          },
        );
        results = semanticResult.data || [];
        error = semanticResult.error;
        break;
      }

      case "hybrid":
      default: {
        // 并行执行两种搜索
        const [semanticResult, keywordResult] = await Promise.allSettled([
          searchMdSemantic(supabase, user.id, query, { threshold, limit }),
          searchMdKeyword(supabase, user.id, query, limit),
        ]);

        const semanticResults =
          semanticResult.status === "fulfilled" && semanticResult.value.data
            ? semanticResult.value.data
            : [];
        const keywordResults =
          keywordResult.status === "fulfilled" && keywordResult.value.data
            ? keywordResult.value.data
            : [];

        // 合并去重
        const seenIds = new Set<number>();
        const mergedResults: MdSearchResult[] = [];

        // 语义结果优先
        for (const result of semanticResults) {
          if (!seenIds.has(result.id)) {
            seenIds.add(result.id);
            mergedResults.push(result);
          }
        }

        // 补充关键词结果
        for (const result of keywordResults) {
          if (!seenIds.has(result.id) && mergedResults.length < limit) {
            seenIds.add(result.id);
            mergedResults.push({ ...result, similarity: 0 });
          }
        }

        results = mergedResults.slice(0, limit);

        // 确定搜索类型
        if (semanticResults.length === 0 && keywordResults.length > 0) {
          searchType = "keyword";
        } else if (semanticResults.length > 0 && keywordResults.length === 0) {
          searchType = "semantic";
        }
        break;
      }
    }

    if (error) {
      logger.error(
        {
          error: error.message,
          query: query.substring(0, 50),
          mode,
          action: "md_search_error",
        },
        "MD Search: Error occurred",
      );
      results = [];
    }

    logger.info(
      {
        userId: user.id,
        query: query.substring(0, 50),
        mode,
        searchType,
        resultCount: results.length,
        action: "md_search_complete",
      },
      "MD Search: Complete",
    );

    // 5. 返回结果
    return successResponse({
      query,
      mode,
      searchType,
      results,
      count: results.length,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "md_search",
      },
      "GET /api/md-collections/search error",
    );
    return internalError("搜索失败，请稍后重试");
  }
}
