/**
 * Classification Analytics API v1
 *
 * GET /api/v1/classification/analytics - 获取分类分析数据
 *
 * 支持的分析类型（通过 type 参数指定）：
 * - overview: 概览分析（默认）
 * - preferences: 偏好分析
 * - sources: 来源分析
 * - health: 健康分析
 * - trends: 趋势分析
 * - statistics: 周期统计
 * - history: 建议历史
 * - abtest: A/B 测试
 *
 * @module api/v1/classification/analytics
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { preferenceLearner } from "@/lib/classification/learning/preference-learner";
import { profileUpdater } from "@/lib/classification/learning/profile-updater";
import { fastPathCacheManager } from "@/lib/classification/router/cache-manager";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";

const PENDING_CONFIRMATIONS_TABLE = "pending_confirmations" as const;

type AnalyticsType =
  | "overview"
  | "preferences"
  | "sources"
  | "health"
  | "trends"
  | "statistics";

/**
 * GET /api/v1/classification/analytics
 * 获取分类分析数据
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") as AnalyticsType) || "overview";

    switch (type) {
      case "overview":
        return handleOverview(userId, supabase, searchParams);
      case "preferences":
        return handlePreferences(userId);
      case "sources":
        return handleSources(userId, supabase);
      case "health":
        return handleHealth(userId);
      case "trends":
        return handleTrends(userId, supabase, searchParams);
      case "statistics":
        return handleStatistics(userId, supabase, searchParams);
      default:
        return handleOverview(userId, supabase, searchParams);
    }
  },
);

/**
 * 概览分析
 */
async function handleOverview(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams,
) {
  const days = parseInt(searchParams.get("days") || "30", 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [bookmarkStats, folderStats, learningStats, cacheStats] =
    await Promise.all([
      getBookmarkStats(supabase, userId, startDate),
      getFolderStats(supabase, userId),
      preferenceLearner.getLearningStats(userId),
      Promise.resolve(fastPathCacheManager.getStats()),
    ]);

  return NextResponse.json({
    success: true,
    data: {
      type: "overview",
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      bookmarks: bookmarkStats,
      folders: folderStats,
      learning: learningStats,
      cache: {
        hitRate: cacheStats.hitRate,
        size: cacheStats.size,
      },
      generatedAt: new Date().toISOString(),
    },
  });
}

/**
 * 偏好分析
 */
async function handlePreferences(userId: string) {
  const preferences = await preferenceLearner.getUserPreferences(userId);

  return NextResponse.json({
    success: true,
    data: {
      type: "preferences",
      folderPreferences: preferences.folderPreferences.slice(0, 20),
      sourcePreferences: preferences.sourcePreferences.slice(0, 20),
      timePreferences: preferences.timePreferences,
      exclusions: preferences.exclusions,
      lastUpdated: preferences.lastUpdated.toISOString(),
    },
  });
}

/**
 * 来源分析
 */
async function handleSources(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sources } = await (supabase as any)
    .from("source_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("sample_count", { ascending: false });

  if (!sources || sources.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        type: "sources",
        totalSources: 0,
        byType: [],
        topSources: [],
        trustDistribution: { high: 0, medium: 0, low: 0 },
      },
    });
  }

  const typeCount = new Map<string, number>();
  const trustDistribution = { high: 0, medium: 0, low: 0 };

  for (const source of sources) {
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

  const byType = [...typeCount.entries()].map(([sourceType, count]) => ({
    sourceType,
    count,
    percentage: Math.round((count / sources.length) * 100),
  }));

  const topSources = sources
    .slice(0, 20)
    .map(
      (s: {
        source_id: string;
        source_name: string;
        source_type: string;
        sample_count: number;
        trust_score: number;
      }) => ({
        sourceId: s.source_id,
        sourceName: s.source_name,
        sourceType: s.source_type,
        sampleCount: s.sample_count,
        trustScore: s.trust_score,
      }),
    );

  return NextResponse.json({
    success: true,
    data: {
      type: "sources",
      totalSources: sources.length,
      byType,
      topSources,
      trustDistribution,
    },
  });
}

/**
 * 健康分析
 */
