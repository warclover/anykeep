/**
 * 待整理智能整理 API（合并版）
 *
 * 合并 inbox + cluster-suggestions + cluster-stats 三个端点
 *
 * GET /api/classification/inbox?type=analyze - 分析待整理文件夹（默认）
 * GET /api/classification/inbox?type=suggestions - 获取聚类建议（原 /cluster-suggestions）
 * GET /api/classification/inbox?type=stats - 获取聚类统计（原 /cluster-stats）
 * POST /api/classification/inbox - 应用整理建议
 * DELETE /api/classification/inbox - 拒绝整理建议
 *
 * @version 2.0.0 (Phase 1 合并)
 * @since 2025-12-24
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import { ClassificationContainer } from "@/lib/classification";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { PerformanceMonitor } from "@/lib/utils/performance-monitor";
import type { BookmarkV42Fields } from "@/lib/classification/types";

// ============================================================================
// 常量和类型
// ============================================================================

type InboxQueryType = "analyze" | "suggestions" | "stats";

/**
 * V4.2.15: API 超时配置
 * - 主分析操作不应超过 5 秒
 * - 超时后返回部分结果或错误
 */
const API_TIMEOUT_MS = 5000;

/**
 * V4.2.1: HTTP 缓存配置
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
export async function GET(request: NextRequest) {
  try {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") as InboxQueryType) || "analyze";

    // 路由到对应的处理函数
    switch (type) {
      case "analyze":
        return handleAnalyze();
      case "suggestions":
        return handleSuggestions();
      case "stats":
        return handleStats();
      default:
        return handleAnalyze();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "GET /api/classification/inbox error",
    );
    return internalError("获取待整理数据失败");
  }
}

// ============================================================================
// GET 处理函数
// ============================================================================

/**
 * 分析待整理文件夹（默认）
 */
async function handleAnalyze() {
  const monitor = new PerformanceMonitor("InboxAnalysis");

  try {
    // 1. 验证用户身份（使用缓存认证，性能优化）
    const { user, error: authError } = await monitor.measure("CachedAuth", () =>
      getCachedUser(),
    );

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await monitor.measure("CreateClient", () =>
      createClient(),
    );

    monitor.mark("AuthComplete", { userId: user.id });

    // 2. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const inboxOrganizerService = container.getInboxOrganizerService();
    monitor.mark("ContainerInitialized");

    // 3. 分析待整理文件夹（主要耗时操作，添加超时控制）
    const analysis = await monitor.measure(
      "InboxAnalyze",
      () =>
        withTimeout(
          inboxOrganizerService.analyze(user.id),
          API_TIMEOUT_MS,
          "InboxAnalyze",
        ),
      { userId: user.id },
    );

    // V4.2: 获取聚类处理状态
    const clusterStatus = await monitor.measure("GetClusterStatus", () =>
      withTimeout(
        inboxOrganizerService.getClusterProcessingStatus(user.id),
        2000,
        "GetClusterStatus",
      ).catch(() => ({
        pendingClusterCount: 0,
        processingCount: 0,
        lastProcessedAt: null,
      })),
    );

    // 输出性能报告
    const perfReport = monitor.getReport();
    // 类型断言: clusterStatus 可能是字符串（pending状态）或对象
    const pendingClusterCount =
      typeof clusterStatus === "object" && clusterStatus !== null
        ? ((clusterStatus as { pendingClusterCount?: number })
            .pendingClusterCount ?? 0)
        : 0;
    logger.info(
      {
        userId: user.id,
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
      "Inbox analysis completed",
    );

    // 4. 返回分析结果
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
  } catch (error) {
    const perfReport = monitor.getReport();
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          failedAt: perfReport.entries[perfReport.entries.length - 1]?.name,
        },
      },
      "Inbox analyze error",
    );
    return internalError("分析待整理文件夹失败");
  }
}

/**
 * 获取聚类建议（原 /cluster-suggestions）
 */
async function handleSuggestions() {
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
    // 类型断言: 手动维护类型文件时需要此断言
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
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20)) as unknown as {
      data: SuggestionRow[] | null;
      error: { message: string } | null;
    };

    if (fetchError) {
      logger.error(
        { error: fetchError, userId: user.id },
        "Failed to fetch cluster suggestions",
      );
      return internalError("获取聚类建议失败");
    }

    // 3. 获取书签标题
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

    // 4. 格式化建议数据
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

    // 5. 获取聚类处理状态
    const { count: pendingClusterCount } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("pending_cluster", true)
      .is("deleted_at", null);

    const { data: clusterData } = await supabase
      .from("bookmarks")
      .select("cluster_id")
      .eq("user_id", user.id)
      .not("cluster_id", "is", null)
      .is("deleted_at", null);

    const clusterDataTyped = (clusterData || []) as Array<{
      cluster_id: string | null;
    }>;
    const uniqueClusterIds = new Set(
      clusterDataTyped.map((b) => b.cluster_id).filter(Boolean),
    );
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
      type: "suggestions",
      suggestions: formattedSuggestions,
      clusterStatus,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Cluster suggestions error",
    );
    return internalError("获取聚类建议失败");
  }
}

/**
 * 获取聚类统计（原 /cluster-stats）
 */
async function handleStats() {
  try {
    const supabase = await createClient();

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    // 使用 RPC 获取聚类统计

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
        p_user_id: user.id,
      },
    )) as { data: ClusterStats[] | null; error: { message: string } | null };

    if (error) {
      logger.warn({ error }, "cluster-stats RPC error, using fallback");
      // 如果 RPC 不存在，回退到直接查询
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("bookmarks")
        .select("id, pending_cluster, pending_since, cluster_id")
        .eq("user_id", user.id)
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

    // RPC 返回的是数组，取第一个元素
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
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Cluster stats error",
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取统计失败",
      },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST - 应用建议
// ============================================================================

/**
 * POST /api/classification/inbox
 * 应用整理建议
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 创建 Supabase 客户端
    const supabase = await createClient();

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = applySuggestionSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { suggestionId } = validation.data;

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const inboxOrganizerService = container.getInboxOrganizerService();

    // 4. 应用建议
    try {
      await inboxOrganizerService.applySuggestion(user.id, suggestionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found") || message.includes("Unauthorized")) {
        return notFoundError("建议不存在或已过期");
      }
      throw error;
    }

    logger.info(
      {
        userId: user.id,
        suggestionId,
      },
      "Suggestion applied",
    );

    // 5. 返回成功
    return successResponse({ success: true });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/inbox error",
    );
    return internalError("应用建议失败");
  }
}

// ============================================================================
// DELETE - 拒绝建议
// ============================================================================

/**
 * DELETE /api/classification/inbox
 * 拒绝整理建议
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 创建 Supabase 客户端
    const supabase = await createClient();

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = rejectSuggestionSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { suggestionId } = validation.data;

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const inboxOrganizerService = container.getInboxOrganizerService();

    // 4. 拒绝建议
    try {
      await inboxOrganizerService.rejectSuggestion(user.id, suggestionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found") || message.includes("Unauthorized")) {
        return notFoundError("建议不存在或已过期");
      }
      throw error;
    }

    logger.info(
      {
        userId: user.id,
        suggestionId,
      },
      "Suggestion rejected",
    );

    // 5. 返回成功
    return successResponse({ success: true });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "DELETE /api/classification/inbox error",
    );
    return internalError("拒绝建议失败");
  }
}
