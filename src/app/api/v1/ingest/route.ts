/**
 * Unified Ingestion API v1
 *
 * POST /api/v1/ingest       - 单条摄入
 * POST /api/v1/ingest/batch - 批量摄入
 *
 * 统一入口，所有数据源（网页、API、浏览器导入、移动端）走此 API
 *
 * @module api/v1/ingest
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IngestionService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { IngestionRequestSchema } from "@/contracts";

/**
 * POST /api/v1/ingest
 *
 * 单条摄入
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await validateBody(request, IngestionRequestSchema);

  const supabase = await createClient();
  const service = new IngestionService(supabase, userId);
  const result = await service.ingest(body);

  // 返回适当的状态码
  const status = result.status === "duplicate" ? 409 : 201;

  return NextResponse.json(
    {
      success: result.status === "created" || result.status === "queued",
      data: result,
    },
    { status },
  );
});
