/**
 * Summary Batch API
 *
 * POST /api/summary/batch - 批量生成书签摘要
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  forbiddenError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  getSummaryService,
  type SummaryInput,
  type GenerateOptions,
  type ProviderName,
} from "@/lib/summary";

/**
 * 批量生成摘要请求 Schema
 */
const batchGenerateSchema = z.object({
  /** 书签 ID 数组 */
  bookmarkIds: z.array(z.number().int().positive()).min(1).max(50),
  /** 强制指定 Provider（可选） */
  forceProvider: z.enum(["deepseek", "aliyun-bailian", "ollama"]).optional(),
  /** 强制重新生成（可选） */
  forceRegenerate: z.boolean().optional().default(false),
});

/**
 * POST /api/summary/batch
 * 批量生成书签摘要
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

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
    const validation = batchGenerateSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { bookmarkIds, forceProvider, forceRegenerate } = validation.data;

    // 3. 获取所有书签信息
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkBatchRow = {
      id: number;
      user_id: string;
      title: string;
      url: string | null;
      description: string | null;
      ai_summary: string | null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmarks, error: bookmarksError } = await (supabase.from("bookmarks") as any)
      .select("id, user_id, title, url, description, ai_summary")
      .in("id", bookmarkIds) as { data: BookmarkBatchRow[] | null; error: { message: string } | null };

    if (bookmarksError) {
      logger.error(
        { error: bookmarksError.message },
        "Failed to fetch bookmarks for batch generation",
      );
      return internalError("获取书签信息失败");
    }

    // 4. 验证所有书签属于当前用户
    const validBookmarks = (bookmarks || []).filter(
      (b) => b.user_id === user.id,
    );
    const invalidIds = bookmarkIds.filter(
      (id) => !validBookmarks.find((b) => b.id === id),
    );

    if (invalidIds.length > 0) {
      return forbiddenError(
        `无权操作以下书签或书签不存在: ${invalidIds.join(", ")}`,
      );
    }

    // 5. 过滤需要生成摘要的书签
    const bookmarksToProcess = forceRegenerate
      ? validBookmarks
      : validBookmarks.filter((b) => !b.ai_summary);

    if (bookmarksToProcess.length === 0) {
      return successResponse({
        processed: 0,
        skipped: validBookmarks.length,
        results: [],
        message: "所有书签已有摘要，无需重新生成",
      });
    }

    // 6. 构建摘要输入数组
    const inputs: SummaryInput[] = bookmarksToProcess.map((b) => ({
      bookmarkId: b.id,
      userId: user.id,
      title: b.title,
      url: b.url || undefined,
      description: b.description || undefined,
    }));

    // 7. 构建生成选项
    const options: GenerateOptions = {
      forceProvider: forceProvider as ProviderName | undefined,
      forceRegenerate,
    };

    // 8. 批量生成摘要
    const summaryService = getSummaryService();
    const results = await summaryService.generateBatch(inputs, options);

    // 9. 处理结果并更新数据库
    const successResults: Array<{
      bookmarkId: number;
      summary: string;
      tags: string[];
      provider?: string;
      saveStatus: "success" | "failed";
      saveError?: string;
    }> = [];
    const errorResults: Array<{
      bookmarkId: number;
      error: string;
    }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const bookmarkId = inputs[i].bookmarkId;

      if (result instanceof Error) {
        errorResults.push({
          bookmarkId,
          error: result.message,
        });
        continue;
      }

      // 更新数据库
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from("bookmarks") as any)
        .update({
          ai_summary: result.summary,
          ai_tags: result.tags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookmarkId) as { error: { message: string } | null };

      // V4.2.4: 修复数据库更新错误被忽略的问题
      // 在结果中包含保存状态
      if (updateError) {
        logger.warn(
          {
            error: updateError.message,
            bookmarkId,
          },
          "Failed to update bookmark in batch",
        );
      }

      successResults.push({
        bookmarkId,
        summary: result.summary,
        tags: result.tags,
        provider: result.providerUsed,
        saveStatus: updateError ? "failed" : "success",
        ...(updateError && { saveError: updateError.message }),
      });
    }

    const totalLatencyMs = Date.now() - startTime;
    const skippedCount = validBookmarks.length - bookmarksToProcess.length;

    logger.info(
      {
        userId: user.id,
        requested: bookmarkIds.length,
        processed: bookmarksToProcess.length,
        succeeded: successResults.length,
        failed: errorResults.length,
        skipped: skippedCount,
        totalLatencyMs,
      },
      "Batch summary generation completed",
    );

    // 10. 返回结果
    return successResponse({
      processed: bookmarksToProcess.length,
      succeeded: successResults.length,
      failed: errorResults.length,
      skipped: skippedCount,
      totalLatencyMs,
      results: successResults,
      errors: errorResults.length > 0 ? errorResults : undefined,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/summary/batch error",
    );
    return internalError("批量生成摘要失败");
  }
}
