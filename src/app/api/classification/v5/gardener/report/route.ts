/**
 * 智能分类 v5.0 - Gardener 报告 API
 *
 * GET /api/classification/v5/gardener/report
 */

import type { NextRequest } from "next/server";
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

/**
 * GET /api/classification/v5/gardener/report
 * 生成 Gardener 分析报告
 */
export async function GET(_request: NextRequest) {
  const logger = createLogger("GardenerReportAPI");

  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn("未授权访问", { error: authError?.message });
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    logger.info("生成 Gardener 报告", { userId: user.id });

    // 2. 获取分类统计数据（简化版，实际应该从统计表获取）
    const classificationStats: ClassificationStats = {
      totalClassifications: 100,
      correctClassifications: 85,
      t1Corrections: 12,
      userCorrections: 5,
      averageConfidence: 0.88,
    };

    // 3. 获取用户的所有文件夹
    const { data: folders, error: foldersError } = await supabase
      .from("folders")
      .select("id, name, created_at")
      .eq("user_id", user.id);

    if (foldersError) {
      logger.error("获取文件夹列表失败", new Error(foldersError.message));
      return NextResponse.json(
        { error: "获取文件夹列表失败" },
        { status: 500 },
      );
    }

    if (!folders || folders.length === 0) {
      logger.info("用户没有文件夹", { userId: user.id });
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

    // 4. 获取每个文件夹的统计数据
    const folderStatsList: FolderStats[] = [];

    for (const folder of folders) {
      // 获取文件夹内的书签数量
      const { count: bookmarkCount } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", folder.id)
        .eq("user_id", user.id);

      // TODO: 获取文件夹画像（表尚未创建）
      // const { data: profile } = await supabase
      //   .from('classification_folder_profiles_v5')
      //   .select('avg_classification_score, total_classifications')
      //   .eq('folder_id', folder.id)
      //   .eq('user_id', user.id)
      //   .single();

      folderStatsList.push({
        folderId: folder.id,
        folderName: folder.name,
        bookmarkCount: bookmarkCount || 0,
        lastUsedAt: new Date(folder.created_at || new Date()),
        averageConfidence: 0.85, // 默认值，待实现画像功能后使用实际数据
        userCorrectionCount: 0, // 简化
      });
    }

    // 5. 获取用户整体统计
    const { count: totalBookmarks } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const userStats: UserStats = {
      totalFolders: folders.length,
      totalBookmarks: totalBookmarks || 0,
      averageBookmarksPerFolder:
        folders.length > 0 ? (totalBookmarks || 0) / folders.length : 0,
    };

    // 6. 初始化 Gardener 服务
    const embeddingService = new EmbeddingService(logger, {});
    const gardenerService = new GardenerService(logger, embeddingService);

    // 7. 生成报告
    const report = await gardenerService.generateReport(
      classificationStats,
      folderStatsList,
      userStats,
    );

    logger.info("Gardener 报告生成成功", {
      userId: user.id,
      folderSuggestionsCount: report.folderSuggestions.length,
      synonymGroupsCount: report.synonymGroups.length,
      namingSuggestionsCount: report.namingSuggestions.length,
    });

    // 8. 返回结果
    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error(
      "生成 Gardener 报告失败",
      error instanceof Error ? error : new Error(String(error)),
    );

    return NextResponse.json(
      {
        error: "生成 Gardener 报告失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
