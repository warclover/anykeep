/**
 * 批量分类 API - 启动分类
 *
 * POST /api/batch-classification/start
 *
 * @module api/batch-classification/start
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BatchClassificationCoordinator } from "@/lib/classification/services/batch-classification";
import type { StartClassificationRequest } from "@/lib/classification/services/batch-classification";

// ============================================
// 请求验证
// ============================================

interface RequestBody {
  importSessionId?: string;
  batchId?: string;
  bookmarkIds?: number[];
  structureMode?: "preserve" | "hybrid" | "rebuild" | "auto";
  options?: {
    autoApplyHighConfidence?: boolean;
    preserveOriginalStructure?: boolean;
  };
}

function validateRequest(body: unknown): RequestBody {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const { importSessionId, batchId, bookmarkIds, structureMode, options } = body as RequestBody;

  // 至少需要一个标识
  if (!importSessionId && !batchId && (!bookmarkIds || bookmarkIds.length === 0)) {
    throw new Error("Must provide importSessionId, batchId, or bookmarkIds");
  }

  // 验证 structureMode
  if (structureMode && !["preserve", "hybrid", "rebuild", "auto"].includes(structureMode)) {
    throw new Error("Invalid structureMode");
  }

  return { importSessionId, batchId, bookmarkIds, structureMode, options };
}

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const validatedBody = validateRequest(body);

    // 3. 创建协调器并启动分类
    const coordinator = new BatchClassificationCoordinator(supabase);

    const classificationRequest: StartClassificationRequest = {
      importSessionId: validatedBody.importSessionId,
      batchId: validatedBody.batchId,
      bookmarkIds: validatedBody.bookmarkIds,
      structureMode: validatedBody.structureMode,
      options: validatedBody.options,
    };

    const transactionId = await coordinator.startClassification(
      classificationRequest,
      user.id
    );

    // 4. 返回事务 ID
    return NextResponse.json({
      success: true,
      transactionId,
      message: "Classification started",
    });
  } catch (error) {
    console.error("Failed to start classification:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
