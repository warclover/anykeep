/**
 * Knowledge Studio v2 - Material Recommendations API
 * @route POST /api/knowledge-studio/v2/recommendations/materials
 * @description 基于已选素材推荐相关素材（语义相似度）
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const logger = createLogger(
  "api:knowledge-studio:v2:recommendations:materials",
);

/**
 * Request schema
 */
const MaterialRecommendationsRequestSchema = z.object({
  /** 已选择的素材 ID 列表 */
  selectedBookmarkIds: z.array(z.string()).min(1).max(5),
  /** 蓝图 ID（可选，用于筛选适合的素材） */
  blueprintId: z.string().optional(),
  /** 返回数量限制 */
  limit: z.number().min(1).max(20).default(5),
});

/**
 * 推荐素材项
 */
interface MaterialRecommendation {
  bookmarkId: string;
  title: string;
  url: string;
  platform: string | null;
  summary: string | null;
  similarity: number;
  reason: string;
}

/**
 * POST /api/knowledge-studio/v2/recommendations/materials
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logger.info({ requestId }, "Material recommendations request received");

  try {
    // 1. Auth check
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: { code: "UNAUTHORIZED", message: "请先登录" },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const parseResult = MaterialRecommendationsRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_REQUEST",
            message: "请求参数无效",
            details: parseResult.error.flatten(),
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { selectedBookmarkIds, limit } = parseResult.data;

    // 3. Get embeddings of selected bookmarks
    const numericIds = selectedBookmarkIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    const { data: selectedBookmarks, error: selectError } = await supabase
      .from("bookmarks")
      .select("id, title, embedding")
      .eq("user_id", user.id)
      .in("id", numericIds);

    if (selectError) {
      logger.error(
        { requestId, error: selectError },
        "Failed to get selected bookmarks",
      );
      throw selectError;
    }

    // 4. Calculate average embedding vector
    const embeddingsWithData = (selectedBookmarks || []).filter(
      (b): b is typeof b & { embedding: number[] } =>
        b.embedding !== null && Array.isArray(b.embedding),
    );

    if (embeddingsWithData.length === 0) {
      // No embeddings available, fall back to recent bookmarks
      const { data: recentBookmarks } = await supabase
        .from("bookmarks")
        .select("id, title, url, platform, ai_summary")
        .eq("user_id", user.id)
        .not("id", "in", `(${numericIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(limit);

      const fallbackRecommendations: MaterialRecommendation[] = (
        recentBookmarks || []
      ).map((b) => ({
        bookmarkId: String(b.id),
        title: b.title || "无标题",
        url: b.url,
        platform: b.platform,
        summary: b.ai_summary,
        similarity: 0,
        reason: "最近收藏",
      }));

      return new Response(
        JSON.stringify({
          recommendations: fallbackRecommendations,
          method: "recent",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 5. Calculate centroid embedding
    const embeddingDim = embeddingsWithData[0].embedding.length;
    const centroid = new Array(embeddingDim).fill(0);

    for (const bookmark of embeddingsWithData) {
      for (let i = 0; i < embeddingDim; i++) {
        centroid[i] += bookmark.embedding[i] / embeddingsWithData.length;
      }
    }

    // 6. Find similar bookmarks using vector similarity
    // Note: RPC function types will be available after migration is applied
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: similarBookmarks, error: similarError } = (await (
      supabase.rpc as any
    )("match_bookmarks_by_embedding", {
      query_embedding: centroid,
      match_threshold: 0.5,
      match_count: limit + numericIds.length,
      p_user_id: user.id,
    })) as {
      data: Array<{
        id: number;
        title: string | null;
        url: string;
        platform: string | null;
        ai_summary: string | null;
        similarity: number;
      }> | null;
      error: Error | null;
    };

    if (similarError) {
      logger.warn(
        { requestId, error: similarError },
        "Vector search failed, using fallback",
      );

      // Fallback to recent bookmarks
      const { data: recentBookmarks } = await supabase
        .from("bookmarks")
        .select("id, title, url, platform, ai_summary")
        .eq("user_id", user.id)
        .not("id", "in", `(${numericIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(limit);

      const fallbackRecommendations: MaterialRecommendation[] = (
        recentBookmarks || []
      ).map((b) => ({
        bookmarkId: String(b.id),
        title: b.title || "无标题",
        url: b.url,
        platform: b.platform,
        summary: b.ai_summary,
        similarity: 0,
        reason: "最近收藏",
      }));

      return new Response(
        JSON.stringify({
          recommendations: fallbackRecommendations,
          method: "recent",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 7. Filter out already selected and build recommendations
    const recommendations: MaterialRecommendation[] = (similarBookmarks || [])
      .filter((b: { id: number }) => !numericIds.includes(b.id))
      .slice(0, limit)
      .map(
        (b: {
          id: number;
          title: string | null;
          url: string;
          platform: string | null;
          ai_summary: string | null;
          similarity: number;
        }) => ({
          bookmarkId: String(b.id),
          title: b.title || "无标题",
          url: b.url,
          platform: b.platform,
          summary: b.ai_summary,
          similarity: b.similarity,
          reason:
            b.similarity > 0.8
              ? "高度相关"
              : b.similarity > 0.6
                ? "主题相近"
                : "可能相关",
        }),
      );

    logger.info(
      {
        requestId,
        userId: user.id,
        selectedCount: selectedBookmarkIds.length,
        recommendationCount: recommendations.length,
      },
      "Material recommendations generated",
    );

    return new Response(
      JSON.stringify({
        recommendations,
        method: "semantic",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    logger.error(
      {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Material recommendations request failed",
    );

    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "服务器内部错误",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
