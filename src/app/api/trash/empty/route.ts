import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import { successResponse, databaseError } from "@/lib/utils/api-response";
import { checkRateLimit } from "@/lib/utils/rate-limiter";

/**
 * POST /api/trash/empty
 * 清空垃圾箱（永久删除所有垃圾箱中的收藏）
 */
export const POST = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    logger.debug(
      {
        action: "empty_trash_start",
      },
      "POST: Empty trash",
    );

    const supabase = await createClient();

    // 1. 速率限制检查（高风险操作：每小时 2 次）
    const rateLimitResult = checkRateLimit(userId, "/api/trash/empty");
    if (!rateLimitResult.allowed) {
      logger.warn(
        { userId, resetMs: rateLimitResult.resetMs },
        "Empty trash rate limited",
      );
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "操作过于频繁，请稍后再试",
          retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
          },
        },
      );
    }

    // 2. 获取垃圾箱中的所有收藏（用于计数）
    // 类型断言: 手动维护类型文件时需要此断言
    type TrashItemRow = { id: number };
    const { data: trashItems, error: fetchError } = (await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", userId)
      .eq("is_in_trash", true)
      .is("deleted_at", null)) as {
      data: TrashItemRow[] | null;
      error: { message: string } | null;
    };

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

    // 3. 批量永久删除（使用普通客户端 + 显式 user_id 检查，不绕过 RLS）
    const itemIds = trashItems.map((item) => item.id);
    const { error: deleteError } = (await supabase
      .from("bookmarks")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", itemIds)
      .eq("user_id", userId)) as { error: { message: string } | null }; // 显式验证所有权，配合 RLS 双重保护

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

    // 4. 减少用户存储计数（使用普通客户端，RPC 内部应有权限检查）
    const { error: decrementError } = await supabase.rpc(
      "decrement_storage_used",
      {
        target_user_id: userId,
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
          userId,
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
  },
);
