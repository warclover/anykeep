/**
 * Knowledge Studio - Mastery Stats API
 * @route GET /api/knowledge-studio/mastery
 * @description 获取用户内化率统计
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:knowledge-studio:mastery");

/**
 * GET /api/knowledge-studio/mastery
 * 获取用户整体内化率统计
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "请先登录" } },
        { status: 401 },
      );
    }

    logger.info({ userId: user.id }, "Fetching mastery stats");

    // 调用 RPC 获取内化率统计
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("get_user_mastery_stats", {
      p_user_id: user.id,
    });

    if (error) {
      logger.error({ error: error.message }, "Get mastery stats failed");
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "获取内化率统计失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Get mastery stats failed",
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取内化率统计失败" } },
      { status: 500 },
    );
  }
}
