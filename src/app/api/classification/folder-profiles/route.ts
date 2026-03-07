/**
 * 文件夹标签画像 API
 *
 * 提供文件夹标签画像的更新和查询功能
 * 用于定时任务和手动触发
 *
 * @module @/app/api/classification/folder-profiles
 * @version 1.1.0
 * @since 2026-01-23
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FolderTagProfilerService } from "@/lib/classification/strategies/modern/folder-tag-profiler.service";
import { createLogger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

const logger = createLogger("api:folder-profiles");

/**
 * POST /api/classification/folder-profiles
 *
 * 更新用户的文件夹标签画像
 *
 * 请求体:
 * - userId?: string - 指定用户ID（可选，默认当前用户）
 * - folderId?: number - 指定文件夹ID（可选，不传则更新所有）
 *
 * 响应:
 * - success: boolean
 * - message: string
 * - updatedCount?: number
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const body = await request.json().catch(() => ({}));
  const targetUserId = body.userId || userId;
  const folderId = body.folderId as number | undefined;

  // 安全检查：普通用户只能更新自己的画像
  if (targetUserId !== userId) {
    // 检查是否是管理员（可选：根据项目需求实现）
    logger.warn({ userId, targetUserId }, "尝试更新其他用户的画像");
    return NextResponse.json(
      { success: false, message: "无权限操作其他用户数据" },
      { status: 403 },
    );
  }

  logger.info({ userId: targetUserId, folderId }, "开始更新文件夹标签画像");

  const profiler = new FolderTagProfilerService(supabase);

  if (folderId) {
    // 更新单个文件夹
    const { data: folder } = await supabase
      .from("folders")
      .select("id, name")
      .eq("id", folderId)
      .eq("user_id", targetUserId)
      .single();

    if (!folder) {
      return NextResponse.json(
        { success: false, message: "文件夹不存在" },
        { status: 404 },
      );
    }

    await profiler.updateFolderProfile(targetUserId, folder.id, folder.name);

    logger.info(
      { folderId, folderName: folder.name },
      "单个文件夹画像更新完成",
    );

    return NextResponse.json({
      success: true,
      message: `文件夹 "${folder.name}" 画像更新完成`,
      updatedCount: 1,
    });
  } else {
    // 更新所有文件夹
    await profiler.updateAllProfiles(targetUserId);

    // 获取更新的数量
    const { count } = await supabase
      .from("folder_tag_profiles")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId);

    logger.info({ userId: targetUserId, count }, "所有文件夹画像更新完成");

    return NextResponse.json({
      success: true,
      message: "所有文件夹画像更新完成",
      updatedCount: count || 0,
    });
  }
});

/**
 * GET /api/classification/folder-profiles
 *
 * 获取用户的文件夹标签画像列表
 *
 * 查询参数:
 * - folderId?: number - 指定文件夹ID（可选）
 *
 * 响应:
 * - success: boolean
 * - data: FolderTagProfile[]
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");

  let query = supabase
    .from("folder_tag_profiles")
    .select(
      `
      id,
      folder_id,
      core_tags,
      related_tags,
      tag_frequency,
      folder_name_tokens,
      bookmark_count,
      last_updated_at,
      folders!inner(name)
    `,
    )
    .eq("user_id", userId);

  if (folderId) {
    query = query.eq("folder_id", parseInt(folderId, 10));
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ error }, "获取文件夹标签画像失败");
    return NextResponse.json(
      { success: false, message: "获取失败" },
      { status: 500 },
    );
  }

  // 转换数据格式
  const profiles = (data || []).map((row) => {
    const folderData = Array.isArray(row.folders)
      ? row.folders[0]
      : row.folders;
    return {
      id: row.id,
      folderId: row.folder_id,
      folderName: (folderData as { name: string })?.name || "",
      coreTags: row.core_tags || [],
      relatedTags: row.related_tags || [],
      tagFrequency: row.tag_frequency || {},
      folderNameTokens: row.folder_name_tokens || [],
      bookmarkCount: row.bookmark_count,
      lastUpdatedAt: row.last_updated_at,
    };
  });

  return NextResponse.json({
    success: true,
    data: profiles,
  });
});
