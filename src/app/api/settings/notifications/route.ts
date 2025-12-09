/**
 * 通知偏好设置 API
 * GET /api/settings/notifications - 获取通知偏好
 * PATCH /api/settings/notifications - 更新通知偏好
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { NotificationPreferences } from "@/lib/messages/types";

// 默认偏好值
const DEFAULT_PREFERENCES: NotificationPreferences = {
  silent_toast: false,
  normal_toast: true,
  important_toast: true,
  web_push_enabled: false,
  web_push_subscription: null,
  do_not_disturb: false,
  dnd_start_time: null,
  dnd_end_time: null,
};

/**
 * GET /api/settings/notifications
 * 获取当前用户的通知偏好设置
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

    // 查询用户的通知偏好
    const { data: preferences, error: queryError } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (queryError && queryError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      logger.error(
        { error: queryError, userId: user.id },
        "Failed to fetch notification preferences",
      );
      return databaseError("获取通知偏好失败", queryError);
    }

    // 如果没有记录，返回默认值
    if (!preferences) {
      return successResponse(DEFAULT_PREFERENCES);
    }

    // 返回用户偏好
    const result: NotificationPreferences = {
      silent_toast:
        preferences.silent_toast ?? DEFAULT_PREFERENCES.silent_toast,
      normal_toast:
        preferences.normal_toast ?? DEFAULT_PREFERENCES.normal_toast,
      important_toast:
        preferences.important_toast ?? DEFAULT_PREFERENCES.important_toast,
      web_push_enabled:
        preferences.web_push_enabled ?? DEFAULT_PREFERENCES.web_push_enabled,
      web_push_subscription: preferences.web_push_subscription,
      do_not_disturb:
        preferences.do_not_disturb ?? DEFAULT_PREFERENCES.do_not_disturb,
      dnd_start_time: preferences.dnd_start_time,
      dnd_end_time: preferences.dnd_end_time,
    };

    return successResponse(result);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "GET /api/settings/notifications error",
    );
    return badRequestError("获取通知偏好失败");
  }
}

/**
 * PATCH /api/settings/notifications
 * 更新当前用户的通知偏好设置
 */
export async function PATCH(request: NextRequest) {
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
    const body = await request.json();
    const {
      silent_toast,
      normal_toast,
      important_toast,
      web_push_enabled,
      do_not_disturb,
      dnd_start_time,
      dnd_end_time,
    } = body;

    // 构建更新数据（只包含提供的字段）
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof silent_toast === "boolean") {
      updateData.silent_toast = silent_toast;
    }
    if (typeof normal_toast === "boolean") {
      updateData.normal_toast = normal_toast;
    }
    if (typeof important_toast === "boolean") {
      updateData.important_toast = important_toast;
    }
    if (typeof web_push_enabled === "boolean") {
      updateData.web_push_enabled = web_push_enabled;
    }
    if (typeof do_not_disturb === "boolean") {
      updateData.do_not_disturb = do_not_disturb;
    }
    if (dnd_start_time !== undefined) {
      updateData.dnd_start_time = dnd_start_time;
    }
    if (dnd_end_time !== undefined) {
      updateData.dnd_end_time = dnd_end_time;
    }

    // 使用 upsert 确保记录存在
    const { data: updated, error: upsertError } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          ...updateData,
        },
        {
          onConflict: "user_id",
        },
      )
      .select()
      .single();

    if (upsertError) {
      logger.error(
        { error: upsertError, userId: user.id },
        "Failed to update notification preferences",
      );
      return databaseError("更新通知偏好失败", upsertError);
    }

    logger.info(
      { userId: user.id, changes: Object.keys(updateData) },
      "Notification preferences updated",
    );

    // 返回更新后的偏好
    const result: NotificationPreferences = {
      silent_toast: updated.silent_toast ?? DEFAULT_PREFERENCES.silent_toast,
      normal_toast: updated.normal_toast ?? DEFAULT_PREFERENCES.normal_toast,
      important_toast:
        updated.important_toast ?? DEFAULT_PREFERENCES.important_toast,
      web_push_enabled:
        updated.web_push_enabled ?? DEFAULT_PREFERENCES.web_push_enabled,
      web_push_subscription: updated.web_push_subscription,
      do_not_disturb:
        updated.do_not_disturb ?? DEFAULT_PREFERENCES.do_not_disturb,
      dnd_start_time: updated.dnd_start_time,
      dnd_end_time: updated.dnd_end_time,
    };

    return successResponse(result);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "PATCH /api/settings/notifications error",
    );
    return badRequestError("更新通知偏好失败");
  }
}
