/**
 * 综述推荐显示记录 API
 *
 * POST /api/synthesis/recommend/shown - 记录推荐已显示
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { SynthesisErrorCode } from "@/lib/synthesis";

/**
 * POST /api/synthesis/recommend/shown - 记录推荐已显示
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: SynthesisErrorCode.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // 调用 RPC 更新显示计数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(
      "update_synthesis_recommend_preferences",
      {
        p_user_id: user.id,
        p_enabled: null,
        p_dismissed_topic: null,
        p_increment_daily_count: true,
      },
    );

    if (error) {
      logger.error({ error }, "Failed to update recommend shown count");
      return NextResponse.json(
        { error: "Failed to update", code: "UPDATE_ERROR" },
        { status: 500 },
      );
    }

    logger.info({ userId: user.id }, "Recommend shown count updated");

    return NextResponse.json({
      success: true,
      data: {
        preferences: data,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Recommend shown API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
