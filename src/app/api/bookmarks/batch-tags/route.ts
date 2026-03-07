/**
 * 批量标签操作 API
 * POST /api/bookmarks/batch-tags
 *
 * 功能：
 * - 批量为书签添加标签
 * - 批量从书签移除标签
 */

import { createClient } from "@/lib/supabase/server";
import { batchTagsSchema, type BatchTagsResult } from "@/lib/batch/validation";
import { successResponse, badRequestError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { BatchTagsReturn } from "@/types/rpc-manual";
import { withAuthMiddleware } from "@/lib/api/middleware";

export const POST = withAuthMiddleware(async (request, { userId }) => {
  const startTime = Date.now();

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
  const supabase = await createClient();
  const { count: ownedCount, error: ownershipError } = await supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .in("id", bookmarkIds)
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (ownershipError) {
    logger.error({
      operation: "batch_tags_ownership_check",
      userId,
      error: ownershipError.message,
    });
    throw ownershipError;
  }

  // 如果用户请求操作的书签中有不属于自己的，拒绝请求
  if (ownedCount !== bookmarkIds.length) {
    logger.warn({
      operation: "batch_tags_unauthorized",
      userId,
      requestedCount: bookmarkIds.length,
      ownedCount,
    });
    return badRequestError("部分书签不存在或无权操作");
  }

  // 5. 执行批量操作（数据库函数使用 auth.uid() 进行二次验证）
  let resultData: BatchTagsReturn;

  if (action === "add") {
    const { data, error } = await supabase.rpc("batch_add_tags", {
      p_bookmark_ids: bookmarkIds,
      p_tags: uniqueTags,
    });

    if (error) throw error;
    resultData = data as unknown as BatchTagsReturn;
  } else {
    const { data, error } = await supabase.rpc("batch_remove_tags", {
      p_bookmark_ids: bookmarkIds,
      p_tags: uniqueTags,
    });

    if (error) throw error;
    resultData = data as unknown as BatchTagsReturn;
  }

  // 6. 记录日志
  logger.info({
    operation: `batch_tags_${action}`,
    userId,
    bookmarkCount: bookmarkIds.length,
    tagCount: uniqueTags.length,
    affectedCount: resultData.affected_count,
    duration: Date.now() - startTime,
  });

  // 7. 返回响应
  const response: BatchTagsResult = {
    action,
    affectedCount: resultData.affected_count,
    affectedIds: resultData.affected_ids || [],
    tags: uniqueTags,
    message:
      action === "add"
        ? `已为 ${resultData.affected_count} 个书签添加 ${uniqueTags.length} 个标签`
        : `已从 ${resultData.affected_count} 个书签移除 ${uniqueTags.length} 个标签`,
  };

  return successResponse(response);
});
