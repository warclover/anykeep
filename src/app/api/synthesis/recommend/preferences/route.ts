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
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import type { SynthesisRecommendPreferences } from "@/lib/synthesis/types/recommend";

interface UpdatePreferencesRequest {
  enabled?: boolean;
  clearDismissed?: boolean;
}

/**
 * GET /api/synthesis/recommend/preferences - 获取推荐偏好
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();

  // 调用 RPC 获取偏好
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "get_synthesis_recommend_preferences",
    {
      p_user_id: userId,
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
});

/**
 * PATCH /api/synthesis/recommend/preferences - 更新推荐偏好
 */
export const PATCH = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  // 解析请求体
  const body: UpdatePreferencesRequest = await request.json();

  // 调用 RPC 更新偏好
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "update_synthesis_recommend_preferences",
    {
      p_user_id: userId,
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
    { userId, enabled: body.enabled },
    "Recommend preferences updated",
  );

  return NextResponse.json({
    success: true,
    data: {
      preferences: data,
    },
  });
});
