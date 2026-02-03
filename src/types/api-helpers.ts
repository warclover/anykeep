/**
 * API 路由公共类型定义
 *
 * 提取重复的类型断言模式，避免在 API 路由中重复定义
 *
 * @module types/api-helpers
 * @version 1.0.0
 * @since 2026-02-03
 */

// ============================================
// Bookmark 相关类型
// ============================================

/**
 * 书签基础查询结果（用于存在性检查）
 */
export interface BookmarkExistsResult {
  id: number;
  user_id: string;
}

/**
 * 书签查询结果（包含 folder_id）
 */
export interface BookmarkWithFolderIdResult extends BookmarkExistsResult {
  folder_id: number | null;
}

/**
 * 书签删除查询结果（包含锁定和垃圾箱状态）
 */
export interface BookmarkDeleteCheckResult extends BookmarkWithFolderIdResult {
  is_locked: boolean;
  is_in_trash: boolean;
}

/**
 * Supabase 查询错误类型
 */
export interface SupabaseQueryError {
  code?: string;
  message: string;
}

/**
 * Supabase 单条查询结果类型
 */
export interface SupabaseSingleResult<T> {
  data: T | null;
  error: SupabaseQueryError | null;
}

// ============================================
// 类型守卫函数
// ============================================

/**
 * 检查是否为 "未找到" 错误
 */
export function isNotFoundError(error: SupabaseQueryError | null): boolean {
  return error?.code === "PGRST116";
}

/**
 * 安全类型转换辅助函数
 * 用于将 Supabase 查询结果转换为预期类型
 */
export function asTypedResult<T>(result: unknown): SupabaseSingleResult<T> {
  return result as SupabaseSingleResult<T>;
}
