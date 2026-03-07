/**
 * Knowledge Studio v2 - Material Recommendations API
 * @route POST /api/knowledge-studio/v2/recommendations/materials
 * @description 基于已选素材推荐相关素材（语义相似度）
 */

import type { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
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
 * find_related_bookmarks RPC 返回类型
 */
interface RelatedBookmarkRow {
  id: number;
  title: string | null;
  url: string;
  description: string | null;
  similarity: number;
  folder_id: number | null;
  folder_name: string | null;
  platform: string | null;
  created_at: string;
}

/**
 * POST /api/knowledge-studio/v2/recommendations/materials
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const requestId = crypto.randomUUID();
  const supabase = await createClient();
  logger.info({ requestId }, "Material recommendations request received");

  // 1. Parse request body
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
    ) as unknown as NextResponse;
  }

  const { selectedBookmarkIds, limit } = parseResult.data;

  // 2. Convert to numeric IDs
  const numericIds = selectedBookmarkIds
    .map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id));

  if (numericIds.length === 0) {
    return new Response(
      JSON.stringify({
        error: {
          code: "INVALID_REQUEST",
          message: "无效的书签 ID",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    ) as unknown as NextResponse;
  }

  // 3. 使用 find_related_bookmarks 为每个选中的书签查找相关内容
  const relatedMap = new Map<
    number,
    RelatedBookmarkRow & { sourceCount: number }
  >();

  let hasAnyResults = false;

  for (const bookmarkId of numericIds) {
    const { data: relatedData, error: rpcError } =
      (await // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any)("find_related_bookmarks", {
        p_bookmark_id: bookmarkId,
        p_user_id: userId,
        p_limit: limit + numericIds.length,
        p_min_similarity: 0.4,
        p_exclude_same_folder: false,
      })) as { data: RelatedBookmarkRow[] | null; error: Error | null };

    if (rpcError) {
      logger.warn(
        { requestId, bookmarkId, error: rpcError },
        "find_related_bookmarks failed for bookmark",
      );
      continue;
    }

    if (relatedData && relatedData.length > 0) {
      hasAnyResults = true;

      for (const related of relatedData) {
        // 跳过已选中的书签
        if (numericIds.includes(related.id)) {
          continue;
        }

        const existing = relatedMap.get(related.id);
        if (existing) {
          if (related.similarity > existing.similarity) {
            relatedMap.set(related.id, {
              ...related,
              sourceCount: existing.sourceCount + 1,
            });
          } else {
            existing.sourceCount += 1;
          }
        } else {
          relatedMap.set(related.id, { ...related, sourceCount: 1 });
        }
      }
    }
  }

  // 4. 如果没有找到相关结果，回退到最近收藏
  if (!hasAnyResults || relatedMap.size === 0) {
    logger.info(
      { requestId, selectedCount: numericIds.length },
      "No related bookmarks found, falling back to recent",
    );

    const { data: recentBookmarks } = await supabase
      .from("bookmarks")
      .select("id, title, url, platform, ai_summary")
      .eq("user_id", userId)
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
    ) as unknown as NextResponse;
  }

  // 5. 获取相关书签的摘要信息
  const relatedIds = Array.from(relatedMap.keys());
  const { data: summaryData } = await supabase
    .from("bookmarks")
    .select("id, ai_summary")
    .in("id", relatedIds);

  const summaryMap = new Map<number, string | null>();
  if (summaryData) {
    for (const item of summaryData) {
      summaryMap.set(item.id, item.ai_summary);
    }
  }

  // 6. 排序并构建推荐列表
  const sortedRelated = Array.from(relatedMap.values()).sort((a, b) => {
    if (b.sourceCount !== a.sourceCount) {
      return b.sourceCount - a.sourceCount;
    }
    return b.similarity - a.similarity;
  });

  const recommendations: MaterialRecommendation[] = sortedRelated
    .slice(0, limit)
    .map((b) => ({
      bookmarkId: String(b.id),
      title: b.title || "无标题",
      url: b.url,
      platform: b.platform,
      summary: summaryMap.get(b.id) || b.description,
      similarity: b.similarity,
      reason:
        b.sourceCount > 1
          ? `关联 ${b.sourceCount} 个素材`
          : b.similarity > 0.8
            ? "高度相关"
            : b.similarity > 0.6
              ? "主题相近"
              : "可能相关",
    }));

  logger.info(
    {
      requestId,
      userId,
      selectedCount: selectedBookmarkIds.length,
      recommendationCount: recommendations.length,
      method: "semantic",
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
  ) as unknown as NextResponse;
});
