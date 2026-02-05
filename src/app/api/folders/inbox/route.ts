/**
 * 待整理文件夹 API
 * POST /api/folders/inbox - 获取或创建待整理文件夹
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  databaseError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * POST /api/folders/inbox
 * 获取或创建用户的待整理文件夹
 */
export async function POST(_request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 尝试获取现有的待整理文件夹
    // 类型断言: 手动维护类型文件时需要此断言
    type FolderType = { id: number; name: string };
    const { data: existing } = (await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_system", true)
      .eq("system_type", "INBOX")
      .is("deleted_at", null)
      .single()) as unknown as { data: FolderType | null; error: unknown };

    if (existing) {
      return successResponse({
        id: existing.id,
        name: existing.name,
        created: false,
      });
    }

    // 3. 如果不存在，创建新的待整理文件夹
    const { data: newFolder, error: createError } = (await (
      supabase.from(
        "folders",
      ) /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any
    )
      .insert({
        user_id: user.id,
        name: "待整理",
        is_system: true,
        system_type: "INBOX",
        sort_order: -1, // 排在最前面
      })
      .select("id, name")
      .single()) as {
      data: FolderType | null;
      error: { message: string } | null;
    };

    if (createError) {
      logger.error(
        { error: createError.message, userId: user.id },
        "Failed to create inbox folder",
      );
      return databaseError("创建待整理文件夹失败", createError);
    }

    if (!newFolder) {
      return databaseError("创建待整理文件夹失败");
    }

    logger.info(
      { userId: user.id, folderId: newFolder.id },
      "Created inbox folder",
    );

    return successResponse({
      id: newFolder.id,
      name: newFolder.name,
      created: true,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "POST /api/folders/inbox error",
    );
    return databaseError("获取待整理文件夹失败");
  }
}
