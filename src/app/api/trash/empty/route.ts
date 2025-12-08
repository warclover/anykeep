import type { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  successResponse,
  unauthorizedError,
  databaseError,
} from "@/lib/utils/api-response";

/**
 * POST /api/trash/empty
 * 清空垃圾箱（永久删除所有垃圾箱中的收藏）
 */
export async function POST(_request: NextRequest) {
  try {
    logger.debug(
      {
        action: "empty_trash_start",
      },
      "POST: Empty trash",
    );

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    logger.debug(
      {
        userId: user?.id,
        authError: authError?.message,
        action: "auth_check",
      },
      "POST: User authentication",
    );

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 获取垃圾箱中的所有收藏（用于计数）
    const { data: trashItems, error: fetchError } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_in_trash", true)
      .is("deleted_at", null);

    logger.debug(
      {
        trashCount: trashItems?.length,
        fetchError: fetchError?.message,
        action: "fetch_trash_items",
      },
      "POST: Fetch trash items",
    );

    if (fetchError) {
      return databaseError("获取垃圾箱内容失败", fetchError);
    }

    if (!trashItems || trashItems.length === 0) {
      return successResponse({
        deleted: 0,
        message: "垃圾箱为空",
      });
    }

    // 3. 批量永久删除
    const serviceClient = await createServiceClient();
    const itemIds = trashItems.map((item) => item.id);
    const { error: deleteError } = await serviceClient
      .from("bookmarks")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", itemIds);

    logger.debug(
      {
        deleteError: deleteError?.message,
        count: itemIds.length,
        action: "batch_delete",
      },
      "POST: Batch delete operation",
    );

    if (deleteError) {
      return databaseError("清空垃圾箱失败", deleteError);
    }

    // 4. 减少用户存储计数
    const { error: decrementError } = await serviceClient.rpc(
      "decrement_storage_used",
      {
        target_user_id: user.id,
        count: trashItems.length,
      },
    );

    logger.debug(
      {
        decrementError: decrementError?.message,
        count: trashItems.length,
        action: "decrement_storage",
      },
      "POST: Decrement storage",
    );

    if (decrementError) {
      // 存储计数更新失败，但收藏已删除，记录错误但不影响返回
      logger.error(
        {
          error: decrementError,
          userId: user.id,
          count: trashItems.length,
          operation: "decrement_storage",
        },
        "Failed to decrement storage count",
      );
    }

    // 5. 返回成功响应
    logger.info(
      {
        deletedCount: trashItems.length,
        action: "empty_trash_success",
      },
      "POST: Empty trash successfully",
    );

    return successResponse({
      deleted: trashItems.length,
      message: `已永久删除 ${trashItems.length} 个收藏`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "empty_trash",
      },
      "POST /api/trash/empty error",
    );
    return databaseError("清空垃圾箱失败", error);
  }
}
