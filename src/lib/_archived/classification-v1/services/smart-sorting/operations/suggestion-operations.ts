/**
 * 建议操作模块
 *
 * @module classification/smart-sorting/operations/suggestion-operations
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import type { SupabaseClientType, Cluster, FolderSuggestion } from "../types";

// ============================================
// 创建建议
// ============================================

/**
 * 创建文件夹建议（Level 2/3 模式）
 */
export async function createSuggestion(
  supabase: SupabaseClientType,
  userId: string,
  cluster: Cluster,
  autonomyLevel: number,
): Promise<void> {
  const bookmarkIds = cluster.bookmarks.map((b) => b.id);
  const sampleTitles = cluster.bookmarks.slice(0, 5).map((b) => b.title);

  // Note: organization_suggestions 是 V4.2 建议表
  const { error } = await supabase.from("organization_suggestions").insert({
    user_id: userId,
    suggestion_type: "create_new",
    bookmark_ids: bookmarkIds,
    suggested_folder_name: cluster.suggestedName,
    confidence: Math.round(cluster.avgSimilarity * 100),
    reason: cluster.suggestedNameReason,
    sample_titles: sampleTitles,
    status: "pending",
  });

  if (error) {
    throw new Error(`创建建议失败: ${error.message}`);
  }

  logger.info(
    { folderName: cluster.suggestedName, autonomyLevel },
    "SmartSorting: Created suggestion",
  );
}

// ============================================
// 获取建议预览
// ============================================

/**
 * 获取用户的聚类预览
 * 用于前端展示待确认的聚类
 */
export async function getClusterPreview(
  supabase: SupabaseClientType,
  userId: string,
): Promise<FolderSuggestion[]> {
  // Note: organization_suggestions 是 V4.2 建议表
  const { data: suggestions } = await supabase
    .from("organization_suggestions")
    .select("*")
    .eq("user_id", userId)
    .eq("suggestion_type", "create_new")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!suggestions || suggestions.length === 0) {
    return [];
  }

  return (
    suggestions as Array<{
      id: number;
      suggested_folder_name: string | null;
      reason: string | null;
      bookmark_ids: number[] | null;
      sample_titles: string[] | null;
      confidence: number;
    }>
  ).map((s) => ({
    clusterId: s.id.toString(),
    suggestedName: s.suggested_folder_name || "新文件夹",
    reason: s.reason || "",
    bookmarkIds: s.bookmark_ids || [],
    bookmarkTitles: s.sample_titles || [],
    confidence: s.confidence,
  }));
}

// ============================================
// 确认/拒绝建议
// ============================================

/**
 * 确认创建文件夹（用户批准建议）
 */
export async function confirmCreate(
  supabase: SupabaseClientType,
  userId: string,
  suggestionId: number,
  customName?: string,
): Promise<{ success: boolean; folderId?: number; error?: string }> {
  // Note: organization_suggestions 是 V4.2 建议表
  const { data: suggestion, error: fetchError } = await supabase
    .from("organization_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .single();

  if (fetchError || !suggestion) {
    return { success: false, error: "建议不存在或已处理" };
  }

  const typedSuggestion = suggestion as {
    suggested_folder_name: string | null;
    bookmark_ids: number[] | null;
  };
  const folderName =
    customName || typedSuggestion.suggested_folder_name || "新文件夹";

  // 创建文件夹
  const { data: folder, error: createError } = await supabase
    .from("folders")
    .insert({
      user_id: userId,
      name: folderName,
      source: "auto_created",
      is_system: false,
    })
    .select()
    .single();

  if (createError || !folder) {
    return {
      success: false,
      error: `创建文件夹失败: ${createError?.message}`,
    };
  }

  // Note: pending_cluster, pending_since, cluster_id, cluster_confidence 是 V4.2 新增字段
  await supabase
    .from("bookmarks")
    .update({
      folder_id: folder.id,
      pending_cluster: false,
      pending_since: null,
      cluster_id: null,
      cluster_confidence: null,
    })
    .in("id", typedSuggestion.bookmark_ids || []);

  // 更新建议状态
  await supabase
    .from("organization_suggestions")
    .update({
      status: "accepted",
      target_folder_id: folder.id,
      responded_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  // Note: compute_folder_profile 是 V4.2 RPC 函数
  await supabase.rpc("compute_folder_profile", {
    p_folder_id: folder.id,
  });

  return { success: true, folderId: folder.id };
}

/**
 * 拒绝创建建议
 */
export async function rejectCreate(
  supabase: SupabaseClientType,
  userId: string,
  suggestionId: number,
): Promise<boolean> {
  // Note: organization_suggestions 是 V4.2 建议表
  const { error } = await supabase
    .from("organization_suggestions")
    .update({
      status: "rejected",
      responded_at: new Date().toISOString(),
    })
    .eq("id", suggestionId)
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) {
    logger.error(
      { error: error.message },
      "[SmartSorting] Failed to reject suggestion",
    );
    return false;
  }

  // 清除相关书签的聚类标记（让它们重新进入聚类池）
  const { data: suggestion } = await supabase
    .from("organization_suggestions")
    .select("bookmark_ids")
    .eq("id", suggestionId)
    .single();

  const typedSuggestion = suggestion as {
    bookmark_ids: number[] | null;
  } | null;
  if (typedSuggestion?.bookmark_ids) {
    // Note: cluster_id, cluster_confidence 是 V4.2 新增字段
    await supabase
      .from("bookmarks")
      .update({
        cluster_id: null,
        cluster_confidence: null,
      })
      .in("id", typedSuggestion.bookmark_ids);
  }

  return true;
}
