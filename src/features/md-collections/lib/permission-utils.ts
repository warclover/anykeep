/**
 * MD Collections 权限验证工具
 * Spec: md-reader-upgrade / Critical Fix
 *
 * 提供 MD Collections 相关资源的所有权验证函数
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// 本地类型定义（绕过 Supabase 类型推断问题）
interface CollectionOwnerRow {
  id: number;
  user_id: string;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: collection, error } = (await (
      supabase.from("md_collections") as any
    )
      .select("id, user_id")
      .eq("id", collectionId)
      .is("deleted_at", null)
      .single()) as { data: CollectionOwnerRow | null; error: Error | null };

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
