/**
 * 文件夹画像管理 API (V2.0.0 - Consolidated)
 *
 * GET /api/classification/folders/profiles - 获取用户所有文件夹画像（默认）
 * GET /api/classification/folders/profiles?type=summary - 画像概览（轻量级）
 * GET /api/classification/folders/profiles?id=X - 单个文件夹详细画像
 * POST /api/classification/folders/profiles - 计算/更新文件夹画像
 *
 * @version 2.1.0 - Merged /[id] and /summary routes
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
  notFoundError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { FolderProfileRepository } from "@/lib/folder/profile";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * 计算文件夹画像 Schema
 */
const computeProfileSchema = z.object({
  folderId: z.number().int().positive().optional(),
  all: z.boolean().optional().default(false),
});

/**
 * GET /api/classification/folders/profiles
 * @query type - 'list' (default), 'summary' for overview
 * @query id - folder ID for single folder detail
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const folderId = searchParams.get("id");

  // Route to appropriate handler
  if (folderId) {
    return handleSingleFolder(supabase, userId, parseInt(folderId, 10));
  }

  if (type === "summary") {
    return handleSummary(supabase, userId);
  }

  // Default: list all profiles
  return handleList(supabase, userId);
});

/**
 * Handle list all profiles (default)
 */
async function handleList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const folderProfileRepo = new FolderProfileRepository(supabase);
  const profiles = await folderProfileRepo.findByUserId(userId);

  return successResponse({
    profiles,
    count: profiles.length,
  });
}

/**
 * Handle summary view (lightweight)
 */
