/**
 * 待整理智能整理 API（合并版）— v2
 *
 * 合并 inbox + cluster-suggestions + cluster-stats 三个端点
 *
 * GET /api/classification/inbox?type=analyze - 分析待整理文件夹（默认）
 * GET /api/classification/inbox?type=suggestions - 获取聚类建议（原 /cluster-suggestions）
 * GET /api/classification/inbox?type=stats - 获取聚类统计（原 /cluster-stats）
 * POST /api/classification/inbox - 应用整理建议
 * DELETE /api/classification/inbox - 拒绝整理建议
 *
 * @version 3.0.0 (Phase 5: 切换到 classification-v2)
 * @since 2025-12-24
 * @updated 2026-03-10 - 迁移到 v2 organizeInbox + 独立服务
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { organizeInbox } from "@/lib/classification-v2";
import { persistOrganizeResult } from "@/lib/classification-v2/services/suggestion-persist";
import {
  applySuggestion,
  rejectSuggestion,
} from "@/lib/classification-v2/services/suggestion-action";
import { getClusterProcessingStatus } from "@/lib/classification-v2/services/cluster-status";
import {
  successResponse,
  handleValidationError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { PerformanceMonitor } from "@/lib/utils/performance-monitor";
import type { BookmarkV42Fields } from "@/lib/classification-v2/types/legacy-compat";
import { withAuthMiddleware } from "@/lib/api/middleware";

// ============================================================================
// 常量和类型
// ============================================================================

type InboxQueryType = "analyze" | "suggestions" | "stats";

/**
 * API 超时配置
 * - 主分析操作不应超过 15 秒（考虑到数据库查询可能较慢）
 */
const API_TIMEOUT_MS = 15000;

/**
 * HTTP 缓存配置
 */
const CACHE_CONTROL_HEADER = "private, max-age=60, stale-while-revalidate=30";

/**
 * 应用建议 Schema
 */
const applySuggestionSchema = z.object({
  suggestionId: z.number().int().positive(),
});

/**
 * 拒绝建议 Schema
 */
