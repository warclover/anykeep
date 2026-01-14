/**
 * 学习路径书签获取器
 *
 * @module learning-path/helpers/bookmark-fetcher
 * @version 1.0.0
 * @since 2025-12-25
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { LearningPathInput } from "../types";
import type { BookmarkRow } from "@/types/domain";

// ============================================
// 类型定义
// ============================================

export type { BookmarkRow };

// ============================================
// 书签获取函数
// ============================================

/**
 * 根据创建选项获取书签
 */
export async function fetchBookmarks(
  userId: string,
  options: NonNullable<LearningPathInput["createOptions"]>,
): Promise<BookmarkRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("bookmarks")
    .select(
      `
      id,
      title,
      url,
      platform,
      ai_tags,
      ai_summary,
      created_at
    `,
    )
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (options.bookmarkIds?.length) {
    query = query.in("id", options.bookmarkIds);
  } else if (options.folderId) {
    query = query.eq("folder_id", options.folderId);
  } else if (options.tag) {
    query = query.contains("user_tags", [options.tag]);
  } else {
    // 根据主题搜索
    query = query.or(
      `title.ilike.%${options.topic}%,ai_tags.cs.{${options.topic}}`,
    );
  }

  query = query.order("created_at", { ascending: true }).limit(30);

  const { data, error } = await query;

  if (error) {
    logger.error({ error }, "LearningPathSkill: Failed to fetch bookmarks");
    throw new Error(`获取书签失败: ${error.message}`);
  }

  return (data || []) as BookmarkRow[];
}

/**
 * 获取最近的书签
 */
export async function fetchRecentBookmarks(
  userId: string,
  limit: number,
): Promise<BookmarkRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookmarks")
    .select(`id, title, url, platform, ai_tags, ai_summary, created_at`)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error(
      { error },
      "LearningPathSkill: Failed to fetch recent bookmarks",
    );
    return [];
  }

  return (data || []) as BookmarkRow[];
}
