/**
 * MD Collections 权限验证工具
 * Spec: md-reader-upgrade / Critical Fix
 *
 * 提供 MD Collections 相关资源的所有权验证函数
 *
 * V1.1.0 更新：
 * - 新增会员权限检查函数（checkMdCollectionAccess）
 * - 使用显式类型替代 `as unknown as` 断言，提升类型安全
 * - 统一权限检查逻辑，遵循 DRY 原则
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

// 本地类型定义（绕过 Supabase 类型推断问题）
interface CollectionOwnerRow {
  id: number;
  user_id: string;
}

/**
 * Profile 会员类型查询结果
 * 使用显式类型避免 `as unknown as` 断言
 */
interface ProfileMembershipRow {
  membership_type: string | null;
}

/**
 * 用户会员类型枚举
 */
export type MembershipType = "FREE" | "PRO" | "ENTERPRISE";

/**
 * 会员权限检查结果
 */
export interface MdAccessCheckResult {
  /** 是否有权限访问 MD 收藏功能 */
  hasAccess: boolean;
  /** 会员类型 */
  membershipType: MembershipType;
  /** 用户 ID（如果已认证） */
  userId: string | null;
}

/**
 * 验证结果
 */
export interface OwnershipResult {
  isOwner: boolean;
  exists: boolean;
  error?: {
    code?: string;
    message: string;
  };
}

/**
 * 验证用户是否拥有指定的 MD Collection
 *
 * @param collectionId - Collection ID
 * @param userId - 用户 ID
 * @returns 验证结果
 *
 * @example
 * ```ts
 * const result = await verifyCollectionOwnership(collectionId, user.id);
 * if (!result.exists) {
 *   return notFoundError("文档不存在");
 * }
 * if (!result.isOwner) {
 *   return forbiddenError("无权访问");
 * }
 * ```
 */
export async function verifyCollectionOwnership(
  collectionId: number,
  userId: string,
): Promise<OwnershipResult> {
  try {
    const supabase = await createClient();

    /* eslint-disable @typescript-eslint/no-explicit-any -- Supabase 类型推断限制，md_collections 表未在类型定义中 */
    const { data: collection, error } = (await (
      supabase.from("md_collections") as any
    )
      .select("id, user_id")
      .eq("id", collectionId)
      .is("deleted_at", null)
      .single()) as { data: CollectionOwnerRow | null; error: Error | null };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any).code === "PGRST116") {
        return { isOwner: false, exists: false };
      }
      return {
        isOwner: false,
        exists: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        error: { code: (error as any).code, message: error.message },
      };
    }

    return {
      isOwner: collection?.user_id === userId,
      exists: true,
    };
  } catch (err) {
    logger.error(
      {
        collectionId,
        userId,
        error: err instanceof Error ? err.message : String(err),
      },
      "verifyCollectionOwnership error",
    );
    return {
      isOwner: false,
      exists: false,
      error: { message: err instanceof Error ? err.message : "Unknown error" },
    };
  }
}

/**
 * 验证用户是否拥有指定的高亮标记
 *
 * @param highlightId - 高亮 ID
 * @param collectionId - Collection ID
 * @param userId - 用户 ID
 * @returns 验证结果
 *
 * @example
 * ```ts
 * const result = await verifyHighlightOwnership(highlightId, collectionId, user.id);
 * if (!result.exists) {
 *   return notFoundError("高亮不存在");
 * }
 * if (!result.isOwner) {
 *   return forbiddenError("无权访问");
 * }
 * ```
 */
