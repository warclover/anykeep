/**
 * V4.0 文件夹画像汇总 API
 * GET /api/classification/folders/profiles/summary - 获取用户所有文件夹的画像概览
 *
 * 返回轻量级的汇总数据，适合列表展示：
 * - 每个文件夹的健康度评分
 * - 内容摘要（top 3 tags）
 * - 书签数量
 * - 最近活跃时间
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { FolderProfileRepository } from "@/lib/classification/repositories";

/**
 * GET /api/classification/folders/profiles/summary
 * 获取所有文件夹画像概览
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

    // 2. 获取所有非系统文件夹
    const { data: folders, error: foldersError } = await supabase
      .from("folders")
      .select("id, name, folder_group, created_at")
      .eq("user_id", user.id)
      .eq("is_system", false)
      .is("deleted_at", null)
      .order("name");

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

    // 3. 获取所有画像
    const folderProfileRepo = new FolderProfileRepository(supabase);
    const profiles = await folderProfileRepo.findByUserId(user.id);
    const profileMap = new Map(profiles.map((p) => [p.folderId, p]));

    // 4. 获取每个文件夹的书签数量
    const { data: bookmarkCounts } = await supabase
      .from("bookmarks")
      .select("folder_id")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    const countMap = new Map<number, number>();
    for (const b of bookmarkCounts || []) {
      if (b.folder_id) {
        countMap.set(b.folder_id, (countMap.get(b.folder_id) || 0) + 1);
      }
    }

    // 5. 获取每个文件夹的最近书签时间
    const { data: recentBookmarks } = await supabase
      .from("bookmarks")
      .select("folder_id, created_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const lastActivityMap = new Map<number, string>();
    for (const b of recentBookmarks || []) {
      if (b.folder_id && !lastActivityMap.has(b.folder_id)) {
        lastActivityMap.set(b.folder_id, b.created_at as string);
      }
    }

    // 6. 构建汇总数据
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

    // 7. 计算整体健康度
    const totalFolders = folderSummaries.length;
    const averageHealth = totalFolders > 0
      ? Math.round(
          folderSummaries.reduce((sum, f) => sum + f.health.score, 0) / totalFolders
        )
      : null;

    const healthDistribution = {
      excellent: folderSummaries.filter((f) => f.health.level === "excellent").length,
      good: folderSummaries.filter((f) => f.health.level === "good").length,
      fair: folderSummaries.filter((f) => f.health.level === "fair").length,
      poor: folderSummaries.filter((f) => f.health.level === "poor").length,
    };

    const foldersWithProfiles = folderSummaries.filter((f) => f.hasProfile).length;

    logger.info(
      {
        userId: user.id,
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
        profileCoverage: totalFolders > 0
          ? Math.round((foldersWithProfiles / totalFolders) * 100)
          : 0,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/folders/profiles/summary error",
    );
    return internalError("获取文件夹画像汇总失败");
  }
}
