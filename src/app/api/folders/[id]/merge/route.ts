/**
 * 文件夹合并 API 路由
 * POST /api/folders/[id]/merge - 将文件夹合并到目标文件夹
 *
 * 合并操作：
 * 1. 将源文件夹的所有书签移动到目标文件夹
 * 2. 软删除源文件夹
 */

import type { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  notFoundError,
  forbiddenError,
  databaseError,
  internalError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { AUTH, FOLDER } from "@/lib/constants/messages";

/**
 * POST /api/folders/[id]/merge
 * 将源文件夹合并到目标文件夹
 *
 * Body:
 * - targetFolderId: number - 目标文件夹 ID
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sourceFolderId = parseInt(id);

    if (isNaN(sourceFolderId)) {
      return notFoundError(FOLDER.NOT_FOUND);
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
    const body = await request.json();
    const { targetFolderId } = body;

    if (!targetFolderId || typeof targetFolderId !== "number") {
      return badRequestError("请选择目标文件夹");
    }

    if (sourceFolderId === targetFolderId) {
      return badRequestError("不能合并到自身");
    }

    // 3. 检查源文件夹
    const { data: sourceFolder, error: sourceError } = await supabase
      .from("folders")
      .select("id, user_id, name, is_system")
      .eq("id", sourceFolderId)
      .is("deleted_at", null)
      .single();

    if (sourceError) {
      if (sourceError.code === "PGRST116") {
        return notFoundError("源文件夹不存在");
      }
      return databaseError(FOLDER.LOAD_ERROR, sourceError);
    }

    if (sourceFolder.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    if (sourceFolder.is_system) {
      return badRequestError("系统文件夹不可合并");
    }

    // 4. 检查目标文件夹
    const { data: targetFolder, error: targetError } = await supabase
      .from("folders")
      .select("id, user_id, name, is_system")
      .eq("id", targetFolderId)
      .is("deleted_at", null)
      .single();

    if (targetError) {
      if (targetError.code === "PGRST116") {
        return notFoundError("目标文件夹不存在");
      }
      return databaseError(FOLDER.LOAD_ERROR, targetError);
    }

    if (targetFolder.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 5. 统计源文件夹的书签数量
    const { count: bookmarkCount, error: countError } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("folder_id", sourceFolderId)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (countError) {
      return databaseError(FOLDER.LOAD_ERROR, countError);
    }

    // 6. 移动书签到目标文件夹（使用 Service Role Client 绕过 RLS）
    // 安全说明：已验证用户身份、源/目标文件夹所有权
    const serviceClient = await createServiceClient();

    if (bookmarkCount && bookmarkCount > 0) {
      const { error: moveError } = await serviceClient
        .from("bookmarks")
        .update({ folder_id: targetFolderId })
        .eq("folder_id", sourceFolderId)
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (moveError) {
        return databaseError("移动书签失败", moveError);
      }
    }

    // 7. 软删除源文件夹
    const { error: deleteError } = await serviceClient
      .from("folders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", sourceFolderId)
      .eq("user_id", user.id); // 额外安全检查

    if (deleteError) {
      return databaseError(FOLDER.DELETE_ERROR, deleteError);
    }

    logger.info(
      {
        userId: user.id,
        sourceFolderId,
        targetFolderId,
        bookmarksMoved: bookmarkCount || 0,
        action: "folder_merged",
      },
      "Folder merged successfully",
    );

    return successResponse({
      merged: true,
      sourceFolderId,
      sourceFolderName: sourceFolder.name,
      targetFolderId,
      targetFolderName: targetFolder.name,
      bookmarksMoved: bookmarkCount || 0,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[POST /api/folders/[id]/merge] ========= ERROR =========");
    console.error("[POST /api/folders/[id]/merge] Message:", errorMessage);
    console.error("[POST /api/folders/[id]/merge] Stack:", errorStack);
    logger.error(
      {
        error: errorMessage,
        stack: errorStack,
        operation: "merge_folder",
      },
      "POST /api/folders/[id]/merge error",
    );
    // 临时返回详细错误信息以便调试
    return internalError(`合并文件夹失败: ${errorMessage}`);
  }
}