const rejectSuggestionSchema = z.object({
  suggestionId: z.number().int().positive(),
});

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 带超时的 Promise 包装器
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`操作超时: ${operation} 超过 ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

// ============================================================================
// GET - 统一查询入口
// ============================================================================

/**
 * GET /api/classification/inbox
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  // 解析查询参数
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") as InboxQueryType) || "analyze";

  // 路由到对应的处理函数
  switch (type) {
    case "analyze":
      return handleAnalyze(userId);
    case "suggestions":
      return handleSuggestions(userId);
    case "stats":
      return handleStats(userId);
    default:
      return handleAnalyze(userId);
  }
});

// ============================================================================
// GET 处理函数
// ============================================================================

/**
 * 分析待整理文件夹（默认）
 * v2: 使用 organizeInbox() + persistOrganizeResult()
 */
async function handleAnalyze(userId: string) {
  const monitor = new PerformanceMonitor("InboxAnalysis");

  const supabase = await monitor.measure("CreateClient", () => createClient());
  monitor.mark("AuthComplete", { userId });

  // 调用 v2 organizeInbox
  const organizeResult = await monitor.measure(
    "OrganizeInbox",
    () => withTimeout(organizeInbox(userId), API_TIMEOUT_MS, "OrganizeInbox"),
    { userId },
  );

  // 将聚类结果持久化为建议
  const analysis = await monitor.measure("PersistResult", () =>
    persistOrganizeResult(supabase, userId, organizeResult),
  );

  // 获取聚类处理状态
  const clusterStatus = await monitor.measure("GetClusterStatus", () =>
    withTimeout(
      getClusterProcessingStatus(supabase, userId),
      2000,
      "GetClusterStatus",
    ).catch(() => ({
      pendingClusterCount: 0,
      processingCount: 0,
      lastProcessedAt: null,
    })),
  );

  // 性能日志
  const perfReport = monitor.getReport();
  const pendingClusterCount =
    typeof clusterStatus === "object" && clusterStatus !== null
      ? ((clusterStatus as { pendingClusterCount?: number })
          .pendingClusterCount ?? 0)
      : 0;
  logger.info(
    {
      userId,
      inboxCount: analysis.inboxCount,
      suggestionCount: analysis.suggestions.length,
      pendingClusterCount,
      performance: {
        totalMs: Math.round(perfReport.totalDuration),
        stages: perfReport.entries.map((e) => ({
          name: e.name,
          ms: Math.round(e.duration),
        })),
        slowOperations: perfReport.slowEntries.map((e) => e.name),
      },
    },
    "Inbox analysis completed (v2)",
  );

  // 返回分析结果
  const responseData = {
    success: true,
    type: "analyze",
    data: {
      ...analysis,
      clusterStatus,
      ...(process.env.NODE_ENV === "development" && {
        _performance: monitor.toJSON(),
      }),
    },
  };

  return NextResponse.json(responseData, {
    status: 200,
    headers: {
      "Cache-Control": CACHE_CONTROL_HEADER,
    },
  });
}

/**
 * 获取聚类建议（原 /cluster-suggestions）
 * 纯 DB 查询，保持不变
 */
async function handleSuggestions(userId: string) {
  const supabase = await createClient();

  type SuggestionRow = {
    id: number;
    suggested_folder_name: string | null;
    bookmark_id: number | null;
    bookmark_ids: number[] | null;
    suggested_action: string | null;
    confidence: number | null;
    reason: string | null;
    metadata: unknown;
    created_at: string;
  };
  const { data: suggestions, error: fetchError } = (await supabase
    .from("classification_suggestions")
    .select(
      `
        id,
        suggested_folder_name,
        bookmark_id,
        bookmark_ids,
        suggested_action,
        confidence,
        reason,
        metadata,
        created_at
      `,
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20)) as unknown as {
    data: SuggestionRow[] | null;
    error: { message: string } | null;
  };

  if (fetchError) {
    logger.error(
      { error: fetchError, userId },
      "Failed to fetch cluster suggestions",
    );
    return internalError("获取聚类建议失败");
  }

  // 获取书签标题
  const getBookmarkIds = (s: SuggestionRow): number[] => {
    if (s.bookmark_ids && s.bookmark_ids.length > 0) {
      return s.bookmark_ids;
    }
    return s.bookmark_id ? [s.bookmark_id] : [];
  };

  const allBookmarkIds = (suggestions || []).flatMap(getBookmarkIds);

  let bookmarkTitles: Record<number, string> = {};
  if (allBookmarkIds.length > 0) {
    type BookmarkIdTitle = { id: number; title: string | null };
    const { data: bookmarks } = (await supabase
      .from("bookmarks")
      .select("id, title")
      .in("id", allBookmarkIds)) as unknown as {
      data: BookmarkIdTitle[] | null;
      error: unknown;
    };

    bookmarkTitles = (bookmarks || []).reduce(
      (acc, b) => {
        acc[b.id] = b.title ?? `书签 #${b.id}`;
        return acc;
      },
      {} as Record<number, string>,
    );
  }

  // 格式化建议数据
  const formattedSuggestions = (suggestions || []).map((s) => {
    const bookmarkIds = getBookmarkIds(s);
    const sampleTitles = bookmarkIds
      .slice(0, 5)
      .map((id: number) => bookmarkTitles[id] || `书签 #${id}`)
      .filter(Boolean);

    return {
      id: s.id,
      suggestedFolderName: s.suggested_folder_name,
      suggestedAction: s.suggested_action || "move_to_folder",
      bookmarkIds,
      sampleTitles,
      confidence: s.confidence,
      reason: s.reason,
      metadata: s.metadata,
      createdAt: s.created_at,
    };
  });

  // 获取聚类处理状态
  const clusterStatus = await getClusterProcessingStatus(supabase, userId);

  logger.info(
    {
      userId,
      suggestionCount: formattedSuggestions.length,
      pendingClusterCount: clusterStatus.pendingClusterCount,
    },
    "Cluster suggestions fetched",
  );

  return successResponse({
    type: "suggestions",
    suggestions: formattedSuggestions,
    clusterStatus,
  });
}

