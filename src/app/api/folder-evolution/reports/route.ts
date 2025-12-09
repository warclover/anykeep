/**
 * Evolution Reports API
 * GET /api/folder-evolution/reports - Get monthly reports
 * POST /api/folder-evolution/reports - Generate new report
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { reportService } from "@/lib/classification/services/report.service";
import { logger } from "@/lib/logger";

/**
 * GET /api/folder-evolution/reports
 * Get user's evolution reports
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // Get optional month filter
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const limit = parseInt(searchParams.get("limit") || "12", 10);

    if (month) {
      // Get specific month's report
      const report = await reportService.getReport(user.id, month);

      if (report) {
        // Mark as viewed
        await reportService.markReportViewed(user.id, report.id);
      }

      return successResponse({
        report,
      });
    }

    // Get all reports
    const reports = await reportService.getReports(user.id, limit);

    return successResponse({
      reports,
      count: reports.length,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "GET /api/folder-evolution/reports error",
    );
    return internalError("获取报告失败");
  }
}

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
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // Validate request body
    const body = await request.json();
    const validation = generateReportSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { month, forceRegenerate } = validation.data;

    // Generate report
    const report = await reportService.generateMonthlyReport(user.id, month, {
      forceRegenerate,
    });

    if (!report) {
      return internalError("生成报告失败");
    }

    logger.info(
      { userId: user.id, month: report.reportMonth },
      "Evolution report generated",
    );

    return successResponse({
      report,
      message: "报告生成成功",
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "POST /api/folder-evolution/reports error",
    );
    return internalError("生成报告失败");
  }
}
