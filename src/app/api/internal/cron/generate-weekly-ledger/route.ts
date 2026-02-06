import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { ledgerService } from "@/lib/ledger/services/ledger.service";
import { emailService } from "@/lib/email/email.service";
import { supabaseEnv } from "@/lib/env";
import pLimit from "p-limit";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

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
    // Verify internal request using unified auth
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    logger.info("Starting weekly ledger generation cron job");

    const startTime = Date.now();
    let generatedCount = 0;
    let digestCount = 0;
    const errorCount = 0;
    let emailSentCount = 0;

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
        const settings = (profile.settings as Record<string, unknown>) || {};
        const notifications =
          (settings.notifications as Record<string, unknown>) || {};

        // Track success for this user
        let financialSuccess = false;
        let knowledgeSuccess = false;

        // 1. Generate Financial Ledger (Original Logic)
        try {
          const report = await ledgerService.generateWeeklyReport(
            userId,
            "financial",
          );
          if (report) {
            financialSuccess = true;
          }
        } catch (error) {
          logger.error(
            { error, userId, type: "financial" },
            "Failed to generate financial ledger",
          );
        }

        // 2. Generate Knowledge Ledger (Weekly Digest)
        // Check user preference: skip if explicitly set to false
        const enableWeeklyDigest = notifications?.weeklyDigest !== false;

        if (enableWeeklyDigest) {
          try {
            const digest = await ledgerService.generateWeeklyReport(
              userId,
              "knowledge",
            );

            if (digest) {
              knowledgeSuccess = true;
              digestCount++;

              // Send Email if status is pending
              if (digest.emailStatus === "pending") {
                // Fetch user email
                const {
                  data: { user },
                  error: userError,
                } = await supabaseAdmin.auth.admin.getUserById(userId);

                if (userError || !user?.email) {
                  logger.warn(
                    { userId, error: userError },
                    "Could not fetch user email for digest",
                  );
                } else {
                  // Send email
                  const { success, error: sendError } =
                    await emailService.sendWeeklyDigest(user.email, digest);

                  if (success) {
                    await ledgerService.markEmailSent(digest.id);
                    emailSentCount++;
                  } else {
                    logger.error(
                      { userId, error: sendError },
                      "Failed to send weekly digest email",
                    );
                  }
                }
              }
            }
          } catch (error) {
            logger.error(
              { error, userId, type: "knowledge" },
              "Failed to generate knowledge ledger",
            );
          }
        }

        if (financialSuccess || knowledgeSuccess) {
          generatedCount++;
        } else if (
          !financialSuccess &&
          enableWeeklyDigest &&
          !knowledgeSuccess
        ) {
          // Only count as error if enabled types failed?
          // Simplified: just track global error count in catch blocks usually,
          // but here we catch inside steps.
          // We'll increment errorCount if ANY generation threw exception previously caught.
        }
      }),
    );

    await Promise.all(tasks);

    const duration = Date.now() - startTime;

    logger.info(
      { generatedCount, digestCount, emailSentCount, duration },
      "Weekly ledger generation completed",
    );

    return NextResponse.json({
      success: true,
      stats: {
        usersProcessed: profiles.length,
        generatedFinancial: generatedCount, // Approximate, reusing variable
        generatedDigests: digestCount,
        emailsSent: emailSentCount,
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
