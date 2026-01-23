/**
 * 文件夹 ID 统一类型定义
 *
 * 解决 folderId 类型不一致问题 (string vs number)
 * 统一为 number 类型，与数据库 folders.id (bigint) 保持一致
 *
 * @module @/lib/shared/types/folder
 * @version 1.0.0
 * @since 2026-01-23
 *
 * @example
 * ```typescript
 * import type { FolderId, NullableFolderId } from "@/lib/shared/types";
 *
 * interface BookmarkData {
 *   id: number;
 *   folderId: NullableFolderId;  // 可为 null（未分类）
 * }
 *
 * function moveToFolder(bookmarkId: number, folderId: FolderId): Promise<void> {
 *   // folderId 必须是 number 类型
 * }
 * ```
 */

// ============================================
// 基础类型
// ============================================

/**
 * 文件夹 ID 统一类型
 *
 * 与数据库 folders.id (bigint) 保持一致，映射为 TypeScript number
 *
 * @description
 * - 数据库层: PostgreSQL bigint → Supabase 生成类型为 number
 * - 前端层: 统一使用 number，避免 string/number 混用
 * - API 层: ��由参数需要 parseInt 转换（已在边界处理）
 */
export type FolderId = number;

/**
 * 可空文件夹 ID
 *
 * 用于书签未分类场景，folderId 为 null 表示在收件箱/未分类
 */
export type NullableFolderId = FolderId | null;

/**
 * 文件夹 ID 数组
 *
 * 用于批量操作场景
 */
export type FolderIdList = FolderId[];

// ============================================
// 辅助类型
// ============================================

/**
 * 带文件夹 ID 的实体基类
 */
export interface WithFolderId {
  folderId: FolderId;
}

/**
 * 带可空文件夹 ID 的实体基类
 */
export interface WithNullableFolderId {
  folderId: NullableFolderId;
}

// ============================================
// 类型守卫
// ============================================

/**
 * 检查值是否为有效的 FolderId
 *
 * @param value - 待检查的值
 * @returns 是否为有效的 FolderId (正整数)
 *
 * @example
 * ```typescript
 * const id = parseInt(params.folderId);
 * if (isValidFolderId(id)) {
 *   // id 类型收窄为 FolderId
 * }
 * ```
 */
export function isValidFolderId(value: unknown): value is FolderId {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * 检查值是否为有效的 NullableFolderId
 *
 * @param value - 待检查的值
 * @returns 是否为有效的 NullableFolderId (正整数或 null)
 */
export function isValidNullableFolderId(
  value: unknown,
): value is NullableFolderId {
  return value === null || isValidFolderId(value);
}

// ============================================
// 转换工具
// ============================================

/**
 * 安全地将字符串转换为 FolderId
 *
 * @param value - 字符串值（通常来自 URL 参数）
 * @returns FolderId 或 null（转换失败时）
 *
 * @example
 * ```typescript
 * const folderId = parseFolderId(params.id);
 * if (folderId === null) {
 *   return NextResponse.json({ error: "Invalid folder ID" }, { status: 400 });
 * }
 * ```
 */
export function parseFolderId(
  value: string | undefined | null,
): FolderId | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = parseInt(value, 10);
  return isValidFolderId(parsed) ? parsed : null;
}

/**
 * 安全地将字符串转换为 NullableFolderId
 *
 * @param value - 字符串值
 * @param allowNull - 是否允许 "null" 字符串转换为 null
 * @returns NullableFolderId
 */
export function parseNullableFolderId(
  value: string | undefined | null,
  allowNull = true,
): NullableFolderId {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (allowNull && value.toLowerCase() === "null") {
    return null;
  }
  const parsed = parseInt(value, 10);
  return isValidFolderId(parsed) ? parsed : null;
}
