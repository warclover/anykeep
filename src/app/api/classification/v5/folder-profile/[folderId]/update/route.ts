/**
 * 智能分类 v5.0 - 更新文件夹画像 API
 *
 * POST /api/classification/v5/folder-profile/[folderId]/update
 *
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FolderProfilerService } from "@/lib/classification/strategies/modern/folder-profiler";
import { EmbeddingService } from "@/lib/classification/infrastructure/shared-services/embedding";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import type {
  BookmarkData,
  BehaviorData,
  FolderStats,
} from "@/lib/classification/strategies/modern/folder-profiler";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * POST /api/classification/v5/folder-profile/:folderId/update
 * 更新指定文件夹的画像
 */
export const POST = withAuthMiddleware<{ folderId: string }>(
  async (_request, { userId, params }) => {
    const logger = createLogger("FolderProfileUpdateAPI");

    const supabase = await createClient();

    const { folderId: folderIdStr } = await params;

    if (!folderIdStr) {
      logger.warn("缺少 folderId");
      return NextResponse.json({ error: "缺少 folderId" }, { status: 400 });
    }

    const folderId = parseInt(folderIdStr, 10);
    if (isNaN(folderId)) {
      logger.warn("无效的 folderId", { folderIdStr });
      return NextResponse.json({ error: "无效的 folderId" }, { status: 400 });
    }

    logger.info("更新文件夹画像", {
      userId,
      folderId: folderId.toString(),
    });

    // 验证文件夹所有权
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id, name, user_id")
      .eq("id", folderId)
      .eq("user_id", userId)
      .single();

    if (folderError || !folder) {
      logger.warn("文件夹不存在或无权访问", {
        folderId: folderId.toString(),
        error: folderError?.message,
      });
      return NextResponse.json(
        { error: "文件夹不存在或无权访问" },
        { status: 404 },
      );
    }

    // 获取文件夹内的书签数据
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from("bookmarks")
      .select("id, title, description")
      .eq("folder_id", folderId)
      .eq("user_id", userId);

    if (bookmarksError) {
      logger.error("获取书签数据失败", new Error(bookmarksError.message));
      return NextResponse.json({ error: "获取书签数据失败" }, { status: 500 });
    }

    // 获取行为数据（简化版，实际应该从行为表获取）
    const behaviors: BehaviorData[] =
      bookmarks?.map((bookmark) => ({
        bookmarkId: bookmark.id.toString(),
        actionType: "view",
        timestamp: new Date(),
        weight: 1,
      })) || [];

    // 构建书签数据
    const bookmarkData: BookmarkData[] =
      bookmarks?.map((bookmark) => ({
        id: bookmark.id.toString(),
        title: bookmark.title,
        description: bookmark.description || undefined,
      })) || [];

    // 构建文件夹统计
    const stats: FolderStats = {
      folderId: Number(folderId),
      lastUsed: new Date(),
      behaviorCount: behaviors.length,
      contentCount: bookmarkData.length,
      contentDiversity: 0.5, // 简化计算
      recentActivity: 0.8, // 简化计算
    };

    // 初始化服务
    const embeddingService = new EmbeddingService(logger, {});
    const profilerService = new FolderProfilerService(
      logger,
      supabase,
      embeddingService,
    );

    // 更新文件夹画像
    const profile = await profilerService.upsertProfile(
      userId,
      Number(folderId),
      folder.name,
      undefined, // folders 表暂无 description 字段
      bookmarkData,
      behaviors,
      stats,
    );

    logger.info("文件夹画像更新成功", {
      userId,
      folderId: folderId.toString(),
      alphaCoefficient: profile.alphaCoefficient,
      bookmarkCount: profile.bookmarkCount,
    });

    return NextResponse.json({
      success: true,
      data: {
        folderId: profile.folderId,
        folderName: folder.name,
        alphaCoefficient: profile.alphaCoefficient,
        lastUpdatedAt: profile.lastUpdatedAt,
        bookmarkCount: profile.bookmarkCount,
        needsUpdate: profile.needsUpdate,
      },
    });
  },
);
