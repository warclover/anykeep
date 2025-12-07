/**
 * 用户设置 API
 * GET  /api/user/settings - 获取用户设置
 * PUT  /api/user/settings - 更新用户设置
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  mergeWithDefaults,
  DEFAULT_USER_SETTINGS,
} from "@/types/user-settings";
import type { UserSettings } from "@/types/user-settings";
import type { Json } from "@/types/supabase";
import type { NextRequest } from "next/server";

/**
 * GET /api/user/settings
 * 获取当前用户的设置
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 从 profiles 表获取设置
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    if (profileError) {
      // 如果是新用户，profiles 可能不存在
      if (profileError.code === "PGRST116") {
        return successResponse(DEFAULT_USER_SETTINGS);
      }
      return databaseError("获取设置失败", profileError);
    }

    // 合并默认值（处理旧版设置结构）
    const settings = mergeWithDefaults(
      profile?.settings as Partial<UserSettings> | null,
    );

    return successResponse(settings);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "GET /api/user/settings error");
    return internalError("获取设置失败");
  }
}

/**
 * PUT /api/user/settings
 * 更新当前用户的设置
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 解析请求体
    const body = (await request.json()) as Partial<UserSettings>;

    // 先获取现有设置
    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    // 合并设置
    const currentSettings = mergeWithDefaults(
      profile?.settings as Partial<UserSettings> | null,
    );
    const newSettings: UserSettings = {
      platforms: { ...currentSettings.platforms, ...(body.platforms || {}) },
      ai: { ...currentSettings.ai, ...(body.ai || {}) },
      privacy: { ...currentSettings.privacy, ...(body.privacy || {}) },
      notifications: {
        ...currentSettings.notifications,
        ...(body.notifications || {}),
      },
    };

    // 更新或插入设置（将 UserSettings 转换为 Json 类型）
    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        settings: newSettings as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      },
    );

    if (upsertError) {
      return databaseError("保存设置失败", upsertError);
    }

    logger.info(
      {
        userId: user.id,
        action: "settings_updated",
      },
      "User settings updated",
    );

    return successResponse(newSettings);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "PUT /api/user/settings error");
    return internalError("保存设置失败");
  }
}
