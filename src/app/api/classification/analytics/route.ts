/**
 * Classification Analytics API（合并版）
 *
 * 合并 analytics + statistics + history + ab-test 四个端点
 *
 * GET /api/classification/analytics?type=overview - 概览分析（默认）
 * GET /api/classification/analytics?type=preferences - 偏好分析
 * GET /api/classification/analytics?type=sources - 来源分析
 * GET /api/classification/analytics?type=health - 健康分析
 * GET /api/classification/analytics?type=trends - 趋势分析
 * GET /api/classification/analytics?type=statistics - 周期统计（原 /statistics）
 * GET /api/classification/analytics?type=history - 建议历史（原 /history）
 * GET /api/classification/analytics?type=abtest - A/B 测试（原 /ab-test）
 *
 * @version 2.1.0 (Phase 1 合并)
 * @since 2025-12-24
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { successResponse, internalError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { preferenceLearner } from "@/lib/classification-learning/preference-learner";
import { profileUpdater } from "@/lib/classification-learning/profile-updater";
import { fastPathCacheManager } from "@/lib/classification/router/cache-manager";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import { embeddingABTestService } from "@/lib/classification/services/server";
import {
  getEmbeddingConfig,
  getEmbeddingConfigInfo,
} from "@/lib/embedding/embedding-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { withAuthMiddleware } from "@/lib/api/middleware";

// ============================================================================
// 类型定义
// ============================================================================

// 扩展 Database 类型以支持 source_profiles
interface SourceProfileRow {
  id: number;
  user_id: string;
  source_id: string;
  source_name: string | null;
  source_type: string;
  sample_count: number;
  trust_score: number;
  avg_confidence: number | null;
  // 其他字段省略
}

type ExtendedDatabase = Database & {
  public: {
    Tables: {
      source_profiles: {
        Row: SourceProfileRow;
        Insert: unknown;
        Update: unknown;
      };
    };
  };
};

type AnalyticsType =
  | "overview"
  | "preferences"
  | "sources"
  | "health"
  | "trends"
  | "statistics"
  | "history"
  | "abtest";

interface ClassificationTrend {
  date: string;
  total: number;
  autoClassified: number;
  manuallyClassified: number;
  fastPath: number;
  slowPath: number;
}

interface FolderDistribution {
  folderId: number;
  folderName: string;
  bookmarkCount: number;
  percentage: number;
}

interface SourceDistribution {
  sourceType: string;
  count: number;
  percentage: number;
}

interface SuggestionHistoryItem {
  id: number;
  bookmarkId: number;
  bookmarkTitle: string;
  suggestedFolderName: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected" | "expired";
  reason: string | null;
  suggestNewFolder: boolean;
  createdAt: string;
  processedAt: string | null;
}

// 表名常量
const PENDING_CONFIRMATIONS_TABLE = "pending_confirmations" as const;
const SOURCE_PROFILES_TABLE = "source_profiles" as const;

// ============================================================================
// GET - 统一分析入口
// ============================================================================

/**
 * GET /api/classification/analytics
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  // 解析查询参数
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") as AnalyticsType) || "overview";

  // 路由到对应的分析函数
  switch (type) {
    case "overview":
      return handleOverview(userId, searchParams);
    case "preferences":
      return handlePreferences(userId);
    case "sources":
      return handleSources(userId);
    case "health":
      return handleHealth(userId);
    case "trends":
      return handleTrends(userId, searchParams);
    case "statistics":
      return handleStatistics(userId, searchParams);
    case "history":
      return handleHistory(userId, searchParams);
    case "abtest":
      return handleABTest(userId, searchParams);
    default:
      return handleOverview(userId, searchParams);
  }
});

// ============================================================================
// 分析处理函数
// ============================================================================

/**
 * 概览分析
 */
