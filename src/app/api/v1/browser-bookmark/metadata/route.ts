/**
 * Browser Bookmark Metadata API v1
 *
 * POST /api/v1/browser-bookmark/metadata - 批量抓取网页元数据
 *
 * @module api/v1/browser-bookmark/metadata
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  batchFetchMetadata,
  type FetchConfig,
  type PageMetadata,
} from "@/lib/browser-bookmark/metadata-fetcher";

interface MetadataItem {
  url: string;
  success: boolean;
  metadata?: PageMetadata;
  error?: string;
}

// 请求 Schema
const MetadataRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50),
  timeout: z.number().int().min(1000).max(30000).default(10000),
  concurrency: z.number().int().min(1).max(10).default(5),
  fetchFavicon: z.boolean().default(true),
});

/**
 * POST /api/v1/browser-bookmark/metadata
 * 批量抓取网页元数据
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 解析请求体
    const body = await request.json();
    const validation = MetadataRequestSchema.safeParse(body);

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

    const { urls, timeout, concurrency, fetchFavicon } = validation.data;

    // 执行批量抓取
    const config: FetchConfig = { timeout, concurrency, fetchFavicon };

    const startTime = Date.now();
    const result = await batchFetchMetadata(urls, config);
    const duration = Date.now() - startTime;

    logger.info(
      {
        userId,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        durationMs: duration,
      },
      "[v1] Metadata fetched",
    );

    const items: MetadataItem[] = result.results.map((r) => ({
      url: r.url,
      success: r.success,
      metadata: r.metadata,
      error: r.error,
    }));

    return NextResponse.json({
      success: true,
      data: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        items,
        durationMs: duration,
      },
    });
  },
);
