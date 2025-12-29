/**
 * 综述推荐偏好 API
 *
 * GET /api/synthesis/recommend/preferences - 获取推荐偏好
 * PATCH /api/synthesis/recommend/preferences - 更新推荐偏好
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { SynthesisErrorCode } from "@/lib/synthesis";
import type { SynthesisRecommendPreferences } from "@/lib/synthesis/types/recommend";

interface UpdatePreferencesRequest {
  enabled?: boolean;
  clearDismissed?: boolean;
}

/**
 * GET /api/synthesis/recommend/preferences - 获取推荐偏好
 */
export async function GET() {
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

    // 调用 RPC 获取偏好
    const { data, error } = await supabase.rpc(
      "get_synthesis_recommend_preferences",
      {
        p_user_id: user.id,
      },
    );

    if (error) {
      logger.error({ error }, "Failed to get recommend preferences");
      return NextResponse.json(
        { error: "Failed to get preferences", code: "FETCH_ERROR" },
        { status: 500 },
      );
    }

    const preferences: SynthesisRecommendPreferences =
      (data as unknown as SynthesisRecommendPreferences) || {
        enabled: false,
        dismissedTopics: [],
        lastShownAt: null,
        dailyShowCount: 0,
        dailyShowDate: null,
      };

    return NextResponse.json({
      success: true,
      data: {
        preferences,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Recommend preferences GET API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/synthesis/recommend/preferences - 更新推荐偏好
 */
export async function PATCH(request: Request) {
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
    const body: UpdatePreferencesRequest = await request.json();

    // 调用 RPC 更新偏好
    const { data, error } = await supabase.rpc(
      "update_synthesis_recommend_preferences",
      {
        p_user_id: user.id,
        p_enabled: body.enabled ?? null,
        p_dismissed_topic: null,
        p_increment_daily_count: false,
        p_clear_dismissed: body.clearDismissed ?? false,
      },
    );

    if (error) {
      logger.error({ error }, "Failed to update recommend preferences");
      return NextResponse.json(
        { error: "Failed to update preferences", code: "UPDATE_ERROR" },
        { status: 500 },
      );
    }

    logger.info(
      { userId: user.id, enabled: body.enabled },
      "Recommend preferences updated",
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
      "Recommend preferences PATCH API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
