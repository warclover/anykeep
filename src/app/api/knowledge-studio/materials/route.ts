/**
 * Knowledge Studio - 素材 API
 * @route POST /api/knowledge-studio/materials
 * @description 素材健康度评分
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { materialScorer } from "@/lib/knowledge-studio";
import type { BlueprintType } from "@/lib/knowledge-studio";

const logger = createLogger("api:knowledge-studio:materials");

/**
 * 分析请求 Schema
 */
const AnalyzeRequestSchema = z.object({
  bookmarkIds: z.array(z.string()).min(1, "至少选择一个书签"),
  targetBlueprintType: z
    .enum(["debater", "blogger", "thread", "tutorial", "feynman"])
    .optional(),
});

/**
 * POST /api/knowledge-studio/materials
 * 分析素材健康度
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parseResult = AnalyzeRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "请求参数无效",
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const { bookmarkIds, targetBlueprintType } = parseResult.data;

    // 执行素材分析
    const result = await materialScorer.analyze({
      userId: user.id,
      bookmarkIds,
      targetBlueprintType: targetBlueprintType as BlueprintType | undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: result.error?.code || "ANALYSIS_FAILED",
            message: result.error?.message || "素材分析失败",
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      data: {
        scores: result.scores,
        overallRecommendation: result.overallRecommendation,
        summary: {
          totalMaterials: result.scores?.length || 0,
          averageScore: result.scores
            ? Math.round(
                result.scores.reduce((sum, s) => sum + s.overallScore, 0) /
                  result.scores.length,
              )
            : 0,
          highQuality:
            result.scores?.filter((s) => s.overallScore >= 80).length || 0,
          needsImprovement:
            result.scores?.filter((s) => s.overallScore < 60).length || 0,
        },
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Material analysis failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "素材分析失败" } },
      { status: 500 },
    );
  }
}
