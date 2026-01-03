/**
 * 智能列表预设初始化 API 路由
 * POST /api/smart-lists/init-presets - 为用户初始化 6 个预设模板
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * POST /api/smart-lists/init-presets
 * 为当前用户初始化预设智能列表
 * 如果用户已有预设，则不会重复创建
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

    // 2. 调用存储过程初始化预设
    // 类型断言: 手动维护类型文件时需要此断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedCount, error: initError } = await (supabase.rpc as any)(
      "init_smart_list_presets",
      { p_user_id: user.id },
    ) as { data: number | null; error: { message: string } | null };

    if (initError) {
      logger.error(
        {
          error: initError,
          userId: user.id,
          operation: "init_smart_list_presets",
        },
        "Failed to initialize smart list presets",
      );
      return databaseError("初始化预设失败", initError);
    }

    // 3. 查询所有预设列表返回给前端
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: presets, error: queryError } = await (supabase.from("smart_lists") as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("is_preset", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null; error: { message: string } | null };

    if (queryError) {
      return databaseError("查询预设列表失败", queryError);
    }

    logger.info(
      {
        userId: user.id,
        insertedCount,
        totalPresets: presets?.length ?? 0,
        action: "smart_list_presets_initialized",
      },
      "Smart list presets initialized",
    );

    return successResponse({
      created: insertedCount ?? 0,
      presets: presets ?? [],
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "init_smart_list_presets",
      },
      "POST /api/smart-lists/init-presets error",
    );
    return internalError("初始化预设失败");
  }
}
