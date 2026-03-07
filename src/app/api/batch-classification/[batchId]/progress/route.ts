/**
 * 批量分类 API - 获取进度
 *
 * GET /api/batch-classification/[batchId]/progress
 *
 * @module api/batch-classification/[batchId]/progress
 * @version 1.1.0
 * @since 2026-02-01
 * @updated 2026-02-02 - 代码质量：迁移 console.error 到 logger
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BatchClassificationCoordinator } from "@/lib/classification/services/batch-classification";
import { withAuthMiddleware } from "@/lib/api/middleware";

// ============================================
// API Handler
// ============================================

export const GET = withAuthMiddleware<{ batchId: string }>(
  async (_request, { params }) => {
    const { batchId } = await params;

    // 1. 验证 batchId
    if (!batchId) {
      return NextResponse.json({ error: "Missing batchId" }, { status: 400 });
    }

    // 2. 获取进度
    const supabase = await createClient();
    const coordinator = new BatchClassificationCoordinator(supabase);
    const progress = await coordinator.getProgress(batchId);

    // 3. 返回进度
    return NextResponse.json({
      success: true,
      ...progress,
    });
  },
);
