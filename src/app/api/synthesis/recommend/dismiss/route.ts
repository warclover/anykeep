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
import { logger } from "@/lib/logger";
import { SynthesisErrorCode } from "@/lib/synthesis";

interface DismissRequest {
  topicId: string;
}

/**
 * POST /api/synthesis/recommend/dismiss - 忽略推荐主题
 */
export async function POST(request: Request) {
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

    // 解析请求体
    const body: DismissRequest = await request.json();

    if (!body.topicId) {
      return NextResponse.json(
        { error: "topicId is required", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    // 调用 RPC 添加忽略的主题
    const { data, error } = await supabase.rpc(
      "update_synthesis_recommend_preferences",
      {
        p_user_id: user.id,
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

    logger.info(
      { userId: user.id, topicId: body.topicId },
      "Recommend topic dismissed",
    );

    return NextResponse.json({
      success: true,
      data: {
        preferences: data,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Recommend dismiss API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
