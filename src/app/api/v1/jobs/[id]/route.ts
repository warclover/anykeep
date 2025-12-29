/**
 * Job Detail API v1
 *
 * GET /api/v1/jobs/:id - 获取任务详情
 * DELETE /api/v1/jobs/:id - 取消任务
 *
 * @module api/v1/jobs/[id]
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TaskProducer } from "@/services/jobs";
import { withAuthMiddleware } from "@/lib/api/middleware";

interface RouteParams {
  id: string;
}

/**
 * GET /api/v1/jobs/:id
 *
 * 获取任务详情
 */
export const GET = withAuthMiddleware<RouteParams>(
  async (_request, { userId, params }) => {
    const { id } = await params;

    const supabase = await createClient();
    const producer = new TaskProducer(supabase);

    const job = await producer.getJobStatus(id);

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Job not found" },
        },
        { status: 404 },
      );
    }

    // 验证任务属于当前用户
    if (job.userId !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Access denied" },
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  },
);

/**
 * DELETE /api/v1/jobs/:id
 *
 * 取消任务（仅限 pending 状态）
 */
export const DELETE = withAuthMiddleware<RouteParams>(
  async (_request, { userId, params }) => {
    const { id } = await params;

    const supabase = await createClient();
    const producer = new TaskProducer(supabase);

    const cancelled = await producer.cancelJob(id, userId);

    if (!cancelled) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CANCEL_FAILED",
            message:
              "Cannot cancel job. It may not exist, not belong to you, or already be processed.",
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { cancelled: true },
    });
  },
);
