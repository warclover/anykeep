/**
 * Summary Generate API
 *
 * POST /api/summary/generate - 为书签生成摘要
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
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
  type SummaryInput,
  type GenerateOptions,
  type ProviderName,
  SummaryErrorCode,
  SummaryError,
} from "@/lib/summary";

/**
 * 生成摘要请求 Schema
 */
const generateSummarySchema = z.object({
  /** 书签 ID */
  bookmarkId: z.number().int().positive(),
  /** 强制指定 Provider（可选） */
  forceProvider: z.enum(["deepseek", "aliyun-bailian", "ollama"]).optional(),
  /** 是否跳过质量追踪（可选） */
  skipQualityTracking: z.boolean().optional(),
  /** 强制重新生成（可选） */
  forceRegenerate: z.boolean().optional(),
});

/**
 * POST /api/summary/generate
 * 为书签生成摘要
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 验证用户身份（使用缓存认证，避免重复验证）
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = generateSummarySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { bookmarkId, forceProvider, skipQualityTracking, forceRegenerate } =
      validation.data;

    // 3. 获取书签信息
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkGenerateRow = {
      id: number;
      user_id: string;
      title: string;
      url: string | null;
      description: string | null;
      ai_summary: string | null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmark, error: bookmarkError } = await (supabase.from("bookmarks") as any)
      .select("id, user_id, title, url, description, ai_summary")
      .eq("id", bookmarkId)
      .single() as { data: BookmarkGenerateRow | null; error: { message: string } | null };

    if (bookmarkError || !bookmark) {
      return notFoundError("书签不存在");
    }

    if (bookmark.user_id !== user.id) {
      return forbiddenError("无权操作此书签");
    }

    // 4. 检查是否已有摘要（非强制重新生成时）
    if (bookmark.ai_summary && !forceRegenerate) {
      return successResponse({
        bookmarkId,
        summary: bookmark.ai_summary,
        cached: true,
        message: "使用已有摘要",
      });
    }

    // 5. 构建摘要输入
    const summaryInput: SummaryInput = {
      bookmarkId: bookmark.id,
      userId: user.id,
      title: bookmark.title,
      url: bookmark.url || undefined,
      description: bookmark.description || undefined,
    };

    // 6. 构建生成选项
    const options: GenerateOptions = {
      forceProvider: forceProvider as ProviderName | undefined,
      skipQualityTracking: skipQualityTracking || false,
      forceRegenerate: forceRegenerate || false,
    };

    // 7. 调用摘要服务生成
    const summaryService = getSummaryService();
    const result = await summaryService.generate(summaryInput, options);

    // 8. 更新书签摘要
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("bookmarks") as any)
      .update({
        ai_summary: result.summary,
        ai_tags: result.tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId) as { error: { message: string } | null };

    // V4.2.4: 修复数据库更新错误被忽略的问题
    // 在响应中包含保存状态，让客户端知道是否需要重试
    let saveStatus: "success" | "failed" = "success";
    let saveError: string | undefined;

    if (updateError) {
      logger.error(
        {
          error: updateError.message,
          bookmarkId,
        },
        "Failed to update bookmark summary",
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
        tagsCount: result.tags.length,
        saveStatus,
      },
      "Summary generated successfully",
    );

    // 9. 返回结果（包含保存状态）
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
      cached: false,
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
        "Summary generation failed with known error",
      );

      // 根据错误码返回合适的响应
      switch (error.code) {
        case SummaryErrorCode.PROVIDER_UNAVAILABLE:
          return internalError("摘要服务暂时不可用，请稍后重试");
        case SummaryErrorCode.TIMEOUT:
          return internalError("摘要生成超时，请重试");
        case SummaryErrorCode.CONTENT_TOO_LONG:
          return internalError("内容过长，无法生成摘要");
        case SummaryErrorCode.QUOTA_EXCEEDED:
          return internalError("配额已用尽，请稍后重试");
        default:
          return internalError("生成摘要失败");
      }
    }

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/summary/generate error",
    );
    return internalError("生成摘要失败");
  }
}
