/**
 * V3.0 用户分类设置 API
 *
 * GET /api/classification/settings - 获取用户分类设置
 * PUT /api/classification/settings - 更新用户分类设置
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 分类设置 Schema
 */
const classificationSettingsSchema = z.object({
  /** 启用自动创建文件夹 */
  autoCreateEnabled: z.boolean().default(true),

  /** 自动创建时是否通知 */
  autoCreateNotify: z.boolean().default(true),

  /** 启用回溯分类 */
  backfillEnabled: z.boolean().default(true),

  /** 回溯分类时是否通知 */
  backfillNotify: z.boolean().default(true),

  /** 高置信度阈值 (60-95) */
  highConfidenceThreshold: z.number().min(60).max(95).default(80),

  /** 启用通用分类 */
  universalCategoriesEnabled: z.boolean().default(true),

  /** 每日自动创建限额 (1-5) */
  dailyAutoCreateLimit: z.number().min(1).max(5).default(3),
});

type ClassificationSettings = z.infer<typeof classificationSettingsSchema>;

/**
 * 默认分类设置
 */
const DEFAULT_SETTINGS: ClassificationSettings = {
  autoCreateEnabled: true,
  autoCreateNotify: true,
  backfillEnabled: true,
  backfillNotify: true,
  highConfidenceThreshold: 80,
  universalCategoriesEnabled: true,
  dailyAutoCreateLimit: 3,
};

// ============================================================================
// API 处理器
// ============================================================================

/**
 * GET /api/classification/settings
 * 获取用户分类设置
 */
export async function GET() {
  try {
    // 1. 验证用户身份（使用缓存认证，性能优化）
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 2. 获取用户 profile 中的分类设置
    // 类型断言: 手动维护类型文件时需要此断言
    type ProfileSettingsType = { settings: Record<string, unknown> | null };
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single() as unknown as {
      data: ProfileSettingsType | null;
      error: { code?: string; message: string } | null;
    };

    if (profileError && profileError.code !== "PGRST116") {
      logger.warn(
        { error: profileError.message, userId: user.id },
        "Failed to fetch profile settings",
      );
    }

    // 3. 提取分类设置（如果存在）
    const storedSettings =
      (profile?.settings as Record<string, unknown>)?.classification || {};

    // 4. 合并默认设置
    const settings: ClassificationSettings = {
      ...DEFAULT_SETTINGS,
      ...(storedSettings as Partial<ClassificationSettings>),
    };

    logger.debug(
      { userId: user.id, settings },
      "Classification settings retrieved",
    );

    return successResponse(settings);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/settings error",
    );
    return internalError("获取分类设置失败");
  }
}

/**
 * PUT /api/classification/settings
 * 更新用户分类设置
 */
export async function PUT(request: NextRequest) {
  try {
    // 1. 验证用户身份（使用缓存认证，避免重复验证）
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = classificationSettingsSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const newSettings = validation.data;

    // 3. 获取现有 profile 设置
    // 类型断言: 手动维护类型文件时需要此断言
    type ProfileSettingsType = { settings: Record<string, unknown> | null };
    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single() as unknown as { data: ProfileSettingsType | null; error: unknown };

    const currentSettings =
      (profile?.settings as Record<string, unknown>) || {};

    // 4. 更新分类设置（合并到现有设置中）
    const updatedSettings = {
      ...currentSettings,
      classification: newSettings,
      classification_updated_at: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase
      .from("profiles") as any)
      .update({ settings: updatedSettings })
      .eq("id", user.id) as { error: { message: string } | null };

    if (updateError) {
      logger.error(
        { error: updateError.message, userId: user.id },
        "Failed to update classification settings",
      );
      return internalError("保存分类设置失败");
    }

    logger.info(
      {
        userId: user.id,
        settings: newSettings,
      },
      "Classification settings updated",
    );

    return successResponse({
      success: true,
      settings: newSettings,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "PUT /api/classification/settings error",
    );
    return internalError("保存分类设置失败");
  }
}
