/**
 * Summary Regenerate API
 *
 * POST /api/summary/regenerate - 重新生成书签摘要
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
  forbiddenError,
  notFoundError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { logger } from "@/lib/logger";
import {
  getSummaryService,
  type GenerateOptions,
  type ProviderName,
} from "@/lib/summary";

/**
 * 重新生成摘要请求 Schema
 */
const regenerateSummarySchema = z.object({
  /** 书签 ID */
  bookmarkId: z.number().int().positive(),
  /** 强制指定 Provider（可选） */
  forceProvider: z.enum(["deepseek", "aliyun-bailian", "ollama"]).optional(),
});

/**
 * POST /api/summary/regenerate
 * 重新生成书签摘要（忽略现有摘要）
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const startTime = Date.now();

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 解析并验证请求体
    const body = await request.json();
    const validation = regenerateSummarySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { bookmarkId, forceProvider } = validation.data;

    // 验证书签存在且属于当前用户
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkRegenRow = { id: number; user_id: string; title: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmark, error: bookmarkError } = (await (
      supabase.from("bookmarks") as any
    )
      .select("id, user_id, title")
      .eq("id", bookmarkId)
      .single()) as {
      data: BookmarkRegenRow | null;
      error: { message: string } | null;
    };

    if (bookmarkError || !bookmark) {
      return notFoundError("书签不存在");
    }

    if (bookmark.user_id !== userId) {
      return forbiddenError("无权操作此书签");
    }

    // 构建生成选项
    const options: GenerateOptions = {
      forceProvider: forceProvider as ProviderName | undefined,
      forceRegenerate: true, // 强制重新生成
    };

    // 调用摘要服务重新生成
    const summaryService = getSummaryService();
    const result = await summaryService.regenerate(bookmarkId, userId, options);

    // 更新书签摘要
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = (await (supabase.from("bookmarks") as any)
      .update({
        ai_summary: result.summary,
        ai_tags: result.tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId)) as { error: { message: string } | null };

    // V4.2.4: 修复数据库更新错误被忽略的问题
    let saveStatus: "success" | "failed" = "success";
    let saveError: string | undefined;

    if (updateError) {
      logger.error(
        {
          error: updateError.message,
          bookmarkId,
        },
        "Failed to update bookmark summary after regeneration",
      );
      saveStatus = "failed";
      saveError = updateError.message;
    }

    const totalLatencyMs = Date.now() - startTime;

    logger.info(
      {
        userId,
        bookmarkId,
        provider: result.providerUsed,
        latencyMs: result.latencyMs,
        totalLatencyMs,
        saveStatus,
      },
      "Summary regenerated successfully",
    );

    // 返回结果（包含保存状态）
    return successResponse({
      bookmarkId,
      summary: result.summary,
      tags: result.tags,
      version: result.version,
      structured: result.structured,
      provider: result.providerUsed,
      model: result.modelUsed,
      contentType: result.contentType,
      usage: result.usage,
      latencyMs: result.latencyMs,
      totalLatencyMs,
      regenerated: true,
      saveStatus,
      ...(saveError && { saveError }),
    });
  },
);
