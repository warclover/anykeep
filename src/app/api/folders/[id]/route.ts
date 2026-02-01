/**
 * 单个文件夹 API 路由
 * GET /api/folders/[id] - 获取文件夹详情
 * PUT /api/folders/[id] - 更新文件夹
 * DELETE /api/folders/[id] - 删除文件夹
 *
 * V4.2.2: DELETE 使用数据库事务函数 delete_folder_cascade 确保原子性
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateFolderSchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  forbiddenError,
  databaseError,
  internalError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { FolderUpdate, Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FOLDER, AUTH } from "@/lib/constants/messages";
import {
  initializeFolderNameProfile,
  preserveOldNameAsAlias,
} from "@/lib/classification/server";

// 事务函数返回类型
interface DeleteFolderCascadeResult {
  success: boolean;
  folderName?: string;
  folderId?: number;
  deletedBookmarks?: number;
  error?: string;
}

/**
 * GET /api/folders/[id]
 * 获取单个文件夹详情及其统计信息
 */
export async function GET(
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

    // 2. 查询文件夹详情
    // 类型断言: 手动维护类型文件时需要此断言
    type FolderRow = {
      id: number;
      user_id: string;
      name: string;
      parent_id: number | null;
      is_system: boolean;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    };
    const { data: folder, error: queryError } = (await supabase
      .from("folders")
      .select("*")
      .eq("id", folderId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: FolderRow | null;
      error: { code?: string; message: string } | null;
    };

    if (queryError) {
      if (queryError.code === "PGRST116") {
        return notFoundError(FOLDER.NOT_FOUND);
      }
      return databaseError(FOLDER.LOAD_ERROR, queryError);
    }

    if (!folder) {
      return notFoundError(FOLDER.NOT_FOUND);
    }

    // 3. 统计收藏数量
    const { count: bookmarkCount, error: countError } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("folder_id", folderId)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (countError) {
      logger.error(
        {
          error: countError,
          folderId,
          operation: "count_bookmarks",
        },
        "Count bookmarks error",
      );
    }

    // 4. 返回文件夹详情（包含收藏数）
    return successResponse({
      ...folder,
      bookmark_count: bookmarkCount || 0,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "get_folder",
      },
      "GET /api/folders/[id] error",
    );
    return internalError(FOLDER.LOAD_ERROR);
  }
}

/**
 * PUT /api/folders/[id]
 * 更新文件夹信息
 */
