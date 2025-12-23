/**
 * AI Agent Tools 共享工具函数
 *
 * 提供所有 Tools 共用的辅助函数和常量
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { createClient } from "@/lib/supabase/server";

// ============================================
// 常量定义
// ============================================

/**
 * 确认操作过期时间（毫秒）
 * 5 分钟
 */
export const CONFIRMATION_EXPIRY_MS = 5 * 60 * 1000;

/**
 * 批量操作限制
 */
export const BATCH_LIMITS = {
  /** 批量标签操作最大书签数 */
  MAX_BOOKMARKS_FOR_TAGS: 200,
  /** 批量移动操作最大书签数 */
  MAX_BOOKMARKS_FOR_MOVE: 100,
  /** 批量操作最大标签数 */
  MAX_TAGS: 20,
  /** 预览显示的最大书签数 */
  MAX_PREVIEW_ITEMS: 10,
} as const;

/**
 * 风险等级阈值
 */
export const RISK_THRESHOLDS = {
  /** 高风险书签数量阈值 */
  HIGH_RISK_BOOKMARK_COUNT: 50,
  /** 中风险书签数量阈值 */
  MEDIUM_RISK_BOOKMARK_COUNT: 20,
} as const;

// ============================================
// 辅助函数
// ============================================

/**
 * 生成确认操作 ID
 *
 * 格式: confirm_{timestamp}_{random}
 *
 * @returns 唯一的确认 ID
 */
export function generateConfirmationId(): string {
  return `confirm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 获取书签标题列表（用于确认对话框显示）
 *
 * @param userId - 用户 ID
 * @param bookmarkIds - 书签 ID 列表
 * @param limit - 最大返回数量（默认 10）
 * @returns 书签 ID 和标题的数组
 */
export async function getBookmarkTitles(
  userId: string,
  bookmarkIds: number[],
  limit: number = BATCH_LIMITS.MAX_PREVIEW_ITEMS,
): Promise<Array<{ id: number; title: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookmarks")
    .select("id, title")
    .in("id", bookmarkIds)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((b) => ({ id: b.id, title: b.title }));
}

/**
 * 获取文件夹名称
 *
 * @param userId - 用户 ID
 * @param folderId - 文件夹 ID（null 表示根目录）
 * @returns 文件夹名称或 null
 */
export async function getFolderName(
  userId: string,
  folderId: number | null,
): Promise<string | null> {
  if (folderId === null) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("folders")
    .select("name")
    .eq("id", folderId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.name;
}

/**
 * 验证书签所有权
 *
 * @param userId - 用户 ID
 * @param bookmarkIds - 书签 ID 列表
 * @returns 验证结果 { valid: boolean, ownedCount: number }
 */
export async function validateBookmarkOwnership(
  userId: string,
  bookmarkIds: number[],
): Promise<{ valid: boolean; ownedCount: number }> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .in("id", bookmarkIds)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  const ownedCount = count ?? 0;
  return {
    valid: ownedCount === bookmarkIds.length,
    ownedCount,
  };
}

/**
 * 根据书签数量确定风险等级
 *
 * @param count - 书签数量
 * @returns 风险等级
 */
export function determineRiskLevel(count: number): "low" | "medium" | "high" {
  if (count > RISK_THRESHOLDS.HIGH_RISK_BOOKMARK_COUNT) {
    return "high";
  }
  if (count > RISK_THRESHOLDS.MEDIUM_RISK_BOOKMARK_COUNT) {
    return "medium";
  }
  return "low";
}

/**
 * 计算确认操作过期时间
 *
 * @returns 过期时间的 Date 对象
 */
export function getConfirmationExpiryTime(): Date {
  return new Date(Date.now() + CONFIRMATION_EXPIRY_MS);
}
