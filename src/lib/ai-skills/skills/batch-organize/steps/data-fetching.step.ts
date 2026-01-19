/**
 * 数据获取步骤
 *
 * 职责：
 * - 获取书签数据
 * - 获取文件夹数据
 *
 * @module ai-skills/skills/batch-organize/steps/data-fetching
 * @version 1.0.0
 * @since 2025-12-25
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { BATCH_ORGANIZE_CONFIG, SKILL_ERROR_CODES } from "../../../config";
import { SkillExecutionError } from "../../../core/base-skill";
import type { BatchOrganizeInput } from "../types";
import type { BookmarkRow, FolderRow } from "./types";

// ============================================
// 书签获取
// ============================================

/**
 * 获取书签数据
 */
export async function fetchBookmarks(
  userId: string,
  input: BatchOrganizeInput,
): Promise<BookmarkRow[]> {
  // 详细日志记录查询参数
  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      scope: input.scope,
      hasFilter: !!input.filter,
      filterBookmarkCount: input.filter?.bookmarkIds?.length,
      folderId: input.filter?.folderId,
      platforms: input.filter?.platforms,
    },
    "BatchOrganizeSkill: Fetching bookmarks with params",
  );

  // 安全检查：验证书签 ID 数量
  if (
    input.filter?.bookmarkIds &&
    input.filter.bookmarkIds.length > BATCH_ORGANIZE_CONFIG.MAX_BOOKMARK_IDS
  ) {
    throw new SkillExecutionError(
      `单次最多处理 ${BATCH_ORGANIZE_CONFIG.MAX_BOOKMARK_IDS} 条书签，当前请求 ${input.filter.bookmarkIds.length} 条`,
      SKILL_ERROR_CODES.INPUT_TOO_LARGE,
    );
  }

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
      user_tags,
      ai_summary,
      folder_id,
      created_at,
      folders!bookmarks_folder_id_fkey(name)
    `,
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // 根据范围筛选
  switch (input.scope) {
    case "uncategorized":
      query = query.is("folder_id", null);
      break;
    case "untagged":
      query = query.or("user_tags.is.null,user_tags.eq.{}");
      break;
    case "selected":
      if (input.filter?.bookmarkIds?.length) {
        query = query.in("id", input.filter.bookmarkIds);
      }
      break;
    // case "all": 不添加额外筛选，获取全部书签
  }

  // 应用筛选条件
  if (input.filter?.folderId) {
    query = query.eq("folder_id", input.filter.folderId);
  }
  if (input.filter?.platforms?.length) {
    query = query.in("platform", input.filter.platforms);
  }

  const { data, error } = await query.limit(
    BATCH_ORGANIZE_CONFIG.MAX_BOOKMARKS_LIMIT,
  );

  if (error) {
    logger.error(
      { error, userId: userId.slice(0, 8) + "...", scope: input.scope },
      "BatchOrganizeSkill: Failed to fetch bookmarks",
    );
    throw new Error(`获取书签失败: ${error.message}`);
  }

  // 记录查询结果
  logger.info(
    {
      userId: userId.slice(0, 8) + "...",
      scope: input.scope,
      resultCount: data?.length || 0,
    },
    "BatchOrganizeSkill: Bookmarks fetched successfully",
  );

  return (data || []) as unknown as BookmarkRow[];
}

// ============================================
// 文件夹获取
// ============================================

/**
 * 获取用户文件夹
 */
export async function fetchFolders(userId: string): Promise<FolderRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("folders")
    .select("id, name")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or("is_archived.is.null,is_archived.eq.false");

  if (error) {
    logger.error({ error }, "BatchOrganizeSkill: Failed to fetch folders");
    return [];
  }

  return (data || []) as unknown as FolderRow[];
}
