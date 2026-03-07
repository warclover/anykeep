/**
 * Knowledge Studio - Mastery Stats API
 * @route GET /api/knowledge-studio/mastery
 * @description 获取用户内化率统计
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

import { withAuthMiddleware } from "@/lib/api/middleware";
const logger = createLogger("api:knowledge-studio:mastery");

/**
 * GET /api/knowledge-studio/mastery
 * 获取用户整体内化率统计
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();
  logger.info({ userId: userId }, "Fetching mastery stats");

  // 调用 RPC 获取内化率统计
  const { data, error } = await supabase.rpc("get_user_mastery_stats", {
    p_user_id: userId,
  });

  if (error) {
    logger.error({ error: error.message }, "Get mastery stats failed");
    return NextResponse.json(
      { error: { code: "DATABASE_ERROR", message: "获取内化率统计失败" } },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
});