export async function verifyHighlightOwnership(
  highlightId: string,
  collectionId: number,
  userId: string,
): Promise<OwnershipResult> {
  try {
    const supabase = await createClient();

    // 使用类型断言绕过类型检查（表未在类型定义中）
    const { data: highlight, error } = await (
      supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string,
            ) => {
              eq: (
                column: string,
                value: number,
              ) => {
                single: () => Promise<{
                  data: {
                    id: string;
                    user_id: string;
                    collection_id: number;
                  } | null;
                  error: { message: string; code?: string } | null;
                }>;
              };
            };
          };
        };
      }
    )
      .from("md_collection_highlights")
      .select("id, user_id, collection_id")
      .eq("id", highlightId)
      .eq("collection_id", collectionId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { isOwner: false, exists: false };
      }
      return {
        isOwner: false,
        exists: false,
        error: { code: error.code, message: error.message },
      };
    }

    return {
      isOwner: highlight?.user_id === userId,
      exists: true,
    };
  } catch (err) {
    logger.error(
      {
        highlightId,
        collectionId,
        userId,
        error: err instanceof Error ? err.message : String(err),
      },
      "verifyHighlightOwnership error",
    );
    return {
      isOwner: false,
      exists: false,
      error: { message: err instanceof Error ? err.message : "Unknown error" },
    };
  }
}

// ============================================
// 会员权限检查函数（V1.1.0 新增）
// ============================================

/**
 * 标准化会员类型
 * 处理数据库中可能的各种格式
 */
function normalizeMembershipType(
  value: string | null | undefined,
): MembershipType {
  if (!value) return "FREE";

  const normalized = value.toUpperCase().trim();

  switch (normalized) {
    case "PRO":
      return "PRO";
    case "ENTERPRISE":
      return "ENTERPRISE";
    default:
      return "FREE";
  }
}

/**
 * 检查用户是否有权限访问 MD 收藏功能
 *
 * 设计决策：
 * - 使用显式泛型类型替代 `as unknown as` 断言
 * - 统一权限检查逻辑，避免代码重复（DRY 原则）
 * - 查询失败时默认为 FREE 用户，保证安全
 *
 * @param supabase - Supabase 客户端实例
 * @param userId - 用户 ID
 * @returns 权限检查结果
 *
 * @example
 * ```ts
 * const supabase = await createClient();
 * const { data: { user } } = await supabase.auth.getUser();
 * if (user) {
 *   const result = await checkMdCollectionAccess(supabase, user.id);
 *   if (!result.hasAccess) {
 *     return forbiddenError("PRO 会员专属功能");
 *   }
 * }
 * ```
 */
export async function checkMdCollectionAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<MdAccessCheckResult> {
  try {
    // 使用显式类型而非类型断言
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single<ProfileMembershipRow>();

    if (error) {
      logger.warn(
        { error: error.message, userId },
        "Failed to fetch user profile for access check",
      );
      // 查询失败时默认为 FREE 用户，无权限
      return {
        hasAccess: false,
        membershipType: "FREE",
        userId,
      };
    }

    const membershipType = normalizeMembershipType(profile?.membership_type);
    const hasAccess =
      membershipType === "PRO" || membershipType === "ENTERPRISE";

    return {
      hasAccess,
      membershipType,
      userId,
    };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), userId },
      "Unexpected error during access check",
    );
    return {
      hasAccess: false,
      membershipType: "FREE",
      userId,
    };
  }
}

/**
 * 获取用户会员类型（不检查权限，仅查询）
 *
 * @param supabase - Supabase 客户端实例
 * @param userId - 用户 ID
 * @returns 会员类型
 */
export async function getMembershipType(
  supabase: SupabaseClient,
  userId: string,
): Promise<MembershipType> {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single<ProfileMembershipRow>();

    if (error) {
      logger.warn(
        { error: error.message, userId },
        "Failed to fetch membership type",
      );
      return "FREE";
    }

    return normalizeMembershipType(profile?.membership_type);
  } catch {
    return "FREE";
  }
}

/**
 * 快速权限检查（仅返回布尔值）
 * 适用于简单的权限门控场景
 */
export async function hasProAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const result = await checkMdCollectionAccess(supabase, userId);
  return result.hasAccess;
}
