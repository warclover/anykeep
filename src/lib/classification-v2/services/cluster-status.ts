/**
 * 聚类处理状态查询
 *
 * 从旧 InboxOrganizerService.getClusterProcessingStatus() 精简迁入。
 * 纯函数式设计，不依赖类实例。
 *
 * @version 1.0.0
 * @since 2026-03-10
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClusterProcessingStatus } from "../types/legacy-compat";
import { logger } from "@/lib/logger";

/**
 * 获取用户的聚类处理状态
 *
 * 查询内容：
 * 1. 待聚类书签数量（pending_cluster = true）
 * 2. 已聚类数量（不同 cluster_id 计数）
 * 3. 待确认建议数量
 * 4. 最后处理时间
 * 5. 下次计划处理时间（凌晨 4:00）
 */
export async function getClusterProcessingStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<ClusterProcessingStatus> {
  // 并行查询，提升性能
  const [pendingResult, clusterResult, suggestionResult, lastProcessedResult] =
    await Promise.all([
      // 1. 待聚类书签数量
      supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("pending_cluster", true)
        .is("deleted_at", null),

      // 2. 已聚类的 cluster_id
      supabase
        .from("bookmarks")
        .select("cluster_id")
        .eq("user_id", userId)
        .not("cluster_id", "is", null)
        .is("deleted_at", null),

      // 3. 待确认建议数量
      supabase
        .from("classification_suggestions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending")
        .eq("suggested_action", "create_folder"),

      // 4. 最后处理时间
      supabase
        .from("bookmarks")
        .select("updated_at")
        .eq("user_id", userId)
        .not("cluster_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

  // 处理错误（非阻塞）
  if (pendingResult.error) {
    logger.warn(
      { error: pendingResult.error.message, userId },
      "ClusterStatus: failed to get pending count",
    );
  }
  if (clusterResult.error) {
    logger.warn(
      { error: clusterResult.error.message, userId },
      "ClusterStatus: failed to get cluster IDs",
    );
  }

  // 统计不同 cluster_id
  const uniqueClusterIds = new Set(
    (clusterResult.data ?? []).map(
      (b: { cluster_id: string | null }) => b.cluster_id,
    ),
  );

  // 下次 cron 时间（凌晨 4:00）
  const now = new Date();
  const nextScheduledAt = new Date(now);
  nextScheduledAt.setHours(4, 0, 0, 0);
  if (nextScheduledAt <= now) {
    nextScheduledAt.setDate(nextScheduledAt.getDate() + 1);
  }

  return {
    pendingClusterCount: pendingResult.count ?? 0,
    clusterCount: uniqueClusterIds.size,
    lastProcessedAt: lastProcessedResult.data?.updated_at
      ? new Date(lastProcessedResult.data.updated_at as string)
      : null,
    nextScheduledAt,
    hasPendingSuggestions: (suggestionResult.count ?? 0) > 0,
  };
}
