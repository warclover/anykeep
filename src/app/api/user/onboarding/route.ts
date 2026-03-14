/**
 * 用户引导完成标记 API
 * POST /api/user/onboarding - 标记用户已完成新手引导
 */

import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { successResponse, databaseError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/supabase";

export const POST = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();

  // 获取当前 settings
  type ProfileSettingsRow = { settings: Json | null };
  const { data: profile, error: fetchError } = (await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single()) as {
    data: ProfileSettingsRow | null;
    error: { code?: string; message: string } | null;
  };

  if (fetchError && fetchError.code !== "PGRST116") {
    return databaseError("获取用户设置失败", fetchError);
  }

  const currentSettings = (profile?.settings as Record<string, unknown>) ?? {};

  // 标记引导完成
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from("profiles") as any)
    .update({
      settings: {
        ...currentSettings,
        onboarding_completed_at: new Date().toISOString(),
      },
    })
    .eq("id", userId);

  if (updateError) {
    logger.error(
      { error: updateError, userId },
      "[Onboarding] Failed to mark onboarding complete",
    );
    return databaseError("标记引导完成失败", updateError);
  }

  logger.info({ userId }, "[Onboarding] User completed onboarding");

  return successResponse({ completed: true });
});
