/**
 * 智能分类 v5.0 - Gardener 报告 API
 *
 * GET /api/classification/v5/gardener/report
 *
 * @deprecated 旧分类系统 V5 功能，classification-v2 不使用。计划在后续版本删除。
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GardenerService } from "@/lib/classification/strategies/modern/gardener";
import { EmbeddingService } from "@/lib/classification/infrastructure/shared-services/embedding";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import type { ClassificationStats } from "@/lib/classification/strategies/modern/gardener";
import type {
  FolderStats,
  UserStats,
} from "@/lib/classification/strategies/modern/gardener";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/classification/v5/gardener/report
 * 生成 Gardener 分析报告
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const logger = createLogger("GardenerReportAPI");

  const supabase = await createClient();

  logger.info("生成 Gardener 报告", { userId });

  // 1. 获取分类统计数据（简化版，实际应该从统计表获取）
  const classificationStats: ClassificationStats = {
    totalClassifications: 100,
    correctClassifications: 85,
    t1Corrections: 12,
    userCorrections: 5,
    averageConfidence: 0.88,
  };

  // 2. 获取用户的所有文件夹
  const { data: folders, error: foldersError } = await supabase
    .from("folders")
    .select("id, name, created_at")
    .eq("user_id", userId);

  if (foldersError) {
    logger.error("获取文件夹列表失败", new Error(foldersError.message));
    return NextResponse.json({ error: "获取文件夹列表失败" }, { status: 500 });
  }

  if (!folders || folders.length === 0) {
    logger.info("用户没有文件夹", { userId });
    return NextResponse.json({
      success: true,
      data: {
        thresholdAdjustment: null,
        folderSuggestions: [],
        synonymGroups: [],
        namingSuggestions: [],
        generatedAt: new Date(),
      },
    });
  }

  // 3. 获取每个文件夹的统计数据
  const folderStatsList: FolderStats[] = [];

  for (const folder of folders) {
    const { count: bookmarkCount } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("folder_id", folder.id)
      .eq("user_id", userId);

    folderStatsList.push({
      folderId: folder.id,
      folderName: folder.name,
      bookmarkCount: bookmarkCount || 0,
      lastUsedAt: new Date(folder.created_at || new Date()),
      averageConfidence: 0.85,
      userCorrectionCount: 0,
    });
  }

  // 4. 获取用户整体统计
  const { count: totalBookmarks } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const userStats: UserStats = {
    totalFolders: folders.length,
    totalBookmarks: totalBookmarks || 0,
    averageBookmarksPerFolder:
      folders.length > 0 ? (totalBookmarks || 0) / folders.length : 0,
  };

  // 5. 初始化 Gardener 服务
  const embeddingService = new EmbeddingService(logger, {});
  const gardenerService = new GardenerService(logger, embeddingService);

  // 6. 生成报告
  const report = await gardenerService.generateReport(
    classificationStats,
    folderStatsList,
    userStats,
  );

  logger.info("Gardener 报告生成成功", {
    userId,
    folderSuggestionsCount: report.folderSuggestions.length,
    synonymGroupsCount: report.synonymGroups.length,
    namingSuggestionsCount: report.namingSuggestions.length,
  });

  return NextResponse.json({
    success: true,
    data: report,
  });
});
