/**
 * 单条消息 API
 * PATCH /api/messages/:id - 更新消息状态（已读/归档）
 * DELETE /api/messages/:id - 删除消息
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  handleValidationError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

// 路由参数类型
interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH 请求体验证
const updateMessageSchema = z.object({
  status: z.enum(["read", "archived"]),
});

/**
 * 更新消息状态
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId) || messageId <= 0) {
      return notFoundError("无效的消息 ID");
    }

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
    const validation = updateMessageSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { status } = validation.data;

    // 3. 更新消息状态
    const updateData: Record<string, unknown> = { status };
    if (status === "read") {
      updateData.read_at = new Date().toISOString();
    }

    const { data: message, error } = await supabase
      .from("messages")
      .update(updateData)
      .eq("id", messageId)
      .eq("user_id", user.id)
      .select("id, status")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return notFoundError("消息不存在");
      }
      logger.error(
        { error, messageId, userId: user.id },
        "Failed to update message",
      );
      return internalError("更新消息失败");
    }

    logger.info(
      { messageId, status, userId: user.id },
      "Message status updated",
    );

    return successResponse({
      id: message.id,
      status: message.status,
    });
  } catch (error) {
    logger.error({ error }, "PATCH /api/messages/:id error");
    return internalError("更新消息失败");
  }
}

/**
 * 删除消息
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId) || messageId <= 0) {
      return notFoundError("无效的消息 ID");
    }

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 删除消息
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId)
      .eq("user_id", user.id);

    if (error) {
      logger.error(
        { error, messageId, userId: user.id },
        "Failed to delete message",
      );
      return internalError("删除消息失败");
    }

    logger.info({ messageId, userId: user.id }, "Message deleted");

    return successResponse({
      id: messageId,
      deleted: true,
    });
  } catch (error) {
    logger.error({ error }, "DELETE /api/messages/:id error");
    return internalError("删除消息失败");
  }
}
