/**
 * 智能分类 v5.0 - 更新文件夹画像 API
 *
 * POST /api/classification/v5/folder-profile/[folderId]/update
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FolderProfilerService } from "@/lib/classification/v5/folder-profiler";
import { EmbeddingService } from "@/lib/classification/v5/shared/embedding";
import { createLogger } from "@/lib/classification/v5/shared/logger";
import type {
  BookmarkData,
  BehaviorData,
  FolderStats,
} from "@/lib/classification/v5/folder-profiler";

/**
 * POST /api/classification/v5/folder-profile/:folderId/update
 * 更新指定文件夹的画像
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { folderId: string } },
) {
  const logger = createLogger("FolderProfileUpdateAPI");

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

    logger.info("更新文件夹画像", {
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

    // 4. 获取文件夹内的书签数据
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from("bookmarks")
      .select("id, title, description")
      .eq("folder_id", folderId)
      .eq("user_id", user.id);

    if (bookmarksError) {
      logger.error("获取书签数据失败", new Error(bookmarksError.message));
      return NextResponse.json({ error: "获取书签数据失败" }, { status: 500 });
    }

    // 5. 获取行为数据（简化版，实际应该从行为表获取）
    const behaviors: BehaviorData[] =
      bookmarks?.map((bookmark) => ({
        bookmarkId: bookmark.id.toString(),
        actionType: "view",
        timestamp: new Date(),
        weight: 1,
      })) || [];

    // 6. 构建书签数据
    const bookmarkData: BookmarkData[] =
      bookmarks?.map((bookmark) => ({
        id: bookmark.id.toString(),
        title: bookmark.title,
        description: bookmark.description || undefined,
      })) || [];

    // 7. 构建文件夹统计
    const stats: FolderStats = {
      folderId: folderId.toString(),
      lastUsed: new Date(),
      behaviorCount: behaviors.length,
      contentCount: bookmarkData.length,
      contentDiversity: 0.5, // 简化计算
      recentActivity: 0.8, // 简化计算
    };

    // 8. 初始化服务
    const embeddingService = new EmbeddingService(logger, {});
    const profilerService = new FolderProfilerService(
      logger,
      supabase,
      embeddingService,
    );

    // 9. 更新文件夹画像
    const profile = await profilerService.upsertProfile(
      user.id,
      folderId.toString(),
      folder.name,
      undefined, // folders 表暂无 description 字段
      bookmarkData,
      behaviors,
      stats,
    );

    logger.info("文件夹画像更新成功", {
      userId: user.id,
      folderId: folderId.toString(),
      alphaCoefficient: profile.alphaCoefficient,
      bookmarkCount: profile.bookmarkCount,
    });

    // 10. 返回结果
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
  } catch (error) {
    logger.error(
      "更新文件夹画像失败",
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      {
        error: "更新文件夹画像失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
