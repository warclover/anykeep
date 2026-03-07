/**
 * Evolution Reports API
 * GET /api/folder-evolution/reports - Get monthly reports
 * POST /api/folder-evolution/reports - Generate new report
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  successResponse,
  handleValidationError,
  internalError,
} from "@/lib/utils/api-response";
import { reportService } from "@/lib/classification/services/report.service";
import { logger } from "@/lib/logger";

/**
 * GET /api/folder-evolution/reports
 * Get user's evolution reports
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // Get optional month filter
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const limit = parseInt(searchParams.get("limit") || "12", 10);

    if (month) {
      // Get specific month's report
      const report = await reportService.getReport(userId, month);

      if (report) {
        // Mark as viewed
        await reportService.markReportViewed(userId, report.id);
      }

      return successResponse({
        report,
      });
    }

    // Get all reports
    const reports = await reportService.getReports(userId, limit);

    return successResponse({
      reports,
      count: reports.length,
    });
  },
);

/**
 * Request body schema for POST
 */
const generateReportSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  forceRegenerate: z.boolean().optional(),
});

/**
 * POST /api/folder-evolution/reports
 * Generate a new monthly report
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // Validate request body
    const body = await request.json();
    const validation = generateReportSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { month, forceRegenerate } = validation.data;

    // Generate report
    const report = await reportService.generateMonthlyReport(userId, month, {
      forceRegenerate,
    });

    if (!report) {
      return internalError("生成报告失败");
    }

    logger.info(
      { userId, month: report.reportMonth },
      "Evolution report generated",
    );

    return successResponse({
      report,
      message: "报告生成成功",
    });
  },
);
