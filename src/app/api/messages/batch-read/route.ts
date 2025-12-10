/**
 * 批量标记已读 API
 * POST /api/messages/batch-read - 批量标记消息为已读
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  handleValidationError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

// 请求体验证
const batchReadSchema = z.object({
  // messageIds 为空或不传时，标记所有未读消息为已读
  messageIds: z.array(z.number().int().positive()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析请求体
    const body = await request.json().catch(() => ({}));
    const validation = batchReadSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { messageIds } = validation.data;

    // 3. 调用数据库函数批量标记已读
    const { data: updatedCount, error } = await supabase.rpc(
      "mark_messages_read",
      {
        p_user_id: user.id,
        p_message_ids: messageIds || undefined,
      },
    );

    if (error) {
      logger.error(
        { error, userId: user.id, messageIds },
        "Failed to mark messages as read",
      );
      return internalError("标记已读失败");
    }

    logger.info(
      {
        userId: user.id,
        updatedCount,
        messageIds: messageIds?.length ?? "all",
      },
      "Messages marked as read",
    );

    return successResponse({
      updatedCount: updatedCount ?? 0,
      message: messageIds
        ? `已标记 ${updatedCount} 条消息为已读`
        : "已标记所有消息为已读",
    });
  } catch (error) {
    logger.error({ error }, "POST /api/messages/batch-read error");
    return internalError("标记已读失败");
  }
}
