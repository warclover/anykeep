/**
 * 智能分类 API
 * POST /api/classification/classify - 对书签进行智能分类
 *
 * V5.1 修复：使用 classifyBookmarkV2 统一入口，确保 V5.0 Pipeline 被正确调用
 * - 快慢路径路由
 * - 托管模式决策
 * - 来源画像更新
 * - 置信度校准
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  classifyBookmarkV2,
  getClassificationVersion,
} from "@/lib/classification/integration";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * 请求体验证 Schema
 */
const classifySchema = z.object({
  bookmarkId: z.number().int().positive().optional(),
  title: z.string().min(1, "标题不能为空").max(500),
  summary: z.string().max(1000).optional().default(""),
  tags: z.array(z.string()).max(20).optional().default([]),
  embedding: z.array(z.number()).optional(),
  url: z.string().url().optional(),
});

/**
 * POST /api/classification/classify
 * 对书签进行智能分类
 *
 * v5.1 修复: 使用 classifyBookmarkV2 统一入口
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
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = classifySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { bookmarkId, title, summary, tags } = validation.data;

    // 3. v5.1 修复: 使用 classifyBookmarkV2 统一入口
    // 这确保了 V5.0 ClassificationPipeline 会被正确调用
    const classificationVersion = getClassificationVersion();

    // 如果没有 bookmarkId，创建临时 ID（用于预分类场景）
    const effectiveBookmarkId = bookmarkId ?? -1;

    const result = await classifyBookmarkV2(
      effectiveBookmarkId,
      title,
      summary || null,
      tags || [],
      user.id,
    );

    logger.info(
      {
        userId: user.id,
        title: title.substring(0, 50),
        version: classificationVersion,
        result: {
          folderId: result.folderId,
          folderName: result.folderName,
          confidence: result.confidence,
          action: result.action,
          classified: result.classified,
        },
      },
      `Classification completed (${classificationVersion})`,
    );

    // 4. 返回分类结果
    return successResponse({
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      action: result.action,
      classified: result.classified,
      suggestionId: result.suggestionId,
      version: classificationVersion,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/classify error",
    );
    return internalError("分类失败");
  }
}
