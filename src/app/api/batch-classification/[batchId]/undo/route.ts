/**
 * 批量分类 API - 撤销分类
 *
 * POST /api/batch-classification/[batchId]/undo
 *
 * @module api/batch-classification/[batchId]/undo
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

export const POST = withAuthMiddleware<{ batchId: string }>(
  async (_request, { userId, params }) => {
    const { batchId } = await params;

    // 1. 验证 batchId
    if (!batchId) {
      return badRequestError("Missing batchId");
    }

    // 2. 执行撤销
    const supabase = await createClient();
    const coordinator = new BatchClassificationCoordinator(supabase);
    const result = await coordinator.undoClassification(batchId, userId);

    // 3. 返回结果
    return NextResponse.json({
      success: true,
      message: "Classification undone",
      ...result,
    });
  },
);
