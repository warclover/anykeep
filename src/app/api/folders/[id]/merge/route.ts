/**
 * 文件夹合并 API 路由
 * POST /api/folders/[id]/merge - 将文件夹合并到目标文件夹
 *
 * 操作：
 * 1. 将源文件夹的所有收藏移动到目标文件夹
 * 2. 使源文件夹相关的分类建议过期
 * 3. 软删除源文件夹
 */

import type { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  notFoundError,
  forbiddenError,
  badRequestError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { AUTH } from "@/lib/constants/messages";

interface MergeFolderBody {
  targetFolderId: number;
}

/**
 * POST /api/folders/[id]/merge
 * 将文件夹合并到目标文件夹
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sourceFolderId = parseInt(id);

    if (isNaN(sourceFolderId)) {
      return notFoundError("文件夹不存在");
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
    let body: MergeFolderBody;
    try {
      body = await request.json();
    } catch {
      return badRequestError("请求体格式错误");
    }

    const targetFolderIdRaw = body.targetFolderId;
    const targetFolderId =
      typeof targetFolderIdRaw === "string"
        ? parseInt(targetFolderIdRaw)
        : Number(targetFolderIdRaw);

    if (!targetFolderIdRaw || isNaN(targetFolderId)) {
      return badRequestError("请选择目标文件夹");
    }

    if (sourceFolderId === targetFolderId) {
      return badRequestError("不能合并到自己");
    }

    // 3. 检查源文件夹是否存在且属于当前用户
    const { data: sourceFolder, error: sourceError } = await supabase
      .from("folders")
      .select("id, user_id, name, is_system")
      .eq("id", sourceFolderId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (sourceError) {
      if (sourceError.code === "PGRST116") {
        return notFoundError("源文件夹不存在");
      }
      return databaseError("查询源文件夹失败", sourceError);
    }

    if (sourceFolder.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 禁止合并系统文件夹
    if (sourceFolder.is_system) {
      return badRequestError("系统文件夹不能被合并");
    }

    // 4. 检查目标文件夹是否存在且属于当前用户
    const { data: targetFolder, error: targetError } = await supabase
      .from("folders")
      .select("id, user_id, name, is_system")
      .eq("id", targetFolderId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (targetError) {
      if (targetError.code === "PGRST116") {
        return notFoundError("目标文件夹不存在");
      }
      return databaseError("查询目标文件夹失败", targetError);
    }

    if (targetFolder.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 5. 移动所有收藏到目标文件夹
    const { data: movedBookmarks, error: moveError } = await supabase
      .from("bookmarks")
      .update({ folder_id: targetFolderId })
      .eq("folder_id", sourceFolderId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id");

    if (moveError) {
      return databaseError("移动收藏失败", moveError);
    }

    const affectedCount = movedBookmarks?.length || 0;

    // 6. 使源文件夹相关的分类建议过期（可选，表可能不存在）
    try {
      const { error: expireError } = await supabase
        .from("classification_suggestions")
        .update({ status: "expired" })
        .eq("suggested_folder_id", sourceFolderId)
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (expireError) {
        logger.warn({
          error: expireError,
          sourceFolderId,
          operation: "expire_suggestions",
        });
      }
    } catch (expireErr) {
      // 表可能不存在，忽略错误
      logger.warn({
        error:
          expireErr instanceof Error ? expireErr.message : String(expireErr),
        sourceFolderId,
        operation: "expire_suggestions_catch",
      });
    }

    // 7. 软删除源文件夹
    // 使用 service client 绕过 RLS（因为 RLS 策略要求 deleted_at IS NULL）
    const serviceClient = createServiceClient();
    const { error: deleteError } = await serviceClient
      .from("folders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", sourceFolderId)
      .eq("user_id", user.id);

    if (deleteError) {
      logger.error({
        error: deleteError,
        sourceFolderId,
        userId: user.id,
        operation: "soft_delete_folder",
      });
      return databaseError("删除源文件夹失败", deleteError);
    }

    logger.info({
      action: "folder_merged",
      sourceFolderId,
      sourceFolderName: sourceFolder.name,
      targetFolderId,
      targetFolderName: targetFolder.name,
      affectedCount,
      userId: user.id,
    });

    return successResponse({
      success: true,
      sourceFolderId,
      targetFolderId,
      affectedCount,
    });
  } catch (error) {
    console.error("[Merge API Error]", error);
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "merge_folder",
      },
      "POST /api/folders/[id]/merge error",
    );
    return internalError("合并文件夹失败");
  }
}
