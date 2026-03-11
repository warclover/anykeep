/**
 * Cron Job: Process Job Queue
 * Schedule: *\/30 * * * * (Every 30 minutes)
 *
 * Processes pending jobs from the job queue
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import type { SnapshotJobPayload } from "@/lib/snapshot";
import type { Json } from "@/types/supabase";
import {
  initSupabaseAdmin,
  getSupabaseAdmin,
} from "@/lib/supabase/admin-client";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

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
    // Verify internal request using unified auth
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
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

    // Extended database type for RPC calls
    // We only need to define functions that are not in the generated types or need overrides
    type ExtendedDatabase = Database & {
      public: {
        Functions: {
          claim_next_job: {
            Args: {
              p_worker_id: string;
              p_job_types?: string[];
              p_lock_duration: string;
            };
            Returns: ClaimedJobType[];
          };
          complete_job: {
            Args: {
              p_job_id: string;
              p_result: Json;
              p_success: boolean;
            };
            Returns: void;
          };
          fail_job: {
            Args: {
              p_job_id: string;
              p_error: string;
              p_retry: boolean;
            };
            Returns: void;
          };
        };
      };
    };

    const getTypedAdmin = () =>
      getSupabaseAdmin() as SupabaseClient<ExtendedDatabase>;

    // Process jobs up to the limit
    type ClaimedJobType = {
      job_id: string;
      job_type: string;
      job_payload: Json;
      job_user_id: string;
      job_attempts: number;
    };
    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      // Claim next job

      const { data: claimedJobs, error: claimError } =
        await getTypedAdmin().rpc("claim_next_job", {
          p_worker_id: WORKER_ID,
          p_job_types: undefined, // Process all types
          p_lock_duration: "5 minutes",
        });

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (getTypedAdmin().rpc as any)("complete_job", {
          p_job_id: job.job_id,
          p_result: { processedAt: new Date().toISOString() },
          p_success: true,
        });

        stats.completed++;

        logger.info(
          { jobId: job.job_id, jobType: job.job_type },
          "Job completed successfully",
        );
      } catch (error) {
        stats.failed++;

        // Mark as failed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (getTypedAdmin().rpc as any)("fail_job", {
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

    const { data: resetJobs } = await getTypedAdmin()
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
  job_payload: Json;
  job_user_id: string;
}): Promise<void> {
  const payload = job.job_payload as Record<string, unknown>;

  switch (job.job_type) {
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

    case "cleanup_expired_data": {
      await cleanupExpiredData(job.job_user_id);
      break;
    }

    // === 快照任务处理 (V4.2.1) ===
    case "create_snapshot_basic": {
      // Basic 快照：仅 Readability 正文
      const { processSnapshotJob } = await import("@/lib/snapshot/processors");

      if (!isValidSnapshotJobPayload(payload)) {
        logger.error(
          { jobId: job.job_id, payload },
          "Invalid snapshot payload",
        );
        throw new Error("Invalid snapshot payload");
      }

      await processSnapshotJob({
        id: job.job_id,
        type: job.job_type,
        payload: payload,
        userId: job.job_user_id,
        attempts: (payload.retry_count as number) || 0,
      });
      break;
    }

    case "create_snapshot_standard": {
      // Standard 快照：完整 HTML + CSS 内联（Pro）
      const { processStandardSnapshot } = await import(
        "@/lib/snapshot/processors"
      );

      if (!isValidSnapshotJobPayload(payload)) {
        logger.error(
          { jobId: job.job_id, payload },
          "Invalid snapshot payload",
        );
        throw new Error("Invalid snapshot payload");
      }

      await processStandardSnapshot({
        id: job.job_id,
        type: job.job_type,
        payload: payload,
        userId: job.job_user_id,
        attempts: (payload.retry_count as number) || 0,
      });
      break;
    }

    case "create_snapshot_full": {
      // Full 快照：含截图（Phase 3 实现）
      logger.info(
        { jobId: job.job_id },
        "[Cron] Full snapshot scheduled for Phase 3",
      );
      // 暂时回退到 Standard 处理
      const { processStandardSnapshot: processFull } = await import(
        "@/lib/snapshot/processors"
      );

      if (!isValidSnapshotJobPayload(payload)) {
        logger.error(
          { jobId: job.job_id, payload },
          "Invalid snapshot payload",
        );
        throw new Error("Invalid snapshot payload");
      }

      await processFull({
        id: job.job_id,
        type: job.job_type,
        payload: payload,
        userId: job.job_user_id,
        attempts: (payload.retry_count as number) || 0,
      });
      break;
    }

    case "retry_failed_snapshot": {
      const { processRetrySnapshot } = await import(
        "@/lib/snapshot/processors"
      );

      if (!isValidSnapshotJobPayload(payload)) {
        logger.error(
          { jobId: job.job_id, payload },
          "Invalid snapshot payload",
        );
        throw new Error("Invalid snapshot payload");
      }

      await processRetrySnapshot({
        id: job.job_id,
        type: job.job_type,
        payload: payload,
        userId: job.job_user_id,
        attempts: (payload.retry_count as number) || 0,
      });
      break;
    }

    case "cleanup_expired_snapshots": {
      const { processCleanupSnapshots } = await import(
        "@/lib/snapshot/processors"
      );

      const cleanupPayload = payload as {
        days_old?: number;
        batch_size?: number;
      };

      await processCleanupSnapshots({
        id: job.job_id,
        type: job.job_type,
        payload: cleanupPayload,
        userId: job.job_user_id,
        attempts: 0,
      });
      break;
    }

    default:
      logger.warn({ jobType: job.job_type }, "Unknown job type");
  }
}

/**
 * Type guard for SnapshotJobPayload
 */
function isValidSnapshotJobPayload(
  payload: unknown,
): payload is SnapshotJobPayload {
  if (typeof payload !== "object" || payload === null) return false;

  const p = payload as Record<string, unknown>;

  // Required fields
  return (
    typeof p.bookmark_id === "number" &&
    typeof p.snapshot_id === "number" &&
    typeof p.url === "string" &&
    typeof p.snapshot_type === "string" &&
    typeof p.user_id === "string"
  );
}

/**
 * Cleanup expired data for a user
 */
async function cleanupExpiredData(userId: string): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days

  // Cleanup expired suggestions - use any to bypass strict typing
  const admin = getSupabaseAdmin();

  await admin
    .from("classification_suggestions")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("status", "pending")
    .lt("created_at", cutoffDate.toISOString());

  // Cleanup expired operation snapshots
  await admin
    .from("operation_snapshots")
    .delete()
    .eq("user_id", userId)
    .lt("expires_at", new Date().toISOString());

  logger.info({ userId }, "Cleaned up expired data");
}

// Config: Allow longer execution time
export const maxDuration = 300; // 5 minutes
