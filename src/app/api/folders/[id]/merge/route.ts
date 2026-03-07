/**
 * 文件夹合并 API 路由
 * POST /api/folders/[id]/merge - 将文件夹合并到目标文件夹
 *
 * V4.2.2: 使用数据库事务函数 merge_folders_atomic 确保原子性
 * 合并操作（事务保护）：
 * 1. 将源文件夹的所有书签移动到目标文件夹
 * 2. 软删除源文件夹
 */

import type { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  successResponse,
  notFoundError,
  forbiddenError,
  databaseError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { AUTH, FOLDER } from "@/lib/constants/messages";

// 事务函数返回类型
interface MergeFoldersAtomicResult {
  success: boolean;
  error?: string;
  bookmarksMoved?: number;
  sourceFolderName?: string;
  targetFolderName?: string;
  sourceFolderId?: number;
  targetFolderId?: number;
}

/**
 * POST /api/folders/[id]/merge
 * 将源文件夹合并到目标文件夹
 *
 * Body:
 * - targetFolderId: number - 目标文件夹 ID
 */
export const POST = withAuthMiddleware<{ id: string }>(
  async (request: NextRequest, { userId, params }) => {
    const { id } = await params;
    const sourceFolderId = parseInt(id);

    if (isNaN(sourceFolderId)) {
      return notFoundError(FOLDER.NOT_FOUND);
    }

    const supabase = await createClient();

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
    // 类型断言: 手动维护类型文件时需要此断言
    type FolderType = {
      id: number;
      user_id: string;
      name: string;
      is_system: boolean;
    };
    const { data: sourceFolder, error: sourceError } = (await supabase
      .from("folders")
      .select("id, user_id, name, is_system")
      .eq("id", sourceFolderId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: FolderType | null;
      error: { code?: string; message: string } | null;
    };

    if (sourceError) {
      if (sourceError.code === "PGRST116") {
        return notFoundError("源文件夹不存在");
      }
      return databaseError(FOLDER.LOAD_ERROR, sourceError);
    }

    if (!sourceFolder) {
      return notFoundError("源文件夹不存在");
    }

    if (sourceFolder.user_id !== userId) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    if (sourceFolder.is_system) {
      return badRequestError("系统文件夹不可合并");
    }

    // 4. 检查目标文件夹
    const { data: targetFolder, error: targetError } = (await supabase
      .from("folders")
      .select("id, user_id, name, is_system")
      .eq("id", targetFolderId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: FolderType | null;
      error: { code?: string; message: string } | null;
    };

    if (targetError) {
      if (targetError.code === "PGRST116") {
        return notFoundError("目标文件夹不存在");
      }
      return databaseError(FOLDER.LOAD_ERROR, targetError);
    }

    if (!targetFolder) {
      return notFoundError("目标文件夹不存在");
    }

    if (targetFolder.user_id !== userId) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 5. 使用事务函数执行原子合并操作
    // 安全说明：已验证用户身份、源/目标文件夹所有权
    const serviceClient = await createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = (await (
      serviceClient.rpc as any
    )("merge_folders_atomic", {
      p_source_folder_id: sourceFolderId,
      p_target_folder_id: targetFolderId,
      p_user_id: userId,
    })) as { data: unknown; error: { message: string } | null };

    if (rpcError) {
      logger.error(
        {
          error: rpcError,
          sourceFolderId,
          targetFolderId,
          operation: "merge_folders_atomic",
        },
        "RPC merge_folders_atomic failed",
      );
      return databaseError("合并文件夹失败", rpcError);
    }

    // 解析事务函数返回结果
    const result = rpcResult as unknown as MergeFoldersAtomicResult;

    if (!result.success) {
      logger.error(
        {
          error: result.error,
          sourceFolderId,
          targetFolderId,
          operation: "merge_folders_atomic",
        },
        "merge_folders_atomic returned error",
      );
      return badRequestError(result.error || "合并失败");
    }

    logger.info(
      {
        userId,
        sourceFolderId,
        targetFolderId,
        bookmarksMoved: result.bookmarksMoved || 0,
        action: "folder_merged",
      },
      "Folder merged successfully (atomic)",
    );

    return successResponse({
      merged: true,
      sourceFolderId,
      sourceFolderName: result.sourceFolderName || sourceFolder.name,
      targetFolderId,
      targetFolderName: result.targetFolderName || targetFolder.name,
      bookmarksMoved: result.bookmarksMoved || 0,
    });
  },
);
