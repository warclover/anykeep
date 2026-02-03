/**
 * 批量分类 API - 撤销分类
 *
 * POST /api/batch-classification/[batchId]/undo
 *
 * @module api/batch-classification/[batchId]/undo
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

export async function POST(
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

    // 3. 执行撤销
    const coordinator = new BatchClassificationCoordinator(supabase);
    const result = await coordinator.undoClassification(batchId, user.id);

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      message: "Classification undone",
      ...result,
    });
  } catch (error) {
    console.error("Failed to undo classification:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    if (errorMessage === "Transaction not found") {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    if (
      errorMessage === "Undo not available" ||
      errorMessage === "Undo deadline passed"
    ) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
