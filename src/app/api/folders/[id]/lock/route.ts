/**
 * Folder AI Lock API
 * PATCH /api/folders/[id]/lock - 切换文件夹 AI 锁定状态
 *
 * 锁定后 AI 不会对该文件夹进行任何操作（分类、重命名、分拆、合并）
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/folders/[id]/lock
 * Toggle AI lock status for a folder
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const folderId = parseInt(id, 10);

    if (isNaN(folderId)) {
      return NextResponse.json(
        { success: false, error: "无效的文件夹 ID" },
        { status: 400 },
      );
    }

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权访问" },
        { status: 401 },
      );
    }

    // 解析请求体
    const body = await request.json();
    const { locked } = body;

    if (typeof locked !== "boolean") {
      return NextResponse.json(
        { success: false, error: "参数错误：locked 必须是布尔值" },
        { status: 400 },
      );
    }

    // 验证文件夹存在且属于当前用户
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id, name, is_system, user_id")
      .eq("id", folderId)
      .eq("user_id", user.id)
      .single();

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
    const updateData = {
      is_system_locked: locked,
      // 如果锁定，同时禁止 AI 重命名
      is_ai_renamable: !locked,
    };
    const { error: updateError } = await supabase
      .from("folder_profiles")
      .update(updateData)
      .eq("folder_id", folderId)
      .eq("user_id", user.id);

    if (updateError) {
      // 如果 folder_profiles 不存在，尝试创建
      if (updateError.code === "PGRST116") {
        const insertData = {
          folder_id: folderId,
          user_id: user.id,
          is_system_locked: locked,
          is_ai_renamable: !locked,
        };
        const { error: insertError } = await supabase
          .from("folder_profiles")
          .insert(insertData);

        if (insertError) {
          logger.error(
            { error: insertError.message },
            "Failed to create folder profile for lock",
          );
          return NextResponse.json(
            { success: false, error: "更新锁定状态失败" },
            { status: 500 },
          );
        }
      } else {
        logger.error(
          { error: updateError.message },
          "Failed to update folder lock status",
        );
        return NextResponse.json(
          { success: false, error: "更新锁定状态失败" },
          { status: 500 },
        );
      }
    }

    logger.info(
      { folderId, locked, userId: user.id },
      "Folder AI lock status updated",
    );

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
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "PATCH /api/folders/[id]/lock error",
    );
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/folders/[id]/lock
 * Get AI lock status for a folder
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const folderId = parseInt(id, 10);

    if (isNaN(folderId)) {
      return NextResponse.json(
        { success: false, error: "无效的文件夹 ID" },
        { status: 400 },
      );
    }

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权访问" },
        { status: 401 },
      );
    }

    // 获取锁定状态
    // Note: folder_profiles 是 V4.2 新增表
    const { data: profile } = await supabase
      .from("folder_profiles")
      .select("is_system_locked, is_ai_renamable")
      .eq("folder_id", folderId)
      .eq("user_id", user.id)
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
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "GET /api/folders/[id]/lock error",
    );
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 },
    );
  }
}
