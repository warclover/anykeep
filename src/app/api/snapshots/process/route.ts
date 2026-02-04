/**
 * API: Manual Snapshot Processing (V4.2.8)
 * 用户手动触发快照处理 - 立即处理指定的待处理快照
 *
 * 功能：
 * - 处理用户自己的待处理快照
 * - 仅处理 pending 状态的快照
 * - 支持处理单个快照或用户所有待处理快照
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { SnapshotJobPayload } from "@/lib/snapshot";
import {
  initSupabaseAdmin,
  getSupabaseAdmin,
} from "@/lib/supabase/admin-client";

const WORKER_ID = `manual-worker-${Date.now()}`;

/**
 * POST /api/snapshots/process
 * 手动触发快照处理
 *
 * Body:
 * - snapshotId?: number - 指定快照 ID（可选，不传则处理用户所有待处理快照）
 */
export async function POST(request: Request) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 解析请求
    let body: { snapshotId?: number } = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const { snapshotId } = body;

    // 3. 初始化 Admin 客户端
    initSupabaseAdmin();

    logger.info(
      { userId: user.id, snapshotId },
      "[ManualProcess] Starting manual snapshot processing",
    );

    const stats = {
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    };

    // 4. 查找待处理的快照任务
    // 注意：job_queue 表的字段是 "type"，不是 "job_type"
    // 类型断言: 手动维护类型文件时需要此断言
    type JobQueueRow = {
      id: number;
      user_id: string;
      type: string;
      status: string;
      payload: Record<string, unknown>;
      created_at: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobsQuery = (getSupabaseAdmin().from("job_queue") as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .in("type", [
        "create_snapshot_basic",
        "create_snapshot_standard",
        "create_snapshot_full",
        "retry_failed_snapshot",
      ])
      .order("created_at", { ascending: true })
      .limit(5); // 最多处理 5 个

    // 如果指定了 snapshotId，进一步过滤
    if (snapshotId) {
      // 需要通过 payload 中的 snapshot_id 过滤
      // 由于 JSONB 过滤较复杂，先获取所有然后在内存中过滤
    }

    const { data: pendingJobs, error: jobsError } = (await jobsQuery) as {
      data: JobQueueRow[] | null;
      error: { message: string } | null;
    };

    if (jobsError) {
      logger.error(
        { error: jobsError },
        "[ManualProcess] Failed to query jobs",
      );
      return NextResponse.json(
        { error: "Failed to query pending jobs" },
        { status: 500 },
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending snapshot jobs found",
        stats,
        timestamp: new Date().toISOString(),
      });
    }

    // 5. 如果指定了 snapshotId，过滤出对应的任务
    let jobsToProcess = pendingJobs;
    if (snapshotId) {
      jobsToProcess = pendingJobs.filter((job) => {
        const payload = job.payload as unknown as SnapshotJobPayload;
        return payload?.snapshot_id === snapshotId;
      });

      if (jobsToProcess.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No pending job found for this snapshot",
          stats,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 6. 处理每个任务
    // 类型断言: 手动维护类型文件时需要此断言
    type ClaimedJobRow = {
      job_id: number;
      job_type: string;
      job_payload: Record<string, unknown>;
      job_user_id: string;
    };
    for (const job of jobsToProcess) {
      try {
        // 尝试认领任务
        // 注意：job 对象中的字段是 "type"，不是 "job_type"
        const { data: claimedJobs, error: claimError } = (await (
          getSupabaseAdmin().rpc as any
        )(
          // eslint-disable-line @typescript-eslint/no-explicit-any
          "claim_next_job",
          {
            p_worker_id: WORKER_ID,
            p_job_types: [job.type],
            p_lock_duration: "2 minutes",
          },
        )) as {
          data: ClaimedJobRow[] | null;
          error: { message: string } | null;
        };

        if (claimError || !claimedJobs || claimedJobs.length === 0) {
          // 任务可能已被其他 worker 处理
          stats.skipped++;
          continue;
        }

        const claimedJob = claimedJobs[0];
        stats.processed++;

        logger.info(
          { jobId: claimedJob.job_id, jobType: claimedJob.job_type },
          "[ManualProcess] Processing snapshot job",
        );

        // 处理任务
        const payload = claimedJob.job_payload as unknown as SnapshotJobPayload;

        if (
          claimedJob.job_type === "create_snapshot_basic" ||
          claimedJob.job_type === "retry_failed_snapshot"
        ) {
          const { processSnapshotJob } = await import(
            "@/lib/snapshot/processors"
          );
          await processSnapshotJob({
            id: String(claimedJob.job_id),
            type: claimedJob.job_type,
            payload,
            userId: claimedJob.job_user_id,
            attempts: (payload.retry_count as number) || 0,
          });
        } else if (
          claimedJob.job_type === "create_snapshot_standard" ||
          claimedJob.job_type === "create_snapshot_full"
        ) {
          const { processStandardSnapshot } = await import(
            "@/lib/snapshot/processors"
          );
          await processStandardSnapshot({
            id: String(claimedJob.job_id),
            type: claimedJob.job_type,
            payload,
            userId: claimedJob.job_user_id,
            attempts: (payload.retry_count as number) || 0,
          });
        }

        // 标记完成
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (getSupabaseAdmin().rpc as any)("complete_job", {
          p_job_id: claimedJob.job_id,
          p_result: {
            processedAt: new Date().toISOString(),
            processedBy: "manual",
          },
        });

        stats.completed++;

        logger.info(
          { jobId: claimedJob.job_id, snapshotId: payload.snapshot_id },
          "[ManualProcess] Snapshot job completed",
        );
      } catch (error) {
        stats.failed++;

        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          "[ManualProcess] Snapshot job failed",
        );

        // 标记失败
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (getSupabaseAdmin().rpc as any)("fail_job", {
          p_job_id: job.id,
          p_error: error instanceof Error ? error.message : String(error),
          p_retry: true,
        });
      }
    }

    logger.info({ stats }, "[ManualProcess] Manual processing completed");

    return NextResponse.json({
      success: true,
      message:
        stats.completed > 0
          ? `Successfully processed ${stats.completed} snapshot(s)`
          : "No snapshots were processed",
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[ManualProcess] Manual processing failed",
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 },
    );
  }
}

// Config
export const maxDuration = 60; // 1 minute