async function handleHealth(userId: string) {
  const healthStatus = await profileUpdater.getHealthStatus(userId);
  const cacheStats = fastPathCacheManager.getStats();

  return NextResponse.json({
    success: true,
    data: {
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
                (healthStatus.healthyProfiles / healthStatus.totalProfiles) *
                  100,
              )
            : 0,
      },
      cache: {
        hitRate: Math.round(cacheStats.hitRate * 10) / 10,
        size: cacheStats.size,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
      },
      recommendations: healthStatus.recommendations,
      lastUpdated: healthStatus.lastUpdated?.toISOString() || null,
    },
  });
}

/**
 * 趋势分析
 */
async function handleTrends(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams,
) {
  const days = parseInt(searchParams.get("days") || "30", 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("created_at, folder_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  const dailyStats = new Map<string, { total: number; classified: number }>();

  for (const bookmark of bookmarks || []) {
    if (!bookmark.created_at) continue;
    const date = new Date(bookmark.created_at).toISOString().split("T")[0];
    const stats = dailyStats.get(date) || { total: 0, classified: 0 };
    stats.total++;
    if (bookmark.folder_id) stats.classified++;
    dailyStats.set(date, stats);
  }

  const trends: Array<{ date: string; total: number; classified: number }> = [];
  const currentDate = new Date(startDate);

  while (currentDate <= new Date()) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const stats = dailyStats.get(dateStr) || { total: 0, classified: 0 };
    trends.push({ date: dateStr, ...stats });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return NextResponse.json({
    success: true,
    data: {
      type: "trends",
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      daily: trends,
      summary: {
        totalBookmarks: bookmarks?.length || 0,
        avgPerDay: Math.round(((bookmarks?.length || 0) / days) * 10) / 10,
        classificationRate:
          bookmarks && bookmarks.length > 0
            ? Math.round(
                (bookmarks.filter((b) => b.folder_id).length /
                  bookmarks.length) *
                  100,
              )
            : 0,
      },
    },
  });
}

/**
 * 周期统计
 */
async function handleStatistics(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams,
) {
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
  }

  // 托管模式统计
  const effectiveConfig = await trustModeService.getEffectiveConfig(userId);
  const trustModeStats = {
    mode: effectiveConfig.mode,
    autoDecisionsToday: effectiveConfig.stats.autoDecisions,
    userCorrections: effectiveConfig.stats.userCorrections,
    pendingConfirmations: effectiveConfig.stats.pendingConfirmations,
    correctionRate: effectiveConfig.stats.correctionRate,
  };

  // 待确认统计
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let confirmationQuery = (supabase as any)
    .from(PENDING_CONFIRMATIONS_TABLE)
    .select("status")
    .eq("user_id", userId);

  if (startDate) {
    confirmationQuery = confirmationQuery.gte(
      "created_at",
      startDate.toISOString(),
    );
  }

  const { data: confirmationData } = await confirmationQuery;

  const confirmationStats = {
    pending: 0,
    confirmed: 0,
    rejected: 0,
    modified: 0,
    expired: 0,
  };
  for (const item of confirmationData || []) {
    const status = item.status as keyof typeof confirmationStats;
    if (status in confirmationStats) confirmationStats[status]++;
  }

  // 书签分类统计
  let classifiedQuery = supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("folder_id", "is", null);

  let unclassifiedQuery = supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
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

  const bookmarkStats = {
    total: (classifiedResult.count || 0) + (unclassifiedResult.count || 0),
    classified: classifiedResult.count || 0,
    unclassified: unclassifiedResult.count || 0,
  };

  return NextResponse.json({
    success: true,
    data: {
      type: "statistics",
      period,
      trustMode: trustModeStats,
      confirmations: confirmationStats,
      bookmarks: bookmarkStats,
      generatedAt: new Date().toISOString(),
    },
  });
}

// 辅助函数
async function getBookmarkStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  startDate: Date,
) {
  const { data: bookmarks, count } = await supabase
    .from("bookmarks")
    .select("folder_id", { count: "exact" })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", startDate.toISOString());

  const classified = bookmarks?.filter((b) => b.folder_id).length || 0;

  return {
    total: count || 0,
    periodTotal: bookmarks?.length || 0,
    classified,
    unclassified: (bookmarks?.length || 0) - classified,
    classificationRate:
      bookmarks && bookmarks.length > 0
        ? Math.round((classified / bookmarks.length) * 100)
        : 0,
  };
}

async function getFolderStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: folders, count } = await supabase
    .from("folders")
    .select("id, name", { count: "exact" })
    .eq("user_id", userId)
    .eq("is_archived", false);

  return {
    total: count || 0,
    folders: folders || [],
  };
}
