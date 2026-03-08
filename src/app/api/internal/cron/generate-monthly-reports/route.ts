/**
 * Cron Job: Generate Monthly Reports
 * Schedule: 0 5 1 * * (Every 1st day of month at 5:00 AM)
 *
 * Generates monthly evolution reports for all active users
 */

import { NextResponse } from "next/server";
import { initSupabaseAdmin } from "@/lib/supabase/admin-client";
import { logger } from "@/lib/logger";
import { reportService } from "@/lib/classification/services/report.service";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

// Use Service Role Key to bypass RLS
const supabaseAdmin = initSupabaseAdmin();

/**
 * GET /api/cron/generate-monthly-reports
 * Generate monthly reports for all active users
 */
export async function GET(request: Request) {
  try {
    // 🔒 安全修复：使用统一的内部 API 认证
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    logger.info("Starting monthly reports generation cron job");

    const startTime = Date.now();
    let generatedCount = 0;
    let errorCount = 0;

    // Get previous month string
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const reportMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

    // Get all active users (who have bookmarks)
    const { data: activeUsers, error: fetchError } = await supabaseAdmin
      .from("bookmarks")
      .select("user_id")
      .is("deleted_at", null)
      .limit(10000);

    if (fetchError) {
      logger.error(
        { error: fetchError },
        "Failed to fetch active users for report generation",
      );
      return NextResponse.json(
        { error: "Failed to fetch users", details: fetchError.message },
        { status: 500 },
      );
    }

    // Get unique user IDs
    const uniqueUserIds = [
      ...new Set((activeUsers || []).map((row) => row.user_id as string)),
    ];

    if (uniqueUserIds.length === 0) {
      logger.info("No active users found for report generation");
      return NextResponse.json({
        success: true,
        message: "No active users",
        stats: { generated: 0, errors: 0, duration: Date.now() - startTime },
      });
    }

    logger.info(
      { userCount: uniqueUserIds.length, reportMonth },
      "Generating monthly reports for users",
    );

    // Generate reports for each user
    for (const userId of uniqueUserIds) {
      try {
        const report = await reportService.generateMonthlyReport(
          userId,
          reportMonth,
        );
        if (report) {
          generatedCount++;
        }
      } catch (error) {
        errorCount++;
        logger.error(
          { error, userId },
          "Failed to generate monthly report for user",
        );
      }
    }

    const duration = Date.now() - startTime;

    logger.info(
      { generatedCount, errorCount, duration, reportMonth },
      "Monthly reports generation cron job completed",
    );

    return NextResponse.json({
      success: true,
      stats: {
        generated: generatedCount,
        errors: errorCount,
        duration,
        reportMonth,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Monthly reports cron job failed",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Config: Allow longer execution time
export const maxDuration = 300; // 5 minutes
