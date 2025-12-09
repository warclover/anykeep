/**
 * V3.0 整理大师 (AI Librarian) API
 *
 * GET /api/librarian/analysis - 获取最近的分析结果
 * POST /api/librarian/analysis - 执行新的分析
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
  notFoundError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { createAILibrarianService } from "@/lib/classification/v3/services/ai-librarian.service";

// ============================================================================
// API 处理器
// ============================================================================

/**
 * GET /api/librarian/analysis
 * 获取最近的分析结果
 */
export async function GET() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 获取最近的分析结果
    const librarian = createAILibrarianService(supabase);
    const analysis = await librarian.getRecentAnalysis(user.id);

    if (!analysis) {
      return notFoundError("暂无分析记录");
    }

    logger.debug(
      { userId: user.id, healthScore: analysis.healthScore },
      "Librarian analysis retrieved",
    );

    return successResponse(analysis);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/librarian/analysis error",
    );
    return internalError("获取分析结果失败");
  }
}

/**
 * POST /api/librarian/analysis
 * 执行新的分析
 */
export async function POST() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 执行分析
    const librarian = createAILibrarianService(supabase);
    const analysis = await librarian.analyze(user.id);

    logger.info(
      {
        userId: user.id,
        healthScore: analysis.healthScore,
        totalSuggestions: analysis.totalSuggestions,
      },
      "Librarian analysis completed",
    );

    return successResponse(analysis);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/librarian/analysis error",
    );
    return internalError("分析失败");
  }
}
