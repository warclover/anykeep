/**
 * MD 内容去重检查 API 路由
 * P2-007: Markdown 内容收藏
 *
 * POST /api/md-collections/check-duplicate - 检查内容是否已存在
 *
 * 支持两种方式：
 * 1. 直接传入 content（API 内部计算 hash）
 * 2. 传入预计算的 contentHash
 */

import { createClient } from "@/lib/supabase/server";
import { checkMdDuplicateSchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  databaseError,
} from "@/lib/utils/api-response";
import { MD_COLLECTION } from "@/lib/constants/messages";
import { computeContentHash } from "@/features/md-collections/lib";

import { withAuthMiddleware } from "@/lib/api/middleware";
/**
 * POST /api/md-collections/check-duplicate
 * 检查内容哈希是否已存在
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();
  // 1. 解析并验证请求体
  const body = await request.json();
  const validation = checkMdDuplicateSchema.safeParse(body);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  // 3. 获取或计算 contentHash
  const { content, contentHash: providedHash } = validation.data;
  const contentHash =
    providedHash || (content ? computeContentHash(content) : "");

  if (!contentHash) {
    return handleValidationError({
      issues: [{ message: "无法计算内容哈希", path: ["content"] }],
    } as Parameters<typeof handleValidationError>[0]);
  }

  // 4. 检查是否存在相同哈希的记录
  const { data: existingCollection, error: queryError } = await supabase
    .from("md_collections")
    .select("id, title, created_at")
    .eq("user_id", userId)
    .eq("content_hash", contentHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (queryError) {
    return databaseError(MD_COLLECTION.LOAD_ERROR, queryError);
  }

  // 5. 返回检查结果
  if (existingCollection) {
    return successResponse({
      isDuplicate: true,
      existingNote: {
        id: existingCollection.id,
        title: existingCollection.title,
        created_at: existingCollection.created_at,
      },
    });
  }

  return successResponse({
    isDuplicate: false,
    existingNote: null,
  });
});
