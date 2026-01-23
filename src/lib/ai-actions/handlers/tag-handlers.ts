/**
 * Tag Action Handlers
 *
 * 标签相关操作的处理器
 *
 * @module ai-actions/handlers/tag-handlers
 * @version 1.0.0
 * @since 2025-12-25
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase query result types require any for nested joins */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AIActionResult, BookmarkBrief, TagBrief } from "../types";
import type { BookmarkRow as BaseBookmarkRow } from "@/types/domain";

type SupabaseClientType = SupabaseClient<Database>;

// 本地类型定义
type BookmarkTagsRow = Pick<BaseBookmarkRow, "user_tags">;

type BookmarkRowWithFolder = Pick<
  BaseBookmarkRow,
  | "id"
  | "title"
  | "url"
  | "description"
  | "user_tags"
  | "platform"
  | "rating"
  | "created_at"
> & {
  folders?: { name: string } | null;
};

// ============================================================================
// 标签读取操作
// ============================================================================

export async function tagList(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<TagBrief[]>> {
  const { limit = 50 } = params as { limit?: number };

  // 使用聚合查询获取标签和计数
  const { data, error } = (await (supabase.from("bookmarks") as any)
    .select("user_tags")
    .eq("user_id", userId)
    .is("deleted_at", null)) as {
    data: BookmarkTagsRow[] | null;
    error: Error | null;
  };

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  // 统计标签
  const tagCounts = new Map<string, number>();
  for (const bookmark of data || []) {
    for (const tag of bookmark.user_tags || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const tags: TagBrief[] = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return {
    success: true,
    data: tags,
    summary: `共有 ${tags.length} 个标签`,
  };
}

export async function tagBookmarks(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<BookmarkBrief[]>> {
  const { tag, limit = 20 } = params as { tag: string; limit?: number };

  const { data, error } = (await (supabase.from("bookmarks") as any)
    .select(
      "id, title, url, description, user_tags, platform, rating, created_at, folders!bookmarks_folder_id_fkey(name)",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .contains("user_tags", [tag])
    .order("created_at", { ascending: false })
    .limit(limit)) as {
    data: BookmarkRowWithFolder[] | null;
    error: Error | null;
  };

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  const bookmarks: BookmarkBrief[] = (data || []).map(
    (b: BookmarkRowWithFolder) => ({
      id: b.id,
      title: b.title || "",
      url: b.url,
      description: b.description ?? undefined,
      tags: b.user_tags || [],
      folderName: b.folders?.name ?? undefined,
      platform: b.platform || "OTHER",
      rating: b.rating ?? undefined,
      createdAt: b.created_at ?? new Date().toISOString(),
    }),
  );

  return {
    success: true,
    data: bookmarks,
    summary: `标签「${tag}」下有 ${bookmarks.length} 条书签`,
  };
}

// ============================================================================
// 标签写入操作
// ============================================================================

export async function tagAdd(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<{ bookmarkId: number; tags: string[] }>> {
  const { bookmarkId, tags } = params as {
    bookmarkId: number;
    tags: string[];
  };

  // 先获取现有标签
  const { data: existing, error: fetchError } = (await (
    supabase.from("bookmarks") as any
  )
    .select("user_tags")
    .eq("id", bookmarkId)
    .eq("user_id", userId)
    .single()) as { data: BookmarkTagsRow | null; error: Error | null };

  if (fetchError) {
    return {
      success: false,
      error: fetchError.message,
      errorCode: "DB_ERROR",
    };
  }

  // 合并标签（去重）
  const existingTags = existing?.user_tags || [];
  const newTags = [...new Set([...existingTags, ...tags])];

  const { error } = await (supabase.from("bookmarks") as any)
    .update({ user_tags: newTags })
    .eq("id", bookmarkId)
    .eq("user_id", userId);

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  return {
    success: true,
    data: { bookmarkId, tags: newTags },
    affectedIds: [bookmarkId],
    summary: `为书签添加 ${tags.length} 个标签`,
  };
}

export async function tagRemove(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<{ bookmarkId: number; tags: string[] }>> {
  const { bookmarkId, tags } = params as {
    bookmarkId: number;
    tags: string[];
  };

  // 先获取现有标签
  const { data: existing, error: fetchError } = (await (
    supabase.from("bookmarks") as any
  )
    .select("user_tags")
    .eq("id", bookmarkId)
    .eq("user_id", userId)
    .single()) as { data: BookmarkTagsRow | null; error: Error | null };

  if (fetchError) {
    return {
      success: false,
      error: fetchError.message,
      errorCode: "DB_ERROR",
    };
  }

  // 移除标签
  const existingTags = existing?.user_tags || [];
  const newTags = existingTags.filter((t: string) => !tags.includes(t));

  const { error } = await (supabase.from("bookmarks") as any)
    .update({ user_tags: newTags })
    .eq("id", bookmarkId)
    .eq("user_id", userId);

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  return {
    success: true,
    data: { bookmarkId, tags: newTags },
    affectedIds: [bookmarkId],
    summary: `从书签移除 ${tags.length} 个标签`,
  };
}

export async function tagBatchAdd(
  supabase: SupabaseClientType,
  _userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<{ affectedCount: number }>> {
  const { bookmarkIds, tags } = params as {
    bookmarkIds: number[];
    tags: string[];
  };

  // 使用 RPC 函数批量添加
  const { error } = await supabase.rpc("batch_add_tags", {
    p_bookmark_ids: bookmarkIds,
    p_tags: tags,
  });

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  return {
    success: true,
    data: { affectedCount: bookmarkIds.length },
    affectedIds: bookmarkIds,
    summary: `为 ${bookmarkIds.length} 条书签添加 ${tags.length} 个标签`,
  };
}

export async function tagBatchRemove(
  supabase: SupabaseClientType,
  _userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<{ affectedCount: number }>> {
  const { bookmarkIds, tags } = params as {
    bookmarkIds: number[];
    tags: string[];
  };

  // 使用 RPC 函数批量移除
  const { error } = await supabase.rpc("batch_remove_tags", {
    p_bookmark_ids: bookmarkIds,
    p_tags: tags,
  });

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  return {
    success: true,
    data: { affectedCount: bookmarkIds.length },
    affectedIds: bookmarkIds,
    summary: `从 ${bookmarkIds.length} 条书签移除 ${tags.length} 个标签`,
  };
}
