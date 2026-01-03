/**
 * Batch Confirmations API v1
 *
 * POST /api/v1/classification/confirmations/batch - 批量确认/拒绝
 *
 * @module api/v1/classification/confirmations/batch
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

const PENDING_CONFIRMATIONS_TABLE = "pending_confirmations" as const;

// 批量操作 Schema
const BatchConfirmSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  action: z.enum(["confirm", "reject", "skip"]),
  rejectReason: z.string().max(500).optional(),
});

/**
 * POST /api/v1/classification/confirmations/batch
 * 批量确认/拒绝
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 解析请求体
    const body = await request.json();
    const validation = BatchConfirmSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "请求参数验证失败",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { ids, action, rejectReason } = validation.data;

    // 确定新状态
    let newStatus: string;
    switch (action) {
      case "confirm":
        newStatus = "confirmed";
        break;
      case "reject":
        newStatus = "rejected";
        break;
      case "skip":
        newStatus = "modified";
        break;
    }

    // 获取待处理的确认项
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: confirmations, error: fetchError } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .select("id, bookmark_id, suggestion")
      .in("id", ids)
      .eq("user_id", userId)
      .eq("status", "pending");

    if (fetchError) {
      logger.error(
        { error: fetchError.message },
        "[v1] Failed to fetch confirmations",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "获取确认项失败" },
        },
        { status: 500 },
      );
    }

    if (!confirmations || confirmations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NO_PENDING", message: "没有待处理的确认项" },
        },
        { status: 400 },
      );
    }

    const validIds = confirmations.map((c: { id: number }) => c.id);

    // 批量更新状态
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from(PENDING_CONFIRMATIONS_TABLE)
      .update({
        status: newStatus,
        user_choice: {
          userAction: action,
          rejectReason: rejectReason || null,
          processedAt: new Date().toISOString(),
          batchProcessed: true,
        },
        resolved_at: new Date().toISOString(),
      })
      .in("id", validIds);

    if (updateError) {
      logger.error(
        { error: updateError.message },
        "[v1] Failed to batch update confirmations",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "批量更新失败" },
        },
        { status: 500 },
      );
    }

    // 如果是确认操作，执行书签移动
    let movedCount = 0;
    if (action === "confirm") {
      for (const confirmation of confirmations) {
        if (confirmation.bookmark_id && confirmation.suggestion?.folderId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: moveError } = await (supabase.from("bookmarks") as any)
            .update({
              folder_id: confirmation.suggestion.folderId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", confirmation.bookmark_id)
            .eq("user_id", userId);

          if (!moveError) {
            movedCount++;
          } else {
            logger.warn(
              {
                error: moveError.message,
                bookmarkId: confirmation.bookmark_id,
              },
              "[v1] Failed to move bookmark in batch",
            );
          }
        }
      }
    }

    logger.info(
      {
        userId,
        action,
        processedCount: validIds.length,
        movedCount,
      },
      "[v1] Batch confirmation processed",
    );

    const message =
      action === "confirm"
        ? `已确认 ${validIds.length} 个建议，移动了 ${movedCount} 个书签`
        : action === "reject"
          ? `已拒绝 ${validIds.length} 个建议`
          : `已跳过 ${validIds.length} 个建议`;

    return NextResponse.json({
      success: true,
      data: {
        processedCount: validIds.length,
        movedCount,
        action,
        message,
      },
    });
  },
);
