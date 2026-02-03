/**
 * 文件夹停用/启用 API 路由
 * PATCH /api/folders/[id]/archive - 切换文件夹停用状态
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
 * PATCH /api/folders/[id]/archive
 * 切换文件夹的停用状态
 *
 * Body:
 * - archived: boolean - 是否停用
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const folderId = parseInt(id);

    if (isNaN(folderId)) {
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
    const { archived } = body;

    if (typeof archived !== "boolean") {
      return badRequestError("请提供有效的停用状态");
    }

    // 3. 检查文件夹是否存在且属于当前用户
    // 类型断言: 手动维护类型文件时需要此断言
    type ArchiveFolderType = {
      id: number;
      user_id: string;
      name: string;
      is_system: boolean;
      is_archived: boolean;
    };
    const { data: folder, error: checkError } = (await supabase
      .from("folders")
      .select("id, user_id, name, is_system, is_archived")
      .eq("id", folderId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: ArchiveFolderType | null;
      error: { code?: string; message: string } | null;
    };

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(FOLDER.NOT_FOUND);
      }
      return databaseError(FOLDER.LOAD_ERROR, checkError);
    }

    if (!folder) {
      return notFoundError(FOLDER.NOT_FOUND);
    }

    if (folder.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 4. 系统文件夹不可停用
    if (folder.is_system) {
      return badRequestError("系统文件夹不可停用");
    }

    // 5. 如果状态已经是目标状态，直接返回成功
    if (folder.is_archived === archived) {
      return successResponse({
        id: folderId,
        name: folder.name,
        is_archived: archived,
        message: archived ? "文件夹已处于停用状态" : "文件夹已处于启用状态",
      });
    }

    // 6. 更新停用状态
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = (await (supabase.from("folders") as any)
      .update({ is_archived: archived })
      .eq("id", folderId)) as { error: { message: string } | null };

    if (updateError) {
      return databaseError(FOLDER.UPDATE_ERROR, updateError);
    }

    logger.info(
      {
        userId: user.id,
        folderId,
        folderName: folder.name,
        archived,
        action: archived ? "folder_archived" : "folder_unarchived",
      },
      archived
        ? "Folder archived successfully"
        : "Folder unarchived successfully",
    );

    return successResponse({
      id: folderId,
      name: folder.name,
      is_archived: archived,
      message: archived ? "文件夹已停用" : "文件夹已启用",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "toggle_folder_archive",
      },
      "PATCH /api/folders/[id]/archive error",
    );
    return internalError("操作失败");
  }
}
