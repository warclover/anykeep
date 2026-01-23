/**
 * 智能分类 v5.0 - 获取文件夹画像 API
 *
 * GET /api/classification/v5/folder-profile/[folderId]
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FolderProfilerService } from "@/lib/classification/v5/folder-profiler";
import { EmbeddingService } from "@/lib/classification/v5/shared/embedding";
import { createLogger } from "@/lib/classification/v5/shared/logger";

/**
 * GET /api/classification/v5/folder-profile/:folderId
 * 获取指定文件夹的画像信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { folderId: string } },
) {
  const logger = createLogger("FolderProfileAPI");

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

    // 2. 获取并验证 folderId
    const { folderId: folderIdStr } = params;

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
      userId: user.id,
      folderId: folderId.toString(),
    });

    // 3. 验证文件夹所有权
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id, name, user_id")
      .eq("id", folderId)
      .eq("user_id", user.id)
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

    // 4. 初始化服务
    const embeddingService = new EmbeddingService(logger, {});
    const profilerService = new FolderProfilerService(
      logger,
      supabase,
      embeddingService,
    );

    // 5. 获取文件夹画像
    const profile = await profilerService.getProfile(user.id, Number(folderId));

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
      userId: user.id,
      folderId: folderId.toString(),
      alphaCoefficient: profile.alphaCoefficient,
      bookmarkCount: profile.bookmarkCount,
    });

    // 6. 返回结果
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
  } catch (error) {
    logger.error(
      "获取文件夹画像失败",
      error instanceof Error ? error : new Error(String(error)),
    );

    return NextResponse.json(
      {
        error: "获取文件夹画像失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