async function handleOverview(userId: string, searchParams: URLSearchParams) {
  const days = parseInt(searchParams.get("days") || "30", 10);
  const supabase = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [bookmarkStats, folderStats, sourceStats, learningStats, cacheStats] =
    await Promise.all([
      getBookmarkStats(supabase, userId, startDate),
      getFolderStats(supabase, userId),
      getSourceStats(userId),
      preferenceLearner.getLearningStats(userId),
      Promise.resolve(fastPathCacheManager.getStats()),
    ]);

  return successResponse({
    type: "overview",
    period: {
      days,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
    },
    bookmarks: bookmarkStats,
    folders: folderStats,
    sources: sourceStats,
    learning: learningStats,
    cache: {
      hitRate: cacheStats.hitRate,
      size: cacheStats.size,
    },
    generatedAt: new Date().toISOString(),
  });
}

/**
 * 偏好分析
 */
async function handlePreferences(userId: string) {
  const preferences = await preferenceLearner.getUserPreferences(userId);

  return successResponse({
    type: "preferences",
    folderPreferences: preferences.folderPreferences.slice(0, 20),
    sourcePreferences: preferences.sourcePreferences.slice(0, 20),
    timePreferences: preferences.timePreferences,
    exclusions: preferences.exclusions,
    lastUpdated: preferences.lastUpdated.toISOString(),
  });
}

/**
 * 来源分析
 */
async function handleSources(userId: string) {
  const supabase = await createClient();
  // Safe cast since we know the table structure in this context
  const typedSupabase = supabase as SupabaseClient<ExtendedDatabase>;

  const { data: sources } = await typedSupabase
    .from("source_profiles")
    .select(
      "source_id, source_name, source_type, sample_count, trust_score, avg_confidence",
    )
    .eq("user_id", userId)
    .order("sample_count", { ascending: false });

  if (!sources || sources.length === 0) {
    return successResponse({
      type: "sources",
      totalSources: 0,
      byType: [],
      topSources: [],
      trustDistribution: { high: 0, medium: 0, low: 0 },
    });
  }

  const typeCount = new Map<string, number>();
  const trustDistribution = { high: 0, medium: 0, low: 0 };
  // 显式类型断言以避免 never 类型推断问题
  const typedSources = sources as SourceProfileRow[];
  const totalSamples = typedSources.reduce(
    (sum: number, s) => sum + s.sample_count,
    0,
  );

  for (const source of typedSources) {
    typeCount.set(
      source.source_type,
      (typeCount.get(source.source_type) || 0) + 1,
    );

    if (source.trust_score >= 70) {
      trustDistribution.high++;
    } else if (source.trust_score >= 40) {
      trustDistribution.medium++;
    } else {
      trustDistribution.low++;
    }
  }

  const byType: SourceDistribution[] = [...typeCount.entries()].map(
    ([sourceType, count]) => ({
      sourceType,
      count,
      percentage: Math.round((count / sources.length) * 100),
    }),
  );

  const topSources = typedSources.slice(0, 20).map((s) => ({
    sourceId: s.source_id,
    sourceName: s.source_name,
    sourceType: s.source_type,
    sampleCount: s.sample_count,
    trustScore: s.trust_score,
    avgConfidence: s.avg_confidence,
  }));

  return successResponse({
    type: "sources",
    totalSources: sources.length,
    totalSamples,
    byType,
    topSources,
    trustDistribution,
  });
}

/**
 * 健康分析
 */
async function handleHealth(userId: string) {
  const healthStatus = await profileUpdater.getHealthStatus(userId);
  const cacheStats = fastPathCacheManager.getStats();

  return successResponse({
    type: "health",
    profiles: {
      total: healthStatus.totalProfiles,
      healthy: healthStatus.healthyProfiles,
      stale: healthStatus.staleProfiles,
      lowSample: healthStatus.lowSampleProfiles,
      duplicate: healthStatus.duplicateProfiles,
      healthPercentage:
        healthStatus.totalProfiles > 0
          ? Math.round(
              (healthStatus.healthyProfiles / healthStatus.totalProfiles) * 100,
            )
          : 0,
    },
    cache: {
      hitRate: Math.round(cacheStats.hitRate * 10) / 10,
      size: cacheStats.size,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      lastCleanup: cacheStats.lastCleanup?.toISOString() || null,
    },
    recommendations: healthStatus.recommendations,
    lastUpdated: healthStatus.lastUpdated?.toISOString() || null,
  });
}

