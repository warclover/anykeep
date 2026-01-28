import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { ledgerService } from "@/lib/ledger/services/ledger.service";
import { supabaseEnv, appEnv } from "@/lib/env";

// Cron secret for authentication
const CRON_SECRET = appEnv.cronSecret;

// Use Service Role Key to bypass RLS
const supabaseAdmin = createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey);

export const maxDuration = 300; // 5 minutes

/**
 * GET /api/internal/cron/generate-monthly-ledger
 * Generate monthly ledger reports for all active users
 * Schedule: Every 1st of month at 06:00
 */
export async function GET(request: Request) {
  try {
    // Verify Cron request
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("Starting monthly ledger generation cron job");

    const startTime = Date.now();
    let generatedCount = 0;
    let errorCount = 0;

    // Get all active users
    const { data: activeUsers, error: fetchError } = await supabaseAdmin
      .from("bookmarks")
      .select("user_id")
      .is("deleted_at", null)
      .limit(10000);

    if (fetchError) {
      logger.error({ error: fetchError }, "Failed to fetch active users");
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    const uniqueUserIds = [
      ...new Set((activeUsers || []).map((row) => row.user_id as string)),
    ];

    if (uniqueUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active users",
        stats: { generated: 0, errors: 0, duration: Date.now() - startTime },
      });
    }

    logger.info(
      { userCount: uniqueUserIds.length },
      "Generating monthly ledgers for users",
    );

    for (const userId of uniqueUserIds) {
      try {
        const report = await ledgerService.generateMonthlyReport(userId);
        if (report) {
          generatedCount++;
        }
      } catch (error) {
        errorCount++;
        logger.error(
          { error, userId },
          "Failed to generate monthly ledger for user",
        );
      }
    }

    const duration = Date.now() - startTime;

    logger.info(
      { generatedCount, errorCount, duration },
      "Monthly ledger generation completed",
    );

    return NextResponse.json({
      success: true,
      stats: {
        generated: generatedCount,
        errors: errorCount,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Monthly ledger cron job failed",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
