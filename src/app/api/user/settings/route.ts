/**
 * 用户设置 API
 * GET  /api/user/settings - 获取用户设置
 * PUT  /api/user/settings - 更新用户设置
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { successResponse, databaseError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  mergeWithDefaults,
  DEFAULT_USER_SETTINGS,
} from "@/types/user-settings";
import type { UserSettings } from "@/types/user-settings";
import type { Json } from "@/types/supabase";

/**
 * GET /api/user/settings
 * 获取当前用户的设置
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  // 创建 Supabase 客户端用于数据库操作
  const supabase = await createClient();

  // 从 profiles 表获取设置
  // 类型断言: 手动维护类型文件时需要此断言
  type ProfileSettingsRow = { settings: Json | null };
  const { data: profile, error: profileError } = (await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single()) as {
    data: ProfileSettingsRow | null;
    error: { code?: string; message: string } | null;
  };

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
});

/**
 * PUT /api/user/settings
 * 更新当前用户的设置
 */
export const PUT = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 解析请求体
    const body = (await request.json()) as Partial<UserSettings>;

    // 先获取现有设置
    // 类型断言: 手动维护类型文件时需要此断言
    type ProfileSettingsRow = { settings: Json | null };
    const { data: profile } = (await supabase
      .from("profiles")
      .select("settings")
      .eq("id", userId)
      .single()) as { data: ProfileSettingsRow | null };

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
    // 类型断言: 手动维护类型文件时需要此断言
    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: userId,
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
        userId,
        action: "settings_updated",
      },
      "User settings updated",
    );

    return successResponse(newSettings);
  },
);
