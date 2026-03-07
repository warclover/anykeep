/**
 * 智能列表排序 API 路由
 * POST /api/smart-lists/reorder - 批量更新排序顺序
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reorderSmartListsSchema } from "@/lib/validation/smart-list";
import {
  successResponse,
  handleValidationError,
  databaseError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";

/**
 * POST /api/smart-lists/reorder
 * 批量更新智能列表排序顺序
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = reorderSmartListsSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { ids } = validation.data;

    // 3. 验证所有 ID 都属于当前用户
    // 类型断言: 手动维护类型文件时需要此断言
    // 注意: ids 来自验证层，可能为 string[] 或 number[]，需统一处理
    type SmartListIdRow = { id: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingLists, error: checkError } = (await (
      supabase.from("smart_lists") as any
    )
      .select("id")
      .eq("user_id", userId)
      .in("id", ids)
      .is("deleted_at", null)) as {
      data: SmartListIdRow[] | null;
      error: { message: string } | null;
    };

    if (checkError) {
      return databaseError("验证智能列表失败", checkError);
    }

    const existingIds = new Set((existingLists ?? []).map((l) => String(l.id)));
    const invalidIds = ids.filter((id) => !existingIds.has(String(id)));

    if (invalidIds.length > 0) {
      return successResponse(
        {
          error: `以下智能列表不存在或无权限: ${invalidIds.join(", ")}`,
        },
        400,
      );
    }

    // 4. 批量更新排序顺序（使用循环更新，确保类型正确）
    let updateError: { message: string } | null = null;

    for (let i = 0; i < ids.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = (await (supabase.from("smart_lists") as any)
        .update({ sort_order: i })
        .eq("id", ids[i])
        .eq("user_id", userId)) as { error: { message: string } | null };

      if (error) {
        updateError = error;
        break;
      }
    }

    if (updateError) {
      logger.error(
        {
          error: updateError,
          userId,
          ids,
          operation: "reorder_smart_lists",
        },
        "Failed to reorder smart lists",
      );
      return databaseError("更新排序失败", updateError);
    }

    logger.info(
      {
        userId,
        count: ids.length,
        action: "smart_lists_reordered",
      },
      "Smart lists reordered",
    );

    return successResponse({ success: true });
  },
);
