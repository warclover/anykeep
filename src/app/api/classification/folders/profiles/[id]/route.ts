/**
 * V4.0 文件夹画像详情 API
 * GET /api/classification/folders/profiles/:id - 获取单个文件夹的详细画像
 *
 * 返回可视化友好的数据结构，包括：
 * - 基本信息（名称、书签数、创建时间）
 * - 内容特征（top tags、sample titles、内部相似度）
 * - 分类统计（被分类次数、平均置信度）
 * - 健康度评分
 */

import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { FolderProfileRepository } from "@/lib/classification/repositories";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/classification/folders/profiles/:id
 * 获取单个文件夹的详细画像
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

    // 2. 获取文件夹 ID
    const { id } = await context.params;
    const folderId = parseInt(id, 10);

    if (isNaN(folderId) || folderId <= 0) {
      return notFoundError("无效的文件夹 ID");
    }

    // 3. 验证文件夹属于当前用户
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id, name, created_at, is_system, folder_group")
      .eq("id", folderId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (folderError || !folder) {
      return notFoundError("文件夹不存在或无权访问");
    }

    // 4. 获取文件夹画像
    const folderProfileRepo = new FolderProfileRepository(supabase);
    const profile = await folderProfileRepo.findByFolderId(folderId);

    // 5. 获取书签统计
    const { data: bookmarkStats } = await supabase
      .from("bookmarks")
      .select("id, created_at")
      .eq("folder_id", folderId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    const bookmarks = (bookmarkStats || []) as Array<{ id: number; created_at: string }>;
    const bookmarkCount = bookmarks.length;

    // 6. 计算分类统计（从 classification_feedback 获取）
    const { data: feedbackStats } = await supabase
      .from("classification_feedback")
      .select("feedback_type, created_at")
      .eq("folder_id", folderId)
      .eq("user_id", user.id);

    const feedback = (feedbackStats || []) as Array<{ feedback_type: string; created_at: string }>;
    // V4.0: confirm/reject 类型通过字符串比较（类型定义将在迁移后更新）
    const confirmCount = feedback.filter((f) => f.feedback_type === "confirm" || f.feedback_type === "helpful").length;
    const rejectCount = feedback.filter((f) => f.feedback_type === "reject" || f.feedback_type === "wrong_folder").length;

    // 7. 标签统计（从文件夹画像获取）
    const tagStats = (profile?.topTags || []).map((tag, index) => ({
      tag,
      count: Math.max(1, bookmarkCount - index), // 估算，实际来自画像
      percentage: Math.round(((bookmarkCount - index) / Math.max(1, bookmarkCount)) * 100),
    })).slice(0, 10);

    // 8. 计算活跃度（最近 30 天的书签数）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentBookmarks = bookmarks.filter(
      (b) => new Date(b.created_at as string) > thirtyDaysAgo
    );
    const activityScore = Math.min(100, recentBookmarks.length * 10);

    // 9. 计算健康度评分
    const healthScore = calculateHealthScore({
      bookmarkCount,
      hasProfile: !!profile,
      internalSimilarity: profile?.internalSimilarity || 0,
      topTagsCount: profile?.topTags?.length || 0,
      confirmRate: confirmCount + rejectCount > 0
        ? confirmCount / (confirmCount + rejectCount)
        : 0.5,
      activityScore,
    });

    // 10. 构建可视化数据
    const visualizationData = {
      // 基本信息
      basic: {
        id: folder.id,
        name: folder.name,
        group: folder.folder_group,
        isSystem: folder.is_system,
        createdAt: folder.created_at,
        bookmarkCount,
      },

      // 内容特征
      content: {
        topTags: profile?.topTags || [],
        sampleTitles: profile?.sampleTitles || [],
        tagStats,
        internalSimilarity: profile?.internalSimilarity || null,
        hasEmbedding: !!(profile?.profileEmbedding?.length),
      },

      // 分类统计
      classification: {
        totalFeedback: confirmCount + rejectCount,
        confirmCount,
        rejectCount,
        confirmRate: confirmCount + rejectCount > 0
          ? Math.round((confirmCount / (confirmCount + rejectCount)) * 100)
          : null,
      },

      // 活跃度
      activity: {
        recentBookmarks: recentBookmarks.length,
        lastBookmarkAt: bookmarks[0]?.created_at || null,
        activityScore,
        activityLevel: getActivityLevel(activityScore),
      },

      // 健康度
      health: {
        score: healthScore.score,
        level: healthScore.level,
        issues: healthScore.issues,
        suggestions: healthScore.suggestions,
      },

      // 画像元数据
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
        userId: user.id,
        folderId,
        folderName: folder.name,
        healthScore: healthScore.score,
      },
      "Folder profile visualization fetched",
    );

    return successResponse(visualizationData);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/folders/profiles/:id error",
    );
    return internalError("获取文件夹画像失败");
  }
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

  // 1. 书签数量检查
  if (metrics.bookmarkCount === 0) {
    score -= 30;
    issues.push("文件夹为空");
    suggestions.push("添加一些书签以启用智能分类");
  } else if (metrics.bookmarkCount < 3) {
    score -= 15;
    issues.push("书签数量过少");
    suggestions.push("建议至少添加 3 个书签以提高分类准确度");
  }

  // 2. 画像检查
  if (!metrics.hasProfile) {
    score -= 20;
    issues.push("尚未生成画像");
    suggestions.push("点击「刷新画像」以启用智能匹配");
  }

  // 3. 内部相似度检查
  if (metrics.internalSimilarity < 0.3 && metrics.bookmarkCount >= 5) {
    score -= 15;
    issues.push("内容相似度低");
    suggestions.push("考虑拆分为多个更专注的文件夹");
  }

  // 4. 标签覆盖检查
  if (metrics.topTagsCount === 0 && metrics.bookmarkCount >= 3) {
    score -= 10;
    issues.push("缺少标签特征");
    suggestions.push("为书签添加标签以提高匹配精度");
  }

  // 5. 确认率检查
  if (metrics.confirmRate < 0.5 && metrics.bookmarkCount >= 5) {
    score -= 10;
    issues.push("分类确认率较低");
    suggestions.push("检查文件夹定位是否清晰");
  }

  // 6. 活跃度加分
  if (metrics.activityScore >= 50) {
    score = Math.min(100, score + 5);
  }

  // 确保分数在有效范围内
  score = Math.max(0, Math.min(100, score));

  // 确定等级
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
function getActivityLevel(score: number): "high" | "medium" | "low" | "inactive" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  if (score > 0) return "low";
  return "inactive";
}