/**
 * 趋势分析
 */
async function handleTrends(userId: string, searchParams: URLSearchParams) {
  const days = parseInt(searchParams.get("days") || "30", 10);
  const supabase = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("created_at, folder_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  const dailyStats = new Map<
    string,
    { total: number; classified: number; unclassified: number }
  >();

  for (const bookmark of bookmarks || []) {
    if (!bookmark.created_at) continue;
    const date = new Date(bookmark.created_at).toISOString().split("T")[0];
    const stats = dailyStats.get(date) || {
      total: 0,
      classified: 0,
      unclassified: 0,
    };

    stats.total++;
    if (bookmark.folder_id) {
      stats.classified++;
    } else {
      stats.unclassified++;
    }

    dailyStats.set(date, stats);
  }

  const trends: ClassificationTrend[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= new Date()) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const stats = dailyStats.get(dateStr) || {
      total: 0,
      classified: 0,
      unclassified: 0,
    };

    trends.push({
      date: dateStr,
      total: stats.total,
      autoClassified: stats.classified,
      manuallyClassified: stats.unclassified,
      fastPath: Math.round(stats.classified * 0.7),
      slowPath: Math.round(stats.classified * 0.3),
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const folderDistribution = await getFolderDistribution(
    supabase,
    userId,
    startDate,
  );

  return successResponse({
    type: "trends",
    period: {
      days,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
    },
    daily: trends,
    folderDistribution,
    summary: {
      totalBookmarks: bookmarks?.length || 0,
      avgPerDay: Math.round(((bookmarks?.length || 0) / days) * 10) / 10,
      classificationRate:
        bookmarks && bookmarks.length > 0
          ? Math.round(
              (bookmarks.filter((b) => b.folder_id).length / bookmarks.length) *
                100,
            )
          : 0,
    },
  });
}

/**
 * 周期统计（原 /statistics）
 */
async function handleStatistics(userId: string, searchParams: URLSearchParams) {
  const supabase = await createClient();
  const period =
    (searchParams.get("period") as "today" | "week" | "month" | "all") || "all";

  let startDate: Date | null = null;
  const now = new Date();

  switch (period) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "all":
    default:
      startDate = null;
  }

  // 获取托管模式统计
  const effectiveConfig = await trustModeService.getEffectiveConfig(userId);
  const trustModeStats = {
    mode: effectiveConfig.mode,
    autoDecisionsToday: effectiveConfig.stats.autoDecisions,
    userCorrections: effectiveConfig.stats.userCorrections,
    pendingConfirmations: effectiveConfig.stats.pendingConfirmations,
    correctionRate: effectiveConfig.stats.correctionRate,
  };

  // 获取待确认统计
  interface ConfirmationStatusRow {
    status: string;
  }

  let confirmationQuery = supabase
    .from(PENDING_CONFIRMATIONS_TABLE)
    .select("status", { count: "exact" })
    .eq("user_id", userId);

  if (startDate) {
    confirmationQuery = confirmationQuery.gte(
      "created_at",
      startDate.toISOString(),
    );
  }

  const { data: confirmationData, error: confirmationError } =
    await confirmationQuery.returns<ConfirmationStatusRow[]>();

  const confirmationStats = {
    pending: 0,
    confirmed: 0,
    rejected: 0,
    modified: 0,
    expired: 0,
  };

  if (!confirmationError && confirmationData) {
    for (const item of confirmationData) {
      const status = item.status as keyof typeof confirmationStats;
      if (status in confirmationStats) {
        confirmationStats[status]++;
      }
    }
  }

  // 获取来源画像统计
  const typedSupabase = supabase as SupabaseClient<ExtendedDatabase>;
  const { data: sourceData, error: sourceError } = await typedSupabase
    .from(SOURCE_PROFILES_TABLE)
    .select("source_type, sample_count, trust_score")
    .eq("user_id", userId);

  const sourceStats = {
    totalSources: 0,
    byType: { wechat: 0, website: 0, app: 0, unknown: 0 },
    totalSamples: 0,
    avgTrustScore: 0,
    highTrustSources: 0,
  };

  if (!sourceError && sourceData) {
    // 显式类型断言以避免 never 类型推断问题
    const typedSourceData = sourceData as Pick<
      SourceProfileRow,
      "source_type" | "sample_count" | "trust_score"
    >[];
    sourceStats.totalSources = typedSourceData.length;
    let totalTrustScore = 0;

    for (const item of typedSourceData) {
      const sourceType = item.source_type as keyof typeof sourceStats.byType;
      if (sourceType in sourceStats.byType) {
        sourceStats.byType[sourceType]++;
      }
      sourceStats.totalSamples += item.sample_count || 0;
      totalTrustScore += item.trust_score || 0;
      if (item.trust_score > 70) {
        sourceStats.highTrustSources++;
      }
    }

    if (sourceStats.totalSources > 0) {
      sourceStats.avgTrustScore = Math.round(
        totalTrustScore / sourceStats.totalSources,
      );
    }
  }

  // 获取书签分类统计
  let classifiedQuery = supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("is_in_trash", false)
    .not("folder_id", "is", null);

  let unclassifiedQuery = supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("is_in_trash", false)
    .is("folder_id", null);

  if (startDate) {
    classifiedQuery = classifiedQuery.gte(
      "created_at",
      startDate.toISOString(),
    );
    unclassifiedQuery = unclassifiedQuery.gte(
      "created_at",
      startDate.toISOString(),
    );
  }

  const [classifiedResult, unclassifiedResult] = await Promise.all([
    classifiedQuery,
    unclassifiedQuery,
  ]);

  const classifiedCount = classifiedResult.count || 0;
  const unclassifiedCount = unclassifiedResult.count || 0;

  const bookmarkStats = {
    total: classifiedCount + unclassifiedCount,
    classified: classifiedCount,
    unclassified: unclassifiedCount,
  };

  const efficiency = {
    autoClassificationRate:
      bookmarkStats.total > 0
        ? Math.round(
            (trustModeStats.autoDecisionsToday /
              Math.max(bookmarkStats.total, 1)) *
              100,
          )
        : 0,
    confirmationAcceptRate:
      confirmationStats.confirmed + confirmationStats.rejected > 0
        ? Math.round(
            (confirmationStats.confirmed /
              (confirmationStats.confirmed + confirmationStats.rejected)) *
              100,
          )
        : 0,
    fastPathHitRate: 0,
  };

  return successResponse({
    type: "statistics",
    period,
    trustMode: trustModeStats,
    confirmations: confirmationStats,
    sources: sourceStats,
    bookmarks: bookmarkStats,
    efficiency,
    generatedAt: new Date().toISOString(),
  });
}

/**
 * 建议历史（原 /history）
 */
async function handleHistory(userId: string, searchParams: URLSearchParams) {
  const supabase = await createClient();
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");
  const status = searchParams.get("status");

  let query = supabase
    .from("classification_suggestions")
    .select(
      `
      id,
      bookmark_id,
      suggested_folder_name,
      suggest_new_folder,
      confidence,
      status,
      reason,
      created_at,
      processed_at,
      bookmarks!inner(title)
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (
    status &&
    ["pending", "accepted", "rejected", "expired"].includes(status)
  ) {
    query = query.eq(
      "status",
      status as "pending" | "accepted" | "rejected" | "expired",
    );
  }

  const { data: suggestions, error: suggestionsError } = await query;

  if (suggestionsError) {
    logger.error(
      { error: suggestionsError },
      "Failed to fetch classification history",
    );
    return internalError("获取分类历史失败");
  }

  // 显式指定返回类型以避免类型断言
  const { data: stats } = await supabase
    .from("classification_suggestions")
    .select("status")
    .eq("user_id", userId)
    .returns<{ status: string }[]>();

  const historyStats = {
    total: stats?.length || 0,
    accepted: stats?.filter((s) => s.status === "accepted").length || 0,
    rejected: stats?.filter((s) => s.status === "rejected").length || 0,
    pending: stats?.filter((s) => s.status === "pending").length || 0,
    acceptanceRate: 0,
  };

  const processed = historyStats.accepted + historyStats.rejected;
  if (processed > 0) {
    historyStats.acceptanceRate = Math.round(
      (historyStats.accepted / processed) * 100,
    );
  }

  const historyItems: SuggestionHistoryItem[] = (suggestions || []).map(
    (item: Record<string, unknown>) => ({
      id: item.id as number,
      bookmarkId: item.bookmark_id as number,
      bookmarkTitle:
        ((item.bookmarks as Record<string, unknown>)?.title as string) ||
        "未知标题",
      suggestedFolderName: item.suggested_folder_name as string,
      confidence: item.confidence as number,
      status: item.status as SuggestionHistoryItem["status"],
      reason: item.reason as string | null,
      suggestNewFolder: item.suggest_new_folder as boolean,
      createdAt: item.created_at as string,
      processedAt: item.processed_at as string | null,
    }),
  );

  return successResponse({
    type: "history",
    items: historyItems,
    stats: historyStats,
    pagination: {
      limit,
      offset,
      hasMore: historyItems.length === limit,
    },
  });
}

/**
 * A/B 测试（原 /ab-test）
 */
async function handleABTest(userId: string, searchParams: URLSearchParams) {
  const isComparison = searchParams.get("comparison") === "true";
  const days = parseInt(searchParams.get("days") || "7", 10);
  const operationType = searchParams.get("operation") as
    | "classification"
    | "search"
    | "similarity"
    | null;

  const configInfo = getEmbeddingConfigInfo();
  const config = getEmbeddingConfig();

  if (isComparison) {
    const controlModel = config.activeModel;
    const treatmentModel = config.abTestNewModel;

    const report = await embeddingABTestService.getComparisonReport(
      controlModel,
      treatmentModel,
      operationType || "classification",
      days,
    );

    if (!report) {
      return successResponse({
        type: "abtest",
        config: configInfo,
        comparison: null,
        message: "暂无足够数据生成对比报告",
      });
    }

    logger.info(
      {
        userId,
        controlModel,
        treatmentModel,
        days,
        recommendation: report.comparison.recommendation,
      },
      "A/B test comparison report generated",
    );

    return successResponse({
      type: "abtest",
      config: configInfo,
      comparison: report,
    });
  } else {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const summaries = await embeddingABTestService.getSummary({
      operationType: operationType || undefined,
      startDate,
    });

    const byModel: Record<
      string,
      {
        totalCount: number;
        avgExecutionTimeMs: number;
        feedbackCount: number;
        acceptanceRate: number | null;
      }
    > = {};

    summaries.forEach((s) => {
      if (!byModel[s.modelId]) {
        byModel[s.modelId] = {
          totalCount: 0,
          avgExecutionTimeMs: 0,
          feedbackCount: 0,
          acceptanceRate: null,
        };
      }
      const model = byModel[s.modelId];
      const prevTotal = model.totalCount;
      model.totalCount += s.totalCount;
      model.avgExecutionTimeMs =
        (model.avgExecutionTimeMs * prevTotal +
          s.avgExecutionTimeMs * s.totalCount) /
        model.totalCount;
      model.feedbackCount += s.feedbackCount;
    });

    Object.keys(byModel).forEach((modelId) => {
      const feedbackData = summaries
        .filter((s) => s.modelId === modelId && s.acceptanceRate !== null)
        .reduce(
          (acc, s) => {
            acc.total += s.feedbackCount;
            acc.accepted += (s.acceptanceRate || 0) * s.feedbackCount;
            return acc;
          },
          { total: 0, accepted: 0 },
        );

      if (feedbackData.total > 0) {
        byModel[modelId].acceptanceRate =
          feedbackData.accepted / feedbackData.total;
      }
    });

    return successResponse({
      type: "abtest",
      config: configInfo,
      summary: {
        period: `${days} days`,
        startDate: startDate.toISOString(),
        byModel,
        dailyData: summaries,
      },
    });
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取书签统计
 */
async function getBookmarkStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  startDate: Date,
) {
  // 使用 returns 指定返回类型
  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("folder_id, created_at", { count: "exact" })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", startDate.toISOString())
    .returns<{ folder_id: number | null; created_at: string }[]>();

  const { count } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", startDate.toISOString());

  const classified = bookmarks?.filter((b) => b.folder_id).length || 0;
  const unclassified = (bookmarks?.length || 0) - classified;

  return {
    total: count || 0,
    periodTotal: bookmarks?.length || 0,
    classified,
    unclassified,
    classificationRate:
      bookmarks && bookmarks.length > 0
        ? Math.round((classified / bookmarks.length) * 100)
        : 0,
  };
}

/**
 * 获取文件夹统计
 */
async function getFolderStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  // 使用 returns 指定返回类型
  const { data: folders } = await supabase
    .from("folders")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .returns<{ id: number; name: string }[]>();

  const { count } = await supabase
    .from("folders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_archived", false);

  const folderBookmarkCounts: Array<{
    folderId: number;
    name: string;
    count: number;
  }> = [];

  for (const folder of folders || []) {
    const { count: bookmarkCount } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("folder_id", folder.id)
      .is("deleted_at", null);

    folderBookmarkCounts.push({
      folderId: folder.id,
      name: folder.name,
      count: bookmarkCount || 0,
    });
  }

  folderBookmarkCounts.sort((a, b) => b.count - a.count);

  return {
    total: count || 0,
    topFolders: folderBookmarkCounts.slice(0, 10),
    emptyFolders: folderBookmarkCounts.filter((f) => f.count === 0).length,
  };
}

/**
 * 获取来源统计
 */
async function getSourceStats(userId: string) {
  const profiles = await profileUpdater.getHealthStatus(userId);

  return {
    totalProfiles: profiles.totalProfiles,
    healthyProfiles: profiles.healthyProfiles,
    healthPercentage:
      profiles.totalProfiles > 0
        ? Math.round((profiles.healthyProfiles / profiles.totalProfiles) * 100)
        : 0,
  };
}

/**
 * 获取文件夹分布
 */
async function getFolderDistribution(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  startDate: Date,
): Promise<FolderDistribution[]> {
  // 使用 returns 指定返回类型
  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("folder_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", startDate.toISOString())
    .returns<{ folder_id: number | null }[]>();

  if (!bookmarks || bookmarks.length === 0) {
    return [];
  }

  const folderCounts = new Map<number, number>();
  for (const bookmark of bookmarks) {
    if (bookmark.folder_id) {
      folderCounts.set(
        bookmark.folder_id,
        (folderCounts.get(bookmark.folder_id) || 0) + 1,
      );
    }
  }

  const folderIds = [...folderCounts.keys()];
  // 使用 returns 指定返回类型
  const { data: folders } = await supabase
    .from("folders")
    .select("id, name")
    .in("id", folderIds)
    .returns<{ id: number; name: string }[]>();

  const folderNameMap = new Map<number, string>();
  for (const folder of folders || []) {
    folderNameMap.set(folder.id, folder.name);
  }

  const distribution: FolderDistribution[] = [];
  const total = [...folderCounts.values()].reduce((a, b) => a + b, 0);

  for (const [folderId, count] of folderCounts.entries()) {
    distribution.push({
      folderId,
      folderName: folderNameMap.get(folderId) || `文件夹 ${folderId}`,
      bookmarkCount: count,
      percentage: Math.round((count / total) * 100),
    });
  }

  distribution.sort((a, b) => b.bookmarkCount - a.bookmarkCount);

  return distribution.slice(0, 15);
}
