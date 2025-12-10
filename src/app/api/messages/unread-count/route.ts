/**
 * 未读消息数量 API
 * GET /api/messages/unread-count - 获取未读消息数量（分等级统计）
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { UnreadCounts } from "@/lib/messages";

export async function GET() {
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

    // 2. 获取未读数量（使用数据库函数）
    const { data, error } = await supabase.rpc("get_unread_message_counts", {
      p_user_id: user.id,
    });

    if (error) {
      logger.error(
        { error, userId: user.id },
        "Failed to get unread message counts",
      );
      return internalError("获取未读消息数量失败");
    }

    // 数据库函数返回单行结果（作为数组的第一个元素）
    const counts: UnreadCounts =
      Array.isArray(data) && data.length > 0
        ? data[0]
        : {
            total: 0,
            silent: 0,
            normal: 0,
            important: 0,
          };

    return successResponse(counts);
  } catch (error) {
    logger.error({ error }, "GET /api/messages/unread-count error");
    return internalError("获取未读消息数量失败");
  }
}
