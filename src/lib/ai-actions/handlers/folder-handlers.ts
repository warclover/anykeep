/**
 * Folder Action Handlers
 *
 * 文件夹相关操作的处理器
 *
 * @module ai-actions/handlers/folder-handlers
 * @version 1.0.0
 * @since 2025-12-25
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase query result types require any for nested joins */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AIActionResult, BookmarkBrief, FolderBrief } from "../types";

type SupabaseClientType = SupabaseClient<Database>;

// 本地类型定义（保留以便类型检查引用）
interface _FolderRow {
  id: number;
  name: string;
  parent_id: number | null;
}

interface _BookmarkRow {
  id: number;
  title: string | null;
  url: string;
  description: string | null;
  user_tags: string[] | null;
  platform: string | null;
  rating: number | null;
  created_at: string | null;
}

// ============================================================================
// 文件夹读取操作
// ============================================================================

export async function folderList(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<FolderBrief[]>> {
  const { parentId } = params as { parentId?: number };

  let queryBuilder = (supabase.from("folders") as any)
    .select("id, name, parent_id")
    .eq("user_id", userId)
    .order("order", { ascending: true });

  if (parentId !== undefined) {
    queryBuilder = queryBuilder.eq("parent_id", parentId);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  const folders: FolderBrief[] = (data || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    parentId: f.parent_id ?? undefined,
    bookmarkCount: 0,
    path: f.name, // 简化路径
  }));

  return {
    success: true,
    data: folders,
    summary: `获取到 ${folders.length} 个文件夹`,
  };
}

export async function folderGet(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<FolderBrief>> {
  const { id } = params as { id: number };

  const { data, error } = await (supabase.from("folders") as any)
    .select("id, name, parent_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  const folder: FolderBrief = {
    id: data.id,
    name: data.name,
    parentId: data.parent_id ?? undefined,
    bookmarkCount: 0,
    path: data.name,
  };

  return {
    success: true,
    data: folder,
    summary: `获取文件夹「${folder.name}」详情`,
  };
}

export async function folderBookmarks(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<BookmarkBrief[]>> {
  const { folderId, limit = 20 } = params as {
    folderId: number;
    limit?: number;
  };

  const { data, error } = await (supabase.from("bookmarks") as any)
    .select(
      "id, title, url, description, user_tags, platform, rating, created_at",
    )
    .eq("folder_id", folderId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  const bookmarks: BookmarkBrief[] = (data || []).map((b: any) => ({
    id: b.id,
    title: b.title || "",
    url: b.url,
    description: b.description ?? undefined,
    tags: b.user_tags || [],
    platform: b.platform || "OTHER",
    rating: b.rating ?? undefined,
    createdAt: b.created_at ?? new Date().toISOString(),
  }));

  return {
    success: true,
    data: bookmarks,
    summary: `文件夹内有 ${bookmarks.length} 条书签`,
  };
}

// ============================================================================
// 文件夹写入操作
// ============================================================================

export async function folderCreate(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<FolderBrief>> {
  const {
    name,
    parentId,
    description: _description,
  } = params as {
    name: string;
    parentId?: number;
    description?: string;
  };

  const { data, error } = await (supabase.from("folders") as any)
    .insert({
      user_id: userId,
      name,
      parent_id: parentId,
    })
    .select("id, name, parent_id")
    .single();

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  const folder: FolderBrief = {
    id: data.id,
    name: data.name,
    parentId: data.parent_id ?? undefined,
    bookmarkCount: 0,
    path: data.name,
  };

  return {
    success: true,
    data: folder,
    affectedIds: [data.id],
    summary: `创建文件夹「${folder.name}」成功`,
  };
}

export async function folderUpdate(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<FolderBrief>> {
  const { id, name, parentId } = params as {
    id: number;
    name?: string;
    parentId?: number;
  };

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (parentId !== undefined) updateData.parent_id = parentId;

  const { data, error } = await (supabase.from("folders") as any)
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, name, parent_id")
    .single();

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  const folder: FolderBrief = {
    id: data.id,
    name: data.name,
    parentId: data.parent_id ?? undefined,
    bookmarkCount: 0,
    path: data.name,
  };

  return {
    success: true,
    data: folder,
    affectedIds: [id],
    summary: `更新文件夹「${folder.name}」成功`,
  };
}

export async function folderDelete(
  supabase: SupabaseClientType,
  userId: string,
  params: Record<string, unknown>,
): Promise<AIActionResult<{ deletedId: number }>> {
  const { id } = params as { id: number };

  const { error } = await (supabase.from("folders") as any)
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { success: false, error: error.message, errorCode: "DB_ERROR" };
  }

  return {
    success: true,
    data: { deletedId: id },
    affectedIds: [id],
    summary: `删除文件夹成功`,
  };
}
