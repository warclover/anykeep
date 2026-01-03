/**
 * MD 收藏 AI 处理 API 路由
 * P2-007: Markdown 内容收藏
 *
 * POST /api/md-collections/[id]/process - 触发 AI 处理
 *
 * Query params:
 * - force: boolean - 强制重试（用于卡住的任务恢复）
 *
 * @version 2.0.0 - 使用新的 MD 专用 AI 处理器
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
// 使用新的 MD 专用 AI 处理器
import { processMdCollectionAI } from "@/features/md-collections/lib/ai";

/**
 * POST /api/md-collections/[id]/process
 * 手动触发 MD 收藏的 AI 处理
 *
 * @param force - 强制重试卡住的任务（超过 2 分钟的 processing 状态）
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

    // 解析 force 参数（用于卡住任务的强制重试）
    const forceRetry = request.nextUrl.searchParams.get("force") === "true";

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
    // 类型断言: 手动维护类型文件时需要此断言
    type CollectionProcessRow = { id: number; user_id: string; processing_status: string; created_at: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: collection, error: checkError } = await (supabase.from("md_collections") as any)
      .select("id, user_id, processing_status, created_at")
      .eq("id", collectionId)
      .is("deleted_at", null)
      .single() as { data: CollectionProcessRow | null; error: { code?: string; message: string } | null };

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(MD_COLLECTION.NOT_FOUND);
      }
      return databaseError(MD_COLLECTION.LOAD_ERROR, checkError);
    }

    if (!collection || collection.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 3. 检查是否正在处理中（除非强制重试）
    if (collection.processing_status === "processing" && !forceRetry) {
      return forbiddenError("该收藏正在处理中，请稍后再试");
    }

    // 4. 如果强制重试且状态是 processing，检查是否真的卡住了（超过 2 分钟）
    if (collection.processing_status === "processing" && forceRetry) {
      const createdAt = new Date(collection.created_at).getTime();
      const elapsed = Date.now() - createdAt;
      const STUCK_THRESHOLD = 120000; // 2 分钟

      if (elapsed < STUCK_THRESHOLD) {
        // 还没卡住，不允许强制重试
        return forbiddenError("任务正在处理中，请稍后再试");
      }

      logger.info(
        {
          collectionId,
          userId: user.id,
          elapsedMs: elapsed,
          action: "force_retry_stuck_task",
        },
        "Force retrying stuck MD collection processing",
      );
    }

    // 5. 执行 AI 处理（使用新的 MD 专用处理器）
    const result = await processMdCollectionAI(collectionId, user.id, {
      forceReprocess: forceRetry,
    });

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
