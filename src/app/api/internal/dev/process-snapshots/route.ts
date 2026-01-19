/**
 * DEV API: Process Snapshot Jobs
 * 开发环境专用 - 手动触发快照任务处理
 *
 * 仅在 development 环境可用
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import type { SnapshotJobPayload } from "@/lib/snapshot";
import {
  initSupabaseAdmin,
  getSupabaseAdmin,
} from "@/lib/supabase/admin-client";

// Only available in development
const isDev = process.env.NODE_ENV === "development";

const WORKER_ID = `dev-worker-${Date.now()}`;

/**
 * GET /api/dev/process-snapshots
 * 手动处理待执行的快照任务
 */
export async function GET() {
  // Security check: only in development
  if (!isDev) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 },
    );
  }

  try {
    initSupabaseAdmin();

    logger.info("[DEV] Starting snapshot job processor");

    const stats = {
      processed: 0,
      completed: 0,
      failed: 0,
    };

    // Process up to 10 jobs
    // 类型断言: 手动维护类型文件时需要此断言
    type ClaimedJobType = {
      job_id: string;
      job_type: string;
      job_payload: unknown;
      job_user_id: string;
      job_attempts: number;
    };
    for (let i = 0; i < 10; i++) {
      // Claim next snapshot job
       
      const { data: claimedJobs, error: claimError } = (await (
        getSupabaseAdmin().rpc as any
      )("claim_next_job", {
        p_worker_id: WORKER_ID,
        p_job_types: [
          "create_snapshot_basic",
          "create_snapshot_standard",
          "create_snapshot_full",
          "retry_failed_snapshot",
        ],
        p_lock_duration: "5 minutes",
      })) as {
        data: ClaimedJobType[] | null;
        error: { message: string } | null;
      };

      if (claimError) {
        logger.error({ error: claimError }, "[DEV] Failed to claim job");
        break;
      }

      if (!claimedJobs || claimedJobs.length === 0) {
        logger.info("[DEV] No more pending snapshot jobs");
        break;
      }

      const job = claimedJobs[0];
      stats.processed++;

      logger.info(
        { jobId: job.job_id, jobType: job.job_type },
        "[DEV] Processing snapshot job",
      );

      try {
        // Process based on job type
        const payload = job.job_payload as unknown as SnapshotJobPayload;

        if (
          job.job_type === "create_snapshot_basic" ||
          job.job_type === "retry_failed_snapshot"
        ) {
          const { processSnapshotJob } = await import(
            "@/lib/snapshot/processors"
          );
          await processSnapshotJob({
            id: job.job_id,
            type: job.job_type,
            payload,
            userId: job.job_user_id,
            attempts: job.job_attempts || 0,
          });
        } else if (
          job.job_type === "create_snapshot_standard" ||
          job.job_type === "create_snapshot_full"
        ) {
          const { processStandardSnapshot } = await import(
            "@/lib/snapshot/processors"
          );
          await processStandardSnapshot({
            id: job.job_id,
            type: job.job_type,
            payload,
            userId: job.job_user_id,
            attempts: job.job_attempts || 0,
          });
        }

        // Mark as completed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (getSupabaseAdmin().rpc as any)("complete_job", {
          p_job_id: job.job_id,
          p_result: { processedAt: new Date().toISOString() },
        });

        stats.completed++;

        logger.info(
          { jobId: job.job_id, snapshotId: payload.snapshot_id },
          "[DEV] Snapshot job completed",
        );
      } catch (error) {
        stats.failed++;

        // Mark as failed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (getSupabaseAdmin().rpc as any)("fail_job", {
          p_job_id: job.job_id,
          p_error: error instanceof Error ? error.message : String(error),
          p_retry: true,
        });

        logger.error({ error, jobId: job.job_id }, "[DEV] Snapshot job failed");
      }
    }

    logger.info({ stats }, "[DEV] Snapshot processor completed");

    return NextResponse.json({
      success: true,
      message: "Snapshot jobs processed",
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[DEV] Snapshot processor failed",
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/dev/process-snapshots
 * 处理指定的快照任务
 */
export async function POST(request: Request) {
  // Security check: only in development
  if (!isDev) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { snapshotId } = body;

    if (!snapshotId) {
      return NextResponse.json(
        { error: "snapshotId is required" },
        { status: 400 },
      );
    }

    initSupabaseAdmin();

    // Get snapshot info
    const { data: snapshot, error: snapshotError } = await getSupabaseAdmin()
      .from("bookmark_snapshots" as never)
      .select("*")
      .eq("id", snapshotId)
      .single();

    if (snapshotError || !snapshot) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshotData = snapshot as any;

    logger.info(
      { snapshotId, status: snapshotData.status },
      "[DEV] Processing specific snapshot",
    );

    // Build payload
    const payload: SnapshotJobPayload = {
      bookmark_id: snapshotData.bookmark_id,
      snapshot_id: snapshotData.id,
      url: snapshotData.original_url,
      snapshot_type: snapshotData.snapshot_type,
      user_id: snapshotData.user_id,
    };

    // Process
    const { processSnapshotJob } = await import("@/lib/snapshot/processors");
    const result = await processSnapshotJob({
      id: `dev-${Date.now()}`,
      type: `create_snapshot_${snapshotData.snapshot_type}`,
      payload,
      userId: snapshotData.user_id,
      attempts: 0,
    });

    return NextResponse.json({
      success: result.success,
      snapshotId,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[DEV] Specific snapshot processing failed",
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 },
    );
  }
}

// Config
export const maxDuration = 60; // 1 minute
