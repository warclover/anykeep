/**
 * MD 收藏 AI 处理 API 路由
 * P2-007: Markdown 内容收藏
 *
 * POST /api/md-collections/[id]/process - 触发 AI 处理
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  notFoundError,
  forbiddenError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { MD_COLLECTION, AUTH } from "@/lib/constants/messages";
import { processMdCollectionAI } from "@/features/md-collections/lib/ai-processor";

/**
 * POST /api/md-collections/[id]/process
 * 手动触发 MD 收藏的 AI 处理
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id);

    if (isNaN(collectionId)) {
      return notFoundError(MD_COLLECTION.NOT_FOUND);
    }

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 检查 MD 收藏是否存在且属于当前用户
    const { data: collection, error: checkError } = await supabase
      .from("md_collections")
      .select("id, user_id, processing_status")
      .eq("id", collectionId)
      .is("deleted_at", null)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(MD_COLLECTION.NOT_FOUND);
      }
      return databaseError(MD_COLLECTION.LOAD_ERROR, checkError);
    }

    if (collection.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 3. 检查是否正在处理中
    if (collection.processing_status === "processing") {
      return forbiddenError("该收藏正在处理中，请稍后再试");
    }

    // 4. 执行 AI 处理
    const result = await processMdCollectionAI(collectionId, user.id);

    if (!result.success) {
      logger.error(
        {
          collectionId,
          userId: user.id,
          error: result.error,
          action: "md_process_failed",
        },
        "MD collection AI processing failed",
      );
      return internalError(result.error || MD_COLLECTION.PROCESS_ERROR);
    }

    logger.info(
      {
        collectionId,
        userId: user.id,
        hasSummary: !!result.summary,
        hasTags: !!result.aiTags,
        hasEmbedding: !!result.embedding,
        action: "md_process_success",
      },
      "MD collection AI processing completed",
    );

    return successResponse({
      id: collectionId,
      processed: true,
      summary: result.summary,
      aiTags: result.aiTags,
      hasEmbedding: !!result.embedding,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "process_md_collection",
      },
      "POST /api/md-collections/[id]/process error",
    );
    return internalError(MD_COLLECTION.PROCESS_ERROR);
  }
}
