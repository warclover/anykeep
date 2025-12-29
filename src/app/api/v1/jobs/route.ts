/**
 * Jobs API v1
 *
 * GET /api/v1/jobs - 获取用户的任务列表
 * POST /api/v1/jobs - 创建新任务
 *
 * @module api/v1/jobs
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TaskProducer, type JobPriority, type JobType } from "@/services/jobs";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";

/**
 * 创建任务请求 Schema
 */
const CreateJobSchema = z.object({
  type: z.enum([
    "fetch_metadata",
    "generate_embedding",
    "auto_classify",
    "deep_crawl",
    "cleanup_trash",
    "validate_links",
    "profile_update",
    "batch_import",
    "send_notification",
  ]),
  payload: z.record(z.string(), z.unknown()),
  priority: z.number().int().min(1).max(100).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  bookmarkId: z.number().int().positive().optional(),
  scheduledFor: z.string().datetime().optional(),
  dependsOn: z.string().uuid().optional(),
});

/**
 * GET /api/v1/jobs
 *
 * 获取用户的任务列表
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
  );
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

  const supabase = await createClient();
  const producer = new TaskProducer(supabase);

  const { jobs, total } = await producer.getUserJobs(userId, {
    status: status?.split(",").filter(Boolean),
    type: type?.split(",").filter(Boolean) as JobType[] | undefined,
    limit,
    offset,
  });

  return NextResponse.json({
    success: true,
    data: {
      items: jobs,
      total,
      limit,
      offset,
    },
  });
});

/**
 * POST /api/v1/jobs
 *
 * 创建新任务
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await validateBody(request, CreateJobSchema);

  const supabase = await createClient();
  const producer = new TaskProducer(supabase);

  const job = await producer.createJob({
    type: body.type,
    userId,
    payload: body.payload,
    priority: body.priority as JobPriority | undefined,
    maxRetries: body.maxRetries,
    bookmarkId: body.bookmarkId,
    scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    dependsOn: body.dependsOn,
  });

  return NextResponse.json(
    {
      success: true,
      data: job,
    },
    { status: 201 },
  );
});
