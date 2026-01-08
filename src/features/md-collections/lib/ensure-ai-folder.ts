/**
 * AI 生成文件夹管理
 * @description 确保用户有「AI 生成」系统文件夹
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";

/** 类型别名 */
type TypedSupabaseClient = SupabaseClient<Database>;

/** AI 生成文件夹配置 */
const AI_GENERATED_FOLDER_CONFIG = {
  name: "AI 生成",
  icon: "✨",
  color: "#8B5CF6",
  isSystem: true,
  systemType: "AI_GENERATED",
  sortOrder: -2, // 置顶（比 INBOX 的 -1 更前）
} as const;

/**
 * 获取或创建用户的「AI 生成」系统文件夹
 *
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 * @returns 文件夹 ID
 * @throws 如果创建失败
 */
export async function ensureAIGeneratedFolder(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  // 1. 优先使用数据库函数（已有 RPC）
  try {
    const { data, error } = await (supabase as TypedSupabaseClient).rpc(
      "get_or_create_ai_generated_folder",
      { p_user_id: userId },
    );

    if (!error && data) {
      return data;
    }

    // RPC 不存在，回退到直接查询/创建
    if (error?.message?.includes("does not exist")) {
      logger.warn(
        "RPC get_or_create_ai_generated_folder not found, using fallback",
      );
    } else if (error) {
      logger.error(
        { error },
        "Failed to call get_or_create_ai_generated_folder RPC",
      );
    }
  } catch {
    // RPC 调用失败，继续使用回退方案
  }

  // 2. 回退方案：直接查询/创建
  return ensureAIGeneratedFolderFallback(
    supabase as TypedSupabaseClient,
    userId,
  );
}

/**
 * 回退方案：直接查询/创建 AI 生成文件夹
 */
async function ensureAIGeneratedFolderFallback(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<number> {
  // 1. 查找现有文件夹
  const { data: existing, error: selectError } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("is_system", true)
    .eq("system_type", AI_GENERATED_FOLDER_CONFIG.systemType)
    .is("deleted_at", null)
    .single();

  if (existing) {
    return existing.id;
  }

  // 如果是 "PGRST116" (no rows found)，继续创建；其他错误则警告
  if (selectError && selectError.code !== "PGRST116") {
    logger.warn({ error: selectError }, "Error checking AI generated folder");
  }

  // 2. 创建新文件夹
  const { data: newFolder, error: insertError } = await supabase
    .from("folders")
    .insert({
      user_id: userId,
      name: AI_GENERATED_FOLDER_CONFIG.name,
      icon: AI_GENERATED_FOLDER_CONFIG.icon,
      color: AI_GENERATED_FOLDER_CONFIG.color,
      is_system: AI_GENERATED_FOLDER_CONFIG.isSystem,
      system_type: AI_GENERATED_FOLDER_CONFIG.systemType,
      sort_order: AI_GENERATED_FOLDER_CONFIG.sortOrder,
    })
    .select("id")
    .single();

  if (insertError || !newFolder) {
    logger.error(
      { error: insertError },
      "Failed to create AI generated folder",
    );
    throw new Error(
      `创建 AI 生成文件夹失败: ${insertError?.message || "Unknown error"}`,
    );
  }

  logger.info(
    { userId, folderId: newFolder.id },
    "Created AI generated folder for user",
  );

  return newFolder.id;
}

/**
 * 获取 AI 生成文件夹信息（不创建）
 *
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 * @returns 文件夹信息或 null
 */
export async function getAIGeneratedFolder(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: number; name: string } | null> {
  const { data, error } = await (supabase as TypedSupabaseClient)
    .from("folders")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_system", true)
    .eq("system_type", AI_GENERATED_FOLDER_CONFIG.systemType)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
