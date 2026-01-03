/**
 * MD 内容去重检查 API 路由
 * P2-007: Markdown 内容收藏
 *
 * POST /api/md-collections/check-duplicate - 检查内容是否已存在
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

    const { contentHash } = validation.data;

    // 3. 检查是否存在相同哈希的记录
    // 类型断言: 手动维护类型文件时需要此断言
    type DuplicateCheckRow = { id: number; title: string; created_at: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingCollection, error: queryError } = await (supabase.from("md_collections") as any)
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .eq("content_hash", contentHash)
      .is("deleted_at", null)
      .maybeSingle() as { data: DuplicateCheckRow | null; error: { message: string } | null };

    if (queryError) {
      return databaseError(MD_COLLECTION.LOAD_ERROR, queryError);
    }

    // 4. 返回检查结果
    if (existingCollection) {
      return successResponse({
        isDuplicate: true,
        existingCollection: {
          id: existingCollection.id,
          title: existingCollection.title,
          createdAt: existingCollection.created_at,
        },
      });
    }

    return successResponse({
      isDuplicate: false,
      existingCollection: null,
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
