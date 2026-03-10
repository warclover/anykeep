/**
 * 批量分类 API - 确认分类
 *
 * POST /api/batch-classification/[batchId]/confirm
 *
 * @module api/batch-classification/[batchId]/confirm
 * @version 1.2.0
 * @since 2026-02-01
 * @updated 2026-02-02 - 安全修复：使用 Zod 进行请求验证
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BatchClassificationCoordinator } from "@/lib/batch-classification";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { badRequestError } from "@/lib/utils/api-response";

// ============================================
// 常量
// ============================================

/** UUID 正则表达式 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 单次请求允许的最大决策数量 */
const MAX_DECISIONS = 500;

// ============================================
// Zod Schema 验证
// ============================================

const UserDecisionSchema = z
  .object({
    clusterId: z.string().regex(UUID_REGEX, "Invalid clusterId format"),
    action: z.enum(["accept", "reject", "modify"]),
    targetFolderId: z.number().int().positive().optional(),
    customName: z.string().min(1).max(100).optional(),
  })
  .refine(
    (data) => {
      // modify 操作需要提供 targetFolderId 或 customName
      if (data.action === "modify") {
        return (
          data.targetFolderId !== undefined || data.customName !== undefined
        );
      }
      return true;
    },
    { message: "Modify action requires targetFolderId or customName" },
  );

const ConfirmRequestSchema = z.object({
  decisions: z
    .array(UserDecisionSchema)
    .min(1, "At least one decision is required")
    .max(MAX_DECISIONS, `Maximum ${MAX_DECISIONS} decisions allowed`),
});

type RequestBody = z.infer<typeof ConfirmRequestSchema>;

function validateRequest(body: unknown): RequestBody {
  const result = ConfirmRequestSchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(firstError?.message || "Invalid request body");
  }
  return result.data;
}

// ============================================
// API Handler
// ============================================

export const POST = withAuthMiddleware<{ batchId: string }>(
  async (request, { userId, params }) => {
    const { batchId } = await params;

    // 1. 验证 batchId
    if (!batchId) {
      return badRequestError("Missing batchId");
    }

    // 2. 解析请求体
    const body = await request.json();
    const { decisions } = validateRequest(body);

    // 3. 确认分类
    const supabase = await createClient();
    const coordinator = new BatchClassificationCoordinator(supabase);
    await coordinator.confirmResults(batchId, decisions, userId);

    // 4. 返回成功
    return NextResponse.json({
      success: true,
      message: "Classification confirmed",
      confirmedCount: decisions.filter(
        (d) => d.action === "accept" || d.action === "modify",
      ).length,
      rejectedCount: decisions.filter((d) => d.action === "reject").length,
    });
  },
);