/**
 * 获取聚类统计（原 /cluster-stats）
 * 纯 DB 查询，保持不变
 */
async function handleStats(userId: string) {
  const supabase = await createClient();

  type ClusterStats = {
    total_pending: number;
    clustered_count: number;
    unclustered_count: number;
    cluster_count: number;
    oldest_pending: string | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase.rpc as any)(
    "get_user_cluster_stats",
    {
      p_user_id: userId,
    },
  )) as { data: ClusterStats[] | null; error: { message: string } | null };

  if (error) {
    logger.warn({ error }, "cluster-stats RPC error, using fallback");
    // RPC 不存在时回退到直接查询
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("bookmarks")
      .select("id, pending_cluster, pending_since, cluster_id")
      .eq("user_id", userId)
      .eq("pending_cluster", true)
      .is("deleted_at", null);

    if (fallbackError) {
      return NextResponse.json({ error: "获取统计失败" }, { status: 500 });
    }

    const bookmarks = (fallbackData || []) as Array<
      { id: number } & BookmarkV42Fields
    >;
    const totalPending = bookmarks.length;
    const clusteredCount = bookmarks.filter((b) => b.cluster_id).length;
    const unclusteredCount = totalPending - clusteredCount;
    const clusterIds = new Set(
      bookmarks.filter((b) => b.cluster_id).map((b) => b.cluster_id),
    );
    const clusterCount = clusterIds.size;
    const oldestPending = bookmarks.reduce((oldest: string | null, b) => {
      if (!b.pending_since) return oldest;
      if (!oldest) return b.pending_since;
      return new Date(b.pending_since) < new Date(oldest)
        ? b.pending_since
        : oldest;
    }, null);

    return NextResponse.json({
      success: true,
      type: "stats",
      data: {
        totalPending,
        clusteredCount,
        unclusteredCount,
        clusterCount,
        oldestPending,
      },
    });
  }

  const stats = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    success: true,
    type: "stats",
    data: {
      totalPending: stats?.total_pending || 0,
      clusteredCount: stats?.clustered_count || 0,
      unclusteredCount: stats?.unclustered_count || 0,
      clusterCount: stats?.cluster_count || 0,
      oldestPending: stats?.oldest_pending || null,
    },
  });
}

// ============================================================================
// POST - 应用建议
// ============================================================================

/**
 * POST /api/classification/inbox
 * 应用整理建议 (v2)
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const body = await request.json();
  const validation = applySuggestionSchema.safeParse(body);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const { suggestionId } = validation.data;

  try {
    await applySuggestion(supabase, userId, suggestionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("not found") || message.includes("Unauthorized")) {
      return notFoundError("建议不存在或已过期");
    }
    throw error;
  }

  logger.info({ userId, suggestionId }, "Suggestion applied (v2)");

  return successResponse({ success: true });
});

// ============================================================================
// DELETE - 拒绝建议
// ============================================================================

/**
 * DELETE /api/classification/inbox
 * 拒绝整理建议 (v2)
 */
export const DELETE = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const body = await request.json();
  const validation = rejectSuggestionSchema.safeParse(body);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const { suggestionId } = validation.data;

  try {
    await rejectSuggestion(supabase, userId, suggestionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("not found") || message.includes("Unauthorized")) {
      return notFoundError("建议不存在或已过期");
    }
    throw error;
  }

  logger.info({ userId, suggestionId }, "Suggestion rejected (v2)");

  return successResponse({ success: true });
});
