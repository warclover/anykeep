/**
 * Message Actions API v1
 *
 * POST /api/v1/messages/read - 批量标记已读
 *
 * @module api/v1/messages/read
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

// 批量已读 Schema
const BatchReadSchema = z.object({
  // messageIds 为空或不传时，标记所有未读消息为已读
  messageIds: z.array(z.number().int().positive()).optional(),
});

/**
 * POST /api/v1/messages/read
 * 批量标记消息为已读
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 解析请求体
    const body = await request.json().catch(() => ({}));
    const validation = BatchReadSchema.safeParse(body);

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

    const { messageIds } = validation.data;

    // 使用 RPC 函数批量标记已读
    const { data: updatedCount, error } = await supabase.rpc(
      "mark_messages_read",
      {
        p_user_id: userId,
        p_message_ids: messageIds || undefined,
      },
    );

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[v1] Failed to mark messages as read",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "标记已读失败" },
        },
        { status: 500 },
      );
    }

    logger.info(
      {
        userId,
        updatedCount,
        messageIds: messageIds?.length ?? "all",
      },
      "[v1] Messages marked as read",
    );

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: updatedCount ?? 0,
        message: messageIds
          ? `已标记 ${updatedCount} 条消息为已读`
          : "已标记所有消息为已读",
      },
    });
  },
);
