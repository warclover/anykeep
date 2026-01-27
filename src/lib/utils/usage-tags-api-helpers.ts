/**
 * 用途标签 API 辅助函数
 * 提供认证、数据获取、更新的通用逻辑
 */

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { CustomUsageTag, ProfileSettings, Json } from "@/types/supabase";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

export interface AuthResult {
  success: true;
  supabase: SupabaseClient;
  user: User;
}

export interface AuthError {
  success: false;
  error: "unauthorized";
}

export interface UserSettingsResult {
  success: true;
  settings: ProfileSettings;
  customUsageTags: CustomUsageTag[];
}

export interface UserSettingsError {
  success: false;
  error: Error;
}

// ============================================
// 认证辅助函数
// ============================================

/**
 * 获取已认证的用户和 Supabase 客户端
 * @returns 成功时返回 supabase 客户端和用户，失败时返回错误
 */
export async function getAuthenticatedUser(): Promise<AuthResult | AuthError> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "unauthorized" };
  }

  return { success: true, supabase, user };
}

// ============================================
// 数据获取辅助函数
// ============================================

/**
 * 获取用户的设置和自定义标签
 * @param supabase Supabase 客户端
 * @param userId 用户 ID
 */
export async function getUserSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSettingsResult | UserSettingsError> {
  const { data: profile, error: queryError } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single();

  // 处理 PGRST116 错误（用户 profile 记录不存在）
  // 这种情况下返回空设置，而不是错误
  if (queryError) {
    // PGRST116: The result contains 0 rows
    if (queryError.code === "PGRST116") {
      return { success: true, settings: {}, customUsageTags: [] };
    }
    return { success: false, error: queryError };
  }

  const settings = (profile?.settings as ProfileSettings) || {};
  const customUsageTags =
    ((settings as Record<string, unknown>).customUsageTags as
      | CustomUsageTag[]
      | undefined) || [];

  return { success: true, settings, customUsageTags };
}

// ============================================
// 数据更新辅助函数
// ============================================

/**
 * 更新用户的自定义标签列表
 * @param supabase Supabase 客户端
 * @param userId 用户 ID
 * @param settings 现有设置
 * @param updatedTags 更新后的标签列表
 */
export async function updateUserCustomTags(
  supabase: SupabaseClient,
  userId: string,
  settings: ProfileSettings,
  updatedTags: CustomUsageTag[],
): Promise<{ success: true } | { success: false; error: Error }> {
  const newSettings = {
    ...(settings as Record<string, unknown>),
    customUsageTags: updatedTags,
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      settings: newSettings as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: updateError };
  }

  return { success: true };
}

// ============================================
// 日志辅助函数
// ============================================

/**
 * 记录 API 错误日志
 * @param error 错误对象
 * @param operation 操作名称
 * @param endpoint API 端点
 */
export function logApiError(
  error: unknown,
  operation: string,
  endpoint: string,
): void {
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      operation,
    },
    `${endpoint} error`,
  );
}
