/**
 * Bookmark Action Handlers
 *
 * 书签相关操作的处理器
 *
 * @module ai-actions/handlers/bookmark-handlers
 * @version 1.1.0
 * @since 2025-12-25
 */

import type {
  SupabaseClient,
  PostgrestFilterBuilder,
} from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AIActionResult, BookmarkBrief } from "../types";
import type { BookmarkRow as BaseBookmarkRow } from "@/types/domain";

type SupabaseClientType = SupabaseClient<Database>;

// 本地类型定义 - 包含关联查询的 folders 字段
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
  | "folder_id"
> & {
  folders?: { name: string } | null;
};

// 书签查询构建器类型
type BookmarkQueryBuilder = PostgrestFilterBuilder<
  Database["public"],
  Database["public"]["Tables"]["bookmarks"]["Row"],
  BookmarkRowWithFolder[],
  "bookmarks",
  Database["public"]["Tables"]["bookmarks"]["Relationships"]
>;

// 书签表选择字段常量
const BOOKMARK_SELECT_WITH_FOLDER =
  "id, title, url, description, user_tags, platform, rating, created_at, folder_id, folders!bookmarks_folder_id_fkey(name)" as const;

const BOOKMARK_SELECT_SIMPLE =
  "id, title, url, description, user_tags, platform, rating, created_at" as const;

/**
 * 创建书签查询构建器（带 folders 关联）
 * 封装类型断言，避免在业务代码中重复 as any
 */
function createBookmarkQuery(supabase: SupabaseClientType) {
  return supabase
    .from("bookmarks")
    .select(BOOKMARK_SELECT_WITH_FOLDER) as unknown as BookmarkQueryBuilder;
}

/**
 * 转换书签行为简要信息
 */
function toBookmarkBrief(b: BookmarkRowWithFolder): BookmarkBrief {
  return {
    id: b.id,
    title: b.title || "",
    url: b.url,
    description: b.description ?? undefined,
    tags: b.user_tags || [],
    folderName: b.folders?.name ?? undefined,
    platform: b.platform || "OTHER",
    rating: b.rating ?? undefined,
    createdAt: b.created_at ?? new Date().toISOString(),
  };
}

// ============================================================================
// 书签读取操作
// ============================================================================

