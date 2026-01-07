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

    // 3. Convert to numeric IDs
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
      );
    }

    // 4. 使用 find_related_bookmarks 为每个选中的书签查找相关内容
    // 并聚合结果，保留最高相似度
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
          p_user_id: user.id,
          p_limit: limit + numericIds.length, // 多取一些，后面会过滤已选中的
          p_min_similarity: 0.4, // 稍微降低阈值以获取更多候选
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
            // 保留最高相似度，增加来源计数
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

    // 5. 如果没有找到相关结果，回退到最近收藏
    if (!hasAnyResults || relatedMap.size === 0) {
      logger.info(
        { requestId, selectedCount: numericIds.length },
        "No related bookmarks found, falling back to recent",
      );

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

    // 6. 获取相关书签的摘要信息（find_related_bookmarks 不返回 ai_summary）
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

    // 7. 排序并构建推荐列表
    // 优先考虑：多个源书签都关联的 + 高相似度
    const sortedRelated = Array.from(relatedMap.values()).sort((a, b) => {
      // 先按来源数量排序（被多个选中书签关联更重要）
      if (b.sourceCount !== a.sourceCount) {
        return b.sourceCount - a.sourceCount;
      }
      // 再按相似度排序
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
        userId: user.id,
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
