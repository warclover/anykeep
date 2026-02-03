/**
 * 批量分类 API - 确认分类
 *
 * POST /api/batch-classification/[batchId]/confirm
 *
 * @module api/batch-classification/[batchId]/confirm
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BatchClassificationCoordinator } from "@/lib/classification/services/batch-classification";
import type { UserDecision } from "@/lib/classification/services/batch-classification";

// ============================================
// 请求验证
// ============================================

interface RequestBody {
  decisions: UserDecision[];
}

function validateRequest(body: unknown): RequestBody {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const { decisions } = body as RequestBody;

  if (!Array.isArray(decisions)) {
    throw new Error("decisions must be an array");
  }

  for (const decision of decisions) {
    if (!decision.clusterId || typeof decision.clusterId !== "string") {
      throw new Error("Each decision must have a valid clusterId");
    }

    if (!["accept", "reject", "modify"].includes(decision.action)) {
      throw new Error(
        "Each decision must have a valid action (accept, reject, modify)",
      );
    }

    if (
      decision.action === "modify" &&
      !decision.targetFolderId &&
      !decision.customName
    ) {
      throw new Error("Modify action requires targetFolderId or customName");
    }
  }

  return { decisions };
}

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

    // 3. 解析请求体
    const body = await request.json();
    const { decisions } = validateRequest(body);

    // 4. 确认分类
    const coordinator = new BatchClassificationCoordinator(supabase);
    await coordinator.confirmResults(batchId, decisions, user.id);

    // 5. 返回成功
    return NextResponse.json({
      success: true,
      message: "Classification confirmed",
      confirmedCount: decisions.filter(
        (d) => d.action === "accept" || d.action === "modify",
      ).length,
      rejectedCount: decisions.filter((d) => d.action === "reject").length,
    });
  } catch (error) {
    console.error("Failed to confirm classification:", error);

    if (error instanceof Error && error.message === "Transaction not found") {
      return NextResponse.json(
        { error: "Transaction not found" },
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
