import { NextResponse } from "next/server";
import { initSupabaseAdmin } from "@/lib/supabase/admin-client";
import { logger } from "@/lib/logger";
import { ledgerService } from "@/lib/ledger/services/ledger.service";
import pLimit from "p-limit";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

// Use Service Role Key to bypass RLS
const supabaseAdmin = initSupabaseAdmin();

export const maxDuration = 300; // 5 minutes

/**
 * GET /api/internal/cron/generate-monthly-ledger
 * Generate monthly ledger reports for all active users
 * Schedule: Every 1st of month at 06:00
 */
export async function GET(request: Request) {
  try {
    // Verify internal request using unified auth
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    logger.info("Starting monthly ledger generation cron job");

    const startTime = Date.now();
    let generatedCount = 0;
    let errorCount = 0;

    // Fix: Fetch profiles instead of bookmarks to ensure we check all users
    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .limit(1000);

    if (fetchError) {
      logger.error({ error: fetchError }, "Failed to fetch users");
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    const userIds = profiles.map((p) => p.id);

    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users found",
        stats: { generated: 0, errors: 0, duration: Date.now() - startTime },
      });
    }

    logger.info(
      { userCount: userIds.length },
      "Generating monthly ledgers for users",
    );

    // Fix: Use concurrency control with p-limit to avoid timeout
    const limit = pLimit(10); // Process 10 users concurrently

    const tasks = userIds.map((userId) =>
      limit(async () => {
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
      }),
    );

    await Promise.all(tasks);

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
