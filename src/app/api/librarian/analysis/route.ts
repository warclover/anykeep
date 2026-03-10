/**
 * V3.0 整理大师 (AI Librarian) API
 *
 * GET /api/librarian/analysis - 获取最近的分析结果
 * POST /api/librarian/analysis - 执行新的分析
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { successResponse, notFoundError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { createAILibrarianService } from "@/lib/ai-librarian";

// ============================================================================
// API 处理器
// ============================================================================

/**
 * GET /api/librarian/analysis
 * 获取最近的分析结果
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 获取最近的分析结果
    const librarian = createAILibrarianService(supabase);
    const analysis = await librarian.getRecentAnalysis(userId);

    if (!analysis) {
      return notFoundError("暂无分析记录");
    }

    logger.debug(
      { userId, healthScore: analysis.healthScore },
      "Librarian analysis retrieved",
    );

    return successResponse(analysis);
  },
);

/**
 * POST /api/librarian/analysis
 * 执行新的分析
 */
export const POST = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 执行分析
    const librarian = createAILibrarianService(supabase);
    const analysis = await librarian.analyze(userId);

    logger.info(
      {
        userId,
        healthScore: analysis.healthScore,
        totalSuggestions: analysis.totalSuggestions,
      },
      "Librarian analysis completed",
    );

    return successResponse(analysis);
  },
);