export async function PUT(
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

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = updateFolderSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { name, parentId, color: _color, icon: _icon } = validation.data;

    // 3. 检查文件夹是否存在且属于当前用户
    // 类型断言: 手动维护类型文件时需要此断言
    type ExistingFolderType = {
      id: number;
      user_id: string;
      parent_id: number | null;
      is_system: boolean;
      system_type: string | null;
    };
    const { data: existingFolder, error: checkError } = (await supabase
      .from("folders")
      .select("id, user_id, parent_id, is_system, system_type")
      .eq("id", folderId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: ExistingFolderType | null;
      error: { code?: string; message: string } | null;
    };

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(FOLDER.NOT_FOUND);
      }
      return databaseError(FOLDER.LOAD_ERROR, checkError);
    }

    if (!existingFolder) {
      return notFoundError(FOLDER.NOT_FOUND);
    }

    if (existingFolder.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 3.5 V4.2新增：系统文件夹不可重命名
    if (existingFolder.is_system && name !== undefined) {
      return badRequestError("系统文件夹不可重命名");
    }

    // 4. 检查是否存在循环引用（如果更改了 parent_id）
    if (parentId !== undefined && parentId !== null) {
      const hasCircularReference = await checkCircularReference(
        supabase,
        folderId,
        parentId,
        user.id,
      );

      if (hasCircularReference) {
        return badRequestError(FOLDER.CIRCULAR_REFERENCE_ERROR);
      }
    }

    // 5. 构建更新数据
    type FolderUpdateFields = Partial<Pick<FolderUpdate, "name" | "parent_id">>;
    const updateData: FolderUpdateFields = {};
    if (name !== undefined) updateData.name = name;
    if (parentId !== undefined) updateData.parent_id = parentId;
    // Note: color and icon are not in the database schema yet, removing for now

    // 6. 更新文件夹
    const { data: updatedFolder, error: updateError } = (await (
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("folders") as any
    )
      .update(updateData)
      .eq("id", folderId)
      .select()
      .single()) as {
      data: Record<string, unknown> | null;
      error: { message: string } | null;
    };

    if (updateError) {
      return databaseError(FOLDER.UPDATE_ERROR, updateError);
    }

    // 7. 如果文件夹名称变更，异步更新 Profile（不阻塞响应）
    if (name !== undefined && name !== existingFolder.name) {
      // 【新增】保留旧名称为别名，确保旧名称仍可匹配
      preserveOldNameAsAlias(folderId, existingFolder.name, user.id).catch(
        (err) => {
          logger.warn(
            { error: err, folderId, oldName: existingFolder.name },
            "Failed to preserve old folder name as alias",
          );
        },
      );

      // 更新名称嵌入向量
      initializeFolderNameProfile(folderId, name, user.id).catch((err) => {
        logger.warn(
          { error: err, folderId },
          "Failed to update folder name profile after rename",
        );
      });
    }

    return successResponse(updatedFolder);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "update_folder",
      },
      "PUT /api/folders/[id] error",
    );
    return internalError(FOLDER.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/folders/[id]
 * 删除文件夹（软删除）
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
    type DeleteFolderType = {
      id: number;
      user_id: string;
      is_system: boolean;
    };
    const { data: existingFolder, error: checkError } = (await supabase
      .from("folders")
      .select("id, user_id, is_system")
      .eq("id", folderId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: DeleteFolderType | null;
      error: { code?: string; message: string } | null;
    };

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(FOLDER.NOT_FOUND);
      }
      return databaseError(FOLDER.LOAD_ERROR, checkError);
    }

    if (!existingFolder) {
      return notFoundError(FOLDER.NOT_FOUND);
    }

    if (existingFolder.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 3. 系统文件夹不可删除
    if (existingFolder.is_system) {
      return badRequestError("系统文件夹不可删除");
    }

    // 4. 检查文件夹下是否有收藏
    const { count: bookmarkCount, error: countError } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("folder_id", folderId)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (countError) {
      return databaseError(FOLDER.LOAD_ERROR, countError);
    }

    if (bookmarkCount && bookmarkCount > 0) {
      return badRequestError(FOLDER.DELETE_ERROR_HAS_BOOKMARKS(bookmarkCount));
    }

    // 5. 使用事务函数执行原子删除操作
    // 安全说明：已验证用户身份、文件夹所有权、非系统文件夹、无书签
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = (await (supabase.rpc as any)(
      "delete_folder_cascade",
      {
        p_folder_id: folderId,
        p_user_id: user.id,
        p_delete_bookmarks: false, // 已验证文件夹为空
      },
    )) as { data: unknown; error: { message: string } | null };

    if (rpcError) {
      logger.error(
        {
          error: rpcError,
          folderId,
          operation: "delete_folder_cascade",
        },
        "RPC delete_folder_cascade failed",
      );
      return databaseError(FOLDER.DELETE_ERROR, rpcError);
    }

    // 解析事务函数返回结果
    const result = rpcResult as unknown as DeleteFolderCascadeResult;

    if (!result.success) {
      logger.error(
        {
          error: result.error,
          folderId,
          operation: "delete_folder_cascade",
        },
        "delete_folder_cascade returned error",
      );
      return databaseError(
        FOLDER.DELETE_ERROR,
        new Error(result.error || "Unknown error"),
      );
    }

    logger.info(
      {
        userId: user.id,
        folderId,
        folderName: result.folderName,
        action: "folder_deleted",
      },
      "Folder deleted successfully (atomic)",
    );

    return successResponse({
      id: folderId,
      deleted: true,
      folderName: result.folderName,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "delete_folder",
      },
      "DELETE /api/folders/[id] error",
    );
    return internalError(FOLDER.DELETE_ERROR);
  }
}

/**
 * 检查是否存在循环引用
 * 递归检查 targetParentId 是否是 folderId 的后代
 */
async function checkCircularReference(
  supabase: SupabaseClient<Database>,
  folderId: number,
  targetParentId: number,
  userId: string,
): Promise<boolean> {
  // 如果目标父文件夹就是当前文件夹，肯定是循环引用
  if (folderId === targetParentId) {
    return true;
  }

  // 获取当前文件夹的所有子文件夹
  type FolderIdOnly = { id: number };
  const { data: children, error } = (await supabase
    .from("folders")
    .select("id")
    .eq("parent_id", folderId)
    .eq("user_id", userId)
    .is("deleted_at", null)) as unknown as {
    data: FolderIdOnly[] | null;
    error: unknown;
  };

  if (error || !children) {
    return false;
  }

  // 检查目标父文件夹是否是子文件夹之一
  for (const child of children) {
    if (child.id === targetParentId) {
      return true;
    }

    // 递归检查子文件夹的子文件夹
    const hasCircular = await checkCircularReference(
      supabase,
      child.id,
      targetParentId,
      userId,
    );

    if (hasCircular) {
      return true;
    }
  }

  return false;
}