async function handleSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  // 获取所有非系统文件夹
  // 类型断言: 手动维护类型文件时需要此断言
  type FolderWithGroup = {
    id: number;
    name: string;
    folder_group: string | null;
    created_at: string;
  };
  const { data: folders, error: foldersError } = (await supabase
    .from("folders")
    .select("id, name, folder_group, created_at")
    .eq("user_id", userId)
    .eq("is_system", false)
    .is("deleted_at", null)
    .order("name")) as unknown as {
    data: FolderWithGroup[] | null;
    error: { message: string } | null;
  };

  if (foldersError) {
    throw new Error(`Failed to fetch folders: ${foldersError.message}`);
  }

  if (!folders || folders.length === 0) {
    return successResponse({
      folders: [],
      totalCount: 0,
      overallHealth: null,
    });
  }

  // 获取所有画像
  const folderProfileRepo = new FolderProfileRepository(supabase);
  const profiles = await folderProfileRepo.findByUserId(userId);
  const profileMap = new Map(profiles.map((p) => [p.folderId, p]));

  // 获取每个文件夹的书签数量
  // 类型断言: 手动维护类型文件时需要此断言
  type BookmarkFolderId = { folder_id: number | null };
  const { data: bookmarkCounts } = (await supabase
    .from("bookmarks")
    .select("folder_id")
    .eq("user_id", userId)
    .is("deleted_at", null)) as unknown as {
    data: BookmarkFolderId[] | null;
    error: unknown;
  };

  const countMap = new Map<number, number>();
  for (const b of bookmarkCounts || []) {
    if (b.folder_id) {
      countMap.set(b.folder_id, (countMap.get(b.folder_id) || 0) + 1);
    }
  }

  // 获取每个文件夹的最近书签时间
  type BookmarkActivity = { folder_id: number | null; created_at: string };
  const { data: recentBookmarks } = (await supabase
    .from("bookmarks")
    .select("folder_id, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })) as unknown as {
    data: BookmarkActivity[] | null;
    error: unknown;
  };

  const lastActivityMap = new Map<number, string>();
  for (const b of recentBookmarks || []) {
    if (b.folder_id && !lastActivityMap.has(b.folder_id)) {
      lastActivityMap.set(b.folder_id, b.created_at as string);
    }
  }

  // 构建汇总数据
  const folderSummaries = folders.map((folder) => {
    const profile = profileMap.get(folder.id);
    const bookmarkCount = countMap.get(folder.id) || 0;
    const lastActivity = lastActivityMap.get(folder.id) || null;

    // 计算简化的健康度
    let healthScore = 100;
    const issues: string[] = [];

    if (bookmarkCount === 0) {
      healthScore -= 30;
      issues.push("empty");
    } else if (bookmarkCount < 3) {
      healthScore -= 15;
      issues.push("low_count");
    }

    if (!profile) {
      healthScore -= 20;
      issues.push("no_profile");
    }

    if (profile?.internalSimilarity && profile.internalSimilarity < 0.3) {
      healthScore -= 15;
      issues.push("low_similarity");
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    let healthLevel: "excellent" | "good" | "fair" | "poor";
    if (healthScore >= 80) healthLevel = "excellent";
    else if (healthScore >= 60) healthLevel = "good";
    else if (healthScore >= 40) healthLevel = "fair";
    else healthLevel = "poor";

    return {
      id: folder.id,
      name: folder.name,
      group: folder.folder_group,
      bookmarkCount,
      topTags: (profile?.topTags || []).slice(0, 3),
      hasProfile: !!profile,
      lastActivity,
      health: {
        score: healthScore,
        level: healthLevel,
        issues,
      },
    };
  });

  // 计算整体健康度
  const totalFolders = folderSummaries.length;
  const averageHealth =
    totalFolders > 0
      ? Math.round(
          folderSummaries.reduce((sum, f) => sum + f.health.score, 0) /
            totalFolders,
        )
      : null;

  const healthDistribution = {
    excellent: folderSummaries.filter((f) => f.health.level === "excellent")
      .length,
    good: folderSummaries.filter((f) => f.health.level === "good").length,
    fair: folderSummaries.filter((f) => f.health.level === "fair").length,
    poor: folderSummaries.filter((f) => f.health.level === "poor").length,
  };

  const foldersWithProfiles = folderSummaries.filter(
    (f) => f.hasProfile,
  ).length;

  logger.info(
    {
      userId,
      totalFolders,
      foldersWithProfiles,
      averageHealth,
    },
    "Folder profiles summary fetched",
  );

  return successResponse({
    folders: folderSummaries,
    totalCount: totalFolders,
    overallHealth: {
      averageScore: averageHealth,
      distribution: healthDistribution,
      profileCoverage:
        totalFolders > 0
          ? Math.round((foldersWithProfiles / totalFolders) * 100)
          : 0,
    },
  });
}

/**
 * Handle single folder detail
 */
async function handleSingleFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  folderId: number,
) {
  if (isNaN(folderId) || folderId <= 0) {
    return notFoundError("无效的文件夹 ID");
  }

  // 验证文件夹属于当前用户
  // 类型断言: 手动维护类型文件时需要此断言
  type SingleFolderType = {
    id: number;
    name: string;
    created_at: string;
    is_system: boolean;
    folder_group: string | null;
  };
  const { data: folder, error: folderError } = (await supabase
    .from("folders")
    .select("id, name, created_at, is_system, folder_group")
    .eq("id", folderId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single()) as unknown as {
    data: SingleFolderType | null;
    error: { message: string } | null;
  };

  if (folderError || !folder) {
    return notFoundError("文件夹不存在或无权访问");
  }

  // 获取文件夹画像
  const folderProfileRepo = new FolderProfileRepository(supabase);
  const profile = await folderProfileRepo.findByFolderId(folderId);

  // 获取书签统计
  const { data: bookmarkStats } = await supabase
    .from("bookmarks")
    .select("id, created_at")
    .eq("folder_id", folderId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const bookmarks = (bookmarkStats || []) as Array<{
    id: number;
    created_at: string;
  }>;
  const bookmarkCount = bookmarks.length;

  // 计算分类统计（从 classification_feedback 获取）
  const { data: feedbackStats } = await supabase
    .from("classification_feedback")
    .select("feedback_type, created_at")
    .eq("folder_id", folderId)
    .eq("user_id", userId);

  const feedback = (feedbackStats || []) as Array<{
    feedback_type: string;
    created_at: string;
  }>;
  const confirmCount = feedback.filter(
    (f) => f.feedback_type === "confirm" || f.feedback_type === "helpful",
  ).length;
  const rejectCount = feedback.filter(
    (f) => f.feedback_type === "reject" || f.feedback_type === "wrong_folder",
  ).length;

  // 标签统计（从文件夹画像获取）
  const tagStats = (profile?.topTags || [])
    .map((tag, index) => ({
      tag,
      count: Math.max(1, bookmarkCount - index),
      percentage: Math.round(
        ((bookmarkCount - index) / Math.max(1, bookmarkCount)) * 100,
      ),
    }))
    .slice(0, 10);

  // 计算活跃度（最近 30 天的书签数）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentBookmarks = bookmarks.filter(
    (b) => new Date(b.created_at as string) > thirtyDaysAgo,
  );
  const activityScore = Math.min(100, recentBookmarks.length * 10);

  // 计算健康度评分
  const healthScore = calculateHealthScore({
    bookmarkCount,
    hasProfile: !!profile,
    internalSimilarity: profile?.internalSimilarity || 0,
    topTagsCount: profile?.topTags?.length || 0,
    confirmRate:
      confirmCount + rejectCount > 0
        ? confirmCount / (confirmCount + rejectCount)
        : 0.5,
    activityScore,
  });

  // 构建可视化数据
  const visualizationData = {
    basic: {
      id: folder.id,
      name: folder.name,
      group: folder.folder_group,
      isSystem: folder.is_system,
      createdAt: folder.created_at,
      bookmarkCount,
    },
    content: {
      topTags: profile?.topTags || [],
      sampleTitles: profile?.sampleTitles || [],
      tagStats,
      internalSimilarity: profile?.internalSimilarity || null,
      hasEmbedding: !!profile?.profileEmbedding?.length,
    },
    classification: {
      totalFeedback: confirmCount + rejectCount,
      confirmCount,
      rejectCount,
      confirmRate:
        confirmCount + rejectCount > 0
          ? Math.round((confirmCount / (confirmCount + rejectCount)) * 100)
          : null,
    },
    activity: {
      recentBookmarks: recentBookmarks.length,
      lastBookmarkAt: bookmarks[0]?.created_at || null,
      activityScore,
      activityLevel: getActivityLevel(activityScore),
    },
    health: {
      score: healthScore.score,
      level: healthScore.level,
      issues: healthScore.issues,
      suggestions: healthScore.suggestions,
    },
    profile: profile
      ? {
          computedAt: profile.computedAt,
          updatedAt: profile.updatedAt,
          source: profile.source,
        }
      : null,
  };

  logger.info(
    {
      userId,
      folderId,
      folderName: folder.name,
      healthScore: healthScore.score,
    },
    "Folder profile visualization fetched",
  );

  return successResponse(visualizationData);
}

/**
 * 计算健康度评分
 */
function calculateHealthScore(metrics: {
  bookmarkCount: number;
  hasProfile: boolean;
  internalSimilarity: number;
  topTagsCount: number;
  confirmRate: number;
  activityScore: number;
}): {
  score: number;
  level: "excellent" | "good" | "fair" | "poor";
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (metrics.bookmarkCount === 0) {
    score -= 30;
    issues.push("文件夹为空");
    suggestions.push("添加一些书签以启用智能分类");
  } else if (metrics.bookmarkCount < 3) {
    score -= 15;
    issues.push("书签数量过少");
    suggestions.push("建议至少添加 3 个书签以提高分类准确度");
  }

  if (!metrics.hasProfile) {
    score -= 20;
    issues.push("尚未生成画像");
    suggestions.push("点击「刷新画像」以启用智能匹配");
  }

  if (metrics.internalSimilarity < 0.3 && metrics.bookmarkCount >= 5) {
    score -= 15;
    issues.push("内容相似度低");
    suggestions.push("考虑拆分为多个更专注的文件夹");
  }

  if (metrics.topTagsCount === 0 && metrics.bookmarkCount >= 3) {
    score -= 10;
    issues.push("缺少标签特征");
    suggestions.push("为书签添加标签以提高匹配精度");
  }

  if (metrics.confirmRate < 0.5 && metrics.bookmarkCount >= 5) {
    score -= 10;
    issues.push("分类确认率较低");
    suggestions.push("检查文件夹定位是否清晰");
  }

  if (metrics.activityScore >= 50) {
    score = Math.min(100, score + 5);
  }

  score = Math.max(0, Math.min(100, score));

  let level: "excellent" | "good" | "fair" | "poor";
  if (score >= 80) level = "excellent";
  else if (score >= 60) level = "good";
  else if (score >= 40) level = "fair";
  else level = "poor";

  return { score, level, issues, suggestions };
}

/**
 * 获取活跃度等级
 */
function getActivityLevel(
  score: number,
): "high" | "medium" | "low" | "inactive" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  if (score > 0) return "low";
  return "inactive";
}

/**
 * POST /api/classification/folders/profiles
 * 计算/更新文件夹画像
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  // 1. 解析并验证请求体
  const body = await request.json();
  const validation = computeProfileSchema.safeParse(body);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const { folderId, all } = validation.data;
  const folderProfileRepo = new FolderProfileRepository(supabase);

  let computedCount = 0;

  if (all) {
    // 计算所有文件夹画像
    computedCount = await folderProfileRepo.computeUserProfiles(userId);

    logger.info(
      {
        userId,
        computedCount,
      },
      "All folder profiles computed",
    );
  } else if (folderId) {
    // 计算单个文件夹画像
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id")
      .eq("id", folderId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (folderError || !folder) {
      return notFoundError("文件夹不存在或无权访问");
    }

    await folderProfileRepo.computeProfile(folderId);
    computedCount = 1;

    logger.info(
      {
        userId,
        folderId,
      },
      "Folder profile computed",
    );
  } else {
    return handleValidationError(
      new z.ZodError([
        {
          code: "custom",
          message: "请指定 folderId 或 all=true",
          path: [],
        },
      ]),
    );
  }

  // 返回计算结果
  return successResponse({
    success: true,
    computedCount,
  });
});
