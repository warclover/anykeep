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
 * GET /api/internal/cron/generate-weekly-ledger
 * Generate weekly ledger reports for all active users
 * Schedule: Every Monday at 06:00
 */
export async function GET(request: Request) {
  try {
    // Verify internal request using unified auth
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    logger.info("Starting weekly ledger generation cron job");

    const startTime = Date.now();
    let generatedCount = 0;
    const errorCount = 0;

    // Fetch profiles with settings to check preferences
    // Start with 1000 users limit for MVP safety
    const { data: profiles, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, settings")
      .limit(1000);

    if (fetchError) {
      logger.error({ error: fetchError }, "Failed to fetch users");
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users found",
        stats: { generated: 0, errors: 0, duration: Date.now() - startTime },
      });
    }

    logger.info(
      { userCount: profiles.length },
      "Generating weekly ledgers for users",
    );

    // Use concurrency control with p-limit to avoid timeout
    const limit = pLimit(10); // Process 10 users concurrently

    const tasks = profiles.map((profile) =>
      limit(async () => {
        const userId = profile.id;

        // Generate Financial Ledger
        try {
          const report = await ledgerService.generateWeeklyReport(
            userId,
            "financial",
          );
          if (report) {
            generatedCount++;
          }
        } catch (error) {
          logger.error(
            { error, userId, type: "financial" },
            "Failed to generate financial ledger",
          );
        }
      }),
    );

    await Promise.all(tasks);

    const duration = Date.now() - startTime;

    logger.info(
      { generatedCount, duration },
      "Weekly ledger generation completed",
    );

    return NextResponse.json({
      success: true,
      stats: {
        usersProcessed: profiles.length,
        generatedFinancial: generatedCount,
        errors: errorCount,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Weekly ledger cron job failed",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
