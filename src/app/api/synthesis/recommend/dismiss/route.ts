/**
 * 综述推荐忽略 API
 *
 * POST /api/synthesis/recommend/dismiss - 忽略指定推荐主题
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";

interface DismissRequest {
  topicId: string;
}

/**
 * POST /api/synthesis/recommend/dismiss - 忽略推荐主题
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  // 解析请求体
  const body: DismissRequest = await request.json();

  if (!body.topicId) {
    return NextResponse.json(
      { error: "topicId is required", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  // 调用 RPC 添加忽略的主题
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "update_synthesis_recommend_preferences",
    {
      p_user_id: userId,
      p_enabled: null,
      p_dismissed_topic: body.topicId,
      p_increment_daily_count: false,
    },
  );

  if (error) {
    logger.error({ error }, "Failed to dismiss recommend topic");
    return NextResponse.json(
      { error: "Failed to dismiss", code: "UPDATE_ERROR" },
      { status: 500 },
    );
  }

  logger.info({ userId, topicId: body.topicId }, "Recommend topic dismissed");

  return NextResponse.json({
    success: true,
    data: {
      preferences: data,
    },
  });
});
