/**
 * Folder AI Lock API
 * PATCH /api/folders/[id]/lock - 切换文件夹 AI 锁定状态
 *
 * 锁定后 AI 不会对该文件夹进行任何操作（分类、重命名、分拆、合并）
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/folders/[id]/lock
 * Toggle AI lock status for a folder
 */
export const PATCH = withAuthMiddleware<{ id: string }>(
  async (request: NextRequest, { userId, params }) => {
    const supabase = await createClient();
    const { id } = await params;
    const folderId = parseInt(id, 10);

    if (isNaN(folderId)) {
      return NextResponse.json(
        { success: false, error: "无效的文件夹 ID" },
        { status: 400 },
      );
    }

    // 解析请求体
    let body: { locked?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "无效的 JSON 格式" },
        { status: 400 },
      );
    }

    const { locked } = body;

    if (typeof locked !== "boolean") {
      return NextResponse.json(
        { success: false, error: "参数错误：locked 必须是布尔值" },
        { status: 400 },
      );
    }

    // 验证文件夹存在且属于当前用户
    // 类型断言: 手动维护类型文件时需要此断言
    type FolderType = {
      id: number;
      name: string;
      is_system: boolean;
      user_id: string;
    };
    const { data: folder, error: folderError } = (await supabase
      .from("folders")
      .select("id, name, is_system, user_id")
      .eq("id", folderId)
      .eq("user_id", userId)
      .single()) as unknown as {
      data: FolderType | null;
      error: { message: string } | null;
    };

    if (folderError || !folder) {
      return NextResponse.json(
        { success: false, error: "文件夹不存在" },
        { status: 404 },
      );
    }

    // 系统文件夹不能锁定
    if (folder.is_system) {
      return NextResponse.json(
        { success: false, error: "系统文件夹不能锁定" },
        { status: 400 },
      );
    }

    // 更新 folder_profiles 中的锁定状态
    // Note: folder_profiles 是 V4.2 新增表
    // P1-2 修复：使用 upsert 避免并发请求导致的竞态条件
    // 替代原来的 update + insert 两步操作
    const { error: upsertError } = (await (
      supabase.from(
        "folder_profiles",
      ) /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any
    ).upsert(
      {
        folder_id: folderId,
        user_id: userId,
        is_system_locked: locked,
        // 如果锁定，同时禁止 AI 重命名
        is_ai_renamable: !locked,
      },
      {
        onConflict: "folder_id,user_id",
      },
    )) as { error: { message: string } | null };

    if (upsertError) {
      logger.error(
        { error: upsertError.message, folderId, locked },
        "Failed to upsert folder lock status",
      );
      return NextResponse.json(
        { success: false, error: "更新锁定状态失败" },
        { status: 500 },
      );
    }

    logger.info({ folderId, locked, userId }, "Folder AI lock status updated");

    return NextResponse.json({
      success: true,
      data: {
        folderId,
        locked,
        message: locked
          ? `已锁定「${folder.name}」，AI 将不再操作此文件夹`
          : `已解锁「${folder.name}」，AI 可以继续管理此文件夹`,
      },
    });
  },
);

/**
 * GET /api/folders/[id]/lock
 * Get AI lock status for a folder
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (_request: NextRequest, { userId, params }) => {
    const supabase = await createClient();
    const { id } = await params;
    const folderId = parseInt(id, 10);

    if (isNaN(folderId)) {
      return NextResponse.json(
        { success: false, error: "无效的文件夹 ID" },
        { status: 400 },
      );
    }

    // 获取锁定状态
    // Note: folder_profiles 是 V4.2 新增表
    const { data: profile } = await supabase
      .from("folder_profiles")
      .select("is_system_locked, is_ai_renamable")
      .eq("folder_id", folderId)
      .eq("user_id", userId)
      .single();

    const profileData = profile as {
      is_system_locked?: boolean;
      is_ai_renamable?: boolean;
    } | null;

    return NextResponse.json({
      success: true,
      data: {
        folderId,
        isLocked: profileData?.is_system_locked || false,
        isAiRenamable: profileData?.is_ai_renamable ?? true,
      },
    });
  },
);
