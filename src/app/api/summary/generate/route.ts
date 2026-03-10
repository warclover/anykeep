/**
 * Summary Generate API
 *
 * POST /api/summary/generate - 为书签生成摘要
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import {
  getSummaryService,
  type SummaryInput,
  type GenerateOptions,
  type ProviderName,
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
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 速率限制：每分钟 10 次
    const rateLimitResult = checkRateLimit(userId, "/api/summary/generate");
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: "请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
          },
        },
      );
    }

    const startTime = Date.now();

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 解析并验证请求体
    const body = await request.json();
    const validation = generateSummarySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { bookmarkId, forceProvider, skipQualityTracking, forceRegenerate } =
      validation.data;

    // 获取书签信息
    // 类型断言: 手动维护类型文件时需要此断言
    type BookmarkGenerateRow = {
      id: number;
      user_id: string;
      title: string;
      url: string | null;
      description: string | null;
      ai_summary: string | null;
    };
    const { data: bookmark, error: bookmarkError } = (await supabase
      .from("bookmarks")
      .select("id, user_id, title, url, description, ai_summary")
      .eq("id", bookmarkId)
      .single()) as {
      data: BookmarkGenerateRow | null;
      error: { message: string } | null;
    };

    if (bookmarkError || !bookmark) {
      return notFoundError("书签不存在");
    }

    if (bookmark.user_id !== userId) {
      return forbiddenError("无权操作此书签");
    }

    // 检查是否已有摘要（非强制重新生成时）
    if (bookmark.ai_summary && !forceRegenerate) {
      return successResponse({
        bookmarkId,
        summary: bookmark.ai_summary,
        cached: true,
        message: "使用已有摘要",
      });
    }

    // 构建摘要输入
    const summaryInput: SummaryInput = {
      bookmarkId: bookmark.id,
      userId,
      title: bookmark.title,
      url: bookmark.url || undefined,
      description: bookmark.description || undefined,
    };

    // 构建生成选项
    const options: GenerateOptions = {
      forceProvider: forceProvider as ProviderName | undefined,
      skipQualityTracking: skipQualityTracking || false,
      forceRegenerate: forceRegenerate || false,
    };

    // 调用摘要服务生成
    const summaryService = getSummaryService();
    const result = await summaryService.generate(summaryInput, options);

    // 更新书签摘要
    const { error: updateError } = (await supabase
      .from("bookmarks")
      .update({
        ai_summary: result.summary,
        ai_tags: result.tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId)) as { error: { message: string } | null };

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
        userId,
        bookmarkId,
        provider: result.providerUsed,
        latencyMs: result.latencyMs,
        totalLatencyMs,
        tagsCount: result.tags.length,
        saveStatus,
      },
      "Summary generated successfully",
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
      cached: false,
      saveStatus,
      ...(saveError && { saveError }),
    });
  },
);
