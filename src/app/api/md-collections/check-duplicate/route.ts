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

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkMdDuplicateSchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { MD_COLLECTION } from "@/lib/constants/messages";
import { computeContentHash } from "@/features/md-collections/lib";

/**
 * POST /api/md-collections/check-duplicate
 * 检查内容哈希是否已存在
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
      .eq("user_id", user.id)
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
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "check_md_duplicate",
      },
      "POST /api/md-collections/check-duplicate error",
    );
    return internalError(MD_COLLECTION.LOAD_ERROR);
  }
}
