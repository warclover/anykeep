/**
 * 批量标签操作 API
 * POST /api/bookmarks/batch-tags
 *
 * 功能：
 * - 批量为书签添加标签
 * - 批量从书签移除标签
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { batchTagsSchema, type BatchTagsResult } from "@/lib/batch/validation";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  databaseError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 身份验证
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 请求验证
    const body = await request.json();
    const parseResult = batchTagsSchema.safeParse(body);

    if (!parseResult.success) {
      return badRequestError(parseResult.error.issues[0].message);
    }

    const { action, bookmarkIds, tags } = parseResult.data;

    // 3. 去重标签并进行安全处理
    const uniqueTags = [...new Set(tags.map((t) => t.trim()))];

    // 4. 预验证书签所有权（防止横向越权）
    const { count: ownedCount, error: ownershipError } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .in("id", bookmarkIds)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (ownershipError) {
      logger.error({
        operation: "batch_tags_ownership_check",
        userId: user.id,
        error: ownershipError.message,
      });
      throw ownershipError;
    }

    // 如果用户请求操作的书签中有不属于自己的，拒绝请求
    if (ownedCount !== bookmarkIds.length) {
      logger.warn({
        operation: "batch_tags_unauthorized",
        userId: user.id,
        requestedCount: bookmarkIds.length,
        ownedCount,
      });
      return badRequestError("部分书签不存在或无权操作");
    }

    // 5. 执行批量操作（数据库函数使用 auth.uid() 进行二次验证）
    let result: { affected_ids: number[]; affected_count: number };

    if (action === "add") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("batch_add_tags", {
        p_bookmark_ids: bookmarkIds,
        p_tags: uniqueTags,
      }) as { data: { affected_ids: number[]; affected_count: number }; error: { message: string } | null };
      if (error) throw error;
      result = data;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("batch_remove_tags", {
        p_bookmark_ids: bookmarkIds,
        p_tags: uniqueTags,
      }) as { data: { affected_ids: number[]; affected_count: number }; error: { message: string } | null };
      if (error) throw error;
      result = data;
    }

    // 6. 记录日志
    logger.info({
      operation: `batch_tags_${action}`,
      userId: user.id,
      bookmarkCount: bookmarkIds.length,
      tagCount: uniqueTags.length,
      affectedCount: result.affected_count,
      duration: Date.now() - startTime,
    });

    // 7. 返回响应
    const response: BatchTagsResult = {
      action,
      affectedCount: result.affected_count,
      affectedIds: result.affected_ids || [],
      tags: uniqueTags,
      message:
        action === "add"
          ? `已为 ${result.affected_count} 个书签添加 ${uniqueTags.length} 个标签`
          : `已从 ${result.affected_count} 个书签移除 ${uniqueTags.length} 个标签`,
    };

    return successResponse(response);
  } catch (error) {
    logger.error({
      operation: "batch_tags",
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return databaseError("批量标签操作失败，请稍后重试");
  }
}
