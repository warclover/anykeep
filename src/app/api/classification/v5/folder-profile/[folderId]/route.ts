/**
 * 智能分类 v5.0 - 获取文件夹画像 API
 *
 * GET /api/classification/v5/folder-profile/[folderId]
 *
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FolderProfilerService } from "@/lib/classification/strategies/modern/folder-profiler";
import { EmbeddingService } from "@/lib/classification/infrastructure/shared-services/embedding";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/classification/v5/folder-profile/:folderId
 * 获取指定文件夹的画像信息
 */
export const GET = withAuthMiddleware<{ folderId: string }>(
  async (_request, { userId, params }) => {
    const logger = createLogger("FolderProfileAPI");

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

    logger.info("获取文件夹画像", {
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

    // 初始化服务
    const embeddingService = new EmbeddingService(logger, {});
    const profilerService = new FolderProfilerService(
      logger,
      supabase,
      embeddingService,
    );

    // 获取文件夹画像
    const profile = await profilerService.getProfile(userId, Number(folderId));

    if (!profile) {
      logger.info("文件夹画像不存在", { folderId: folderId.toString() });
      return NextResponse.json(
        {
          success: true,
          data: null,
          message: "文件夹画像尚未生成",
        },
        { status: 200 },
      );
    }

    logger.info("文件夹画像获取成功", {
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
        contentEmbedding: profile.contentEmbedding,
        behaviorEmbedding: profile.behaviorEmbedding,
        alphaCoefficient: profile.alphaCoefficient,
        lastUpdatedAt: profile.lastUpdatedAt,
        bookmarkCount: profile.bookmarkCount,
        needsUpdate: profile.needsUpdate,
      },
    });
  },
);
