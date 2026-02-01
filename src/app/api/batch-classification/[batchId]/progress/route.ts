/**
 * 批量分类 API - 获取进度
 *
 * GET /api/batch-classification/[batchId]/progress
 *
 * @module api/batch-classification/[batchId]/progress
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BatchClassificationCoordinator } from "@/lib/classification/services/batch-classification";

// ============================================
// API Handler
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const { batchId } = await params;

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 验证 batchId
    if (!batchId) {
      return NextResponse.json({ error: "Missing batchId" }, { status: 400 });
    }

    // 3. 获取进度
    const coordinator = new BatchClassificationCoordinator(supabase);
    const progress = await coordinator.getProgress(batchId);

    // 4. 返回进度
    return NextResponse.json({
      success: true,
      ...progress,
    });
  } catch (error) {
    console.error("Failed to get progress:", error);

    if (error instanceof Error && error.message === "Progress not found") {
      return NextResponse.json(
        { error: "Progress not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
