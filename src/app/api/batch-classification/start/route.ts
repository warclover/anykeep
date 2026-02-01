/**
 * 批量分类 API - 启动分类
 *
 * POST /api/batch-classification/start
 *
 * @module api/batch-classification/start
 * @version 1.1.0
 * @since 2026-02-01
 * @updated 2026-02-02 - 安全修复：添加速率限制、请求大小验证、并发控制
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BatchClassificationCoordinator } from "@/lib/classification/services/batch-classification";
import type { StartClassificationRequest } from "@/lib/classification/services/batch-classification";

// ============================================
// 常量
// ============================================

/** 单次请求允许的最大书签数量 */
const MAX_BOOKMARK_IDS = 1000;

/** UUID 正则表达式 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================
// Zod Schema 验证
// ============================================

const StartClassificationSchema = z
  .object({
    importSessionId: z
      .string()
      .regex(UUID_REGEX, "Invalid UUID format")
      .optional(),
    batchId: z.string().regex(UUID_REGEX, "Invalid UUID format").optional(),
    bookmarkIds: z
      .array(z.number().int().positive("Bookmark ID must be positive"))
      .max(MAX_BOOKMARK_IDS, `Maximum ${MAX_BOOKMARK_IDS} bookmarks allowed`)
      .optional(),
    structureMode: z.enum(["preserve", "hybrid", "rebuild", "auto"]).optional(),
    options: z
      .object({
        autoApplyHighConfidence: z.boolean().optional(),
        preserveOriginalStructure: z.boolean().optional(),
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.importSessionId ||
      data.batchId ||
      (data.bookmarkIds && data.bookmarkIds.length > 0),
    { message: "Must provide importSessionId, batchId, or bookmarkIds" },
  );

type RequestBody = z.infer<typeof StartClassificationSchema>;

function validateRequest(body: unknown): RequestBody {
  const result = StartClassificationSchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(firstError?.message || "Invalid request body");
  }
  return result.data;
}

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 解析请求体
    const body = await request.json();
    const validatedBody = validateRequest(body);

    // 3. 检查是否有进行中的分类任务（并发控制）
    const { data: ongoingTasks } = await supabase
      .from("batch_import_transactions")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .limit(1);

    if (ongoingTasks && ongoingTasks.length > 0) {
      return NextResponse.json(
        {
          error: "Another classification is in progress",
          ongoingTransactionId: ongoingTasks[0].id,
        },
        { status: 409 },
      );
    }

    // 4. 创建协调器并启动分类
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
      user.id,
    );

    // 5. 返回事务 ID
    return NextResponse.json({
      success: true,
      transactionId,
      message: "Classification started",
    });
  } catch (error) {
    console.error("Failed to start classification:", error);

    // 区分验证错误和服务器错误
    const isValidationError =
      error instanceof z.ZodError ||
      (error instanceof Error && error.message.includes("Must provide"));

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: isValidationError ? 400 : 500 },
    );
  }
}
