/**
 * Cron Job: Process Job Queue
 * Schedule: *\/30 * * * * (Every 30 minutes)
 *
 * Processes pending jobs from the job queue
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/supabase";
import { reportService } from "@/lib/classification/services/report.service";

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Use Service Role Key to bypass RLS
let supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

const initSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase credentials");
  }

  supabaseAdmin = createClient<Database>(url, serviceKey);
  return supabaseAdmin;
};

const getAdmin = () => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not initialized");
  }
  return supabaseAdmin;
};

// Worker ID for this cron instance
const WORKER_ID = `cron-worker-${Date.now()}`;

// Max jobs to process per run
const MAX_JOBS_PER_RUN = 20;

/**
 * GET /api/cron/process-job-queue
 * Process pending jobs from the queue
 */
export async function GET(request: Request) {
  try {
    // Verify environment variables
    if (!CRON_SECRET) {
      logger.error("CRON_SECRET environment variable is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    // Verify Cron request
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Initialize Supabase admin
    try {
      initSupabaseAdmin();
    } catch (error) {
      logger.error({ error }, "Failed to initialize Supabase admin");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    logger.info({ action: "cron_start" }, "Job queue processor started");

    const startTime = Date.now();
    const stats = {
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    };

    // Process jobs up to the limit
    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      // Claim next job
      const { data: claimedJobs, error: claimError } = await getAdmin().rpc(
        "claim_next_job",
        {
          p_worker_id: WORKER_ID,
          p_job_types: undefined, // Process all types
          p_lock_duration: "5 minutes",
        },
      );

      if (claimError) {
        logger.error({ error: claimError }, "Failed to claim job");
        break;
      }

      if (!claimedJobs || claimedJobs.length === 0) {
        // No more pending jobs
        break;
      }

      const job = claimedJobs[0];
      stats.processed++;

      try {
        // Process job based on type
        await processJob(job);

        // Mark as completed
        await getAdmin().rpc("complete_job", {
          p_job_id: job.job_id,
          p_result: { processedAt: new Date().toISOString() },
        });

        stats.completed++;

        logger.info(
          { jobId: job.job_id, jobType: job.job_type },
          "Job completed successfully",
        );
      } catch (error) {
        stats.failed++;

        // Mark as failed
        await getAdmin().rpc("fail_job", {
          p_job_id: job.job_id,
          p_error: error instanceof Error ? error.message : String(error),
          p_retry: true,
        });

        logger.error(
          { error, jobId: job.job_id, jobType: job.job_type },
          "Job processing failed",
        );
      }
    }

    // Also reset stuck jobs
    const { data: resetJobs } = await getAdmin()
      .from("job_queue")
      .update({
        status: "pending",
        lock_until: null,
        claimed_by: null,
      })
      .eq("status", "claimed")
      .lt("lock_until", new Date().toISOString())
      .select("id");

    const resetCount = resetJobs?.length ?? 0;
    if (resetCount > 0) {
      logger.info({ resetCount }, "Reset stuck jobs");
    }

    const duration = Date.now() - startTime;

    logger.info(
      { ...stats, resetCount, duration },
      "Job queue processor completed",
    );

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        resetCount,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Job queue processor failed",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Process a single job based on its type
 */
async function processJob(job: {
  job_id: string;
  job_type: string;
  job_payload: unknown;
  job_user_id: string;
}): Promise<void> {
  const payload = job.job_payload as Record<string, unknown>;

  switch (job.job_type) {
    case "generate_monthly_report": {
      const month = (payload.month as string) || undefined;
      await reportService.generateMonthlyReport(job.job_user_id, month);
      break;
    }

    case "update_folder_profiles": {
      // This is handled by the dedicated cron job
      logger.info("update_folder_profiles handled by dedicated cron");
      break;
    }

    case "process_inbox_cache": {
      // This is handled by smart-sorting cron
      logger.info("process_inbox_cache handled by smart-sorting cron");
      break;
    }

    case "check_rename_candidates":
    case "check_split_candidates":
    case "check_merge_candidates": {
      // These will be implemented in future phases
      logger.info(
        { jobType: job.job_type },
        "Job type scheduled for future implementation",
      );
      break;
    }

    case "cleanup_expired_data": {
      await cleanupExpiredData(job.job_user_id);
      break;
    }

    default:
      logger.warn({ jobType: job.job_type }, "Unknown job type");
  }
}

/**
 * Cleanup expired data for a user
 */
async function cleanupExpiredData(userId: string): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days

  // Cleanup expired suggestions
  await getAdmin()
    .from("classification_suggestions")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("status", "pending")
    .lt("created_at", cutoffDate.toISOString());

  // Cleanup expired operation snapshots
  await getAdmin()
    .from("operation_snapshots")
    .delete()
    .eq("user_id", userId)
    .lt("expires_at", new Date().toISOString());

  logger.info({ userId }, "Cleaned up expired data");
}

// Config: Allow longer execution time
export const maxDuration = 300; // 5 minutes
