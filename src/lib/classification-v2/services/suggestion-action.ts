/**
 * 建议操作服务
 *
 * 提供 applySuggestion / rejectSuggestion，
 * 从旧 InboxOrganizerService 精简迁入。
 *
 * @version 1.0.0
 * @since 2026-03-10
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { OrganizationSuggestion } from "../types/legacy-compat";

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 应用一条整理建议
 *
 * - move_to_existing: 移动书签到目标文件夹
 * - create_new: 创建新文件夹（去重检查），移动书签
 *
 * @throws Error 建议不存在 / 无权限 / 状态非 pending
 */
export async function applySuggestion(
  supabase: SupabaseClient,
  userId: string,
  suggestionId: number,
): Promise<void> {
  // 1. 查询建议
  const suggestion = await findSuggestionById(supabase, suggestionId);

  if (!suggestion) {
    throw new Error("Suggestion not found");
  }
  if (suggestion.userId !== userId) {
    throw new Error("Unauthorized");
  }
  if (suggestion.status !== "pending") {
    throw new Error("Suggestion is not pending");
  }

  // 2. 执行对应操作
  if (suggestion.suggestionType === "move_to_existing") {
    await applyMoveToExisting(supabase, userId, suggestion);
  } else if (suggestion.suggestionType === "create_new") {
    await applyCreateNew(supabase, userId, suggestion);
  }

  // 3. 标记为已接受
  await updateSuggestionStatus(supabase, suggestionId, "accepted");

  logger.info(
    {
      userId,
      suggestionId,
      type: suggestion.suggestionType,
      bookmarkCount: suggestion.bookmarkIds.length,
      action: "suggestion_applied",
    },
    "InboxV2: Suggestion applied",
  );
}

/**
 * 拒绝一条整理建议
 *
 * @throws Error 建议不存在 / 无权限
 */
export async function rejectSuggestion(
  supabase: SupabaseClient,
  userId: string,
  suggestionId: number,
): Promise<void> {
  const suggestion = await findSuggestionById(supabase, suggestionId);

  if (!suggestion) {
    throw new Error("Suggestion not found");
  }
  if (suggestion.userId !== userId) {
    throw new Error("Unauthorized");
  }

  await updateSuggestionStatus(supabase, suggestionId, "rejected");

  logger.info(
    { userId, suggestionId, action: "suggestion_rejected" },
    "InboxV2: Suggestion rejected",
  );
}

// ============================================================================
// 内部函数
// ============================================================================

/**
 * 移动书签到现有文件夹
 */
async function applyMoveToExisting(
  supabase: SupabaseClient,
  userId: string,
  suggestion: OrganizationSuggestion,
): Promise<void> {
  if (!suggestion.targetFolderId) {
    throw new Error("Target folder not specified");
  }

  await moveBookmarksToFolder(
    supabase,
    userId,
    suggestion.bookmarkIds,
    suggestion.targetFolderId,
  );
}

/**
 * 创建新文件夹（去重检查），然后移动书签
 */
async function applyCreateNew(
  supabase: SupabaseClient,
  userId: string,
  suggestion: OrganizationSuggestion,
): Promise<void> {
  if (!suggestion.suggestedFolderName) {
    throw new Error("Folder name not specified");
  }

  // 去重检查：是否已存在同名文件夹
  const { data: existingFolder } = await supabase
    .from("folders")
    .select("id, name")
    .eq("user_id", userId)
    .eq("name", suggestion.suggestedFolderName)
    .is("deleted_at", null)
    .maybeSingle();

  let targetFolderId: number;

  if (existingFolder) {
    targetFolderId = existingFolder.id;
    logger.info(
      {
        userId,
        existingFolderId: targetFolderId,
        folderName: suggestion.suggestedFolderName,
      },
      "InboxV2: Reusing existing folder",
    );
  } else {
    // 创建新文件夹
    const { data: newFolder, error } = await supabase
      .from("folders")
      .insert({
        user_id: userId,
        name: suggestion.suggestedFolderName,
        is_system: false,
        source: "clustering",
      })
      .select("id")
      .single();

    if (error) {
      logger.error(
        {
          error: error.message,
          userId,
          folderName: suggestion.suggestedFolderName,
        },
        "InboxV2: Failed to create folder",
      );
      throw new Error(`Failed to create folder: ${error.message}`);
    }

    targetFolderId = newFolder.id;
  }

  await moveBookmarksToFolder(
    supabase,
    userId,
    suggestion.bookmarkIds,
    targetFolderId,
  );
}

/**
 * 批量移动书签到目标文件夹
 */
async function moveBookmarksToFolder(
  supabase: SupabaseClient,
  userId: string,
  bookmarkIds: number[],
  folderId: number,
): Promise<void> {
  if (bookmarkIds.length === 0) return;

  const { error } = await supabase
    .from("bookmarks")
    .update({ folder_id: folderId })
    .eq("user_id", userId)
    .in("id", bookmarkIds);

  if (error) {
    throw new Error(`Failed to move bookmarks: ${error.message}`);
  }
}

/**
 * 查询单个建议
 */
async function findSuggestionById(
  supabase: SupabaseClient,
  suggestionId: number,
): Promise<OrganizationSuggestion | null> {
  const { data, error } = await supabase
    .from("organization_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch suggestion: ${error.message}`);
  }

  return {
    id: data.id as number,
    userId: data.user_id as string,
    suggestionType:
      data.suggestion_type as OrganizationSuggestion["suggestionType"],
    bookmarkIds: (data.bookmark_ids as number[]) || [],
    targetFolderId: data.target_folder_id as number | null,
    suggestedFolderName: data.suggested_folder_name as string | null,
    confidence: data.confidence as number,
    reason: data.reason as string | null,
    sampleTitles: (data.sample_titles as string[]) || [],
    status: data.status as OrganizationSuggestion["status"],
    createdAt: new Date(data.created_at as string),
    respondedAt: data.responded_at
      ? new Date(data.responded_at as string)
      : null,
  };
}

/**
 * 更新建议状态
 */
async function updateSuggestionStatus(
  supabase: SupabaseClient,
  suggestionId: number,
  status: "accepted" | "rejected",
): Promise<void> {
  const { error } = await supabase
    .from("organization_suggestions")
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  if (error) {
    throw new Error(`Failed to update suggestion status: ${error.message}`);
  }
}
