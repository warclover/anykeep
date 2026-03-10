/**
 * 建议持久化服务
 *
 * 将 v2 organizeInbox() 的聚类结果转换为 OrganizationSuggestion，
 * 持久化到 organization_suggestions 表，返回前端期望的 OrganizationAnalysis 格式。
 *
 * @version 1.0.0
 * @since 2026-03-10
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { OrganizeResult, InboxCluster } from "../batch/inbox-organize";
import type {
  OrganizationAnalysis,
  OrganizationSuggestion,
  SuggestionInput,
} from "../types/legacy-compat";

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 将 organizeInbox 结果持久化为建议，返回 OrganizationAnalysis
 *
 * 流程：
 * 1. 删除用户旧的 pending 建议
 * 2. 将每个聚类转换为 SuggestionInput
 * 3. 批量插入 organization_suggestions 表
 * 4. 返回前端期望的 OrganizationAnalysis 格式
 */
export async function persistOrganizeResult(
  supabase: SupabaseClient,
  userId: string,
  result: OrganizeResult,
): Promise<OrganizationAnalysis> {
  const totalBookmarkCount =
    result.clusters.reduce((sum, c) => sum + c.bookmarks.length, 0) +
    result.unclustered.length;

  // 无聚类 → 直接返回空结果
  if (result.clusters.length === 0) {
    return {
      inboxCount: totalBookmarkCount,
      suggestions: [],
      lastAnalyzedAt: null,
      nextSuggestedAnalyzeAt: null,
    };
  }

  // 1. 删除旧 pending 建议
  await deletePendingSuggestions(supabase, userId);

  // 2. 转换聚类为建议输入
  const inputs = result.clusters.map(clusterToSuggestionInput);

  // 3. 批量插入
  const saved = await createSuggestionBatch(supabase, userId, inputs);

  logger.info(
    {
      userId,
      clusterCount: result.clusters.length,
      savedCount: saved.length,
      totalMs: result.totalMs,
    },
    "SuggestionPersist: saved organize results",
  );

  // 4. 返回 OrganizationAnalysis
  return {
    inboxCount: totalBookmarkCount,
    suggestions: saved,
    lastAnalyzedAt: new Date(),
    nextSuggestedAnalyzeAt: getNextAnalyzeDate(),
  };
}

// ============================================================================
// 内部函数
// ============================================================================

/**
 * 将聚类转换为 SuggestionInput
 */
function clusterToSuggestionInput(cluster: InboxCluster): SuggestionInput {
  const bookmarkIds = cluster.bookmarks.map((b) => Number(b.id));
  const sampleTitles = cluster.bookmarks
    .slice(0, 3)
    .map((b) => b.title)
    .filter(Boolean);

  if (cluster.suggestedFolderId && !cluster.suggestCreateNew) {
    // 移动到现有文件夹
    return {
      suggestionType: "move_to_existing",
      bookmarkIds,
      targetFolderId: cluster.suggestedFolderId,
      suggestedFolderName: cluster.suggestedFolderName ?? undefined,
      confidence: cluster.confidence,
      reason: `${bookmarkIds.length} 个书签与文件夹 "${cluster.suggestedFolderName}" 相似`,
      sampleTitles,
    };
  }

  // 建议创建新文件夹
  return {
    suggestionType: "create_new",
    bookmarkIds,
    suggestedFolderName: cluster.suggestedNewFolderName ?? undefined,
    confidence: cluster.confidence,
    reason: `${bookmarkIds.length} 个相似书签可组成新分类`,
    sampleTitles,
  };
}

/**
 * 删除用户旧的 pending 建议
 */
async function deletePendingSuggestions(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("organization_suggestions")
    .delete()
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) {
    // 表不存在时静默跳过
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return;
    }
    logger.warn(
      { error: error.message, userId },
      "SuggestionPersist: failed to delete old suggestions",
    );
  }
}

/**
 * 批量创建建议
 */
async function createSuggestionBatch(
  supabase: SupabaseClient,
  userId: string,
  inputs: SuggestionInput[],
): Promise<OrganizationSuggestion[]> {
  if (inputs.length === 0) return [];

  const insertData = inputs.map((input) => ({
    user_id: userId,
    suggestion_type: input.suggestionType,
    bookmark_ids: input.bookmarkIds,
    target_folder_id: input.targetFolderId ?? null,
    suggested_folder_name: input.suggestedFolderName ?? null,
    confidence: input.confidence,
    reason: input.reason ?? null,
    sample_titles: input.sampleTitles ?? [],
    status: "pending",
  }));

  const { data, error } = await supabase
    .from("organization_suggestions")
    .insert(insertData)
    .select();

  if (error) {
    logger.error(
      { error: error.message, userId },
      "SuggestionPersist: batch insert failed",
    );
    throw new Error(`Failed to create suggestions: ${error.message}`);
  }

  return (data || []).map(mapRowToSuggestion);
}

/**
 * 数据库行 → OrganizationSuggestion
 */
function mapRowToSuggestion(
  row: Record<string, unknown>,
): OrganizationSuggestion {
  return {
    id: row.id as number,
    userId: row.user_id as string,
    suggestionType:
      row.suggestion_type as OrganizationSuggestion["suggestionType"],
    bookmarkIds: (row.bookmark_ids as number[]) || [],
    targetFolderId: row.target_folder_id as number | null,
    suggestedFolderName: row.suggested_folder_name as string | null,
    confidence: row.confidence as number,
    reason: row.reason as string | null,
    sampleTitles: (row.sample_titles as string[]) || [],
    status: row.status as OrganizationSuggestion["status"],
    createdAt: new Date(row.created_at as string),
    respondedAt: row.responded_at ? new Date(row.responded_at as string) : null,
  };
}

/**
 * 计算下次建议分析日期（3 天后）
 */
function getNextAnalyzeDate(): Date {
  const next = new Date();
  next.setDate(next.getDate() + 3);
  return next;
}
