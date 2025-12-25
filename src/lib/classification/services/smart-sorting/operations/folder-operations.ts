/**
 * 文件夹操作模块
 *
 * @module classification/smart-sorting/operations/folder-operations
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import { operationLogService } from "../../operation-log.service";
import type { SupabaseClientType, Cluster } from "../types";

// ============================================
// 重复检查
// ============================================

/**
 * 检查重复文件夹
 */
export async function checkDuplicateFolder(
  supabase: SupabaseClientType,
  userId: string,
  folderName: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("folders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .ilike("name", folderName)
    .is("deleted_at", null);

  return (count ?? 0) > 0;
}

// ============================================
// 自动创建文件夹
// ============================================

/**
 * 自动创建文件夹（Level 1 模式）
 */
export async function autoCreateFolder(
  supabase: SupabaseClientType,
  userId: string,
  cluster: Cluster,
): Promise<void> {
  // 检查重复
  let finalName = cluster.suggestedName || "新文件夹";
  let isDuplicate = await checkDuplicateFolder(supabase, userId, finalName);
  let suffix = 1;

  while (isDuplicate && suffix <= 10) {
    finalName = `${cluster.suggestedName} (${suffix})`;
    isDuplicate = await checkDuplicateFolder(supabase, userId, finalName);
    suffix++;
  }

  // 创建文件夹（处理并发冲突）
  let folder;
  let createAttempts = 0;
  const maxCreateAttempts = 3;

  while (createAttempts < maxCreateAttempts) {
    const { data: newFolder, error: folderError } = await supabase
      .from("folders")
      .insert({
        user_id: userId,
        name: finalName,
        source: "auto_created",
        is_system: false,
      })
      .select()
      .single();

    if (!folderError && newFolder) {
      folder = newFolder;
      break;
    }

    // 处理唯一约束冲突（code 23505）
    if (folderError?.code === "23505") {
      createAttempts++;
      finalName = `${cluster.suggestedName || "新文件夹"} (${Date.now() % 10000})`;
      logger.warn(
        { finalName, attempt: createAttempts },
        "SmartSorting: Folder name conflict, retrying",
      );
      continue;
    }

    throw new Error(`创建文件夹失败: ${folderError?.message}`);
  }

  if (!folder) {
    throw new Error("创建文件夹失败：超过最大重试次数");
  }

  // 移动书签到新文件夹
  const bookmarkIds = cluster.bookmarks.map((b) => b.id);
  const { error: moveError } = await supabase
    .from("bookmarks")
    .update({
      folder_id: folder.id,
      pending_cluster: false,
      pending_since: null,
      cluster_id: null,
      cluster_confidence: null,
    })
    .in("id", bookmarkIds);

  if (moveError) {
    throw new Error(`移动书签失败: ${moveError.message}`);
  }

  // 创建操作快照（支持撤销）
  await operationLogService.createFolderWithNotification(
    userId,
    {
      id: folder.id,
      name: finalName,
      parent_id: null,
    },
    cluster.bookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      folder_id: null, // 之前在待整理
    })),
    cluster.suggestedNameReason || "AI 自动聚类创建",
  );

  // Note: compute_folder_profile 是 V4.2 RPC 函数
  await supabase.rpc("compute_folder_profile", {
    p_folder_id: folder.id,
  });

  logger.info(
    { folderName: finalName, bookmarkCount: bookmarkIds.length },
    "SmartSorting: Auto-created folder",
  );
}

// ============================================
// 聚类更新
// ============================================

/**
 * 更新书签的聚类 ID
 */
export async function updateBookmarkClusters(
  supabase: SupabaseClientType,
  clusters: Cluster[],
): Promise<void> {
  for (const cluster of clusters) {
    const bookmarkIds = cluster.bookmarks.map((b) => b.id);

    // Note: cluster_id, cluster_confidence 是 V4.2 新增字段
    await supabase
      .from("bookmarks")
      .update({
        cluster_id: cluster.id,
        cluster_confidence: cluster.avgSimilarity,
      })
      .in("id", bookmarkIds);
  }
}
