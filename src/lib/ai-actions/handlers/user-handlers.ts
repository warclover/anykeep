/**
 * User Action Handlers
 *
 * 用户相关操作的处理器
 *
 * @module ai-actions/handlers/user-handlers
 * @version 1.0.0
 * @since 2025-12-25
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase query result types require any for nested joins */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AIActionResult, UserStatsBrief } from "../types";
import type { BookmarkRow } from "@/types/domain";

type SupabaseClientType = SupabaseClient<Database>;

// 本地类型定义
type BookmarkTagsRow = Pick<BookmarkRow, "user_tags">;

type BookmarkCreatedAtRow = Pick<BookmarkRow, "created_at">;

// ============================================================================
// 用户操作
// ============================================================================

export async function userPreferences(
  supabase: SupabaseClientType,
  userId: string,
): Promise<AIActionResult<Record<string, unknown>>> {
  const { data, error } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  return {
    success: true,
    data: data || {},
    summary: `获取用户偏好设置`,
  };
}

export async function userStats(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<UserStatsBrief>> {
  const { days = 30 } = params as { days?: number };

  // 并行获取统计数据
  const [bookmarkCount, folderCount, tagResult, recentBookmarks] =
    await Promise.all([
      (supabase.from("bookmarks") as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null),
      (supabase.from("folders") as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      (supabase.from("bookmarks") as any)
        .select("user_tags")
        .eq("user_id", userId)
        .is("deleted_at", null) as Promise<{
        data: BookmarkTagsRow[] | null;
        error: Error | null;
      }>,
      (supabase.from("bookmarks") as any)
        .select("created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .gte(
          "created_at",
          new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        ) as Promise<{
        data: BookmarkCreatedAtRow[] | null;
        error: Error | null;
      }>,
    ]);

  // 统计唯一标签数
  const uniqueTags = new Set<string>();
  for (const bookmark of tagResult.data || []) {
    for (const tag of bookmark.user_tags || []) {
      uniqueTags.add(tag);
    }
  }

  // 统计最近活动
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const addedLast7Days = (recentBookmarks.data || []).filter(
    (b: { created_at: string | null }) =>
      b.created_at && new Date(b.created_at).getTime() > sevenDaysAgo,
  ).length;

  const stats: UserStatsBrief = {
    totalBookmarks: bookmarkCount.count || 0,
    totalFolders: folderCount.count || 0,
    totalTags: uniqueTags.size,
    recentActivity: {
      addedLast7Days,
      addedLast30Days: recentBookmarks.data?.length || 0,
    },
  };

  return {
    success: true,
    data: stats,
    summary: `共有 ${stats.totalBookmarks} 条书签、${stats.totalFolders} 个文件夹、${stats.totalTags} 个标签`,
  };
}
