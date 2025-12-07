/**
 * 文件夹画像管理 API
 * GET /api/classification/folders/profiles - 获取用户所有文件夹画像
 * POST /api/classification/folders/profiles - 计算/更新文件夹画像
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { FolderProfileRepository } from "@/lib/classification/repositories";

/**
 * 计算文件夹画像 Schema
 */
const computeProfileSchema = z.object({
  folderId: z.number().int().positive().optional(),
  all: z.boolean().optional().default(false),
});

/**
 * GET /api/classification/folders/profiles
 * 获取用户所有文件夹画像
 */
export async function GET() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 获取文件夹画像
    const folderProfileRepo = new FolderProfileRepository(supabase);
    const profiles = await folderProfileRepo.findByUserId(user.id);

    // 3. 返回画像列表
    return successResponse({
      profiles,
      count: profiles.length,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/folders/profiles error",
    );
    return internalError("获取文件夹画像失败");
  }
}

/**
 * POST /api/classification/folders/profiles
 * 计算/更新文件夹画像
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = computeProfileSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { folderId, all } = validation.data;
    const folderProfileRepo = new FolderProfileRepository(supabase);

    let computedCount = 0;

    if (all) {
      // 3a. 计算所有文件夹画像
      computedCount = await folderProfileRepo.computeUserProfiles(user.id);

      logger.info(
        {
          userId: user.id,
          computedCount,
        },
        "All folder profiles computed",
      );
    } else if (folderId) {
      // 3b. 计算单个文件夹画像
      // 验证文件夹属于当前用户
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id")
        .eq("id", folderId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .single();

      if (folderError || !folder) {
        return notFoundError("文件夹不存在或无权访问");
      }

      await folderProfileRepo.computeProfile(folderId);
      computedCount = 1;

      logger.info(
        {
          userId: user.id,
          folderId,
        },
        "Folder profile computed",
      );
    } else {
      return handleValidationError(
        new z.ZodError([
          {
            code: "custom",
            message: "请指定 folderId 或 all=true",
            path: [],
          },
        ]),
      );
    }

    // 4. 返回计算结果
    return successResponse({
      success: true,
      computedCount,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/folders/profiles error",
    );
    return internalError("计算文件夹画像失败");
  }
}
