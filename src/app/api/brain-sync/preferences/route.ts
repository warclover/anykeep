/**
 * Brain-Sync 复习偏好 API
 * GET /api/brain-sync/preferences - 获取复习偏好
 * PUT /api/brain-sync/preferences - 更新复习偏好
 *
 * @module api/brain-sync/preferences
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  handleValidationError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type {
  ReviewPreferencesRow,
  PendingFlashcardRow,
} from "@/types/brain-sync";

/**
 * 更新偏好请求体验证 Schema
 */
const updatePreferencesSchema = z.object({
  enabled: z.boolean().optional(),
  preferredDay: z
    .enum([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ])
    .optional(),
  preferredTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "时间格式必须为 HH:MM")
    .optional(),
  timezone: z.string().optional(),
  weeklyLimit: z.number().int().min(3).max(30).optional(),
  includedFolderIds: z.array(z.number().int()).optional(),
  excludedFolderIds: z.array(z.number().int()).optional(),
  notificationChannel: z.enum(["sidebar", "push", "both", "none"]).optional(),
});

/**
 * GET /api/brain-sync/preferences
 * 获取用户复习偏好
 */
export async function GET() {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    const supabase = await createClient();

    // 2. 获取或创建用户偏好（使用类型断言处理新表）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: preferences, error: prefError } = await (supabase as any)
      .from("review_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const typedPreferences = preferences as ReviewPreferencesRow | null;

    // 如果不存在，返回默认值
    if (prefError && prefError.code === "PGRST116") {
      return successResponse({
        preferences: {
          enabled: false,
          preferredDay: "monday",
          preferredTime: "09:00",
          timezone: "Asia/Shanghai",
          weeklyLimit: 10,
          includedFolderIds: [],
          excludedFolderIds: [],
          notificationChannel: "sidebar",
        },
        isDefault: true,
      });
    }

    if (prefError) {
      logger.error(
        { error: prefError, userId: user.id },
        "Brain-Sync: Failed to fetch preferences",
      );
      return databaseError("获取复习偏好失败");
    }

    // 3. 获取用户文件夹列表（用于前端展示）
    const { data: folders } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_system", false)
      .is("deleted_at", null)
      .order("name");

    logger.info(
      { userId: user.id, enabled: typedPreferences?.enabled },
      "Brain-Sync: Preferences fetched",
    );

    return successResponse({
      preferences: {
        enabled: typedPreferences?.enabled ?? false,
        preferredDay: typedPreferences?.preferred_day ?? "monday",
        preferredTime: typedPreferences?.preferred_time ?? "09:00",
        timezone: typedPreferences?.timezone ?? "Asia/Shanghai",
        weeklyLimit: typedPreferences?.weekly_limit ?? 10,
        includedFolderIds: typedPreferences?.included_folder_ids || [],
        excludedFolderIds: typedPreferences?.excluded_folder_ids || [],
        notificationChannel:
          typedPreferences?.notification_channel ?? "sidebar",
      },
      folders: folders || [],
      isDefault: false,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Get preferences error",
    );
    return internalError("获取复习偏好失败");
  }
}

/**
 * PUT /api/brain-sync/preferences
 * 更新用户复习偏好
 */
export async function PUT(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = updatePreferencesSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const updates = validation.data;
    const supabase = await createClient();

    // 3. 构建更新数据（转换为数据库字段名）
    const dbUpdates: Record<string, unknown> = {};

    if (updates.enabled !== undefined) {
      dbUpdates.enabled = updates.enabled;
    }
    if (updates.preferredDay !== undefined) {
      dbUpdates.preferred_day = updates.preferredDay;
    }
    if (updates.preferredTime !== undefined) {
      dbUpdates.preferred_time = updates.preferredTime;
    }
    if (updates.timezone !== undefined) {
      dbUpdates.timezone = updates.timezone;
    }
    if (updates.weeklyLimit !== undefined) {
      dbUpdates.weekly_limit = updates.weeklyLimit;
    }
    if (updates.includedFolderIds !== undefined) {
      dbUpdates.included_folder_ids = updates.includedFolderIds;
    }
    if (updates.excludedFolderIds !== undefined) {
      dbUpdates.excluded_folder_ids = updates.excludedFolderIds;
    }
    if (updates.notificationChannel !== undefined) {
      dbUpdates.notification_channel = updates.notificationChannel;
    }

    // 4. Upsert 偏好设置
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: preferences, error: upsertError } = await (supabase as any)
      .from("review_preferences")
      .upsert(
        {
          user_id: user.id,
          ...dbUpdates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    const typedPreferences = preferences as ReviewPreferencesRow | null;

    if (upsertError) {
      logger.error(
        { error: upsertError, userId: user.id, updates: dbUpdates },
        "Brain-Sync: Failed to update preferences",
      );
      return databaseError("更新复习偏好失败");
    }

    // 5. 如果刚启用功能，检查是否需要生成本周队列
    if (updates.enabled === true) {
      // 异步触发队列生成（不阻塞响应）
      generateWeeklyQueueIfNeeded(user.id, supabase).catch((err) => {
        logger.warn(
          { error: err, userId: user.id },
          "Brain-Sync: Failed to generate weekly queue on enable",
        );
      });
    }

    logger.info(
      { userId: user.id, updates: Object.keys(dbUpdates) },
      "Brain-Sync: Preferences updated",
    );

    return successResponse({
      success: true,
      preferences: {
        enabled: typedPreferences?.enabled ?? false,
        preferredDay: typedPreferences?.preferred_day ?? "monday",
        preferredTime: typedPreferences?.preferred_time ?? "09:00",
        timezone: typedPreferences?.timezone ?? "Asia/Shanghai",
        weeklyLimit: typedPreferences?.weekly_limit ?? 10,
        includedFolderIds: typedPreferences?.included_folder_ids || [],
        excludedFolderIds: typedPreferences?.excluded_folder_ids || [],
        notificationChannel:
          typedPreferences?.notification_channel ?? "sidebar",
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Brain-Sync: Update preferences error",
    );
    return internalError("更新复习偏好失败");
  }
}

/**
 * 检查并生成本周复习队列（如果需要）
 */
async function generateWeeklyQueueIfNeeded(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<void> {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  // 检查本周队列是否已存在
  const { data: existingQueue } = await supabase
    .from("weekly_review_queue")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart.toISOString().split("T")[0])
    .single();

  if (existingQueue) {
    return; // 已存在，无需生成
  }

  // 获取用户偏好
  const { data: preferences } = await supabase
    .from("review_preferences")
    .select("weekly_limit, included_folder_ids, excluded_folder_ids")
    .eq("user_id", userId)
    .single();

  const typedPreferences = preferences as Pick<
    ReviewPreferencesRow,
    "weekly_limit" | "included_folder_ids" | "excluded_folder_ids"
  > | null;

  if (!typedPreferences) {
    return;
  }

  // 获取待复习的 Flashcards
  const { data: pendingFlashcards } = await supabase.rpc(
    "get_pending_flashcards",
    {
      p_user_id: userId,
      p_limit: typedPreferences.weekly_limit || 10,
      p_included_folders: typedPreferences.included_folder_ids,
      p_excluded_folders: typedPreferences.excluded_folder_ids,
    },
  );

  const typedPendingFlashcards = pendingFlashcards as
    | PendingFlashcardRow[]
    | null;

  if (!typedPendingFlashcards || typedPendingFlashcards.length === 0) {
    return;
  }

  // 创建本周队列
  const flashcardIds = typedPendingFlashcards.map((f) => f.flashcard_id);

  await supabase.from("weekly_review_queue").insert({
    user_id: userId,
    week_start: weekStart.toISOString().split("T")[0],
    flashcard_ids: flashcardIds,
    completed_ids: [],
  });

  logger.info(
    { userId, queueSize: flashcardIds.length },
    "Brain-Sync: Weekly queue generated on enable",
  );
}
