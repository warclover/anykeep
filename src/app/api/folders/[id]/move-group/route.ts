/**
 * 文件夹跨类别移动 API 路由
 * PATCH /api/folders/[id]/move-group - 移动文件夹到其他类别
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  internalError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { FolderGroup } from "@/types/supabase";

/**
 * 移动分组请求体
 */
interface MoveGroupRequest {
  folder_group: FolderGroup;
}

/**
 * PATCH /api/folders/[id]/move-group
 * 移动文件夹到其他类别
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 0. 解析动态路由参数（Next.js 15+ 需要 await）
    const { id: folderIdStr } = await params;
    const folderId = parseInt(folderIdStr, 10);

    if (isNaN(folderId)) {
      return badRequestError("Invalid folder ID");
    }

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析请求体
    const body = (await request.json()) as MoveGroupRequest;

    // 3. 验证 folder_group
    const validGroups: FolderGroup[] = [
      "work",
      "study",
      "life",
      "entertainment",
      "other",
    ];
    if (!validGroups.includes(body.folder_group)) {
      return badRequestError("Invalid folder group");
    }

    // P0-4 修复：显式验证文件夹存在且属于当前用户
    const { data: existingFolder, error: checkError } = await supabase
      .from("folders")
      .select("id, user_id, is_system")
      .eq("id", folderId)
      .is("deleted_at", null)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return badRequestError("文件夹不存在");
      }
      return databaseError("查询失败", checkError);
    }

    if (existingFolder.user_id !== user.id) {
      return badRequestError("无权操作此文件夹");
    }

    if (existingFolder.is_system) {
      return badRequestError("系统文件夹不可移动");
    }

    // 4. 更新文件夹分组
    // 注意：移动到新类别后，sort_order 设为 0（移到新类别的顶部）
    // 已在上方验证所有权和系统文件夹状态，这里仅需基本条件
    const { error: updateError } = await supabase
      .from("folders")
      .update({
        folder_group: body.folder_group,
        sort_order: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", folderId)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (updateError) {
      logger.error(
        {
          error: updateError,
          operation: "move_folder_group",
          folderId,
          targetGroup: body.folder_group,
        },
        "Failed to move folder to new group",
      );
      return databaseError("移动失败", updateError);
    }

    logger.info(
      {
        operation: "move_folder_group",
        folderId,
        targetGroup: body.folder_group,
      },
      "Folder moved to new group successfully",
    );

    return successResponse({
      success: true,
      message: "移动成功",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "move_folder_group",
      },
      "PATCH /api/folders/[id]/move-group error",
    );
    return internalError("移动失败");
  }
}
