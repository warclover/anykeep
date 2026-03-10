/**
 * 批量分类 API - 获取结果
 *
 * GET /api/batch-classification/[batchId]/results
 *
 * @module api/batch-classification/[batchId]/results
 * @version 1.1.0
 * @since 2026-02-01
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BatchClassificationCoordinator } from "@/lib/batch-classification";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { badRequestError } from "@/lib/utils/api-response";

// ============================================
// API Handler
// ============================================

export const GET = withAuthMiddleware<{ batchId: string }>(
  async (_request, { params }) => {
    const { batchId } = await params;

    // 1. 验证 batchId
    if (!batchId) {
      return badRequestError("Missing batchId");
    }

    // 2. 获取结果
    const supabase = await createClient();
    const coordinator = new BatchClassificationCoordinator(supabase);
    const results = await coordinator.getResults(batchId);

    // 3. 返回结果
    return NextResponse.json({
      success: true,
      ...results,
    });
  },
);
