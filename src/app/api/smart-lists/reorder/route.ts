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
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * POST /api/smart-lists/reorder
 * 批量更新智能列表排序顺序
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
      return unauthorizedError();
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = reorderSmartListsSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { ids } = validation.data;

    // 3. 验证所有 ID 都属于当前用户
    const { data: existingLists, error: checkError } = await supabase
      .from("smart_lists")
      .select("id")
      .eq("user_id", user.id)
      .in("id", ids)
      .is("deleted_at", null);

    if (checkError) {
      return databaseError("验证智能列表失败", checkError);
    }

    const existingIds = new Set(existingLists?.map((l) => l.id) ?? []);
    const invalidIds = ids.filter((id) => !existingIds.has(id));

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
      const { error } = await supabase
        .from("smart_lists")
        .update({ sort_order: i })
        .eq("id", ids[i])
        .eq("user_id", user.id);

      if (error) {
        updateError = error;
        break;
      }
    }

    if (updateError) {
      logger.error(
        {
          error: updateError,
          userId: user.id,
          ids,
          operation: "reorder_smart_lists",
        },
        "Failed to reorder smart lists",
      );
      return databaseError("更新排序失败", updateError);
    }

    logger.info(
      {
        userId: user.id,
        count: ids.length,
        action: "smart_lists_reordered",
      },
      "Smart lists reordered",
    );

    return successResponse({ success: true });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "reorder_smart_lists",
      },
      "POST /api/smart-lists/reorder error",
    );
    return internalError("更新排序失败");
  }
}
