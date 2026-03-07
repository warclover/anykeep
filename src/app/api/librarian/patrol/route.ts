/**
 * V4.0 整理大师主动巡检 API
 *
 * GET /api/librarian/patrol - 获取最新巡检报告
 * POST /api/librarian/patrol - 执行新的巡检
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { successResponse, notFoundError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { createLibrarianPatrolService } from "@/lib/classification/services/advanced";

// ============================================================================
// API 处理器
// ============================================================================

/**
 * GET /api/librarian/patrol
 * 获取最新巡检报告
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 获取最新报告
    const patrolService = createLibrarianPatrolService(supabase);
    const report = await patrolService.getUserReport(userId);

    if (!report) {
      return notFoundError("暂无巡检报告");
    }

    logger.debug(
      {
        userId,
        reportId: report.reportId,
        overallScore: report.overallScore,
      },
      "Patrol report retrieved",
    );

    return successResponse(report);
  },
);

/**
 * POST /api/librarian/patrol
 * 执行新的巡检
 */
export const POST = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 执行巡检
    const patrolService = createLibrarianPatrolService(supabase);
    const report = await patrolService.patrolUser(userId);

    logger.info(
      {
        userId,
        reportId: report.reportId,
        overallScore: report.overallScore,
        totalIssues: report.totalIssues,
        brokenLinksCount: report.brokenLinks.length,
        staleBookmarksCount: report.staleBookmarks.length,
      },
      "Patrol completed",
    );

    return successResponse(report);
  },
);
