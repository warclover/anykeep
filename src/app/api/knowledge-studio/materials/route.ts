/**
 * Knowledge Studio - 素材 API
 * @route POST /api/knowledge-studio/materials
 * @description 素材健康度评分
 */

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { materialScorer } from "@/lib/knowledge-studio";
import type { BlueprintType } from "@/lib/knowledge-studio";

import { withAuthMiddleware } from "@/lib/api/middleware";
const logger = createLogger("api:knowledge-studio:materials");

/**
 * 分析请求 Schema
 * targetBlueprintType 支持 v1 类型和 v2 ID 格式
 */
const AnalyzeRequestSchema = z.object({
  bookmarkIds: z.array(z.string()).min(1, "至少选择一个书签"),
  targetBlueprintType: z.string().optional(),
});

/**
 * POST /api/knowledge-studio/materials
 * 分析素材健康度
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await request.json();

  // 记录请求体以便调试
  logger.info({ body }, "Received material analysis request");

  const parseResult = AnalyzeRequestSchema.safeParse(body);

  if (!parseResult.success) {
    logger.warn(
      { body, errors: parseResult.error.flatten() },
      "Invalid request parameters",
    );
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

  // 验证 bookmarkIds 不为空
  if (!bookmarkIds || bookmarkIds.length === 0) {
    logger.warn({ userId: userId }, "Empty bookmarkIds array");
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "bookmarkIds 不能为空",
        },
      },
      { status: 400 },
    );
  }

  // 验证所有 ID 都是有效的字符串
  const invalidIds = bookmarkIds.filter(
    (id) => typeof id !== "string" || id.trim() === "",
  );
  if (invalidIds.length > 0) {
    logger.warn({ userId: userId, invalidIds }, "Invalid bookmark IDs found");
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: `无效的书签 ID: ${invalidIds.join(", ")}`,
        },
      },
      { status: 400 },
    );
  }

  logger.info(
    {
      userId: userId,
      bookmarkCount: bookmarkIds.length,
      targetBlueprintType,
    },
    "Starting material analysis",
  );

  // 执行素材分析
  const result = await materialScorer.analyze({
    userId: userId,
    bookmarkIds,
    targetBlueprintType: targetBlueprintType as BlueprintType | undefined,
  });

  if (!result.success) {
    logger.error(
      {
        userId: userId,
        error: result.error,
        bookmarkCount: bookmarkIds.length,
      },
      "Material analysis failed",
    );
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
});
