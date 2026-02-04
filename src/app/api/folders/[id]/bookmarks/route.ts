/**
 * 文件夹书签批量操作 API 路由
 * DELETE /api/folders/[id]/bookmarks - 删除文件夹中所有书签
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
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { AUTH, FOLDER } from "@/lib/constants/messages";

/**
 * DELETE /api/folders/[id]/bookmarks
 * 软删除文件夹中的所有书签
 */
export async function DELETE(
  _request: NextRequest,
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

    // 2. 检查文件夹是否存在且属于当前用户
    // 类型断言: 手动维护类型文件时需要此断言
    type FolderType = {
      id: number;
      user_id: string;
      name: string;
    };
    const { data: folder, error: folderError } = (await supabase
      .from("folders")
      .select("id, user_id, name")
      .eq("id", folderId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: FolderType | null;
      error: { code?: string; message: string } | null;
    };

    if (folderError) {
      if (folderError.code === "PGRST116") {
        return notFoundError(FOLDER.NOT_FOUND);
      }
      return databaseError(FOLDER.LOAD_ERROR, folderError);
    }

    if (!folder) {
      return notFoundError(FOLDER.NOT_FOUND);
    }

    if (folder.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 3. 统计要删除的书签数量
    const { count: bookmarkCount, error: countError } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("folder_id", folderId)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (countError) {
      return databaseError("统计书签失败", countError);
    }

    // 4. 软删除所有书签（使用 Service Role Client 绕过 RLS）
    // 安全说明：已验证用户身份、文件夹所有权
    if (bookmarkCount && bookmarkCount > 0) {
      const serviceClient = await createServiceClient();
      const { error: deleteError } = (await (
        serviceClient.from("bookmarks") as any
      ) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({ deleted_at: new Date().toISOString() })
        .eq("folder_id", folderId)
        .eq("user_id", user.id)
        .is("deleted_at", null)) as { error: { message: string } | null };

      if (deleteError) {
        return databaseError("删除书签失败", deleteError);
      }
    }

    logger.info(
      {
        userId: user.id,
        folderId,
        bookmarksDeleted: bookmarkCount || 0,
        action: "folder_bookmarks_deleted",
      },
      "Folder bookmarks deleted successfully",
    );

    return successResponse({
      folderId,
      folderName: folder.name,
      bookmarksDeleted: bookmarkCount || 0,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "delete_folder_bookmarks",
      },
      "DELETE /api/folders/[id]/bookmarks error",
    );
    return internalError("删除书签失败");
  }
}
