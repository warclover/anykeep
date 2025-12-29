/**
 * Browser Bookmark Validate API v1
 *
 * POST /api/v1/browser-bookmark/validate - 批量检测链接有效性
 *
 * @module api/v1/browser-bookmark/validate
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  validateUrls,
  type ValidationConfig,
} from "@/lib/browser-bookmark/link-validator";

// 限制常量
const MAX_BOOKMARKS = 100;
const MAX_TIMEOUT = 10000;
const MAX_CONCURRENCY = 20;

// 请求体 Schema
const ValidateRequestSchema = z.object({
  bookmarks: z
    .array(
      z.object({
        id: z.string().min(1),
        url: z.string().url(),
      }),
    )
    .min(1)
    .max(MAX_BOOKMARKS),
  options: z
    .object({
      timeout: z.number().int().min(1000).max(MAX_TIMEOUT).default(5000),
      concurrency: z.number().int().min(1).max(MAX_CONCURRENCY).default(10),
    })
    .optional(),
});

/**
 * POST /api/v1/browser-bookmark/validate
 * 批量检测书签链接有效性
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 解析请求体
    const body = await request.json();
    const validation = ValidateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "请求参数验证失败",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const { bookmarks, options } = validation.data;

    // 空列表快速返回
    if (bookmarks.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          valid: 0,
          invalid: 0,
          timeout: 0,
          error: 0,
          results: [],
          durationMs: 0,
        },
      });
    }

    // 构建配置
    const config: ValidationConfig = {
      timeout: options?.timeout ?? 5000,
      concurrency: options?.concurrency ?? 10,
      retries: 1,
    };

    logger.info(
      {
        userId,
        count: bookmarks.length,
        timeout: config.timeout,
        concurrency: config.concurrency,
      },
      "[v1] Starting link validation",
    );

    try {
      // 执行验证
      const result = await validateUrls(bookmarks, config);

      logger.info(
        {
          userId,
          total: result.total,
          valid: result.valid,
          invalid: result.invalid,
          timeout: result.timeout,
          error: result.error,
          durationMs: result.durationMs,
        },
        "[v1] Link validation completed",
      );

      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          bookmarkCount: bookmarks.length,
        },
        "[v1] Link validation failed",
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "链接验证失败，请稍后重试",
          },
        },
        { status: 500 },
      );
    }
  },
);
