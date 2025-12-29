/**
 * Batch Ingestion API v1
 *
 * POST /api/v1/ingest/batch - 批量摄入
 *
 * @module api/v1/ingest/batch
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IngestionService } from "@/services";
import { withAuthMiddleware, validateBody } from "@/lib/api/middleware";
import { BatchIngestionRequestSchema } from "@/contracts";

/**
 * POST /api/v1/ingest/batch
 *
 * 批量摄入书签
 *
 * 用于：
 * - 浏览器书签导入
 * - 批量 API 导入
 * - 移动端批量分享
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const body = await validateBody(request, BatchIngestionRequestSchema);

  const supabase = await createClient();
  const service = new IngestionService(supabase, userId);

  const result = await service.batchIngest(body.items, {
    batchSize: body.batchSize,
    skipDuplicates: body.skipDuplicates,
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        summary: {
          total: result.total,
          created: result.created,
          duplicates: result.duplicates,
          queued: result.queued,
          errors: result.errors.length,
        },
        errors: result.errors,
      },
    },
    {
      status: result.errors.length > 0 ? 207 : 201, // 207 Multi-Status
    },
  );
});
