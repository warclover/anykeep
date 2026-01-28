import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { ledgerService } from "@/lib/ledger/services/ledger.service";
import { supabaseEnv, appEnv } from "@/lib/env";
import pLimit from "p-limit";

// Cron secret for authentication
const CRON_SECRET = appEnv.cronSecret;

// Use Service Role Key to bypass RLS
const supabaseAdmin = createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey);

export const maxDuration = 300; // 5 minutes

/**
 * GET /api/internal/cron/generate-weekly-ledger
 * Generate weekly ledger reports for all active users
 * Schedule: Every Monday at 06:00
 */
export async function GET(request: Request) {
  try {
    // Verify Cron request
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("Starting weekly ledger generation cron job");

    const startTime = Date.now();
    let generatedCount = 0;
    let errorCount = 0;

    // Fix: Fetch profiles instead of bookmarks to ensure we check all users
    // Using profiles is safer than bookmarks as bookmarks query limit could exclude valid users
    // Start with 1000 users limit for MVP safety
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
      "Generating weekly ledgers for users",
    );

    // Fix: Use concurrency control with p-limit to avoid timeout
    const limit = pLimit(10); // Process 10 users concurrently

    const tasks = userIds.map((userId) =>
      limit(async () => {
        try {
          const report = await ledgerService.generateWeeklyReport(userId);
          if (report) {
            generatedCount++;
          }
        } catch (error) {
          errorCount++;
          logger.error(
            { error, userId },
            "Failed to generate weekly ledger for user",
          );
        }
      }),
    );

    await Promise.all(tasks);

    const duration = Date.now() - startTime;

    logger.info(
      { generatedCount, errorCount, duration },
      "Weekly ledger generation completed",
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
      "Weekly ledger cron job failed",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
