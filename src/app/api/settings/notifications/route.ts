/**
 * 通知偏好设置 API
 * GET /api/settings/notifications - 获取通知偏好
 * PATCH /api/settings/notifications - 更新通知偏好
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, databaseError } from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
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
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 查询用户的通知偏好
    // 类型断言: 手动维护类型文件时需要此断言
    type NotificationPrefRow = {
      silent_toast: boolean | null;
      normal_toast: boolean | null;
      important_toast: boolean | null;
      web_push_enabled: boolean | null;
      web_push_subscription: string | null;
      do_not_disturb: boolean | null;
      dnd_start_time: string | null;
      dnd_end_time: string | null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: preferences, error: queryError } = (await (
      supabase.from("notification_preferences") as any
    )
      .select("*")
      .eq("user_id", userId)
      .single()) as {
      data: NotificationPrefRow | null;
      error: { code?: string; message: string } | null;
    };

    if (queryError && queryError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      logger.error(
        { error: queryError, userId },
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
  },
);

/**
 * PATCH /api/settings/notifications
 * 更新当前用户的通知偏好设置
 */
export const PATCH = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

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
    // 类型断言: 手动维护类型文件时需要此断言
    type NotificationPrefUpdateRow = {
      silent_toast: boolean | null;
      normal_toast: boolean | null;
      important_toast: boolean | null;
      web_push_enabled: boolean | null;
      web_push_subscription: string | null;
      do_not_disturb: boolean | null;
      dnd_start_time: string | null;
      dnd_end_time: string | null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: upsertError } = (await (
      supabase.from("notification_preferences") as any
    )
      .upsert(
        {
          user_id: userId,
          ...updateData,
        },
        {
          onConflict: "user_id",
        },
      )
      .select()
      .single()) as {
      data: NotificationPrefUpdateRow | null;
      error: { message: string } | null;
    };

    if (upsertError) {
      logger.error(
        { error: upsertError, userId },
        "Failed to update notification preferences",
      );
      return databaseError("更新通知偏好失败", upsertError);
    }

    if (!updated) {
      return databaseError("更新通知偏好失败");
    }

    logger.info(
      { userId, changes: Object.keys(updateData) },
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
  },
);
