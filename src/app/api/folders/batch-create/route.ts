/**
 * 批量创建文件夹 API
 * POST /api/folders/batch-create - 批量创建文件夹（用于浏览器书签导入）
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { successResponse, badRequestError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { FOLDER } from "@/lib/constants/messages";

interface FolderCreateRequest {
  name: string;
  parentId: number | null;
  browserPath: string[];
}

interface CreateResult {
  success: number;
  failed: number;
  folders: Array<{
    id: number;
    name: string;
    browserPath: string[];
  }>;
  errors: Array<{
    name: string;
    reason: string;
  }>;
}

/**
 * POST /api/folders/batch-create
 * 批量创建文件夹
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 2. 解析请求体
    let body: { folders: unknown };
    try {
      body = await request.json();
    } catch (error) {
      logger.error({ error }, "Failed to parse request body");
      return badRequestError("无效的 JSON 格式");
    }

    const folders = body.folders;

    if (!Array.isArray(folders) || folders.length === 0) {
      return badRequestError("folders 必须是非空数组");
    }

    if (folders.length > 50) {
      return badRequestError("单次最多创建 50 个文件夹");
    }

    const foldersToCreate: FolderCreateRequest[] = folders;

    // 3. 按层级顺序创建文件夹（浅层优先）
    // 确保父文件夹先创建
    const sortedFolders = [...foldersToCreate].sort(
      (a, b) => a.browserPath.length - b.browserPath.length,
    );

    const result: CreateResult = {
      success: 0,
      failed: 0,
      folders: [],
      errors: [],
    };

    // 浏览器路径 -> 创建后的文件夹 ID 映射
    const pathToId = new Map<string, number>();

    for (const folder of sortedFolders) {
      try {
        // 确定真实的父文件夹 ID
        let actualParentId = folder.parentId;

        // 如果父路径在映射中，使用映射的 ID
        if (folder.browserPath.length > 1) {
          const parentPath = folder.browserPath.slice(0, -1).join("/");
          const mappedParentId = pathToId.get(parentPath);
          if (mappedParentId !== undefined) {
            actualParentId = mappedParentId;
          }
        }

        // 检查是否已存在同名文件夹
        let query = supabase
          .from("folders")
          .select("id")
          .eq("user_id", userId)
          .eq("name", folder.name)
          .is("deleted_at", null);

        // 处理 parent_id 为 null 的情况
        if (actualParentId === null) {
          query = query.is("parent_id", null);
        } else {
          query = query.eq("parent_id", actualParentId);
        }

        // 类型断言: 手动维护类型文件时需要此断言
        type ExistingFolderType = { id: number };
        const { data: existing } = (await query.single()) as unknown as {
          data: ExistingFolderType | null;
          error: unknown;
        };

        if (existing) {
          // 已存在，使用现有文件夹
          const pathKey = folder.browserPath.join("/");
          pathToId.set(pathKey, existing.id);
          result.folders.push({
            id: existing.id,
            name: folder.name,
            browserPath: folder.browserPath,
          });
          result.success++;
          continue;
        }

        // 创建新文件夹
        const { data: created, error: createError } = (await (
          supabase.from(
            "folders",
          ) /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any
        )
          .insert({
            user_id: userId,
            name: folder.name,
            parent_id: actualParentId,
          })
          .select("id, name")
          .single()) as {
          data: { id: number; name: string } | null;
          error: { message: string } | null;
        };

        if (createError) {
          logger.error(
            {
              error: createError,
              folderName: folder.name,
              parentId: actualParentId,
            },
            "Batch folder create: Failed to create folder",
          );
          result.failed++;
          result.errors.push({
            name: folder.name,
            reason: createError.message || "创建失败",
          });
          continue;
        }

        if (!created) {
          result.failed++;
          result.errors.push({
            name: folder.name,
            reason: "创建失败",
          });
          continue;
        }

        // 记录映射
        const pathKey = folder.browserPath.join("/");
        pathToId.set(pathKey, created.id);

        result.folders.push({
          id: created.id,
          name: created.name,
          browserPath: folder.browserPath,
        });
        result.success++;
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            folderName: folder.name,
          },
          "Batch folder create: Unexpected error",
        );
        result.failed++;
        result.errors.push({
          name: folder.name,
          reason: "处理失败",
        });
      }
    }

    logger.info(
      {
        success: result.success,
        failed: result.failed,
        total: foldersToCreate.length,
      },
      "Batch folder create: Completed",
    );

    return successResponse({
      ...result,
      message:
        result.failed === 0 ? FOLDER.CREATE_SUCCESS : "部分文件夹创建失败",
    });
  },
);
