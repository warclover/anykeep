/**
 * 批量分类 API - 获取结果
 *
 * GET /api/batch-classification/[batchId]/results
 *
 * @module api/batch-classification/[batchId]/results
 * @version 1.0.0
 * @since 2026-02-01
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BatchClassificationCoordinator } from "@/lib/classification/services/batch-classification";

// ============================================
// API Handler
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    // 1. 验证用户身份
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. 验证 batchId
    if (!batchId) {
      return NextResponse.json(
        { error: "Missing batchId" },
        { status: 400 }
      );
    }

    // 3. 获取结果
    const coordinator = new BatchClassificationCoordinator(supabase);
    const results = await coordinator.getResults(batchId);

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Failed to get results:", error);

    if (error instanceof Error && error.message === "Transaction not found") {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
