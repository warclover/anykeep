/**
 * V4.2 聚类建议 API
 * GET /api/classification/cluster-suggestions - 获取待确认的聚类建议
 */

import { createClient } from "@/lib/supabase/server";
import { v42Table, type SuggestionV42Fields, type BookmarkV42Fields } from "@/lib/supabase/v42-types";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/classification/cluster-suggestions
 * 获取待确认的聚类建议（来自智能分拣 cron）
 */
export async function GET() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 获取待确认的聚类建议
    // Note: bookmark_ids, suggested_action, metadata 是 V4.2 新增字段
    const { data: suggestions, error: fetchError } = await v42Table(supabase)
      .from("classification_suggestions")
      .select(`
        id,
        suggested_folder_name,
        bookmark_ids,
        confidence,
        reason,
        created_at,
        metadata
      `)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .eq("suggested_action", "create_folder")
      .order("created_at", { ascending: false })
      .limit(20);

    if (fetchError) {
      logger.error(
        { error: fetchError, userId: user.id },
        "Failed to fetch cluster suggestions",
      );
      return internalError("获取聚类建议失败");
    }

    // 3. 获取书签标题（用于示例展示）
    // 类型断言
    type SuggestionRow = {
      id: number;
      suggested_folder_name: string | null;
      bookmark_ids: number[] | null;
      confidence: number;
      reason: string | null;
      created_at: string;
    };
    const typedSuggestions = (suggestions || []) as SuggestionRow[];
    const allBookmarkIds = typedSuggestions.flatMap((s) => s.bookmark_ids ?? []);

    let bookmarkTitles: Record<number, string> = {};
    if (allBookmarkIds.length > 0) {
      const { data: bookmarks } = await supabase
        .from("bookmarks")
        .select("id, title")
        .in("id", allBookmarkIds);

      bookmarkTitles = (bookmarks || []).reduce((acc, b) => {
        acc[b.id] = b.title;
        return acc;
      }, {} as Record<number, string>);
    }

    // 4. 格式化建议数据
    const formattedSuggestions = typedSuggestions.map((s) => {
      const bookmarkIds = s.bookmark_ids ?? [];
      const sampleTitles = bookmarkIds
        .slice(0, 5)
        .map((id) => bookmarkTitles[id] || `书签 #${id}`)
        .filter(Boolean);

      return {
        id: s.id,
        suggestedFolderName: s.suggested_folder_name,
        bookmarkIds,
        sampleTitles,
        confidence: s.confidence,
        reason: s.reason,
        createdAt: s.created_at,
      };
    });

    // 5. 获取聚类处理状态
    // Note: pending_cluster, cluster_id 是 V4.2 新增字段
    const { count: pendingClusterCount } = await v42Table(supabase)
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("pending_cluster", true)
      .is("deleted_at", null);

    const { data: clusterData } = await v42Table(supabase)
      .from("bookmarks")
      .select("cluster_id")
      .eq("user_id", user.id)
      .not("cluster_id", "is", null)
      .is("deleted_at", null);

    const clusterDataTyped = (clusterData || []) as Array<{ cluster_id: string | null }>;
    const uniqueClusterIds = new Set(clusterDataTyped.map(b => b.cluster_id).filter(Boolean));
    const clusterCount = uniqueClusterIds.size;

    // 计算下次 cron 时间（凌晨 4:00）
    const now = new Date();
    const nextCronTime = new Date(now);
    nextCronTime.setHours(4, 0, 0, 0);
    if (nextCronTime <= now) {
      nextCronTime.setDate(nextCronTime.getDate() + 1);
    }

    const clusterStatus = {
      pendingClusterCount: pendingClusterCount ?? 0,
      clusterCount,
      lastProcessedAt: null,
      nextScheduledAt: nextCronTime,
      hasPendingSuggestions: formattedSuggestions.length > 0,
    };

    logger.info(
      {
        userId: user.id,
        suggestionCount: formattedSuggestions.length,
        pendingClusterCount: clusterStatus.pendingClusterCount,
      },
      "Cluster suggestions fetched",
    );

    return successResponse({
      suggestions: formattedSuggestions,
      clusterStatus,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/cluster-suggestions error",
    );
    return internalError("获取聚类建议失败");
  }
}
