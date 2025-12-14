/**
 * Classification Analytics API
 * V4.2 分类分析 API
 *
 * GET /api/classification/analytics - 获取分类分析数据
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { preferenceLearner } from "@/lib/classification/learning/preference-learner";
import { profileUpdater } from "@/lib/classification/learning/profile-updater";
import { fastPathCacheManager } from "@/lib/classification/router/cache-manager";
import type { NextRequest } from "next/server";

// ============================================================================
// 类型定义
// ============================================================================

interface AnalyticsQueryParams {
  /** 分析类型 */
  type?: "overview" | "preferences" | "sources" | "health" | "trends";
  /** 时间范围（天） */
  days?: number;
}

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

// ============================================================================
// GET - 获取分类分析数据
// ============================================================================

/**
 * GET /api/classification/analytics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const type =
      (searchParams.get("type") as AnalyticsQueryParams["type"]) || "overview";
    const days = parseInt(searchParams.get("days") || "30", 10);

    // 根据类型返回不同分析数据
    switch (type) {
      case "overview":
        return successResponse(await getOverviewAnalytics(user.id, days));
      case "preferences":
        return successResponse(await getPreferencesAnalytics(user.id));
      case "sources":
        return successResponse(await getSourcesAnalytics(user.id));
      case "health":
        return successResponse(await getHealthAnalytics(user.id));
      case "trends":
        return successResponse(await getTrendsAnalytics(user.id, days));
      default:
        return successResponse(await getOverviewAnalytics(user.id, days));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "GET /api/classification/analytics error",
    );
    return internalError("获取分类分析数据失败");
  }
}

// ============================================================================
// 分析函数
// ============================================================================

/**
 * 获取概览分析
 */
async function getOverviewAnalytics(userId: string, days: number) {
  const supabase = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // 并行获取各项统计
  const [bookmarkStats, folderStats, sourceStats, learningStats, cacheStats] =
    await Promise.all([
      // 书签统计
      getBookmarkStats(supabase, userId, startDate),
      // 文件夹统计
      getFolderStats(supabase, userId),
      // 来源统计
      getSourceStats(userId),
      // 学习统计
      preferenceLearner.getLearningStats(userId),
      // 缓存统计
      Promise.resolve(fastPathCacheManager.getStats()),
    ]);

  return {
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
  };
}

/**
 * 获取偏好分析
 */
async function getPreferencesAnalytics(userId: string) {
  const preferences = await preferenceLearner.getUserPreferences(userId);

  return {
    folderPreferences: preferences.folderPreferences.slice(0, 20),
    sourcePreferences: preferences.sourcePreferences.slice(0, 20),
    timePreferences: preferences.timePreferences,
    exclusions: preferences.exclusions,
    lastUpdated: preferences.lastUpdated.toISOString(),
  };
}

/**
 * 获取来源分析
 */
async function getSourcesAnalytics(userId: string) {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sources } = await (supabase as any)
    .from("source_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("sample_count", { ascending: false });

  if (!sources || sources.length === 0) {
    return {
      totalSources: 0,
      byType: [],
      topSources: [],
      trustDistribution: {
        high: 0,
        medium: 0,
        low: 0,
      },
    };
  }

  // 按类型统计
  const typeCount = new Map<string, number>();
  const trustDistribution = { high: 0, medium: 0, low: 0 };
  const totalSamples = sources.reduce(
    (sum: number, s: { sample_count: number }) => sum + s.sample_count,
    0,
  );

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

  const byType: SourceDistribution[] = [...typeCount.entries()].map(
    ([sourceType, count]) => ({
      sourceType,
      count,
      percentage: Math.round((count / sources.length) * 100),
    }),
  );

  const topSources = sources
    .slice(0, 20)
    .map(
      (s: {
        source_id: string;
        source_name: string;
        source_type: string;
        sample_count: number;
        trust_score: number;
        avg_confidence: number | null;
      }) => ({
        sourceId: s.source_id,
        sourceName: s.source_name,
        sourceType: s.source_type,
        sampleCount: s.sample_count,
        trustScore: s.trust_score,
        avgConfidence: s.avg_confidence,
      }),
    );

  return {
    totalSources: sources.length,
    totalSamples,
    byType,
    topSources,
    trustDistribution,
  };
}

/**
 * 获取健康分析
 */
async function getHealthAnalytics(userId: string) {
  const healthStatus = await profileUpdater.getHealthStatus(userId);
  const cacheStats = fastPathCacheManager.getStats();

  return {
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
  };
}

/**
 * 获取趋势分析
 */
async function getTrendsAnalytics(userId: string, days: number) {
  const supabase = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // 获取书签创建趋势
  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("created_at, folder_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  // 按日期分组
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

  // 转换为趋势数组
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
      fastPath: Math.round(stats.classified * 0.7), // 估计值
      slowPath: Math.round(stats.classified * 0.3), // 估计值
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 计算文件夹分布趋势
  const folderDistribution = await getFolderDistribution(
    supabase,
    userId,
    startDate,
  );

  return {
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
  };
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
  const { data: bookmarks, count } = await supabase
    .from("bookmarks")
    .select("folder_id, created_at", { count: "exact" })
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
  const { data: folders, count } = await supabase
    .from("folders")
    .select("id, name", { count: "exact" })
    .eq("user_id", userId)
    .eq("is_archived", false);

  // 获取每个文件夹的书签数
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

  // 排序
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
  // 获取时间段内的书签及其文件夹
  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("folder_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", startDate.toISOString());

  if (!bookmarks || bookmarks.length === 0) {
    return [];
  }

  // 统计每个文件夹的书签数
  const folderCounts = new Map<number, number>();
  for (const bookmark of bookmarks) {
    if (bookmark.folder_id) {
      folderCounts.set(
        bookmark.folder_id,
        (folderCounts.get(bookmark.folder_id) || 0) + 1,
      );
    }
  }

  // 获取文件夹名称
  const folderIds = [...folderCounts.keys()];
  const { data: folders } = await supabase
    .from("folders")
    .select("id, name")
    .in("id", folderIds);

  const folderNameMap = new Map<number, string>();
  for (const folder of folders || []) {
    folderNameMap.set(folder.id, folder.name);
  }

  // 构建分布数据
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

  // 按数量排序
  distribution.sort((a, b) => b.bookmarkCount - a.bookmarkCount);

  return distribution.slice(0, 15);
}