export async function bookmarkSearch(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<BookmarkBrief[]>> {
  const {
    query,
    limit = 20,
    folderId,
    tags,
    platform,
  } = params as {
    query: string;
    limit?: number;
    folderId?: number;
    tags?: string[];
    platform?: string;
  };

  let queryBuilder = createBookmarkQuery(supabase)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(
      `title.ilike.%${query}%,description.ilike.%${query}%,url.ilike.%${query}%`,
    )
    .limit(limit);

  if (folderId) {
    queryBuilder = queryBuilder.eq("folder_id", folderId);
  }
  if (platform) {
    queryBuilder = queryBuilder.eq("platform", platform);
  }
  if (tags && tags.length > 0) {
    queryBuilder = queryBuilder.overlaps("user_tags", tags);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  const bookmarks: BookmarkBrief[] = (data || []).map(toBookmarkBrief);

  return {
    success: true,
    data: bookmarks,
    summary: `搜索到 ${bookmarks.length} 条与「${query}」相关的书签`,
  };
}

export async function bookmarkGet(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<BookmarkBrief>> {
  const { id } = params as { id: number };

  const { data, error } = await createBookmarkQuery(supabase)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  if (!data) {
    return { success: false, error: "书签不存在", errorCode: "NOT_FOUND" };
  }

  const bookmark = toBookmarkBrief(data);

  return {
    success: true,
    data: bookmark,
    summary: `获取书签「${bookmark.title}」详情`,
  };
}

export async function bookmarkList(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<BookmarkBrief[]>> {
  const {
    folderId,
    tags,
    platform,
    limit = 20,
    offset = 0,
    sortBy = "created_at",
    sortOrder = "desc",
  } = params as {
    folderId?: number;
    tags?: string[];
    platform?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };

  let queryBuilder = createBookmarkQuery(supabase)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(offset, offset + limit - 1);

  if (folderId) {
    queryBuilder = queryBuilder.eq("folder_id", folderId);
  }
  if (platform) {
    queryBuilder = queryBuilder.eq("platform", platform);
  }
  if (tags && tags.length > 0) {
    queryBuilder = queryBuilder.overlaps("user_tags", tags);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  const bookmarks: BookmarkBrief[] = (data || []).map(toBookmarkBrief);

  return {
    success: true,
    data: bookmarks,
    summary: `获取到 ${bookmarks.length} 条书签`,
  };
}

export async function bookmarkRelated(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<BookmarkBrief[]>> {
  const { bookmarkId, limit = 5 } = params as {
    bookmarkId: number;
    limit?: number;
  };

  // 先获取当前书签的标签
  const { data: currentBookmark, error: fetchError } = await supabase
    .from("bookmarks")
    .select("user_tags, folder_id")
    .eq("id", bookmarkId)
    .eq("user_id", userId)
    .single();

  if (fetchError) {
    return {
      success: false,
      error: fetchError.message,
      errorCode: "DB_ERROR",
    };
  }

  // 根据标签查找相关书签
  const tags = currentBookmark?.user_tags || [];
  let queryBuilder = createBookmarkQuery(supabase)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .neq("id", bookmarkId)
    .limit(limit);

  if (tags.length > 0) {
    queryBuilder = queryBuilder.overlaps("user_tags", tags);
  } else if (currentBookmark?.folder_id) {
    queryBuilder = queryBuilder.eq("folder_id", currentBookmark.folder_id);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  const bookmarks: BookmarkBrief[] = (data || []).map(toBookmarkBrief);

  return {
    success: true,
    data: bookmarks,
    summary: `找到 ${bookmarks.length} 条相关书签`,
  };
}

// ============================================================================
// 书签写入操作
// ============================================================================

export async function bookmarkCreate(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<BookmarkBrief>> {
  const { url, title, description, folderId, tags } = params as {
    url: string;
    title?: string;
    description?: string;
    folderId?: number;
    tags?: string[];
  };

  const { data, error } = await supabase
    .from("bookmarks")
    .insert({
      user_id: userId,
      url,
      title: title || url,
      description,
      folder_id: folderId,
      user_tags: tags || [],
      platform: "OTHER",
    })
    .select(BOOKMARK_SELECT_SIMPLE)
    .single();

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  if (!data) {
    return { success: false, error: "创建失败", errorCode: "DB_ERROR" };
  }

  const bookmark: BookmarkBrief = {
    id: data.id,
    title: data.title || "",
    url: data.url,
    description: data.description ?? undefined,
    tags: data.user_tags || [],
    platform: data.platform || "OTHER",
    rating: data.rating ?? undefined,
    createdAt: data.created_at ?? new Date().toISOString(),
  };

  return {
    success: true,
    data: bookmark,
    affectedIds: [data.id],
    summary: `创建书签「${bookmark.title}」成功`,
  };
}

export async function bookmarkUpdate(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<BookmarkBrief>> {
  const { id, title, description, tags, folderId, rating, isStarred } =
    params as {
      id: number;
      title?: string;
      description?: string;
      tags?: string[];
      folderId?: number;
      rating?: number;
      isStarred?: boolean;
    };

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (tags !== undefined) updateData.user_tags = tags;
  if (folderId !== undefined) updateData.folder_id = folderId;
  if (rating !== undefined) updateData.rating = rating;
  if (isStarred !== undefined) updateData.is_starred = isStarred;

  const { data, error } = await supabase
    .from("bookmarks")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId)
    .select(BOOKMARK_SELECT_SIMPLE)
    .single();

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  if (!data) {
    return { success: false, error: "更新失败", errorCode: "DB_ERROR" };
  }

  const bookmark: BookmarkBrief = {
    id: data.id,
    title: data.title || "",
    url: data.url,
    description: data.description ?? undefined,
    tags: data.user_tags || [],
    platform: data.platform || "OTHER",
    rating: data.rating ?? undefined,
    createdAt: data.created_at ?? new Date().toISOString(),
  };

  return {
    success: true,
    data: bookmark,
    affectedIds: [id],
    summary: `更新书签「${bookmark.title}」成功`,
  };
}

export async function bookmarkMove(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<{ movedCount: number }>> {
  const { bookmarkIds, targetFolderId } = params as {
    bookmarkIds: number[];
    targetFolderId: number;
  };

  const { error } = await supabase
    .from("bookmarks")
    .update({ folder_id: targetFolderId })
    .in("id", bookmarkIds)
    .eq("user_id", userId);

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  return {
    success: true,
    data: { movedCount: bookmarkIds.length },
    affectedIds: bookmarkIds,
    summary: `移动 ${bookmarkIds.length} 条书签成功`,
  };
}

export async function bookmarkDelete(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<{ deletedCount: number }>> {
  const { bookmarkIds } = params as { bookmarkIds: number[] };

  // 软删除
  const { error } = await supabase
    .from("bookmarks")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", bookmarkIds)
    .eq("user_id", userId);

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  return {
    success: true,
    data: { deletedCount: bookmarkIds.length },
    affectedIds: bookmarkIds,
    summary: `删除 ${bookmarkIds.length} 条书签成功`,
  };
}

export async function bookmarkRate(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<{ bookmarkId: number; rating: number }>> {
  const { bookmarkId, rating } = params as {
    bookmarkId: number;
    rating: number;
  };

  const { error } = await supabase
    .from("bookmarks")
    .update({ rating })
    .eq("id", bookmarkId)
    .eq("user_id", userId);

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  return {
    success: true,
    data: { bookmarkId, rating },
    affectedIds: [bookmarkId],
    summary: `书签评分设置为 ${rating} 星`,
  };
}
