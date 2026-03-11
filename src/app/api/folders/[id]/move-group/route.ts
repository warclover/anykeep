/**
 * 文件夹跨类别移动 API 路由
 * PATCH /api/folders/[id]/move-group - 移动文件夹到其他类别
 *
 * @deprecated 已被栏目系统（folder_categories + category_id）替代。
 * 保留以兼容旧客户端调用，新功能应使用 PATCH /api/folders/[id] 更新 category_id。
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  successResponse,
  databaseError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { FolderGroup } from "@/types/supabase";

/**
 * 移动分组请求体
 * 支持新的 category_id 和旧的 folder_group（向后兼容）
 */
interface MoveGroupRequest {
  folder_group?: FolderGroup;
  category_id?: number | null;
}

/**
 * PATCH /api/folders/[id]/move-group
 * 移动文件夹到其他栏目（category_id）或旧类别（folder_group，兼容）
 */
export const PATCH = withAuthMiddleware<{ id: string }>(
  async (request: NextRequest, { userId, params }) => {
    const { id: folderIdStr } = await params;
    const folderId = parseInt(folderIdStr, 10);

    if (isNaN(folderId)) {
      return badRequestError("Invalid folder ID");
    }

    const supabase = await createClient();

    const body = (await request.json()) as MoveGroupRequest;

    const useCategoryId = "category_id" in body;

    if (!useCategoryId) {
      const validGroups: FolderGroup[] = [
        "work",
        "study",
        "life",
        "entertainment",
        "other",
      ];
      if (!body.folder_group || !validGroups.includes(body.folder_group)) {
        return badRequestError("Invalid folder group");
      }
    }

    type ExistingFolderType = {
      id: number;
      user_id: string;
      is_system: boolean;
    };
    const { data: existingFolder, error: checkError } = (await supabase
      .from("folders")
      .select("id, user_id, is_system")
      .eq("id", folderId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: ExistingFolderType | null;
      error: { code?: string; message: string } | null;
    };

    if (checkError) {
      if (checkError.code === "PGRST116") {
        logger.warn(
          { folderId, userId, operation: "move_folder_group" },
          "Folder not found for move-group",
        );
        return badRequestError("文件夹不存在");
      }
      return databaseError("查询失败", checkError);
    }

    if (!existingFolder) {
      return badRequestError("文件夹不存在");
    }

    if (existingFolder.is_system) {
      return badRequestError("系统文件夹不可移动");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: Record<string, any> = {
      sort_order: 0,
      updated_at: new Date().toISOString(),
    };

    if (useCategoryId) {
      updatePayload.category_id = body.category_id;
    } else {
      updatePayload.folder_group = body.folder_group;
    }

    const { error: updateError } = (await (supabase.from("folders") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update(updatePayload)
      .eq("id", folderId)
      .eq("user_id", userId)
      .is("deleted_at", null)) as { error: { message: string } | null };

    if (updateError) {
      logger.error(
        {
          error: updateError,
          operation: "move_folder_group",
          folderId,
          payload: updatePayload,
        },
        "Failed to move folder",
      );
      return databaseError("移动失败", updateError);
    }

    logger.info(
      {
        operation: "move_folder_group",
        folderId,
        payload: updatePayload,
      },
      "Folder moved successfully",
    );

    return successResponse({
      success: true,
      message: "移动成功",
    });
  },
);
