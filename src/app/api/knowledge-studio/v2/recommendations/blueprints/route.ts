/**
 * Knowledge Studio v2 - Blueprint Recommendations API
 * @route GET /api/knowledge-studio/v2/recommendations/blueprints
 * @route POST /api/knowledge-studio/v2/recommendations/blueprints
 * @description 获取蓝图推荐（最近使用 + 热门 + 基于素材智能推荐）
 */

import type { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { getBlueprintRegistry } from "@/lib/knowledge-studio/blueprint/blueprint-registry";
import type {
  BlueprintTier,
  MaterialInput,
} from "@/lib/knowledge-studio/blueprint/types";
import type { Database } from "@/types/supabase";
import { recommendBlueprints } from "@/lib/knowledge-studio/recommendation";

const logger = createLogger(
  "api:knowledge-studio:v2:recommendations:blueprints",
);

/**
 * 推荐项类型
 */
interface BlueprintRecommendation {
  blueprintId: string;
  displayName: string;
  icon: string;
  description: string;
  recommendationType: "recent" | "popular" | "new";
  score: number;
  useCount?: number;
  lastUsedAt?: string;
}

/**
 * GET /api/knowledge-studio/v2/recommendations/blueprints
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const requestId = crypto.randomUUID();
  const supabase = await createClient();
  logger.info({ requestId }, "Blueprint recommendations request received");

  // 1. Get limit from query params
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10), 10);

  // 2. Get user tier for access filtering
  const { data: profile } = await supabase
    .from("profiles")
    .select("membership_type")
    .eq("id", userId)
    .single<Database["public"]["Tables"]["profiles"]["Row"]>();

  const membershipType = profile?.membership_type?.toLowerCase() || "free";
  const userTier: BlueprintTier =
    membershipType === "enterprise"
      ? "enterprise"
      : membershipType === "pro"
        ? "pro"
        : "free";

  // 3. Get recommendations from database
  const { data: dbRecommendations, error: dbError } = await supabase.rpc(
    "get_blueprint_recommendations",
    {
      p_user_id: userId,
      p_limit: limit,
    },
  );

  if (dbError) {
    logger.warn(
      { requestId, error: dbError },
      "Failed to get recommendations from DB, using fallback",
    );
  }

  // 4. Build recommendations with blueprint metadata
  const registry = getBlueprintRegistry();
  const allBlueprints = registry.getAll();
  const recommendations: BlueprintRecommendation[] = [];

  // Add DB recommendations
  if (dbRecommendations && Array.isArray(dbRecommendations)) {
    for (const rec of dbRecommendations) {
      const blueprint = registry.getById(rec.blueprint_id);
      if (blueprint && registry.canAccess(rec.blueprint_id, userTier)) {
        const metadata = blueprint.getBlueprintMetadata();
        recommendations.push({
          blueprintId: rec.blueprint_id,
          displayName: metadata.displayName,
          icon: metadata.icon,
          description: metadata.description,
          recommendationType: rec.recommendation_type as "recent" | "popular",
          score:
            typeof rec.score === "number"
              ? rec.score
              : parseFloat(rec.score || "0") || 0,
          useCount: rec.use_count,
          lastUsedAt: rec.last_used_at,
        });
      }
    }
  }

  // 5. Fill with default recommendations if not enough
  if (recommendations.length < limit) {
    const existingIds = new Set(recommendations.map((r) => r.blueprintId));
    const defaultOrder = [
      "wechat_article",
      "xiaohongshu_note",
      "content_summary",
      "competitive_analysis",
      "learning_notes",
    ];

    for (const blueprintId of defaultOrder) {
      if (recommendations.length >= limit) break;
      if (existingIds.has(blueprintId)) continue;

      const blueprint = allBlueprints.find(
        (b) => b.getBlueprintMetadata().blueprintId === blueprintId,
      );
      if (blueprint && registry.canAccess(blueprintId, userTier)) {
        const metadata = blueprint.getBlueprintMetadata();
        recommendations.push({
          blueprintId,
          displayName: metadata.displayName,
          icon: metadata.icon,
          description: metadata.description,
          recommendationType: "new",
          score: 0,
        });
        existingIds.add(blueprintId);
      }
    }
  }

  // 6. Separate by type for frontend
  const recentlyUsed = recommendations
    .filter((r) => r.recommendationType === "recent")
    .slice(0, 3);
  const popular = recommendations
    .filter((r) => r.recommendationType === "popular")
    .slice(0, 3);
  const suggested = recommendations
    .filter((r) => r.recommendationType === "new")
    .slice(0, 3);

  logger.info(
    {
      requestId,
      userId,
      recentCount: recentlyUsed.length,
      popularCount: popular.length,
      suggestedCount: suggested.length,
    },
    "Blueprint recommendations generated",
  );

  return new Response(
    JSON.stringify({
      recentlyUsed,
      popular,
      suggested,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  ) as unknown as NextResponse;
});

/**
 * POST /api/knowledge-studio/v2/recommendations/blueprints
 * 基于素材内容的智能蓝图推荐 (P1-3)
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const requestId = crypto.randomUUID();
  const supabase = await createClient();
  logger.info(
    { requestId },
    "Material-based blueprint recommendations request",
  );

  // 1. Parse request body
  const body = await request.json();
  const materials: MaterialInput[] = body.materials ?? [];

  if (materials.length === 0) {
    return new Response(
      JSON.stringify({
        error: { code: "BAD_REQUEST", message: "请提供素材" },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    ) as unknown as NextResponse;
  }

  // 2. Get user tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("membership_type")
    .eq("id", userId)
    .single<Database["public"]["Tables"]["profiles"]["Row"]>();

  const membershipType = profile?.membership_type?.toLowerCase() || "free";
  const userTier: BlueprintTier =
    membershipType === "enterprise"
      ? "enterprise"
      : membershipType === "pro"
        ? "pro"
        : "free";

  // 3. Get material-based recommendations
  const limit = Math.min(body.limit ?? 5, 10);
  const result = await recommendBlueprints(materials, userTier, limit);

  logger.info(
    {
      requestId,
      userId,
      materialCount: materials.length,
      recommendationCount: result.recommendations.length,
      topMatch: result.recommendations[0]?.blueprintId,
      contentType: result.analysis.contentType,
    },
    "Material-based recommendations generated",
  );

  return new Response(
    JSON.stringify({
      analysis: result.analysis,
      recommendations: result.recommendations,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  ) as unknown as NextResponse;
});
