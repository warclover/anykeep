/**
 * V4.0 整理大师主动巡检 API
 *
 * GET /api/librarian/patrol - 获取最新巡检报告
 * POST /api/librarian/patrol - 执行新的巡检
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
  notFoundError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { createLibrarianPatrolService } from "@/lib/classification/services/advanced";

// ============================================================================
// API 处理器
// ============================================================================

/**
 * GET /api/librarian/patrol
 * 获取最新巡检报告
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

    // 2. 获取最新报告
    const patrolService = createLibrarianPatrolService(supabase);
    const report = await patrolService.getUserReport(user.id);

    if (!report) {
      return notFoundError("暂无巡检报告");
    }

    logger.debug(
      {
        userId: user.id,
        reportId: report.reportId,
        overallScore: report.overallScore,
      },
      "Patrol report retrieved",
    );

    return successResponse(report);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/librarian/patrol error",
    );
    return internalError("获取巡检报告失败");
  }
}

/**
 * POST /api/librarian/patrol
 * 执行新的巡检
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

    // 2. 执行巡检
    const patrolService = createLibrarianPatrolService(supabase);
    const report = await patrolService.patrolUser(user.id);

    logger.info(
      {
        userId: user.id,
        reportId: report.reportId,
        overallScore: report.overallScore,
        totalIssues: report.totalIssues,
        brokenLinksCount: report.brokenLinks.length,
        staleBookmarksCount: report.staleBookmarks.length,
      },
      "Patrol completed",
    );

    return successResponse(report);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/librarian/patrol error",
    );
    return internalError("巡检失败");
  }
}
