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
  unauthorizedError,
  forbiddenError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  getSummaryService,
  type GenerateOptions,
  type ProviderName,
  SummaryErrorCode,
  SummaryError,
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
    const validation = regenerateSummarySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { bookmarkId, forceProvider } = validation.data;

    // 3. 验证书签存在且属于当前用户
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkRegenRow = { id: number; user_id: string; title: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmark, error: bookmarkError } = await (supabase.from("bookmarks") as any)
      .select("id, user_id, title")
      .eq("id", bookmarkId)
      .single() as { data: BookmarkRegenRow | null; error: { message: string } | null };

    if (bookmarkError || !bookmark) {
      return notFoundError("书签不存在");
    }

    if (bookmark.user_id !== user.id) {
      return forbiddenError("无权操作此书签");
    }

    // 4. 构建生成选项
    const options: GenerateOptions = {
      forceProvider: forceProvider as ProviderName | undefined,
      forceRegenerate: true, // 强制重新生成
    };

    // 5. 调用摘要服务重新生成
    const summaryService = getSummaryService();
    const result = await summaryService.regenerate(
      bookmarkId,
      user.id,
      options,
    );

    // 6. 更新书签摘要
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("bookmarks") as any)
      .update({
        ai_summary: result.summary,
        ai_tags: result.tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId) as { error: { message: string } | null };

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
        userId: user.id,
        bookmarkId,
        provider: result.providerUsed,
        latencyMs: result.latencyMs,
        totalLatencyMs,
        saveStatus,
      },
      "Summary regenerated successfully",
    );

    // 7. 返回结果（包含保存状态）
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
  } catch (error) {
    // 处理摘要服务错误
    if (error instanceof SummaryError) {
      logger.warn(
        {
          code: error.code,
          message: error.message,
          provider: error.provider,
        },
        "Summary regeneration failed with known error",
      );

      switch (error.code) {
        case SummaryErrorCode.PROVIDER_UNAVAILABLE:
          return internalError("摘要服务暂时不可用，请稍后重试");
        case SummaryErrorCode.TIMEOUT:
          return internalError("摘要生成超时，请重试");
        case SummaryErrorCode.CONTENT_TOO_LONG:
          return internalError("内容过长，无法生成摘要");
        default:
          return internalError("重新生成摘要失败");
      }
    }

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/summary/regenerate error",
    );
    return internalError("重新生成摘要失败");
  }
}
